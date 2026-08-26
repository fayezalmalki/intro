import { notFound } from "next/navigation";
import { AppBar } from "@/components/Chrome";
import { confirmBrief } from "@/lib/actions";
import { loadRequestContext } from "@/lib/db/loaders";

export const dynamic = "force-dynamic";

const GOAL_LABEL: Record<string, string> = {
  job: "وظيفة",
  sales: "مبيعات",
  partnership: "شراكة",
  investment: "استثمار",
  person: "شخص محدد",
};

export default async function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const req = (await loadRequestContext(id)).requests.find((r) => r.id === id);
  if (!req?.brief) notFound();
  const b = req.brief;

  return (
    <>
      <AppBar />
      <div className="wrap">
        <div className="narrow stack g20" style={{ paddingTop: 36 }}>
          <div className="stack g12">
            <span className="eyebrow">طلبك</span>
            <h1>«{req.rawText}»</h1>
          </div>

          <form action={confirmBrief} className="card stack g16">
            <input type="hidden" name="requestId" value={req.id} />
            <span className="eyebrow">هذا اللي فهمناه</span>
            <textarea name="summaryAr" rows={3} defaultValue={b.summaryAr} aria-label="ملخص الطلب" />

            <div className="stack g12" style={{ borderTop: "1px solid var(--line-3)", paddingTop: 16 }}>
              <Field label="الهدف" value={GOAL_LABEL[b.goalType] ?? b.goalType} />
              {b.targetRoles.length > 0 && <Field label="الأدوار" value={b.targetRoles.join("، ")} />}
              {b.industries.length > 0 && <Field label="القطاع" value={b.industries.join("، ")} />}
              {b.geos.length > 0 && <Field label="الموقع" value={b.geos.join("، ")} />}
              {b.exclusions.length > 0 && (
                <div className="row g10 wrapx" style={{ alignItems: "baseline" }}>
                  <span className="xs dim" style={{ width: 74, flex: "none" }}>
                    يستثني
                  </span>
                  <span className="row g6 wrapx">
                    {b.exclusions.map((x) => (
                      <span className="chip" key={x}>
                        {x}
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </div>

            <div className="row between" style={{ borderTop: "1px solid var(--line-3)", paddingTop: 16 }}>
              <span className="sm dim">
                استُخرج بـ{b.extractedBy === "claude" ? "Claude" : "قواعد محلية"} · ثقة {Math.round(b.confidence * 100)}٪
              </span>
              <button type="submit" className="btn-primary">
                تمام، كمّل
              </button>
            </div>
          </form>

          <p className="sm dim">
            عدّل النص فوق إذا ما كان دقيقًا. ما نبدأ التجهيز إلا بعد ما تأكد.
          </p>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="row g10" style={{ alignItems: "baseline" }}>
      <span className="xs dim" style={{ width: 74, flex: "none" }}>
        {label}
      </span>
      <span className="sm">{value}</span>
    </div>
  );
}
