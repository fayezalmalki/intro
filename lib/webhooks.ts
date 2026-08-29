import { and, eq } from "drizzle-orm";
import type { Database } from "./db";
import { db as defaultDb } from "./db";
import { webhookEvents } from "./db/schema";

/**
 * The raw inbound-webhook log. No payment code yet — this is the piece that
 * has to exist *before* it, because idempotency cannot be added to a handler
 * afterwards without knowing which events it already ran.
 *
 * Every payment provider retries: a slow response, a deploy mid-request, a
 * network blip, and the same event arrives again. `ledger_idempotency_idx`
 * already stops a retried grant from doubling an account's credits, but it can
 * only do that for a write it recognizes — a refund, an invoice adjustment or
 * anything else with a different `ref` would go through twice. This is the
 * layer above: the provider's own event id, recorded once.
 */

export interface WebhookRecord {
  /** Whether this handler should do the work, or is looking at a retry. */
  fresh: boolean;
  id: string;
}

/**
 * Records an inbound event and says whether it is new.
 *
 * The insert is the lock: `webhook_events_provider_event_idx` makes the second
 * arrival conflict rather than insert, so the caller learns it is a retry
 * before doing anything, not after. Call this first, act only on `fresh`, and
 * call `markProcessed` when the work is done — an event received but never
 * processed stays visibly unfinished rather than silently lost.
 */
export async function recordWebhookEvent(
  provider: string,
  eventId: string,
  payload: unknown,
  database: Database = defaultDb,
): Promise<WebhookRecord> {
  const [inserted] = await database
    .insert(webhookEvents)
    .values({ provider, eventId, payload: payload ?? null })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });

  if (inserted) return { fresh: true, id: inserted.id };

  const [existing] = await database
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)))
    .limit(1);
  return { fresh: false, id: existing.id };
}

/** Marks an event finished. Separate from recording it, so a crash is visible. */
export async function markProcessed(
  id: string,
  database: Database = defaultDb,
): Promise<void> {
  await database
    .update(webhookEvents)
    .set({ processedAt: new Date().toISOString() })
    .where(eq(webhookEvents.id, id));
}
