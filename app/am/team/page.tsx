import { AmBar, Forbidden, ar } from "@/components/Chrome";
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

/**
 * What each role actually confers. The buttons used to say only the role's
 * name, so granting one meant knowing from memory what it opened up — and the
 * grant is not trivially reversible, since promoting the wrong person and then
 * demoting yourself runs into the last-administrator rule.
 */
const ROLE_GRANTS: Record<Role, string> = {
  requester: "يقدّم طلبات فقط",
  account_manager: "يفتح الطابور ويراجع القوائم وينشرها",
  admin: "كل صلاحيات مدير الحسابات، وكمان يغيّر الأدوار",
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
              الأدوار تتحدد أول ما يسجّل الشخص دخوله، وتتغيّر من هنا.
            </span>
            {/* The live count is what makes a locked row explain itself: with one
                administrator, "المشرف الوحيد" reads as a rule rather than a bug. */}
            <span className="xs dim">
              {ar(accounts.length)} حساب · {ar(admins)} مشرف
              {admins === 1 ? " — لازم يبقى واحد على الأقل" : ""}
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
              return (
                <div className="tr tr-team" key={account.id}>
                  <div className="row g10">
                    <div className="avatar sm">{account.initial}</div>
                    <div className="stack g4">
                      <strong className="sm">{account.displayName}</strong>
                      <span className="xs dim lat">{account.email}</span>
                    </div>
                  </div>

                  <div className="stack g4">
                    <span className="sm muted">{ROLE_LABEL[account.role]}</span>
                    <span className="xs dim">{ROLE_GRANTS[account.role]}</span>
                  </div>

                  {/* No "last administrator" branch here: reaching this screen
                      requires being an admin, so another account that is the
                      only admin cannot exist. repo.setAccountRole still refuses
                      it — the action is a POST endpoint reachable directly, and
                      that check is the one that runs. */}
                  {isSelf ? (
                    <span className="xs dim">دورك — يغيّره مشرف آخر</span>
                  ) : (
                    <div className="row g6 wrapx">
                      {(Object.keys(ROLE_LABEL) as Role[])
                        .filter((role) => role !== account.role)
                        .map((role) => (
                          <form action={grantRole} key={role}>
                            <input type="hidden" name="accountId" value={account.id} />
                            <input type="hidden" name="role" value={role} />
                            <button
                              type="submit"
                              className="btn btn-sm"
                              title={ROLE_GRANTS[role]}
                            >
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
