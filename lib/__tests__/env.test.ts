import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * These guards are the difference between "not finished yet" and "silently
 * loses paying customers' requests in production". Worth testing.
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
  it("refuses the JSON store in production without a database", async () => {
    const env = await loadEnv({ NODE_ENV: "production", DATABASE_URL: undefined });
    expect(() => env.assertStoreUsable()).toThrow(/cannot run in production/);
  });

  it("allows the JSON store in development", async () => {
    const env = await loadEnv({ NODE_ENV: "development", DATABASE_URL: undefined });
    expect(() => env.assertStoreUsable()).not.toThrow();
  });

  it("allows production once a database is configured", async () => {
    const env = await loadEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://x/y" });
    expect(() => env.assertStoreUsable()).not.toThrow();
  });

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
});
