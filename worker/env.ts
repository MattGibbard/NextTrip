import type { Context } from "hono";

export interface Env {
  DB: D1Database;
  /** The built site in dist/client. The Worker runs first for every request and hands pages over to it. */
  ASSETS: Fetcher;
  /** Resend API key, set as a secret. Without it no sign-in emails go out. */
  RESEND_API_KEY?: string;
  /** Who sign-in emails come from. Resend's test sender until a domain is verified. */
  EMAIL_FROM?: string;
  /** The organiser of family 1, which holds everything made before sign-in existed. A secret. */
  OWNER_EMAIL?: string;
  /** The GitHub OAuth app the content editor at /admin signs in with (worker/cms.ts). Secrets. */
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  /** "1" in local development: the sign-in link comes back in the response instead of by email. */
  DEV_LOGIN_LINKS?: string;
}

export type Role = "owner" | "member";

export interface Vars {
  family: number;
  role: Role;
  /** The family member this browser picked, if any. */
  person: number | null;
}

export type App = { Bindings: Env; Variables: Vars };
export type Ctx = Context<App>;

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 429 | 503,
    message: string,
  ) {
    super(message);
  }
}
