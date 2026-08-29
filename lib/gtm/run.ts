import "server-only";
import type { Database } from "../db";
import { db as defaultDb } from "../db";
import { createCoresignal, type Coresignal } from "../coresignal";
import { logUsage } from "../usage";
import type { GtmStepId } from "../types";
import { analyzeSite, fetchSite, normalizeWebsite, SiteFetchError, type AnalyzedProfile } from "./profile";
import { proposeSegments, type SegmentFilter } from "./segments";
import { countSegment } from "./counts";
import * as repo from "./repo";

/**
 * The orchestrator, and the line it will not cross.
 *
 * Steps 1–4 run automatically because every one of them is free: reading the
 * user's site costs nothing, and `company_base/search/filter` returns
 * `x-total-results` and a page of ids at zero credits. Steps 5 and 6 — turning
 * an id into a named person with an email, and writing to that person — cost 20
 * credits each and are **not** run here. They are user-driven, priced on the
 * button, and confirmed against the amount shown. See lib/gtm/spend.ts.
 *
 * That split is the difference between this and the product it is modelled on.
 * Explee fills all nine steps before the paywall because it is spending its own
 * data budget; here the vendor balance is about 1,730 credits, which is 86
 * person collects, and a flow that auto-enriched every search result would
 * spend the lot on rows nobody looked at.
 *
 * The search endpoints return **ids, not records** — that is the whole reason
 * the shape is this way. A company name and a person's name are both purchases.
 * So the free half of the flow can honestly show *how many* and *which query*,
 * and it shows exactly that; it does not show a name it has not bought, and it
 * does not invent one to fill the card.
 */

export interface RunOptions {
  database?: Database;
  fetchImpl?: typeof fetch;
  /** Injected in tests. Null means no key is configured. */
  client?: Coresignal | null;
}

/** The client, or null when there is no key — which is a supported state. */
export function coresignalFor(accountId: string, database: Database): Coresignal | null {
  if (!process.env.CORESIGNAL_API_KEY) return null;
  return createCoresignal({ accountId, database });
}

async function step(
  runId: string,
  accountId: string,
  id: GtmStepId,
  database: Database,
  work: () => Promise<string>,
): Promise<boolean> {
  await repo.setStep(runId, accountId, id, "running", {}, database);
  try {
    const note = await work();
    await repo.setStep(runId, accountId, id, "done", { note }, database);
    return true;
  } catch (error) {
    const message =
      error instanceof SiteFetchError
        ? error.reason
        : error instanceof Error
          ? error.message
          : "خطأ غير متوقع.";
    await repo.setStep(runId, accountId, id, "failed", { error: message }, database);
    await logUsage({ kind: "gtm_step_failed", accountId, meta: { runId, step: id, error: message.slice(0, 160) } }, database);
    return false;
  }
}

/**
 * The free half of the run, start to finish.
 *
 * Each step is independently recoverable: a failed profile leaves a run the
 * user can correct by hand and re-drive, and a segment whose count could not be
 * sourced is still a segment — it simply renders its reason instead of a
 * number. Nothing here throws to the caller; the run's own step states are the
 * report.
 */
export async function runFreeSteps(
  runId: string,
  accountId: string,
  options: RunOptions = {},
): Promise<void> {
  const database = options.database ?? defaultDb;
  const client = options.client === undefined ? coresignalFor(accountId, database) : options.client;

  const [run] = [await repo.loadRun(runId, accountId, database)];
  if (!run) return;

  let profile: AnalyzedProfile | undefined;

  const profiled = await step(runId, accountId, "profile", database, async () => {
    const url = normalizeWebsite(run.run.websiteUrl);
    const site = await fetchSite(url, options.fetchImpl ?? fetch);
    profile = await analyzeSite(site);
    await repo.saveProfile(runId, accountId, url, profile, database);
    return profile.source === "claude"
      ? `${profile.name} — قرأناها بـClaude`
      : `${profile.name} — قراءة مباشرة من الصفحة، بدون تحليل`;
  });

  if (!profiled) {
    await repo.setRunStatus(runId, accountId, "failed", database);
    return;
  }

  await step(runId, accountId, "competitors", database, async () => {
    const found = profile?.competitors.length ?? 0;
    if (found === 0) {
      // Two different causes, two different messages. "We read your page with
      // a title tag" and "a model read your page and could not name anyone"
      // call for different things from the person reading this.
      throw new Error(
        profile?.source === "claude"
          ? "ما قدرنا نستنتج منافسين من محتوى الصفحة. أضفهم يدويًا من «عدّل الملف»."
          : "استنتاج المنافسين يحتاج تحليلًا بنموذج، وما فيه مفتاح Claude في هذي البيئة. أضفهم يدويًا من «عدّل الملف».",
      );
    }
    return `${found} منافس مقترح — غير مُتحقق منهم`;
  });

  const segmented = await step(runId, accountId, "segments", database, async () => {
    const drafts = await proposeSegments(profile!);
    const rows = await repo.replaceGeneratedSegments(runId, accountId, drafts, database);

    // The counts. Free, and the only numbers this product will ever show.
    let sourced = 0;
    for (let i = 0; i < rows.length; i++) {
      const count = await countSegment(drafts[i].filter, client);
      await repo.saveCount(rows[i].id, accountId, count, database);
      if (count.source === "coresignal") sourced++;

      // The ids the same free search returned. Rows, not names: a name is a
      // 10-credit purchase, and these are worth nothing until someone asks.
      if (count.ids.length) {
        await repo.saveCompanies(
          rows[i].id,
          accountId,
          count.ids.slice(0, 25).map((id) => ({ coresignalId: id, name: "", source: "search" as const })),
          database,
        );
      }
    }
    return sourced === rows.length
      ? `${rows.length} شريحة، كلها بعدد حقيقي`
      : `${rows.length} شريحة، ${sourced} منها بعدد حقيقي`;
  });

  if (!segmented) {
    await repo.setRunStatus(runId, accountId, "failed", database);
    return;
  }

  await step(runId, accountId, "companies", database, async () => {
    const bundle = await repo.loadRun(runId, accountId, database);
    const found = bundle?.companies.length ?? 0;
    if (found === 0) {
      throw new Error(
        client
          ? "البحث ما رجّع أي شركة بهذي المعايير. وسّع الشريحة وأعد المحاولة."
          : "ما فيه مفتاح Coresignal، فما نقدر نجيب شركات حقيقية.",
      );
    }
    return `${found} شركة مطابقة — الأسماء تحتاج كشف مدفوع`;
  });

  // Steps 5 and 6 are the user's to start, and they cost. Left `pending` on
  // purpose: a step that says "waiting for you" is honest, and one that says
  // "done" over an empty table is not.
  await repo.setRunStatus(runId, accountId, "ready", database);
}

/**
 * The free employee search for one company: how many decision makers, and
 * which ids.
 *
 * Costs nothing and returns no names. That is not a limitation to work around,
 * it is the boundary the whole flow is built on — `employee_multi_source/collect`
 * is the only source of a name and an email, at 20 credits each.
 *
 * The es_dsl shape follows Phase 0's verified free calls (lib/coresignal.ts:
 * "employees at a single company id = 78"). If the vendor renames a field, this
 * is the one place to correct it.
 */
export function employeeQuery(companyId: number, titleTerms: string[]): Record<string, unknown> {
  const must: unknown[] = [{ term: { active_experience_company_id: companyId } }];
  if (titleTerms.length) {
    must.push({
      query_string: {
        query: titleTerms.map((t) => `"${t}"`).join(" OR "),
        default_field: "active_experience_title",
      },
    });
  }
  return { query: { bool: { must } } };
}

/** The titles worth reaching, per segment. Kept broad — narrowing costs matches. */
export function decisionMakerTitles(filter: SegmentFilter): string[] {
  const fromKeywords = filter.keywords?.filter((k) => /head|chief|director|manager|vp|founder/i.test(k)) ?? [];
  if (fromKeywords.length) return fromKeywords;
  return ["Head of", "Director", "Chief", "VP", "Founder", "General Manager"];
}
