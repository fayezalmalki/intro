import Link from "next/link";

/**
 * Next.js's built-in 404 is English and, rendered inside dir="rtl", puts its
 * full stop on the wrong side — it reads ".This page could not be found404".
 * This replaces it everywhere, including on the redirect chain a signed-out
 * visitor follows.
 */
export default function NotFound() {
  return (
    <div className="login-page">
      <div className="stack g16 narrow" style={{ width: "100%", textAlign: "center" }}>
        <span className="logo" style={{ fontSize: 22 }}>
          intro<span>.</span>
        </span>
        <h1>ما لقينا هذي الصفحة.</h1>
        <span className="sm muted">
          يمكن الرابط قديم، أو الطلب اللي تدور عليه انحذف.
        </span>
        <div className="row g10" style={{ justifyContent: "center" }}>
          <Link href="/" className="btn btn-primary">
            ابدأ Intro جديد
          </Link>
        </div>
      </div>
    </div>
  );
}
