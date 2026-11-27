import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { dbFrom } from "../lib/db";
import { autoPublish, refundRequest, writeSourcedPipeline, type SourcedPerson } from "../lib/db/repo";
import { accounts, requests } from "../lib/db/schema";
import { runSourcing, type Step } from "../lib/sourcing/run";
import { TregProvider } from "../lib/sourcing/treg";
import { seniorityOf } from "../lib/sourcing/vocabulary";
import type { Brief } from "../lib/types";

interface WorkflowEnv {
  DB: D1Database;
  TREG_TOKEN: string;
  ANTHROPIC_API_KEY?: string;
}

export interface RequestWorkflowParams {
  requestId: string;
}

/**
 * Started when a requester confirms their brief (lib/actions.ts). Finds real
 * people with treg, drafts reason-first rows, and writes pipeline v1 as a
 * draft for the account manager to review and publish — the same review and
 * publish path as before; only where the rows come from changed.
 *
 * Instance id = request id, so confirming twice can never start two runs.
 */
export class RequestWorkflow extends WorkflowEntrypoint<WorkflowEnv, RequestWorkflowParams> {
  async run(event: WorkflowEvent<RequestWorkflowParams>, step: WorkflowStep) {
    const { requestId } = event.payload;
    const database = dbFrom(this.env.DB);

    const request = await step.do("load request", async () => {
      const [row] = await database.select().from(requests).where(eq(requests.id, requestId)).limit(1);
      if (!row?.brief) return null;
      const [owner] = await database.select({ state: accounts.state }).from(accounts).where(eq(accounts.id, row.accountId)).limit(1);
      return { accountId: row.accountId, brief: row.brief as Brief, rawText: row.rawText, sectors: row.sectors ?? [], managed: owner?.state === "managed" };
    });
    if (!request) return { skipped: "no request or brief" };

    const durable: Step = (name, fn) =>
      step.do(name, { retries: { limit: 2, delay: "5 seconds", backoff: "exponential" }, timeout: "2 minutes" },
        // Workflow step results must be serialisable; ours are plain data.
        fn as () => Promise<never>);

    const result = await runSourcing(
      { requestId, brief: request.brief, rawText: request.rawText, sectors: request.sectors },
      { provider: new TregProvider(this.env.TREG_TOKEN), anthropicKey: this.env.ANTHROPIC_API_KEY },
      durable,
    );

    const used = new Set(result.items.map((i) => i.candidateKey));
    const people: SourcedPerson[] = result.candidates
      .filter((c) => used.has(c.key))
      .map((c) => ({
        key: c.key,
        name: c.person.name,
        title: c.person.title,
        company: c.person.company || c.company.name,
        companyDomain: c.company.domain,
        industries: c.company.industry ? [c.company.industry] : [],
        seniority: seniorityOf(c.person.title),
        linkedinUrl: c.person.profileUrl,
        servedBy: c.person.servedBy,
      }));

    const pipelineId = await step.do("write pipeline", () =>
      writeSourcedPipeline({
        requestId,
        people,
        rows: result.items,
        spentMicro: result.spentMicro,
        note: result.note,
        createdBy: result.scoredBy === "claude" ? "AI · Claude" : "AI",
      }, database));

    // Found nobody: the request's credits go back (idempotent on the request).
    if (result.items.length === 0) await step.do("refund", () => refundRequest(request.accountId, requestId));

    // Self-serve: the requester sees results now. Managed: their AM reviews first.
    const published = !request.managed && pipelineId
      ? await step.do("publish", () => autoPublish(pipelineId, "AI", database))
      : null;

    // Tell them it's ready (or that nothing was found and the credits are back),
    // unless they turned these emails off. Managed requests wait for their AM.
    if (!request.managed) {
      await step.do("notify", async () => {
        const { notifyListReady } = await import("../lib/notify");
        await notifyListReady(requestId, database).catch((error) => console.error("[workflow] list-ready email failed", error));
      });
    }

    return { pipelineId, published: Boolean(published), rows: result.items.length, spentMicro: result.spentMicro, scoredBy: result.scoredBy };
  }
}
