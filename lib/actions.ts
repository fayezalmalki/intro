"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extractBrief } from "./intent";
import { parseRows } from "./parse";
import * as repo from "./db/repo";
import { currentAccount, requireAccountManager } from "./session";
import { assertDevTools } from "./env";
import type { Channel, PipelineSource } from "./types";

const AM_NAME = "ريم";
const SLA_HOURS = 24;
const DEV_GRANT = 5;

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
    assignedAm: AM_NAME,
  });

  redirect(`/requests/${requestId}/confirm`);
}

export async function confirmBrief(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId"));
  const summary = String(formData.get("summaryAr") ?? "").trim();

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
  const account = await currentAccount();

  const result = await repo.recordSend({
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
