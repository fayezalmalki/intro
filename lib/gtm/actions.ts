"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { targetCompanies, targetPeople } from "../db/schema";
import { currentAccount } from "../session";
import { creditsRemaining } from "../coresignal";
import { gtmFixturesEnabled } from "../env";
import { logUsage } from "../usage";
import type { DraftTemplate } from "../types";
import { isTemplate } from "./compose";
import { normalizeWebsite, SiteFetchError, type AnalyzedProfile } from "./profile";
import { countSegment } from "./counts";
import { coresignalFor, decisionMakerTitles, employeeQuery, runFreeSteps } from "./run";
import { composeDraftsForRun } from "./drafts";
import {
  COMPANY_COLLECT_CREDITS, PERSON_COLLECT_CREDITS, confirmSpend, type CollectableRow,
} from "./spend";
import { EXAMPLE_PEOPLE } from "./example-rows";
import * as repo from "./repo";
import { BUNDLES, bundleById } from "../payments/pricing";
import { paymentProvider } from "../payments/provider";
import { startCheckout } from "../payments/checkout";

/**
 * Every mutation in the GTM flow.
 *
 * Authorization is inside each action, never on the page, for the reason
 * lib/session.ts already states and this file inherits: a server action is a
 * POST endpoint anyone can invoke without ever loading the page it sits on, so
 * a route guard would look like authorization and enforce nothing. Every
 * function here starts with `currentAccount()` and every repo call is scoped to
 * that account's id.
 */

/**
 * Revalidates both screens of a run.
 *
 * `revalidatePath("/gtm/<id>")` does **not** cover `/gtm/<id>/review` — they
 * are different paths, and an approval made on the review screen was silently
 * not repainting because of it. Every action that changes something either
 * screen renders goes through here rather than remembering which one it
 * affects.
 */
function revalidateRun(runId: string): void {
  revalidatePath(`/gtm/${runId}`);
  revalidatePath(`/gtm/${runId}/review`);
}

function s(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function lines(formData: FormData, key: string): string[] {
  return s(formData, key)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6);
}

/**
 * Step 1: a website in.
 *
 * The free steps run inline rather than in a background job. The whole run is
 * a handful of HTTP calls and the user is looking at the stepper while it
 * happens, which is the point — Explee's lesson is that the work being visible
 * *is* the onboarding. A queue would buy resilience the flow does not need yet
 * and cost the thing it is for.
 */
export async function startRun(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const raw = s(formData, "website");

  let website: string;
  try {
    website = normalizeWebsite(raw);
  } catch (error) {
    const reason = error instanceof SiteFetchError ? error.reason : "رابط غير صالح.";
    redirect(`/gtm?error=${encodeURIComponent(reason)}`);
  }

  const runId = await repo.createRun(account.id, website);
  await logUsage({ kind: "gtm_run_started", accountId: account.id, meta: { runId, website } });
  await runFreeSteps(runId, account.id);
  redirect(`/gtm/${runId}`);
}

/** Re-drive the free steps — after a manual profile fix, or a vendor blip. */
export async function rerunFreeSteps(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const runId = s(formData, "runId");
  await runFreeSteps(runId, account.id);
  revalidateRun(runId);
}

/**
 * The manual correction, and the reason a failed step is never a dead end.
 *
 * Marked `source: "manual"` so the screen says a person wrote this rather than
 * implying we read it off the site.
 */
export async function saveProfileByHand(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const runId = s(formData, "runId");
  const bundle = await repo.loadRun(runId, account.id);
  if (!bundle) return;

  const profile: AnalyzedProfile = {
    name: s(formData, "name") || bundle.profile?.name || "",
    sells: s(formData, "sells"),
    sellsEn: s(formData, "sellsEn"),
    market: s(formData, "market"),
    sizeSignal: s(formData, "sizeSignal"),
    language: "ar",
    offerings: lines(formData, "offerings"),
    competitors: lines(formData, "competitors").map((name) => ({ name, source: "analysis" as const })),
    source: "manual",
    sourceExcerpt: "",
  };
  if (!profile.name || !profile.sells) return;

  await repo.saveProfile(runId, account.id, bundle.run.websiteUrl, profile, db);
  await repo.setStep(runId, account.id, "profile", "done", { note: `${profile.name} — كتابة يدوية` });
  await repo.setRunStatus(runId, account.id, "running");
  revalidateRun(runId);
}

// ── Segments ──────────────────────────────────────────────────

export async function saveSegment(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const runId = s(formData, "runId");
  const segmentId = s(formData, "segmentId");
  const input = {
    name: s(formData, "name"),
    description: s(formData, "description"),
    pain: s(formData, "pain"),
    criteria: lines(formData, "criteria").slice(0, 3),
  };
  if (!input.name) return;

  if (segmentId) await repo.editSegment(segmentId, account.id, input);
  else await repo.addSegment(runId, account.id, input);
  revalidateRun(runId);
}

export async function deleteSegment(formData: FormData): Promise<void> {
  const account = await currentAccount();
  await repo.removeSegment(s(formData, "segmentId"), account.id);
  revalidateRun(s(formData, "runId"));
}

/**
 * Re-counts one segment against the vendor. Free.
 *
 * Separate from the run because a user who edited the criteria needs the number
 * to follow their edit — and because `editSegment` clears the count on purpose,
 * so there is a visible gap for this button to fill.
 */
export async function recountSegment(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const runId = s(formData, "runId");
  const segmentId = s(formData, "segmentId");
  const bundle = await repo.loadRun(runId, account.id);
  const segment = bundle?.segments.find((x) => x.id === segmentId);
  if (!segment) return;

  const client = coresignalFor(account.id, db);
  const count = await countSegment(
    {
      country: bundle!.profile?.market || "Saudi Arabia",
      keywords: segment.criteria,
    },
    client,
  );
  await repo.saveCount(segmentId, account.id, count, db);
  if (count.ids.length) {
    await repo.saveCompanies(
      segmentId,
      account.id,
      count.ids.slice(0, 25).map((id) => ({ coresignalId: id, name: "", source: "search" as const })),
      db,
    );
  }
  revalidateRun(runId);
}

// ── Keeping rows. Free, reversible, and the whole cost boundary. ──

export async function toggleCompany(formData: FormData): Promise<void> {
  const account = await currentAccount();
  await repo.setCompanyKept(s(formData, "companyId"), account.id, s(formData, "kept") === "1");
  revalidateRun(s(formData, "runId"));
}

export async function togglePerson(formData: FormData): Promise<void> {
  const account = await currentAccount();
  await repo.setPersonKept(s(formData, "personId"), account.id, s(formData, "kept") === "1");
  revalidateRun(s(formData, "runId"));
}

// ── The paid steps ────────────────────────────────────────────

export interface SpendResult {
  ok: boolean;
  message: string;
  creditsSpent?: number;
}

/**
 * Buys company names for the rows the user kept. 10 credits each.
 *
 * `confirmSpend` compares the amount the user was shown against the amount the
 * current selection actually costs, and refuses on a mismatch. That is not
 * belt-and-braces — a row kept in a second tab between render and submit means
 * the page they agreed to is not the page being executed.
 */
export async function revealCompanies(
  _prev: SpendResult | undefined,
  formData: FormData,
): Promise<SpendResult> {
  const account = await currentAccount();
  const runId = s(formData, "runId");
  const confirmed = Number(s(formData, "confirmedCredits"));

  const bundle = await repo.loadRun(runId, account.id);
  if (!bundle) return { ok: false, message: "ما لقينا هذي الجلسة." };

  const rows: CollectableRow[] = bundle.companies.map((c) => ({
    id: c.id,
    kept: c.kept,
    collectedAt: c.enrichedAt,
    coresignalId: c.coresignalId,
  }));

  const client = coresignalFor(account.id, db);
  const verdict = confirmSpend(rows, confirmed, await creditsRemaining(db), COMPANY_COLLECT_CREDITS);
  if (!verdict.allowed) return { ok: false, message: verdict.reason ?? "ما نقدر نكمل." };
  if (!client) {
    return { ok: false, message: "ما فيه مفتاح Coresignal في هذي البيئة، فما فيه شيء نشتريه." };
  }

  await logUsage({
    kind: "collect_confirmed",
    accountId: account.id,
    meta: { runId, kind: "company", rows: verdict.plan.buy.length, credits: verdict.plan.credits },
  });

  let spent = 0;
  for (const id of verdict.plan.buy) {
    const row = bundle.companies.find((c) => c.id === id)!;
    const result = await client.collectCompany(row.coresignalId!);
    spent += result.creditsSpent;
    await db
      .update(targetCompanies)
      .set({
        name: result.data?.company_name ?? row.name,
        website: result.data?.website ?? null,
        employeesCount: result.data?.employees_count ?? null,
        industry: result.data?.industry ?? null,
        hqCountry: result.data?.hq_country ?? null,
        linkedinUrl: result.data?.linkedin_url ?? null,
        enrichedAt: new Date().toISOString(),
        source: "collect",
      })
      .where(and(eq(targetCompanies.id, id), eq(targetCompanies.accountId, account.id)));
  }

  revalidateRun(runId);
  return { ok: true, message: `كشفنا ${verdict.plan.buy.length} شركة.`, creditsSpent: spent };
}

/**
 * The free employee search: how many decision makers per kept company, and
 * their vendor ids. Costs nothing and returns no names.
 */
export async function findPeople(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const runId = s(formData, "runId");
  const bundle = await repo.loadRun(runId, account.id);
  const client = coresignalFor(account.id, db);
  if (!bundle || !client) return;

  for (const segment of bundle.segments) {
    const kept = bundle.companies.filter((c) => c.segmentId === segment.id && c.kept);
    const titles = decisionMakerTitles({ country: "Saudi Arabia", keywords: segment.criteria });
    for (const company of kept) {
      if (!company.coresignalId) continue;
      const already = bundle.people.some((p) => p.companyId === company.id);
      if (already) continue;
      const result = await client.searchEmployeesEsDsl(employeeQuery(company.coresignalId, titles));
      await repo.savePeople(
        segment.id,
        account.id,
        result.ids.slice(0, 10).map((id) => ({
          companyId: company.id,
          coresignalId: id,
          fullName: "",
          companyName: company.name,
          source: "search" as const,
        })),
        db,
      );
    }
  }
  revalidateRun(runId);
}

/**
 * Buys the people the user kept. 20 credits each, and the only source of a name
 * and an email address.
 *
 * `recordPersonCollect` writes the address only alongside the vendor's own
 * status, because `target_people_email_needs_status` refuses it otherwise — an
 * address with no provenance is precisely what the email gate exists to stop.
 */
export async function revealPeople(
  _prev: SpendResult | undefined,
  formData: FormData,
): Promise<SpendResult> {
  const account = await currentAccount();
  const runId = s(formData, "runId");
  const confirmed = Number(s(formData, "confirmedCredits"));

  const bundle = await repo.loadRun(runId, account.id);
  if (!bundle) return { ok: false, message: "ما لقينا هذي الجلسة." };

  const rows: CollectableRow[] = bundle.people.map((p) => ({
    id: p.id,
    kept: p.kept,
    collectedAt: p.collectedAt,
    coresignalId: p.coresignalId,
  }));

  const verdict = confirmSpend(rows, confirmed, await creditsRemaining(db), PERSON_COLLECT_CREDITS);
  if (!verdict.allowed) return { ok: false, message: verdict.reason ?? "ما نقدر نكمل." };

  const client = coresignalFor(account.id, db);
  if (!client) {
    return { ok: false, message: "ما فيه مفتاح Coresignal في هذي البيئة، فما فيه شيء نشتريه." };
  }

  await logUsage({
    kind: "collect_confirmed",
    accountId: account.id,
    meta: { runId, kind: "person", rows: verdict.plan.buy.length, credits: verdict.plan.credits },
  });

  let spent = 0;
  for (const id of verdict.plan.buy) {
    const row = bundle.people.find((p) => p.id === id)!;
    const result = await client.collectEmployee(row.coresignalId!);
    spent += result.creditsSpent;
    const data = result.data;
    await db
      .update(targetPeople)
      .set({
        fullName: data?.full_name ?? "",
        firstName: data?.first_name ?? null,
        title: data?.active_experience_title ?? "",
        companyName: data?.active_experience_company_name ?? row.companyName,
        linkedinUrl: data?.linkedin_url ?? null,
        email: data?.primary_professional_email_status ? (data.primary_professional_email ?? null) : null,
        emailStatus: data?.primary_professional_email_status ?? null,
        collectedAt: new Date().toISOString(),
        source: "collect",
      })
      .where(and(eq(targetPeople.id, id), eq(targetPeople.accountId, account.id)));
  }

  await composeDraftsForRun(runId, account.id, account.displayName, defaultTemplate(formData), db);
  await repo.setStep(runId, account.id, "people", "done", { note: `${verdict.plan.buy.length} شخص مكشوف` });
  await repo.setStep(runId, account.id, "drafts", "done", { note: "المسودات جاهزة للمراجعة" });

  revalidateRun(runId);
  return { ok: true, message: `كشفنا ${verdict.plan.buy.length} شخص وكتبنا مسوداتهم.`, creditsSpent: spent };
}

function defaultTemplate(formData: FormData): DraftTemplate {
  const raw = s(formData, "template");
  return isTemplate(raw) ? raw : "direct";
}

/**
 * Development only: fills the two paid steps with hand-written rows.
 *
 * Without a Coresignal key the flow stops dead at step 4, because a name is a
 * purchase — so the review screen, the email gate and the drafts could not be
 * walked or reviewed at all. Every row is written `source: "fixture"` and every
 * screen that renders one says so, so this cannot be mistaken for vendor data
 * even if the flag were somehow on.
 */
export async function loadExampleRows(formData: FormData): Promise<void> {
  if (!gtmFixturesEnabled) return;
  const account = await currentAccount();
  const runId = s(formData, "runId");
  const bundle = await repo.loadRun(runId, account.id);
  if (!bundle || bundle.segments.length === 0) return;

  for (const segment of bundle.segments.slice(0, 2)) {
    if (bundle.people.some((p) => p.segmentId === segment.id && p.source === "fixture")) continue;
    const [company] = await repo.saveCompanies(
      segment.id,
      account.id,
      [
        {
          name: "شركة مثال للبرمجيات",
          website: "example.sa",
          employeesCount: 84,
          industry: "برمجيات كخدمة",
          hqCountry: "Saudi Arabia",
          kept: true,
          enrichedAt: new Date().toISOString(),
          source: "fixture" as const,
        },
      ],
      db,
    );
    await repo.savePeople(
      segment.id,
      account.id,
      EXAMPLE_PEOPLE.map((p) => ({
        companyId: company.id,
        fullName: p.fullName,
        firstName: p.firstName,
        title: p.title,
        companyName: company.name,
        email: p.email,
        emailStatus: p.emailStatus,
        kept: true,
        collectedAt: new Date().toISOString(),
        source: "fixture" as const,
      })),
      db,
    );
  }

  await composeDraftsForRun(runId, account.id, account.displayName, defaultTemplate(formData), db);
  await repo.setStep(runId, account.id, "people", "done", { note: "صفوف مثال — ليست من مزوّد بيانات" });
  await repo.setStep(runId, account.id, "drafts", "done", { note: "مسودات على صفوف مثال" });
  revalidateRun(runId);
}

// ── Drafts and review ─────────────────────────────────────────

export async function changeTemplate(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const runId = s(formData, "runId");
  await composeDraftsForRun(runId, account.id, account.displayName, defaultTemplate(formData), db);
  revalidateRun(runId);
}

export async function saveDraft(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const runId = s(formData, "runId");
  const lang = s(formData, "lang") === "en" ? "en" : "ar";
  await repo.editDraft(s(formData, "draftId"), account.id, {
    subject: s(formData, "subject"),
    body: s(formData, "body"),
    lang,
  });
  revalidateRun(runId);
}

export async function switchLang(formData: FormData): Promise<void> {
  const account = await currentAccount();
  await repo.setDraftLang(s(formData, "draftId"), account.id, s(formData, "lang") === "en" ? "en" : "ar");
  revalidateRun(s(formData, "runId"));
}

/**
 * Approve or reject. Cannot reach `sent`, by signature and by constraint.
 *
 * `sent` means a real message left the building, and the only thing that
 * proves it is a provider message id. `repo.markDraftSent` is the sole writer,
 * it requires the id, and `intro_drafts_sent_needs_provider_id` refuses the row
 * without one.
 */
export async function decideDraft(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const raw = s(formData, "status");
  if (raw !== "approved" && raw !== "rejected" && raw !== "prepared") return;
  await repo.setDraftDecision(s(formData, "draftId"), account.id, raw);
  revalidateRun(s(formData, "runId"));
}

// ── The paywall ───────────────────────────────────────────────

/**
 * The paywall, at the send/unlock moment and nowhere earlier.
 *
 * Everything before this point — the profile, the segments, the counts, the
 * people, the drafts — is visible for free. That placement is Explee's one
 * genuinely good idea and it is kept; the countdown and the "only 6 spots left
 * this hour" beside it are not, and never will be.
 */
export async function beginCheckout(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const runId = s(formData, "runId");
  const bundle = bundleById(s(formData, "bundle")) ?? BUNDLES[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const started = await startCheckout(
    // Back to the review screen, which is where they were and where the new
    // balance shows — not the run page, which is a step backwards.
    { accountId: account.id, bundle, returnUrl: `${appUrl}/gtm/${runId}/review` },
    paymentProvider(),
    db,
  );
  redirect(started.redirectUrl);
}


