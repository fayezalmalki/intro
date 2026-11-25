import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The health route's job is to make an opaque 500 into a URL that names the
 * problem, and to answer "is Claude actually running on this deployment?"
 * without signing in.
 *
 * The Worker env is stubbed so these test the reporting, not D1; the loaders
 * and repo suites cover the queries.
 */
const fakeEnv: Record<string, unknown> = {};

vi.mock("cloudflare:workers", () => ({ env: fakeEnv }));
vi.mock("@/lib/db", () => ({
  db: {
    run: vi.fn(async () => undefined),
    all: vi.fn(async () => []),
  },
}));

const get = async () => {
  vi.resetModules();
  const { GET } = await import("../route");
  const res = await GET();
  return { res, body: (await res.json()) as { ok: boolean; config: Record<string, boolean> } };
};

const set = (values: Record<string, unknown>) => {
  for (const key of Object.keys(fakeEnv)) delete fakeEnv[key];
  Object.assign(fakeEnv, values);
};

describe("GET /api/health", () => {
  beforeEach(() => set({}));

  it("reports the extractor as unconfigured without an Anthropic key", async () => {
    const { body } = await get();
    expect(body.config.intent_extractor).toBe(false);
  });

  it("reports the extractor as configured with a key", async () => {
    set({ ANTHROPIC_API_KEY: "sk-test" });
    expect((await get()).body.config.intent_extractor).toBe(true);
  });

  /**
   * The reason config is separate from checks. Google sign-in is off by
   * choice, and a health endpoint that went red for a deliberate choice would
   * train us to ignore it.
   */
  it("does not let configuration change the verdict", async () => {
    const base = { BETTER_AUTH_SECRET: "s", ADMIN_EMAILS: "boss@intro.sa", ACCOUNT_GATE: {} };
    set(base);
    const withNothing = await get();
    set({ ...base, GOOGLE_CLIENT_ID: "id", EMAIL: {}, ANTHROPIC_API_KEY: "sk-test" });
    const withEverything = await get();

    expect(withNothing.body.config).toEqual({
      intent_extractor: false, mailer: false, google_oauth: false,
    });
    expect(withEverything.body.config).toEqual({
      intent_extractor: true, mailer: true, google_oauth: true,
    });
    expect(withNothing.body.ok).toBe(withEverything.body.ok);
    expect(withNothing.res.status).toBe(withEverything.res.status);
  });

  /** Without these, sign-in cannot work, no admin can exist, and nothing can send. */
  it("fails when the auth secret, ADMIN_EMAILS or the send gate is missing", async () => {
    set({ ADMIN_EMAILS: "   " });
    const { res, body } = await get();
    expect(body.ok).toBe(false);
    expect(res.status).toBe(503);
  });

  /** Whatever else it reports, it must never report a value. */
  it("puts no secret in the response", async () => {
    set({
      BETTER_AUTH_SECRET: "super-secret-value",
      ANTHROPIC_API_KEY: "sk-ant-do-not-leak",
      GOOGLE_CLIENT_SECRET: "hunter2",
    });
    const text = JSON.stringify((await get()).body);
    expect(text).not.toContain("super-secret-value");
    expect(text).not.toContain("sk-ant-do-not-leak");
    expect(text).not.toContain("hunter2");
  });
});
