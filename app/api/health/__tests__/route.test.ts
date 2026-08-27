import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The health route's job is to make an opaque 500 into a URL that names the
 * problem, and — since this change — to answer "is Claude actually running on
 * this deployment?" without signing in and reading Arabic prose style.
 *
 * The database is stubbed so these test the reporting, not Postgres; the
 * loaders and repo suites cover the queries.
 */
vi.mock("@/lib/db", () => ({
  db: { execute: vi.fn(async () => ({ rows: [] })) },
}));

const get = async () => {
  vi.resetModules();
  const { GET } = await import("../route");
  const res = await GET();
  return { res, body: (await res.json()) as { ok: boolean; config: Record<string, boolean> } };
};

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("DATABASE_URL", "");
  });

  it("reports the extractor as unconfigured when neither credential is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
    const { body } = await get();
    expect(body.config.intent_extractor).toBe(false);
  });

  /** lib/intent.ts accepts either, so reporting only one would lie on the other. */
  it("accepts either Anthropic credential", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
    expect((await get()).body.config.intent_extractor).toBe(true);

    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "token");
    expect((await get()).body.config.intent_extractor).toBe(true);
  });

  /**
   * The reason config is separate from checks. Google sign-in is off by
   * choice, and a health endpoint that went red for a deliberate choice would
   * train us to ignore it.
   */
  it("does not let configuration change the verdict", async () => {
    vi.stubEnv("AUTH_SECRET", "s");
    vi.stubEnv("ADMIN_EMAILS", "boss@intro.sa");
    vi.stubEnv("AUTH_GOOGLE_ID", "");
    vi.stubEnv("SMTP_PASSWORD", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");

    const withNothing = await get();
    vi.stubEnv("AUTH_GOOGLE_ID", "id");
    vi.stubEnv("SMTP_PASSWORD", "pw");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
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

  /** Without these two, sign-in cannot work and no admin can exist. */
  it("fails when AUTH_SECRET or ADMIN_EMAILS is missing", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("ADMIN_EMAILS", "   ");
    const { res, body } = await get();
    expect(body.ok).toBe(false);
    expect(res.status).toBe(503);
  });

  /** Whatever else it reports, it must never report a value. */
  it("puts no secret in the response", async () => {
    vi.stubEnv("AUTH_SECRET", "super-secret-value");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-do-not-leak");
    vi.stubEnv("SMTP_PASSWORD", "hunter2");
    vi.stubEnv("DATABASE_URL", "postgres://user:pw@host/db");
    const { body } = await get();
    const text = JSON.stringify(body);
    for (const secret of ["super-secret-value", "sk-ant-do-not-leak", "hunter2", "user:pw"]) {
      expect(text).not.toContain(secret);
    }
  });
});
