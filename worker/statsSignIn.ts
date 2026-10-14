import { normaliseEmail, randomToken, sha256 } from "../shared/auth";
import { passedTurnstile, randomCode, turnstileKey } from "./auth";
import type { Env } from "./env";
import { STATS_PATH, esc, htmlPage, pageShell } from "./stats";

/**
 * Sign-in for the stats page. Only the addresses in the STATS_EMAILS secret (comma-separated) get an emailed
 * 6-digit code; anyone else sees the same "check your inbox" screen but no email is sent, so the page doesn't
 * say who's allowed. A code rather than a link, because a link opens in the phone's browser, while the page
 * added to the home screen keeps its own sign-in.
 */
const COOKIE = "stats_session";
const SESSION_DAYS = 180;
const CODE_MINUTES = 20;
/** Codes sent to one address in 15 minutes. */
const CODES_PER_WINDOW = 3;
/** Wrong guesses before an address's codes stop working. */
const CODE_TRIES = 5;

const codeHash = (emailHash: string, code: string) => sha256(`stats:${emailHash}:${code}`);

async function allowedHashes(env: Env): Promise<Set<string>> {
  const emails = (env.STATS_EMAILS ?? "").split(/[\s,;]+/).map(normaliseEmail).filter((e): e is string => !!e);
  return new Set(await Promise.all(emails.map((e) => sha256(e))));
}

function cookieToken(req: Request): string | null {
  const match = (req.headers.get("Cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([\\w-]+)`));
  return match ? match[1] : null;
}

const sessionCookie = (token: string, days: number) =>
  `${COOKIE}=${token}; Path=${STATS_PATH}; Max-Age=${days * 86400}; HttpOnly; Secure; SameSite=Lax`;

const backToStats = (cookie?: string) =>
  new Response(null, { status: 303, headers: { Location: STATS_PATH, "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) } });

/** True when this browser is signed in to the stats page; otherwise the sign-in page or a redirect to show instead. */
export async function statsSignIn(req: Request, env: Env): Promise<true | Response> {
  const db = env.DB;
  const allowed = await allowedHashes(env);
  const token = cookieToken(req);
  let signedIn = false;
  if (token) {
    const row = await db.prepare("SELECT email_hash FROM stats_sessions WHERE token_hash = ? AND expires_at > datetime('now')")
      .bind(await sha256(token))
      .first<{ email_hash: string }>();
    signedIn = !!row && allowed.has(row.email_hash);
  }

  const bot = turnstileKey(env);
  if (req.method === "GET" || req.method === "HEAD") return signedIn ? true : htmlPage(emailForm(bot));
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  // Forms posted from another site don't count, so nobody can sign this browser in or out from elsewhere.
  if (req.headers.get("Origin") !== new URL(req.url).origin) return new Response("Forbidden", { status: 403 });

  const form = await req.formData().catch(() => null);
  const action = form?.get("action");
  if (action === "signout") {
    if (token) await db.prepare("DELETE FROM stats_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    return backToStats(sessionCookie("", 0));
  }
  if (signedIn) return backToStats();

  const email = normaliseEmail(form?.get("email"));
  if (!email) return htmlPage(emailForm(bot, "That doesn't look like an email address."), { status: 400 });
  const emailHash = await sha256(email);
  const dev = env.DEV_LOGIN_LINKS === "1" && !env.RESEND_API_KEY;

  if (action === "send") {
    if (!env.RESEND_API_KEY && !dev) return htmlPage(emailForm(bot, "Sign-in emails aren't set up yet."), { status: 503 });
    // The same invisible bot check as the site's own sign-in form, when its keys are set.
    if (bot && !(await passedTurnstile(env, form?.get("cf-turnstile-response"), req.headers.get("CF-Connecting-IP")))) {
      return htmlPage(emailForm(bot, "We couldn't check you're not a bot. Try again."), { status: 403 });
    }
    if (!allowed.has(emailHash)) return htmlPage(codeForm(bot, email));
    const recent = await db.prepare("SELECT COUNT(*) AS n FROM stats_codes WHERE email_hash = ? AND created_at > datetime('now', '-15 minutes')")
      .bind(emailHash)
      .first<{ n: number }>();
    if ((recent?.n ?? 0) >= CODES_PER_WINDOW) {
      return htmlPage(codeForm(bot, email, "We've sent a few codes already. Check your inbox, or try again in 15 minutes."), { status: 429 });
    }
    const code = randomCode();
    await db.batch([
      db.prepare("DELETE FROM stats_codes WHERE expires_at <= datetime('now')"),
      db.prepare(`INSERT INTO stats_codes (email_hash, code_hash, expires_at) VALUES (?, ?, datetime('now', '+${CODE_MINUTES} minutes'))`)
        .bind(emailHash, await codeHash(emailHash, code)),
    ]);
    if (dev) return htmlPage(codeForm(bot, email, undefined, code));
    if (!(await sendCode(env, email, code))) return htmlPage(emailForm(bot, "We couldn't send the email just now. Try again in a minute."), { status: 503 });
    return htmlPage(codeForm(bot, email));
  }

  if (action === "code") {
    const code = String(form?.get("code") ?? "").replace(/\D/g, "");
    const live = `email_hash = ? AND expires_at > datetime('now') AND tries < ${CODE_TRIES}`;
    const hit = code.length === 6 && allowed.has(emailHash)
      ? await db.prepare(`DELETE FROM stats_codes WHERE ${live} AND code_hash = ? RETURNING email_hash`)
          .bind(emailHash, await codeHash(emailHash, code))
          .first()
      : null;
    if (!hit) {
      // A wrong guess counts against every live code for this address.
      await db.prepare(`UPDATE stats_codes SET tries = tries + 1 WHERE ${live}`).bind(emailHash).run();
      return htmlPage(codeForm(bot, email, "That code didn't work. Check the latest email, or send a new one."), { status: 400 });
    }
    const session = randomToken(32);
    await db.batch([
      db.prepare("DELETE FROM stats_sessions WHERE expires_at <= datetime('now')"),
      db.prepare(`INSERT INTO stats_sessions (token_hash, email_hash, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`)
        .bind(await sha256(session), emailHash),
    ]);
    return backToStats(sessionCookie(session, SESSION_DAYS));
  }

  return htmlPage(emailForm(bot), { status: 400 });
}

async function sendCode(env: Env, to: string, code: string): Promise<boolean> {
  const shown = `${code.slice(0, 3)} ${code.slice(3)}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM || "somewhere.party <onboarding@resend.dev>",
      to: [to],
      subject: `${shown} is your somewhere🎉 stats code`,
      text: `Your code for the somewhere🎉 stats page is ${shown}.\n\nIt works once and runs out in ${CODE_MINUTES} minutes. Didn't ask for it? You can ignore this email.`,
      html: `<p style="font-family:Inter,system-ui,sans-serif;font-size:16px;color:#1c2421">Your code for the somewhere🎉 stats page is</p><p style="font-family:'DM Mono',ui-monospace,Menlo,monospace;font-size:32px;font-weight:500;letter-spacing:6px;color:#1c2421;margin:8px 0 16px">${shown}</p><p style="font-family:Inter,system-ui,sans-serif;font-size:14px;color:#66716c">It works once and runs out in ${CODE_MINUTES} minutes. Didn't ask for it? You can ignore this email.</p>`,
    }),
  }).catch(() => null);
  if (!res?.ok) console.error("Resend failed for stats code", res?.status, await res?.text().catch(() => ""));
  return !!res?.ok;
}

/**
 * The Turnstile widget, rendered by Cloudflare's script into the form. Its answer arrives as the
 * cf-turnstile-response field. With the key set to Invisible nothing shows unless Cloudflare wants a tick.
 */
const botCheck = (siteKey: string | null) =>
  siteKey
    ? `<div class="cf-turnstile" data-sitekey="${esc(siteKey)}" data-action="stats"></div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : "";

const error = (message?: string) => (message ? `<p class="error" role="alert">${esc(message)}</p>` : "");

function emailForm(siteKey: string | null, message?: string): string {
  return pageShell(
    "",
    `<form class="panel signin" method="post" action="${STATS_PATH}">
  <label for="email">Your email</label>
  <input id="email" name="email" type="email" autocomplete="email" inputmode="email" required autofocus>
  ${error(message)}
  ${botCheck(siteKey)}
  <button name="action" value="send">Email me a code</button>
</form>`,
    false,
  );
}

function codeForm(siteKey: string | null, email: string, message?: string, devCode?: string): string {
  return pageShell(
    "",
    `<form class="panel signin" method="post" action="${STATS_PATH}">
  <p class="note">If ${esc(email)} can see the stats, we've emailed it a 6-digit code.${devCode ? ` Test code: <b>${devCode}</b>` : ""}</p>
  <input type="hidden" name="email" value="${esc(email)}">
  <label for="code">Code</label>
  <input id="code" class="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" maxlength="7" required autofocus>
  ${error(message)}
  ${botCheck(siteKey)}
  <button name="action" value="code">Sign in</button>
  <button class="again" name="action" value="send" formnovalidate>Send a new code</button>
</form>`,
    false,
  );
}
