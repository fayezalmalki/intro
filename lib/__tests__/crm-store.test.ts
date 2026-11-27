import { beforeEach, describe, expect, it } from "vitest";
import { reset, testDb } from "../db/testing";
import * as repo from "../db/repo";
import { accounts, authUsers } from "../db/schema";
import type { Database } from "../db";

describe("CRM without sending: storage", () => {
  let db: Database;
  let accountId: string;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    const [u] = await db.insert(authUsers).values({ email: "noura@lumen.sa", name: "x" }).returning();
    const [a] = await db.insert(accounts).values({ userId: u.id, displayName: "Noura", initial: "N", email: "noura@lumen.sa", locale: "en" }).returning();
    accountId = a.id;
  });

  it("adds people by hand with their details and a log entry", async () => {
    const [id] = await repo.createManualLeads(accountId, [{ name: "Reem", company: "Qimma", email: "reem@qimma.sa", tags: ["event"], stage: "contacted", note: "Met at LEAP" }], "manual", db);
    const lead = (await repo.getLead(accountId, id, db))!;
    expect(lead).toMatchObject({ source: "manual", email: "reem@qimma.sa", emailStatus: null, tags: ["event"], stage: "contacted", note: "Met at LEAP" });
    expect(lead.person.source).toBe("import");
    const log = await repo.listActivity(accountId, id, db);
    expect(log.map((a) => a.kind).sort()).toEqual(["created", "note"]);
  });

  it("moves stages directly and logs calls, without any message", async () => {
    const [id] = await repo.createManualLeads(accountId, [{ name: "Reem", company: "Qimma" }], "import", db);
    expect(await repo.setLeadStage(accountId, id, "meeting", db)).toBe(true);
    await repo.logActivity(accountId, id, "call", "Agreed on a pilot", db);
    const lead = (await repo.getLead(accountId, id, db))!;
    expect(lead.stage).toBe("meeting");
    expect(lead.contactedAt).not.toBeNull();
    expect(lead.followUpAt).toBeNull();
    const log = await repo.listActivity(accountId, id, db);
    expect(log.find((a) => a.kind === "stage")?.body).toBe("saved→meeting");
    expect(log.find((a) => a.kind === "call")?.body).toBe("Agreed on a pilot");
  });

  it("reminds a due next step once, and again after it is rescheduled", async () => {
    const [id] = await repo.createManualLeads(accountId, [{ name: "Reem", company: "Qimma" }], "manual", db);
    await repo.updateLeadDetails(accountId, id, { nextStep: "Send the deck", nextStepAt: "2026-12-01T06:00:00.000Z" }, db);
    const now = new Date("2026-12-02T06:00:00Z");
    const due = await repo.nextStepReminders(now, db);
    expect(due[0].items).toEqual([{ id, name: "Reem", company: "Qimma", step: "Send the deck" }]);
    await repo.markNextStepReminded([id], now, db);
    expect(await repo.nextStepReminders(now, db)).toEqual([]);
    await repo.updateLeadDetails(accountId, id, { nextStepAt: "2026-12-01T06:00:00.000Z" }, db);
    expect(await repo.nextStepReminders(now, db)).toHaveLength(1);
  });

  it("never touches another account's lead", async () => {
    const [id] = await repo.createManualLeads(accountId, [{ name: "Reem", company: "Qimma" }], "manual", db);
    expect(await repo.setLeadStage("someone-else", id, "closed", db)).toBe(false);
    expect(await repo.logActivity("someone-else", id, "note", "x", db)).toBe(false);
    expect(await repo.updateLeadDetails("someone-else", id, { tags: ["x"] }, db)).toBe(false);
  });
});

describe("discarding a draft request", () => {
  it("deletes only the owner's unconfirmed request", async () => {
    const db = await testDb();
    await reset(db);
    const [u] = await db.insert(authUsers).values({ email: "a@b.sa", name: "x" }).returning();
    const [a] = await db.insert(accounts).values({ userId: u.id, displayName: "A", initial: "A", email: "a@b.sa", locale: "ar" }).returning();
    const brief: import("../types").Brief = { goalType: "sales", targetRoles: [], seniority: [], industries: [], geos: [], inclusions: [], exclusions: [], summaryAr: "", confidence: 1, extractedBy: "form" };
    const id = await repo.createRequest({ accountId: a.id, rawText: "x", brief: { ...brief }, slaHours: 24 }, db);
    expect(await repo.discardRequest(id, "someone-else", db)).toBe(false);
    expect(await repo.discardRequest(id, a.id, db)).toBe(true);
    expect(await repo.discardRequest(id, a.id, db)).toBe(false);
  });
});
