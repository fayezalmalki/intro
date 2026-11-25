import { DurableObject } from "cloudflare:workers";
import { dbFrom } from "../lib/db";
import { recordSend, reserveReveal, type SendOutcome } from "../lib/db/repo";
import type { SendRequest } from "../lib/gate";

interface GateEnv {
  DB: D1Database;
}

/**
 * One instance per account (`idFromName(accountId)`).
 *
 * A Durable Object processes one request at a time while it awaits only its
 * own storage — but `recordSend` awaits D1, which opens the input gate and
 * would let a second send interleave. `blockConcurrencyWhile` keeps the gate
 * shut for the whole read-decide-write, so two sends from one account are
 * strictly sequential and the second always sees the first one's debit.
 *
 * This replaces the Postgres `SELECT … FOR UPDATE` on the account row.
 */
export class AccountGate extends DurableObject<GateEnv> {
  async send(input: SendRequest & { actor: string }): Promise<SendOutcome> {
    let outcome: SendOutcome = { ok: false, reason: "not processed" };
    await this.ctx.blockConcurrencyWhile(async () => {
      outcome = await recordSend(input, dbFrom(this.env.DB));
    });
    return outcome;
  }

  /** Reserves one credit for an email reveal, serialised like a send. */
  async reveal(input: { accountId: string; personId: string }) {
    let outcome: Awaited<ReturnType<typeof reserveReveal>> = { ok: false, reason: "insufficient_credits" };
    await this.ctx.blockConcurrencyWhile(async () => {
      outcome = await reserveReveal(input, dbFrom(this.env.DB));
    });
    return outcome;
  }
}
