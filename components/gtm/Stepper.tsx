import type { GtmStep, GtmStepId, GtmStepState } from "@/lib/types";
import { GTM_STEPS } from "@/lib/types";

/**
 * The run rail.
 *
 * Explee's strongest idea is that the work is visible while it happens, and
 * this is that — but with one difference that matters more than the animation:
 * every state here is a state the run actually reached. `done` is written only
 * after the row it claims to have produced exists, and `failed` carries the
 * step's own message, so a stuck run says *what* is stuck instead of spinning.
 *
 * Steps 5 and 6 are `pending` until the user starts them, because they cost
 * money. A rail that showed them as done over an empty table would be lying
 * about the only part of the flow anyone pays for.
 */

const LABEL: Record<GtmStepId, string> = {
  profile: "نقرأ موقعك",
  competitors: "نشوف منافسيك",
  segments: "نحدد الشرائح",
  companies: "نلقى الشركات",
  people: "نلقى أصحاب القرار",
  drafts: "نكتب الرسائل",
};

/** What each step is waiting for, when it has not started. */
const WAITING: Partial<Record<GtmStepId, string>> = {
  people: "يبدأ باختيارك — مدفوع",
  drafts: "بعد كشف الأشخاص",
};

const MARK: Record<GtmStepState, string> = {
  pending: "",
  running: "•",
  done: "✓",
  failed: "!",
};

export function Stepper({ steps }: { steps: GtmStep[] }) {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const done = steps.filter((s) => s.state === "done").length;

  return (
    <aside className="gtm-rail" aria-label="خطوات التحليل">
      <div className="stack g4" style={{ marginBottom: 12 }}>
        <span className="eyebrow">التقدّم</span>
        <span className="sm muted">
          {done} من {GTM_STEPS.length} خطوات
        </span>
      </div>
      <ol className="stack" style={{ listStyle: "none" }}>
        {GTM_STEPS.map((id) => {
          const step = byId.get(id) ?? { id, state: "pending" as GtmStepState };
          return (
            <li key={id} className={`gtm-step ${step.state}`}>
              <span
                className={`gtm-mark ${step.state}`}
                aria-hidden="true"
              >
                {MARK[step.state]}
              </span>
              <span className="stack g4">
                <span className="gtm-step-name">
                  {LABEL[id]}
                  <span className="visually-hidden"> — {STATE_LABEL[step.state]}</span>
                </span>
                {step.state === "failed" && step.error && (
                  <span className="gtm-step-error">{step.error}</span>
                )}
                {step.state === "done" && step.note && (
                  <span className="gtm-step-note">{step.note}</span>
                )}
                {step.state === "pending" && WAITING[id] && (
                  <span className="gtm-step-note">{WAITING[id]}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/**
 * The state in words, for a screen reader. The mark alone is a coloured glyph,
 * which is exactly the kind of thing that carries all the meaning visually and
 * none of it otherwise.
 */
const STATE_LABEL: Record<GtmStepState, string> = {
  pending: "لم تبدأ",
  running: "جارية",
  done: "تمت",
  failed: "تعثّرت",
};
