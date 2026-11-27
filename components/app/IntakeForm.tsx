"use client";

import { useMemo, useState } from "react";
import { Icon, cx, type IconKey } from "@/components/site/ui";
import { GOALS, sectorLabel, suggestedRoles, type IntakePicks } from "@/lib/intake";
import { DICTIONARY } from "@/lib/search/dictionary";
import type { GoalType } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";

type Lang = "ar" | "en";

const T = {
  en: {
    goal: "What are you after?", sector: "Which sectors?", sectorHint: "Pick up to 3. Can't find yours? Type it and press Enter.",
    find: "Search sectors…", add: (s: string) => `Add “${s}”`, who: "Who do you want to reach?", whoHint: "Suggested for your goal and sectors — tap to choose. Add your own if it's missing.",
    addRole: "Another role…", notes: "Anything else we should know?", optional: "optional",
    notesPh: "e.g. what you sell or offer, company size you prefer, who you already know there",
    market: "Market", saudi: "Saudi Arabia", go: "Continue", going: "Preparing your brief…",
    needSector: "Pick at least one sector.", noRoles: "None picked — we'll use the suggested roles.",
  },
  ar: {
    goal: "وش تدوّر عليه؟", sector: "في أي قطاع؟", sectorHint: "اختر حتى ٣. ما لقيت قطاعك؟ اكتبه واضغط Enter.",
    find: "ابحث عن قطاع…", add: (s: string) => `أضف «${s}»`, who: "مين تبي توصل له؟", whoHint: "مقترحة حسب هدفك وقطاعاتك، اضغط لتختار. وأضف منصبًا إذا ما لقيته.",
    addRole: "منصب ثاني…", notes: "تبي تضيف شيئًا؟", optional: "اختياري",
    notesPh: "مثال: وش تبيع أو تقدّم، حجم الشركات اللي تفضله، أو مين تعرف هناك",
    market: "السوق", saudi: "السعودية", go: "متابعة", going: "نجهّز الملخص…",
    needSector: "اختر قطاعًا واحدًا على الأقل.", noRoles: "ما اخترت، بنستخدم المناصب المقترحة.",
  },
};

const norm = (s: string) => s.toLowerCase().replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").replace(/^ال/, "").trim();

export function IntakeForm({ lang, action, initial, requestId }: {
  lang: Lang; action: (fd: FormData) => Promise<void>; initial: IntakePicks; requestId?: string;
}) {
  const t = T[lang];
  const [goal, setGoal] = useState<GoalType>(initial.goal);
  const [sectors, setSectors] = useState<string[]>(initial.sectors);
  const [roles, setRoles] = useState<string[]>(initial.roles);
  const [query, setQuery] = useState("");
  const [roleDraft, setRoleDraft] = useState("");
  const [tried, setTried] = useState(false);

  const matches = useMemo(() => {
    const q = norm(query);
    if (!q) return DICTIONARY.slice(0, 12);
    // Sector names and synonyms first; a sub-sector hit («تقنية التأمين») after.
    const byName = DICTIONARY.filter((d) => [d.ar, d.en, ...d.synonymsAr].some((w) => norm(w).includes(q)));
    const bySub = DICTIONARY.filter((d) => !byName.includes(d) && d.sub.some((s) => norm(`${s.ar} ${s.en}`).includes(q)));
    // An exact name («التقنية» → Technology) before one that merely contains it.
    const exact = (d: (typeof DICTIONARY)[number]) => [d.ar, d.en, ...d.synonymsAr].some((w) => norm(w) === q) ? 0 : 1;
    return [...byName.sort((a, b) => exact(a) - exact(b)), ...bySub];
  }, [query]);

  const dictIds = sectors.filter((s) => !s.startsWith("custom:"));
  const roleOptions = suggestedRoles(goal, dictIds);
  const customRoles = roles.filter((r) => r.startsWith("custom:"));

  const toggleSector = (id: string) => setSectors((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id]));
  const toggleRole = (title: string) => setRoles((cur) => (cur.includes(title) ? cur.filter((x) => x !== title) : [...cur, title]));
  const addCustomSector = () => {
    const v = query.trim();
    if (!v) return;
    const hit = matches.length === 1 ? matches[0].id : null;
    toggleSector(hit ?? `custom:${v}`);
    setQuery("");
  };
  const addCustomRole = () => {
    const v = roleDraft.trim();
    if (v && !roles.includes(`custom:${v}`)) setRoles((cur) => [...cur, `custom:${v}`]);
    setRoleDraft("");
  };

  const chip = (on: boolean) => cx(
    "flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors",
    on ? "bg-brand text-white" : "bg-white text-ink outline outline-1 -outline-offset-1 outline-line hover:bg-surface",
  );

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (sectors.length > 0) return;
        e.preventDefault();
        // No sector picked but a sentence written in the box below: send that
        // instead of silently doing nothing (both buttons read «متابعة»).
        const sentence = document.querySelector<HTMLTextAreaElement>("textarea[name=rawText]");
        if (sentence?.value.trim()) { sentence.form?.requestSubmit(); return; }
        setTried(true);
      }}
      className="flex flex-col gap-7"
    >
      {requestId && <input type="hidden" name="requestId" value={requestId} />}
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="goal" value={goal} />
      <input type="hidden" name="sectors" value={JSON.stringify(sectors)} />
      <input type="hidden" name="roles" value={JSON.stringify(roles)} />

      {/* 1 — goal */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-ink"><span className="text-subtle">1 · </span>{t.goal}</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {GOALS.map((g) => (
            <button key={g.id} type="button" data-testid={`goal-${g.id}`} aria-pressed={goal === g.id}
              onClick={() => { setGoal(g.id); setRoles((cur) => cur.filter((r) => r.startsWith("custom:"))); }}
              className={cx("flex cursor-pointer flex-col items-start gap-2 rounded-[16px] p-3.5 text-start transition-colors",
                goal === g.id ? "bg-mint outline outline-2 -outline-offset-2 outline-brand" : "bg-white outline outline-1 -outline-offset-1 outline-line hover:bg-surface")}>
              <Icon name={g.icon as IconKey} size={18} className={goal === g.id ? "text-brand" : "text-muted"} />
              <span className="text-[14.5px] font-semibold text-ink">{lang === "ar" ? g.ar : g.en}</span>
              <span className="text-[12px] leading-[17px] text-subtle rtl:leading-[20px]">{lang === "ar" ? g.hintAr : g.hintEn}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 2 — sectors */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-ink"><span className="text-subtle">2 · </span>{t.sector}</h2>
          <span className="text-[12.5px] text-subtle">{t.sectorHint}</span>
        </div>
        {sectors.length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid="picked-sectors">
            {sectors.map((s) => (
              <button key={s} type="button" onClick={() => toggleSector(s)} className={chip(true)}>
                {sectorLabel(s, lang)}<Icon name="x" size={12} />
              </button>
            ))}
          </div>
        )}
        <input
          value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.find} dir="auto" data-testid="sector-search"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSector(); } }}
          className="h-11 w-full rounded-[12px] bg-surface-2 px-3.5 text-[15px] text-ink outline-none placeholder:text-faint focus:outline-2 focus:outline-brand"
        />
        <div className="flex flex-wrap gap-2">
          {matches.filter((d) => !sectors.includes(d.id)).map((d) => (
            <button key={d.id} type="button" data-testid={`sector-${d.id}`} onClick={() => { toggleSector(d.id); setQuery(""); }} className={chip(false)}>
              <Icon name="plus" size={12} />{lang === "ar" ? d.ar : d.en}
            </button>
          ))}
          {query.trim() && matches.length === 0 && (
            <button type="button" onClick={addCustomSector} className={chip(false)}><Icon name="plus" size={12} />{t.add(query.trim())}</button>
          )}
        </div>
        {tried && sectors.length === 0 && <p role="alert" className="text-[13px] font-medium text-accent-ink">{t.needSector}</p>}
      </section>

      {/* 3 — who */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-ink"><span className="text-subtle">3 · </span>{t.who}</h2>
          <span className="text-[12.5px] text-subtle">{t.whoHint}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {roleOptions.map((r) => (
            <button key={r.title} type="button" data-testid={`role-${r.title}`} aria-pressed={roles.includes(r.title)} onClick={() => toggleRole(r.title)} className={chip(roles.includes(r.title))}>
              {roles.includes(r.title) ? <Icon name="check" size={12} /> : <Icon name="plus" size={12} />}{lang === "ar" ? r.ar : r.en}
            </button>
          ))}
          {customRoles.map((r) => (
            <button key={r} type="button" onClick={() => toggleRole(r)} className={chip(true)}>{r.slice(7)}<Icon name="x" size={12} /></button>
          ))}
          <input
            value={roleDraft} onChange={(e) => setRoleDraft(e.target.value)} placeholder={t.addRole} dir="auto"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomRole(); } }} onBlur={addCustomRole}
            className="h-9 w-40 rounded-full bg-surface-2 px-3.5 text-[13.5px] text-ink outline-none placeholder:text-faint focus:outline-2 focus:outline-brand"
          />
        </div>
        {roles.length === 0 && <span className="text-[12.5px] text-subtle">{t.noRoles}</span>}
      </section>

      {/* 4 — context */}
      <label className="flex flex-col gap-2">
        <span className="text-[15px] font-semibold text-ink"><span className="text-subtle">4 · </span>{t.notes} <span className="text-[12.5px] font-normal text-subtle">({t.optional})</span></span>
        <textarea name="notes" rows={3} dir="auto" defaultValue={initial.notes} placeholder={t.notesPh}
          className="w-full resize-y rounded-[14px] bg-surface-2 p-3.5 text-[15px] leading-[24px] text-ink outline-none placeholder:text-faint focus:outline-2 focus:outline-brand" />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <span className="flex items-center gap-1.5 text-[13px] text-subtle"><Icon name="globe" size={14} />{t.market}: {t.saudi}</span>
        <SubmitButton pending={t.going} icon="arrow-right" testId="create-request">{t.go}</SubmitButton>
      </div>
    </form>
  );
}
