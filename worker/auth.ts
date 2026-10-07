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

/** How long a link the organiser makes for one person works for. */
const PERSON_LINK_DAYS = 7;

export interface SessionInfo {
  family: number;
  role: Role;
  /** Who this browser is. Set by the server, never by the browser. */
  person: number | null;
}

export async function readSession(c: Ctx): Promise<SessionInfo | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const db = c.env.DB;
  const hash = await sha256(token);
  const row = await db.prepare(
    `SELECT s.family_id, s.role, s.legacy, p.id AS person_id FROM sessions s
     LEFT JOIN people p ON p.id = s.person_id AND p.family_id = s.family_id AND p.removed = 0
     WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
  )
    .bind(hash)
    .first<{ family_id: number; role: Role; legacy: number; person_id: number | null }>();
  if (!row) return null;
  let person = row.person_id;
  // A browser signed in before people were tied to sessions keeps whoever it had picked.
  if (person === null && row.legacy) {
    const raw = Number(c.req.header("X-Person-Id"));
    const picked = Number.isInteger(raw)
      ? await db.prepare("SELECT id FROM people WHERE id = ? AND family_id = ? AND removed = 0").bind(raw, row.family_id).first<{ id: number }>()
      : null;
    if (picked) {
      await db.prepare("UPDATE sessions SET person_id = ?, legacy = 0 WHERE token_hash = ?").bind(picked.id, hash).run();
      person = picked.id;
    }
  }
  return { family: row.family_id, role: row.role, person };
}

/** Ties this browser's session to a person. */
export async function setSessionPerson(c: Ctx, person: number) {
  const token = getCookie(c, COOKIE);
  if (!token) throw new HttpError(401, "Sign in to carry on");
  await c.env.DB.prepare("UPDATE sessions SET person_id = ?, legacy = 0 WHERE token_hash = ?").bind(person, await sha256(token)).run();
}

async function startSession(c: Ctx, family: number, role: Role, person: number | null = null) {
  const token = randomToken(32);
  const days = SESSION_DAYS[role];
  await c.env.DB.batch([
    // Tidy up while we're here.
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')"),
    c.env.DB.prepare(
      `INSERT INTO sessions (token_hash, family_id, role, person_id, expires_at) VALUES (?, ?, ?, ?, datetime('now', '+${days} days'))`,
    ).bind(await sha256(token), family, role, person),
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
      from: env.EMAIL_FROM || "somewhere.party <onboarding@resend.dev>",
      to: [to],
      subject: "Your somewhere.party sign-in link",
      text: `Open this link to sign in to somewhere.party:\n\n${link}\n\nIt works once, for the next ${LINK_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111">
<p>Tap the button to sign in to somewhere.party.</p>
<p><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Sign in to somewhere.party</a></p>
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
    return c.json({ signed_in: true, role: s.role, share_token: share, person_id: s.person });
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

  // A link the organiser made for one person: signs this browser in as them.
  app.post("/auth/person-link", async (c) => {
    const token = (await bodyOf(c)).token;
    if (typeof token !== "string" || token.length > 100) throw new HttpError(404, "That sign-in link isn't valid");
    const db = c.env.DB;
    const link = await db.prepare(
      `DELETE FROM person_links WHERE token_hash = ? AND expires_at > datetime('now')
       AND person_id IN (SELECT id FROM people WHERE removed = 0) RETURNING family_id, person_id`,
    )
      .bind(await sha256(token))
      .first<{ family_id: number; person_id: number }>();
    if (!link) throw new HttpError(404, "That sign-in link has expired or been used. Ask your family organiser for a new one.");
    // The organiser opening a link in their own browser stays the organiser.
    const current = await readSession(c);
    if (current?.family === link.family_id && current.role === "owner") {
      await setSessionPerson(c, link.person_id);
    } else {
      if (current) await endSession(c);
      await startSession(c, link.family_id, "member", link.person_id);
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

  // A one-off link that signs a person in on a new device.
  app.post("/family/people/:id/link", async (c) => {
    requireOwner(c);
    const person = await ownPerson(c);
    const token = randomToken(24);
    const db = c.env.DB;
    await db.batch([
      db.prepare("DELETE FROM person_links WHERE expires_at <= datetime('now')"),
      // Only the newest link for someone works.
      db.prepare("DELETE FROM person_links WHERE person_id = ?").bind(person),
      db.prepare(`INSERT INTO person_links (token_hash, family_id, person_id, expires_at) VALUES (?, ?, ?, datetime('now', '+${PERSON_LINK_DAYS} days'))`).bind(
        await sha256(token),
        c.get("family"),
        person,
      ),
    ]);
    return c.json({ url: `${new URL(c.req.url).origin}/p/${token}`, days: PERSON_LINK_DAYS });
  });

  // Signs a person out on every device, for a lost phone or a mix-up. The organiser's own browser stays signed in.
  app.post("/family/people/:id/sign-out", async (c) => {
    requireOwner(c);
    const person = await ownPerson(c);
    const db = c.env.DB;
    await db.batch([
      db.prepare("DELETE FROM sessions WHERE person_id = ? AND role = 'member'").bind(person),
      db.prepare("DELETE FROM person_links WHERE person_id = ?").bind(person),
    ]);
    return c.json({ ok: true });
  });

  // Deletes the organiser's account and everything the family made, and signs everyone out.
  app.delete("/family", async (c) => {
    requireOwner(c);
    if ((await bodyOf(c)).confirm !== DELETE_CONFIRMATION) throw new HttpError(400, `Type ${DELETE_CONFIRMATION} to confirm`);
    await c.env.DB.batch(deleteFamilyStatements(c.env.DB, c.get("family")));
    deleteCookie(c, COOKIE, { path: "/", secure: true });
    return c.json({ ok: true });
  });
}

/** What the organiser types to confirm deleting their account. */
export const DELETE_CONFIRMATION = "DELETE";

/**
 * Everything a family has, in an order the foreign keys allow. Deleting a round
 * takes its points, locks, vetoes and swipes with it, and trips and ideas take their places.
 */
export function deleteFamilyStatements(db: D1Database, family: number): D1PreparedStatement[] {
  const stmts = [
    "DELETE FROM rounds WHERE family_id = ?1",
    "DELETE FROM trips WHERE family_id = ?1",
    "DELETE FROM ideas WHERE family_id = ?1",
    // Sessions and person links point at people, so they go first.
    "DELETE FROM sessions WHERE family_id = ?1",
    "DELETE FROM person_links WHERE family_id = ?1",
    "DELETE FROM people WHERE family_id = ?1",
    "DELETE FROM family_settings WHERE family_id = ?1",
    "DELETE FROM login_links WHERE email_hash = (SELECT email_hash FROM families WHERE id = ?1)",
    "DELETE FROM families WHERE id = ?1",
  ];
  // Family 1 also owns the settings from before families existed.
  if (family === 1) stmts.push("DELETE FROM settings");
  return stmts.map((sql) => (sql.includes("?1") ? db.prepare(sql).bind(family) : db.prepare(sql)));
}

/** The :id person, if they're in this family and haven't been removed. */
async function ownPerson(c: Ctx): Promise<number> {
  const id = Number(c.req.param("id"));
  const row = Number.isInteger(id)
    ? await c.env.DB.prepare("SELECT id FROM people WHERE id = ? AND family_id = ? AND removed = 0").bind(id, c.get("family")).first<{ id: number }>()
    : null;
  if (!row) throw new HttpError(404, "Not found");
  return row.id;
}

export function requireOwner(c: Ctx) {
  if (c.get("role") !== "owner") throw new HttpError(403, "Only the family organiser can do that");
}
