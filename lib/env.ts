/** One place that decides what the running process is allowed to do. */
export const isProduction = process.env.NODE_ENV === "production";

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
