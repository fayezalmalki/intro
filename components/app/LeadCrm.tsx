import { AutoSubmitSelect } from "@/components/app/AutoSubmitSelect";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Icon } from "@/components/site/ui";
import { logActivityAction, updateLeadAction } from "@/lib/actions";
import { ACTIVITY_KINDS, ACTIVITY_LABEL, STAGES, STAGE_LABEL } from "@/lib/crm";
import type { LeadRow } from "@/lib/db/repo";

type Lang = "ar" | "en";
const T = {
  en: { track: "Track", stage: "Stage", next: "Next step", nextPh: "e.g. Send the proposal", on: "On", tags: "Tags", tagsPh: "event, warm", phone: "Phone", value: "Deal value (SAR)", email: "Email", save: "Save", saving: "Saving…",
    activity: "Activity", log: "Log", logPh: "What happened? A call, a meeting, a message on LinkedIn…", empty: "Nothing logged yet. Log calls, meetings and messages — even ones you didn't send from intro." },
  ar: { track: "المتابعة", stage: "المرحلة", next: "الخطوة التالية", nextPh: "مثال: أرسل العرض", on: "بتاريخ", tags: "وسوم", tagsPh: "معرض، دافئ", phone: "الجوال", value: "قيمة الصفقة (ريال)", email: "البريد", save: "احفظ", saving: "نحفظ…",
    activity: "السجل", log: "سجّل", logPh: "وش صار؟ مكالمة، اجتماع، رسالة في لينكدإن…", empty: "ما سجّلت شيء بعد. سجّل المكالمات والاجتماعات والرسائل، حتى اللي ما أرسلتها من انترو." },
};
const input = "h-10 w-full rounded-[10px] bg-surface-2 px-3 text-[14px] text-ink outline-none placeholder:text-faint focus:outline-2 focus:outline-brand";
const label = "flex flex-col gap-1 text-[12.5px] font-medium text-subtle";

/** The lead's CRM fields: stage (moves on change), next step with a date, tags, phone, value. */
export function LeadTrack({ lang, lead }: { lang: Lang; lead: LeadRow }) {
  const t = T[lang];
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4" data-testid="lead-track">
      <h2 className="text-[14px] font-semibold text-ink">{t.track}</h2>
      <form action={updateLeadAction}>
        <input type="hidden" name="leadId" value={lead.id} /><input type="hidden" name="lang" value={lang} />
        <label className={label}>{t.stage}
          <AutoSubmitSelect name="stage" defaultValue={lead.stage} label={t.stage} className={`${input} cursor-pointer`}
            options={STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s][lang] }))} />
        </label>
      </form>
      <form action={updateLeadAction} className="flex flex-col gap-2.5">
        <input type="hidden" name="leadId" value={lead.id} /><input type="hidden" name="lang" value={lang} />
        <label className={label}>{t.next}<input name="nextStep" defaultValue={lead.nextStep ?? ""} placeholder={t.nextPh} dir="auto" className={input} /></label>
        <label className={label}>{t.on}<input name="nextStepAt" type="date" defaultValue={lead.nextStepAt?.slice(0, 10) ?? ""} className={input} /></label>
        <label className={label}>{t.tags}<input name="tags" defaultValue={(lead.tags ?? []).join(", ")} placeholder={t.tagsPh} dir="auto" className={input} /></label>
        <label className={label}>{t.phone}<input name="phone" type="tel" defaultValue={lead.phone ?? ""} dir="ltr" className={input} /></label>
        {!lead.email && <label className={label}>{t.email}<input name="email" type="email" dir="ltr" className={input} /></label>}
        <label className={label}>{t.value}<input name="value" inputMode="numeric" defaultValue={lead.value ?? ""} dir="ltr" className={input} /></label>
        <SubmitButton pending={t.saving} icon="check" testId="save-track">{t.save}</SubmitButton>
      </form>
    </section>
  );
}

/** Everything that happened with this lead, newest first, and a box to log more. */
export function LeadActivity({ lang, leadId, items }: {
  lang: Lang; leadId: string; items: { id: string; kind: string; body: string; at: string }[];
}) {
  const t = T[lang];
  const kinds = ACTIVITY_LABEL as Record<string, { en: string; ar: string }>;
  const describe = (kind: string, body: string) => {
    if (kind === "stage") {
      const [from, to] = body.split("→");
      return `${STAGE_LABEL[from as keyof typeof STAGE_LABEL]?.[lang] ?? from} → ${STAGE_LABEL[to as keyof typeof STAGE_LABEL]?.[lang] ?? to}`;
    }
    return body;
  };
  return (
    <section id="activity" className="flex flex-col gap-4 rounded-[20px] bg-white p-5 outline outline-1 -outline-offset-1 outline-line sm:p-6">
      <h2 className="text-[16px] font-semibold text-ink">{t.activity}</h2>
      <form action={logActivityAction} className="flex flex-col gap-2">
        <input type="hidden" name="leadId" value={leadId} /><input type="hidden" name="lang" value={lang} />
        <textarea name="body" rows={2} required dir="auto" placeholder={t.logPh} data-testid="activity-body"
          className="w-full rounded-[12px] bg-surface-2 p-3 text-[14.5px] text-ink outline-none placeholder:text-faint focus:outline-2 focus:outline-brand" />
        <div className="flex flex-wrap items-center gap-2">
          <select name="kind" defaultValue="note" className="h-10 cursor-pointer rounded-[10px] bg-surface-2 px-3 text-[13.5px] text-ink outline-none">
            {ACTIVITY_KINDS.map((k) => <option key={k} value={k}>{kinds[k][lang]}</option>)}
          </select>
          <SubmitButton pending="…" icon="plus" testId="log-activity">{t.log}</SubmitButton>
        </div>
      </form>
      {items.length === 0 ? <p className="text-[13.5px] text-subtle">{t.empty}</p> : (
        <ol className="flex flex-col">
          {items.map((a) => (
            <li key={a.id} className="flex gap-3 border-t border-line-2 py-3 first:border-0">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-muted">
                <Icon name={a.kind === "call" ? "reply" : a.kind === "meeting" ? "calendar-check" : a.kind === "email" ? "send" : a.kind === "stage" ? "flag" : a.kind === "created" ? "plus" : "file-text"} size={13} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[12px] text-subtle">{kinds[a.kind]?.[lang] ?? a.kind} · <span dir="ltr">{a.at.slice(0, 16).replace("T", " ")}</span></span>
                {a.kind !== "created" && <span className="whitespace-pre-wrap text-[14px] text-ink" dir="auto">{describe(a.kind, a.body)}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
