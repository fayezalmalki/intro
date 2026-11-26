import "server-only";
import { env } from "cloudflare:workers";
import type { AccountGate } from "../worker/account-gate";

/**
 * Reserves credits for a search or a request in the account's AccountGate
 * Durable Object, so two charges can never share the last credit. Idempotent
 * on `ref`. The one path app code takes to spend credits outside a send.
 */
export async function chargeThroughGate(input: { accountId: string; reason: "search" | "request"; ref: string; amount?: number }): Promise<boolean> {
  const ns = (env as unknown as { ACCOUNT_GATE: DurableObjectNamespace<AccountGate> }).ACCOUNT_GATE;
  const outcome = await ns.get(ns.idFromName(input.accountId)).charge(input);
  return Boolean(outcome.ok);
}
