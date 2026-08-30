/**
 * Which paths require a signed-in visitor.
 *
 * Kept apart from middleware.ts so it can be tested without pulling NextAuth
 * (and, through it, the Edge runtime shims) into the test environment.
 */
const PROTECTED_PREFIXES = ["/requests", "/am", "/new", "/gtm"];

/**
 * "/" is the public landing and stays open — it is the entire pitch, and a
 * visitor who has not signed up yet is exactly who it is for. Intake lives at
 * /new and is protected, because a request belongs to an account from the
 * moment it is created.
 *
 * /gtm is protected for the same reason: a run belongs to an account from the
 * moment the website is submitted, and everything under it — the profile, the
 * segments, the bought rows — is that account's data.
 *
 * /examples stays open, and deliberately so. It renders the composer over
 * hand-written fixtures and reads nothing from the database, so there is no
 * account data to leak and it is the one page that shows a stranger what the
 * writing actually looks like.
 */
export function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}
