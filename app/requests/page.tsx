import Link from "next/link";
import { AppBar, ar } from "@/components/Chrome";
import { currentAccount } from "@/lib/session";
import { loadMyRequests } from "@/lib/db/loaders";
import type { IntroRequest, RequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The requester's own list.
 *
 * Until this existed the app had no index at all: /requests/[id] was reachable
 * only from the redirect that created it, so signing back in later left someone
 * on an empty /new box with their work behind a URL they had to have kept.
 */

/**
 * The same five states as the account manager's queue, told from the other
 * side of the desk. Deliberately a second map rather than a shared one — «مسودة
 * جاهزة» is news to an account manager and means nothing to the person waiting.
 */
const STATE: Record<RequestStatus, { label: string; dot: string }> = {
  intent_review: { label: "بانتظار تأكيدك", dot: "#4F6B4C" },
  in_sourcing: { label: "فريقنا يجهّز قائمتك", dot: "#E0E0DA" },
  pipeline_ready: { label: "قائمتك جاهزة", dot: "#4F6B4C" },
  outreach: { label: "التواصل جارٍ", dot: "#DDE6DA" },
  closed: { label: "مغلق", dot: "#E0E0DA" },
};

export default async function MyRequestsPage() {
  const account = await currentAccount();
  const db = await loadMyRequests(account.id);
  const rows = [...db.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <AppBar account={account} />
      <div className="wrap">
        <div className="narrow stack g20" style={{ paddingTop: 30 }}>
          <div className="row between" style={{ alignItems: "baseline" }}>
            <h2>طلباتي</h2>
            <Link href="/new" className="sm muted">
              + Intro جديد
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
            rows.map((r) => {
              const s = STATE[r.status];
              const version = Math.max(
                0,
                ...db.pipelines
                  .filter((p) => p.requestId === r.id && p.status === "published")
                  .map((p) => p.version),
              );
              return (
                <Link href={`/requests/${r.id}`} className="card stack g12 sel" key={r.id}>
                  <div className="stack g4">
                    <strong className="sm">{r.brief?.summaryAr ?? r.rawText}</strong>
                    <span className="xs dim">«{r.rawText}»</span>
                  </div>
                  <div
                    className="row between g10"
                    style={{ borderTop: "1px solid var(--line-3)", paddingTop: 13 }}
                  >
                    <div className="row g6">
                      <span className="dot" style={{ background: s.dot }} />
                      <span className="sm muted">
                        {s.label}
                        {version > 0 ? ` · النسخة ${ar(version)}` : ""}
                      </span>
                    </div>
                    <span className="xs dim">{when(r)}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

/** Days rather than a date, because "قبل يومين" answers the question a date makes you compute. */
function when(r: IntroRequest): string {
  const days = Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86_400_000);
  if (days <= 0) return "اليوم";
  if (days === 1) return "أمس";
  return `قبل ${ar(days)} يوم`;
}
