import { and, desc, gte, sql } from "drizzle-orm";
import type { Database } from "./db";
import { db as defaultDb } from "./db";
import { usageEvents } from "./db/schema";
import type { UsageKind } from "./types";

/**
 * Product instrumentation: one row per moment worth counting, read by /am/ops.
 *
 * Ported in spirit from careers.sa `convex/usage.ts`, including the rule that
 * matters most: **logging never throws**. Instrumentation that can fail the
 * thing it measures turns a metrics outage into a login outage, and the one
 * event we most want — `otp_send_failed` — is written on a path that is already
 * broken. Every writer here swallows its own errors and warns instead.
 *
 * Deliberately not `auditEvents`: that answers "who changed what" and is
 * written inside the transaction that made the change. This answers "how is the
 * funnel doing", is best-effort, and is outside the transaction on purpose.
 */

export interface UsageEvent {
  kind: UsageKind;
  accountId?: string;
  email?: string;
  meta?: Record<string, unknown>;
}

/** Anything bigger than this is a payload, not a measurement. */
const MAX_META_CHARS = 500;

function trimMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const json = JSON.stringify(meta);
  return json.length <= MAX_META_CHARS ? meta : { truncated: json.slice(0, MAX_META_CHARS) };
}

/**
 * Records an event. Never throws, and never awaits anything the caller needs.
 *
 * The `accountId` is only recorded when the caller has one — most OTP events
 * happen before an account exists, which is exactly when we want them.
 */
export async function logUsage(
  event: UsageEvent,
  database: Database = defaultDb,
): Promise<void> {
  try {
    await database.insert(usageEvents).values({
      kind: event.kind,
      accountId: event.accountId,
      email: event.email?.toLowerCase(),
      meta: trimMeta(event.meta),
    });
  } catch (error) {
    console.warn("[usage] log failed", error);
  }
}

export type UsageRow = typeof usageEvents.$inferSelect;

/** The most recent events, newest first — the raw feed on /am/ops. */
export async function recentUsage(
  limit = 60,
  database: Database = defaultDb,
): Promise<UsageRow[]> {
  return database.select().from(usageEvents).orderBy(desc(usageEvents.at)).limit(limit);
}

/**
 * Counts per kind since `since`, as a map.
 *
 * Grouped in the database rather than counted in the page: the events table is
 * the one table here that grows without bound, and an ops page that loads every
 * row to count them gets slower exactly as the product gets busier.
 */
export async function usageCounts(
  since: Date,
  database: Database = defaultDb,
): Promise<Map<UsageKind, number>> {
  const rows = await database
    .select({ kind: usageEvents.kind, count: sql<number>`count(*)::int` })
    .from(usageEvents)
    .where(gte(usageEvents.at, since.toISOString()))
    .groupBy(usageEvents.kind);
  return new Map(rows.map((r) => [r.kind, Number(r.count)]));
}

/**
 * How OTP delivery is going: the failure classes seen since `since`.
 *
 * A count of failures alone does not tell you what to do about it — `auth`
 * means the credential is wrong and no amount of waiting fixes it, `timeout`
 * means it might already be over. The class is read out of `meta`.
 */
export async function otpFailureClasses(
  since: Date,
  database: Database = defaultDb,
): Promise<Map<string, number>> {
  const rows = await database
    .select({
      failureClass: sql<string>`coalesce(${usageEvents.meta} ->> 'class', 'other')`,
      count: sql<number>`count(*)::int`,
    })
    .from(usageEvents)
    .where(and(sql`${usageEvents.kind} = 'otp_send_failed'`, gte(usageEvents.at, since.toISOString())))
    .groupBy(sql`coalesce(${usageEvents.meta} ->> 'class', 'other')`);
  return new Map(rows.map((r) => [r.failureClass, Number(r.count)]));
}
