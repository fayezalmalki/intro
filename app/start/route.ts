import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { PENDING_COOKIE, PENDING_MAX_AGE, pathForStart } from "@/lib/pending";

/**
 * Where the landing's search box and "Start free" go. Signed-out visitors
 * create an account first; what they typed is remembered (cookie + ?next=) so
 * it runs the moment they are in, even if they come back days later.
 */
export function GET(req: NextRequest) {
  const path = pathForStart(req.nextUrl.searchParams);
  const signedIn = Boolean(getSessionCookie(req));

  const target = new URL(path, req.url);
  if (!signedIn) {
    target.pathname = "/login";
    target.search = "";
    target.searchParams.set("next", `/resume?to=${encodeURIComponent(path)}`);
    target.searchParams.set("lang", req.nextUrl.searchParams.get("lang") === "en" ? "en" : "ar");
  }
  const res = NextResponse.redirect(target, 303);
  if (!signedIn) {
    res.cookies.set(PENDING_COOKIE, path, {
      httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: PENDING_MAX_AGE,
    });
  }
  return res;
}
