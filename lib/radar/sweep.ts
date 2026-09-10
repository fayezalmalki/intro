import { and, eq } from "drizzle-orm";
import { argsHash, createCoresignal, type Coresignal } from "../coresignal";
import type { Database } from "../db";
import { radarBaselines, radarCompanies, radarRuns, radarSignals } from "../db/schema";
import { logUsage } from "../usage";
import { DECISION_TITLES, type ClusterSlug } from "./clusters";
import { diffSeats, type SkipReason } from "./detect";

/**
 * The weekly sweep: free search, free diff, zero names.
 *
 * Nothing in this file spends a credit. It resolves a company id by search,
 * asks which decision-maker seats are filled today, and compares that to last
 * week. Buying a name happens in `resolve.ts`, only for a row an account
 * manager approved — so the meter follows editorial judgement rather than
 * leading it.
 */

export interface SweepResult {
  runId: string;
  companiesChecked: number;
  signalsDetected: number;
  skips: { company: string; reason: SkipReason | "unresolved_company" }[];
}

/**
 * The employee query for a company, and the hash that pins it.
 *
 * Shaped exactly like `employeeQuery` in lib/gtm/run.ts — same field, same
 * `query_string` form — because it is the same question asked of the same
 * endpoint, and two spellings of one query would eventually drift apart.
 */
export function seatQuery(coresignalId: number): Record<string, unknown> {
  return {
    query: {
      bool: {
        must: [
          { term: { active_experience_company_id: coresignalId } },
          {
            query_string: {
              query: DECISION_TITLES.map((t) => `"${t}"`).join(" OR "),
              default_field: "active_experience_title",
            },
          },
        ],
      },
    },
  };
}

/**
 * A baseline is only comparable to another baseline that answered the same
 * question. When the title list or the query shape changes, the hash changes,
 * the old ids are abandoned, and the next run starts a fresh baseline rather
 * than reporting the difference between two different questions as news.
 */
export function seatQueryHash(coresignalId: number): string {
  return argsHash("employee_multi_source/search/es_dsl", seatQuery(coresignalId));
}

export async function sweep(db: Database, client?: Coresignal | null): Promise<SweepResult> {
  const api = client ?? (process.env.CORESIGNAL_API_KEY ? createCoresignal({ database: db }) : null);
  if (!api) throw new Error("CORESIGNAL_API_KEY is not set — the radar sweep cannot run");

  const [run] = await db.insert(radarRuns).values({ status: "running" }).returning();
  const skips: SweepResult["skips"] = [];
  let checked = 0;
  let detected = 0;

  try {
    const companies = await db.select().from(radarCompanies).where(eq(radarCompanies.active, true));

    for (const company of companies) {
      // Free: resolve the vendor id once, then remember it on the row.
      let coresignalId = company.coresignalId;
      if (coresignalId === null) {
        const found = await api.searchCompanies({ website: company.website });
        coresignalId = found.ids[0] ?? null;
        if (coresignalId === null) {
          skips.push({ company: company.name, reason: "unresolved_company" });
          continue;
        }
        await db.update(radarCompanies).set({ coresignalId })
          .where(eq(radarCompanies.id, company.id));
      }

      const queryHash = seatQueryHash(coresignalId);
      const found = await api.searchEmployeesEsDsl(seatQuery(coresignalId));
      checked += 1;

      const [stored] = await db.select().from(radarBaselines)
        .where(eq(radarBaselines.companyId, company.id));

      // A baseline that answered a different question is not a baseline.
      const previous = stored && stored.queryHash === queryHash ? stored.employeeIds : null;
      const outcome = diffSeats({ previous, current: found.ids, total: found.total });

      if (outcome.skipped) skips.push({ company: company.name, reason: outcome.skipped });

      for (const change of outcome.changes) {
        // The unique index makes a re-run idempotent; a repeat is not an error.
        const inserted = await db.insert(radarSignals).values({
          clusterSlug: company.clusterSlug as ClusterSlug,
          companyId: company.id,
          coresignalEmployeeId: change.coresignalEmployeeId,
          kind: change.kind,
        }).onConflictDoNothing().returning();
        detected += inserted.length;
      }

      if (stored) {
        await db.update(radarBaselines)
          .set({ employeeIds: outcome.baseline, queryHash, capturedAt: new Date().toISOString() })
          .where(eq(radarBaselines.companyId, company.id));
      } else {
        await db.insert(radarBaselines)
          .values({ companyId: company.id, queryHash, employeeIds: outcome.baseline });
      }
    }

    await db.update(radarRuns).set({
      status: "ok", companiesChecked: checked, signalsDetected: detected,
      skips, finishedAt: new Date().toISOString(),
    }).where(eq(radarRuns.id, run.id));

    await logUsage({
      kind: "radar_run_ok",
      meta: { checked, detected, skipped: skips.length },
    }, db);

    return { runId: run.id, companiesChecked: checked, signalsDetected: detected, skips };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(radarRuns).set({
      status: "failed", companiesChecked: checked, signalsDetected: detected,
      skips, error: message, finishedAt: new Date().toISOString(),
    }).where(eq(radarRuns.id, run.id));
    await logUsage({ kind: "radar_run_failed", meta: { error: message, checked } }, db);
    throw error;
  }
}

/** Seeds the watched universe. Idempotent, so it is safe on every deploy. */
export async function seedCompanies(
  db: Database,
  seeds: Record<string, { name: string; website: string }[]>,
): Promise<number> {
  let added = 0;
  for (const [clusterSlug, rows] of Object.entries(seeds)) {
    for (const row of rows) {
      const existing = await db.select().from(radarCompanies)
        .where(and(eq(radarCompanies.clusterSlug, clusterSlug), eq(radarCompanies.website, row.website)));
      if (existing.length) continue;
      await db.insert(radarCompanies).values({ clusterSlug, ...row }).onConflictDoNothing();
      added += 1;
    }
  }
  return added;
}
