"use client";

import { useEffect } from "react";

/** Catches failures in the root layout itself, where app/error.tsx cannot run. */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("[global error]", error.digest ?? "", error.message, error.stack);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          background: "#F7F7F4",
          color: "#111111",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>صار خطأ غير متوقع.</h1>
          <p style={{ color: "#686868", lineHeight: 1.8 }}>
            حاول تحديث الصفحة. إذا تكرر، تواصل معنا.
          </p>
          {error.digest && (
            <p style={{ color: "#A3A3A0", fontSize: 13, direction: "ltr", marginTop: 16 }}>
              digest {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
