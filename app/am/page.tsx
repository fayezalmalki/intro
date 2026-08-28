import Link from "next/link";
import { Console, DirectionBadge, ar, Forbidden } from "@/components/Chrome";
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
    <Console on="queue" account={account}>
      <div className="wrap">
        <div className="console-bar">
          <h1>طابور الطلبات</h1>
        </div>

        {/* The three counts used to run inline beside the heading, where the
            one that matters — work that has gone past its promise — sat third
            in a muted row. On cards it is a figure in the danger colour. */}
        <div className="kpis" style={{ marginBottom: 24 }}>
          <div className="kpi">
            <div className="kpi-label">في الانتظار</div>
            <div className="kpi-figure">{ar(waiting)}</div>
            <div className="kpi-sub">مسودة جاهزة للمراجعة</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">تجاوزت الوقت</div>
            <div className="kpi-figure" style={{ color: late > 0 ? "var(--danger)" : undefined }}>
              {ar(late)}
            </div>
            <div className="kpi-sub">{late > 0 ? "تحتاج تحرّك الآن" : "كل شيء داخل الوقت"}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">منشورة</div>
            <div className="kpi-figure">{ar(published)}</div>
            <div className="kpi-sub">وصلت للعميل</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">إجمالي الطلبات</div>
            <div className="kpi-figure">{ar(rows.length)}</div>
            <div className="kpi-sub">منذ البداية</div>
          </div>
        </div>

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
                    <DirectionBadge goal={r.brief?.goalType ?? "person"} />
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
    </Console>
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
