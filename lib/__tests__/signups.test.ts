import { beforeEach, describe, expect, it } from "vitest";
import { reset, testDb } from "../db/testing";
import * as repo from "../db/repo";
import { accounts, authUsers } from "../db/schema";
import type { Database } from "../db";
import { PENDING_COOKIE, isResumable, pathForStart, pendingFromCookieHeader } from "../pending";

describe("pending search across sign-in", () => {
  it("turns a landing search into a search that runs on arrival", () => {
    const path = pathForStart(new URLSearchParams({ lang: "en", mode: "people", market: "AE", q: "  heads of claims  " }));
    const u = new URL(path, "https://intro.sa");
    expect(u.pathname).toBe("/search");
    expect(Object.fromEntries(u.searchParams)).toEqual({ lang: "en", mode: "people", market: "AE", q: "heads of claims", run: "1" });
  });

  it("falls back to safe defaults for unknown modes and markets", () => {
    const u = new URL(pathForStart(new URLSearchParams({ mode: "<script>", market: "xx1", q: "insurers" })), "https://intro.sa");
    expect(u.searchParams.get("mode")).toBe("companies");
    expect(u.searchParams.get("market")).toBe("SA");
    expect(u.searchParams.get("lang")).toBe("ar");
  });

  it("opens a first request, or home when nothing was typed", () => {
    expect(pathForStart(new URLSearchParams({ to: "new", q: "Sell payroll to retailers", lang: "en" }))).toBe("/new?lang=en&q=Sell+payroll+to+retailers");
    expect(pathForStart(new URLSearchParams({ lang: "en" }))).toBe("/home?lang=en");
  });

  it("only ever resumes app paths on this site", () => {
    expect(isResumable("/search?q=x")).toBe(true);
    expect(isResumable("/new")).toBe(true);
    expect(isResumable("//evil.example/search")).toBe(false);
    expect(isResumable("https://evil.example")).toBe(false);
    expect(isResumable("/am/team")).toBe(false);
    expect(isResumable("/searching")).toBe(false);
  });

  it("reads the pending path from a cookie header, and ignores tampered values", () => {
    const good = `a=1; ${PENDING_COOKIE}=${encodeURIComponent("/search?q=x&run=1")}; b=2`;
    expect(pendingFromCookieHeader(good)).toBe("/search?q=x&run=1");
    expect(pendingFromCookieHeader(`${PENDING_COOKIE}=${encodeURIComponent("//evil.example")}`)).toBeUndefined();
    expect(pendingFromCookieHeader(`${PENDING_COOKIE}=%E0%A4%A`)).toBeUndefined();
    expect(pendingFromCookieHeader(undefined)).toBeUndefined();
  });
});

describe("sign-up records", () => {
  let db: Database;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
  });

  it("records a code request once an hour, keeping the first pending search it learns", async () => {
    await repo.recordSignup({ email: " Noura@Lumen.SA ", lang: "en" }, db);
    await repo.recordSignup({ email: "noura@lumen.sa", pending: "/search?q=insurers&run=1" }, db);
    await repo.recordSignup({ email: "noura@lumen.sa", pending: "/new" }, db);
    const rows = await repo.listSignups(10, db);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("noura@lumen.sa");
    expect(rows[0].pending).toBe("/search?q=insurers&run=1");
    expect(rows[0].lang).toBe("en");
  });

  it("follows the address through sign-in and onboarding", async () => {
    await repo.recordSignup({ email: "noura@lumen.sa" }, db);
    const [user] = await db.insert(authUsers).values({ email: "noura@lumen.sa", name: "x" }).returning();
    const [account] = await db.insert(accounts).values({ userId: user.id, displayName: "noura", initial: "N", email: "noura@lumen.sa" }).returning();

    await repo.linkSignup("Noura@lumen.sa", account.id, db);
    let [row] = await repo.listSignups(10, db);
    expect(row.accountId).toBe(account.id);
    expect(row.verifiedAt).not.toBeNull();
    expect(row.onboardedAt).toBeNull();

    await repo.markSignupOnboarded(account.id, db);
    [row] = await repo.listSignups(10, db);
    expect(row.onboardedAt).not.toBeNull();
  });
});
