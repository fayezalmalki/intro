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
  verifyAndCredit: vi.fn(async () => { repoCalls.push("verifyAndCredit"); return { ok: true, granted: true }; }),
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

/** Which account owns which request, for the owner-only actions below. */
const requestOwner: Record<string, string> = { r1: "a1", r2: "someone-else" };

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
    requireRequestOwner: async (requestId: string, action: string) => {
      if (requestOwner[requestId] !== current.id) throw new actual.NotPermitted(action);
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


/**
 * confirmBrief and markOutreach are owner-only, and not by role.
 *
 * Reading someone else's request needed a check; writing to it needs a
 * stricter one. confirmBrief rewrites the requester's own summary, and
 * markOutreach charges the caller's credits against the request it names — so
 * an account manager passing through either would attach one account's ledger
 * rows to another account's request, which is incoherent whatever the role.
 *
 * The policy itself is tested against a real database in request-access.test.ts.
 * What matters here is that each action actually calls it, before the repository.
 */
describe("owner-only actions", () => {
  beforeEach(() => {
    repoCalls.length = 0;
    vi.resetModules();
  });

  const OWNER_ACTIONS = [
    { name: "confirmBrief", repo: "confirmBrief", extra: { summaryAr: "بركز على قادة المنتج." } },
    { name: "markOutreach", repo: "recordSend", extra: { personId: "p1", channel: "intro", body: "سلام" } },
  ] as const;

  const call = async (name: string, fields: Record<string, string>) => {
    const actions = await import("../actions");
    const fn = actions[name as keyof typeof actions] as (...a: unknown[]) => Promise<unknown>;
    // markOutreach is a useActionState action, so it takes the previous state first.
    return name === "markOutreach" ? fn(undefined, form(fields)) : fn(form(fields));
  };

  for (const { name, repo, extra } of OWNER_ACTIONS) {
    it(`${name} lets the owner through`, async () => {
      current = account("requester");
      await call(name, { requestId: "r1", ...extra });
      expect(repoCalls).toContain(repo);
    });

    it(`${name} refuses a stranger, before touching the repository`, async () => {
      current = account("requester");
      await expect(call(name, { requestId: "r2", ...extra })).rejects.toThrow(/not permitted/i);
      expect(repoCalls).toEqual([]);
    });

    it(`${name} refuses an account manager who does not own it`, async () => {
      current = account("account_manager");
      await expect(call(name, { requestId: "r2", ...extra })).rejects.toThrow(/not permitted/i);
      expect(repoCalls).toEqual([]);
    });
  }
});


/**
 * Verifying an account is admin-only, for the same reason granting a role is:
 * an account manager who could verify accounts could verify their own and
 * hand themselves the sending credits, which is the thing the account state
 * exists to withhold.
 */
describe("verifyAccount", () => {
  beforeEach(() => {
    repoCalls.length = 0;
    vi.resetModules();
  });

  for (const role of ["requester", "account_manager"] as const) {
    it(`rejects a ${role}, before touching the repository`, async () => {
      current = account(role);
      const actions = await import("../actions");
      await expect(actions.verifyAccount(form({ accountId: "a2" }))).rejects.toThrow(/not permitted/i);
      expect(repoCalls).toEqual([]);
    });
  }

  it("allows an admin", async () => {
    current = account("admin");
    const actions = await import("../actions");
    await actions.verifyAccount(form({ accountId: "a2" }));
    expect(repoCalls).toContain("verifyAndCredit");
  });

  /**
   * Deliberately permitted, unlike grantRole's self-change. Every account is
   * provisioned as an observer, the admin's included, so refusing this would
   * leave the only person who can reach the page unable to send.
   */
  it("allows an admin to verify their own account", async () => {
    current = account("admin");
    const actions = await import("../actions");
    await actions.verifyAccount(form({ accountId: current.id }));
    expect(repoCalls).toContain("verifyAndCredit");
  });

  it("ignores a submission with no account", async () => {
    current = account("admin");
    const actions = await import("../actions");
    await actions.verifyAccount(form({ accountId: "" }));
    expect(repoCalls).toEqual([]);
  });
});
