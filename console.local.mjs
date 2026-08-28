import { chromium } from "playwright";
import fs from "node:fs";
import { signIn } from "./scripts/lib/auth-helper.mjs";
const BASE = "http://localhost:3000";
const OUT = "/tmp/claude-0/-home-user-intro/ab222c40-2a38-57f1-b10f-ccf02376efef/scratchpad/shots";
const LOCAL = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(fs.existsSync(LOCAL) ? { executablePath: LOCAL } : {});
const errs = [];

async function identity(email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await signIn(ctx, BASE, email);
  const page = await ctx.newPage();
  page.setDefaultTimeout(90_000);
  page.on("pageerror", (e) => errs.push(`${email}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errs.push(`${email}: ${m.text()}`));
  return page;
}

// Contrast, because the last dark-surface pass shipped two elements at 1.8:1.
const AUDIT = `(() => {
  const lum = (c) => { const [r,g,b] = c.match(/\\d+(\\.\\d+)?/g).slice(0,3).map(Number)
      .map(v => { v/=255; return v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4; });
    return 0.2126*r + 0.7152*g + 0.0722*b; };
  const ratio = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
  const bgOf = (el) => { let n = el; while (n) { const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return c; n = n.parentElement; } return "rgb(255,255,255)"; };
  const low = [], overflow = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > innerWidth + 1 || r.left < -1) overflow.push(el.tagName + "." + String(el.className).slice(0,40));
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
    if (!txt) continue;
    const cs = getComputedStyle(el);
    const cr = ratio(cs.color, bgOf(el));
    if (cr < 3) low.push({ t: txt.slice(0, 26), ratio: +cr.toFixed(2), color: cs.color, size: cs.fontSize });
  }
  const arabic = [...document.querySelectorAll("h1,h2,h3,p,strong,span,a,button")]
    .filter(e => /[\\u0600-\\u06FF]/.test(e.textContent || ""));
  return {
    lowContrast: low.sort((a,b)=>a.ratio-b.ratio).slice(0, 6),
    overflow: [...new Set(overflow)].slice(0, 5),
    scrolls: document.documentElement.scrollWidth > innerWidth,
    grotesqueOnArabic: arabic.filter(e => /Grotesk/i.test(getComputedStyle(e).fontFamily))
      .slice(0,3).map(e => e.textContent.slice(0,24)),
    tightArabic: arabic.filter(e => { const ls = getComputedStyle(e).letterSpacing;
      return ls.endsWith("px") && parseFloat(ls) < -0.01; }).slice(0,3).map(e => e.textContent.slice(0,24)),
  };
})()`;

const reem = await identity("reem@example.sa");
const boss = await identity("boss@example.sa");
const faisal = await identity("faisal@example.sa");

const PAGES = [
  ["AM queue", reem, "/am"], ["team", boss, "/am/team"],
  ["my requests", faisal, "/requests"],
];
for (const [name, page, url] of PAGES) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  const a = await page.evaluate(AUDIT);
  console.log(`\n— ${name} (${url}) —`);
  console.log("  overflow:", a.scrolls ? "PAGE SCROLLS" : "none", a.overflow.length ? a.overflow : "");
  console.log("  Grotesk on Arabic:", a.grotesqueOnArabic.length ? a.grotesqueOnArabic : "none");
  console.log("  tight Arabic:", a.tightArabic.length ? a.tightArabic : "none");
  console.log("  contrast < 3:1:", a.lowContrast.length ? JSON.stringify(a.lowContrast) : "none");
  await page.screenshot({ path: `${OUT}/${name.replace(/\W+/g, "-")}.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  const m = await page.evaluate(AUDIT);
  console.log("  @390:", m.scrolls ? "PAGE SCROLLS" : "no scroll", m.overflow.length ? m.overflow : "");
  await page.setViewportSize({ width: 1440, height: 1000 });
}
console.log("\nerrors:", errs.length ? errs.slice(0, 4) : "none");
await browser.close();
