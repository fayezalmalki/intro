/**
 * Redirects visitors without a session cookie to /login.
 *
 * An optimistic check on the cookie's presence only — it does not hit the
 * database. It is NOT the authorization boundary: server actions are POST
 * endpoints reachable without ever loading a page, so session validation and
 * role checks live inside them. See lib/session.ts and lib/actions.ts.
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { isProtected } from "./lib/routes";

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtected(pathname)) return NextResponse.next();
  if (getSessionCookie(req)) return NextResponse.next();

  const url = new URL("/login", req.url);
  // pathname + search, not pathname alone: the landing's hero submits the
  // visitor's sentence as ?q=, and dropping it here means they sign in and
  // arrive at an empty form having already typed what they wanted.
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
