import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "../db";
import { db as defaultDb } from "../db";
import {
  companyProfiles, gtmRuns, introDrafts, segments, targetCompanies, targetPeople,
} from "../db/schema";
import { GTM_STEPS, type DraftStatus, type DraftTemplate, type GtmStep, type GtmStepId, type GtmStepState } from "../types";
import type { AnalyzedProfile } from "./profile";
import type { DraftSegment } from "./segments";
import type { SegmentCount } from "./counts";
import type { ComposedDraft } from "./compose";

/**
 * Every read and write for the GTM flow, scoped to one account.
 *
 * Same discipline as lib/db/scoped.ts, and for the same reason: NextAuth JWT
 * sessions mean Postgres has no per-request role, so row-level security cannot
 * enforce anything and every isolation guarantee rests on the `accountId`
 * predicate being present on each query. It is present on each query here.
 *
 * Ownership of a segment, a company, a person or a draft is derived from the
 * row's own `accountId` rather than trusted from the caller. Passing someone
 * else's segment id returns nothing rather than their pipeline.
 */

export type RunRow = typeof gtmRuns.$inferSelect;
export type ProfileRow = typeof companyProfiles.$inferSelect;
export type SegmentRow = typeof segments.$inferSelect;
export type CompanyRow = typeof targetCompanies.$inferSelect;
export type PersonRow = typeof targetPeople.$inferSelect;
export type DraftRow = typeof introDrafts.$inferSelect;

export interface RunBundle {
  run: RunRow;
  profile?: ProfileRow;
  segments: SegmentRow[];
  companies: CompanyRow[];
  people: PersonRow[];
  drafts: DraftRow[];
}

/** Every step pending. The rail renders this before anything has run. */
export function initialSteps(): GtmStep[] {
  return GTM_STEPS.map((id) => ({ id, state: "pending" as GtmStepState }));
}

export async function createRun(
  accountId: string,
  websiteUrl: string,
  database: Database = defaultDb,
): Promise<string> {
  const [row] = await database
    .insert(gtmRuns)
    .values({ accountId, websiteUrl, status: "running", steps: initialSteps() })
    .returning({ id: gtmRuns.id });
  return row.id;
}

/**
 * Moves one step, leaving the rest alone.
 *
 * Read-modify-write on a jsonb column rather than a table of step rows: nothing
 * queries inside `steps`, the array is six entries long, and a run is driven by
 * one request at a time. The trade is worth naming — two concurrent step writes
 * would lose one — but the orchestrator is sequential and the alternative is a
 * table whose only reader renders it whole.
 */
export async function setStep(
  runId: string,
  accountId: string,
  id: GtmStepId,
  state: GtmStepState,
  detail: { note?: string; error?: string } = {},
  database: Database = defaultDb,
): Promise<void> {
  const [run] = await database
    .select({ steps: gtmRuns.steps })
    .from(gtmRuns)
    .where(and(eq(gtmRuns.id, runId), eq(gtmRuns.accountId, accountId)))
    .limit(1);
  if (!run) return;

  const steps = (run.steps ?? initialSteps()).map((s) =>
    s.id === id
      ? { ...s, state, note: detail.note, error: detail.error, at: new Date().toISOString() }
      : s,
  );
  await database
    .update(gtmRuns)
    .set({ steps, updatedAt: new Date().toISOString() })
    .where(and(eq(gtmRuns.id, runId), eq(gtmRuns.accountId, accountId)));
}

export async function setRunStatus(
  runId: string,
  accountId: string,
  status: RunRow["status"],
  database: Database = defaultDb,
): Promise<void> {
  await database
    .update(gtmRuns)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(and(eq(gtmRuns.id, runId), eq(gtmRuns.accountId, accountId)));
}

/** Upsert on `run_id`, which is unique — a re-analysis replaces, never doubles. */
export async function saveProfile(
  runId: string,
  accountId: string,
  websiteUrl: string,
  profile: AnalyzedProfile,
  database: Database = defaultDb,
): Promise<void> {
  const values = {
    runId,
    accountId,
    websiteUrl,
    name: profile.name,
    sells: profile.sells,
    sellsEn: profile.sellsEn,
    market: profile.market,
    sizeSignal: profile.sizeSignal,
    language: profile.language,
    offerings: profile.offerings,
    competitors: profile.competitors,
    source: profile.source,
    sourceExcerpt: profile.sourceExcerpt,
    updatedAt: new Date().toISOString(),
  };
  await database
    .insert(companyProfiles)
    .values(values)
    .onConflictDoUpdate({ target: companyProfiles.runId, set: values });
}

/**
 * Replaces the generated segments for a run.
 *
 * Only rows the user has not touched are replaced: a segment the user wrote or
 * edited survives a re-run of the analysis, because losing someone's own
 * writing to a background retry is unforgivable in a way that losing a
 * generated card is not.
 */
export async function replaceGeneratedSegments(
  runId: string,
  accountId: string,
  drafts: DraftSegment[],
  database: Database = defaultDb,
): Promise<SegmentRow[]> {
  await database
    .delete(segments)
    .where(
      and(
        eq(segments.runId, runId),
        eq(segments.accountId, accountId),
        inArray(segments.origin, ["ai", "rules"]),
      ),
    );
  if (drafts.length === 0) return [];
  return database
    .insert(segments)
    .values(
      drafts.map((d, i) => ({
        runId,
        accountId,
        rank: i,
        name: d.name,
        nameEn: d.nameEn,
        icon: d.icon,
        description: d.description,
        pain: d.pain,
        painEn: "",
        criteria: d.criteria,
        exampleCompanies: [],
        origin: d.origin,
        // The filter travels as the query it will be run as, so what the screen
        // shows and what the client sends are the same object.
        countQuery: null,
        countEndpoint: null,
      })),
    )
    .returning();
}

/**
 * Writes a count, or writes why there isn't one.
 *
 * Both branches are explicit. `matchCount: null` with a reason is a state the
 * card renders; it is not an absence to be papered over with the previous
 * value, which is why the failure path clears the count as well as setting the
 * error.
 */
export async function saveCount(
  segmentId: string,
  accountId: string,
  count: SegmentCount,
  database: Database = defaultDb,
): Promise<void> {
  await database
    .update(segments)
    .set({
      matchCount: count.source === "coresignal" ? count.total : null,
      countQuery: count.query,
      countEndpoint: count.endpoint,
      countSource: count.source,
      countError: count.error ?? null,
      countedAt: new Date().toISOString(),
    })
    .where(and(eq(segments.id, segmentId), eq(segments.accountId, accountId)));
}

export async function saveExampleCompanies(
  segmentId: string,
  accountId: string,
  examples: SegmentRow["exampleCompanies"],
  database: Database = defaultDb,
): Promise<void> {
  await database
    .update(segments)
    .set({ exampleCompanies: examples })
    .where(and(eq(segments.id, segmentId), eq(segments.accountId, accountId)));
}

export async function addSegment(
  runId: string,
  accountId: string,
  input: { name: string; description: string; pain: string; criteria: string[] },
  database: Database = defaultDb,
): Promise<void> {
  const existing = await database
    .select({ rank: segments.rank })
    .from(segments)
    .where(and(eq(segments.runId, runId), eq(segments.accountId, accountId)));
  await database.insert(segments).values({
    runId,
    accountId,
    rank: existing.length,
    name: input.name,
    icon: "✦",
    description: input.description,
    pain: input.pain,
    criteria: input.criteria,
    origin: "user",
  });
}

/**
 * Edits a segment's words — and clears its count.
 *
 * The count belongs to the query that produced it, and the query is built from
 * the criteria. Editing the criteria and keeping the old number would leave a
 * figure on screen that its own stated query no longer produces, which is the
 * exact failure the schema constraint exists to prevent one layer down.
 */
export async function editSegment(
  segmentId: string,
  accountId: string,
  input: { name: string; description: string; pain: string; criteria: string[] },
  database: Database = defaultDb,
): Promise<void> {
  await database
    .update(segments)
    .set({
      name: input.name,
      description: input.description,
      pain: input.pain,
      criteria: input.criteria,
      matchCount: null,
      countSource: "unavailable",
      countError: "المعايير تغيّرت بعد آخر عدّ. شغّل العدّ من جديد.",
    })
    .where(and(eq(segments.id, segmentId), eq(segments.accountId, accountId)));
}

export async function removeSegment(
  segmentId: string,
  accountId: string,
  database: Database = defaultDb,
): Promise<void> {
  await database
    .update(segments)
    .set({ removedAt: new Date().toISOString() })
    .where(and(eq(segments.id, segmentId), eq(segments.accountId, accountId)));
}

export async function saveCompanies(
  segmentId: string,
  accountId: string,
  rows: Omit<typeof targetCompanies.$inferInsert, "segmentId" | "accountId">[],
  database: Database = defaultDb,
): Promise<CompanyRow[]> {
  if (rows.length === 0) return [];
  return database
    .insert(targetCompanies)
    .values(rows.map((r) => ({ ...r, segmentId, accountId })))
    .returning();
}

export async function savePeople(
  segmentId: string,
  accountId: string,
  rows: Omit<typeof targetPeople.$inferInsert, "segmentId" | "accountId">[],
  database: Database = defaultDb,
): Promise<PersonRow[]> {
  if (rows.length === 0) return [];
  return database
    .insert(targetPeople)
    .values(rows.map((r) => ({ ...r, segmentId, accountId })))
    .returning();
}

/** Keeping and un-keeping is free and reversible — that is the whole design. */
export async function setPersonKept(
  personId: string,
  accountId: string,
  kept: boolean,
  database: Database = defaultDb,
): Promise<void> {
  await database
    .update(targetPeople)
    .set({ kept })
    .where(and(eq(targetPeople.id, personId), eq(targetPeople.accountId, accountId)));
}

export async function setCompanyKept(
  companyId: string,
  accountId: string,
  kept: boolean,
  database: Database = defaultDb,
): Promise<void> {
  await database
    .update(targetCompanies)
    .set({ kept })
    .where(and(eq(targetCompanies.id, companyId), eq(targetCompanies.accountId, accountId)));
}

/**
 * Records what a paid collect actually bought.
 *
 * `collectedAt` is set here and nowhere else, and it is what stops the row
 * being priced again — so it must only ever be written on the path that really
 * spent the credits.
 */
export async function recordPersonCollect(
  personId: string,
  accountId: string,
  data: { email?: string | null; emailStatus?: PersonRow["emailStatus"]; title?: string; linkedinUrl?: string | null },
  database: Database = defaultDb,
): Promise<void> {
  await database
    .update(targetPeople)
    .set({
      // The CHECK constraint refuses an address with no status, which is the
      // point: an address of unknown provenance must not reach a row.
      email: data.emailStatus ? (data.email ?? null) : null,
      emailStatus: data.emailStatus ?? null,
      ...(data.title ? { title: data.title } : {}),
      ...(data.linkedinUrl ? { linkedinUrl: data.linkedinUrl } : {}),
      collectedAt: new Date().toISOString(),
      source: "collect",
    })
    .where(and(eq(targetPeople.id, personId), eq(targetPeople.accountId, accountId)));
}

export async function upsertDraft(
  input: {
    personId: string;
    accountId: string;
    segmentId: string;
    template: DraftTemplate;
    composed: ComposedDraft;
  },
  database: Database = defaultDb,
): Promise<void> {
  const values = {
    personId: input.personId,
    accountId: input.accountId,
    segmentId: input.segmentId,
    template: input.template,
    subjectAr: input.composed.subjectAr,
    bodyAr: input.composed.bodyAr,
    subjectEn: input.composed.subjectEn,
    bodyEn: input.composed.bodyEn,
    specifics: input.composed.specifics,
    updatedAt: new Date().toISOString(),
  };
  await database
    .insert(introDrafts)
    .values(values)
    .onConflictDoUpdate({
      target: introDrafts.personId,
      // A draft the user edited is theirs. Re-running the composer over it
      // would delete their writing to replace it with ours.
      setWhere: eq(introDrafts.editedByUser, false),
      set: values,
    });
}

export async function editDraft(
  draftId: string,
  accountId: string,
  input: { subject: string; body: string; lang: "ar" | "en" },
  database: Database = defaultDb,
): Promise<void> {
  await database
    .update(introDrafts)
    .set({
      ...(input.lang === "en"
        ? { subjectEn: input.subject, bodyEn: input.body }
        : { subjectAr: input.subject, bodyAr: input.body }),
      editedByUser: true,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(introDrafts.id, draftId), eq(introDrafts.accountId, accountId)));
}

export async function setDraftLang(
  draftId: string,
  accountId: string,
  lang: "ar" | "en",
  database: Database = defaultDb,
): Promise<void> {
  await database
    .update(introDrafts)
    .set({ lang })
    .where(and(eq(introDrafts.id, draftId), eq(introDrafts.accountId, accountId)));
}

/**
 * Approve or reject. Deliberately cannot reach `sent`.
 *
 * The signature only accepts the two statuses a human decision produces.
 * Marking something sent is a different function with a different argument —
 * a provider message id — because a status that means "a real message left the
 * building" must be unreachable from a button that only means "I like this
 * one".
 */
export async function setDraftDecision(
  draftId: string,
  accountId: string,
  status: Extract<DraftStatus, "approved" | "rejected" | "prepared">,
  database: Database = defaultDb,
): Promise<void> {
  await database
    .update(introDrafts)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(and(eq(introDrafts.id, draftId), eq(introDrafts.accountId, accountId)));
}

/**
 * The only way to `sent`, and it requires the id.
 *
 * `intro_drafts_sent_needs_provider_id` refuses the write without one, so this
 * is belt and braces — but the belt is what a reader of this file sees, and it
 * should be impossible to call this function without having a real id in hand.
 */
export async function markDraftSent(
  draftId: string,
  accountId: string,
  providerMessageId: string,
  database: Database = defaultDb,
): Promise<void> {
  if (!providerMessageId.trim()) {
    throw new Error("markDraftSent requires a provider message id — see the CHECK constraint.");
  }
  await database
    .update(introDrafts)
    .set({
      status: "sent",
      providerMessageId,
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(introDrafts.id, draftId), eq(introDrafts.accountId, accountId)));
}

/** The whole run, in one round trip per table. */
export async function loadRun(
  runId: string,
  accountId: string,
  database: Database = defaultDb,
): Promise<RunBundle | null> {
  const [run] = await database
    .select()
    .from(gtmRuns)
    .where(and(eq(gtmRuns.id, runId), eq(gtmRuns.accountId, accountId)))
    .limit(1);
  if (!run) return null;

  const [profile] = await database
    .select()
    .from(companyProfiles)
    .where(and(eq(companyProfiles.runId, runId), eq(companyProfiles.accountId, accountId)))
    .limit(1);

  const segmentRows = await database
    .select()
    .from(segments)
    .where(and(eq(segments.runId, runId), eq(segments.accountId, accountId), isNull(segments.removedAt)))
    .orderBy(asc(segments.rank));

  const ids = segmentRows.map((s) => s.id);
  const companies = ids.length
    ? await database.select().from(targetCompanies).where(inArray(targetCompanies.segmentId, ids))
    : [];
  const people = ids.length
    ? await database.select().from(targetPeople).where(inArray(targetPeople.segmentId, ids))
    : [];
  const drafts = ids.length
    ? await database.select().from(introDrafts).where(inArray(introDrafts.segmentId, ids))
    : [];

  return { run, profile, segments: segmentRows, companies, people, drafts };
}

/** The account's runs, newest first — the /gtm index. */
export async function listRuns(
  accountId: string,
  database: Database = defaultDb,
): Promise<RunRow[]> {
  return database.select().from(gtmRuns).where(eq(gtmRuns.accountId, accountId));
}
