/**
 * Walks the GTM flow end to end in Chromium and writes screenshots plus a step
 * log. A sibling of scripts/e2e.mjs, which drives the account-manager loop.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import { signIn } from "./lib/auth-helper.mjs";

const BASE = process.env.BASE ?? "http://localhost:3311";
const OUT = process.argv[2] ?? "/tmp/gtm-shots";
const SITE = process.argv[3] ?? "careers.sa";
fs.mkdirSync(OUT, { recursive: true });

const log = [];
const errors = [];
function step(name, detail = "") {
  log.push(`${log.length + 1}. ${name}${detail ? " — " + detail : ""}`);
  console.log(`  ${log.length}. ${name}${detail ? " — " + detail : ""}`);
}

const LOCAL_CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(
  fs.existsSync(LOCAL_CHROME) ? { executablePath: LOCAL_CHROME } : {},
);

const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await signIn(context, BASE, "walker@intro.sa");
const page = await context.newPage();
page.setDefaultTimeout(120_000);
page.setDefaultNavigationTimeout(120_000);
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

/** Nothing may overflow horizontally. In RTL the spill runs off the leading edge. */
async function noHorizontalScroll(where) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 2) errors.push(`${where}: horizontal overflow of ${overflow}px`);
}

await page.goto(`${BASE}/examples`, { waitUntil: "networkidle" });
const exampleLetters = await page.locator(".gtm-letter").count();
step("/examples renders worked Arabic drafts", `${exampleLetters} letters, no sign-in needed`);
await noHorizontalScroll("/examples");
await shot("01-examples");

await page.goto(`${BASE}/gtm`, { waitUntil: "networkidle" });
step("/gtm asks for one field");
await shot("02-onboarding");

await page.fill('input[name="website"]', SITE);
// Specific, not the first submit on the page: the app bar's sign-out is also a
// form with a submit button, and it sits above this one in the DOM.
await page.click('.hero-form button[type="submit"]');
await page.waitForURL(/\/gtm\/[0-9a-f-]{8}/, { timeout: 120_000 });
step("submitted a website", SITE);

await page.waitForSelector(".gtm-rail");
const stepStates = await page.$$eval(".gtm-step", (els) =>
  els.map((el) => `${el.querySelector(".gtm-step-name")?.textContent?.trim()}=${el.className.replace("gtm-step ", "")}`),
);
step("run rail", stepStates.join(" | "));
await noHorizontalScroll("/gtm/[runId]");
await shot("03-run");

const counts = await page.$$eval(".gtm-count", (els) => els.map((e) => e.textContent.trim().slice(0, 90)));
step("segment counts", counts.length ? counts.join(" || ") : "no segments");

const queries = await page.$$eval(".gtm-query", (els) => els.map((e) => e.textContent.trim()));
step("printed queries", queries.join(" || ") || "none");

const runUrl = page.url();

// The example rows: development only, and the only way to reach the review
// screen without a Coresignal key, because a name is a purchase.
const fixtureButton = page.locator('button:has-text("عبّي صفوف مثال")');
if (await fixtureButton.count()) {
  await fixtureButton.click();
  await page.waitForLoadState("networkidle");
  step("loaded hand-written example rows (dev only)");
  await shot("04-run-with-rows");
}

await page.goto(`${runUrl}/review`, { waitUntil: "networkidle" });
const peopleCount = await page.locator(".gtm-person").count();
step("review screen", `${peopleCount} people listed`);
await noHorizontalScroll("/gtm/[runId]/review");
await shot("05-review");

const badges = await page.$$eval(".gtm-person .badge", (els) => [...new Set(els.map((e) => e.textContent.trim()))]);
step("email-status badges present", badges.join(" | "));

// The guessed address: shown, labelled, and its mail button gated.
const guessed = page.locator('.gtm-person:has-text("تخمين نمط")');
if (await guessed.count()) {
  await guessed.first().click();
  await page.waitForTimeout(400);
  const mailDisabled = await page.locator('button:has-text("البريد غير موثّق")').count();
  const ack = await page.locator('input[type="checkbox"]').count();
  step("guessed address is gated", `disabled mail button: ${mailDisabled}, acknowledgement box: ${ack}`);
  await shot("06-guessed-address");
}

const letter = await page.locator(".gtm-letter").first().textContent();
step("draft body", letter.replace(/\s+/g, " ").slice(0, 120) + "…");

await page.locator('button:has-text("EN")').first().click();
await page.waitForTimeout(300);
const english = await page.locator(".gtm-letter").first().textContent();
step("english toggle", english.replace(/\s+/g, " ").slice(0, 100) + "…");
await shot("07-english");

await page.locator('button:has-text("اعتمد")').first().click();
// A server action is a fetch, not a navigation, so networkidle can resolve
// before the refreshed tree paints. Wait for the state the action produces.
await page.locator('.badge:has-text("معتمدة")').first().waitFor({ timeout: 20_000 });
const approved = await page.locator('.badge:has-text("معتمدة")').count();
step("approval", `${approved} approved badges`);

// The paywall, and the test provider behind it.
await page.locator("#paywall").scrollIntoViewIfNeeded();
await shot("08-paywall");
const paywallText = await page.locator("#paywall").textContent();
step("paywall copy", paywallText.replace(/\s+/g, " ").slice(0, 200) + "…");
for (const forbidden of ["متبقي", "ينتهي خلال", "مقعد", "فقط اليوم"]) {
  if (paywallText.includes(forbidden)) errors.push(`paywall contains urgency copy: ${forbidden}`);
}

await page.locator('#paywall button[type="submit"]').first().click();
await page.waitForURL(/\/gtm\/pay\/test/, { timeout: 60_000 });
step("checkout redirected to the test provider");
await shot("09-test-provider");

await page.click('form button:has-text("أرسل إشعار دفع")');
await page.waitForURL(/\/gtm\/[0-9a-f-]+\/review/, { timeout: 60_000 });
await page.waitForLoadState("networkidle");
const balanceChip = await page.locator('.chip:has-text("رصيد الإرسال")').first().textContent();
step("after the signed webhook", balanceChip.trim());
await shot("10-after-payment");

// Mobile.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
await signIn(phone, BASE, "walker@intro.sa");
const small = await phone.newPage();
small.setDefaultTimeout(120_000);
await small.goto(runUrl, { waitUntil: "networkidle" });
const mobileOverflow = await small.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
if (mobileOverflow > 2) errors.push(`mobile run page: horizontal overflow of ${mobileOverflow}px`);
step("mobile 390px", `overflow ${mobileOverflow}px`);
await small.screenshot({ path: `${OUT}/11-mobile-run.png`, fullPage: true });
await small.goto(`${runUrl}/review`, { waitUntil: "networkidle" });
await small.screenshot({ path: `${OUT}/12-mobile-review.png`, fullPage: true });

fs.writeFileSync(`${OUT}/steps.txt`, log.join("\n") + "\n");
await browser.close();

if (errors.length) {
  console.log("\nERRORS:");
  for (const e of [...new Set(errors)]) console.log("  - " + e);
  process.exit(1);
}
console.log("\nno page errors, no overflow");
