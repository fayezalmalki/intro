import { eq, inArray } from "drizzle-orm";
import type { Database } from "./index";
import { db as defaultDb } from "./index";
import { scoped } from "./scoped";
import {
  accounts, auditEvents, ledger, listMembers, outreach, people, peopleLists,
  pipelineItems, pipelines, requests, sendAttempts, suppressions,
} from "./schema";
import type { Db, Pipeline, PipelineItem } from "../types";

/**
 * Loaders assemble the `Db` shape the pure functions already consume —
 * lib/gate.ts, lib/pipeline.ts, lib/sourcing.ts — from scoped queries, so
 * moving storage to Postgres does not touch a line of domain logic.
 *
 * They deliberately load only what the caller needs rather than the whole
 * database, which is what the old JSON store did.
 */
function empty(): Db {
  return {
    accounts: [], people: [], requests: [], pipelines: [], outreach: [],
    lists: [], ledger: [], suppressions: [], sendAttempts: [], audit: [],
  };
}

/** Rows arrive as separate tables; the domain type nests items under pipelines. */
function nest(rows: typeof pipelines.$inferSelect[], items: typeof pipelineItems.$inferSelect[]): Pipeline[] {
  return rows.map((p) => ({
    ...undef(p),
    items: items
      .filter((i) => i.pipelineId === p.id)
      .sort((a, b) => a.rank - b.rank)
      .map((i) => undef(i) as unknown as PipelineItem),
  }));
}

/**
 * Everything hanging off one request: its pipelines and items, the people they
 * name, outreach, send attempts, the owning account, its ledger, and the global
 * suppression list the send gate checks.
 */
export async function loadRequestContext(
  requestId: string,
  database: Database = defaultDb,
): Promise<Db> {
  const out = empty();

  const [request] = await database.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  if (!request) return out;
  out.requests = [undef(request) as Db["requests"][number]];

  const scope = scoped(database, request.accountId);

  const [account] = await database
    .select().from(accounts).where(eq(accounts.id, request.accountId)).limit(1);
  if (account) out.accounts = [undef(account) as Db["accounts"][number]];

  const pipelineRows = await scope.pipelines(requestId);
  const itemRows = pipelineRows.length
    ? await database
        .select().from(pipelineItems)
        .where(inArray(pipelineItems.pipelineId, pipelineRows.map((p) => p.id)))
    : [];
  out.pipelines = nest(pipelineRows, itemRows);

  const personIds = [...new Set(itemRows.map((i) => i.personId))];
  out.people = personIds.length
    ? (await database.select().from(people).where(inArray(people.id, personIds))).map(
        (p) => undef(p) as Db["people"][number],
      )
    : [];

  out.outreach = (await scope.outreach()).filter((o) => o.requestId === requestId);
  out.sendAttempts = (await scope.sendAttempts()).map((a) => undef(a) as Db["sendAttempts"][number]);
  out.ledger = (await scope.ledger()).map((e) => undef(e) as Db["ledger"][number]);
  out.suppressions = await database.select().from(suppressions);

  return out;
}

/** The account-manager queue: every request plus the versions behind it. */
export async function loadQueue(database: Database = defaultDb): Promise<Db> {
  const out = empty();
  out.requests = (await database.select().from(requests)).map((r) => undef(r) as Db["requests"][number]);
  const pipelineRows = await database.select().from(pipelines);
  out.pipelines = nest(pipelineRows, []);
  return out;
}

/**
 * One requester's own requests, plus the pipelines behind them so the list can
 * show where each one stands without a query per row.
 *
 * The `accountId` filter is the entire difference between this and loadQueue,
 * which deliberately reads every request because that is what an account
 * manager's queue is. Getting that filter wrong here would turn a requester's
 * own list into everybody's.
 */
export async function loadMyRequests(
  accountId: string,
  database: Database = defaultDb,
): Promise<Db> {
  const out = empty();
  const rows = await database.select().from(requests).where(eq(requests.accountId, accountId));
  out.requests = rows.map((r) => undef(r) as Db["requests"][number]);
  if (rows.length === 0) return out;

  const pipelineRows = await database
    .select().from(pipelines)
    .where(inArray(pipelines.requestId, rows.map((r) => r.id)));
  out.pipelines = nest(pipelineRows, []);
  return out;
}

/** Lists and their members, for the attach screen. */
export async function loadLists(database: Database = defaultDb): Promise<Db> {
  const out = empty();
  const lists = await database.select().from(peopleLists);
  const members = await database.select().from(listMembers);
  out.lists = lists.map((l) => ({
    id: l.id,
    name: l.name,
    desc: l.description,
    personIds: members.filter((m) => m.listId === l.id).map((m) => m.personId),
  }));
  out.people = (await database.select().from(people)).map((p) => undef(p) as Db["people"][number]);
  return out;
}

/** Merges loaders that serve one page, so a page still sees a single `Db`. */
export function merge(...parts: Db[]): Db {
  const out = empty();
  for (const p of parts) {
    for (const key of Object.keys(out) as (keyof Db)[]) {
      (out[key] as unknown[]).push(...(p[key] as unknown[]));
    }
  }
  return out;
}

/**
 * Drizzle returns `null` for an absent column; the domain types use
 * `undefined`. Converting once here keeps every consumer — and every existing
 * test — working against the shapes they already expect.
 */
type NullToUndefined<T> = {
  [K in keyof T]: null extends T[K] ? Exclude<T[K], null> | undefined : T[K];
};

function undef<T extends Record<string, unknown>>(row: T): NullToUndefined<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = v === null ? undefined : v;
  return out as NullToUndefined<T>;
}

export { auditEvents, ledger, sendAttempts };
