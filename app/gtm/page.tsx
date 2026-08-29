import Link from "next/link";
import { AppBar, ar } from "@/components/Chrome";
import { currentAccount } from "@/lib/session";
import { startRun } from "@/lib/gtm/actions";
import { listRuns } from "@/lib/gtm/repo";
import { hostOf } from "@/lib/gtm/profile";

export const dynamic = "force-dynamic";

/**
 * One field.
 *
 * Everything the flow needs is derivable from a company's own website, and
 * asking for anything else here would be asking the user to do the work they
 * came to have done. The examples underneath are links, not prefilled values:
 * a form that starts full of someone else's URL invites a submit nobody meant.
 *
 * Access: signed-in only, through `isProtected("/gtm")` in middleware for the
 * redirect and `currentAccount()` here — and, more importantly, inside every
 * action in lib/gtm/actions.ts, which is the actual boundary.
 */
export default async function GtmIndex({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const account = await currentAccount();
  const { error } = await searchParams;
  const runs = await listRuns(account.id);
  const recent = [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  return (
    <>
      <AppBar account={account} />
      <div className="wrap">
        <div className="mid stack g26" style={{ paddingTop: 44 }}>
          <div className="stack g12">
            <span className="eyebrow">من الموقع إلى أول رسالة</span>
            <h1>حط رابط موقعك، ونبني لك خطة الوصول.</h1>
            <p className="muted" style={{ maxWidth: "56ch" }}>
              نقرأ موقعك، نستخرج شرائح عملائك، ونعدّ الشركات المطابقة من بحث حقيقي.
              كل هذا مجاني وتشوفه قبل أي دفع.
            </p>
          </div>

          {error && <div className="alert">{error}</div>}

          <form action={startRun} className="hero-form">
            <input
              type="text"
              name="website"
              required
              dir="ltr"
              placeholder="example.sa"
              aria-label="رابط موقع شركتك"
              autoComplete="url"
            />
            <button type="submit" className="btn-primary">
              حلّل الموقع ←
            </button>
          </form>

          <div className="checks">
            <span>✓ ما نطلب بطاقة</span>
            <span>✓ الأرقام من بحث حقيقي، وتشوف الاستعلام</span>
            <span>✓ الدفع عند الإرسال فقط</span>
          </div>

          <div className="stack g10">
            <span className="eyebrow">قبل ما تبدأ</span>
            <p className="sm muted" style={{ maxWidth: "60ch" }}>
              تبي تشوف شكل الرسائل أولًا؟{" "}
              <Link href="/examples">اقرأ أمثلة عربية مكتوبة بالكامل</Link> — بدون تسجيل
              وبدون أي طلب بيانات.
            </p>
          </div>

          {recent.length > 0 && (
            <div className="stack g12" style={{ marginTop: 12 }}>
              <span className="eyebrow">جلساتك السابقة</span>
              <div className="stack g8">
                {recent.map((run) => (
                  <Link
                    key={run.id}
                    href={`/gtm/${run.id}`}
                    className="card row between g12"
                    style={{ color: "var(--ink)" }}
                  >
                    <span className="stack g4">
                      <strong className="sm lat">{hostOf(run.websiteUrl)}</strong>
                      <span className="xs dim">
                        {ar(new Date(run.createdAt).toLocaleDateString("ar-SA"))}
                      </span>
                    </span>
                    <span className="chip">{RUN_LABEL[run.status]}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const RUN_LABEL: Record<string, string> = {
  running: "جارية",
  ready: "جاهزة",
  failed: "تعثّرت",
};
