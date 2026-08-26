import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] ?? "/tmp/shots";
fs.mkdirSync(OUT, { recursive: true });

const log = [];
function step(name, detail = "") {
  log.push(`${log.length + 1}. ${name}${detail ? " — " + detail : ""}`);
  console.log(`  ${log.length}. ${name}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("requestfailed", (r) => { if (!r.url().includes("_rsc=")) errors.push(`requestfailed [${r.failure()?.errorText}] ${r.url()}`); });
page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

// 1. intake
await page.goto(BASE, { waitUntil: "networkidle" });
step("intake page loaded", await page.locator("h1").innerText());
await shot("01-intake");

await page.fill("textarea[name=rawText]", "أدور وظيفة قيادية في الـ Product في شركات تقنية سعودية.");
await Promise.all([page.waitForURL(/\/confirm$/), page.click("button.btn-primary")]);
step("brief extracted", page.url().split("/").slice(-2)[0]);

// 2. confirm
const summary = await page.locator("textarea[name=summaryAr]").inputValue();
step("brief summary", summary);
await shot("02-confirm");
await Promise.all([page.waitForURL(/\/requests\/[^/]+$/), page.click("button.btn-primary")]);
step("confirmed → requester sees", (await page.locator("h1").innerText()).trim());
await shot("03-sourcing");

const requestId = page.url().split("/").pop();

// 3. AM queue
await page.goto(`${BASE}/am`, { waitUntil: "networkidle" });
const queueRows = await page.locator(".tr:not(.head)").count();
step("AM queue rows", String(queueRows));
await shot("04-queue");

// 4. review
await page.click(`a[href="/am/requests/${requestId}"]`);
await page.waitForLoadState("networkidle");
await shot("05-review");

// approve every approvable row, one at a time, waiting for each to settle
const rows = page.locator(".grow > .card").filter({ has: page.locator(".lat") });
const rowCount = await rows.count();
const blockedRows = await page.locator(".alert").count();
let approvedCount = 0;
for (let i = 0; i < rowCount; i++) {
  const btn = rows.nth(i).getByRole("button", { name: "اعتمد", exact: true });
  if (!(await btn.count()) || (await btn.isDisabled())) continue;
  await btn.click();
  await rows.nth(i).getByRole("button", { name: "✓ معتمد", exact: true }).waitFor();
  approvedCount++;
}
step("rows in draft", String(rowCount));
step("rows blocked for missing evidence", String(blockedRows));
step("rows approved", String(approvedCount));
step("rows left unapproved (evidence gate)", String(rowCount - approvedCount));
const barText = await page.locator("form.card .muted").innerText();
step("publish bar", barText.trim());
await shot("06-approved");

// 5. publish v1
await page.click('form.card button.btn-primary');
await page.waitForURL(/\/published$/);
step("published v1", (await page.locator("h1").innerText()).trim());
await shot("07-published-v1");

// 6. requester sees v1, sends one message
await page.goto(`${BASE}/requests/${requestId}`, { waitUntil: "networkidle" });
const v1People = await page.locator(".narrow > .card").count();
step("requester sees v1", `${v1People} people`);
const firstName = await page.locator(".lat").first().innerText();
await page.locator("form button.btn-primary").first().click();
await page.waitForLoadState("networkidle");
const sentBadge = await page.locator(".chip", { hasText: /عبر Intro|تواصل مباشر/ }).first().innerText();
step("outreach recorded", `${firstName} → ${sentBadge}`);
await shot("08-results-v1-sent");

// 7. AM attaches v2 from a predefined list
await page.goto(`${BASE}/am/requests/${requestId}/attach?tab=list`, { waitUntil: "networkidle" });
await shot("09-attach-list");
await page.locator("form.card button").first().click();
await page.waitForURL(/\/am\/requests\/[^/]+$/);
step("attached v2 → lands in review", (await page.locator(".pill").first().innerText()).trim());
await page.click("form.card button.btn-primary");
await page.waitForURL(/\/published$/);
step("published v2", (await page.locator("h1").innerText()).trim());
const carry = await page.locator(".note").innerText();
step("carry-forward note", carry.replace(/\s+/g, " ").trim());
await shot("10-published-v2");

// 8. requester sees v2 with state preserved
await page.goto(`${BASE}/requests/${requestId}`, { waitUntil: "networkidle" });
const banner = await page.locator(".note").innerText();
step("v2 banner", banner.replace(/\s+/g, " ").trim());
const stillSent = await page.locator(".chip", { hasText: /عبر Intro|تواصل مباشر/ }).count();
step("outreach surviving the swap", String(stillSent));
const newTags = await page.locator(".chip.on").count();
step("rows marked new in v2", String(newTags));
await shot("11-results-v2");

// 9. paste attach → v3
await page.goto(`${BASE}/am/requests/${requestId}/attach?tab=paste`, { waitUntil: "networkidle" });
await shot("12-attach-paste");
await page.click("button.btn-primary");
await page.waitForURL(/\/am\/requests\/[^/]+$/);
await page.click("form.card button.btn-primary");
await page.waitForURL(/\/published$/);
step("attached + published v3 from pasted rows", (await page.locator("h1").innerText()).trim());
const versions = await page.locator(".card .dot").count();
step("version history entries", String(versions));
await shot("13-published-v3");

await browser.close();

console.log("\nconsole/page errors: " + (errors.length ? "\n  " + errors.join("\n  ") : "none"));
fs.writeFileSync(`${OUT}/log.txt`, log.join("\n") + "\n\nerrors: " + (errors.join("; ") || "none"));
if (errors.length) process.exitCode = 1;
