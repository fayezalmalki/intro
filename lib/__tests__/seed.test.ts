import { beforeEach, describe, expect, it } from "vitest";
import { reset, testDb } from "../db/testing";
import { seedDemoAccounts, seedGraph } from "../db/seed";
import { accounts, authUsers, listMembers, people, peopleLists } from "../db/schema";
import { SEED_PEOPLE } from "../seed";
import type { Database } from "../db";

describe("seeding", () => {
  let db: Database;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
  });

  /**
   * The production guarantee. seedGraph runs against the real database from
   * the migrate workflow; if it created accounts, production would come up
   * with fictional people who can act on real requests.
   */
  it("seedGraph inserts no accounts", async () => {
    await seedGraph(db);
    expect(await db.select().from(people)).toHaveLength(SEED_PEOPLE.length);
    expect(await db.select().from(peopleLists)).not.toHaveLength(0);
    expect(await db.select().from(accounts)).toHaveLength(0);
    expect(await db.select().from(authUsers)).toHaveLength(0);
  });

  it("seedGraph is idempotent", async () => {
    await seedGraph(db);
    await seedGraph(db);
    expect(await db.select().from(people)).toHaveLength(SEED_PEOPLE.length);
    const members = await db.select().from(listMembers);
    expect(new Set(members.map((m) => `${m.listId}:${m.personId}`)).size).toBe(members.length);
  });

  /**
   * lib/sourcing.ts keys its sourced evidence off these ids. A generated UUID
   * would leave every drafted row with no evidence, and the evidence gate
   * would then refuse every one of them.
   */
  it("seedGraph preserves the stable person ids sourcing depends on", async () => {
    await seedGraph(db);
    const ids = (await db.select().from(people)).map((p) => p.id).sort();
    expect(ids).toEqual(SEED_PEOPLE.map((p) => p.id).sort());
    expect(ids).toContain("p-noura");
  });

  it("seedDemoAccounts creates the fictional accounts, and only on request", async () => {
    await seedGraph(db);
    expect(await db.select().from(accounts)).toHaveLength(0);

    await seedDemoAccounts(db);
    const rows = await db.select().from(accounts);
    expect(rows.map((a) => a.id).sort()).toEqual(["acc-faisal", "acc-reem"]);
    expect(rows.find((a) => a.id === "acc-reem")!.role).toBe("account_manager");
  });

  it("seedDemoAccounts is idempotent", async () => {
    await seedDemoAccounts(db);
    await seedDemoAccounts(db);
    expect(await db.select().from(accounts)).toHaveLength(2);
    expect(await db.select().from(authUsers)).toHaveLength(2);
  });
});
