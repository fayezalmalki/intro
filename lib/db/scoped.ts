import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "./index";
import {
  accounts, ledger, outreach, pipelineItems, pipelines, requests, sendAttempts,
} from "./schema";

/**
 * The replacement for row-level security.
 *
 * NextAuth JWT sessions and the stateless neon-http driver mean Postgres has no
 * per-request role, so RLS cannot enforce anything — every isolation guarantee
 * rests on this file. Feature code must never call `db.select()` directly; it
 * goes through here, and `lib/__tests__/isolation.test.ts` proves that account B
 * cannot reach account A's rows.
 *
 * Ownership of pipelines, outreach and send attempts is derived from the
 * request's account rather than trusted from the caller — passing someone
 * else's requestId returns nothing rather than their data.
 *
 * drizzle/policies/rls.sql holds the equivalent database-level policies,
 * written now and applied when the postgres-js driver takes over. See
 * docs/03-design-review.md.
 */
export function scoped(db: Database, accountId: string) {
  /** Request ids this account owns — the root of every other check. */
  async function ownedRequestIds(): Promise<string[]> {
    const rows = await db
      .select({ id: requests.id })
      .from(requests)
      .where(eq(requests.accountId, accountId));
    return rows.map((r) => r.id);
  }

  async function owns(requestId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: requests.id })
      .from(requests)
      .where(and(eq(requests.id, requestId), eq(requests.accountId, accountId)))
      .limit(1);
    return Boolean(row);
  }

  return {
    accountId,

    async account() {
      const [row] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
      return row;
    },

    async requests() {
      return db.select().from(requests).where(eq(requests.accountId, accountId));
    },

    async request(requestId: string) {
      const [row] = await db
        .select()
        .from(requests)
        .where(and(eq(requests.id, requestId), eq(requests.accountId, accountId)))
        .limit(1);
      return row;
    },

    async pipelines(requestId: string) {
      if (!(await owns(requestId))) return [];
      return db.select().from(pipelines).where(eq(pipelines.requestId, requestId));
    },

    async pipelineItems(pipelineId: string) {
      const [pipeline] = await db
        .select({ requestId: pipelines.requestId })
        .from(pipelines)
        .where(eq(pipelines.id, pipelineId))
        .limit(1);
      if (!pipeline || !(await owns(pipeline.requestId))) return [];
      return db.select().from(pipelineItems).where(eq(pipelineItems.pipelineId, pipelineId));
    },

    async outreach() {
      const ids = await ownedRequestIds();
      if (ids.length === 0) return [];
      return db.select().from(outreach).where(inArray(outreach.requestId, ids));
    },

    async sendAttempts() {
      return db.select().from(sendAttempts).where(eq(sendAttempts.accountId, accountId));
    },

    async ledger() {
      return db.select().from(ledger).where(eq(ledger.accountId, accountId));
    },

    owns,
  };
}

export type ScopedDb = ReturnType<typeof scoped>;
