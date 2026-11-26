import { chromium } from "playwright";
import fs from "node:fs";
import { signIn } from "./lib/auth-helper.mjs";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] ?? "/tmp/shots";
fs.mkdirSync(OUT, { recursive: true });

const log = [];
function step(name, detail = "") {
  log.push(`${log.length + 1}. ${name}${detail ? " — " + detail : ""}`);
  console.log(`  ${log.length}. ${name}${detail ? " — " + detail : ""}`);
}

// Prefer this machine's preinstalled Chromium when it exists (the sandbox
// ships one that Playwright's own resolver does not find); otherwise let
// Playwright resolve the browser it installed, as CI does.
const LOCAL_CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(
  fs.existsSync(LOCAL_CHROME) ? { executablePath: LOCAL_CHROME } : {},
);

const errors = [];

/**
 * Roles are enforced now, so one browser context can no longer drive both
 * halves of the flow: the requester screens need a requester, and /am refuses
 * anyone who is not an account manager. Two contexts, each signed in through
 * the real email-OTP flow (scripts/lib/auth-helper.mjs), each with its own cookie jar.
 */
async function identity(email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await signIn(context, BASE, email);
  const page = await context.newPage();
  // `next dev` compiles each route on first request, so a cold navigation can
  // take far longer than the 30s default — especially on a CI runner.
  page.setDefaultTimeout(90_000);
  page.setDefaultNavigationTimeout(90_000);
  watch(page, email);
  return page;
}

function watch(page, who) {
  page.on("pageerror", (e) => errors.push(`[${who}] ${e}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${who}] ${m.text()}`); });
  page.on("requestfailed", (r) => {
    // ERR_ABORTED means the request was cancelled, almost always because this
    // script navigated before a <Link> prefetch or a dev hot-update finished.
    // That is not an application failure, and treating it as one made the
    // script exit non-zero while every step passed.
    if (r.failure()?.errorText === "net::ERR_ABORTED") return;
    errors.push(`[${who}] requestfailed [${r.failure()?.errorText}] ${r.url()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`[${who}] HTTP ${r.status()} ${r.url()}`);
  });
}

const requester = await identity("faisal@example.sa");
const manager = await identity("reem@example.sa");

/**
 * First sign-in lands on /welcome (lib/session.ts pageAccount). Goes through
 * the real form, and checks an app page lets them through afterwards.
 */
async function onboard(page, who, name) {
  await page.goto(`${BASE}/new`, { waitUntil: "networkidle" });
  if (!page.url().includes("/welcome")) throw new Error(`${who} was not sent to /welcome on first visit (${page.url()})`);
  await page.fill("input[name=name]", name);
  await page.fill("input[name=jobTitle]", "Head of Product");
  await page.fill("input[name=company]", "Example Co");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/welcome")), page.click("button[type=submit]")]);
  step(`${who} onboarded`, new URL(page.url()).pathname);
}
await onboard(requester, "requester", "فيصل");
await onboard(manager, "manager", "ريم");

/** Whichever identity the current step is acting as. */
let page = requester;

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

/** Switches which identity subsequent steps act as, and says so in the log. */
function as(who) {
  page = who === "requester" ? requester : manager;
  step(`— acting as ${who} —`);
}

as("requester");
// 1. intake
await page.goto(`${BASE}/new`, { waitUntil: "networkidle" });
step("intake page loaded", await page.locator("h1").innerText());
await shot("01-intake");

await page.fill("textarea[name=rawText]", "أدور وظيفة قيادية في الـ Product في شركات تقنية سعودية.");
await Promise.all([page.waitForURL(/\/confirm$/), page.click("[data-testid=create-request]")]);
step("brief extracted", page.url().split("/").slice(-2)[0]);

// 2. confirm
const summary = await page.locator("textarea[name=summaryAr]").inputValue();
step("brief summary", summary);
await shot("02-confirm");
await Promise.all([page.waitForURL(/\/requests\/[^/]+$/), page.click("[data-testid=confirm-brief]")]);
step("confirmed → requester sees", (await page.locator("h1, h2").first().innerText()).trim());
await shot("03-sourcing");

const requestId = page.url().split("/").pop();

// 3. self-serve: no account-manager wait — v1 publishes itself, with only
//    the rows a source backs (the evidence gate still holds, automatically).
const published = page.locator("[data-testid=result]");
await published.first().waitFor();
step("v1 published without waiting", `${await published.count()} evidence-backed people`);
await shot("04-self-serve-v1");

as("manager");
// 4. the AM still sees the whole journey
await page.goto(`${BASE}/am/requests/${requestId}/pipeline`, { waitUntil: "networkidle" });
await page.locator(".mid .card").first().waitFor();
step("pipeline stages", (await page.locator(".mid .card strong").allInnerTexts()).join(" → "));
step("stage states", (await page.locator(".mid .card .chip").allInnerTexts()).join(", "));
await shot("06b-pipeline");

as("requester");
// 6. requester sees v1 — but the account is an observer, so the gate holds
await page.goto(`${BASE}/requests/${requestId}`, { waitUntil: "networkidle" });
const peopleCards = page.locator("[data-testid=result]");
await peopleCards.first().waitFor();
step("requester sees v1", `${await peopleCards.count()} people`);

const firstName = await page.locator("[data-testid=person-name]").first().innerText();
await page.locator("[data-testid=send]").first().click();
await page.locator("[data-testid=gate-error]").first().waitFor();
step("observer blocked at the send gate", (await page.locator("[data-testid=gate-error]").first().innerText()).trim());
await shot("08a-gate-blocks-observer");

// verify the account (stands in for milestone 1 auth + milestone 5 billing)
await page.locator("[data-testid=activate-send]").click();
const creditLine = page.locator("[data-testid=send-status]");
await creditLine.waitFor();
step("account verified", (await creditLine.innerText()).replace(/\s+/g, " ").trim());

// now the same send succeeds
await page.locator("[data-testid=send]").first().click();
await page.locator("[data-testid=outreach]").first().waitFor();
const sentBadge = await page.locator("[data-testid=outreach]").first().innerText();
step("outreach recorded", `${firstName} → ${sentBadge}`);
step("credits after one send", (await creditLine.innerText()).replace(/\s+/g, " ").trim());
await shot("08-results-v1-sent");

// the same person, again — one message per person per request
const second = peopleCards.filter({ hasText: firstName });
step("repeat send offered again?", String(await second.locator("[data-testid=send]").count()));

as("manager");
// 7. AM attaches v2 from a predefined list
await page.goto(`${BASE}/am/requests/${requestId}/attach?tab=list`, { waitUntil: "networkidle" });
await shot("09-attach-list");
await page.locator("form.card button").first().click();
await page.waitForURL(/\/am\/requests\/[^/]+$/);
await page.locator(".grow > .card .lat").first().waitFor();
step("attached v2 → lands in review", (await page.locator(".pill").first().innerText()).trim());
await page.click("form.card button.btn-primary");
await page.waitForURL(/\/published$/);
step("published v2", (await page.locator("h1").innerText()).trim());
const carry = await page.locator(".note").innerText();
step("carry-forward note", carry.replace(/\s+/g, " ").trim());
await shot("10-published-v2");

as("requester");
// 8. requester sees v2 with state preserved
await page.goto(`${BASE}/requests/${requestId}`, { waitUntil: "networkidle" });
const banner = await page.locator("[data-testid=version-banner]").innerText();
step("v2 banner", banner.replace(/\s+/g, " ").trim());
const stillSent = await page.locator("[data-testid=outreach]").count();
step("outreach surviving the swap", String(stillSent));
const newTags = await page.locator("[data-testid=new-in-version]").count();
step("rows marked new in v2", String(newTags));
await shot("11-results-v2");

as("manager");
// 9. paste attach → v3
await page.goto(`${BASE}/am/requests/${requestId}/attach?tab=paste`, { waitUntil: "networkidle" });
await shot("12-attach-paste");
await page.click("button.btn-primary");
await page.waitForURL(/\/am\/requests\/[^/]+$/);
await page.locator(".grow > .card .lat").first().waitFor();
await page.click("form.card button.btn-primary");
await page.waitForURL(/\/published$/);
step("attached + published v3 from pasted rows", (await page.locator("h1").innerText()).trim());
const versions = await page.locator(".card .dot").count();
step("version history entries", String(versions));
await shot("13-published-v3");

as("requester");
// 10. instant search: a use-case preset runs on arrival (offline provider in dev)
await page.goto(`${BASE}/search?preset=sell&lang=en`, { waitUntil: "networkidle" });
const companyRows = page.locator("main li").filter({ has: page.getByRole("button", { name: "Decision makers" }) });
await companyRows.first().waitFor();
step("search preset ran", `${await companyRows.count()} companies`);
await shot("14-search-companies");

await companyRows.first().getByRole("button", { name: "Decision makers" }).click();
const revealBtn = page.getByRole("button", { name: "Reveal email" }).first();
await revealBtn.waitFor();
step("decision makers listed", String(await page.getByRole("button", { name: "Reveal email" }).count()));
await revealBtn.click();
const revealed = page.locator("main li span.font-latin").filter({ hasText: "@" }).first();
await revealed.waitFor();
step("email revealed", await revealed.innerText());
await shot("15-search-revealed");

// 11. the lead page: email, news, a drafted opener
await page.getByRole("link", { name: "Open lead" }).first().click();
await page.waitForURL(/\/leads\/[^/?]+/);
await page.getByRole("button", { name: "Find recent news" }).click();
await page.locator("main section a[target=_blank]").first().waitFor();
step("lead page", `${await page.locator("main section a[target=_blank]").count()} news items · opener ${(await page.locator("textarea").inputValue()).length} chars`);
await shot("16-lead");

await browser.close();

console.log(`\n${log.length} steps passed`);
console.log("console/page errors: " + (errors.length ? "\n  " + errors.join("\n  ") : "none"));
fs.writeFileSync(`${OUT}/log.txt`, log.join("\n") + "\n\nerrors: " + (errors.join("; ") || "none"));
if (errors.length) process.exitCode = 1;
