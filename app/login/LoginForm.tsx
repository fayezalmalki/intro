"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { inputCls, labelCls, primaryBtn, type Lang } from "@/components/site/AuthShell";

type Providers = { google: boolean };

const COPY = {
  en: {
    title: "Welcome to intro.sa",
    sub: "Sign in with your email. We'll send you a 6-digit code — no password to remember.",
    google: "Continue with Google",
    or: "or with email",
    email: "Work email",
    send: "Email me a code",
    wait: "One moment…",
    codeTitle: "Check your inbox",
    codeSub: (e: string) => <>We sent a 6-digit code to <b className="font-latin font-semibold text-ink">{e}</b>. It expires in 10 minutes.</>,
    code: "Sign-in code",
    enter: "Sign in",
    change: "Use a different email",
    resend: "Resend code",
    resendIn: (s: number) => `Resend in ${s}s`,
    resent: "A new code is on its way.",
    tooSoon: "We just sent a code. Give it a minute, then try again.",
    sendFail: "We couldn't send the code. Check the address and try again.",
    offline: "We couldn't reach intro.sa. Check your connection and try again.",
    bad: "That code didn't work, or it's expired. Try again or resend it.",
    fine: "New here? Signing in creates your account and means you agree to our terms and privacy policy.",
  },
  ar: {
    title: "أهلًا بك في انترو",
    sub: "ادخل ببريدك، ونرسل لك رمزًا من ٦ أرقام. بدون كلمة مرور.",
    google: "المتابعة بحساب Google",
    or: "أو بالبريد",
    email: "بريد العمل",
    send: "أرسل لي الرمز",
    wait: "لحظة…",
    codeTitle: "تفقّد بريدك",
    codeSub: (e: string) => <>أرسلنا رمزًا من ٦ أرقام إلى <b className="font-latin font-semibold text-ink" dir="ltr">{e}</b>، وصلاحيته ١٠ دقائق.</>,
    code: "رمز الدخول",
    enter: "دخول",
    change: "استخدم بريدًا آخر",
    resend: "إعادة إرسال الرمز",
    resendIn: (s: number) => `إعادة الإرسال بعد ${s} ث`,
    resent: "أرسلنا لك رمزًا جديدًا.",
    tooSoon: "أرسلنا لك رمزًا للتو. انتظر دقيقة وجرّب مرة ثانية.",
    sendFail: "ما قدرنا نرسل الرمز. تأكد من البريد وجرّب مرة ثانية.",
    offline: "ما قدرنا نتصل بانترو. تأكد من اتصالك وجرّب مرة ثانية.",
    bad: "الرمز غير صحيح أو انتهت صلاحيته. جرّب مرة ثانية أو اطلب رمزًا جديدًا.",
    fine: "أول مرة هنا؟ الدخول ينشئ حسابك، ويعني موافقتك على الشروط وسياسة الخصوصية.",
  },
};

const RESEND_SECONDS = 60;

export function LoginForm({ target, providers, lang }: { target: string; providers: Providers; lang: Lang }) {
  const t = COPY[lang];
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const address = email.trim().toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function requestCode(again = false) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: failure } = await authClient.emailOtp.sendVerificationOtp({ email: address, type: "sign-in" });
      if (failure?.status === 429) setError(t.tooSoon);
      else if (failure) setError(t.sendFail);
      else {
        setStage("code");
        setCooldown(RESEND_SECONDS);
        if (again) setNotice(t.resent);
      }
    } catch {
      setError(t.offline);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(value = code) {
    setBusy(true);
    setError(null);
    try {
      const { error: failure } = await authClient.signIn.emailOtp({ email: address, otp: value.trim() });
      if (failure) {
        setError(t.bad);
        setBusy(false);
      } else {
        window.location.href = target;
      }
    } catch {
      setError(t.offline);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {stage === "email" ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="display font-display text-[28px] leading-[1.1] font-medium tracking-[-1px] text-ink">{t.title}</h1>
            <p className="text-[15px] leading-[23px] text-muted rtl:leading-[26px]">{t.sub}</p>
          </div>

          {providers.google && (
            <>
              <button
                type="button"
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-white text-[15px] font-medium text-ink outline outline-1 -outline-offset-1 outline-line hover:bg-surface"
                disabled={busy}
                onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: target })}
              >
                <GoogleMark />
                {t.google}
              </button>
              <div className="flex items-center gap-3 text-[12.5px] text-subtle">
                <span className="h-px flex-1 bg-line" />{t.or}<span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (valid && !busy) void requestCode();
            }}
          >
            <label className={labelCls} htmlFor="login-email">{t.email}</label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              autoFocus
              className={`${inputCls} font-latin rtl:text-right`}
              placeholder="you@company.sa"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button type="submit" className={primaryBtn} disabled={!valid || busy}>{busy ? t.wait : t.send}</button>
          </form>
          <p className="text-[13px] text-subtle">{t.fine} <a href={`/terms?lang=${lang}`} className="underline hover:text-ink">{lang === "ar" ? "الشروط" : "Terms"}</a> · <a href={`/privacy?lang=${lang}`} className="underline hover:text-ink">{lang === "ar" ? "الخصوصية" : "Privacy"}</a></p>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="display font-display text-[28px] leading-[1.1] font-medium tracking-[-1px] text-ink">{t.codeTitle}</h1>
            <p className="text-[15px] leading-[23px] text-muted rtl:leading-[26px]">{t.codeSub(address)}</p>
          </div>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (code.length === 6 && !busy) void submitCode();
            }}
          >
            <label className={labelCls} htmlFor="login-code">{t.code}</label>
            <input
              id="login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              autoFocus
              maxLength={6}
              className={`${inputCls} h-14 text-center font-latin text-[26px] font-semibold tracking-[0.45em]`}
              value={code}
              onChange={(event) => {
                // Arabic-Indic digits typed on an Arabic keyboard count too.
                const digits = event.target.value
                  .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
                  .replace(/\D/g, "")
                  .slice(0, 6);
                setCode(digits);
                if (digits.length === 6 && !busy) void submitCode(digits);
              }}
            />
            <button type="submit" className={primaryBtn} disabled={code.length !== 6 || busy}>{busy ? t.wait : t.enter}</button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
            <button
              type="button"
              className="cursor-pointer font-medium text-brand disabled:cursor-default disabled:text-subtle"
              disabled={busy || cooldown > 0}
              onClick={() => void requestCode(true)}
            >
              {cooldown > 0 ? t.resendIn(cooldown) : t.resend}
            </button>
            <button
              type="button"
              className="cursor-pointer text-muted hover:text-ink"
              disabled={busy}
              onClick={() => {
                setStage("email");
                setCode("");
                setError(null);
                setNotice(null);
              }}
            >
              {t.change}
            </button>
          </div>
        </>
      )}

      {notice && !error && <p role="status" className="rounded-xl bg-success-soft px-3.5 py-2.5 text-[13.5px] text-success-ink">{notice}</p>}
      {error && <p role="alert" className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13.5px] text-accent-ink">{error}</p>}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.5 5-4.4 7l6.7 5.2C42.2 36 45 30.6 45 24z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.9-12.5-9.2l-7.1 5.5C8.1 41 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 28.3A13.4 13.4 0 0 1 10.8 24c0-1.5.3-3 .7-4.3l-7.1-5.6A22 22 0 0 0 2 24c0 3.6.9 6.9 2.4 9.9z" />
      <path fill="#EA4335" d="M24 10.6c3.2 0 6 1.1 8.2 3.2l6.1-6.1C34.9 4.2 29.9 2 24 2 15.4 2 8.1 7 4.4 14.1l7.1 5.6C13.3 14.5 18.2 10.6 24 10.6z" />
    </svg>
  );
}
