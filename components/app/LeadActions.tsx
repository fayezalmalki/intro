"use client";

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
    errors: { insufficient_credits: "No credits left. Activate sending to get more.", unavailable: "Live data isn't connected yet.", budget: "Today's search limit is reached.", upstream: "Our providers didn't answer — try again." } as Record<string, string>,
  },
  ar: {
    email: "البريد", reveal: "اكشف البريد الموثّق · رصيد واحد", revealing: "نبحث عن البريد…", copy: "نسخ", copied: "تم النسخ",
    status: { valid: "موثّق", risky: "غير مؤكد، وقد يرتد", invalid: "غير صالح", not_found: "ما لقينا بريد عمل، واسترجعنا رصيدك." } as Record<string, string>,
    news: "وش الجديد", getNews: "ابحث عن آخر الأخبار", gettingNews: "نبحث في الأخبار…", noNews: "ما لقينا أخبارًا حديثة.",
    opener: "أول رسالة", openerHint: "عدّلها، ثم انسخها أو افتحها في بريدك.", openMail: "افتح في البريد", copyMsg: "انسخ الرسالة",
    subject: (c: string) => `سؤال سريع بخصوص ${c}`,
    errors: { insufficient_credits: "خلص رصيدك. فعّل الإرسال عشان تحصل على رصيد إضافي.", unavailable: "البيانات الحية ما تفعّلت بعد.", budget: "وصلت لحد البحث اليومي.", upstream: "مزوّدو البيانات ما ردّوا، جرّب مرة ثانية." } as Record<string, string>,
  },
};

async function post<T>(path: string): Promise<T> {
  const r = await fetch(path, { method: "POST" });
  const json = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(json.error ?? "upstream");
  return json;
}

export function LeadActions({
  lang, leadId, company, initialEmail, initialStatus, initialSignals, opener,
}: {
  lang: Lang; leadId: string; company: string; initialEmail: string | null; initialStatus: string | null;
  initialSignals: Signal[] | null; opener: string;
}) {
  const t = C[lang];
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState(initialStatus);
  const [revealing, setRevealing] = useState(false);
  const [signals, setSignals] = useState<Signal[] | null>(initialSignals);
  const [loadingNews, setLoadingNews] = useState(false);
  const [message, setMessage] = useState(opener);
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
  const mailto = email ? `mailto:${email}?subject=${encodeURIComponent(t.subject(company))}&body=${encodeURIComponent(message)}` : undefined;

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

      <section className={card}>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[13px] font-semibold text-subtle">{t.opener}</h2>
          <span className="text-[12.5px] text-subtle">{t.openerHint}</span>
        </div>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} dir="auto"
          className="w-full rounded-xl bg-surface-2 p-3.5 text-[14.5px] leading-[23px] text-ink [unicode-bidi:plaintext] outline-none focus:outline-2 focus:outline-brand" />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy("msg", message)} className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-surface px-4 text-[13.5px] font-medium text-ink hover:bg-hover">
            {copied === "msg" ? t.copied : t.copyMsg}
          </button>
          {mailto && (
            <a href={mailto} className="flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-[13.5px] font-medium text-white hover:bg-brand-2">
              <Icon name="send" size={14} flip />{t.openMail}
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
