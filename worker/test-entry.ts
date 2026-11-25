/**
 * Entry for the vitest Workers pool (vitest.config.mts). Exports the Durable
 * Object classes the tests bind, without vinext's page handler.
 */
export { AccountGate } from "./account-gate";

export default {
  fetch() {
    return new Response("test worker", { status: 404 });
  },
} satisfies ExportedHandler;
