"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { createCoresignal } from "../coresignal";
import { db } from "../db";
import { radarCompanies, radarSignals } from "../db/schema";
import { assertDevTools } from "../env";
import { requireAccountManager } from "../session";
import { isClusterSlug } from "./clusters";
import { publishIssue } from "./issues";
import { RESOLVE_COST, removeSignal, resolveSignal } from "./resolve";
import { seedCompanies, sweep } from "./sweep";
import { SEED_COMPANIES } from "./clusters";

/**
 * The account manager's four verbs.
 *
 * Approving is the only one that spends money, and it is the only one that can
 * put a name on a public page — the same act, deliberately. `requireAccountManager`
 * guards each: the page is not the boundary, the action is.
 */

function refresh() {
  revalidatePath("/am/radar");
  revalidatePath("/radar");
}

export async function approveSignal(signalId: string): Promise<void> {
  await requireAccountManager("Approving a radar signal");
  if (!process.env.CORESIGNAL_API_KEY) {
    throw new Error("CORESIGNAL_API_KEY is not set — a name cannot be resolved");
  }
  await resolveSignal(db, signalId, createCoresignal({ database: db }));
  refresh();
}

export async function dropSignal(signalId: string): Promise<void> {
  await requireAccountManager("Dropping a radar signal");
  await removeSignal(db, signalId);
  refresh();
}

export async function publishCluster(clusterSlug: string): Promise<void> {
  await requireAccountManager("Publishing a radar issue");
  if (!isClusterSlug(clusterSlug)) throw new Error(`unknown cluster ${clusterSlug}`);
  await publishIssue(db, clusterSlug);
  refresh();
}

/**
 * Runs the sweep by hand. The cron owns the schedule; this exists so the first
 * baseline can be taken without waiting a week, and so a failed run can be
 * retried by the person reading the error.
 */
export async function sweepNow(): Promise<void> {
  await requireAccountManager("Running the radar sweep");
  await seedCompanies(db, SEED_COMPANIES);
  await sweep(db);
  refresh();
}

/**
 * Fills the desk with a scripted week so the loop can be walked without a
 * vendor key.
 *
 * Development only, and enforced by `assertDevTools` in the same way the
 * account-verification shortcut is — `lib/__tests__/env.test.ts` holds that
 * these are refused whenever NODE_ENV is production. The loop it stands in for
 * is genuinely unwalkable otherwise: detection needs CORESIGNAL_API_KEY, and
 * so does approval, so without this there is no way to see a published issue
 * on a laptop.
 *
 * It writes rows the real path would write — a detected change with no name,
 * and an approved one carrying a name and dated evidence — so what the screens
 * render is the real shape, not a mock of it.
 */
export async function seedDemoWeek(): Promise<void> {
  await requireAccountManager("Seeding a demo radar week");
  assertDevTools("Seeding a demo radar week");

  await seedCompanies(db, SEED_COMPANIES);
  const [company] = await db.select().from(radarCompanies)
    .where(eq(radarCompanies.clusterSlug, "banking")).limit(1);
  if (!company) return;

  // A fresh pair per click. The unique index on (company, employee, kind)
  // means fixed ids would collide after the first week, leaving the desk with
  // nothing to approve — so pressing this twice gives two weeks, not one.
  const existing = await db.select().from(radarSignals)
    .where(eq(radarSignals.companyId, company.id));
  const base = 900_000 + existing.length * 2;

  await db.insert(radarSignals).values({
    clusterSlug: "banking", companyId: company.id, coresignalEmployeeId: base + 1, kind: "arrival",
  }).onConflictDoNothing();

  await db.insert(radarSignals).values({
    clusterSlug: "banking", companyId: company.id, coresignalEmployeeId: base + 2, kind: "arrival",
    status: "approved", personName: "نورة العتيبي", personTitle: "Head of Digital Partnerships",
    creditsSpent: RESOLVE_COST, resolvedAt: new Date().toISOString(),
    evidence: [{
      url: "https://example.sa/appointment", title: "Head of Digital Partnerships — Al Rajhi Bank",
      source: "coresignal", date: new Date().toISOString().slice(0, 10), assertedBy: "ai",
    }],
  }).onConflictDoNothing();

  refresh();
}
