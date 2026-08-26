/**
 * Which paths require a signed-in visitor.
 *
 * Kept apart from middleware.ts so it can be tested without pulling NextAuth
 * (and, through it, the Edge runtime shims) into the test environment.
 */
const PROTECTED_PREFIXES = ["/requests", "/am"];

/**
 * The intake page is protected too, and by exact match rather than prefix: a
 * request belongs to an account from the moment it is created, so the page
 * resolves the session. Left unprotected it threw for signed-out visitors — a
 * 500 on the product's front door. A prefix match cannot express this, since
 * "/" prefixes every path, /login included.
 */
export function isProtected(pathname: string): boolean {
  return pathname === "/" || PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}
