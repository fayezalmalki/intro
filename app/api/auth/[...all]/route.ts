import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

/**
 * Better Auth's endpoints: email OTP send/verify, Google OAuth, session,
 * sign-out. The instance is resolved per request because the D1 binding and
 * secrets come from the Worker env.
 */
export async function GET(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).POST(request);
}
