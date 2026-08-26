import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

/**
 * The only unauthenticated screen in the app. Middleware sends everyone here
 * with `?next=`, so a signed-in visitor who lands here has already arrived —
 * bounce them onward rather than showing a sign-in form they do not need.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Only same-site paths. An open redirect here would let a phishing link send
  // a freshly-signed-in user to an attacker's page carrying the trust of our
  // own domain.
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (await auth()) redirect(target);

  const providers = {
    google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    magicLink: Boolean(process.env.SMTP_PASSWORD),
  };

  return (
    <div className="login-page">
      <div className="stack g26 narrow" style={{ width: "100%" }}>
        <div className="stack g8" style={{ textAlign: "center" }}>
          <span className="logo" style={{ fontSize: 24 }}>
            intro<span>.</span>
          </span>
          <span className="sm muted">سجّل دخولك عشان تكمّل طلبك.</span>
        </div>
        <LoginForm target={target} providers={providers} />
      </div>
    </div>
  );
}
