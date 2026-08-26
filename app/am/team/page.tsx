import { AmBar, Forbidden } from "@/components/Chrome";
import { grantRole } from "@/lib/actions";
import { listAccounts } from "@/lib/db/repo";
import { accountForPage } from "@/lib/session";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  requester: "مُقدّم طلب",
  account_manager: "مدير حسابات",
  admin: "مشرف",
};

const REFUSED: Record<string, string> = {
  self: "ما تقدر تغيّر دورك بنفسك. خلّ مشرفًا آخر يسويها.",
  last_admin: "لازم يبقى مشرف واحد على الأقل. رقِّ شخصًا آخر أولًا.",
  unknown_account: "ما لقينا هذا الحساب.",
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ refused?: string }>;
}) {
  // Admin only. An account manager who could grant this role could promote
  // themselves, which would make the two roles the same role.
  const admin = await accountForPage("admin");
  if (!admin) return <Forbidden area="تغيير الأدوار مخصص للمشرفين." />;
  const { refused } = await searchParams;
  const accounts = await listAccounts();
  const admins = accounts.filter((a) => a.role === "admin").length;

  return (
    <>
      <AmBar on="team" account={admin} />
      <div className="wrap">
        <div className="mid stack g16">
          <div className="stack g6">
            <h2>الفريق</h2>
            <span className="sm muted">
              الأدوار تتحدد أول ما يسجّل الشخص دخوله، وتتغيّر من هنا. مدير الحسابات يفتح الطابور
              ويراجع القوائم؛ المشرف يقدر يغيّر الأدوار كمان.
            </span>
          </div>

          {refused && <div className="alert">{REFUSED[refused] ?? "ما قدرنا نغيّر الدور."}</div>}

          <div className="tbl">
            <div className="tr head tr-team">
              <span>الحساب</span>
              <span>الدور</span>
              <span>تغيير</span>
            </div>
            {accounts.map((account) => {
              const isSelf = account.id === admin.id;
              const isLastAdmin = account.role === "admin" && admins === 1;
              return (
                <div className="tr tr-team" key={account.id}>
                  <div className="row g10">
                    <div className="avatar sm">{account.initial}</div>
                    <div className="stack g4">
                      <strong className="sm">{account.displayName}</strong>
                      <span className="xs dim lat">{account.email}</span>
                    </div>
                  </div>

                  <span className="sm muted">{ROLE_LABEL[account.role]}</span>

                  {isSelf ? (
                    <span className="xs dim">دورك — يغيّره مشرف آخر</span>
                  ) : isLastAdmin ? (
                    <span className="xs dim">المشرف الوحيد — رقِّ غيره أولًا</span>
                  ) : (
                    <div className="row g6 wrapx">
                      {(Object.keys(ROLE_LABEL) as Role[])
                        .filter((role) => role !== account.role)
                        .map((role) => (
                          <form action={grantRole} key={role}>
                            <input type="hidden" name="accountId" value={account.id} />
                            <input type="hidden" name="role" value={role} />
                            <button type="submit" className="btn btn-sm">
                              {ROLE_LABEL[role]}
                            </button>
                          </form>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
