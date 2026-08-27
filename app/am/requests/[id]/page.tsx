import Link from "next/link";
import { notFound } from "next/navigation";
import { AmBar, FitTag, LinkIcon, Provenance, ar, Forbidden } from "@/components/Chrome";
import { publishPipeline, setItemStatus } from "@/lib/actions";
import { canApprove } from "@/lib/sourcing";
import { accountForPage } from "@/lib/session";
import { loadRequestContext } from "@/lib/db/loaders";
import type { Account, IntroRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  // Defence in depth. The actions each check the role too — that is the real
  // boundary — but a requester who reaches this URL should be told so, not
  // shown a crash page.
  const account = await accountForPage("account_manager");
  if (!account) return <Forbidden area="لوحة مدير الحساب مخصصة لمديري الحسابات." />;
  const { id } = await params;
  const db = await loadRequestContext(id);
  const req = db.requests.find((r) => r.id === id);
  if (!req) notFound();

  const pipelines = db.pipelines.filter((p) => p.requestId === id).sort((a, b) => b.version - a.version);
  const draft = pipelines.find((p) => p.status === "draft");
  const current = draft ?? pipelines[0];

  // The queue lists every request, including ones typed and never confirmed —
  // and a pipeline only exists once the requester confirms their brief. This
  // used to notFound(), so the account manager's first click from the queue
  // returned a 404. Show the brief and what it is waiting on instead.
  if (!req.brief || !current) {
    return <AwaitingConfirmation account={account} request={req} />;
  }

  const live = current.items.filter((i) => i.status !== "removed");
  const approved = live.filter((i) => i.status === "approved").length;
  const blocked = live.filter((i) => !canApprove(i)).length;
  const b = req.brief;

  return (
    <>
      <AmBar on="queue" account={account} />
      <div className="wrap">
        <div className="row between" style={{ alignItems: "baseline" }}>
          <div className="row g10" style={{ alignItems: "baseline" }}>
            <Link href="/am" className="sm dim">
              الطابور /
            </Link>
            <h2>{clip(b.summaryAr, 52)}</h2>
          </div>
          <div className="row g8">
            <span className="pill">
              {current.status === "draft" ? "مسودة" : "منشورة"} النسخة {ar(current.version)} ·{" "}
              {current.source === "ai_generated" ? "مُولّدة آليًا" : "من مدير الحساب"}
            </span>
            <Link href={`/am/requests/${id}/pipeline`} className="btn btn-sm btn-ghost">
              مسار الطلب
            </Link>
            <Link href={`/am/requests/${id}/attach`} className="btn btn-sm btn-strong">
              استبدل بقائمة جاهزة أو ملف
            </Link>
          </div>
        </div>

        <div style={{ height: 18 }} />

        <div className="split row g20" style={{ alignItems: "flex-start" }}>
          <aside className="split-side stack g14" style={{ width: 330, flex: "none" }}>
            <div className="card stack g12">
              <span className="eyebrow">الطلب</span>
              <p>«{req.rawText}»</p>
              <div className="row g8" style={{ borderTop: "1px solid var(--line-3)", paddingTop: 13 }}>
                <div className="avatar sm">{req.requesterInitial}</div>
                <span className="sm muted">{req.requesterName}</span>
              </div>
            </div>

            <div className="card stack g12">
              <span className="eyebrow">الفهم المُعتمد</span>
              <p className="sm">{b.summaryAr}</p>
              {/* Same sentence the requester saw on the confirm screen. An
                  account manager working from «قواعد محلية · ثقة ٣٥٪» is
                  reading a keyword match, not an understanding of the ask. */}
              <Provenance brief={b} />
              <div className="stack g8" style={{ borderTop: "1px solid var(--line-3)", paddingTop: 13 }}>
                {b.targetRoles.length > 0 && <Row k="الأدوار" v={b.targetRoles.join("، ")} />}
                {b.industries.length > 0 && <Row k="القطاع" v={b.industries.join("، ")} />}
                {b.geos.length > 0 && <Row k="الموقع" v={b.geos.join("، ")} />}
              </div>
              {b.exclusions.length > 0 && (
                <div className="row g6 wrapx" style={{ borderTop: "1px solid var(--line-3)", paddingTop: 13 }}>
                  <span className="xs dim">يستثني</span>
                  {b.exclusions.map((x) => (
                    <span className="chip" key={x}>
                      {x}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="card stack g12">
              <span className="eyebrow">النسخ</span>
              {pipelines.map((p) => (
                <div className="row g10" key={p.id} style={{ alignItems: "flex-start", opacity: p.status === "superseded" ? 0.55 : 1 }}>
                  <span className="dot" style={{ background: p.status === "superseded" ? "#C9C9C2" : "#4F6B4C", marginTop: 8 }} />
                  <div className="stack">
                    <span className="sm">
                      النسخة {ar(p.version)} · {p.createdBy}
                    </span>
                    <span className="xs dim">
                      {p.status === "draft" ? "مسودة — قيد المراجعة" : p.status === "published" ? "منشورة" : "استُبدلت"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div className="grow stack g12">
            <div className="row between">
              <span className="sm muted">
                {ar(live.length)} أشخاص · {ar(blocked)} بدون مصدر موثّق
              </span>
            </div>

            {current.items.map((item) => {
              const person = db.people.find((p) => p.id === item.personId);
              if (!person) return null;
              const gone = item.status === "removed";
              const ok = item.status === "approved";
              const blockedRow = !canApprove(item);
              return (
                <div className={`card stack g10 ${gone ? "gone" : ok ? "sel" : ""}`} key={item.id}>
                  <div className="row between g14" style={{ alignItems: "flex-start" }}>
                    <div className="stack g8 grow">
                      <div className="row g10 wrapx" style={{ alignItems: "baseline" }}>
                        <span className="dim xs">{ar(item.rank)}</span>
                        <strong className="lat">{person.latin}</strong>
                        <span className="sm muted">{person.title}</span>
                        <span className="sm dim">· {person.company}</span>
                      </div>
                      <div className="row g12 wrapx">
                        <FitTag fit={item.fit} />
                        <span className="chip">{person.emailVerified ? "Email موثّق" : "LinkedIn"}</span>
                        {item.thin && <span className="chip">معلومات ناقصة</span>}
                      </div>
                      <p className="sm">{item.why}</p>

                      {item.evidence.length > 0 && (
                        <div className="stack g6">
                          {item.evidence.map((e, i) => (
                            <div className="row g8 wrapx" key={i}>
                              <LinkIcon />
                              <span className="xs" style={{ color: "var(--accent)" }}>
                                {e.title}
                              </span>
                              <span className="xs dim">
                                {e.source} · {e.date}
                              </span>
                              <span className="chip xs">{e.assertedBy === "ai" ? "AI" : "AM"}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {blockedRow && !gone && (
                        <div className="alert">
                          ما فيه مصدر موثّق — لا يمكن اعتماده حتى تُضاف نقطة إثبات أو يُزال من القائمة.
                        </div>
                      )}
                    </div>

                    <div className="act-col stack g6" style={{ width: 116, flex: "none" }}>
                      <form action={setItemStatus}>
                        <input type="hidden" name="pipelineId" value={current.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="status" value="approved" />
                        <button
                          type="submit"
                          disabled={blockedRow || gone}
                          className={`btn-sm ${ok ? "btn-on" : ""}`}
                          style={{ width: "100%" }}
                        >
                          {ok ? "✓ معتمد" : "اعتمد"}
                        </button>
                      </form>
                      <form action={setItemStatus}>
                        <input type="hidden" name="pipelineId" value={current.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="status" value="removed" />
                        <button type="submit" className="btn-ghost btn-sm" style={{ width: "100%" }}>
                          {gone ? "أعد" : "أزل"}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}

            <form action={publishPipeline} className="card row between sel">
              <input type="hidden" name="pipelineId" value={current.id} />
              <span className="sm muted">
                {ar(approved)} من {ar(live.length)} معتمدين — سيُنشرون كالنسخة {ar(current.version)} للعميل
              </span>
              <button type="submit" className="btn-primary" disabled={approved === 0}>
                انشر للعميل
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

/** Trim to a word boundary so a heading never breaks mid-word. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="row g10" style={{ alignItems: "baseline" }}>
      <span className="xs dim" style={{ width: 60, flex: "none" }}>
        {k}
      </span>
      <span className="sm">{v}</span>
    </div>
  );
}

/**
 * A request that reached the queue but has no pipeline yet: the requester
 * opened it and has not confirmed the extracted brief. There is nothing for an
 * account manager to review, but the row is still real work — someone stalled
 * mid-request, and chasing them is exactly what a concierge service does.
 */
function AwaitingConfirmation({ account, request }: { account: Account; request: IntroRequest }) {
  return (
    <>
      <AmBar on="queue" account={account} />
      <div className="wrap">
        <div className="mid stack g20" style={{ paddingTop: 20 }}>
          <div className="row g10" style={{ alignItems: "baseline" }}>
            <Link href="/am" className="sm dim">
              الطابور /
            </Link>
            <h2>طلب لم يُأكَّد بعد</h2>
          </div>

          <div className="card stack g14">
            <div className="stack g6">
              <span className="eyebrow">نص الطلب</span>
              <strong>«{request.rawText}»</strong>
            </div>
            {request.brief?.summaryAr && (
              <div className="stack g6">
                <span className="eyebrow">ما فهمناه</span>
                <span className="sm muted">{request.brief.summaryAr}</span>
              </div>
            )}
            <div className="note">
              مقدّم الطلب ما أكّد الفهم بعد، وعشان كذا ما انبنت قائمة. القائمة تُبنى تلقائيًا أول
              ما يأكّد — أو تواصل معه إذا وقف عند هذي الخطوة.
            </div>
          </div>

          <div className="row">
            <Link href={`/am/requests/${request.id}/pipeline`} className="btn btn-sm btn-ghost">
              مسار الطلب
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
