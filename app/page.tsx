import { AppBar } from "@/components/Chrome";
import { currentAccount } from "@/lib/session";
import { createRequest } from "@/lib/actions";

const EXAMPLES = [
  "أدور وظيفة قيادية في الـ Product في شركات تقنية سعودية.",
  "أبي أوصل للشخص المسؤول عن الشراكات في شركات التأمين.",
  "أبي أبيع منصة مدفوعات للبنوك — مين المسؤول عن Open Banking؟",
];

export default async function NewRequestPage() {
  const account = await currentAccount();
  return (
    <>
      <AppBar account={account} />
      <div className="wrap">
        <div className="narrow stack g26" style={{ paddingTop: 40 }}>
          <div className="stack g12">
            <h1>وش تبغى تحقق؟</h1>
            <p className="muted">اكتب بالعربي أو الإنجليزي. سطر واحد يكفي.</p>
          </div>

          <form action={createRequest} className="stack g14">
            <textarea
              name="rawText"
              rows={4}
              required
              defaultValue={EXAMPLES[0]}
              aria-label="طلبك"
            />
            <div className="row between">
              <span className="sm dim">نفهم طلبك أولًا، ونعرضه عليك قبل ما نبدأ.</span>
              <button type="submit" className="btn-primary">
                كمّل ←
              </button>
            </div>
          </form>

          <div className="stack g10">
            <span className="eyebrow">أمثلة</span>
            {EXAMPLES.map((ex) => (
              <form action={createRequest} key={ex}>
                <input type="hidden" name="rawText" value={ex} />
                <button type="submit" className="btn-ghost sm" style={{ textAlign: "start", width: "100%", justifyContent: "flex-start" }}>
                  «{ex}»
                </button>
              </form>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
