"use server";

import { env } from "cloudflare:workers";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extractBrief } from "./intent";
import { parseRows } from "./parse";
import * as repo from "./db/repo";
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
