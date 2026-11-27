import * as repo from "@/lib/db/repo";
import { apiAccount } from "@/lib/search/http";

export const dynamic = "force-dynamic";

/** "Download my data": everything we hold about this account, as JSON (PDPL). */
export async function GET(request: Request) {
  const account = await apiAccount(request);
  if (account instanceof Response) return account;
  const data = await repo.exportAccountData(account.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="intro-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
