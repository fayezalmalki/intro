import Link from "next/link";
import { AppBar, DirectionBadge, ar } from "@/components/Chrome";
import { currentAccount } from "@/lib/session";
import { loadMyRequests } from "@/lib/db/loaders";
import type { Db, IntroRequest, RequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The requester's own list, on the handoff's dashboard layout: a KPI row over
 * a table of requests.
 *
 * Until this screen existed the app had no index at all — /requests/[id] was
 * reachable only from the redirect that created it, so signing back in later
 * left someone on an empty /new box with their work behind a URL they had to
 * have kept.
 *
 * The artboard puts a right rail here carrying market signals and a concierge
 * cross-sell. Neither is built: there is no signals table and no concierge
 * service, and a rail of invented rows would be the one thing on this page
 * that does not describe the account looking at it. The table takes the width.
 */

/**
 * The same five states as the account manager's queue, told from the other
 * side of the desk. Deliberately a second map rather than a shared one — «مسودة
 * جاهزة» is news to an account manager and means nothing to the person waiting.
 */
const STATE: Record<RequestStatus, { label: string; dot: string }> = {
  intent_review: { label: "بانتظار تأكيدك", dot: "var(--accent)" },
  in_sourcing: { label: "فريقنا يجهّز قائمتك", dot: "var(--line-2)" },
  pipeline_ready: { label: "قائمتك جاهزة", dot: "var(--accent)" },
  outreach: { label: "التواصل جارٍ", dot: "var(--warn-line)" },
  closed: { label: "مغلق", dot: "var(--line)" },
};

export default async function MyRequestsPage() {
  const account = await currentAccount();
  const db = await loadMyRequests(account.id);
  const rows = [...db.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <AppBar account={account} />
      <div className="wrap mid stack g20">
        <div className="console-bar">
          <h1>طلباتي</h1>
          <div className="grow" />
          <Link href="/new" className="btn btn-primary btn-sm">
            طلب جديد
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="card stack g10">
            <strong>ما عندك طلبات بعد.</strong>
            <span className="sm muted">
              اكتب سطر واحد عن الشخص اللي تبي توصله، ونتكفّل بالباقي —{" "}
              <Link href="/new">ابدأ طلبك الأول</Link>.
            </span>
          </div>
        ) : (
          <>
            <Kpis db={db} rows={rows} />

            <div className="tbl">
              <div className="tr head tr-req">
                <span>الطلب</span>
                <span>النوع</span>
                <span>الترشيحات</span>
                <span>الحالة</span>
                <span />
              </div>
              {rows.map((r) => {
                const s = STATE[r.status];
                const version = publishedVersion(db, r.id);
                return (
                  <div className="tr tr-req" key={r.id}>
                    <div className="stack g4">
                      <strong className="sm">{r.brief?.summaryAr ?? r.rawText}</strong>
                      <span className="xs dim">«{r.rawText}»</span>
                    </div>
                    <span>{r.brief && <DirectionBadge goal={r.brief.goalType} />}</span>
                    <span className="sm muted">
                      {matchedIn(db, r.id) > 0 ? ar(matchedIn(db, r.id)) : "—"}
                    </span>
                    <div className="row g6">
                      <span className="dot" style={{ background: s.dot }} />
                      <span className="sm muted">
                        {s.label}
                        {version > 0 ? ` · النسخة ${ar(version)}` : ""}
                      </span>
                    </div>
                    <Link href={`/requests/${r.id}`} className="btn btn-sm">
                      افتح ←
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Four figures, every one of them computed from rows this account owns.
 *
 * The artboard's fifth idea — a signals count — has no table behind it and is
 * simply not here, rather than being filled with a plausible number.
 */
function Kpis({ db, rows }: { db: Db; rows: IntroRequest[] }) {
  const open = rows.filter((r) => r.status !== "closed");
  const matched = db.pipelines
    .filter((p) => p.status === "published")
    .reduce((n, p) => n + p.items.length, 0);

  const sent = db.outreach.filter((o) => o.status !== "none");
  const accepted = sent.filter((o) => o.status === "accepted");
  const answered = sent.filter((o) => o.status === "replied" || o.status === "accepted" || o.status === "declined");

  return (
    <div className="kpis">
      <Kpi
        label="طلبات مفتوحة"
        figure={ar(open.length)}
        sub={open.length ? goalBreakdown(open) : "—"}
      />
      <Kpi label="أشخاص مرشّحون" figure={ar(matched)} sub={matched ? "عبر القوائم المنشورة" : "—"} />
      <Kpi
        label="تعارف تم"
        figure={ar(accepted.length)}
        sub={sent.length ? `${ar(Math.round((accepted.length / sent.length) * 100))}٪ من المُرسل` : "—"}
      />
      <Kpi
        label="نسبة الرد"
        figure={sent.length ? `${ar(Math.round((answered.length / sent.length) * 100))}٪` : "—"}
        sub={sent.length ? `${ar(answered.length)} من ${ar(sent.length)}` : "ما أرسلت بعد"}
      />
    </div>
  );
}

function Kpi({ label, figure, sub }: { label: string; figure: string; sub: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-figure">{figure}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

const GOAL_SHORT: Record<string, string> = {
  job: "توظيف",
  sales: "مبيعات",
  partnership: "شراكات",
  investment: "استثمار",
  person: "شخص",
};

/** "٢ مبيعات · ١ توظيف" — the artboard's sub-line, from the briefs we hold. */
function goalBreakdown(rows: IntroRequest[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const goal = r.brief?.goalType;
    if (goal) counts.set(goal, (counts.get(goal) ?? 0) + 1);
  }
  if (counts.size === 0) return "—";
  return [...counts].map(([goal, n]) => `${ar(n)} ${GOAL_SHORT[goal] ?? goal}`).join(" · ");
}

function matchedIn(db: Db, requestId: string): number {
  const published = db.pipelines
    .filter((p) => p.requestId === requestId && p.status === "published")
    .sort((a, b) => b.version - a.version)[0];
  return published?.items.length ?? 0;
}

function publishedVersion(db: Db, requestId: string): number {
  return Math.max(
    0,
    ...db.pipelines
      .filter((p) => p.requestId === requestId && p.status === "published")
      .map((p) => p.version),
  );
}
