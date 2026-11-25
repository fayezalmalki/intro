import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

/**
 * Tests run inside workerd (the Workers runtime) through Miniflare, with a real
 * local D1 and the real AccountGate Durable Object — the same engine as
 * production, not a stand-in.
 *
 * The runner uses worker/test-entry.ts rather than the app's worker/index.ts:
 * the app entry imports vinext's page handler, which only exists inside the
 * Vite app build. The test entry exports just the Durable Object classes.
 *
 * Migrations are read here (in Node) and applied in lib/__tests__/setup.ts.
 */
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "drizzle"));
  return {
    plugins: [
      cloudflareTest({
        config: false,
        main: "./worker/test-entry.ts",
        miniflare: {
          compatibilityDate: "2026-11-25",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: ["DB"],
          durableObjects: { ACCOUNT_GATE: "AccountGate" },
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    resolve: {
      alias: {
        "@": import.meta.dirname,
        // `server-only` throws by design outside a React Server Component. The
        // modules that import it are server modules under test here, so the
        // guard has nothing to protect and only gets in the way.
        "server-only": path.join(import.meta.dirname, "lib/__tests__/server-only.stub.ts"),
      },
    },
    test: {
      setupFiles: ["./lib/__tests__/setup.ts"],
      include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    },
  };
});
