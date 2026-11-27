import { env } from "cloudflare:workers";
import * as repo from "@/lib/db/repo";
import { outreachConfigured, sendOutreach } from "@/lib/mailer";
import { OUTBOUND_REASON, checkOutbound } from "@/lib/outbound";
import { optOutToken } from "@/lib/optout";
import { apiAccount } from "@/lib/search/http";

export const dynamic = "force-dynamic";

/**
 * POST { subject, body } → sends this lead's next message through intro
 * (reach.intro.sa), if every check passes. Refusals come back with reasons in
 * the user's language and are recorded; a delivery failure can pause the
 * account's sending through intro (lib/db/repo.ts recordOutbound).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await apiAccount(request);
  if (account instanceof Response) return account;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as { subject?: string; body?: string };
  const subject = String(b.subject ?? "").trim().slice(0, 200);
  const body = String(b.body ?? "").trim().slice(0, 5000);
  if (!subject || !body) return Response.json({ error: "bad_query" }, { status: 400 });

  const loaded = await repo.outboundContext(account.id, id, outreachConfigured());
  if (!loaded) return Response.json({ error: "not_found" }, { status: 404 });
  const { lead, toHash, ctx } = loaded;
  const lang = account.locale === "en" ? "en" : "ar";
  const failures = checkOutbound(ctx, body);
  if (failures.length) {
    await repo.recordOutbound({ accountId: account.id, leadId: id, toHash: toHash || "none", step: ctx.step, subject, body, status: "refused", failures });
    return Response.json({ error: "refused", failures, reasons: failures.map((f) => OUTBOUND_REASON[f][lang]) }, { status: 422 });
  }

  const secret = (env as unknown as { BETTER_AUTH_SECRET?: string }).BETTER_AUTH_SECRET ?? "";
  try {
    await sendOutreach({
      to: lead.email!, subject, body, lang,
      senderName: account.displayName, senderCompany: account.company, replyTo: account.email,
      optOutUrl: `https://intro.sa/optout?t=${optOutToken(lead.email!, secret)}`,
    });
  } catch (error) {
    const { paused } = await repo.recordOutbound({ accountId: account.id, leadId: id, toHash, step: ctx.step, subject, body, status: "failed", error: String((error as Error)?.message ?? error) });
    return Response.json({ error: "delivery_failed", paused }, { status: 502 });
  }
  await repo.recordOutbound({ accountId: account.id, leadId: id, toHash, step: ctx.step, subject, body, status: "sent" });
  const updated = await repo.updateLeadStage(account.id, id, "sent");
  return Response.json({ sent: true, stage: updated?.stage, followUps: updated?.followUps, followUpAt: updated?.followUpAt, contactedAt: updated?.contactedAt });
}
