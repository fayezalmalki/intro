import vinext from "vinext/server/fetch-handler";

export { AccountGate } from "./account-gate";
export { RequestWorkflow } from "./request-workflow";

/** Hosts that redirect to the apex (see cloudflare.config.ts `domains`). */
const ALIASES = new Set(["www.intro.sa", "app.intro.sa"]);

/**
 * The Worker entry. HTTP goes to vinext (the Next.js app); Durable Object and
 * Workflow classes are re-exported here so the runtime can find them. Later
 * phases add the email, queue and scheduled handlers alongside `fetch`.
 */
export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (ALIASES.has(url.hostname)) {
      url.hostname = "intro.sa";
      return Response.redirect(url.toString(), 301);
    }
    return vinext.fetch!(request, env, ctx);
  },
  /** Daily at 06:00 UTC (09:00 Riyadh): email each user the follow-ups due today. */
  async scheduled(_controller, _env, ctx) {
    const { sendDueReminders } = await import("../lib/reminders");
    ctx.waitUntil(sendDueReminders().then((r) => console.log(`[reminders] ${r.leads} follow-ups across ${r.accounts} accounts`)));
  },
} satisfies ExportedHandler;
