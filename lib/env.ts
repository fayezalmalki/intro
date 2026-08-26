/**
 * One place that decides what the running process is allowed to do.
 *
 * The app still keeps its state in a JSON file (`lib/store.ts`), which works
 * locally and cannot work on a serverless host: the filesystem is read-only
 * apart from a per-invocation temp dir, so writes are silently lost between
 * requests. Rather than let that fail quietly in production — a request that
 * looks accepted and then vanishes — the store refuses to start.
 *
 * Removing this guard is the last step of the Postgres port, not a workaround.
 */
export const isProduction = process.env.NODE_ENV === "production";

/** Set once the app reads and writes Postgres instead of the JSON file. */
export const hasDatabase = Boolean(process.env.DATABASE_URL);

/**
 * Dev-only affordances (granting credits, verifying an account without any
 * checks) are enabled only when explicitly asked for, and never in production.
 */
export const devToolsEnabled =
  !isProduction && process.env.INTRO_DEV_TOOLS !== "off";

export function assertStoreUsable(): void {
  if (isProduction && !hasDatabase) {
    throw new Error(
      "The JSON store cannot run in production — writes are lost on a serverless " +
        "filesystem. Set DATABASE_URL and complete the Postgres port first.",
    );
  }
}

export function assertDevTools(action: string): void {
  if (!devToolsEnabled) {
    throw new Error(`${action} is a development-only action and is disabled here.`);
  }
}
