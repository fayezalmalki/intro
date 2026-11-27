import { describe, expect, it } from "vitest";
import { reset, testDb } from "../db/testing";
import * as repo from "../db/repo";

describe("monitoring", () => {
  it("runs every query on an empty and a busy database", async () => {
    const db = await testDb();
    await reset(db);
    const empty = await repo.monitoring(db);
    expect(empty.users.total).toBe(0);
    await repo.logEmail({ kind: "otp", to: "A@x.sa", transport: "smtp", status: "sent" }, db);
    await repo.logEmail({ kind: "otp", to: "b@x.sa", transport: "binding", status: "failed", error: "E_RECIPIENT" }, db);
    await repo.recordSignup({ email: "a@x.sa" }, db);
    const m = await repo.monitoring(db);
    expect(m.emailFail24).toBe(1);
    expect(m.recentEmails.map((e) => e.to)).toContain("a@x.sa");
    expect(m.recentEmails[0].createdAt).toMatch(/^\d{4}-/);
    expect(m.funnelAll.codes).toBe(1);
  });
});
