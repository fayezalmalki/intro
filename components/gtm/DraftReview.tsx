"use client";

import { useState } from "react";
import { EMAIL_STATUS_LABEL, isUsableEmail, type EmailStatus } from "@/lib/coresignal.types";
import type { DraftLang, DraftSpecific, DraftStatus } from "@/lib/types";
import { decideDraft, saveDraft, switchLang } from "@/lib/gtm/actions";

/**
 * The review screen: a person on one side, their letter on the other.
 *
 * Three rules live here and none of them is negotiable.
 *
 * **Nothing is marked sent without a provider message id.** There is no control
 * on this screen that can write `sent`. The statuses a human decision produces
 * are `approved` and `rejected`; `sent` is written by a send path that has an id
 * in hand, and `intro_drafts_sent_needs_provider_id` refuses the row otherwise.
 *
 * **Sending is off, and the screen says so** rather than offering a button that
 * quietly does nothing. What ships instead are the three deliveries that are
 * honest today: copy to clipboard, open LinkedIn, and open the user's own mail
 * client. All three put the message in the user's hands and none of them
 * pretends Intro delivered anything.
 *
 * **A guessed address is labelled and gated.** Coresignal's
 * `guessed_common_pattern` is the domain's usual pattern applied to a name —
 * a guess in the literal sense. It is shown, it is labelled unverified, and the
 * mail button stays disabled until the user ticks a box saying they understand.
 * That is the difference between disclosed and silent.
 */

export interface ReviewPerson {
  id: string;
  fullName: string;
  title: string;
  companyName: string;
  linkedinUrl: string | null;
  email: string | null;
  emailStatus: EmailStatus | null;
  isFixture: boolean;
  draft?: {
    id: string;
    subjectAr: string;
    bodyAr: string;
    subjectEn: string;
    bodyEn: string;
    lang: DraftLang;
    status: DraftStatus;
    specifics: DraftSpecific[];
    editedByUser: boolean;
    providerMessageId: string | null;
  };
}

const STATUS: Record<DraftStatus, { label: string; tone: string }> = {
  prepared: { label: "جاهزة للمراجعة", tone: "" },
  approved: { label: "معتمدة", tone: "accent" },
  rejected: { label: "مرفوضة", tone: "bad" },
  sent: { label: "أُرسلت", tone: "solid" },
};

export function DraftReview({
  runId,
  people,
  sendingEnabled,
}: {
  runId: string;
  people: ReviewPerson[];
  sendingEnabled: boolean;
}) {
  const [selectedId, setSelectedId] = useState(people[0]?.id ?? "");
  const selected = people.find((p) => p.id === selectedId) ?? people[0];

  if (!selected) {
    return (
      <div className="card stack g8">
        <strong className="sm">ما فيه أشخاص مكشوفين بعد.</strong>
        <span className="sm muted">
          ارجع لصفحة الجلسة، احفظ الأشخاص اللي تبيهم، وأكّد الكشف.
        </span>
      </div>
    );
  }

  return (
    <div className="gtm-review">
      <div className="gtm-people" role="listbox" aria-label="الأشخاص">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            role="option"
            aria-selected={p.id === selected.id}
            className={`gtm-person${p.id === selected.id ? " on" : ""}`}
            onClick={() => setSelectedId(p.id)}
          >
            <span className="stack g4">
              <span className="row between g8">
                <strong className="sm">{p.fullName}</strong>
                {p.draft && (
                  <span className={`badge${STATUS[p.draft.status].tone ? ` ${STATUS[p.draft.status].tone}` : ""}`}>
                    {STATUS[p.draft.status].label}
                  </span>
                )}
              </span>
              <span className="xs dim">
                {p.title}
                {p.companyName ? ` · ${p.companyName}` : ""}
              </span>
              <EmailBadge status={p.emailStatus} email={p.email} />
            </span>
          </button>
        ))}
      </div>

      <Letter runId={runId} person={selected} sendingEnabled={sendingEnabled} />
    </div>
  );
}

/**
 * The badge, and the whole point of storing the status rather than a boolean:
 * `matched_pattern` and `guessed_common_pattern` are both "not verified", but
 * only the second is literally a guess, and only one tone should read as a
 * warning.
 */
function EmailBadge({ status, email }: { status: EmailStatus | null; email: string | null }) {
  if (!email || !status) {
    return <span className="badge">ما فيه بريد</span>;
  }
  if (isUsableEmail(status)) {
    return <span className="badge accent">{EMAIL_STATUS_LABEL[status]}</span>;
  }
  return (
    <span className={`badge ${status === "guessed_common_pattern" ? "bad" : "warn"}`}>
      {EMAIL_STATUS_LABEL[status]}
    </span>
  );
}

function Letter({
  runId,
  person,
  sendingEnabled,
}: {
  runId: string;
  person: ReviewPerson;
  sendingEnabled: boolean;
}) {
  const draft = person.draft;
  const [lang, setLang] = useState<DraftLang>(draft?.lang ?? "ar");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [guessAccepted, setGuessAccepted] = useState(false);

  if (!draft) {
    return (
      <div className="card stack g8">
        <strong className="sm">ما فيه مسودة لهذا الشخص.</strong>
        <span className="sm muted">المسودات تُكتب بعد كشف الشخص.</span>
      </div>
    );
  }

  const subject = lang === "en" ? draft.subjectEn : draft.subjectAr;
  const body = lang === "en" ? draft.bodyEn : draft.bodyAr;

  const guessed = person.emailStatus === "guessed_common_pattern";
  const unverified = Boolean(person.email) && !isUsableEmail(person.emailStatus);
  const mailReady = Boolean(person.email) && (!unverified || guessAccepted);
  const mailto = person.email
    ? `mailto:${person.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="stack g14">
      <div className="card stack g12">
        <div className="row between wrapx g10" style={{ alignItems: "baseline" }}>
          <div className="stack g4">
            <h2>{person.fullName}</h2>
            <span className="sm muted">
              {person.title}
              {person.companyName ? ` · ${person.companyName}` : ""}
            </span>
          </div>
          <div className="seg" role="group" aria-label="لغة الرسالة">
            <button
              type="button"
              className={lang === "ar" ? "on" : ""}
              onClick={() => setLang("ar")}
            >
              عربي
            </button>
            <button
              type="button"
              className={lang === "en" ? "on" : ""}
              onClick={() => setLang("en")}
            >
              EN
            </button>
          </div>
        </div>

        {person.isFixture && (
          <div className="alert">
            صف مثال مكتوب يدويًا. ما جا من مزوّد بيانات، ولا ينفع للتواصل الحقيقي.
          </div>
        )}

        {draft.specifics.length > 0 ? (
          <div className="stack g6">
            <span className="xs dim">الرسالة تستند على هذي المعلومات، وكل وحدة من حقل معروف</span>
            <div className="row wrapx g6">
              {draft.specifics.map((s) => (
                <span key={s.field} className="gtm-specific">
                  {s.text}
                  <span className="lat dim">· {s.field}</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="stack g6">
            <span className="xs" style={{ color: "var(--warn)" }}>
              ما عندنا أي معلومة محددة عن هذا الشخص غير اسمه — فالرسالة أقصر وتعترف بذلك،
              وما تخترع سببًا للتواصل.
            </span>
          </div>
        )}

        {editing ? (
          <form action={saveDraft} className="stack g10">
            <input type="hidden" name="runId" value={runId} />
            <input type="hidden" name="draftId" value={draft.id} />
            <input type="hidden" name="lang" value={lang} />
            <input type="text" name="subject" defaultValue={subject} aria-label="الموضوع" />
            <textarea name="body" rows={14} defaultValue={body} aria-label="نص الرسالة" />
            <div className="row g8">
              <button type="submit" className="btn-primary btn-sm">
                احفظ التعديل
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
                إلغاء
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="stack g6">
              <span className="xs dim">الموضوع</span>
              <strong className={lang === "en" ? "lat" : ""}>{subject}</strong>
            </div>
            <div className={`gtm-letter${lang === "en" ? " gtm-letter-en" : ""}`}>{body}</div>
            <div className="row g8 wrapx">
              <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
                عدّل النص
              </button>
              {draft.editedByUser && <span className="chip">معدّلة منك</span>}
              <form action={switchLang}>
                <input type="hidden" name="runId" value={runId} />
                <input type="hidden" name="draftId" value={draft.id} />
                <input type="hidden" name="lang" value={lang} />
                <button type="submit" className="btn btn-sm btn-ghost">
                  خلّها اللغة الافتراضية
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      <div className="card stack g12">
        <div className="row between wrapx g10">
          <strong className="sm">القرار</strong>
          <span className={`badge${STATUS[draft.status].tone ? ` ${STATUS[draft.status].tone}` : ""}`}>
            {STATUS[draft.status].label}
          </span>
        </div>
        <div className="row g8 wrapx">
          <Decide runId={runId} draftId={draft.id} status="approved" label="اعتمد" primary />
          <Decide runId={runId} draftId={draft.id} status="rejected" label="ارفض" />
          <Decide runId={runId} draftId={draft.id} status="prepared" label="رجّعها للمراجعة" />
        </div>
        {draft.status === "sent" && (
          <span className="xs dim lat">provider message id: {draft.providerMessageId}</span>
        )}
      </div>

      <div className="card stack g12">
        <div className="stack g4">
          <strong className="sm">التوصيل</strong>
          <span className="sm muted">
            {sendingEnabled
              ? "الإرسال من Intro مفعّل."
              : "الإرسال من Intro موقوف حاليًا — البنية الخارجية ما جهزت بعد. الطرق تحت توصلك الرسالة بيدك، وما نسجّل شيء كـ«أُرسلت» إلا برقم رسالة حقيقي من المزوّد."}
          </span>
        </div>

        <div className="row g8 wrapx">
          <button type="button" className="btn btn-strong btn-sm" onClick={copy}>
            {copied ? "انتسخت ✓" : "انسخ الرسالة"}
          </button>

          {person.linkedinUrl ? (
            <a
              className="btn btn-sm"
              href={person.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              افتح LinkedIn ↗
            </a>
          ) : (
            <button type="button" className="btn btn-sm" disabled>
              ما فيه رابط LinkedIn
            </button>
          )}

          {mailReady ? (
            <a className="btn btn-sm" href={mailto}>
              افتح في بريدك ↗
            </a>
          ) : (
            <button type="button" className="btn btn-sm" disabled>
              {person.email ? "البريد غير موثّق" : "ما فيه بريد"}
            </button>
          )}

          <button type="button" className="btn btn-sm" disabled title="موقوف">
            أرسل من Intro — موقوف
          </button>
        </div>

        {unverified && (
          <label className="row g8 sm" style={{ alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={guessAccepted}
              onChange={(e) => setGuessAccepted(e.target.checked)}
              style={{ width: "auto", marginTop: 4 }}
            />
            <span style={{ color: guessed ? "var(--danger)" : "var(--warn)" }}>
              {guessed
                ? `«${person.email}» تخمين: المزوّد طبّق نمط النطاق المعتاد على الاسم، وما تحقق من الصندوق. أفهم أنها قد ترتد.`
                : `«${person.email}» غير موثّق. أفهم أنها قد ترتد.`}
            </span>
          </label>
        )}
      </div>
    </div>
  );
}

/**
 * A decision, and the reason `sent` is not in the union it accepts.
 *
 * A button that means "I like this one" must not be able to write a status that
 * means "a real message left the building".
 */
function Decide({
  runId,
  draftId,
  status,
  label,
  primary,
}: {
  runId: string;
  draftId: string;
  status: "approved" | "rejected" | "prepared";
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={decideDraft}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`btn btn-sm${primary ? " btn-primary" : ""}`}>
        {label}
      </button>
    </form>
  );
}
