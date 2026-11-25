import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

/**
 * POST-only, because a GET sign-out can be triggered by any image tag or
 * prefetch on a page the user is merely reading.
 */
export async function POST(): Promise<Response> {
  const result = await getAuth().api.signOut({ headers: await headers(), asResponse: true });
  const response = new Response(null, { status: 303, headers: { location: "/login" } });
  // Carry Better Auth's cookie-clearing headers onto the redirect.
  for (const cookie of result.headers.getSetCookie()) response.headers.append("set-cookie", cookie);
  return response;
}
