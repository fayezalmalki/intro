/** One place that decides what the running process is allowed to do. */
export const isProduction = process.env.NODE_ENV === "production";

export const hasDatabase = Boolean(process.env.DATABASE_URL);

/**
 * Dev-only affordances (granting credits, verifying an account without any
 * checks) are enabled only when explicitly asked for, and never in production.
 */
export const devToolsEnabled =
  !isProduction && process.env.INTRO_DEV_TOOLS !== "off";

export function assertDevTools(action: string): void {
  if (!devToolsEnabled) {
    throw new Error(`${action} is a development-only action and is disabled here.`);
  }
}

/**
 * Example rows for the GTM flow, when no Coresignal key is configured.
 *
 * Without a key the companies and people steps have nothing to return, and the
 * screens after them cannot be walked at all — so local development, the
 * browser flow and any review of the drafts would stop at step 4. This fills
 * those two steps with hand-written rows marked `source: "fixture"`.
 *
 * Two things keep it honest. It is off in production unconditionally, exactly
 * like the account shortcuts above. And the marking is on the row, not on the
 * flag: every screen that renders a fixture row says so, so even a build that
 * somehow enabled this cannot show example data as though it came from a
 * vendor.
 */
export const gtmFixturesEnabled =
  !isProduction && process.env.INTRO_GTM_FIXTURES !== "off";

/**
 * Outbound sending, and why it is off.
 *
 * Fayez has explicitly parked outbound infrastructure: pool 2 needs
 * `intros.intro.sa` on SES and pool 3 needs a Google OAuth grant behind a CASA
 * assessment (docs/sending-domains.md, docs/03-design-review.md §2). Neither
 * exists yet, so there is nothing that could return a provider message id — and
 * without one, nothing may be marked sent.
 *
 * The flag exists rather than the code being absent so the UI can be honest
 * about the difference between "not built" and "not switched on", and so the
 * day the domain is warm is a configuration change and not a rewrite. It
 * defaults off everywhere, including development: a send path that works on a
 * laptop and not in production is how unsolicited mail leaves the building by
 * accident.
 */
export const sendingEnabled = process.env.INTRO_SENDING_ENABLED === "on";
