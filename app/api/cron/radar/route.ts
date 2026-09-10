import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOpsAlertEmail } from "@/lib/mailer";
import { sweep } from "@/lib/radar/sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The weekly Radar sweep.
 *
 * Two things make this safe to leave running unattended:
 *
 * **It is not open to the internet.** Vercel sends `Authorization: Bearer
 * $CRON_SECRET` on scheduled invocations. Without a configured secret the route
 * refuses outright rather than defaulting to open — an unauthenticated endpoint
 * that burns vendor quota is worse than a cron that never fires.
 *
 * **It shouts when it dies.** A failure writes a `radar_runs` row, logs a
 * `radar_run_failed` usage event, mails whoever is in ADMIN_EMAILS, and returns
 * 500 so Vercel's own cron monitoring records a failed invocation. The reason
 * for the belt and braces is that this job's failure mode is silence: an empty
 * week and a dead sweep look identical from outside, and the honest empty week
 * is a real outcome the product has to be able to report.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; the radar sweep refuses to run open" },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await sweep(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[radar] sweep failed", error);
    await sendOpsAlertEmail(
      "Radar sweep failed",
      `The weekly sector sweep did not complete.\n\n${message}\n\n` +
        "No issue can be drafted until it runs again. Check /am/ops for the run row.",
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
