import { bindings, defineConfig, defineWorker, exports, triggers } from "cf/config";

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
    // intro.sa is the home. www and app (the Phase 1 address) are kept so old
    // links work, and worker/index.ts redirects them to the apex: Better Auth's
    // cookies are host-only, so the app must live on exactly one host.
    // Cloudflare creates the DNS records and certificates on deploy.
    domains: ["intro.sa", "www.intro.sa", "app.intro.sa"],
    workersDev: false,
    // The daily follow-up reminder email (worker/index.ts `scheduled`), 09:00 Riyadh.
    triggers: [triggers.scheduled({ schedule: "0 6 * * *" })],
    // Persisted logs and real-time Issues, so production errors are visible.
    // Query strings are redacted: search and sign-in URLs can carry personal data.
    observability: { enabled: true, redactQueryString: true, issues: { enabled: true } },
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
      // Moyasar test key (sk_test_…). Without a usable key for the current
      // mode, top-ups go to the admins by email instead (lib/billing).
      MOYASAR_SECRET_KEY: bindings.secret(),
      // MVP.sa's live key, used only when MOYASAR_MODE is "live".
      MOYASAR_LIVE_SECRET_KEY: bindings.secret(),
      MOYASAR_MODE: bindings.secret(),
      // ImprovMX SMTP login for intro.sa (e.g. noreply@intro.sa) — transactional
      // mail to any recipient (lib/mailer.ts). Cloudflare Email Service is the fallback.
      IMPROVMX_SMTP_USER: bindings.secret(),
      IMPROVMX_SMTP_PASSWORD: bindings.secret(),
      BETTER_AUTH_SECRET: bindings.secret(),
      BETTER_AUTH_URL: bindings.secret(),
      // Comma-separated emails provisioned as admin on first sign-in (lib/session.ts).
      ADMIN_EMAILS: bindings.secret(),
      GOOGLE_CLIENT_ID: bindings.secret(),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
    },
  }),
});
