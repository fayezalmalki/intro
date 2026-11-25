import { apiAccount, apiError } from "@/lib/search/http";
import { isMarket } from "@/lib/search/markets";
import { findPerson, searchCompanies, searchNews, searchPeople } from "@/lib/search/service";

export const dynamic = "force-dynamic";

/**
 * POST { kind, market, ...fields } → { results }.
 *   companies: sector | keywords | name
 *   people:    companyDomain + title | describe (+ keywords)
 *   person:    fullName (+ company)
 *   news:      company | topic
 */
export async function POST(request: Request) {
  const account = await apiAccount(request);
  if (account instanceof Response) return account;
  const body = (await request.json().catch(() => ({}))) as Record<string, string>;
  const market = isMarket(body.market) ? body.market : "SA";
  try {
    switch (body.kind) {
      case "companies":
        return Response.json({ results: await searchCompanies(account.id, { sector: body.sector, keywords: body.keywords, name: body.name, market }) });
      case "people":
        return Response.json({ results: await searchPeople(account.id, { companyDomain: body.companyDomain, title: body.title, keywords: body.keywords, describe: body.describe, market }) });
      case "person":
        return Response.json({ results: await findPerson(account.id, { fullName: body.fullName, company: body.company, market }) });
      case "news":
        return Response.json({ results: await searchNews(account.id, { company: body.company, topic: body.topic, market }) });
      default:
        return Response.json({ error: "bad_query" }, { status: 400 });
    }
  } catch (error) {
    return apiError(error);
  }
}
