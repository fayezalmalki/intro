import Link from "next/link";
import { AmBar, ar, Forbidden } from "@/components/Chrome";
import { accountForPage } from "@/lib/session";
import { loadQueue } from "@/lib/db/loaders";
import type { IntroRequest, RequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATE: Record<RequestStatus, { label: string; dot: string }> = {
  intent_review: { label: "بانتظار تأكيد العميل", dot: "var(--line)" },
  in_sourcing: { label: "مسودة جاهزة", dot: "var(--accent)" },
  pipeline_ready: { label: "منشورة", dot: "var(--accent-line)" },
  outreach: { label: "التواصل جارٍ", dot: "var(--accent-line)" },
  closed: { label: "مغلق", dot: "var(--line)" },
};

const GOAL: Record<string, string> = {
  job: "وظيفة", sales: "مبيعات", partnership: "شراكة",
  investment: "استثمار", person: "شخص محدد",
};

export default async function QueuePage() {
  // Defence in depth. The actions each check the role too — that is the real
  // boundary — but a requester who reaches this URL should be told so, not
  // shown a crash page.
  const account = await accountForPage("account_manager");
  if (!account) return <Forbidden area="لوحة مدير الحساب مخصصة لمديري الحسابات." />;
  const db = await loadQueue();
  const rows = db.requests;
  const waiting = rows.filter((r) => r.status === "in_sourcing").length;
  const late = rows.filter((r) => isLate(r)).length;
  const published = rows.filter((r) => r.status === "pipeline_ready" || r.status === "outreach").length;

  return (
    <>
      <AmBar on="queue" account={account} />
      <div className="wrap">
        <div className="row between" style={{ alignItems: "baseline" }}>
          <h2>طابور الطلبات</h2>
          <div className="row g20 sm muted">
            <span>
              في الانتظار <strong style={{ color: "var(--ink)" }}>{ar(waiting)}</strong>
            </span>
            <span>
              تجاوزت الوقت <strong style={{ color: "var(--danger)" }}>{ar(late)}</strong>
            </span>
            <span>
              منشورة <strong style={{ color: "var(--accent)" }}>{ar(published)}</strong>
            </span>
          </div>
        </div>

        <div style={{ height: 18 }} />

        {rows.length === 0 ? (
          <div className="card stack g10">
            <strong>الطابور فاضي.</strong>
            <span className="sm muted">
              ابدأ بطلب من <Link href="/">واجهة العميل</Link> — يوصل هنا أول ما يأكد العميل الطلب.
            </span>
          </div>
        ) : (
          <div className="tbl">
            <div className="tr head">
              <span>الطلب</span>
              <span>مقدّم الطلب</span>
              <span>الهدف</span>
              <span>الحالة</span>
              <span>الموعد</span>
              <span />
            </div>
            {rows.map((r) => {
              const s = STATE[r.status];
              const version = Math.max(
                0,
                ...db.pipelines.filter((p) => p.requestId === r.id && p.status === "published").map((p) => p.version),
              );
              return (
                <div className="tr" key={r.id}>
                  <div className="stack g4">
                    <strong className="sm">{clip(r.brief?.summaryAr ?? r.rawText, 46)}</strong>
                    <span className="xs dim">«{r.rawText}»</span>
                  </div>
                  <div className="row g8">
                    <div className="avatar sm">{r.requesterInitial}</div>
                    <span className="sm muted">{r.requesterName}</span>
                  </div>
                  <span>
                    <span className="chip">{GOAL[r.brief?.goalType ?? "person"]}</span>
                  </span>
                  <div className="row g6">
                    <span className="dot" style={{ background: s.dot }} />
                    <span className="sm muted">
                      {s.label}
                      {version > 0 ? ` · النسخة ${ar(version)}` : ""}
                    </span>
                  </div>
                  <span className="sm" style={{ color: isLate(r) ? "var(--danger)" : "var(--accent)" }}>
                    {sla(r)}
                  </span>
                  <Link href={`/am/requests/${r.id}`} className="btn btn-sm btn-strong">
                    {r.status === "in_sourcing" ? "راجع" : "افتح"}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

function remainingMs(r: IntroRequest): number {
  return new Date(r.dueAt).getTime() - Date.now();
}

function isLate(r: IntroRequest): boolean {
  return r.status === "in_sourcing" && remainingMs(r) < 0;
}

function sla(r: IntroRequest): string {
  if (r.status !== "in_sourcing") return "—";
  const ms = remainingMs(r);
  const h = Math.floor(Math.abs(ms) / 3600_000);
  const m = Math.floor((Math.abs(ms) % 3600_000) / 60_000);
  return ms < 0 ? `متأخر ${ar(h)} س ${ar(m)} د` : `متبقٍ ${ar(h)} س ${ar(m)} د`;
}
