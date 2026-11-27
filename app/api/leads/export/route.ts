import * as repo from "@/lib/db/repo";
import { apiAccount } from "@/lib/search/http";

export const dynamic = "force-dynamic";

/** One CSV cell: quoted, with quotes doubled, and formula-leading characters neutralised. */
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  // A cell starting with = + - @ runs as a formula in Excel and Sheets.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * GET → the account's saved leads as CSV, for their own CRM or sheet.
 * Free: everything in it was already unlocked. Only verified or found emails
 * are included; locked ones stay blank. Exported people are never contacted.
 */
export async function GET(request: Request) {
  const account = await apiAccount(request);
  if (account instanceof Response) return account;
  const rows = await repo.listLeads(account.id);
  // Headers the importer reads back (lib/crm.ts), so an export round-trips.
  const header = ["Name", "Title", "Company", "Company domain", "Email", "Email status", "Phone", "LinkedIn", "Location", "Market",
    "Stage", "Tags", "Next step", "Next step date", "Value", "Note", "Saved"];
  const lines = rows.map((r) => [
    r.person.latin, r.person.title, r.person.company, r.person.companyDomain, r.email, r.emailStatus, r.phone,
    r.person.linkedinUrl, r.person.geo, r.market, r.stage, (r.tags ?? []).join("|"), r.nextStep, r.nextStepAt?.slice(0, 10),
    r.value, r.note, r.createdAt.slice(0, 10),
  ].map(cell).join(","));
  const csv = "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="intro-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
