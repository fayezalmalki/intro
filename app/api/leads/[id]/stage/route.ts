import * as repo from "@/lib/db/repo";
import { apiAccount } from "@/lib/search/http";

export const dynamic = "force-dynamic";

const ACTIONS = new Set<repo.LeadAction>(["sent", "replied", "meeting", "closed", "reopen"]);

/**
 * POST { action } → the lead's new stage and next follow-up. Free: the email
 * itself goes out from the person's own mail app; this keeps the record.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await apiAccount(request);
  if (account instanceof Response) return account;
  const { id } = await params;
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  if (!ACTIONS.has(action as repo.LeadAction)) return Response.json({ error: "bad_query" }, { status: 400 });
  const lead = await repo.updateLeadStage(account.id, id, action as repo.LeadAction);
  if (!lead) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ stage: lead.stage, followUps: lead.followUps, followUpAt: lead.followUpAt, contactedAt: lead.contactedAt });
}
