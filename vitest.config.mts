import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // PGlite boots a WASM Postgres image; the default 5s is not enough for the
    // first test in a file that touches the database.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
