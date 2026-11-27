import * as repo from "@/lib/db/repo";
import { apiAccount } from "@/lib/search/http";

export const dynamic = "force-dynamic";

/** DELETE → removes one of the caller's own saved criteria. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await apiAccount(request);
  if (account instanceof Response) return account;
  const { id } = await params;
  await repo.deleteCriteria(account.id, id);
  return Response.json({ ok: true });
}
