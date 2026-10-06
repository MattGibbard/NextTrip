import type { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { normaliseEmail, randomToken, sha256 } from "../shared/auth";
import { HttpError } from "./env";
import type { App, Ctx, Env, Role } from "./env";

const COOKIE = "nexttrip_session";
const SESSION_DAYS: Record<Role, number> = { owner: 180, member: 365 };
/** How long an emailed sign-in link works for. */
const LINK_MINUTES = 20;
/** Sign-in emails allowed per address in a 15-minute window. */
const LINKS_PER_WINDOW = 3;

export async function readSession(c: Ctx): Promise<{ family: number; role: Role } | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const row = await c.env.DB.prepare("SELECT family_id, role FROM sessions WHERE token_hash = ? AND expires_at > datetime('now')")
    .bind(await sha256(token))
    .first<{ family_id: number; role: Role }>();
  return row ? { family: row.family_id, role: row.role } : null;
}

async function startSession(c: Ctx, family: number, role: Role) {
  const token = randomToken(32);
  const days = SESSION_DAYS[role];
  await c.env.DB.batch([
    // Tidy up while we're here.
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')"),
    c.env.DB.prepare(`INSERT INTO sessions (token_hash, family_id, role, expires_at) VALUES (?, ?, ?, datetime('now', '+${days} days'))`).bind(
      await sha256(token),
      family,
      role,
    ),
  ]);
  setCookie(c, COOKIE, token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: days * 86400 });
}

async function endSession(c: Ctx) {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  deleteCookie(c, COOKIE, { path: "/", secure: true });
}

async function bodyOf(c: Ctx): Promise<Record<string, unknown>> {
  try {
    const b = await c.req.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

async function sendSignInEmail(env: Env, to: string, link: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM || "NextTrip <onboarding@resend.dev>",
      to: [to],
      subject: "Your NextTrip sign-in link",
      text: `Open this link to sign in to NextTrip:\n\n${link}\n\nIt works once, for the next ${LINK_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111">
<p>Tap the button to sign in to NextTrip.</p>
<p><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Sign in to NextTrip</a></p>
<p style="color:#666;font-size:14px">It works once, for the next ${LINK_MINUTES} minutes. If you didn't ask for it, you can ignore this email.</p>
</div>`,
    }),
  }).catch(() => null);
  if (!res?.ok) {
    console.error("Resend failed", res?.status, await res?.text().catch(() => ""));
    throw new HttpError(503, "We couldn't send the email just now. Try again in a minute.");
  }
}

/**
 * Pull request previews share the live database, so the old site can keep
 * adding rows after the migration has run. Anything without a family is family 1's.
 */
async function adoptOrphans(db: D1Database) {
  await db.batch(["people", "trips", "ideas", "rounds"].map((t) => db.prepare(`UPDATE ${t} SET family_id = 1 WHERE family_id IS NULL`)));
}

/** The family this email organises, creating one (or claiming family 1) the first time. */
async function familyFor(env: Env, emailHash: string): Promise<number> {
  const db = env.DB;
  const existing = await db.prepare("SELECT id FROM families WHERE email_hash = ?").bind(emailHash).first<{ id: number }>();
  if (existing) {
    if (existing.id === 1) await adoptOrphans(db);
    return existing.id;
  }
  const owner = normaliseEmail(env.OWNER_EMAIL);
  if (owner && (await sha256(owner)) === emailHash) {
    const claimed = await db.prepare("UPDATE families SET email_hash = ? WHERE id = 1 AND email_hash IS NULL").bind(emailHash).run();
    if (claimed.meta.changes) {
      // Settings may have changed on the old site since the migration ran.
      await db.prepare("INSERT OR REPLACE INTO family_settings (family_id, key, value) SELECT 1, key, value FROM settings").run();
      await adoptOrphans(db);
      return 1;
    }
  }
  const row = await db.prepare("INSERT INTO families (email_hash, share_token) VALUES (?, ?) RETURNING id")
    .bind(emailHash, randomToken(18))
    .first<{ id: number }>();
  return row!.id;
}

export function authRoutes(app: Hono<App>) {
  app.get("/auth/me", async (c) => {
    const s = await readSession(c);
    if (!s) return c.json({ signed_in: false });
    const share = s.role === "owner"
      ? (await c.env.DB.prepare("SELECT share_token FROM families WHERE id = ?").bind(s.family).first<{ share_token: string }>())?.share_token ?? null
      : null;
    return c.json({ signed_in: true, role: s.role, share_token: share });
  });

  app.post("/auth/email", async (c) => {
    const email = normaliseEmail((await bodyOf(c)).email);
    if (!email) throw new HttpError(400, "That doesn't look like an email address");
    const dev = c.env.DEV_LOGIN_LINKS === "1";
    if (!c.env.RESEND_API_KEY && !dev) throw new HttpError(503, "Sign-in emails aren't set up yet");
    const db = c.env.DB;
    const emailHash = await sha256(email);
    const recent = await db.prepare("SELECT COUNT(*) AS n FROM login_links WHERE email_hash = ? AND created_at > datetime('now', '-15 minutes')")
      .bind(emailHash)
      .first<{ n: number }>();
    if ((recent?.n ?? 0) >= LINKS_PER_WINDOW) throw new HttpError(429, "We've sent a few links already. Check your inbox, or try again in 15 minutes.");
    const token = randomToken(32);
    await db.batch([
      db.prepare("DELETE FROM login_links WHERE expires_at <= datetime('now', '-1 day')"),
      db.prepare(`INSERT INTO login_links (token_hash, email_hash, expires_at) VALUES (?, ?, datetime('now', '+${LINK_MINUTES} minutes'))`).bind(
        await sha256(token),
        emailHash,
      ),
    ]);
    const link = `${new URL(c.req.url).origin}/signin?token=${token}`;
    if (c.env.RESEND_API_KEY) await sendSignInEmail(c.env, email, link);
    return c.json(dev && !c.env.RESEND_API_KEY ? { ok: true, dev_link: link } : { ok: true });
  });

  // The link in the email opens a page with a button that calls this, so email
  // scanners that open links ahead of you don't use it up.
  app.post("/auth/verify", async (c) => {
    const token = (await bodyOf(c)).token;
    if (typeof token !== "string" || token.length > 100) throw new HttpError(400, "That sign-in link isn't valid");
    const db = c.env.DB;
    const row = await db.prepare("DELETE FROM login_links WHERE token_hash = ? AND expires_at > datetime('now') RETURNING email_hash")
      .bind(await sha256(token))
      .first<{ email_hash: string }>();
    if (!row) throw new HttpError(400, "That sign-in link has expired or been used. Ask for a new one.");
    await startSession(c, await familyFor(c.env, row.email_hash), "owner");
    return c.json({ ok: true });
  });

  app.post("/auth/join", async (c) => {
    const token = (await bodyOf(c)).token;
    if (typeof token !== "string" || token.length > 100) throw new HttpError(404, "That family link isn't valid");
    const family = await c.env.DB.prepare("SELECT id FROM families WHERE share_token = ?").bind(token).first<{ id: number }>();
    if (!family) throw new HttpError(404, "That family link doesn't work any more. Ask for a new one.");
    // The organiser opening their own link stays the organiser.
    const current = await readSession(c);
    if (current?.family !== family.id) {
      if (current) await endSession(c);
      await startSession(c, family.id, "member");
    }
    return c.json({ ok: true });
  });

  app.post("/auth/logout", async (c) => {
    await endSession(c);
    return c.json({ ok: true });
  });
}

/** Routes that need a signed-in family. Registered after the session middleware. */
export function familyRoutes(app: Hono<App>) {
  // A new share link stops the old one working and signs out everyone who used it.
  app.post("/family/share-link", async (c) => {
    requireOwner(c);
    const token = randomToken(18);
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE families SET share_token = ? WHERE id = ?").bind(token, c.get("family")),
      c.env.DB.prepare("DELETE FROM sessions WHERE family_id = ? AND role = 'member'").bind(c.get("family")),
    ]);
    return c.json({ share_token: token });
  });
}

export function requireOwner(c: Ctx) {
  if (c.get("role") !== "owner") throw new HttpError(403, "Only the family organiser can do that");
}
