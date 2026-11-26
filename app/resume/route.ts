import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { PENDING_COOKIE, isResumable, pendingFromCookieHeader } from "@/lib/pending";

/**
 * Sign-in's default destination. Sends a returning visitor to the search or
 * request they started before signing up (once — the cookie is cleared), or
 * home. Onboarding still runs first: the app page they land on redirects to
 * /welcome with itself as `next`.
 */
export function GET(req: NextRequest) {
  if (!getSessionCookie(req)) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", "/resume" + req.nextUrl.search);
    return NextResponse.redirect(login);
  }
  // The URL's copy first (this sign-in's own), else the cookie (an earlier visit).
  const to = req.nextUrl.searchParams.get("to");
  const fromCookie = pendingFromCookieHeader(req.headers.get("cookie"));
  const pending = isResumable(to) ? to : fromCookie;
  const res = NextResponse.redirect(new URL(pending ?? "/home", req.url));
  if (fromCookie) res.cookies.delete(PENDING_COOKIE);
  return res;
}
