"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extractBrief } from "./intent";
import { parseRows } from "./parse";
import * as repo from "./db/repo";
import { currentAccount, requireAccountManager, requireAdmin, requireRequestOwner } from "./session";
import { assertDevTools } from "./env";
import { logUsage } from "./usage";
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
  await requireRequestOwner(requestId, "confirm this request");

  await repo.confirmBrief(requestId, summary || undefined);

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
 * a transaction that locks the account row, so no provider is ever reached
 * without an allowed verdict and no two sends can spend the same credit.
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

  const result = await repo.recordSend({
    accountId: account.id,
    requestId,
    personId: String(formData.get("personId")),
    channel: String(formData.get("channel")) as Channel,
    body: String(formData.get("body") ?? ""),
    actor: account.displayName,
  });

  // The gate's verdict, counted. Refusals are the interesting half: which
  // failure people hit, and how often, is what says whether the gate is
  // protecting the product or blocking it. /am/ops reads these.
  await logUsage({
    kind: result.ok ? "send_allowed" : "send_refused",
    accountId: account.id,
    meta: { requestId, reason: result.reason },
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
  // The unlock click. Today it is a dev shortcut; when billing exists the
  // button changes and this event does not, so the funnel stays comparable
  // across the change.
  await logUsage({ kind: "unlock_click", accountId: account.id, meta: { requestId, via: "dev" } });
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

  const result = await repo.verifyAndCredit({
    accountId: targetAccountId,
    amount: VERIFY_GRANT,
    ref: `admin-grant:${Number.isFinite(grants) ? grants : 0}`,
    actor: admin.displayName,
  });

  if (result.ok) {
    await logUsage({
      kind: "unlock_click",
      accountId: targetAccountId,
      meta: { via: "admin", granted: result.granted },
    });
  }

  revalidatePath("/am/team");
  if (!result.ok) redirect(`/am/team?refused=${result.reason}`);
}
