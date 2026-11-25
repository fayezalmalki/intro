import { bindings, defineConfig, defineWorker, exports } from "cf/config";

const WORKER = "intro";

/**
 * Phase 1 (platform move): D1, the AccountGate Durable Object, outbound email
 * and secrets. Later phases add, in the phase that implements them:
 *   Phase 2  RequestWorkflow (exports.workflow + bindings.workflow)
 *   Phase 4  OutreachWorkflow, inbound replies (triggers.email), R2 for attach uploads
 *   Phase 5  signals queue (triggers.queue + bindings.queue), daily cron (triggers.scheduled)
 * See docs/plans/2026-11-25-intro-cloudflare-rebuild.md.
 */
export default defineConfig({
  worker: defineWorker({
    name: WORKER,
    // Custom entry: re-exports the Durable Object class and hands every HTTP
    // request to vinext.
    entrypoint: "./worker/index.ts",
    // intro.sa is the home. www and app (the Phase 1 address) are kept so old
    // links work, and worker/index.ts redirects them to the apex: Better Auth's
    // cookies are host-only, so the app must live on exactly one host.
    // Cloudflare creates the DNS records and certificates on deploy.
    domains: ["intro.sa", "www.intro.sa", "app.intro.sa"],
    workersDev: false,
    compatibilityDate: "2026-11-25",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    exports: {
      // One instance per account: serialises send + credit decisions (replaces SELECT … FOR UPDATE).
      AccountGate: exports.durableObject({ storage: "sqlite" }),
    },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ name: "intro-db" }),
      EMAIL: bindings.sendEmail(),
      ACCOUNT_GATE: bindings.durableObject({ worker: WORKER, exportName: "AccountGate" }),
      ANTHROPIC_API_KEY: bindings.secret(),
      BETTER_AUTH_SECRET: bindings.secret(),
      BETTER_AUTH_URL: bindings.secret(),
      // Comma-separated emails provisioned as admin on first sign-in (lib/session.ts).
      ADMIN_EMAILS: bindings.secret(),
      GOOGLE_CLIENT_ID: bindings.secret(),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
    },
  }),
});
