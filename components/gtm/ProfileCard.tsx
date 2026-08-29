import type { GtmStep, ProfileSource } from "@/lib/types";
import type { ProfileRow } from "@/lib/gtm/repo";
import { saveProfileByHand } from "@/lib/gtm/actions";

/**
 * What we think the company does, and where that belief came from.
 *
 * The provenance line is not a footnote. `claude` means a model read the page,
 * `html` means we fell back to the page's own <title> and meta description, and
 * `manual` means a person typed it. All three are usable — it is the user's own
 * company, so even the thin one is true — but a reader deciding whether to
 * correct it needs to know which they are looking at.
 *
 * When the step failed there is no profile at all, and this becomes the manual
 * form. That is the "never a dead end" rule: the screen that reports the
 * failure is the same screen that fixes it, with the reason still visible.
 */

const SOURCE_LABEL: Record<ProfileSource, string> = {
  claude: "قرأناها بـClaude من صفحتك",
  html: "قراءة مباشرة من عنوان الصفحة ووصفها — بدون تحليل",
  manual: "كتابة يدوية منك",
};

export function ProfileCard({
  runId,
  profile,
  steps,
}: {
  runId: string;
  profile?: ProfileRow;
  steps: GtmStep[];
}) {
  const step = steps.find((s) => s.id === "profile");

  if (!profile) {
    return (
      <section className="card stack g14">
        <div className="stack g4">
          <h2>ما قدرنا نقرأ موقعك</h2>
          <span className="sm" style={{ color: "var(--danger)" }}>
            {step?.error ?? "الخطوة ما اكتملت."}
          </span>
        </div>
        <ManualForm runId={runId} />
      </section>
    );
  }

  return (
    <section className="card stack g14">
      <div className="row between wrapx g10" style={{ alignItems: "baseline" }}>
        <h2>{profile.name}</h2>
        <span className="chip">{SOURCE_LABEL[profile.source]}</span>
      </div>

      <p style={{ maxWidth: "62ch" }}>{profile.sells}</p>

      <div className="row wrapx g8">
        {profile.market && <span className="chip">السوق: {profile.market}</span>}
        {profile.sizeSignal && <span className="chip">{profile.sizeSignal}</span>}
        {profile.offerings.map((o) => (
          <span key={o} className="chip">
            {o}
          </span>
        ))}
      </div>

      {!profile.sellsEn && (
        <span className="sm" style={{ color: "var(--warn)" }}>
          ما عندنا صيغة إنجليزية لهذا السطر، فالنسخة الإنجليزية من الرسائل بتستعير العربي.
          اكتبها هنا إذا تبيها كاملة.
        </span>
      )}

      <details>
        <summary style={{ cursor: "pointer", fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
          عدّل الملف
        </summary>
        <div style={{ marginTop: 14 }}>
          <ManualForm runId={runId} profile={profile} />
        </div>
      </details>
    </section>
  );
}

function ManualForm({ runId, profile }: { runId: string; profile?: ProfileRow }) {
  return (
    <form action={saveProfileByHand} className="stack g10">
      <input type="hidden" name="runId" value={runId} />
      <input
        type="text"
        name="name"
        required
        defaultValue={profile?.name ?? ""}
        placeholder="اسم الشركة"
        aria-label="اسم الشركة"
      />
      <textarea
        name="sells"
        required
        rows={2}
        defaultValue={profile?.sells ?? ""}
        placeholder="سطر واحد: وش تبيعون ولمين. يُستخدم داخل جملة، فلا تنهه بنقطة."
        aria-label="ماذا تبيعون"
      />
      <textarea
        name="sellsEn"
        rows={2}
        defaultValue={profile?.sellsEn ?? ""}
        dir="ltr"
        placeholder="The same line in English — used for the English draft variant."
        aria-label="السطر بالإنجليزية"
      />
      <div className="row g10 wrapx">
        <input
          type="text"
          name="market"
          defaultValue={profile?.market ?? ""}
          placeholder="السوق (مثال: Saudi Arabia)"
          aria-label="السوق"
          style={{ flex: 1, minWidth: 180 }}
        />
        <input
          type="text"
          name="sizeSignal"
          defaultValue={profile?.sizeSignal ?? ""}
          placeholder="إشارة حجم، إن وُجدت"
          aria-label="إشارة الحجم"
          style={{ flex: 1, minWidth: 180 }}
        />
      </div>
      <textarea
        name="offerings"
        rows={2}
        defaultValue={profile?.offerings.join("\n") ?? ""}
        placeholder={"منتج أو خدمة في كل سطر"}
        aria-label="المنتجات"
      />
      <div className="row between">
        <span className="xs dim">ما نضيف شيء ما كتبته. الملف يُحفظ كما هو.</span>
        <button type="submit" className="btn-primary btn-sm">
          احفظ الملف
        </button>
      </div>
    </form>
  );
}
