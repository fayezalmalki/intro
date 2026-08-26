import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "../types";

/**
 * The boundary that actually holds.
 *
 * middleware.ts redirects people browsing to /am. It does nothing about a
 * server action, which is a POST endpoint anyone can invoke with the action id
 * and never load a page. So each account-manager action calls
 * requireAccountManager() itself, and these prove it — per action, because a
 * check that is missing from exactly one of them is the realistic failure.
 *
 * The rejection must also happen BEFORE any repository work: each test asserts
 * the repo was never touched.
 */
const repoCalls: string[] = [];

vi.mock("../db/repo", () => ({
  setItemStatus: vi.fn(async () => { repoCalls.push("setItemStatus"); }),
  publishPipeline: vi.fn(async () => { repoCalls.push("publishPipeline"); return null; }),
  attachPipeline: vi.fn(async () => { repoCalls.push("attachPipeline"); }),
  createRequest: vi.fn(async () => { repoCalls.push("createRequest"); return "r1"; }),
  confirmBrief: vi.fn(async () => { repoCalls.push("confirmBrief"); }),
  recordSend: vi.fn(async () => { repoCalls.push("recordSend"); return { ok: true }; }),
  verifyAndGrant: vi.fn(async () => { repoCalls.push("verifyAndGrant"); }),
  setAccountRole: vi.fn(async () => { repoCalls.push("setAccountRole"); return { ok: true }; }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const account = (role: Account["role"]): Account => ({
  id: "a1", userId: "u1", role,
  displayName: role === "requester" ? "فيصل" : "ريم",
  initial: "F", email: "x@example.sa", state: "verified",
  dailyCap: 10, createdAt: "2026-08-01T00:00:00.000Z",
});

let current: Account = account("requester");

/**
 * Only the session lookup is stubbed. The policy itself — isAccountManager and
 * NotPermitted — is the real one, so these tests fail if the rule changes, not
 * merely if the plumbing does. requireAccountManager's own composition of
 * currentAccount is covered in session.test.ts.
 */
vi.mock("../session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../session")>();
  return {
    ...actual,
    currentAccount: async () => current,
    requireAccountManager: async (action: string) => {
      if (!actual.isAccountManager(current)) throw new actual.NotPermitted(action);
      return current;
    },
    requireAdmin: async (action: string) => {
      if (current.role !== "admin") throw new actual.NotPermitted(action);
      return current;
    },
  };
});

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

const AM_ACTIONS = [
  { name: "setItemStatus", fields: { pipelineId: "p1", itemId: "i1", status: "approved" } },
  { name: "publishPipeline", fields: { pipelineId: "p1" } },
  { name: "attachPipeline", fields: { requestId: "r1", source: "pasted", rows: "A\tB\tC" } },
] as const;

describe("account-manager actions", () => {
  beforeEach(() => {
    repoCalls.length = 0;
    vi.resetModules();
  });

  for (const { name, fields } of AM_ACTIONS) {
    it(`${name} rejects a requester, before touching the repository`, async () => {
      current = account("requester");
      const actions = await import("../actions");
      await expect(
        (actions[name] as (fd: FormData) => Promise<unknown>)(form(fields)),
      ).rejects.toThrow(/not permitted/i);
      expect(repoCalls).toEqual([]);
    });

    it(`${name} allows an account manager`, async () => {
      current = account("account_manager");
      const actions = await import("../actions");
      await (actions[name] as (fd: FormData) => Promise<unknown>)(form(fields));
      expect(repoCalls).toContain(name);
    });

    it(`${name} allows an admin`, async () => {
      current = account("admin");
      const actions = await import("../actions");
      await (actions[name] as (fd: FormData) => Promise<unknown>)(form(fields));
      expect(repoCalls).toContain(name);
    });
  }

  it("still lets a requester create their own request", async () => {
    current = account("requester");
    const actions = await import("../actions");
    await actions.createRequest(form({ rawText: "أدور وظيفة قيادية." }));
    expect(repoCalls).toContain("createRequest");
  });
});

/**
 * Granting a role is admin-only, not account-manager-only. An account manager
 * who could grant it could promote themselves, and the separation between the
 * two roles would mean nothing — so the account-manager case is the one that
 * matters here, and it must be refused.
 */
describe("grantRole", () => {
  beforeEach(() => {
    repoCalls.length = 0;
    vi.resetModules();
  });

  const fields = { accountId: "a2", role: "account_manager" };

  for (const role of ["requester", "account_manager"] as const) {
    it(`rejects a ${role}, before touching the repository`, async () => {
      current = account(role);
      const actions = await import("../actions");
      await expect(actions.grantRole(form(fields))).rejects.toThrow(/not permitted/i);
      expect(repoCalls).toEqual([]);
    });
  }

  it("allows an admin", async () => {
    current = account("admin");
    const actions = await import("../actions");
    await actions.grantRole(form(fields));
    expect(repoCalls).toContain("setAccountRole");
  });

  it("ignores a role that is not one of the three", async () => {
    current = account("admin");
    const actions = await import("../actions");
    await actions.grantRole(form({ accountId: "a2", role: "superuser" }));
    expect(repoCalls).toEqual([]);
  });
});
