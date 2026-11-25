import { bindings, defineConfig, defineWorker, exports } from "cf/config";

const WORKER = "intro";

/**
 * Phase 1 (platform move): D1, the AccountGate Durable Object, outbound email
 * and secrets. Phase 2: RequestWorkflow (real sourcing through treg). Later
 * phases add, in the phase that implements them:
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
    // The app's home. Cloudflare creates the DNS record and certificate on
    // deploy. intro.sa itself stays where it is until it is switched over.
    domains: ["app.intro.sa"],
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
      // Confirmed brief → companies → people → signals → ranked draft (lib/sourcing/run.ts).
      RequestWorkflow: exports.workflow({ name: "intro-request" }),
    },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ name: "intro-db" }),
      EMAIL: bindings.sendEmail(),
      ACCOUNT_GATE: bindings.durableObject({ worker: WORKER, exportName: "AccountGate" }),
      REQUEST_WORKFLOW: bindings.workflow({ name: "intro-request", worker: WORKER, exportName: "RequestWorkflow" }),
      ANTHROPIC_API_KEY: bindings.secret(),
      // A capped treg agent token (`treg org agent-new intro-prod --cap …`). Unset → seeded fixtures.
      TREG_TOKEN: bindings.secret(),
      BETTER_AUTH_SECRET: bindings.secret(),
      BETTER_AUTH_URL: bindings.secret(),
      // Comma-separated emails provisioned as admin on first sign-in (lib/session.ts).
      ADMIN_EMAILS: bindings.secret(),
      GOOGLE_CLIENT_ID: bindings.secret(),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
    },
  }),
});
