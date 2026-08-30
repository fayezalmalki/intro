import { ar } from "@/components/Chrome";
import type { CompanyRow, PersonRow, SegmentRow } from "@/lib/gtm/repo";
import { findPeople, toggleCompany, togglePerson } from "@/lib/gtm/actions";
import { COMPANY_COLLECT_CREDITS, PERSON_COLLECT_CREDITS, planCollect } from "@/lib/gtm/spend";
import { SpendButton } from "./SpendButton";

/**
 * Narrow for free, buy on purpose.
 *
 * Both tables here are lists of vendor ids, because both a company name and a
 * person's name are purchases — the search endpoints return ids and a total,
 * and nothing else. Keeping and un-keeping a row is free and reversible; the
 * only thing that costs anything is the button at the bottom, and it says how
 * much before it is pressed.
 *
 * The price shown and the price charged are the same number: it is posted with
 * the form and `confirmSpend` refuses the spend if the selection has moved
 * since. A confirmation that does not name the amount is not a confirmation.
 */
export function CompanyPicker({
  runId,
  segments,
  companies,
  people,
}: {
  runId: string;
  segments: SegmentRow[];
  companies: CompanyRow[];
  people: PersonRow[];
}) {
  if (companies.length === 0) return null;

  const companyPlan = planCollect(
    companies.map((c) => ({
      id: c.id,
      kept: c.kept,
      collectedAt: c.enrichedAt,
      coresignalId: c.coresignalId,
    })),
    COMPANY_COLLECT_CREDITS,
  );

  const peoplePlan = planCollect(
    people.map((p) => ({
      id: p.id,
      kept: p.kept,
      collectedAt: p.collectedAt,
      coresignalId: p.coresignalId,
    })),
    PERSON_COLLECT_CREDITS,
  );

  const byId = new Map(segments.map((s) => [s.id, s]));

  return (
    <section className="stack g16">
      <div className="stack g4">
        <h2>الشركات وأصحاب القرار</h2>
        <span className="sm muted">
          البحث مجاني ويرجّع معرّفات فقط. الاسم والبريد شراء — ٬{ar(COMPANY_COLLECT_CREDITS)}
          {" "}رصيد للشركة و{ar(PERSON_COLLECT_CREDITS)} للشخص — وما نشتري إلا اللي تختاره.
        </span>
      </div>

      <div className="tbl">
        <div className="tr head tr-gtm">
          <span>الشركة</span>
          <span>الشريحة</span>
          <span>الحالة</span>
          <span>اختيار</span>
        </div>
        {companies.slice(0, 40).map((c) => (
          <div key={c.id} className={`tr tr-gtm${c.kept ? "" : ""}`}>
            <span className="stack g4">
              <strong className="sm">
                {c.name || <span className="dim lat">#{c.coresignalId ?? "—"}</span>}
              </strong>
              {c.website && <span className="xs dim lat">{c.website}</span>}
              {c.source === "fixture" && <span className="xs" style={{ color: "var(--danger)" }}>صف مثال</span>}
            </span>
            <span className="sm muted">{byId.get(c.segmentId)?.name ?? "—"}</span>
            <span className="sm">
              {c.enrichedAt ? (
                <span className="chip on">مكشوفة</span>
              ) : (
                <span className="chip">معرّف فقط</span>
              )}
            </span>
            <form action={toggleCompany}>
              <input type="hidden" name="runId" value={runId} />
              <input type="hidden" name="companyId" value={c.id} />
              <input type="hidden" name="kept" value={c.kept ? "0" : "1"} />
              <button type="submit" className={`btn btn-sm${c.kept ? " btn-on" : ""}`}>
                {c.kept ? "محفوظة ✓" : "احفظ"}
              </button>
            </form>
          </div>
        ))}
      </div>

      <div className="card row between wrapx g14">
        <div className="stack g4">
          <strong className="sm">اكشف أسماء الشركات المحفوظة</strong>
          <span className="sm muted">
            {companyPlan.buy.length === 0
              ? "ما فيه شركات محفوظة تحتاج شراء."
              : `${ar(companyPlan.buy.length)} شركة × ${ar(COMPANY_COLLECT_CREDITS)} رصيد = ${ar(companyPlan.credits)} رصيد عند المزوّد.`}
            {companyPlan.alreadyOwned.length > 0 &&
              ` ${ar(companyPlan.alreadyOwned.length)} مكشوفة مسبقًا وما تنحسب.`}
          </span>
        </div>
        <SpendButton
          kind="companies"
          runId={runId}
          credits={companyPlan.credits}
          rows={companyPlan.buy.length}
        />
      </div>

      {companies.some((c) => c.kept) && (
        <div className="card row between wrapx g14">
          <div className="stack g4">
            <strong className="sm">دوّر على أصحاب القرار في الشركات المحفوظة</strong>
            <span className="sm muted">بحث مجاني. يرجّع عدد ومعرّفات، بدون أسماء.</span>
          </div>
          <form action={findPeople}>
            <input type="hidden" name="runId" value={runId} />
            <button type="submit" className="btn btn-strong btn-sm">
              ابحث — مجانًا
            </button>
          </form>
        </div>
      )}

      {people.length > 0 && (
        <>
          <div className="tbl">
            <div className="tr head tr-gtm">
              <span>الشخص</span>
              <span>الشركة</span>
              <span>الحالة</span>
              <span>اختيار</span>
            </div>
            {people.slice(0, 60).map((p) => (
              <div key={p.id} className="tr tr-gtm">
                <span className="stack g4">
                  <strong className="sm">
                    {p.fullName || <span className="dim lat">#{p.coresignalId ?? "—"}</span>}
                  </strong>
                  {p.title && <span className="xs dim">{p.title}</span>}
                  {p.source === "fixture" && (
                    <span className="xs" style={{ color: "var(--danger)" }}>صف مثال</span>
                  )}
                </span>
                <span className="sm muted">{p.companyName || "—"}</span>
                <span className="sm">
                  {p.collectedAt ? <span className="chip on">مكشوف</span> : <span className="chip">معرّف فقط</span>}
                </span>
                <form action={togglePerson}>
                  <input type="hidden" name="runId" value={runId} />
                  <input type="hidden" name="personId" value={p.id} />
                  <input type="hidden" name="kept" value={p.kept ? "0" : "1"} />
                  <button type="submit" className={`btn btn-sm${p.kept ? " btn-on" : ""}`}>
                    {p.kept ? "محفوظ ✓" : "احفظ"}
                  </button>
                </form>
              </div>
            ))}
          </div>

          <div className="card row between wrapx g14">
            <div className="stack g4">
              <strong className="sm">اكشف الأشخاص المحفوظين واكتب رسائلهم</strong>
              <span className="sm muted">
                {peoplePlan.buy.length === 0
                  ? "ما فيه أشخاص محفوظين يحتاجون شراء."
                  : `${ar(peoplePlan.buy.length)} شخص × ${ar(PERSON_COLLECT_CREDITS)} رصيد = ${ar(peoplePlan.credits)} رصيد عند المزوّد. هذي العملية الوحيدة اللي تصرف.`}
              </span>
            </div>
            <SpendButton
              kind="people"
              runId={runId}
              credits={peoplePlan.credits}
              rows={peoplePlan.buy.length}
            />
          </div>
        </>
      )}
    </section>
  );
}
