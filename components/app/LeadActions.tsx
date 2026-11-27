"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon, cx } from "@/components/site/ui";

type Lang = "ar" | "en";
type Signal = { url: string; title: string; source: string; date?: string };

const C = {
  en: {
    email: "Email", reveal: "Reveal verified email · 1 credit", revealing: "Looking up…", copy: "Copy", copied: "Copied",
    status: { valid: "Verified", risky: "Unconfirmed — may bounce", invalid: "Invalid", not_found: "We couldn't find a work email. Your credit was refunded." } as Record<string, string>,
    news: "What's happening", getNews: "Find recent news", gettingNews: "Searching news…", noNews: "No recent news found.",
    opener: "First message", openerHint: "Edit it, then copy it or open it in your email.", openMail: "Open in email", copyMsg: "Copy message",
    subject: (c: string) => `Quick question about ${c}`,
    followSubject: (c: string) => `Re: Quick question about ${c}`,
    stages: { saved: "Saved", contacted: "Contacted", replied: "Replied", meeting: "Meeting", closed: "Closed" } as Record<string, string>,
    step: { first: "First message", f1: "Follow-up 1", f2: "Last note" },
    due: (d: string) => `Due ${d}`, dueNow: "Due today", sentOn: (d: string) => `First sent ${d}`,
    openMine: "Open in my email", sentIt: "Sent it?", yesSent: "Yes, mark as sent", notYet: "Not yet", otherWay: "I sent it another way",
    replied: "They replied", meeting: "Booked a meeting", closeIt: "Not interested", reopen: "Reopen",
    done: "No reply after two follow-ups. Close it, or wait — replies often come late.",
    repliedNote: "Great — reply from your email. Mark a meeting when it's booked.", meetingNote: "Meeting booked. Good luck!", closedNote: "Closed. Reopen any time.",
    needEmail: "Reveal their email to open this in your mail app — or copy the message.",
    nextDue: (d: string) => `Next follow-up drafted for ${d}. We'll remind you.`,
    viaIntro: "Send through intro", sendingVia: "Sending…", sentVia: "Sent through intro — replies come to your email.",
    viaHint: (n: string) => `From "${n} via intro" · replies go to your email`, verifyVia: "Verify to send through intro", failedVia: "We couldn't deliver it. Try your own email.",
    errors: { insufficient_credits: "You're out of credits — top up from Billing.", unavailable: "Live data isn't connected yet.", budget: "Today's search limit is reached.", upstream: "Our providers didn't answer — try again." } as Record<string, string>,
  },
  ar: {
    email: "البريد", reveal: "اكشف البريد الموثّق · رصيد واحد", revealing: "نبحث عن البريد…", copy: "نسخ", copied: "تم النسخ",
    status: { valid: "موثّق", risky: "غير مؤكد، وقد يرتد", invalid: "غير صالح", not_found: "ما لقينا بريد عمل، واسترجعنا رصيدك." } as Record<string, string>,
    news: "وش الجديد", getNews: "ابحث عن آخر الأخبار", gettingNews: "نبحث في الأخبار…", noNews: "ما لقينا أخبارًا حديثة.",
    opener: "أول رسالة", openerHint: "عدّلها، ثم انسخها أو افتحها في بريدك.", openMail: "افتح في البريد", copyMsg: "انسخ الرسالة",
    subject: (c: string) => `سؤال سريع بخصوص ${c}`,
    followSubject: (c: string) => `رد: سؤال سريع بخصوص ${c}`,
    stages: { saved: "محفوظ", contacted: "تواصلت", replied: "ردّ", meeting: "اجتماع", closed: "مغلق" } as Record<string, string>,
    step: { first: "أول رسالة", f1: "المتابعة الأولى", f2: "آخر رسالة" },
    due: (d: string) => `موعدها ${d}`, dueNow: "موعدها اليوم", sentOn: (d: string) => `أول رسالة ${d}`,
    openMine: "افتحها في بريدي", sentIt: "أرسلتها؟", yesSent: "إيه، سجّلها مرسلة", notYet: "مو بعد", otherWay: "أرسلتها بطريقة ثانية",
    replied: "ردّ عليّ", meeting: "حجزنا اجتماع", closeIt: "مو مهتم", reopen: "أعد فتحه",
    done: "ما ردّ بعد متابعتين. أغلقه، أو انتظر، الردود أحيانًا تتأخر.",
    repliedNote: "ممتاز، كمّل الرد من بريدك. وسجّل الاجتماع إذا انحجز.", meetingNote: "انحجز الاجتماع. بالتوفيق!", closedNote: "مغلق. تقدر تعيد فتحه أي وقت.",
    needEmail: "اكشف بريده عشان تفتحها في بريدك، أو انسخ الرسالة.",
    nextDue: (d: string) => `جهّزنا المتابعة الجاية لتاريخ ${d}، وبنذكّرك.`,
    viaIntro: "أرسلها عبر انترو", sendingVia: "نرسل…", sentVia: "انرسلت عبر انترو، والردود توصل بريدك.",
    viaHint: (n: string) => `من «${n} عبر انترو» · الردود توصل بريدك`, verifyVia: "وثّق حسابك عشان ترسل عبر انترو", failedVia: "ما قدرنا نوصلها. جرّب بريدك.",
    errors: { insufficient_credits: "خلص رصيدك. اشحنه من صفحة الرصيد.", unavailable: "البيانات الحية ما تفعّلت بعد.", budget: "وصلت لحد البحث اليومي.", upstream: "مزوّدو البيانات ما ردّوا، جرّب مرة ثانية." } as Record<string, string>,
  },
};

async function post<T>(path: string): Promise<T> {
  const r = await fetch(path, { method: "POST" });
  const json = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(json.error ?? "upstream");
  return json;
}

export interface LeadCrm { stage: string; followUps: number; followUpAt: string | null; contactedAt: string | null }

export interface ViaIntro { on: boolean; eligible: boolean; paused: boolean; senderName: string }

export function LeadActions({
  lang, leadId, company, initialEmail, initialStatus, initialSignals, opener, followUps: drafts, crm, via,
}: {
  lang: Lang; leadId: string; company: string; initialEmail: string | null; initialStatus: string | null;
  initialSignals: Signal[] | null; opener: string; followUps: [string, string]; crm: LeadCrm; via?: ViaIntro;
}) {
  const t = C[lang];
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState(initialStatus);
  const [revealing, setRevealing] = useState(false);
  const [signals, setSignals] = useState<Signal[] | null>(initialSignals);
  const [loadingNews, setLoadingNews] = useState(false);
  const [state, setState] = useState<LeadCrm>(crm);
  const stepIndex = state.stage === "saved" || state.stage === "closed" && !state.contactedAt ? 0 : state.followUps + 1;
  const draftFor = (i: number) => (i === 0 ? opener : drafts[i - 1] ?? "");
  const [message, setMessage] = useState(draftFor(stepIndex));
  const [opened, setOpened] = useState(false);
  const [moving, setMoving] = useState(false);
  const [sendingVia, setSendingVia] = useState(false);
  const [viaNote, setViaNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function sendVia() {
    setSendingVia(true); setViaNote(null); setError(null);
    try {
      const r = await fetch(`/api/leads/${leadId}/send`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, body: message }) });
      const json = (await r.json().catch(() => ({}))) as LeadCrm & { sent?: boolean; reasons?: string[]; error?: string };
      if (r.ok && json.sent) {
        setState({ stage: json.stage, followUps: json.followUps, followUpAt: json.followUpAt, contactedAt: json.contactedAt });
        setMessage(draftFor(json.followUps + 1));
        setViaNote({ ok: true, text: t.sentVia });
      } else {
        setViaNote({ ok: false, text: json.reasons?.join(" ") || t.failedVia });
      }
    } catch { setViaNote({ ok: false, text: t.failedVia }); }
    finally { setSendingVia(false); }
  }

  // The Track panel and activity log are server-rendered: refresh them after
  // anything here changes the lead (this component remounts on the new stage).
  const router = useRouter();

  async function move(action: string) {
    setMoving(true); setError(null);
    try {
      const r = await fetch(`/api/leads/${leadId}/stage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const json = (await r.json().catch(() => ({}))) as LeadCrm & { error?: string };
      if (!r.ok) throw new Error(json.error ?? "upstream");
      setState(json); setOpened(false);
      const next = json.stage === "saved" ? 0 : json.followUps + 1;
      setMessage(draftFor(next));
      router.refresh();
    } catch (e) { setError(t.errors[(e as Error).message] ?? t.errors.upstream); }
    finally { setMoving(false); }
  }
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (what: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };

  async function reveal() {
    setRevealing(true); setError(null);
    try {
      const r = await post<{ email: string | null; status: string }>(`/api/leads/${leadId}/reveal`);
      setEmail(r.email); setStatus(r.status);
    } catch (e) { setError(t.errors[(e as Error).message] ?? t.errors.upstream); }
    finally { setRevealing(false); }
  }

  async function news() {
    setLoadingNews(true); setError(null);
    try {
      const r = await post<{ signals: Signal[] }>(`/api/leads/${leadId}/signals`);
      setSignals(r.signals);
    } catch (e) { setError(t.errors[(e as Error).message] ?? t.errors.upstream); }
    finally { setLoadingNews(false); }
  }

  const card = "flex flex-col gap-3 rounded-[18px] bg-white p-5 outline outline-1 -outline-offset-1 outline-line";
  const subject = stepIndex === 0 ? t.subject(company) : t.followSubject(company);
  const mailto = email ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}` : undefined;
  const day = (iso: string) => new Date(iso).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Riyadh" }); // fixed zone: server and browser must agree (hydration)
  const dueLabel = state.followUpAt ? (new Date(state.followUpAt) <= new Date() ? t.dueNow : t.due(day(state.followUpAt))) : null;
  const writing = state.stage === "saved" || (state.stage === "contacted" && state.followUps < 2 && state.followUpAt !== null);
  const stepTitle = stepIndex === 0 ? t.step.first : stepIndex === 1 ? t.step.f1 : t.step.f2;

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-[14px] text-accent-ink">{error}</p>}

      <section className={card}>
        <h2 className="text-[13px] font-semibold text-subtle">{t.email}</h2>
        {email ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-latin text-[17px] font-semibold text-ink" dir="ltr">{email}</span>
            <span className={cx("rounded-full px-2.5 py-1 text-[11.5px] font-medium", status === "valid" ? "bg-success-soft text-success-ink" : "bg-sand text-ink-2")}>{t.status[status ?? "risky"]}</span>
            <button type="button" onClick={() => copy("email", email)} className="cursor-pointer text-[13px] font-medium text-brand">{copied === "email" ? t.copied : t.copy}</button>
          </div>
        ) : (
          <>
            {status === "not_found" && <p className="text-[13.5px] text-muted">{t.status.not_found}</p>}
            <button type="button" disabled={revealing} onClick={() => void reveal()} className="flex h-11 w-fit cursor-pointer items-center gap-2 rounded-full bg-brand px-5 text-[14.5px] font-medium text-white hover:bg-brand-2 disabled:opacity-60">
              <Icon name="mail" size={15} />{revealing ? t.revealing : t.reveal}
            </button>
          </>
        )}
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold text-subtle">{t.news}</h2>
          <button type="button" disabled={loadingNews} onClick={() => void news()} className="cursor-pointer text-[13px] font-medium text-brand disabled:text-subtle">
            {loadingNews ? t.gettingNews : t.getNews}
          </button>
        </div>
        {signals && (signals.length ? (
          <ul className="flex flex-col gap-1.5">
            {signals.map((n) => (
              <li key={n.url}>
                <a href={n.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[12px] bg-surface-2 px-3.5 py-2.5 hover:bg-surface">
                  <Icon name="file-text" size={14} className="text-brand" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink" dir="auto">{n.title}</span>
                  <span className="shrink-0 font-latin text-[12px] text-subtle" dir="ltr">{n.source}{n.date ? ` · ${n.date}` : ""}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : <p className="text-[13.5px] text-muted">{t.noNews}</p>)}
      </section>

      <section className={card} data-testid="conversation">
        <ol className="flex flex-wrap items-center gap-1.5" aria-label={t.stages.contacted}>
          {(["saved", "contacted", "replied", "meeting"] as const).map((st, i, all) => {
            const at = all.indexOf(state.stage as (typeof all)[number]);
            const on = st === state.stage;
            const done = at > i;
            return (
              <li key={st} className="flex items-center gap-1.5">
                <span className={cx("rounded-full px-3 py-1 text-[12.5px] font-medium", on ? "bg-brand text-white" : done ? "bg-mint text-brand" : "bg-surface text-subtle")}>{t.stages[st]}</span>
                {i < all.length - 1 && <span className="h-px w-3 bg-line" />}
              </li>
            );
          })}
          {state.stage === "closed" && <li><span className="rounded-full bg-surface px-3 py-1 text-[12.5px] font-medium text-ink-2">{t.stages.closed}</span></li>}
        </ol>

        {writing ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-ink">{stepTitle}</h2>
              <span className="text-[12.5px] text-subtle">{stepIndex > 0 && dueLabel ? dueLabel : t.openerHint}</span>
            </div>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} dir="auto" data-testid="draft"
              className="w-full rounded-xl bg-surface-2 p-3.5 text-[14.5px] leading-[23px] text-ink [unicode-bidi:plaintext] outline-none focus:outline-2 focus:outline-brand" />
            {!email && <p className="text-[12.5px] text-subtle">{t.needEmail}</p>}
            {opened ? (
              <div className="flex flex-wrap items-center gap-2 rounded-[14px] bg-mint px-3.5 py-2.5">
                <span className="text-[14px] font-medium text-ink">{t.sentIt}</span>
                <button type="button" disabled={moving} data-testid="mark-sent" onClick={() => void move("sent")} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-brand px-4 text-[13.5px] font-medium text-white hover:bg-brand-2 disabled:opacity-60"><Icon name="check" size={13} />{t.yesSent}</button>
                <button type="button" onClick={() => setOpened(false)} className="h-9 cursor-pointer rounded-full px-3 text-[13.5px] font-medium text-muted hover:text-ink">{t.notYet}</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {mailto && (
                  <a href={mailto} onClick={() => setOpened(true)} data-testid="open-mail" className="flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-[13.5px] font-medium text-white hover:bg-brand-2">
                    <Icon name="send" size={14} flip />{t.openMine}
                  </a>
                )}
                <button type="button" onClick={() => copy("msg", message)} className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-surface px-4 text-[13.5px] font-medium text-ink hover:bg-hover">
                  {copied === "msg" ? t.copied : t.copyMsg}
                </button>
                <button type="button" onClick={() => setOpened(true)} className="h-10 cursor-pointer px-2 text-[13px] font-medium text-muted hover:text-ink">{t.otherWay}</button>
              </div>
            )}
            {via?.on && email && !opened && (
              <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-3">
                {via.eligible && !via.paused ? (
                  <>
                    <button type="button" disabled={sendingVia} data-testid="send-intro" onClick={() => void sendVia()} className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 text-[13.5px] font-medium text-white hover:opacity-90 disabled:opacity-60">
                      <Icon name="send" size={14} flip />{sendingVia ? t.sendingVia : t.viaIntro}
                    </button>
                    <span className="text-[12.5px] text-subtle">{t.viaHint(via.senderName)}</span>
                  </>
                ) : via.paused ? null : (
                  <a href={`/activate?lang=${lang}`} className="text-[13px] font-medium text-brand">{t.verifyVia}</a>
                )}
              </div>
            )}
            {viaNote && <p role="status" data-testid="via-note" className={cx("rounded-xl px-3.5 py-2.5 text-[13.5px]", viaNote.ok ? "bg-success-soft text-success-ink" : "bg-accent-soft text-accent-ink")}>{viaNote.text}</p>}
          </>
        ) : (
          <p className="text-[14px] leading-[22px] text-ink-2">
            {state.stage === "replied" ? t.repliedNote : state.stage === "meeting" ? t.meetingNote : state.stage === "closed" ? t.closedNote : t.done}
          </p>
        )}

        {state.contactedAt && (
          <p className="text-[12.5px] text-subtle">
            {t.sentOn(day(state.contactedAt))}{state.stage === "contacted" && state.followUpAt && stepIndex > 0 && !opened ? ` · ${t.nextDue(day(state.followUpAt))}` : ""}
          </p>
        )}

        {state.stage !== "saved" && (
          <div className="flex flex-wrap gap-2 border-t border-line-2 pt-3">
            {state.stage === "contacted" && <button type="button" disabled={moving} data-testid="mark-replied" onClick={() => void move("replied")} className="h-9 cursor-pointer rounded-full bg-success-soft px-3.5 text-[13px] font-medium text-success-ink">{t.replied}</button>}
            {(state.stage === "contacted" || state.stage === "replied") && <button type="button" disabled={moving} onClick={() => void move("meeting")} className="h-9 cursor-pointer rounded-full bg-mint px-3.5 text-[13px] font-medium text-brand">{t.meeting}</button>}
            {state.stage !== "closed" && state.stage !== "meeting" && <button type="button" disabled={moving} onClick={() => void move("closed")} className="h-9 cursor-pointer rounded-full bg-surface px-3.5 text-[13px] font-medium text-ink-2">{t.closeIt}</button>}
            {state.stage === "closed" && <button type="button" disabled={moving} onClick={() => void move("reopen")} className="h-9 cursor-pointer rounded-full bg-surface px-3.5 text-[13px] font-medium text-ink-2">{t.reopen}</button>}
          </div>
        )}
      </section>
    </div>
  );
}
