import { env } from "cloudflare:workers";
import type { RequestWorkflowParams } from "../../worker/request-workflow";

interface LiveEnv {
  TREG_TOKEN?: string;
  REQUEST_WORKFLOW?: Workflow<RequestWorkflowParams>;
}

/**
 * Live sourcing needs both a treg token and the RequestWorkflow binding.
 * Without them (local dev without a token, the test pool) confirming a brief
 * writes the seeded draft instead, so every screen stays walkable offline.
 */
export function liveWorkflow(): Workflow<RequestWorkflowParams> | null {
  const e = env as unknown as LiveEnv;
  return e.TREG_TOKEN && e.REQUEST_WORKFLOW ? e.REQUEST_WORKFLOW : null;
}

/** Starts sourcing for a request; a second start for the same request is a no-op. */
export async function startSourcing(workflow: Workflow<RequestWorkflowParams>, requestId: string): Promise<void> {
  try {
    await workflow.create({ id: requestId, params: { requestId } });
  } catch (error) {
    // The instance id is the request id: "already exists" means it is running.
    const existing = await workflow.get(requestId).catch(() => null);
    if (!existing) throw error;
  }
}
