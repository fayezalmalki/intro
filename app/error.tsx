"use client";

import { useEffect } from "react";

/**
 * Logs the real error rather than leaving only a digest, and tells the reader
 * where to look. Production's first failure was a bare digest with no way to
 * tell "database not provisioned" from a genuine bug.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error.digest ?? "", error.message, error.stack);
  }, [error]);

  return (
    <div className="wrap">
      <div className="narrow stack g20" style={{ paddingTop: 60 }}>
        <div className="stack g12">
          <h1>صار خطأ غير متوقع.</h1>
          <p className="muted">
            سجّلنا التفاصيل. جرّب مرة ثانية، وإذا تكرر تواصل معنا.
          </p>
        </div>

        <div className="row g8">
          <button onClick={reset} className="btn-primary">
            حاول مرة ثانية
          </button>
          <a href="/" className="btn btn-ghost">
            العودة للبداية
          </a>
        </div>

        {error.digest && (
          <p className="sm dim lat" style={{ direction: "ltr" }}>
            digest {error.digest} · /api/health reports whether the database is set up
          </p>
        )}
      </div>
    </div>
  );
}
