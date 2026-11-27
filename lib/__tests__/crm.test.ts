import { beforeEach, describe, expect, it } from "vitest";
import { reset, testDb } from "../db/testing";
import * as repo from "../db/repo";
import { accounts, authUsers, people } from "../db/schema";
import type { Database } from "../db";
import { followUpFor, nextFollowUp } from "../followup";

const DAY = 86_400_000;

describe("follow-up schedule", () => {
  it("nudges on day 3, sends a last note on day 7, then stops", () => {
    const t0 = new Date("2026-12-01T09:00:00Z");
    expect(nextFollowUp(0, t0)).toBe(new Date(t0.getTime() + 3 * DAY).toISOString());
    expect(nextFollowUp(1, t0)).toBe(new Date(t0.getTime() + 4 * DAY).toISOString());
    expect(nextFollowUp(2, t0)).toBeNull();
  });

  it("drafts both follow-ups in the reader's language", () => {
    const me = { displayName: "Noura" } as Parameters<typeof followUpFor>[0]["me"];
    expect(followUpFor({ lang: "en", name: "Faisal Alotaibi", company: "Qimma", step: 1, me })).toMatch(/^Hi Faisal,[\s\S]*who at Qimma/);
    expect(followUpFor({ lang: "ar", name: "فيصل", company: "قمة", step: 2, me })).toMatch(/آخر رسالة/);
  });
});

describe("lead stages", () => {
  let db: Database;
  let accountId: string;
  let leadId: string;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    const [u] = await db.insert(authUsers).values({ email: "noura@lumen.sa", name: "x" }).returning();
    const [a] = await db.insert(accounts).values({ userId: u.id, displayName: "Noura", initial: "N", email: "noura@lumen.sa", locale: "en" }).returning();
    accountId = a.id;
    const [p] = await db.insert(people).values({ latin: "Faisal Alotaibi", firstAr: "فيصل", title: "Head of Claims", seniority: "head", company: "Qimma", geo: "Riyadh", email: "faisal@qimma.sa", emailVerified: true, source: "seed" }).returning();
    leadId = await repo.leadForPerson(accountId, p.id, "SA", db);
  });

  it("brings a verified address from the graph, at no cost", async () => {
    const lead = await repo.getLead(accountId, leadId, db);
    expect(lead?.email).toBe("faisal@qimma.sa");
    expect(lead?.stage).toBe("saved");
  });

  it("walks first message → follow-up 1 → last note, then stops", async () => {
    let lead = await repo.updateLeadStage(accountId, leadId, "sent", db);
    expect(lead?.stage).toBe("contacted");
    expect(lead?.followUps).toBe(0);
    expect(lead?.followUpAt).not.toBeNull();
    lead = await repo.updateLeadStage(accountId, leadId, "sent", db);
    expect(lead?.followUps).toBe(1);
    lead = await repo.updateLeadStage(accountId, leadId, "sent", db);
    expect(lead?.followUps).toBe(2);
    expect(lead?.followUpAt).toBeNull();
  });

  it("a reply stops follow-ups", async () => {
    await repo.updateLeadStage(accountId, leadId, "sent", db);
    const lead = await repo.updateLeadStage(accountId, leadId, "replied", db);
    expect(lead?.stage).toBe("replied");
    expect(lead?.followUpAt).toBeNull();
  });

  it("lists due follow-ups and reminds about each one once", async () => {
    await repo.updateLeadStage(accountId, leadId, "sent", db);
    const later = new Date(Date.now() + 4 * DAY);
    expect((await repo.dueFollowUps(accountId, new Date(), db))).toHaveLength(0);
    expect((await repo.dueFollowUps(accountId, later, db)).map((l) => l.id)).toEqual([leadId]);
    const due = await repo.followUpReminders(later, db);
    expect(due).toHaveLength(1);
    expect(due[0].leads[0]).toMatchObject({ id: leadId, name: "Faisal Alotaibi", step: 1 });
    await repo.markReminded([leadId], later, db);
    expect(await repo.followUpReminders(later, db)).toHaveLength(0);
  });

  it("refuses someone else's lead", async () => {
    expect(await repo.updateLeadStage("someone-else", leadId, "sent", db)).toBeNull();
  });
});

describe("daily reminder job", () => {
  it("emails each account its due follow-ups once", async () => {
    const db = await testDb();
    await reset(db);
    const [u] = await db.insert(authUsers).values({ email: "reem@lumen.sa", name: "x" }).returning();
    const [a] = await db.insert(accounts).values({ userId: u.id, displayName: "Reem", initial: "R", email: "reem@lumen.sa" }).returning();
    const [p] = await db.insert(people).values({ latin: "Omar Q", firstAr: "عمر", title: "COO", seniority: "cxo", company: "Gulf Union", geo: "Dammam", source: "seed" }).returning();
    const leadId = await repo.leadForPerson(a.id, p.id, "SA", db);
    await repo.updateLeadStage(a.id, leadId, "sent", db);
    const { sendDueReminders } = await import("../reminders");
    const later = new Date(Date.now() + 4 * DAY);
    expect(await sendDueReminders(later)).toEqual({ accounts: 1, leads: 1 });
    expect(await sendDueReminders(later)).toEqual({ accounts: 0, leads: 0 });
  });
});
