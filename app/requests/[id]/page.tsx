import { notFound } from "next/navigation";
import { AppBar, FitTag, ar } from "@/components/Chrome";
import { devVerifyAndGrant } from "@/lib/actions";
import { devToolsEnabled } from "@/lib/env";
import { SendButton } from "@/components/SendButton";
import { balanceOf } from "@/lib/credits";
import { currentAccount } from "@/lib/session";
import { loadRequestContext } from "@/lib/db/loaders";
import type { Db, OutreachStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const OUTREACH_LABEL: Record<OutreachStatus, string> = {
  none: "",
  queued: "في قائمة الإرسال",
  sent: "أُرسلت رسالتك — بانتظار الرد",
  replied: "ردّ عليك",
  accepted: "وافق على التعارف",
  declined: "اعتذر حاليًا",
};

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db: Db = await loadRequestContext(id);
  const req = db.requests.find((r) => r.id === id);
  if (!req) notFound();

  const published = db.pipelines.find((p) => p.requestId === id && p.status === "published");
  if (!published) return <Sourcing requestText={req.rawText} summary={req.brief?.summaryAr ?? ""} am={req.assignedAm} />;

  const prior = db.pipelines.filter((p) => p.requestId === id && p.version < published.version);
  const priorPeople = new Set(prior.flatMap((p) => p.items.map((i) => i.personId)));
  const byAm = published.source !== "ai_generated";
  const account = await currentAccount();
  const credits = balanceOf(db, account.id);

  return (
    <>
      <AppBar />
      <div className="wrap">
        <div className="narrow stack g20" style={{ paddingTop: 30 }}>
          {published.version > 1 && (
            <div className="note row g12" style={{ alignItems: "flex-start" }}>
              <div className="avatar" style={{ background: "#fff", borderColor: "var(--accent-line)", color: "var(--accent)" }}>
                {req.assignedAm.charAt(0)}
              </div>
              <div className="stack g4">
                <strong>
                  حدّثنا قائمتك — النسخة {ar(published.version)} من {req.assignedAm}، {byAm ? "مديرة حسابك" : "تلقائيًا"}.
                </strong>
                <span>اللي تواصلت معهم قبل، حالتهم محفوظة كما هي.</span>
              </div>
            </div>
          )}

          {account.state === "observer" ? (
            <div className="card row between g14">
              <div className="stack g4">
                <strong className="sm">حسابك يشوف القوائم، لكنه ما يرسل بعد.</strong>
                <span className="sm muted">
                  فعّل الإرسال بالتحقق من بريد العمل وحساب LinkedIn. أول رسائلك يراجعها مدير حسابك.
                </span>
              </div>
              {/* The real verification flow lands with auth. Until then the
                  shortcut exists only in development — never in a deploy. */}
              {devToolsEnabled ? (
                <form action={devVerifyAndGrant}>
                  <input type="hidden" name="requestId" value={id} />
                  <button type="submit" className="btn-strong btn-sm">
                    فعّل الإرسال
                  </button>
                </form>
              ) : (
                <span className="chip">قيد المراجعة</span>
              )}
            </div>
          ) : (
            <div className="row between sm muted" style={{ padding: "0 2px" }}>
              <span>الإرسال مفعّل · الحد اليومي {ar(account.dailyCap)}</span>
              <span>الرصيد {ar(credits)} رسالة</span>
            </div>
          )}

          <div className="row between" style={{ alignItems: "baseline" }}>
            <h2>{ar(published.items.length)} أشخاص يستحقون التواصل</h2>
            <span className="sm dim">النسخة {ar(published.version)}</span>
          </div>
          <p className="sm muted">«{req.rawText}»</p>

          {published.items.map((item) => {
            const person = db.people.find((p) => p.id === item.personId);
            if (!person) return null;
            const out = db.outreach.find((o) => o.requestId === id && o.personId === item.personId);
            const isNew = published.version > 1 && !priorPeople.has(item.personId);
            return (
              <div className="card stack g12" key={item.id}>
                <div className="row between g14" style={{ alignItems: "flex-start" }}>
                  <div className="stack g4">
                    <div className="row g8 wrapx">
                      <strong className="lat">{person.latin}</strong>
                      {isNew && <span className="chip on">جديد في النسخة {ar(published.version)}</span>}
                    </div>
                    <span className="sm muted">
                      {person.title} · {person.company}
                    </span>
                  </div>
                  <FitTag fit={item.fit} />
                </div>

                <p className="sm">{item.why}</p>

                {out && out.status !== "none" && (
                  <div className="row g8 chip" style={{ padding: "9px 12px", borderRadius: 7 }}>
                    <span className="dot" style={{ background: out.status === "sent" ? "#C9C9C2" : "#4F6B4C" }} />
                    {OUTREACH_LABEL[out.status]}
                  </div>
                )}

                <div className="row between g10" style={{ borderTop: "1px solid var(--line-3)", paddingTop: 13 }}>
                  <span className="sm dim">
                    {person.emailVerified ? "Email موثّق" : "LinkedIn"}
                    {person.openToIntros ? " · متاح للتعارف عبر Intro" : ""}
                  </span>
                  {!out || out.status === "none" ? (
                    <SendButton
                      requestId={id}
                      personId={item.personId}
                      channel={person.openToIntros ? "intro" : item.channel}
                      body={item.opener}
                      label={person.openToIntros ? "اطلب Intro" : "أرسل رسالة"}
                    />
                  ) : (
                    <span className="chip">{out.channel === "intro" ? "عبر Intro" : "تواصل مباشر"}</span>
                  )}
                </div>
              </div>
            );
          })}

          <p className="sm dim">
            الحد {ar(10)} رسائل لكل طلب، ورسالة واحدة لكل شخص. ما نرسل لأحد بدون اختيارك.
          </p>
        </div>
      </div>
    </>
  );
}

function Sourcing({ requestText, summary, am }: { requestText: string; summary: string; am: string }) {
  const steps = [
    { label: "الطلب", done: true },
    { label: "الفهم", done: true },
    { label: "التجهيز", done: true },
    { label: "النتائج", done: false },
  ];
  return (
    <>
      <AppBar />
      <div className="wrap">
        <div className="narrow stack g26" style={{ paddingTop: 40 }}>
          <div className="steps">
            {steps.map((s, i) => (
              <div className="seg" key={s.label}>
                <span className="dot" style={{ background: s.done ? "#4F6B4C" : "var(--line)" }} />
                <span className="sm" style={{ color: s.done ? "var(--ink)" : "var(--ink-3)" }}>
                  {s.label}
                </span>
                {i < steps.length - 1 && <span className="line" />}
              </div>
            ))}
          </div>

          <div className="stack g12">
            <h1>فريقنا يجهّز قائمتك.</h1>
            <p className="muted">
              فهمنا طلبك وبدأنا نبني القائمة. عادةً تجهز خلال {ar(24)} ساعة، ونرسل لك إشعارًا أول ما تصير جاهزة.
            </p>
          </div>

          <div className="card row g12">
            <div className="avatar lg">{am.charAt(0)}</div>
            <div className="grow stack g4">
              <strong className="sm">{am} تشتغل على طلبك</strong>
              <span className="sm muted">مديرة حسابك</span>
            </div>
            <span className="pill ok">قيد التجهيز</span>
          </div>

          <div className="card stack g12">
            <span className="eyebrow">طلبك</span>
            <p>«{requestText}»</p>
            {summary && <p className="sm muted" style={{ borderTop: "1px solid var(--line-3)", paddingTop: 14 }}>{summary}</p>}
          </div>

          <p className="sm dim">ما نرسل لأحد قبل ما تشوف القائمة وتوافق. أنت اللي تختار مع مين نبدأ.</p>
        </div>
      </div>
    </>
  );
}
