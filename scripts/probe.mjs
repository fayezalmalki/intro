import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage();
await p.goto(BASE, { waitUntil: "networkidle" });
await p.fill("textarea[name=rawText]", "أدور وظيفة قيادية في الـ Product في شركات تقنية سعودية.");
await Promise.all([p.waitForURL(/confirm$/), p.click("button.btn-primary")]);
await Promise.all([p.waitForURL(/\/requests\/[^/]+$/), p.click("button.btn-primary")]);
const rid = p.url().split("/").pop();
await p.goto(`${BASE}/am/requests/${rid}`, { waitUntil: "networkidle" });
console.log("alerts:", await p.locator(".alert").count());
console.log("alert text:", (await p.locator(".alert").allInnerTexts()).join(" | "));
console.log("disabled buttons:", await p.locator("button:disabled").count());
const names = await p.locator(".grow > .card .lat").allInnerTexts();
console.log("rows:", names.join(", "));
for (const n of names) {
  const row = p.locator(".grow > .card").filter({ has: p.locator(".lat", { hasText: n }) });
  const btn = row.getByRole("button", { name: "اعتمد", exact: true });
  console.log(`  ${n}: approve-disabled=${await btn.count() ? await btn.isDisabled() : "n/a"} evidence-alert=${await row.locator(".alert").count()}`);
}
await b.close();
