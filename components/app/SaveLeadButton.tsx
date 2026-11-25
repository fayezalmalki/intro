"use client";

import { useState } from "react";
import { Icon } from "@/components/site/ui";

/** Saves a person from a request's results as a lead, then links to it. */
export function SaveLeadButton({ person, lang }: { person: { name: string; title: string; company: string; companyDomain?: string; profileUrl?: string }; lang: "ar" | "en" }) {
  const [leadId, setLeadId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (leadId) {
    return (
      <a href={`/leads/${leadId}?lang=${lang}`} className="flex h-9 items-center gap-1.5 rounded-full bg-mint px-3.5 text-[13.5px] font-medium text-brand">
        <Icon name="check" size={13} />{lang === "ar" ? "افتح العميل" : "Open lead"}
      </a>
    );
  }
  return (
    <button type="button" disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ person, market: "SA" }) });
        const json = (await r.json().catch(() => ({}))) as { leadId?: string };
        setBusy(false);
        if (json.leadId) setLeadId(json.leadId);
      }}
      className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13.5px] font-medium text-ink hover:bg-hover disabled:opacity-60"
      title={lang === "ar" ? "احفظه واكشف بريده الموثّق" : "Save, then reveal a verified email"}>
      <Icon name="plus" size={13} />{lang === "ar" ? "احفظ واكشف البريد" : "Save & get email"}
    </button>
  );
}
