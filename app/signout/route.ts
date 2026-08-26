import { signOut } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST-only, because a GET sign-out can be triggered by any image tag or
 * prefetch on a page the user is merely reading.
 */
export async function POST(): Promise<Response> {
  // signOut throws a redirect rather than returning, so this never resolves —
  // but TypeScript cannot see that through the Auth.js signature.
  await signOut({ redirectTo: "/login" });
  return new Response(null, { status: 302, headers: { location: "/login" } });
}
