"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit, id, mutate } from "./store";
import { canSend, poolFor } from "./gate";
import { balanceOf, entry } from "./credits";
import { currentAccount } from "./session";
import { assertDevTools } from "./env";
import { parseRows, type ParsedRow } from "./parse";
import { extractBrief } from "./intent";
import { canApprove, generateDraft } from "./sourcing";
import type {
  Channel,
  Db,
  ItemStatus,
  OutreachStatus,
  Person,
  Pipeline,
  PipelineSource,
} from "./types";

const AM_NAME = "ريم";
const SLA_HOURS = 24;

export async function createRequest(formData: FormData): Promise<void> {
  const rawText = String(formData.get("rawText") ?? "").trim();
  if (!rawText) return;

  const brief = await extractBrief(rawText);
  const requestId = id("req");
  const now = new Date();

  mutate((db) => {
    db.requests.unshift({
      id: requestId,
      requesterName: "فيصل",
      requesterInitial: "F",
      rawText,
      status: "intent_review",
      brief,
      assignedAm: AM_NAME,
      createdAt: now.toISOString(),
      dueAt: new Date(now.getTime() + SLA_HOURS * 3600_000).toISOString(),
    });
    audit(db, "فيصل", requestId, "request.created", `عبر ${brief.extractedBy}`);
  });

  redirect(`/requests/${requestId}/confirm`);
}

export async function confirmBrief(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId"));
  const summary = String(formData.get("summaryAr") ?? "").trim();

  mutate((db) => {
    const req = db.requests.find((r) => r.id === requestId);
    if (!req || !req.brief) return;
    if (summary) req.brief.summaryAr = summary;
    req.status = "in_sourcing";
    req.confirmedAt = new Date().toISOString();

    const items = generateDraft(req.brief, db.people);
    db.pipelines.push({
      id: id("pl"),
      requestId,
      version: 1,
      source: "ai_generated",
      status: "draft",
      createdBy: "AI",
      createdAt: new Date().toISOString(),
      items: items.map((it) => ({ ...it, id: id("it") })),
    });
    audit(db, "فيصل", requestId, "brief.confirmed", `مسودة آلية بـ${items.length} أشخاص`);
  });

  revalidatePath("/am");
  redirect(`/requests/${requestId}`);
}

export async function setItemStatus(formData: FormData): Promise<void> {
  const pipelineId = String(formData.get("pipelineId"));
  const itemId = String(formData.get("itemId"));
  const status = String(formData.get("status")) as ItemStatus;

  mutate((db) => {
    const pl = db.pipelines.find((p) => p.id === pipelineId);
    const item = pl?.items.find((i) => i.id === itemId);
    if (!pl || !item) return;
    if (status === "approved" && !canApprove(item)) return;
    item.status = item.status === status ? "proposed" : status;
    audit(db, AM_NAME, pl.requestId, `item.${item.status}`, item.personId);
  });

  revalidatePath("/am/requests/[id]", "page");
}

export async function publishPipeline(formData: FormData): Promise<void> {
  const pipelineId = String(formData.get("pipelineId"));

  const requestId = mutate((db) => {
    const pl = db.pipelines.find((p) => p.id === pipelineId);
    if (!pl) return null;
    if (!pl.items.some((i) => i.status === "approved")) return null;
    publish(db, pl);
    audit(db, AM_NAME, pl.requestId, "pipeline.published", `النسخة ${pl.version}`);
    return pl.requestId;
  });

  if (!requestId) return;
  revalidatePath("/am");
  redirect(`/am/requests/${requestId}/published`);
}

/**
 * Publishing keeps only the rows the account manager actually approved, and
 * supersedes every other version so exactly one is published per request.
 * Rows left `proposed` — including ones blocked for missing evidence — are
 * dropped rather than silently approved.
 */
function publish(db: Db, pl: Pipeline): void {
  pl.items = pl.items.filter((i) => i.status === "approved");
  pl.items.forEach((i, idx) => {
    i.rank = idx + 1;
  });
  pl.status = "published";
  pl.publishedAt = new Date().toISOString();
  for (const other of db.pipelines) {
    if (other.requestId === pl.requestId && other.id !== pl.id && other.status !== "superseded") {
      other.status = "superseded";
    }
  }
  const req = db.requests.find((r) => r.id === pl.requestId);
  if (req && req.status === "in_sourcing") req.status = "pipeline_ready";
}

export async function attachPipeline(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId"));
  const source = String(formData.get("source")) as PipelineSource;
  const listId = String(formData.get("listId") ?? "");
  const text = String(formData.get("rows") ?? "");

  mutate((db) => {
    const req = db.requests.find((r) => r.id === requestId);
    if (!req) return;

    let personIds: string[] = [];

    if (source === "from_list") {
      personIds = db.lists.find((l) => l.id === listId)?.personIds ?? [];
    } else {
      for (const row of parseRows(text)) {
        const existing = matchPerson(db.people, row);
        if (existing) {
          personIds.push(existing.id);
          continue;
        }
        const created: Person = {
          id: id("p"),
          latin: row.latin,
          firstAr: row.latin.split(" ")[0] ?? row.latin,
          title: row.title,
          company: row.company,
          geo: "—",
          industries: [],
          seniority: "unknown",
          linkedinUrl: row.linkedinUrl,
          email: row.email,
          emailVerified: Boolean(row.email),
          openToIntros: false,
          source: source === "imported_csv" ? "import" : "am",
        };
        db.people.push(created);
        personIds.push(created.id);
      }
    }

    if (personIds.length === 0) return;

    const version = Math.max(0, ...db.pipelines.filter((p) => p.requestId === requestId).map((p) => p.version)) + 1;
    const pipeline: Pipeline = {
      id: id("pl"),
      requestId,
      version,
      source,
      status: "draft",
      createdBy: AM_NAME,
      createdAt: new Date().toISOString(),
      items: personIds.map((personId, idx) => ({
        id: id("it"),
        personId,
        rank: idx + 1,
        fit: "medium",
        thin: false,
        why: "أضافها مدير الحساب بعد مراجعة الطلب.",
        whyNow: "—",
        roleRelevance: "—",
        companyRelevance: "—",
        timing: "—",
        leadWith: "—",
        avoid: "—",
        opener: "",
        channel: (db.people.find((p) => p.id === personId)?.emailVerified ? "email" : "linkedin") as Channel,
        status: "approved",
        evidence: [
          {
            url: "",
            title: "بناها مدير الحساب يدويًا",
            source: sourceLabel(source),
            date: "اليوم",
            assertedBy: "am",
          },
        ],
        generatedBy: "am",
      })),
    };
    db.pipelines.push(pipeline);
    audit(db, AM_NAME, requestId, "pipeline.attached", `النسخة ${version} من ${sourceLabel(source)}`);
  });

  // An attached list lands back in review rather than going straight to the
  // requester: rows arrive pre-approved so publishing is one click, but the AM
  // still gets the chance to write the reasoning that makes a list worth more
  // than a list of names.
  revalidatePath("/am");
  redirect(`/am/requests/${requestId}`);
}

function sourceLabel(source: PipelineSource): string {
  return source === "imported_csv"
    ? "ملف مرفوع"
    : source === "pasted"
      ? "صفوف ملصقة"
      : source === "from_list"
        ? "قائمة جاهزة"
        : "يدوي";
}

/** Dedupe on LinkedIn URL, then email, then name+company. */
function matchPerson(people: Person[], row: ParsedRow): Person | undefined {
  const norm = (s?: string) => s?.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return people.find(
    (p) =>
      (row.linkedinUrl && norm(p.linkedinUrl) === norm(row.linkedinUrl)) ||
      (row.email && p.email?.toLowerCase() === row.email.toLowerCase()) ||
      (p.latin.toLowerCase() === row.latin.toLowerCase() && p.company === row.company),
  );
}

export interface SendResult {
  ok: boolean;
  reason?: string;
}

/**
 * The only path to an outreach record. Everything runs through canSend() — no
 * provider is ever reached without an `allowed` verdict, and both verdicts are
 * written to send_attempts so refusals are auditable too.
 */
export async function markOutreach(
  _prev: SendResult | undefined,
  formData: FormData,
): Promise<SendResult> {
  const requestId = String(formData.get("requestId"));
  const personId = String(formData.get("personId"));
  const channel = String(formData.get("channel")) as Channel;
  const body = String(formData.get("body") ?? "");

  const result = mutate<SendResult>((db) => {
    const account = currentAccount(db);
    const verdict = canSend(db, { accountId: account.id, requestId, personId, channel, body });

    db.sendAttempts.push({
      id: id("sa"),
      accountId: account.id,
      requestId,
      personId,
      pool: verdict.pool,
      channel,
      body,
      variantHash: verdict.variantHash,
      result: verdict.allowed ? "allowed" : "refused",
      gateFailures: verdict.failures,
      at: new Date().toISOString(),
    });

    if (!verdict.allowed) {
      audit(db, account.displayName, requestId, "send.refused", verdict.failures.join(","));
      return { ok: false, reason: verdict.reason };
    }

    db.ledger.push(entry(account.id, "send", personId, id("le")));

    const existing = db.outreach.find((o) => o.requestId === requestId && o.personId === personId);
    if (existing) {
      existing.status = "sent";
      existing.channel = channel;
      existing.updatedAt = new Date().toISOString();
    } else {
      db.outreach.push({
        requestId,
        personId,
        channel,
        status: "sent",
        updatedAt: new Date().toISOString(),
      });
    }

    const req = db.requests.find((r) => r.id === requestId);
    if (req && req.status === "pipeline_ready") req.status = "outreach";
    audit(db, account.displayName, requestId, "send.allowed", `${poolFor(channel)}:${personId}`);
    return { ok: true };
  });

  revalidatePath(`/requests/${requestId}`);
  return result;
}

/**
 * Dev-only: there is no auth or billing yet, so the send gate is unreachable
 * without a way to verify the account and grant it credits. Milestone 1 and 5
 * replace this with real verification and a PSP.
 */
export async function devVerifyAndGrant(formData: FormData): Promise<void> {
  assertDevTools("Verifying an account and granting credits");
  const requestId = String(formData.get("requestId"));
  mutate((db) => {
    const account = currentAccount(db);
    account.state = "verified";
    account.verifiedAt = new Date().toISOString();
    if (balanceOf(db, account.id) < 5) {
      db.ledger.push(entry(account.id, "grant", "dev", id("le"), 5));
    }
    audit(db, "dev", account.id, "account.verified", "dev grant of 5 credits");
  });
  revalidatePath(`/requests/${requestId}`);
}
