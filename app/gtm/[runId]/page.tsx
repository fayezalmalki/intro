import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBar, ar } from "@/components/Chrome";
import { Stepper } from "@/components/gtm/Stepper";
import { SegmentCard } from "@/components/gtm/SegmentCard";
import { ProfileCard } from "@/components/gtm/ProfileCard";
import { CompanyPicker } from "@/components/gtm/CompanyPicker";
import { currentAccount } from "@/lib/session";
import { loadRun } from "@/lib/gtm/repo";
import { gtmFixturesEnabled } from "@/lib/env";
import { loadExampleRows, rerunFreeSteps, saveSegment } from "@/lib/gtm/actions";
import { hostOf } from "@/lib/gtm/profile";

export const dynamic = "force-dynamic";

/**
 * The run.
 *
 * Access: signed-in, and `loadRun` is scoped to the account — another account's
 * run id returns null and this renders a 404 rather than a refusal, so the page
 * does not confirm which run ids exist.
 *
 * The order on screen is the order of the rail, which is the order the work
 * actually happened in. Nothing here is a summary of something that ran
 * elsewhere: the profile is the row that was written, each count is the number
 * its own printed query returned, and the companies table holds exactly the ids
 * the free search came back with.
 */
export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const account = await currentAccount();
  const { runId } = await params;
  const bundle = await loadRun(runId, account.id);
  if (!bundle) notFound();

  const { run, profile, segments, companies, people } = bundle;
  const revealed = people.filter((p) => p.collectedAt).length;
  const hasFixtures = companies.some((c) => c.source === "fixture") || people.some((p) => p.source === "fixture");

  return (
    <>
      <AppBar account={account} />
      <div className="wrap">
        <div className="stack g20" style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div className="row between wrapx g12" style={{ alignItems: "baseline" }}>
            <div className="stack g4">
              <span className="eyebrow">خطة الوصول</span>
              <h1 className="lat">{hostOf(run.websiteUrl)}</h1>
            </div>
            <div className="row g10">
              <form action={rerunFreeSteps}>
                <input type="hidden" name="runId" value={runId} />
                <button type="submit" className="btn btn-sm">
                  أعد التحليل
                </button>
              </form>
              {revealed > 0 && (
                <Link href={`/gtm/${runId}/review`} className="btn btn-primary btn-sm">
                  راجع الرسائل ({ar(revealed)}) ←
                </Link>
              )}
            </div>
          </div>

          {hasFixtures && <FixtureBanner />}

          <div className="gtm-shell">
            <Stepper steps={run.steps ?? []} />

            <div className="stack g20">
              <ProfileCard runId={runId} profile={profile} steps={run.steps ?? []} />

              {profile && profile.competitors.length > 0 && (
                <section className="stack g12">
                  <div className="stack g4">
                    <h2>منافسون محتملون</h2>
                    <span className="sm muted">
                      اقتراح من التحليل، مو من مزوّد بيانات — تحقق منها بنفسك.
                    </span>
                  </div>
                  <div className="row wrapx g8">
                    {profile.competitors.map((c) => (
                      <span key={c.name} className="chip">
                        {c.name}
                        {c.website ? <span className="lat dim"> · {c.website}</span> : null}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <section className="stack g12">
                <div className="row between wrapx g10" style={{ alignItems: "baseline" }}>
                  <div className="stack g4">
                    <h2>الشرائح</h2>
                    <span className="sm muted">
                      عدّل أي شريحة أو احذفها. كل رقم تحته الاستعلام اللي طلعه.
                    </span>
                  </div>
                </div>

                {segments.length === 0 ? (
                  <div className="card stack g8">
                    <strong className="sm">ما فيه شرائح بعد.</strong>
                    <span className="sm muted">
                      خطوة «نحدد الشرائح» ما اكتملت. راجع الرسالة في الشريط، أو أعد التحليل.
                    </span>
                  </div>
                ) : (
                  <div className="gtm-segments">
                    {segments.map((segment) => (
                      <SegmentCard
                        key={segment.id}
                        runId={runId}
                        segment={segment}
                        companies={companies.filter((c) => c.segmentId === segment.id)}
                      />
                    ))}
                  </div>
                )}

                <details className="card">
                  <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "var(--text-sm)" }}>
                    + أضف شريحة من عندك
                  </summary>
                  <form action={saveSegment} className="stack g10" style={{ marginTop: 14 }}>
                    <input type="hidden" name="runId" value={runId} />
                    <input type="text" name="name" required placeholder="اسم الشريحة" aria-label="اسم الشريحة" />
                    <input type="text" name="description" placeholder="سطر يوصفهم" aria-label="وصف الشريحة" />
                    <input type="text" name="pain" placeholder="الوجع اللي تعالجه لهم" aria-label="الوجع" />
                    <textarea
                      name="criteria"
                      rows={3}
                      placeholder={"معيار في كل سطر\nمثال: مقرها السعودية\nمثال: أكثر من ٥٠ موظف"}
                      aria-label="المعايير"
                    />
                    <div className="row between">
                      <span className="xs dim">
                        الشريحة اللي تكتبها ما لها عدد إلا بعد ما تشغّل العدّ عليها.
                      </span>
                      <button type="submit" className="btn-primary btn-sm">
                        أضف
                      </button>
                    </div>
                  </form>
                </details>
              </section>

              <CompanyPicker
                runId={runId}
                segments={segments}
                companies={companies}
                people={people}
              />

              {gtmFixturesEnabled && revealed === 0 && (
                <section className="card stack g10">
                  <strong className="sm">ما فيه مفتاح Coresignal في هذي البيئة</strong>
                  <span className="sm muted">
                    الاسم والبريد شراء عند المزوّد، فبدون مفتاح ما فيه أشخاص نكشفهم. تقدر
                    تعبّي صفوف مثال مكتوبة يدويًا عشان تشوف شاشة المراجعة والرسائل — وهي
                    مُعلّمة كمثال في كل مكان تظهر فيه.
                  </span>
                  <form action={loadExampleRows}>
                    <input type="hidden" name="runId" value={runId} />
                    <button type="submit" className="btn btn-strong btn-sm">
                      عبّي صفوف مثال (تطوير فقط)
                    </button>
                  </form>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Unconditional whenever a fixture row is present, and driven off the row's own
 * `source` rather than off the feature flag. A flag can be wrong; the row
 * cannot.
 */
function FixtureBanner() {
  return (
    <div className="alert row g10" style={{ alignItems: "flex-start" }}>
      <strong>صفوف مثال</strong>
      <span>
        بعض الصفوف هنا مكتوبة يدويًا للعرض، وما جت من مزوّد بيانات. لا تعتمد عليها في
        تواصل حقيقي.
      </span>
    </div>
  );
}
