import { ar } from "@/components/Chrome";
import { describeQuery, type CompanyFilterQuery } from "@/lib/gtm/counts";
import type { CompanyRow, SegmentRow } from "@/lib/gtm/repo";
import { deleteSegment, recountSegment, saveSegment } from "@/lib/gtm/actions";

/**
 * One campaign card — the screen this whole flow is judged on.
 *
 * It carries the same elements Explee's does: a name and a mark, a description,
 * a PAIN line, three criteria, and a count. The difference is the row under the
 * count. Every number here prints the exact query that produced it and the
 * endpoint it was sent to, because Phase 0 established that these totals swing
 * hard with strictness — Saudi companies with 50+ staff is 8,092, and adding
 * "has an open role" makes it 620. Both are true. A card showing one of them
 * with no query attached is a card nobody can argue with, which is worse than
 * one nobody believes.
 *
 * And when there is no sourced count, there is **no number** — not a dash
 * dressed as one, not an estimate, not the last value that happened to be
 * there. The reason takes the number's place, in its own tone.
 */

const ORIGIN_LABEL = {
  ai: "مقترحة من التحليل",
  rules: "قاعدة افتراضية — عدّلها",
  user: "من عندك",
} as const;

export function SegmentCard({
  runId,
  segment,
  companies,
}: {
  runId: string;
  segment: SegmentRow;
  companies: CompanyRow[];
}) {
  const query = segment.countQuery as CompanyFilterQuery | null;
  const named = companies.filter((c) => c.name);

  return (
    <article className="card gtm-segment">
      <header className="gtm-segment-head">
        <span className="gtm-segment-icon" aria-hidden="true">
          {segment.icon}
        </span>
        <div className="stack g4 grow">
          <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, lineHeight: 1.4 }}>
            {segment.name}
          </h3>
          <span className="xs dim">{ORIGIN_LABEL[segment.origin]}</span>
        </div>
      </header>

      {segment.description && <p className="sm muted">{segment.description}</p>}

      {segment.pain && (
        <p className="gtm-pain">
          <b>الوجع</b>
          <br />
          {segment.pain}
        </p>
      )}

      {segment.criteria.length > 0 && (
        <ul className="gtm-crit">
          {segment.criteria.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}

      <div className="gtm-count">
        {segment.countSource === "coresignal" && segment.matchCount !== null ? (
          <>
            <span className="gtm-count-figure">{ar(segment.matchCount.toLocaleString("en-US"))}</span>
            <span className="xs dim">شركة مطابقة، من بحث مجاني عند Coresignal</span>
          </>
        ) : (
          <span className="gtm-count-none">
            {segment.countError ?? "ما فيه عدّ لهذي الشريحة بعد."}
          </span>
        )}
      </div>

      {query && (
        <div className="stack g4">
          <span className="xs dim">الاستعلام اللي طلّع هذا الرقم</span>
          <code className="gtm-query lat">{describeQuery(query)}</code>
          <span className="xs dim lat">{segment.countEndpoint}</span>
        </div>
      )}

      {named.length > 0 && (
        <div className="stack g6">
          <span className="xs dim">أمثلة مكشوفة</span>
          <div className="row wrapx g6">
            {named.slice(0, 6).map((c) => (
              <span key={c.id} className="chip">
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {named.length === 0 && companies.length > 0 && (
        <span className="xs dim">
          {ar(companies.length)} شركة مطابقة بمعرّفاتها. الأسماء شراء عند المزوّد، فما نعرضها
          قبل ما تختار وتوافق.
        </span>
      )}

      <div className="row between wrapx g8" style={{ marginTop: "auto", paddingTop: 4 }}>
        <form action={recountSegment}>
          <input type="hidden" name="runId" value={runId} />
          <input type="hidden" name="segmentId" value={segment.id} />
          <button type="submit" className="btn btn-sm btn-ghost">
            أعد العدّ
          </button>
        </form>
        <form action={deleteSegment}>
          <input type="hidden" name="runId" value={runId} />
          <input type="hidden" name="segmentId" value={segment.id} />
          <button type="submit" className="btn btn-sm btn-ghost">
            احذف
          </button>
        </form>
      </div>

      <details>
        <summary style={{ cursor: "pointer", fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
          عدّل هذي الشريحة
        </summary>
        <form action={saveSegment} className="stack g10" style={{ marginTop: 12 }}>
          <input type="hidden" name="runId" value={runId} />
          <input type="hidden" name="segmentId" value={segment.id} />
          <input type="text" name="name" required defaultValue={segment.name} aria-label="الاسم" />
          <input
            type="text"
            name="description"
            defaultValue={segment.description}
            aria-label="الوصف"
          />
          <textarea name="pain" rows={2} defaultValue={segment.pain} aria-label="الوجع" />
          <textarea
            name="criteria"
            rows={3}
            defaultValue={segment.criteria.join("\n")}
            aria-label="المعايير"
          />
          <div className="row between wrapx g8">
            <span className="xs dim">
              تعديل المعايير يلغي العدّ الحالي — الرقم يخص استعلامه، فما ينفع يبقى بعده.
            </span>
            <button type="submit" className="btn-primary btn-sm">
              احفظ
            </button>
          </div>
        </form>
      </details>
    </article>
  );
}
