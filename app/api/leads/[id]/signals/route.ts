import * as repo from "@/lib/db/repo";
import { apiAccount, apiError } from "@/lib/search/http";
import { isMarket } from "@/lib/search/markets";
import { searchNews } from "@/lib/search/service";

export const dynamic = "force-dynamic";

/** POST → { signals }: dated news about the lead's company, kept on the lead. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await apiAccount(request);
  if (account instanceof Response) return account;
  const { id } = await params;
  const lead = await repo.getLead(account.id, id);
  if (!lead) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const signals = (await searchNews(account.id, { company: lead.person.company, market: isMarket(lead.market) ? lead.market : "SA" }))
      .slice(0, 6).map(({ url, title, source, date }) => ({ url, title, source, date }));
    await repo.saveLeadSignals(lead.id, signals);
    return Response.json({ signals });
  } catch (error) {
    return apiError(error);
  }
}
