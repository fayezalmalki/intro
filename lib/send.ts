import "server-only";
import { env } from "cloudflare:workers";
import type { SendOutcome } from "./db/repo";
import type { SendRequest } from "./gate";
import type { AccountGate } from "../worker/account-gate";

/**
 * The only way app code sends. Routes the send to the account's AccountGate
 * Durable Object, which runs the gate, the ledger debit and the outreach
 * transition one at a time per account.
 */
export async function sendThroughGate(input: SendRequest & { actor: string }): Promise<SendOutcome> {
  const namespace = (env as unknown as { ACCOUNT_GATE: DurableObjectNamespace<AccountGate> }).ACCOUNT_GATE;
  const stub = namespace.get(namespace.idFromName(input.accountId));
  const outcome = await stub.send(input);
  // RPC results carry a Symbol.dispose handle; React cannot serialize that to
  // the client, so hand back a plain object.
  return outcome.reason === undefined ? { ok: outcome.ok } : { ok: outcome.ok, reason: outcome.reason };
}
