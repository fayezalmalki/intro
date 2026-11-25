import * as repo from "@/lib/db/repo";
import { apiAccount } from "@/lib/search/http";
import { isMarket } from "@/lib/search/markets";
import { seniorityOf } from "@/lib/sourcing/vocabulary";

export const dynamic = "force-dynamic";

/** POST { person, market } → { leadId }. Saving is free; revealing the email is not. */
export async function POST(request: Request) {
  const account = await apiAccount(request);
  if (account instanceof Response) return account;
  const body = (await request.json().catch(() => ({}))) as { person?: Record<string, string>; market?: string };
  const p = body.person ?? {};
  const name = (p.name ?? "").trim().slice(0, 120);
  const title = (p.title ?? "").trim().slice(0, 160);
  if (!name || !title) return Response.json({ error: "bad_query" }, { status: 400 });
  const linkedin = typeof p.profileUrl === "string" && /^https:\/\/(www\.)?linkedin\.com\//.test(p.profileUrl) ? p.profileUrl : undefined;
  const leadId = await repo.saveLead({
    accountId: account.id,
    market: isMarket(body.market) ? body.market : "SA",
    person: {
      name, title, seniority: seniorityOf(title),
      company: (p.company ?? "").slice(0, 160),
      companyDomain: (p.companyDomain ?? "").slice(0, 120) || undefined,
      linkedinUrl: linkedin,
      location: (p.location ?? "").slice(0, 120) || undefined,
      servedBy: (p.servedBy ?? "").slice(0, 80) || undefined,
    },
  });
  return Response.json({ leadId });
}
