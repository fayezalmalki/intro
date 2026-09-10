import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { radarSubscribers } from "../db/schema";
import { logUsage } from "../usage";
import { isClusterSlug } from "./clusters";

/**
 * The subscriber list, and the single rule that governs it: an address reaches
 * `confirmed` only by clicking a link sent to that address. There is no admin
 * import, no CSV path, no "add them, they'll want it". The database refuses a
 * confirmed row without a confirmation date, so the rule survives a future
 * code path that forgets it.
 *
 * This is not only manners. Radar is bulk mail; docs/sending-domains.md is
 * explicit that a complaint on bulk must never be able to reach the domain
 * carrying sign-in codes, and the cheapest way to earn no complaints is to
 * only ever mail people who asked twice.
 */

export type SubscribeOutcome =
  /** A fresh pending row; send the confirmation mail with `token`. */
  | { status: "pending"; token: string }
  /** Already confirmed. Say so, and do not re-send anything. */
  | { status: "already_confirmed" };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function newToken(): string {
  return randomBytes(24).toString("hex");
}

export async function subscribe(
  db: Database,
  rawEmail: string,
  clusters: string[],
  lang: "ar" | "en" = "ar",
): Promise<SubscribeOutcome> {
  const email = normalizeEmail(rawEmail);
  const wanted = clusters.filter(isClusterSlug);
  const [existing] = await db.select().from(radarSubscribers)
    .where(eq(radarSubscribers.email, email));

  // Re-subscribing while already confirmed must not reset anyone to pending,
  // and must not send a second confirmation to an address that never asked for
  // one — that is what a subscribe form turns into when someone types a
  // colleague's address.
  if (existing?.status === "confirmed") {
    if (wanted.length) {
      await db.update(radarSubscribers).set({ clusters: wanted })
        .where(eq(radarSubscribers.id, existing.id));
    }
    return { status: "already_confirmed" };
  }

  const token = newToken();
  if (existing) {
    await db.update(radarSubscribers)
      .set({ token, clusters: wanted, lang, status: "pending", unsubscribedAt: null })
      .where(eq(radarSubscribers.id, existing.id));
  } else {
    await db.insert(radarSubscribers).values({ email, token, clusters: wanted, lang });
  }

  await logUsage({ kind: "radar_subscribe", email, meta: { confirmed: false, clusters: wanted } }, db);
  return { status: "pending", token };
}

/** The only route to `confirmed`. An unknown token is not an error to explain. */
export async function confirm(db: Database, token: string): Promise<boolean> {
  const [row] = await db.select().from(radarSubscribers)
    .where(eq(radarSubscribers.token, token));
  if (!row || row.status === "unsubscribed") return false;
  if (row.status === "confirmed") return true;

  await db.update(radarSubscribers)
    .set({ status: "confirmed", confirmedAt: new Date().toISOString() })
    .where(eq(radarSubscribers.id, row.id));
  await logUsage({ kind: "radar_subscribe", email: row.email, meta: { confirmed: true } }, db);
  return true;
}

/**
 * One click, no sign-in, no "tell us why" — the token in the footer is enough.
 * Unsubscribing must be as easy as subscribing, and a hostile flow here costs
 * a complaint, which costs the sending domain.
 */
export async function unsubscribe(db: Database, token: string): Promise<boolean> {
  const [row] = await db.select().from(radarSubscribers)
    .where(eq(radarSubscribers.token, token));
  if (!row) return false;
  await db.update(radarSubscribers)
    .set({ status: "unsubscribed", unsubscribedAt: new Date().toISOString() })
    .where(eq(radarSubscribers.id, row.id));
  return true;
}

/** Who a cluster's issue actually goes to: confirmed, and asking for it. */
export async function recipientsFor(db: Database, clusterSlug: string) {
  const rows = await db.select().from(radarSubscribers)
    .where(eq(radarSubscribers.status, "confirmed"));
  return rows.filter((r) => r.clusters.length === 0 || r.clusters.includes(clusterSlug));
}
