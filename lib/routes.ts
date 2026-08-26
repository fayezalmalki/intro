/**
 * Which paths require a signed-in visitor.
 *
 * Kept apart from middleware.ts so it can be tested without pulling NextAuth
 * (and, through it, the Edge runtime shims) into the test environment.
 */
const PROTECTED_PREFIXES = ["/requests", "/am", "/new"];

/**
 * "/" is the public landing and stays open — it is the entire pitch, and a
 * visitor who has not signed up yet is exactly who it is for. Intake lives at
 * /new and is protected, because a request belongs to an account from the
 * moment it is created.
 */
export function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}
