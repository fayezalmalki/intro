/**
 * The CRM without sending: adding people by hand or from a sheet, and the
 * vocabulary for stages and logged activity. Pure — parsed and validated here,
 * stored by lib/db/repo.ts.
 */

export const STAGES = ["saved", "contacted", "replied", "meeting", "closed"] as const;
export type Stage = (typeof STAGES)[number];
export const ACTIVITY_KINDS = ["note", "call", "meeting", "email", "message"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const STAGE_LABEL: Record<Stage, { en: string; ar: string }> = {
  saved: { en: "Saved", ar: "محفوظ" },
  contacted: { en: "Contacted", ar: "تواصلت" },
  replied: { en: "Replied", ar: "ردّ" },
  meeting: { en: "Meeting", ar: "اجتماع" },
  closed: { en: "Closed", ar: "مغلق" },
};
export const ACTIVITY_LABEL: Record<ActivityKind | "stage" | "created", { en: string; ar: string }> = {
  note: { en: "Note", ar: "ملاحظة" },
  call: { en: "Call", ar: "مكالمة" },
  meeting: { en: "Meeting", ar: "اجتماع" },
  email: { en: "Email (sent elsewhere)", ar: "بريد (من خارج انترو)" },
  message: { en: "LinkedIn / WhatsApp", ar: "لينكدإن / واتساب" },
  stage: { en: "Stage", ar: "المرحلة" },
  created: { en: "Added", ar: "أُضيف" },
};

export interface ManualLead {
  name: string; company: string; title?: string; email?: string; phone?: string;
  linkedinUrl?: string; tags?: string[]; note?: string; stage?: Stage; value?: number;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export function cleanTags(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : String(v ?? "").split(/[,،;|]/);
  const parts = raw.flatMap((t) => String(t).split("|"));
  return [...new Set(parts.map((t) => clip(t, 30)).filter(Boolean))].slice(0, 8);
}

/** A LinkedIn profile URL, normalized, or undefined. */
export function cleanLinkedin(v: unknown): string | undefined {
  const s = clip(v, 300);
  const m = s.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  return m ? `https://www.linkedin.com/in/${m[1].toLowerCase()}` : undefined;
}

/** Validates one hand-entered or imported row; null when it can't be a lead. */
export function cleanLead(input: Record<string, unknown>): ManualLead | null {
  const name = clip(input.name, 120);
  const company = clip(input.company, 120);
  if (!name || !company) return null;
  const email = clip(input.email, 200).toLowerCase();
  const stage = STAGES.find((s) => s === clip(input.stage, 20).toLowerCase() || STAGE_LABEL[s].ar === clip(input.stage, 20));
  const value = Number(String(input.value ?? "").replace(/[^\d.]/g, ""));
  return {
    name, company,
    title: clip(input.title, 160) || undefined,
    email: EMAIL.test(email) ? email : undefined,
    phone: clip(input.phone, 40).replace(/[^\d+\s()-]/g, "") || undefined,
    linkedinUrl: cleanLinkedin(input.linkedin ?? input.linkedinUrl),
    tags: cleanTags(input.tags),
    note: clip(input.note, 1000) || undefined,
    stage: stage ?? "saved",
    value: Number.isFinite(value) && value > 0 ? Math.round(value) : undefined,
  };
}

/** Header aliases a sheet might use, Arabic and English. */
const HEADERS: Record<string, keyof ManualLead | "linkedin"> = {
  name: "name", "full name": "name", "الاسم": "name",
  company: "company", organization: "company", "الشركة": "company", "الجهة": "company",
  title: "title", "job title": "title", position: "title", "المنصب": "title",
  email: "email", "e-mail": "email", "البريد": "email",
  phone: "phone", mobile: "phone", "الجوال": "phone", "الهاتف": "phone",
  linkedin: "linkedin", "linkedin url": "linkedin", "لينكدإن": "linkedin",
  tags: "tags", "الوسوم": "tags", note: "note", notes: "note", "ملاحظة": "note", "ملاحظات": "note",
  stage: "stage", "المرحلة": "stage", value: "value", "القيمة": "value",
};

/** RFC-4180-ish CSV: quoted fields, doubled quotes, commas/newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let f = ""; let q = false;
  const s = text.replace(/^﻿/, "");
  // The separator is whichever the header row uses most (Excel in Arabic locales writes ";").
  const head = s.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].map((c) => [c, head.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(f); f = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else f += c;
  }
  row.push(f);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** A sheet → valid leads, plus how many rows were skipped. At most `max` rows. */
export function leadsFromCsv(text: string, max = 500): { leads: ManualLead[]; skipped: number; unknownColumns: string[] } {
  const [head = [], ...body] = parseCsv(text);
  const keys = head.map((h) => HEADERS[h.trim().toLowerCase()]);
  const unknownColumns = head.filter((_, i) => !keys[i]).map((h) => h.trim()).filter(Boolean);
  const leads: ManualLead[] = []; let skipped = 0;
  for (const r of body.slice(0, max)) {
    const obj: Record<string, string> = {};
    keys.forEach((k, i) => { if (k) obj[k] = r[i] ?? ""; });
    const lead = cleanLead(obj);
    if (lead) leads.push(lead); else skipped++;
  }
  skipped += Math.max(0, body.length - max);
  return { leads, skipped, unknownColumns };
}
