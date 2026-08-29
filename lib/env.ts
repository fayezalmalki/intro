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
