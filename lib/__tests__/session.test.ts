import { beforeEach, describe, expect, it, vi } from "vitest";
import { reset, testDb } from "../db/testing";
import { accounts, authUsers } from "../db/schema";
import type { Database } from "../db";
import type { Account } from "../types";

/**
 * Authorization tests.
 *
 * The route guard in middleware.ts redirects people who are browsing. It is
 * NOT the boundary: a server action is a POST endpoint anyone can invoke
 * without ever loading a page. These test the boundary that actually holds —
 * requireAccountManager(), called inside each action.
 */
async function load(adminEmails = "") {
  vi.resetModules();
  vi.stubEnv("ADMIN_EMAILS", adminEmails);
  return import("../session");
}

describe("account provisioning", () => {
  let db: Database;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    vi.unstubAllEnvs();
  });

  const newUser = async (email: string) => {
    const [user] = await db.insert(authUsers).values({ email }).returning();
    return user.id;
  };

  it("creates an observer on first sign-in", async () => {
    const { accountForUser } = await load();
    const userId = await newUser("noor@example.sa");

    const account = await accountForUser(userId, "noor@example.sa", db);
    expect(account.state).toBe("observer");
    expect(account.role).toBe("requester");
    expect(account.displayName).toBe("noor");
  });

  it("returns the same account on a second visit rather than a duplicate", async () => {
    const { accountForUser } = await load();
    const userId = await newUser("noor@example.sa");

    const first = await accountForUser(userId, "noor@example.sa", db);
    const second = await accountForUser(userId, "noor@example.sa", db);

    expect(second.id).toBe(first.id);
    expect(await db.select().from(accounts)).toHaveLength(1);
  });

  it("provisions an admin when the email is in ADMIN_EMAILS", async () => {
    const { accountForUser } = await load("boss@intro.sa, other@intro.sa");
    const userId = await newUser("boss@intro.sa");

    const account = await accountForUser(userId, "boss@intro.sa", db);
    expect(account.role).toBe("admin");
  });

  it("matches ADMIN_EMAILS case-insensitively", async () => {
    const { accountForUser } = await load("Boss@Intro.SA");
    const userId = await newUser("boss@intro.sa");
    expect((await accountForUser(userId, "boss@intro.sa", db)).role).toBe("admin");
  });

  /** A first visit can fire several requests at once; only one row may win. */
  it("produces one account when concurrent first requests race", async () => {
    const { accountForUser } = await load();
    const userId = await newUser("race@example.sa");

    const results = await Promise.all([
      accountForUser(userId, "race@example.sa", db),
      accountForUser(userId, "race@example.sa", db),
      accountForUser(userId, "race@example.sa", db),
    ]);

    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await db.select().from(accounts)).toHaveLength(1);
  });
});

describe("requireAccountManager", () => {
  let db: Database;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    vi.unstubAllEnvs();
  });

  const seedAccount = async (email: string, role: Account["role"]) => {
    const [user] = await db.insert(authUsers).values({ email }).returning();
    const [account] = await db
      .insert(accounts)
      .values({
        userId: user.id, role, displayName: email.split("@")[0],
        initial: email[0].toUpperCase(), email, state: "verified",
      })
      .returning();
    return account;
  };

  it("accepts an account manager", async () => {
    const { isAccountManager } = await load();
    const am = await seedAccount("reem@intro.sa", "account_manager");
    expect(isAccountManager({ ...am } as Account)).toBe(true);
  });

  it("accepts an admin", async () => {
    const { isAccountManager } = await load();
    const admin = await seedAccount("boss@intro.sa", "admin");
    expect(isAccountManager({ ...admin } as Account)).toBe(true);
  });

  it("rejects a requester", async () => {
    const { isAccountManager } = await load();
    const requester = await seedAccount("faisal@example.sa", "requester");
    expect(isAccountManager({ ...requester } as Account)).toBe(false);
  });

  it("rejects a requester even when the account is verified and funded", async () => {
    // Being trusted to send is a different question from being allowed to
    // approve what other people receive.
    const { isAccountManager } = await load();
    const requester = await seedAccount("rich@example.sa", "requester");
    expect(isAccountManager({ ...requester, state: "managed" } as Account)).toBe(false);
  });
});
