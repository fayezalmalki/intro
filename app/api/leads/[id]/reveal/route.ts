import { env } from "cloudflare:workers";
import * as repo from "@/lib/db/repo";
import { apiAccount, apiError } from "@/lib/search/http";
import { lookupEmail } from "@/lib/search/service";
import type { AccountGate } from "@/worker/account-gate";

export const dynamic = "force-dynamic";

/**
 * POST → { email, status, charged, balance }.
 * One credit, reserved in the account's AccountGate before the lookup (so two
 * reveals can't share the last credit) and refunded when nothing usable is
 * found. Revealing someone you already revealed is free.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await apiAccount(request);
  if (account instanceof Response) return account;
  const { id } = await params;
  const lead = await repo.getLead(account.id, id);
  if (!lead) return Response.json({ error: "not_found" }, { status: 404 });
  if (lead.email && lead.emailStatus !== "not_found") {
    return Response.json({ email: lead.email, status: lead.emailStatus, charged: false, balance: await repo.creditBalance(account.id) });
  }

  const namespace = (env as unknown as { ACCOUNT_GATE: DurableObjectNamespace<AccountGate> }).ACCOUNT_GATE;
  const gate = namespace.get(namespace.idFromName(account.id));
  const outcome = await gate.reveal({ accountId: account.id, personId: lead.personId });
  // RPC results lose the union's narrowing; read it as plain data.
  const reserved = { ok: Boolean(outcome.ok), charged: Boolean((outcome as { charged?: boolean }).charged) };
  if (!reserved.ok) return Response.json({ error: "insufficient_credits" }, { status: 402 });

  try {
    const found = await lookupEmail(account.id, {
      fullName: lead.person.latin,
      domain: lead.person.companyDomain ?? undefined,
      linkedinUrl: lead.person.linkedinUrl ?? undefined,
    });
    await repo.recordReveal({ accountId: account.id, leadId: lead.id, personId: lead.personId, email: found.email, status: found.verdict });
    const usable = found.email && found.verdict !== "invalid";
    return Response.json({
      email: usable ? found.email : null,
      status: found.verdict,
      charged: reserved.charged && Boolean(usable),
      balance: await repo.creditBalance(account.id),
    });
  } catch (error) {
    // The lookup failed outright: give the credit back, then report.
    await repo.recordReveal({ accountId: account.id, leadId: lead.id, personId: lead.personId, email: null, status: "not_found" });
    return apiError(error);
  }
}
