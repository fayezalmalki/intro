import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // PGlite boots a WASM Postgres image; the default 5s is not enough for the
    // first test in a file that touches the database.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    alias: {
      // `server-only` throws by design outside a React Server Component. The
      // modules that import it are server modules under test here, so the
      // guard has nothing to protect and only gets in the way.
      "server-only": new URL("./lib/__tests__/server-only.stub.ts", import.meta.url).pathname,
    },
  },
});
