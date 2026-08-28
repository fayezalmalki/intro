import Link from "next/link";
import { notFound } from "next/navigation";
import { Console, Check, ar, Forbidden } from "@/components/Chrome";
import { accountForPage } from "@/lib/session";
import { loadRequestContext } from "@/lib/db/loaders";

export const dynamic = "force-dynamic";

const SOURCE: Record<string, string> = {
  ai_generated: "مُولّدة آليًا",
  imported_csv: "من ملف مرفوع",
  pasted: "من صفوف ملصقة",
  from_list: "من قائمة جاهزة",
  manual: "يدوية",
};

export default async function PublishedPage({ params }: { params: Promise<{ id: string }> }) {
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
  const live = pipelines.find((p) => p.status === "published");
  if (!live) notFound();

  const carried = db.outreach.filter((o) => o.requestId === id && o.status !== "none");
  const priorPeople = new Set(
    pipelines.filter((p) => p.version < live.version).flatMap((p) => p.items.map((i) => i.personId)),
  );
  const kept = live.items.filter((i) => priorPeople.has(i.personId)).length;

  return (
    <Console on="queue" account={account}>
      <div className="wrap">
        <div className="mid stack g26" style={{ paddingTop: 40 }}>
          <div className="stack g14">
            <div
              className="row"
              style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "var(--accent-wash)", border: "1px solid var(--accent-line)",
                justifyContent: "center",
              }}
            >
              <Check />
            </div>
            <h1>النسخة {ar(live.version)} مرفوعة على الطلب.</h1>
            <p className="muted">
              {req.requesterName} يشوف القائمة الجديدة الآن، ويعرف إنها منك.
            </p>
          </div>

          <div className="card stack g16">
            <span className="eyebrow">سجل النسخ</span>
            {pipelines.map((p) => (
              <div className="row g12" key={p.id} style={{ alignItems: "flex-start" }}>
                <span
                  className="dot"
                  style={{ background: p.status === "published" ? "var(--accent)" : "var(--line-2)", marginTop: 9, width: 9, height: 9 }}
                />
                <div className="grow stack g4">
                  <div className="row between">
                    <strong className="sm" style={{ color: p.status === "published" ? "var(--ink)" : "var(--ink-2)" }}>
                      النسخة {ar(p.version)} · {SOURCE[p.source]}
                    </strong>
                    <span className="xs" style={{ color: p.status === "published" ? "var(--accent)" : "var(--ink-3)" }}>
                      {p.status === "published" ? "منشورة الآن" : p.status === "superseded" ? "استُبدلت" : "مسودة"}
                    </span>
                  </div>
                  <span className="xs dim">
                    {ar(p.items.length)} أشخاص · بناها {p.createdBy}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {live.version > 1 && (
            <div className="note stack g8">
              <strong>ما ضاع شيء من النسخة السابقة</strong>
              {carried.length === 0 && kept === 0 ? (
                <span>ما كان فيه تواصل جارٍ على النسخة السابقة.</span>
              ) : (
                <>
                  {carried.map((o) => {
                    const person = db.people.find((p) => p.id === o.personId);
                    return (
                      <span key={o.personId}>
                        — التواصل مع <span className="lat">{person?.latin}</span> ما زال قائمًا، وحالته «{o.status === "sent" ? "بانتظار رد" : o.status}».
                      </span>
                    );
                  })}
                  {kept > 0 && <span>— {ar(kept)} أشخاص انتقلوا من النسخة السابقة بنفس حالتهم.</span>}
                </>
              )}
            </div>
          )}

          <div className="row g8">
            <Link href={`/requests/${id}`} className="btn btn-primary">
              شوف ما يراه العميل
            </Link>
            <Link href="/am" className="btn btn-ghost">
              عد للطابور
            </Link>
          </div>
        </div>
      </div>
    </Console>
  );
}
