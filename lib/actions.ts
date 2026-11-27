"use server";

import { env } from "cloudflare:workers";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extractBrief } from "./intent";
import { parseRows } from "./parse";
import * as repo from "./db/repo";
import { loadRequestContext } from "./db/loaders";
import { sendThroughGate } from "./send";
import { liveWorkflow, startSourcing } from "./sourcing/live";
import { chargeThroughGate } from "./charge";
import { adminEmails, currentAccount, requireAccountManager, requireAdmin, requireRequestOwner } from "./session";
import { sendActivated, sendActivationRequested, sendCreditRequest } from "./mailer";
import { packageById } from "./billing/packages";
import { createInvoice, moyasarKey } from "./billing/moyasar";
import { db } from "./db";
import { accounts } from "./db/schema";
import { eq } from "drizzle-orm";
import { assertDevTools, isProduction } from "./env";
import type { Channel, PipelineSource, Role } from "./types";

const SLA_HOURS = 24;
const DEV_GRANT = 5;

/**
 * What an admin's verification puts in an account's ledger.
 *
 * Small on purpose: there is no billing yet, so this is the whole supply of
 * sends an account has. Ten is the per-request cap the requester's own screen
 * already promises, so a verified account can work one request through.
 */
const VERIFY_GRANT = 10;

export async function createRequest(formData: FormData): Promise<void> {
  const rawText = String(formData.get("rawText") ?? "").trim();
  if (!rawText) return;

  const account = await currentAccount();
  const brief = await extractBrief(rawText);
  const requestId = await repo.createRequest({
    accountId: account.id,
    rawText,
    brief,
    slaHours: SLA_HOURS,
    // Deliberately unassigned. This used to stamp every request with a seeded
    // account manager's name, which in production means a fictional owner on
    // work nobody has claimed. An account manager claims a request from the
    // queue instead.
  });

  redirect(`/requests/${requestId}/confirm`);
}

/**
 * The structured intake (/new): goal, sectors and roles are picked, so the
 * brief is exact. Editing an unconfirmed request rewrites it in place.
 */
export async function createStructuredRequest(formData: FormData): Promise<void> {
  const { briefFromPicks, GOALS } = await import("./intake");
  const parse = (k: string) => { try { const v = JSON.parse(String(formData.get(k) ?? "[]")); return Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 8) : []; } catch { return []; } };
  const goalRaw = String(formData.get("goal") ?? "");
  const goal = GOALS.some((g) => g.id === goalRaw) ? (goalRaw as (typeof GOALS)[number]["id"]) : "sales";
  const sectors = parse("sectors").slice(0, 3);
  const lang = String(formData.get("lang") ?? "ar") === "en" ? "en" : "ar";
  if (sectors.length === 0) redirect(`/new?lang=${lang}&need=sector`);
  const built = briefFromPicks({ goal, sectors, roles: parse("roles"), notes: String(formData.get("notes") ?? "") });

  const account = await currentAccount();
  const editing = String(formData.get("requestId") ?? "");
  if (editing) {
    await requireRequestOwner(editing, "edit this request");
    if (await repo.updateRequestBrief(editing, account.id, built)) redirect(`/requests/${editing}/confirm`);
  }
  const requestId = await repo.createRequest({ accountId: account.id, rawText: built.rawText, brief: built.brief, sectors: built.sectors, slaHours: SLA_HOURS });
  redirect(`/requests/${requestId}/confirm`);
}

export async function confirmBrief(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId"));
  const summary = String(formData.get("summaryAr") ?? "").trim();

  // A server action is a POST endpoint anyone can invoke without ever loading
  // the page, so the check on the confirm screen is not the boundary. Without
  // this, any signed-in account could rewrite anyone's brief.
  const owner = await requireRequestOwner(requestId, "confirm this request");

  // A request runs a whole sourcing pass, so it costs REQUEST_CREDITS —
  // reserved in the AccountGate, once per request (the ref is the request),
  // and refunded if the search finds nobody.
  const charged = await chargeThroughGate({ accountId: owner.id, reason: "request", ref: `request:${requestId}`, amount: repo.REQUEST_CREDITS });
  if (!charged) redirect(`/billing?need=request&next=${encodeURIComponent(`/requests/${requestId}/confirm`)}`);

  const workflow = liveWorkflow();
  if (workflow) {
    // Real sourcing runs in the background (worker/request-workflow.ts); the
    // request page shows the "finding people" stage until v1 lands.
    if (await repo.confirmBriefForSourcing(requestId, summary || undefined)) {
      await startSourcing(workflow, requestId);
    }
  } else if (isProduction) {
    // No live sourcing in production (a missing secret or binding). Never
    // fall back to the seeded demo people for a real account: return the
    // credits and say so on the confirm screen.
    await repo.refundRequest(owner.id, requestId);
    redirect(`/requests/${requestId}/confirm?unavailable=1`);
  } else {
    await repo.confirmBrief(requestId, summary || undefined);
    // Without live sourcing the draft is written inline; publish it for
    // self-serve accounts the same way the workflow does.
    if (owner.state !== "managed") {
      const published = await repo.autoPublishLatestDraft(requestId, "AI");
      if (!published) await repo.refundRequest(owner.id, requestId);
    }
  }

  revalidatePath("/am");
  redirect(`/requests/${requestId}`);
}

export async function setItemStatus(formData: FormData): Promise<void> {
  const am = await requireAccountManager("review a pipeline");
  await repo.setItemStatus(
    String(formData.get("pipelineId")),
    String(formData.get("itemId")),
    String(formData.get("status")) as "approved" | "removed",
    am.displayName,
  );
  revalidatePath("/am/requests/[id]", "page");
}

export async function publishPipeline(formData: FormData): Promise<void> {
  const am = await requireAccountManager("publish a pipeline");
  const requestId = await repo.publishPipeline(String(formData.get("pipelineId")), am.displayName);
  if (!requestId) return;

  revalidatePath("/am");
  redirect(`/am/requests/${requestId}/published`);
}

export async function attachPipeline(formData: FormData): Promise<void> {
  const am = await requireAccountManager("attach a pipeline");
  const requestId = String(formData.get("requestId"));
  const source = String(formData.get("source")) as PipelineSource;
  const listId = String(formData.get("listId") ?? "");
  const text = String(formData.get("rows") ?? "");

  await repo.attachPipeline({
    requestId,
    source,
    actor: am.displayName,
    listId: listId || undefined,
    rows: source === "from_list" ? undefined : parseRows(text),
  });

  // An attached list lands back in review rather than going straight to the
  // requester: rows arrive pre-approved so publishing is one click, but the AM
  // still gets the chance to write the reasoning that makes a list worth more
  // than a list of names.
  revalidatePath("/am");
  redirect(`/am/requests/${requestId}`);
}

export interface SendResult {
  ok: boolean;
  reason?: string;
}

/**
 * The only path to an outreach record. Everything runs through canSend() inside
 * the account's AccountGate Durable Object, which processes one send per
 * account at a time — so no provider is ever reached without an allowed
 * verdict and no two sends can spend the same credit.
 */
export async function markOutreach(
  _prev: SendResult | undefined,
  formData: FormData,
): Promise<SendResult> {
  const requestId = String(formData.get("requestId"));
  // Owner-only, not role-based: recordSend charges `account.id` for a send
  // against `requestId`, so a mismatched pair would write ledger rows for one
  // account attached to another account's request.
  const account = await requireRequestOwner(requestId, "send on this request");

  const result = await sendThroughGate({
    accountId: account.id,
    requestId,
    personId: String(formData.get("personId")),
    channel: String(formData.get("channel")) as Channel,
    body: String(formData.get("body") ?? ""),
    actor: account.displayName,
  });

  revalidatePath(`/requests/${requestId}`);
  return result;
}

/**
 * Development-only: there is no auth or billing yet, so the send gate is
 * unreachable without a way to verify the account and grant it credits.
 */
export async function devVerifyAndGrant(formData: FormData): Promise<void> {
  assertDevTools("Verifying an account and granting credits");
  const requestId = String(formData.get("requestId"));
  const account = await currentAccount();
  await repo.verifyAndGrant(account.id, DEV_GRANT);
  revalidatePath(`/requests/${requestId}`);
}

const ROLES: readonly Role[] = ["requester", "account_manager", "admin"];

/**
 * Grants or revokes a role. Admin only.
 *
 * Returns a message rather than throwing on a refused change: "you cannot
 * demote the last administrator" is information the person needs, not an
 * error, and an unhandled throw here would show them the crash boundary.
 */
export async function grantRole(formData: FormData): Promise<void> {
  const admin = await requireAdmin("change an account's role");

  const targetAccountId = String(formData.get("accountId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  if (!targetAccountId || !ROLES.includes(role)) return;

  const result = await repo.setAccountRole({
    actorAccountId: admin.id,
    targetAccountId,
    role,
  });

  revalidatePath("/am/team");
  if (!result.ok) redirect(`/am/team?refused=${result.reason}`);
}


/**
 * Verifies an account for sending and gives it credits. Admin only.
 *
 * Until this existed, sending was unreachable in production: every account is
 * provisioned as an observer with an empty ledger (lib/session.ts), so the
 * gate refused every send with account_not_verified and insufficient_credits,
 * and the only code that cleared them was devVerifyAndGrant — which
 * assertDevTools blocks outside development. A requester reached a published
 * pipeline and was told to «أكمل التحقق أولًا», pointing at a step that did
 * not exist.
 *
 * An admin verifying their own account is deliberately allowed. grantRole
 * refuses a self-change because self-promotion would make the role split
 * meaningless; granting yourself credits you already control the ledger for
 * defeats nothing, and refusing it would leave the send path untestable by
 * the only person who can reach this page.
 */
export async function verifyAccount(formData: FormData): Promise<void> {
  const admin = await requireAdmin("verify an account");

  const targetAccountId = String(formData.get("accountId") ?? "");
  if (!targetAccountId) return;

  // How many grants the page saw when it rendered this button. A count only
  // goes up, so re-rendering always produces a ref that has not been used —
  // while a double-submitted form repeats the one it was rendered with and is
  // absorbed by ledger_idempotency_idx instead of doubling the credits.
  const grants = Number(formData.get("grants") ?? 0);

  // The amount an admin picked (manual top-ups: a requested pack), else the default grant.
  const picked = Number(formData.get("amount"));
  const amount = [10, 100, 300, 1000].includes(picked) ? picked : VERIFY_GRANT;
  const result = await repo.verifyAndCredit({
    accountId: targetAccountId,
    amount,
    ref: `admin-grant:${Number.isFinite(grants) ? grants : 0}`,
    actor: admin.displayName,
  });

  revalidatePath("/am/team");
  if (!result.ok) redirect(`/am/team?refused=${result.reason}`);

  // Tell them. A failed email must not undo a verification that committed.
  const [target] = await db.select().from(accounts).where(eq(accounts.id, targetAccountId)).limit(1);
  if (target && result.granted) {
    await sendActivated(target.email, target.displayName, target.locale, amount).catch((error) =>
      console.error("[verifyAccount] activation email failed", error));
  }
}


// ── Onboarding and activation ─────────────────────────────────

const USE_CASES = new Set(["sell", "hire-me", "hire", "partner", "invest", "enter-market"]);

/** Only same-site paths, as on /login: a `next` must never leave the site. */
function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

function cleanUrl(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/** /welcome. Required: name, company, role. */
export async function completeOnboarding(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  const next = safeNext(formData.get("next"), "/new");
  // Name is what introduces them; a job seeker between roles may have no company.
  if (!name || !jobTitle) {
    redirect(`/welcome?next=${encodeURIComponent(next)}&missing=1${locale === "en" ? "&lang=en" : ""}`);
  }
  const useCase = String(formData.get("useCase") ?? "");
  await repo.grantWelcomeCredits(account.id);
  await repo.markSignupOnboarded(account.id).catch(() => undefined);
  await repo.completeOnboarding({
    accountId: account.id,
    name,
    company,
    companyWebsite: cleanUrl(formData.get("companyWebsite")),
    jobTitle,
    useCase: USE_CASES.has(useCase) ? useCase : undefined,
    linkedinUrl: cleanUrl(formData.get("linkedinUrl")),
    locale,
  });
  // A first request with nothing typed yet starts from their use case's example,
  // in their language.
  const url = new URL(next, "https://intro.sa");
  if (url.pathname === "/new" && !url.searchParams.get("q") && USE_CASES.has(useCase)) {
    const { en } = await import("./site/en");
    const { ar } = await import("./site/ar");
    const seed = (locale === "en" ? en : ar).useCases.items.find((u) => u.id === useCase)?.seed;
    if (seed) url.searchParams.set("q", seed);
  }
  redirect(url.pathname + url.search);
}

/** /activate. An observer asks to send; admins are told by email. */
export async function requestActivation(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const linkedinUrl = cleanUrl(formData.get("linkedinUrl"));
  const companyWebsite = cleanUrl(formData.get("companyWebsite"));
  const next = safeNext(formData.get("next"), "/requests");
  if (!linkedinUrl || !companyWebsite) {
    redirect(`/activate?next=${encodeURIComponent(next)}&missing=1`);
  }
  const note = String(formData.get("note") ?? "").slice(0, 500);
  // A work email at the company's own domain vouches for them: verified now.
  const { workEmailMatchesCompany } = await import("./outbound");
  if (workEmailMatchesCompany(account.email, companyWebsite)) {
    await repo.verifyByWorkEmail(account.id, linkedinUrl, companyWebsite);
    await sendActivated(account.email, account.displayName, account.locale === "en" ? "en" : "ar", 0).catch(() => undefined);
    revalidatePath("/leads");
    redirect(`/activate?next=${encodeURIComponent(next)}`);
  }
  const result = await repo.requestActivation({ accountId: account.id, linkedinUrl, companyWebsite, note });
  if (result.ok) {
    // Everyone who can approve: the bootstrap list and anyone granted admin.
    const granted = await db.select({ email: accounts.email }).from(accounts).where(eq(accounts.role, "admin"));
    const admins = [...new Set([...adminEmails(), ...granted.map((a) => a.email.toLowerCase())])];
    await sendActivationRequested(admins, {
      displayName: account.displayName, email: account.email, company: account.company,
      companyWebsite, linkedinUrl, jobTitle: account.jobTitle, note,
    }).catch((error) => console.error("[requestActivation] admin email failed", error));
  }
  revalidatePath("/requests");
  redirect(`/activate?sent=1&next=${encodeURIComponent(next)}`);
}

/**
 * Restarts live sourcing for a request that never produced a list (the run
 * failed or stalled). A fresh workflow instance id, since the first one
 * exists; writeSourcedPipeline is idempotent on v1 if both ever finish.
 */
export async function retrySourcing(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId"));
  await requireRequestOwner(requestId, "retry this request");
  const workflow = liveWorkflow();
  if (workflow) await workflow.create({ id: `${requestId}-${Date.now()}`, params: { requestId } });
  redirect(`/requests/${requestId}`);
}


// ── Billing ───────────────────────────────────────────────────

function siteOrigin(): string {
  const url = (env as unknown as { BETTER_AUTH_URL?: string }).BETTER_AUTH_URL;
  return url?.replace(/\/$/, "") || "https://intro.sa";
}

/**
 * Buys a credit pack: an order row first (so the return URL can name it),
 * then a Moyasar invoice, then off to Moyasar's hosted checkout. Without a
 * Moyasar key, the request goes to the admins to grant by hand instead.
 */
export async function buyCredits(formData: FormData): Promise<void> {
  const account = await currentAccount();
  const pack = packageById(String(formData.get("package") ?? ""));
  const lang = formData.get("lang") === "en" ? "en" : "ar";
  if (!pack) redirect(`/billing?lang=${lang}`);

  const key = moyasarKey();
  if (!key) {
    const granted = await db.select({ email: accounts.email }).from(accounts).where(eq(accounts.role, "admin"));
    const admins = [...new Set([...adminEmails(), ...granted.map((a) => a.email.toLowerCase())])];
    await sendCreditRequest(admins, { displayName: account.displayName, email: account.email, company: account.company }, `${pack.en} · ${pack.credits} credits · ${pack.sar} SAR`)
      .catch((error) => console.error("[buyCredits] admin email failed", error));
    redirect(`/billing?lang=${lang}&requested=${pack.id}`);
  }

  const orderId = await repo.createOrder({ accountId: account.id, package: pack.id, credits: pack.credits, amountHalalas: pack.sar * 100 });
  const origin = siteOrigin();
  const invoice = await createInvoice(key, {
    amountHalalas: pack.sar * 100,
    description: `intro.sa — ${pack.credits} credits (${pack.en})`,
    successUrl: `${origin}/billing/return?order=${orderId}&lang=${lang}`,
    backUrl: `${origin}/billing?lang=${lang}`,
    callbackUrl: `${origin}/api/billing/moyasar`,
    metadata: { order_id: orderId, account_id: account.id },
  });
  await repo.attachInvoice(orderId, invoice.id);
  redirect(invoice.url);
}

/**
 * A request result → the lead page, where the message is drafted, opened in
 * the person's own email and followed up. Free; creates the lead if needed.
 */
export async function writeToPerson(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  const lang = formData.get("lang") === "en" ? "en" : "ar";
  const owner = await requireRequestOwner(requestId, "write to people on this request");
  const context = await loadRequestContext(requestId);
  const listed = context.pipelines.some((p) => p.requestId === requestId && p.status === "published" && p.items.some((i) => i.personId === personId));
  if (!listed) throw new Error("This person is not on this request's published list.");
  const leadId = await repo.leadForPerson(owner.id, personId, "SA");
  redirect(`/leads/${leadId}?lang=${lang}`);
}

/**
 * /am/signups: email someone who asked for a code and never got in, once.
 * Account managers only; never to an address that has signed in.
 */
export async function inviteBack(formData: FormData): Promise<void> {
  const actor = await requireAccountManager("invite people back");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !(await repo.signupNeverVerified(email))) redirect("/am/signups?invite=skipped");
  if ((await repo.invitedSignups()).has(email)) redirect("/am/signups?invite=already");
  const { sendInviteBack } = await import("./mailer");
  try {
    await sendInviteBack(email);
  } catch {
    redirect("/am/signups?invite=failed");
  }
  await repo.recordInvite(actor.displayName, email);
  revalidatePath("/am/signups");
  redirect("/am/signups?invite=sent");
}

// ── CRM without sending ───────────────────────────────────────

const leadLang = (fd: FormData) => (String(fd.get("lang") ?? "ar") === "en" ? "en" : "ar");

/** Adds one person by hand: the CRM works for people found anywhere. */
export async function createLeadAction(formData: FormData): Promise<void> {
  const { cleanLead } = await import("./crm");
  const account = await currentAccount();
  const lang = leadLang(formData);
  const lead = cleanLead(Object.fromEntries(formData));
  if (!lead) redirect(`/leads/new?lang=${lang}&missing=1`);
  const [id] = await repo.createManualLeads(account.id, [lead], "manual");
  revalidatePath("/leads");
  redirect(`/leads/${id}?lang=${lang}`);
}

/** Imports a sheet (CSV pasted or uploaded). */
export async function importLeadsAction(formData: FormData): Promise<void> {
  const { leadsFromCsv } = await import("./crm");
  const account = await currentAccount();
  const lang = leadLang(formData);
  const file = formData.get("file");
  const text = file && typeof file === "object" && "text" in file && (file as File).size > 0
    ? (await (file as File).text()).slice(0, 2_000_000)
    : String(formData.get("csv") ?? "").slice(0, 2_000_000);
  const { leads, skipped } = leadsFromCsv(text);
  if (leads.length === 0) redirect(`/leads/import?lang=${lang}&none=1&skipped=${skipped}`);
  await repo.createManualLeads(account.id, leads, "import");
  revalidatePath("/leads");
  redirect(`/leads?lang=${lang}&imported=${leads.length}&skipped=${skipped}`);
}

/** Stage, next step, tags, phone, value, email — whatever the form carries. */
export async function updateLeadAction(formData: FormData): Promise<void> {
  const { STAGES, cleanTags } = await import("./crm");
  const account = await currentAccount();
  const leadId = String(formData.get("leadId") ?? "");
  const lang = leadLang(formData);
  const stage = String(formData.get("stage") ?? "");
  if (STAGES.includes(stage as never)) await repo.setLeadStage(account.id, leadId, stage as (typeof STAGES)[number]);
  const patch: Parameters<typeof repo.updateLeadDetails>[2] = {};
  if (formData.has("tags")) patch.tags = cleanTags(formData.get("tags"));
  if (formData.has("nextStep")) patch.nextStep = String(formData.get("nextStep")).trim().slice(0, 200) || null;
  if (formData.has("nextStepAt")) {
    const d = String(formData.get("nextStepAt"));
    patch.nextStepAt = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T06:00:00.000Z`).toISOString() : null;
  }
  if (formData.has("phone")) patch.phone = String(formData.get("phone")).replace(/[^\d+\s()-]/g, "").slice(0, 40) || null;
  if (formData.has("value")) { const v = Number(String(formData.get("value")).replace(/[^\d]/g, "")); patch.value = v > 0 ? v : null; }
  if (formData.has("email")) { const e = String(formData.get("email")).trim().toLowerCase(); patch.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null; }
  if (Object.keys(patch).length) await repo.updateLeadDetails(account.id, leadId, patch);
  revalidatePath(`/leads/${leadId}`); revalidatePath("/leads");
  const back = String(formData.get("back") ?? "");
  redirect(back.startsWith("/leads") ? back : `/leads/${leadId}?lang=${lang}`);
}

/** Logs a call, meeting, note, or a message sent outside intro. */
export async function logActivityAction(formData: FormData): Promise<void> {
  const { ACTIVITY_KINDS } = await import("./crm");
  const account = await currentAccount();
  const leadId = String(formData.get("leadId") ?? "");
  const kind = String(formData.get("kind") ?? "note");
  const body = String(formData.get("body") ?? "").trim();
  if (body && ACTIVITY_KINDS.includes(kind as never)) await repo.logActivity(account.id, leadId, kind as (typeof ACTIVITY_KINDS)[number], body);
  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}?lang=${leadLang(formData)}#activity`);
}
