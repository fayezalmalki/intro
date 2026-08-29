import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The store guard is gone with the JSON store it protected; what remains is
 * the one that keeps the credit-granting shortcut out of a deploy.
 */
async function loadEnv(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else vi.stubEnv(k, v);
  }
  return import("../env");
}

afterEach(() => vi.unstubAllEnvs());

describe("production guards", () => {
  it("disables the credit-granting shortcut in production", async () => {
    const env = await loadEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://x/y" });
    expect(env.devToolsEnabled).toBe(false);
    expect(() => env.assertDevTools("granting credits")).toThrow(/development-only/);
  });

  it("allows the shortcut in development", async () => {
    const env = await loadEnv({ NODE_ENV: "development", INTRO_DEV_TOOLS: undefined });
    expect(env.devToolsEnabled).toBe(true);
    expect(() => env.assertDevTools("granting credits")).not.toThrow();
  });

  it("can be turned off in development too", async () => {
    const env = await loadEnv({ NODE_ENV: "development", INTRO_DEV_TOOLS: "off" });
    expect(env.devToolsEnabled).toBe(false);
  });

  /**
   * The GTM example rows exist so the flow can be walked with no Coresignal
   * key. A deploy showing hand-written companies as vendor results would be
   * exactly the fabrication the rest of this codebase is built to avoid.
   */
  it("disables the GTM example rows in production", async () => {
    const env = await loadEnv({ NODE_ENV: "production", INTRO_GTM_FIXTURES: undefined });
    expect(env.gtmFixturesEnabled).toBe(false);
  });

  it("keeps them available in development, and lets them be turned off", async () => {
    expect(
      (await loadEnv({ NODE_ENV: "development", INTRO_GTM_FIXTURES: undefined }))
        .gtmFixturesEnabled,
    ).toBe(true);
    expect(
      (await loadEnv({ NODE_ENV: "development", INTRO_GTM_FIXTURES: "off" })).gtmFixturesEnabled,
    ).toBe(false);
  });
});
