import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { reset, testDb } from "../db/testing";
import * as repo from "../db/repo";
import { accounts, auditEvents, authUsers } from "../db/schema";
import type { Database } from "../db";
import type { Role } from "../types";

/**
 * The two refusals in setAccountRole are the substance of the role screen, so
 * they run against a real Postgres transaction rather than a mock — a guard
 * that only holds against a stub is not a guard.
 */
describe("setAccountRole", () => {
  let db: Database;

  async function makeAccount(name: string, role: Role): Promise<string> {
    const [user] = await db
      .insert(authUsers).values({ email: `${name}@example.sa` }).returning();
    const [account] = await db
      .insert(accounts)
      .values({
        userId: user.id, role, displayName: name, initial: name[0].toUpperCase(),
        email: `${name}@example.sa`, state: "observer",
      })
      .returning();
    return account.id;
  }

  async function roleOf(id: string): Promise<Role> {
    const [row] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    return row.role;
  }

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
  });

  it("promotes a requester to account manager and records who did it", async () => {
    const admin = await makeAccount("root", "admin");
    const target = await makeAccount("noura", "requester");

    const result = await repo.setAccountRole(
      { actorAccountId: admin, targetAccountId: target, role: "account_manager" }, db,
    );

    expect(result).toEqual({ ok: true });
    expect(await roleOf(target)).toBe("account_manager");

    const events = await db.select().from(auditEvents).where(eq(auditEvents.entity, target));
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("role.account_manager");
    expect(events[0].actor).toBe("root");
    expect(events[0].detail).toContain("requester → account_manager");
  });

  it("refuses to demote the last administrator", async () => {
    // Nobody could reach /am afterwards, and there would be no in-app way back.
    const admin = await makeAccount("root", "admin");
    const other = await makeAccount("noura", "admin");

    // Two admins: demoting one is fine.
    expect(await repo.setAccountRole(
      { actorAccountId: admin, targetAccountId: other, role: "requester" }, db,
    )).toEqual({ ok: true });

    // One left: an account manager cannot demote them either.
    const am = await makeAccount("reem", "account_manager");
    const result = await repo.setAccountRole(
      { actorAccountId: am, targetAccountId: admin, role: "requester" }, db,
    );

    expect(result).toEqual({ ok: false, reason: "last_admin" });
    expect(await roleOf(admin)).toBe("admin");
  });

  it("refuses to let anyone change their own role", async () => {
    const admin = await makeAccount("root", "admin");
    const second = await makeAccount("noura", "admin");

    const result = await repo.setAccountRole(
      { actorAccountId: admin, targetAccountId: admin, role: "requester" }, db,
    );

    // Refused even though `second` would have kept the console reachable, so
    // this is the self rule and not the last-admin rule.
    expect(result).toEqual({ ok: false, reason: "self" });
    expect(await roleOf(admin)).toBe("admin");
    expect(await roleOf(second)).toBe("admin");
  });

  it("reports an unknown account rather than silently doing nothing", async () => {
    const admin = await makeAccount("root", "admin");
    expect(await repo.setAccountRole(
      { actorAccountId: admin, targetAccountId: "no-such-account", role: "admin" }, db,
    )).toEqual({ ok: false, reason: "unknown_account" });
  });

  it("writes no audit row when the role is already what was asked for", async () => {
    const admin = await makeAccount("root", "admin");
    const target = await makeAccount("noura", "requester");

    expect(await repo.setAccountRole(
      { actorAccountId: admin, targetAccountId: target, role: "requester" }, db,
    )).toEqual({ ok: true });

    const events = await db.select().from(auditEvents).where(eq(auditEvents.entity, target));
    expect(events).toEqual([]);
  });
});
