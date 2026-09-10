import { eq } from "drizzle-orm";
import type { Coresignal } from "../coresignal";
import { CREDIT_COST } from "../coresignal.types.costs";
import type { Database } from "../db";
import { radarCompanies, radarSignals } from "../db/schema";
import type { Evidence } from "../types";
import { logUsage } from "../usage";

/**
 * Buying a name for one approved change.
 *
 * This is the only place in Radar that spends a credit, and it runs on an
 * account manager's decision rather than on a schedule. `employee_multi_source/collect`
 * costs 20; detection cost nothing, so the bill is a function of what was
 * judged worth publishing, not of how much the market moved.
 *
 * The row moves to `approved` in the same write that gives it a name and its
 * evidence, because the CHECK constraints will not accept it any other way.
 * That is the point of putting the gate in the database: there is no ordering
 * of these statements that leaves a named-but-unevidenced row behind.
 */

export const RESOLVE_COST = CREDIT_COST["employee_multi_source/collect"];

export interface ResolveOutcome {
  status: "resolved" | "already_resolved" | "not_found";
  creditsSpent: number;
}

export async function resolveSignal(
  db: Database,
  signalId: string,
  api: Coresignal,
): Promise<ResolveOutcome> {
  const [signal] = await db.select().from(radarSignals).where(eq(radarSignals.id, signalId));
  if (!signal) throw new Error(`no radar signal ${signalId}`);

  // Approving twice must not buy twice. The vendor client caches paid calls in
  // `apiCallLog` as well, so this is belt and braces — but the cheap check
  // belongs here, where the intent is visible.
  if (signal.personName !== null) return { status: "already_resolved", creditsSpent: 0 };

  const result = await api.collectEmployee(signal.coresignalEmployeeId);
  const record = result.data;
  const name = record?.full_name?.trim() || [record?.first_name, record?.last_name]
    .filter(Boolean).join(" ").trim();

  // No name means no publishable claim. The row stays `detected` rather than
  // becoming an approved row with a placeholder where a person should be.
  if (!record || !name) {
    return { status: "not_found", creditsSpent: result.creditsSpent };
  }

  const [company] = await db.select().from(radarCompanies)
    .where(eq(radarCompanies.id, signal.companyId));

  const evidence: Evidence[] = [{
    url: record.linkedin_url ?? "",
    title: [record.active_experience_title, record.active_experience_company_name]
      .filter(Boolean).join(" — ") || name,
    source: "coresignal",
    date: new Date().toISOString().slice(0, 10),
    assertedBy: "ai",
  }];

  await db.update(radarSignals).set({
    status: "approved",
    personName: name,
    personTitle: record.active_experience_title ?? null,
    evidence,
    creditsSpent: result.creditsSpent,
    resolvedAt: new Date().toISOString(),
  }).where(eq(radarSignals.id, signalId));

  await logUsage({
    kind: "radar_signal_resolved",
    meta: {
      signalId, company: company?.name ?? signal.companyId,
      credits: result.creditsSpent, cached: result.cached,
    },
  }, db);

  return { status: "resolved", creditsSpent: result.creditsSpent };
}

/** Drops a change from consideration. Costs nothing, and never bought a name. */
export async function removeSignal(db: Database, signalId: string): Promise<void> {
  await db.update(radarSignals).set({ status: "removed" }).where(eq(radarSignals.id, signalId));
}
