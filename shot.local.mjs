import { chromium } from "playwright";
import fs from "node:fs";
const BASE = "http://localhost:3000";
const OUT = "/tmp/claude-0/-home-user-intro/ab222c40-2a38-57f1-b10f-ccf02376efef/scratchpad/shots";
fs.mkdirSync(OUT, { recursive: true });
const LOCAL = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(fs.existsSync(LOCAL) ? { executablePath: LOCAL } : {});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

const probe = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const t = (n) => cs.getPropertyValue(n).trim();
  const h1 = document.querySelector(".hero h1");
  const h1s = h1 && getComputedStyle(h1);
  // Arabic must never take Space Grotesk, and never negative tracking.
  const arabicEls = [...document.querySelectorAll("h1,h2,p,strong,span")]
    .filter((e) => /[؀-ۿ]/.test(e.textContent || ""));
  const badFont = arabicEls.filter((e) => /Grotesk/i.test(getComputedStyle(e).fontFamily));
  const badTrack = arabicEls.filter((e) => {
    const ls = getComputedStyle(e).letterSpacing;
    return ls.endsWith("px") && parseFloat(ls) < -0.01;
  });
  const bad = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > innerWidth + 1 || r.left < -1) bad.push(`${el.tagName}.${el.className}`.slice(0, 55));
  }
  return {
    canvas: t("--canvas"), accent: t("--accent"), ink: t("--ink"), radius: t("--radius"),
    h1: h1s && `${h1s.fontSize} / ${h1s.fontWeight} / ls ${h1s.letterSpacing} / ${h1s.fontFamily.split(",")[0]}`,
    badFont: badFont.slice(0, 3).map((e) => e.textContent.slice(0, 30)),
    badTrack: badTrack.slice(0, 3).map((e) => e.textContent.slice(0, 30)),
    overflow: [...new Set(bad)].slice(0, 5),
    scrolls: document.documentElement.scrollWidth > innerWidth,
    logo: document.querySelector(".logo img")?.getAttribute("src"),
  };
});
console.log(JSON.stringify(probe, null, 1));
await page.screenshot({ path: `${OUT}/landing-1440.png`, fullPage: true });
await page.setViewportSize({ width: 390, height: 900 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const m = await page.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > innerWidth + 1 || r.left < -1) bad.push(`${el.tagName}.${el.className}`.slice(0, 55));
  }
  return { overflow: [...new Set(bad)].slice(0, 5), scrolls: document.documentElement.scrollWidth > innerWidth };
});
console.log("390:", JSON.stringify(m));
await page.screenshot({ path: `${OUT}/landing-390.png`, fullPage: true });
console.log("errors:", errs.length ? errs.slice(0, 3) : "none");
await browser.close();
