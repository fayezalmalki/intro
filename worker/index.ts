import vinext from "vinext/server/fetch-handler";

export { AccountGate } from "./account-gate";

/**
 * The Worker entry. HTTP goes to vinext (the Next.js app); Durable Object
 * classes are re-exported here so the runtime can find them. Later phases add
 * the email, queue and scheduled handlers alongside `fetch`.
 */
export default {
  fetch(request, env, ctx) {
    return vinext.fetch!(request, env, ctx);
  },
} satisfies ExportedHandler;
