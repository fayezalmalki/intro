import * as repo from "@/lib/db/repo";
import { starterById } from "@/lib/search/dictionary";
import { apiAccount } from "@/lib/search/http";
import { isMarket } from "@/lib/search/markets";

export const dynamic = "force-dynamic";

/** POST { name, market, sector?, keywords?, role?, signal? } → { id }. Free. */
export async function POST(request: Request) {
  const account = await apiAccount(request);
  if (account instanceof Response) return account;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const name = s(b.name, 80);
  const sector = s(b.sector, 80);
  if (!name || !isMarket(b.market) || (sector && !starterById(sector))) return Response.json({ error: "bad_query" }, { status: 400 });
  if (!sector && !s(b.keywords, 200)) return Response.json({ error: "bad_query" }, { status: 400 });
  const id = await repo.saveCriteria({ accountId: account.id, name, market: b.market, sector, keywords: s(b.keywords, 200), role: s(b.role, 60), signal: s(b.signal, 40) });
  if (!id) return Response.json({ error: "limit" }, { status: 409 });
  return Response.json({ id });
}
