import vinext from "vinext/server/fetch-handler";

export { AccountGate } from "./account-gate";
export { RequestWorkflow } from "./request-workflow";

/**
 * The Worker entry. HTTP goes to vinext (the Next.js app); Durable Object and
 * Workflow classes are re-exported here so the runtime can find them. Later
 * phases add the email, queue and scheduled handlers alongside `fetch`.
 */
/** Hosts that redirect to the apex (see cloudflare.config.ts `domains`). */
const ALIASES = new Set(["www.intro.sa", "app.intro.sa"]);

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (ALIASES.has(url.hostname)) {
      url.hostname = "intro.sa";
      return Response.redirect(url.toString(), 301);
    }
    return vinext.fetch!(request, env, ctx);
  },
} satisfies ExportedHandler;
