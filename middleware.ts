/**
 * Edge middleware. Imports authConfig, not lib/auth — the provider list pulls
 * in Node built-ins the Edge Runtime does not have.
 *
 * This redirects humans who are not signed in. It is NOT the authorization
 * boundary: server actions are POST endpoints reachable without ever loading a
 * page, so the role checks live inside the actions themselves. See
 * lib/session.ts and lib/actions.ts.
 */
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const PROTECTED = ["/requests", "/am"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (req.auth) return NextResponse.next();

  const url = new URL("/login", req.url);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
