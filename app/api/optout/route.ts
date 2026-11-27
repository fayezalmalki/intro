import { env } from "cloudflare:workers";
import * as repo from "@/lib/db/repo";
import { readOptOutToken } from "@/lib/optout";

export const dynamic = "force-dynamic";

/**
 * One-click opt-out (RFC 8058): mail clients POST here from the
 * List-Unsubscribe header; the opt-out page's button posts here too.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const token = url.searchParams.get("t") ?? String(form?.get("t") ?? "");
  const email = readOptOutToken(token, (env as unknown as { BETTER_AUTH_SECRET?: string }).BETTER_AUTH_SECRET ?? "");
  if (!email) return Response.json({ error: "bad_token" }, { status: 400 });
  await repo.suppressEmail(email, "unsubscribed", "optout-link");
  if (form?.get("from") === "page") return Response.redirect(new URL(`/optout?t=${encodeURIComponent(token)}&done=1`, url), 303);
  return Response.json({ ok: true });
}
