import { env } from "cloudflare:workers";
import * as repo from "@/lib/db/repo";
import { devToolsEnabled } from "@/lib/env";
import { parseSource } from "@/lib/onboarding";
import { apiAccount } from "@/lib/search/http";
import { TregProvider } from "@/lib/sourcing/treg";

export const dynamic = "force-dynamic";

/** Reads per account: enough to fix a typo, not enough to use this as a free lookup. */
const MAX_READS = 3;

export type ReadResult =
  | { kind: "linkedin"; name: string; headline?: string; location?: string; about?: string; company?: string; linkedinUrl: string }
  | { kind: "website"; name: string; domain: string; description?: string; industry?: string; employees?: number };

/**
 * POST { source } → what we could read about the person (a LinkedIn profile)
 * or their company (a website), to prefill onboarding. Free to them; capped.
 */
export async function POST(request: Request) {
  const account = await apiAccount(request);
  if (account instanceof Response) return account;
  const body = (await request.json().catch(() => ({}))) as { source?: string };
  const source = parseSource(String(body.source ?? ""));
  if (!source) return Response.json({ error: "bad_source" }, { status: 400 });
  if ((await repo.profileReadsUsed(account.id)) >= MAX_READS) return Response.json({ error: "limit" }, { status: 429 });

  const token = (env as unknown as { TREG_TOKEN?: string }).TREG_TOKEN;
  if (!token) {
    if (!devToolsEnabled) return Response.json({ error: "unavailable" }, { status: 503 });
    // Offline development: a believable answer so the flow is walkable.
    return Response.json({ result: source.kind === "linkedin"
      ? { kind: "linkedin", name: "Noura Alshammari", headline: "Senior Product Manager · Payments", location: "Riyadh, Saudi Arabia", company: "Tamara", linkedinUrl: source.url }
      : { kind: "website", name: "Lumen Pay", domain: source.domain, description: "Claims automation for insurers in Saudi Arabia.", industry: "Insurance", employees: 40 } });
  }

  const treg = new TregProvider(token);
  const options = { maxCostUsd: 0.03, idempotencyKey: `onboarding:${account.id}:${source.kind === "linkedin" ? source.url : source.domain}` };
  try {
    await repo.recordProfileRead(account.id, source.kind === "linkedin" ? source.url : source.domain);
    if (source.kind === "linkedin") {
      const r = await treg.readProfile(source.url, options);
      if (!r.value) return Response.json({ error: "not_found" }, { status: 404 });
      return Response.json({ result: { kind: "linkedin", ...r.value } satisfies ReadResult });
    }
    const r = await treg.enrichCompany(source.domain, options);
    if (!r.value) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ result: { kind: "website", ...r.value } satisfies ReadResult });
  } catch (error) {
    console.error("[onboarding] read failed", error);
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
