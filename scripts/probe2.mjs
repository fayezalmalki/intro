import { chromium } from "playwright";
import fs from "node:fs";
const BASE = "http://localhost:3000";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage();
await p.goto(BASE, { waitUntil: "networkidle" });
await Promise.all([p.waitForURL(/confirm$/), p.click("button.btn-primary")]);
await Promise.all([p.waitForURL(/\/requests\/[^/]+$/), p.click("button.btn-primary")]);
const rid = p.url().split("/").pop();
await p.goto(`${BASE}/am/requests/${rid}`, { waitUntil: "networkidle" });

const rows = p.locator(".grow > .card").filter({ has: p.locator(".lat") });
const btn = rows.nth(0).getByRole("button", { name: "اعتمد", exact: true });
console.log("before click, label:", await btn.innerText());
await btn.click();
await p.waitForTimeout(1500);
console.log("after click, row0 buttons:", (await rows.nth(0).getByRole("button").allInnerTexts()).join(" / "));
console.log("bar:", await p.locator("form.card .muted").innerText());

const db = JSON.parse(fs.readFileSync(".data/db.json", "utf8"));
const pl = db.pipelines.find((x) => x.requestId === rid);
console.log("db statuses:", pl.items.map((i) => `${i.personId}=${i.status}`).join(", "));
console.log("audit:", db.audit.slice(0, 3).map((a) => a.action).join(", "));
await b.close();
