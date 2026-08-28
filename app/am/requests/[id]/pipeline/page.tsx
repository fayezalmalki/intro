import Link from "next/link";
import { notFound } from "next/navigation";
import { AmBar, ar, Forbidden } from "@/components/Chrome";
import { buildPipelineView, type Stage, type StageState } from "@/lib/pipeline";
import { accountForPage } from "@/lib/session";
import { loadRequestContext } from "@/lib/db/loaders";

export const dynamic = "force-dynamic";

const DOT: Record<StageState, string> = {
  done: "var(--accent)",
  active: "var(--accent)",
  blocked: "#8C4A40",
  pending: "#DEDED7",
};

const TONE: Record<string, string> = {
  normal: "var(--ink)",
  good: "var(--accent)",
  warn: "var(--warn)",
  bad: "var(--danger)",
};

const STATE_LABEL: Record<StageState, string> = {
  done: "تم",
  active: "جارٍ",
  blocked: "متوقف",
  pending: "لم يبدأ",
};

export default async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  // Defence in depth. The actions each check the role too — that is the real
  // boundary — but a requester who reaches this URL should be told so, not
  // shown a crash page.
  const account = await accountForPage("account_manager");
  if (!account) return <Forbidden area="لوحة مدير الحساب مخصصة لمديري الحسابات." />;
  const { id } = await params;
  const view = buildPipelineView(await loadRequestContext(id), id);
  if (!view) notFound();

  return (
    <>
      <AmBar on="queue" account={account} />
      <div className="wrap">
        <div className="row between" style={{ alignItems: "baseline" }}>
          <div className="row g10" style={{ alignItems: "baseline" }}>
            <Link href={`/am/requests/${id}`} className="sm dim">
              الطلب /
            </Link>
            <h2>مسار الطلب</h2>
          </div>
          <span className="sm dim">
            المرحلة {ar(view.currentIndex + 1)} من {ar(view.stages.length)}
          </span>
        </div>

        <div style={{ height: 20 }} />

        <div className="mid stack g0">
          {view.stages.map((stage, i) => (
            <StageRow
              key={stage.key}
              stage={stage}
              index={i}
              last={i === view.stages.length - 1}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function StageRow({ stage, index, last }: { stage: Stage; index: number; last: boolean }) {
  const muted = stage.state === "pending";
  return (
    <div className="row g14" style={{ alignItems: "stretch" }}>
      {/* rail */}
      <div className="stack" style={{ width: 20, flex: "none", alignItems: "center" }}>
        <div
          className="dot"
          style={{
            background: DOT[stage.state],
            width: 11,
            height: 11,
            marginTop: 22,
            outline: stage.state === "active" ? "3px solid var(--accent-wash)" : "none",
          }}
        />
        {!last && <div style={{ width: 1, flexGrow: 1, background: "var(--line)", marginTop: 6 }} />}
      </div>

      <div className="grow stack g10" style={{ paddingBottom: last ? 0 : 22, opacity: muted ? 0.55 : 1 }}>
        <div className="card stack g10" style={{ marginTop: 12 }}>
          <div className="row between g10" style={{ alignItems: "baseline" }}>
            <div className="row g10" style={{ alignItems: "baseline" }}>
              <span className="xs dim">{ar(index + 1)}</span>
              <strong>{stage.title}</strong>
              <span
                className="chip"
                style={{
                  color: stage.state === "blocked" ? "var(--danger)" : undefined,
                  borderColor: stage.state === "blocked" ? "var(--danger-line)" : undefined,
                }}
              >
                {STATE_LABEL[stage.state]}
              </span>
            </div>
            {stage.at && <span className="xs dim">{stage.at}</span>}
          </div>

          <p className="sm">{stage.summary}</p>

          {stage.details.length > 0 && (
            <div
              className="detail-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "8px 20px",
                borderTop: "1px solid var(--line-3)",
                paddingTop: 12,
              }}
            >
              {stage.details.map((d, k) => (
                <div className="row g10" key={k} style={{ alignItems: "baseline" }}>
                  <span className="xs dim" style={{ width: 96, flex: "none" }}>
                    {d.label}
                  </span>
                  <span className="sm" style={{ color: TONE[d.tone ?? "normal"] }}>
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
