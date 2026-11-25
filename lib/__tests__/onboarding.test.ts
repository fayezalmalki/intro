import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { reset, testDb } from "../db/testing";
import * as repo from "../db/repo";
import { accounts, authUsers } from "../db/schema";
import type { Database } from "../db";

describe("onboarding and activation", () => {
  let db: Database;
  let accountId: string;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    const [user] = await db.insert(authUsers).values({ email: "noura@lumen.sa", name: "x" }).returning();
    const [account] = await db.insert(accounts).values({
      userId: user.id, displayName: "noura", initial: "N", email: "noura@lumen.sa", state: "observer",
    }).returning();
    accountId = account.id;
  });

  const row = async () => (await db.select().from(accounts).where(eq(accounts.id, accountId)))[0];

  it("starts un-onboarded, in Arabic", async () => {
    const r = await row();
    expect(r.onboardedAt).toBeNull();
    expect(r.locale).toBe("ar");
  });

  it("replaces the email-prefix name and records who they are", async () => {
    await repo.completeOnboarding({
      accountId, name: "  نورة السعود ", company: "Lumen Pay", companyWebsite: "", jobTitle: "VP Product",
      useCase: "hire", linkedinUrl: "https://linkedin.com/in/noura", locale: "en",
    }, db);
    const r = await row();
    expect(r.displayName).toBe("نورة السعود");
    expect(r.initial).toBe("ن");
    expect(r.company).toBe("Lumen Pay");
    expect(r.companyWebsite).toBeNull();
    expect(r.useCase).toBe("hire");
    expect(r.locale).toBe("en");
    expect(r.onboardedAt).not.toBeNull();
  });

  it("queues an activation request once, keeping when it was first asked", async () => {
    const first = await repo.requestActivation({ accountId, linkedinUrl: "https://linkedin.com/in/n", companyWebsite: "https://lumen.sa" }, db);
    expect(first).toEqual({ ok: true, first: true });
    const askedAt = (await row()).activationRequestedAt;
    expect(askedAt).not.toBeNull();

    const again = await repo.requestActivation({ accountId, linkedinUrl: "https://linkedin.com/in/n2", companyWebsite: "https://lumen.sa", note: "  hi " }, db);
    expect(again).toEqual({ ok: true, first: false });
    const r = await row();
    expect(r.activationRequestedAt).toBe(askedAt);
    expect(r.linkedinUrl).toBe("https://linkedin.com/in/n2");
    expect(r.activationNote).toBe("hi");
  });

  it("refuses an activation request from an account that can already send", async () => {
    await repo.verifyAndCredit({ accountId, amount: 10, ref: "admin-grant:0", actor: "admin" }, db);
    expect(await repo.requestActivation({ accountId, linkedinUrl: "x", companyWebsite: "y" }, db)).toEqual({ ok: false, first: false });
  });

  it("lists accounts with nullable columns as absent fields", async () => {
    const [listed] = await repo.listAccounts(db);
    expect(listed.company).toBeUndefined();
    expect(listed.activationRequestedAt).toBeUndefined();
    expect(listed.state).toBe("observer");
  });
});
