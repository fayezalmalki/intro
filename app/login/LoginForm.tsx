"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

type Providers = { google: boolean; magicLink: boolean };

const DEV = process.env.NODE_ENV === "development";

export function LoginForm({ target, providers }: { target: string; providers: Providers }) {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<"email" | "code" | "sent">("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function requestCode() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (response.status === 429) {
        setError("أرسلنا رمزًا قبل شوي. انتظر دقيقة وحاول مرة ثانية.");
      } else if (!response.ok) {
        setError("ما قدرنا نرسل الرمز. تأكد من البريد وحاول مرة ثانية.");
      } else {
        setStage("code");
      }
    } catch {
      setError("ما قدرنا نوصل للخادم. تأكد من اتصالك وحاول مرة ثانية.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    setBusy(true);
    setError(null);
    // redirect:false so a wrong code re-renders this form with a message,
    // instead of throwing the visitor onto NextAuth's own error page.
    const result = await signIn("email-otp", {
      email: email.trim(),
      code: code.trim(),
      redirect: false,
    });
    setBusy(false);
    if (result?.error) setError("الرمز غير صحيح أو انتهت صلاحيته.");
    else window.location.href = target;
  }

  async function sendMagicLink() {
    setBusy(true);
    setError(null);
    const result = await signIn("nodemailer", {
      email: email.trim(),
      redirect: false,
      callbackUrl: target,
    });
    setBusy(false);
    if (result?.error) setError("ما قدرنا نرسل الرابط. حاول مرة ثانية.");
    else setStage("sent");
  }

  if (stage === "sent") {
    return (
      <div className="card stack g10">
        <strong>أرسلنا لك رابط الدخول.</strong>
        <span className="sm muted">
          افتح الرابط من بريد <span className="lat">{email.trim()}</span> عشان تكمّل. الرابط صالح
          لمدة ٢٤ ساعة.
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => setStage("email")}>
          استخدم بريدًا آخر
        </button>
      </div>
    );
  }

  return (
    <div className="card stack g16">
      {providers.google && (
        <>
          <button
            className="btn btn-strong"
            style={{ width: "100%" }}
            disabled={busy}
            onClick={() => signIn("google", { callbackUrl: target })}
          >
            <GoogleMark />
            المتابعة بحساب Google
          </button>
          <div className="divider">
            <span className="xs dim">أو بالبريد</span>
          </div>
        </>
      )}

      {stage === "email" ? (
        <div className="stack g10">
          <label className="xs dim" htmlFor="login-email">
            البريد الإلكتروني
          </label>
          <input
            id="login-email"
            type="text"
            inputMode="email"
            autoComplete="email"
            className="lat"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && valid && !busy) void requestCode();
            }}
          />
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={!valid || busy}
            onClick={() => void requestCode()}
          >
            {busy ? "لحظة…" : "أرسل لي رمزًا"}
          </button>
          {providers.magicLink && (
            <button
              className="btn btn-ghost btn-sm"
              disabled={!valid || busy}
              onClick={() => void sendMagicLink()}
            >
              أو أرسل رابط دخول بدل الرمز
            </button>
          )}
        </div>
      ) : (
        <div className="stack g10">
          <label className="xs dim" htmlFor="login-code">
            الرمز المرسل إلى <span className="lat">{email.trim()}</span>
          </label>
          <input
            id="login-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="lat"
            style={{ textAlign: "center", fontSize: 22, letterSpacing: "0.4em" }}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && code.length === 6 && !busy) void submitCode();
            }}
          />
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={code.length !== 6 || busy}
            onClick={() => void submitCode()}
          >
            {busy ? "لحظة…" : "ادخل"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => {
              setStage("email");
              setCode("");
              setError(null);
            }}
          >
            رجوع
          </button>
        </div>
      )}

      {error && <div className="alert">{error}</div>}

      {DEV && (
        <button
          className="btn btn-ghost btn-sm"
          disabled={!valid || busy}
          onClick={() => signIn("dev-email", { email: email.trim(), callbackUrl: target })}
        >
          دخول تطويري (بدون رمز)
        </button>
      )}
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
