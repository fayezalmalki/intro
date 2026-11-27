import { Console, Forbidden } from "@/components/Chrome";
import { inviteBack } from "@/lib/actions";
import { invitedSignups, listSignups } from "@/lib/db/repo";
import { accountForPage } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Where a sign-up stopped: asked for a code, signed in, or finished onboarding. */
function stage(r: { verifiedAt: string | null; onboardedAt: string | null }) {
  if (r.onboardedAt) return { label: "أكمل التسجيل", dot: "var(--accent-line)" };
  if (r.verifiedAt) return { label: "دخل ولم يكمل", dot: "var(--accent)" };
  return { label: "طلب رمزًا ولم يدخل", dot: "var(--line)" };
}

/** What they were about to do, read off the resumable path. */
function wanted(path: string | null): string {
  if (!path) return "—";
  try {
    const u = new URL(path, "https://intro.sa");
    const q = u.searchParams.get("q");
    if (u.pathname === "/new") return q ? `طلب: ${q}` : "طلب جديد";
    if (u.pathname === "/search") return q ? `بحث (${u.searchParams.get("mode") ?? ""} · ${u.searchParams.get("market") ?? ""}): ${q}` : "بحث";
    return u.pathname;
  } catch {
    return path;
  }
}

/**
 * Everyone who asked for a sign-in code, newest first — including people who
 * never entered it. A lead list for follow-up, and the funnel at a glance.
 */
export default async function SignupsPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  const account = await accountForPage("account_manager");
  if (!account) return <Forbidden area="قائمة التسجيلات لمديري الحسابات فقط." />;
  const [rows, invited] = await Promise.all([listSignups(300), invitedSignups()]);
  const notice = { sent: "أرسلنا الدعوة.", already: "سبق أرسلنا له دعوة.", skipped: "هذا الشخص دخل قبل، ما يحتاج دعوة.", failed: "ما قدرنا نرسل، شوف لوحة المتابعة للسبب." }[invite ?? ""];
  const codes = rows.length;
  const verified = rows.filter((r) => r.verifiedAt).length;
  const onboarded = rows.filter((r) => r.onboardedAt).length;

  return (
    <Console on="signups" account={account}>
      <div className="wrap">
        <div className="console-bar"><h1>التسجيلات</h1></div>
        <div className="kpis" style={{ marginBottom: 24 }}>
          <div className="kpi"><div className="kpi-label">طلبوا رمزًا</div><div className="kpi-figure">{codes}</div></div>
          <div className="kpi"><div className="kpi-label">دخلوا</div><div className="kpi-figure">{verified}</div></div>
          <div className="kpi"><div className="kpi-label">أكملوا التسجيل</div><div className="kpi-figure">{onboarded}</div></div>
        </div>
        {notice && <p className="note" style={{ marginBottom: 16 }}>{notice}</p>}
        <div className="tbl"><table>
          <thead><tr><th>البريد</th><th>كان يبي</th><th>المرحلة</th><th>اللغة</th><th>التاريخ</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const s = stage(r);
              return (
                <tr key={r.id}>
                  <td dir="ltr" style={{ textAlign: "right" }}>{r.email}</td>
                  <td dir="auto">{wanted(r.pending)}</td>
                  <td><span className="dot" style={{ background: s.dot }} /> {s.label}</td>
                  <td>{r.lang ?? "—"}</td>
                  <td dir="ltr" style={{ textAlign: "right" }}>{r.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td>
                    {!r.verifiedAt && (invited.has(r.email) ? <span className="muted">دُعي</span> : (
                      <form action={inviteBack}><input type="hidden" name="email" value={r.email} /><button type="submit" className="btn btn-sm">ادعه يرجع</button></form>
                    ))}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">ما فيه تسجيلات بعد.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </Console>
  );
}
