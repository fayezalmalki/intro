import Link from "next/link";
import { notFound } from "next/navigation";
import { AmBar, ar, Forbidden } from "@/components/Chrome";
import { attachPipeline } from "@/lib/actions";
import { accountForPage } from "@/lib/session";
import { loadLists, loadRequestContext, merge } from "@/lib/db/loaders";

export const dynamic = "force-dynamic";

const SAMPLE_PASTE = `linkedin.com/in/layan-m-product
linkedin.com/in/noura-a-product
Reem S.\tمديرة منتج أولى\tشركة تأمين
Mansour T.\tرئيس المنتج\tشركة تقنية · الرياض`;

const SAMPLE_CSV = `Full name,Title,Company,LinkedIn URL,Email
Layan M.,رئيسة المنتج,شركة تأمين رقمي,linkedin.com/in/layan-m-product,layan@example.sa
Noura A.,مديرة المنتج,منصة مدفوعات,linkedin.com/in/noura-a-product,noura@example.sa
Mansour T.,رئيس المنتج,شركة تقنية,,mansour@example.sa`;

export default async function AttachPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  // Defence in depth. The actions each check the role too — that is the real
  // boundary — but a requester who reaches this URL should be told so, not
  // shown a crash page.
  const account = await accountForPage("account_manager");
  if (!account) return <Forbidden area="لوحة مدير الحساب مخصصة لمديري الحسابات." />;
  const { id } = await params;
  const { tab = "csv" } = await searchParams;
  const db = merge(await loadRequestContext(id), await loadLists());
  const req = db.requests.find((r) => r.id === id);
  if (!req) notFound();

  const nextVersion =
    Math.max(0, ...db.pipelines.filter((p) => p.requestId === id).map((p) => p.version)) + 1;

  return (
    <>
      <AmBar on="queue" account={account} />
      <div className="wrap">
        <div className="row g10" style={{ alignItems: "baseline" }}>
          <Link href={`/am/requests/${id}`} className="sm dim">
            الطلب /
          </Link>
          <h2>أرفق قائمة جاهزة</h2>
        </div>

        <div style={{ height: 18 }} />

        <div className="tbl">
          <nav className="tabs">
            <Link href={`/am/requests/${id}/attach?tab=csv`} className={tab === "csv" ? "on" : ""}>
              رفع ملف
            </Link>
            <Link href={`/am/requests/${id}/attach?tab=paste`} className={tab === "paste" ? "on" : ""}>
              لصق صفوف أو روابط
            </Link>
            <Link href={`/am/requests/${id}/attach?tab=list`} className={tab === "list" ? "on" : ""}>
              من قائمة جاهزة
            </Link>
          </nav>

          {tab === "list" ? (
            <div className="stack g16" style={{ padding: "22px 24px" }}>
              <p className="sm muted">اختر قائمة جاهزة. تُرفق كمسودة النسخة {ar(nextVersion)}، وتقدر تنقّحها وتكتب أسباب التوافق قبل النشر.</p>
              <div className="stack g10">
                {db.lists.map((l) => (
                  <form action={attachPipeline} key={l.id} className="card row between g14">
                    <input type="hidden" name="requestId" value={id} />
                    <input type="hidden" name="source" value="from_list" />
                    <input type="hidden" name="listId" value={l.id} />
                    <div className="stack g4 grow">
                      <strong className="sm">{l.name}</strong>
                      <span className="sm muted">{l.desc}</span>
                      <span className="xs dim">{ar(l.personIds.length)} أشخاص</span>
                    </div>
                    <button type="submit" className="btn-sm btn-strong">
                      أرفق
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ) : (
            <form action={attachPipeline} className="stack g16" style={{ padding: "22px 24px" }}>
              <input type="hidden" name="requestId" value={id} />
              <input type="hidden" name="source" value={tab === "csv" ? "imported_csv" : "pasted"} />
              <p className="sm muted">
                {tab === "csv"
                  ? "الصق محتوى الملف (CSV مع صف عناوين). نطابق الأعمدة تلقائيًا وندمج المكرر."
                  : "الصق صفوفًا من جدول، أو روابط LinkedIn — سطرًا لكل شخص."}
              </p>
              <textarea
                name="rows"
                rows={9}
                className="lat"
                defaultValue={tab === "csv" ? SAMPLE_CSV : SAMPLE_PASTE}
                aria-label="الصفوف"
                style={{ fontSize: "var(--text-sm)", lineHeight: 2 }}
              />
              <div className="row between">
                <span className="sm dim">
                  الإرفاق ينشئ النسخة {ar(nextVersion)} كمسودة معتمدة — تراجعها وتنشرها بنقرة. الرسائل المُرسلة والتعارفات الجارية تبقى كما هي.
                </span>
                <button type="submit" className="btn-primary">
                  أرفق كالنسخة {ar(nextVersion)}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
