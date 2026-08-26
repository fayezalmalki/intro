import { createHash } from "node:crypto";
import type { Db, Suppression } from "./types";

/**
 * Emails are stored hashed so the suppression list is not itself a usable
 * mailing list. Normalized first, so casing and whitespace cannot smuggle a
 * suppressed address back through the gate.
 */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function isSuppressed(db: Db, email: string | undefined): boolean {
  if (!email) return false;
  const h = hashEmail(email);
  return db.suppressions.some((s) => s.emailHash === h);
}

export function suppress(
  email: string,
  reason: Suppression["reason"],
  source: string,
): Suppression {
  return {
    emailHash: hashEmail(email),
    reason,
    source,
    createdAt: new Date().toISOString(),
  };
}
