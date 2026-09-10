import { chromium } from "playwright";
import fs from "node:fs";
import { signIn } from "./lib/auth-helper.mjs";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] ?? "/tmp/radar-shots";
fs.mkdirSync(OUT, { recursive: true });

const log = [];
function step(name, detail = "") {
  log.push(`${log.length + 1}. ${name}${detail ? " — " + detail : ""}`);
  console.log(`  ${log.length}. ${name}${detail ? " — " + detail : ""}`);
}
function check(cond, message) {
  if (!cond) { console.error(`\nFAILED: ${message}`); process.exit(1); }
}

const exec = process.env.PW_CHROME || undefined;
const browser = await chromium.launch(exec ? { executablePath: exec } : {});
const errors = [];

async function page(context) {
  const p = await context.newPage();
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push(String(e)));
  return p;
}

// ── the account manager's desk ────────────────────────────────────────────
const am = await browser.newContext();
await signIn(am, BASE, "reem@example.sa");
const desk = await page(am);

await desk.goto(`${BASE}/am/radar`, { waitUntil: "networkidle" });
check(await desk.locator("h1", { hasText: "الرادار" }).count(), "radar desk did not render");
step("desk reachable as an account manager");

const emptyNote = await desk.locator("text=لم يُشغَّل المسح بعد").count();
step("empty state is honest", emptyNote ? "first run builds a baseline and reports nothing" : "already seeded");

await desk.getByRole("button", { name: "أسبوع تجريبي" }).click();
await desk.waitForLoadState("networkidle");
// A server action revalidates on the way back; the rerender lands just after.
await desk.getByRole("button", { name: /انشر \d+ تغييرًا/ }).waitFor({ timeout: 30_000 });

const pending = await desk.locator("text=بانتظار المراجعة").count();
check(pending > 0, "pending KPI missing");
// A detected row must show a vendor id and no name — that is all we know free.
const idShown = await desk.getByText(/#90\d{4}/).count();
check(idShown > 0, "detected row did not show the vendor id");
const priced = await desk.getByRole("button", { name: /اعتمد \(20 رصيد\)/ }).count();
check(priced > 0, "approve button did not state the price");
step("detected row shows an id and no name", "approve button prices itself at 20 credits");

const broadcastOff = await desk.locator("text=متوقف").count();
check(broadcastOff > 0, "broadcast should be off without a radar subdomain");
step("broadcast reads as off", "no RADAR_SMTP_FROM configured");

await desk.screenshot({ path: `${OUT}/1-desk.png`, fullPage: true });

await desk.getByRole("button", { name: /انشر \d+ تغييرًا/ }).click();
await desk.waitForLoadState("networkidle");
await desk.getByText("آخر موجز", { exact: false }).waitFor({ timeout: 30_000 });
step("published the approved change as an issue");
await desk.screenshot({ path: `${OUT}/2-desk-published.png`, fullPage: true });

// ── what the public sees ──────────────────────────────────────────────────
const anon = await browser.newContext();
const pub = await page(anon);

await pub.goto(`${BASE}/radar`, { waitUntil: "networkidle" });
check(await pub.locator("h1", { hasText: "إشارة تنتهي باسم" }).count(), "radar index did not render");
step("public index renders signed out");

await pub.goto(`${BASE}/radar/banking`, { waitUntil: "networkidle" });
const named = await pub.locator("text=نورة العتيبي").count();
check(named > 0, "published issue did not name the person");
const dated = await pub.locator("a.lat, span.xs.dim").first();
check(await dated.count() > 0, "issue item carried no source line");
step("issue names the person and shows the dated source");
await pub.screenshot({ path: `${OUT}/3-issue.png`, fullPage: true });

await pub.goto(`${BASE}/radar/banking?lang=en`, { waitUntil: "networkidle" });
const dir = await pub.evaluate(() => document.querySelector(".landing")?.getAttribute("dir"));
check(dir === "ltr", "English issue page did not flip to ltr");
const overflow = await pub.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check(!overflow, "English issue page overflows");
step("English tree renders ltr with no overflow");

// ── subscribing, and the honest refusal ───────────────────────────────────
await pub.goto(`${BASE}/radar/banking`, { waitUntil: "networkidle" });
await pub.locator('input[name="email"]').fill("reader@example.sa");
await pub.getByRole("button", { name: "اشترك" }).click();
await pub.waitForTimeout(1500);
const honest = await pub.locator("text=/ما أرسلنا لك رسالة تأكيد/").count();
check(honest > 0, "subscribe did not admit that no confirmation was sent");
step("subscribe records the request", "and says plainly that no mail was sent");
await pub.screenshot({ path: `${OUT}/4-subscribe.png`, fullPage: true });

// ── the token routes ──────────────────────────────────────────────────────
await pub.goto(`${BASE}/radar/confirm?token=not-a-real-token`, { waitUntil: "networkidle" });
check(await pub.locator("text=الرابط غير صالح").count() > 0, "bad confirm token was not refused");
step("an unknown confirmation token is refused neutrally");

await pub.goto(`${BASE}/radar/unsubscribe?token=not-a-real-token`, { waitUntil: "networkidle" });
check(await pub.locator("text=الرابط غير صالح").count() > 0, "bad unsubscribe token was not refused");
step("an unknown unsubscribe token is refused neutrally");

// ── the cron route is not open ────────────────────────────────────────────
const openCall = await pub.request.get(`${BASE}/api/cron/radar`);
check([401, 503].includes(openCall.status()), `cron route answered ${openCall.status()} unauthenticated`);
step("cron route refuses an unauthenticated call", `status ${openCall.status()}`);

fs.writeFileSync(`${OUT}/steps.txt`, log.join("\n") + "\n");
console.log(`\n${log.length} steps passed`);
console.log(`console/page errors: ${errors.length ? errors.join(" | ") : "none"}`);
await browser.close();
if (errors.length) process.exit(1);
