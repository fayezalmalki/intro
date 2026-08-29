import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBar, ar } from "@/components/Chrome";
import { DraftReview, type ReviewPerson } from "@/components/gtm/DraftReview";
import { Paywall } from "@/components/gtm/Paywall";
import { currentAccount } from "@/lib/session";
import { loadRun } from "@/lib/gtm/repo";
import { sendingEnabled } from "@/lib/env";
import { balanceOf } from "@/lib/credits";
import { scoped } from "@/lib/db/scoped";
import { db } from "@/lib/db";
import { changeTemplate } from "@/lib/gtm/actions";
import { TEMPLATES } from "@/lib/gtm/compose";
import { paymentProvider } from "@/lib/payments/provider";

export const dynamic = "force-dynamic";

/**
 * Approval, and the paywall behind it.
 *
 * Access: signed-in, and every read is scoped to the account — `loadRun`
 * refuses another account's run, and the ledger comes through
 * `lib/db/scoped.ts` rather than a bare query. A run id belonging to someone
 * else renders a 404, not a refusal, so the page does not confirm which ids
 * exist.
 *
 * The paywall's placement is Explee's one genuinely good idea: everything above
 * it — the profile, the segments, the counts, the people, the letters — is
 * visible and free, and money is only mentioned at the point of sending. Its
 * tactics are not kept. There is no countdown on this page, no "6 spots left",
 * no invented testimonial and no result statistic, because none of those would
 * be true.
 */
export default async function ReviewPage({ params }: { params: Promise<{ runId: string }> }) {
  const account = await currentAccount();
  const { runId } = await params;
  const bundle = await loadRun(runId, account.id);
  if (!bundle) notFound();

  const ledger = await scoped(db, account.id).ledger();
  const balance = balanceOf(
    {
      accounts: [], people: [], requests: [], pipelines: [], outreach: [], lists: [],
      suppressions: [], sendAttempts: [], audit: [],
      ledger: ledger.map((l) => ({ ...l, ref: l.ref ?? undefined })),
    },
    account.id,
  );

  const draftByPerson = new Map(bundle.drafts.map((d) => [d.personId, d]));
  const people: ReviewPerson[] = bundle.people
    .filter((p) => p.collectedAt && p.fullName)
    .map((p) => {
      const draft = draftByPerson.get(p.id);
      return {
        id: p.id,
        fullName: p.fullName,
        title: p.title,
        companyName: p.companyName,
        linkedinUrl: p.linkedinUrl,
        email: p.email,
        emailStatus: p.emailStatus,
        isFixture: p.source === "fixture",
        draft: draft
          ? {
              id: draft.id,
              subjectAr: draft.subjectAr,
              bodyAr: draft.bodyAr,
              subjectEn: draft.subjectEn,
              bodyEn: draft.bodyEn,
              lang: draft.lang,
              status: draft.status,
              specifics: draft.specifics,
              editedByUser: draft.editedByUser,
              providerMessageId: draft.providerMessageId,
            }
          : undefined,
      };
    });

  const approved = bundle.drafts.filter((d) => d.status === "approved").length;
  const provider = paymentProvider();

  return (
    <>
      <AppBar account={account} />
      <div className="wrap">
        <div className="stack g20" style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div className="row between wrapx g12" style={{ alignItems: "baseline" }}>
            <div className="stack g4">
              <Link href={`/gtm/${runId}`} className="sm dim">
                ← رجوع للجلسة
              </Link>
              <h1>مراجعة الرسائل</h1>
            </div>
            <div className="row g10 wrapx">
              <span className="chip">{ar(people.length)} شخص</span>
              <span className="chip on">{ar(approved)} معتمدة</span>
              <span className="chip">رصيد الإرسال: {ar(balance)}</span>
            </div>
          </div>

          <form action={changeTemplate} className="card row between wrapx g12">
            <input type="hidden" name="runId" value={runId} />
            <div className="stack g4">
              <strong className="sm">قالب الرسالة</strong>
              <span className="sm muted">
                تغيير القالب يعيد كتابة المسودات اللي ما عدّلتها. اللي عدّلتها تبقى كما هي.
              </span>
            </div>
            <div className="row g8 wrapx">
              {TEMPLATES.map((t) => (
                <button key={t.id} type="submit" name="template" value={t.id} className="btn btn-sm">
                  {t.labelAr}
                </button>
              ))}
            </div>
          </form>

          <DraftReview
            runId={runId}
            people={people}
            sendingEnabled={sendingEnabled}
            englishComplete={Boolean(bundle.profile?.sellsEn)}
          />

          <Paywall
            runId={runId}
            balance={balance}
            approved={approved}
            providerName={provider.name}
            isTest={provider.isTest}
          />
        </div>
      </div>
    </>
  );
}
