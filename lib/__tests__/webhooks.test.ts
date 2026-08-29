import { beforeEach, describe, expect, it } from "vitest";
import { reset, testDb } from "../db/testing";
import { webhookEvents } from "../db/schema";
import { markProcessed, recordWebhookEvent } from "../webhooks";
import type { Database } from "../db";

/**
 * There is no payment code yet — this is the table that has to exist before
 * it. Idempotency cannot be bolted onto a webhook handler afterwards, because
 * by then there is no record of which events already ran.
 */
describe("webhook events", () => {
  let db: Database;
  beforeEach(async () => {
    db = await testDb();
    await reset(db);
  });

  it("records an event once and calls the retry a retry", async () => {
    const first = await recordWebhookEvent("streampay", "evt_1", { amount: 100 }, db);
    const second = await recordWebhookEvent("streampay", "evt_1", { amount: 100 }, db);

    expect(first.fresh).toBe(true);
    expect(second).toEqual({ fresh: false, id: first.id });
    expect(await db.select().from(webhookEvents)).toHaveLength(1);
  });

  /** Two providers can and will hand out the same event id. */
  it("scopes the id to its provider", async () => {
    expect((await recordWebhookEvent("streampay", "evt_1", null, db)).fresh).toBe(true);
    expect((await recordWebhookEvent("stripe", "evt_1", null, db)).fresh).toBe(true);
    expect(await db.select().from(webhookEvents)).toHaveLength(2);
  });

  it("keeps the raw payload, so a handler bug is replayable", async () => {
    await recordWebhookEvent("streampay", "evt_2", { product: "intro", amount: 100 }, db);
    const [row] = await db.select().from(webhookEvents);
    expect(row.payload).toEqual({ product: "intro", amount: 100 });
  });

  /** Received and processed are separate on purpose: a crash stays visible. */
  it("leaves an unprocessed event unmarked until the work is done", async () => {
    const { id } = await recordWebhookEvent("streampay", "evt_3", null, db);
    expect((await db.select().from(webhookEvents))[0].processedAt).toBeNull();

    await markProcessed(id, db);
    expect((await db.select().from(webhookEvents))[0].processedAt).not.toBeNull();
  });
});
