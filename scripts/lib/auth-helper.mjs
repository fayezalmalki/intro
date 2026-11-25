import fs from "node:fs";
import path from "node:path";

/**
 * Signs a Playwright browser context in through the real email-OTP flow.
 *
 * Locally, Cloudflare's send_email binding is simulated: each message is
 * written under .cloudflare/tmp/email/ instead of being delivered. This asks
 * Better Auth for a code, reads it back from the newest simulated message's
 * text, and posts it — the same path a person takes, minus the inbox.
 */
const EMAIL_DIR = path.join(process.cwd(), ".cloudflare/tmp/email");

function newestTextMessages() {
  if (!fs.existsSync(EMAIL_DIR)) return [];
  const files = [];
  for (const instance of fs.readdirSync(EMAIL_DIR)) {
    const dir = path.join(EMAIL_DIR, instance, "email-text");
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const file = path.join(dir, f);
      files.push({ file, mtime: fs.statSync(file).mtimeMs });
    }
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

async function readCode(seen) {
  for (let i = 0; i < 40; i += 1) {
    const latest = newestTextMessages().find((m) => !seen.has(m.file));
    if (latest) {
      const match = fs.readFileSync(latest.file, "utf8").match(/\b(\d{6})\b/);
      if (match) return match[1];
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("no sign-in code arrived in the local email simulator — is `npm run dev` running?");
}

export async function signIn(context, baseUrl, email) {
  // Messages already on disk belong to earlier sign-ins; only a new one is ours.
  const seen = new Set(newestTextMessages().map((m) => m.file));
  const headers = { origin: baseUrl };
  const sent = await context.request.post(`${baseUrl}/api/auth/email-otp/send-verification-otp`, {
    headers, data: { email, type: "sign-in" },
  });
  if (!sent.ok()) throw new Error(`sending a code to ${email} returned ${sent.status()}`);

  const otp = await readCode(seen);
  const signedIn = await context.request.post(`${baseUrl}/api/auth/sign-in/email-otp`, {
    headers, data: { email, otp },
  });
  if (!signedIn.ok()) throw new Error(`sign-in for ${email} returned ${signedIn.status()}`);
}
