# intro.sa: rebuild on Cloudflare with real sourcing and use-case-led workflows

## Context

intro.sa helps people reach the right person in a Saudi sector — a decision maker to sell to, or a hiring manager to get hired by — with a stated reason, then opens the door by direct outreach or a consented introduction.

The production app (`fayezalmalki/intro`, Next.js 15 + Neon + NextAuth, deployed on Vercel) has a sound domain core but three problems:

1. **The screens are poorly built.** They use 547 lines of hand-written CSS and about 120 inline style objects, with no component system and RTL bolted on.
2. **Sourcing is fake.** `lib/sourcing.ts` returns seeded people with `example.com` evidence.
3. **Nothing runs in the background.** There is no real auth, no email, no replies, no reminders and no signals.

The user chose:
- an **all-Cloudflare** stack (Workers + D1 + Workflows + Email Service), with no Neon;
- **treg** for people data;
- a **lightweight, use-case-led** design that works like inbox.sa: predefined use cases, each with a worked example and visible workflow steps ("Done / Needs you").

Intended outcome: a user picks a use case (or types a goal), the system finds real people with evidence, and drafts outreach. The user (or an account manager on managed accounts) approves, and the system sends, tracks replies, reminds and suggests alternate paths. All of this runs on one platform.

## Decisions

| Layer | Choice |
|---|---|
| Runtime | Next.js 16 on **Cloudflare Workers** via `@opennextjs/cloudflare`, with `nodejs_compat` |
| DB | **D1** + Drizzle (`sqlite-core`); migrations via `drizzle-kit` → `wrangler d1 migrations` |
| Serialised money/sends | One **Durable Object per account** (`AccountGate`) that runs `canSend` + `recordSend` + the ledger write atomically. This replaces `SELECT … FOR UPDATE` |
| Orchestration | **Cloudflare Workflows** (`RequestWorkflow`, `OutreachWorkflow`) + **Queues** (signals) + **Cron Triggers** (daily signal sweep, list refresh) |
| Email | **Cloudflare Email Service** to send; **Email Routing → Worker `email()` handler** to receive replies on `reply+<token>@intro.sa` |
| Files | **R2** for attach uploads (CSV/XLSX) |
| Auth | **Better Auth** (Drizzle/D1 adapter): email OTP sent through Email Service, plus Google. Roles `requester / account_manager / admin` and states `observer / verified / managed` kept as-is |
| AI | `@anthropic-ai/sdk` (fetch-based, works on Workers). Model ids are chosen per the `claude-api` skill at build time. Intent extraction and fit scoring use structured output with zod, as now |
| People data | **treg** over HTTP (`https://treg.to/call/<id>`, `X-Treg-Token` = a capped agent token from `treg org agent-new intro-prod --cap …`, stored as a Worker secret) behind a `SourcingProvider` interface |
| UI | Tailwind v4 (`@theme` tokens from the handoff) + shadcn/ui (RTL-safe logical props) + **next-intl**, Arabic default with English at `/en` |
| Tests | Vitest with `@cloudflare/vitest-pool-workers` (real D1/DO in Miniflare); Playwright e2e (port `scripts/e2e.mjs`) |

## Keep (reuse as-is or near-as-is)

- `lib/gate.ts` `canSend()`: pure and synchronous. Swap `node:crypto` for WebCrypto or keep it under `nodejs_compat`. **Fix:** `lib/db/loaders.ts:74` loads send attempts for this account only, so the cross-requester 90-day cooldown never fires. Load attempts by person across accounts.
- `lib/credits.ts` (append-only ledger, balance as a projection) and `lib/suppression.ts` (hashed opt-outs).
- `lib/pipeline.ts` `buildPipelineView` (pure).
- `lib/intent.ts` brief extraction + `rulesBrief` fallback. Update the model id.
- `lib/types.ts` `Person`, `PipelineItem`, `Evidence`, `Brief`.
- `lib/db/scoped.ts` app-level tenant isolation (portable). Drop `drizzle/policies/rls.sql` (never applied; there is no RLS in D1).
- The pipeline versioning + outreach carry-forward logic in `lib/db/repo.ts`, rewritten from `transaction()` to `db.batch()`. 8 call sites: repo.ts :27 :54 :92 :116 :189 :254 :304 :341 :414. `recordSend` moves into `AccountGate`.
- The pure tests: gate (24), pipeline, similarity.probe, action-authz, middleware.

## Remove

Neon/`postgres`/`ws`/PGlite drivers (`lib/db/index.ts`, `scripts/db-local.mjs`, `scripts/pg-*.sh`); `nodemailer` + ImprovMX; NextAuth (`auth.config.ts`, `lib/auth.ts`, `app/api/auth/*`); Postgres migrations in `drizzle/` (regenerated for SQLite); the `rls.probe`, `migrations` and Postgres `transactions` tests (replaced by D1/DO equivalents); `lib/sourcing.ts` `SIGNALS` seed (kept only as dev fixtures); `vercel.json`.

Schema port notes (`lib/db/schema.ts`): `jsonb` → `text({mode:"json"})`; `timestamp` → ISO text; `uuid().defaultRandom()` on `otp_codes` → JS `crypto.randomUUID()`; `creditStanding` (repo.ts :387) `count(*) filter` → `sum(case …)`; health route `information_schema` → `sqlite_master`. Add the missing "one published pipeline per request" unique index.

## Product & design (lightweight, use-case-led)

**Design source:** the user's pen.dev screens are the source of truth. The pen.dev MCP is blocked by the plan limit, so Phase 3 starts from the Aug handoff (`Intro.sa prototype design (2).zip`) + inbox.sa patterns and is reconciled with pen.dev exports once available. **Ask the user for PNG exports before Phase 3.**

**Principles from the review:** the handoff dashboard reads like a CRM (8 KPI cards, 4 dense 5–6-column tables, filter pills everywhere). The consumer flow is the right weight: one input, a confirmation, reason-first cards, detail that opens progressively. Build the app on the consumer flow's weight, using the B2B visual tokens. At most one compact stat line per view, no KPI walls.

**Use-case catalogue**: `src/content/use-cases.ts`, mirroring inbox.sa's `UseCaseId` + `Preview` model (`fayezalmalki/inbox-landing` `src/content/types.ts`, `previews.ts`):

```ts
type UseCaseId = "sell" | "hire-me" | "hire" | "partner" | "invest" | "enter-market";
interface UseCase {
  id: UseCaseId; icon; name; promise;            // "Reach the decision maker at Saudi insurers"
  examplePrompt: { ar; en };                      // prefills the request box
  briefPreset: Partial<Brief>;                    // roles, seniority, sectors, geo=SA
  sectors: SectorId[];                            // banking, insurance, fintech, health, retail, gov, real-estate, logistics…
  steps: { label; state: "done"|"active"|"pending" }[]; // the visible workflow
  sample: { matches: SampleMatch[]; draft: string }; // demo data for landing + empty states
}
```

- `sell`: decision makers in a sector.
- `hire-me`: the hiring manager for my target role (job seekers).
- `hire`: reach passive candidates (recruiters).
- `partner`, `invest`, `enter-market`: partnerships, investors and market entry.

Each use case also gets a **sector picker** (chips), so "decision maker × insurance" or "hiring manager × fintech" is two taps.

**Screens** (AR/EN, mobile-first):
1. **Landing**: hero question + use-case tabs, each showing a live workspace preview (inbox.sa `WorkspacePreview` pattern: matches list + detail with steps "Done/Needs you" + drafted opener); sector chips; pricing link. Also `/use-cases/<id>` and `/reach/<sector>` pages for SEO growth.
2. **Start**: pick a use case → sector chips → one-line goal (prefilled from the example) → **Confirm brief** (editable, existing confirm screen restyled).
3. **Request**: a workflow stepper (Understand → Find people → Check evidence → Score fit → Draft → *Needs you: approve* → Send/Intro → Follow up), with live status while the Workflow runs. Below it are reason-first match cards (fit, why, why now, route direct/intro). Opening a card shows a sheet with evidence links, lead-with/avoid and the opener.
4. **Review & send**: the selected people's openers to edit, remove or send, under the visible 10/day cap. Gate refusals are explained in plain words.
5. **Conversations**: replies threaded in from Email Routing; status chips (new / contacted / replied / intro pending / connected).
6. **Intros**: consented brokered intro. The recipient gets an accept/decline page; accept opens a shared thread; decline is not charged and suggests an alternate path.
7. **Lists & Signals**: compact. Ready lists per sector + a signal feed (leadership change, funding, hiring wave, RFP) linked to open requests. Built last.
8. **AM console** (`/am`, kept): queue with SLA + pipeline review/attach/publish, restyled. It's used only for **managed** accounts; observer/verified accounts run self-serve.

**Growth loops:**
- The first request is free to see matches; sending requires verification (the existing observer gate).
- Every intro recipient lands on a page that also offers "Get your own intros".
- A referral ledger reason gives credits.
- Shareable read-only "who to reach in <sector>" pages.
- Per-sector SEO pages built from use-case content.

## Orchestration

**`RequestWorkflow`** (`src/workflows/request.ts`), started on brief confirm. Each step is retryable and idempotent:

1. `extractBrief` (Claude, exists).
2. `findCompanies`: `treg.companies.search` (sector + country SA).
3. `findPeople`: `treg.people.search` (`company_domain + title`, `country: "SA"`, `limit` 25 to keep about 10).
4. `gatherEvidence`: provider `summary` + `treg.web.search` for why-now signals.
5. `scoreAndDraft`: Claude writes the fit / why / whyNow / leadWith / avoid / opener, citing only fetched evidence URLs. The existing "no evidence → cannot approve" rule stays.
6. `persistPipeline` v1.
7. Branch: managed account → notify the AM and `waitForEvent("published")`; otherwise publish directly.

**Cost control:** each step sends `X-Treg-Route-Max-Cost`, the running total of `X-Treg-Cost-Micro` is stored on the request, and the workflow stops at a per-request budget. Contact details are **not** bought up front: `treg.people.email.find` + `X-Treg-Route-Verify: true` runs only when the user approves a person.

**`OutreachWorkflow`**, one per (request, person):

1. Find + verify email.
2. `AccountGate.send()` (gate + ledger + Email Service).
3. `waitForEvent("reply", 2d)` → reminder.
4. `waitForEvent("reply", 3d)` → second reminder.
5. No reply or a decline → suggest an alternate path (the next ranked person, or an intro route).

Inbound email → Worker `email()` → resolve the reply token → `workflow.sendEvent("reply")` + status transition.

**Signals:** a Cron trigger runs a daily sweep over open requests' companies (news/hiring/funding via treg) → Queue → match to requests → feed items.

**PDPL:** store the minimum per person (name, title, company, profile URL, evidence URLs, verified email only after approval), record `source` + `served_by` provenance per field, honour suppression across all accounts, and give recipients a one-click opt-out in every email.

## Phases (one PR each, on branches off `claude/request-intake-mvp-jqsa42`)

1. **Platform move.** OpenNext + `wrangler.jsonc` (D1, DO, Workflows, Queues, R2, Email bindings); schema → sqlite + migrations; repo.ts → `batch()`; `AccountGate` DO; Better Auth + OTP via Email Service; the tests ported to vitest-pool-workers. Deploy to `*.workers.dev`. Also commit this plan to `docs/plans/2026-11-25-intro-cloudflare-rebuild.md` + `docs/plans/README.md` (template from `katib.studio`).
2. **Real sourcing + RequestWorkflow.** `lib/sourcing/{provider.ts,treg.ts,fixtures.ts}`; the workflow; budget tracking; the AM wait branch.
3. **UI rebuild.** Tailwind v4 + shadcn + next-intl; use-case catalogue; screens 1–4 + the AM console restyle. Delete `app/globals.css` hand CSS and the inline styles.
4. **Outreach, replies, intros.** OutreachWorkflow, Email Routing handler, Conversations + Intros screens, recipient accept/decline pages, opt-out.
5. **Growth + Lists/Signals.** SEO use-case/sector pages, referral credits, signal cron/queue, Lists.

## Verification

- `npm test` (vitest-pool-workers): the gate's 24 tests pass unchanged; new tests cover `AccountGate` concurrency (parallel sends never exceed the daily cap or balance, replacing `repo.test` :213 and `session.test` :75 races), batch atomicity for publish/versioning, and the cross-account cooldown fix.
- `wrangler dev` with local D1: walk the loop from the README (`/` → confirm → AM review → publish → send gate → attach → v2).
- Sourcing: a fixture provider by default in tests. One live treg run per use case with a $0.50 cap, checking that rows have evidence URLs, the Saudi country filter is respected (`_treg.ignored_filters` empty), and the cost is recorded.
- Email: send to a test inbox and reply to it, then confirm the reply lands in Conversations and advances the OutreachWorkflow. Force the reminders with a short test timeout.
- Playwright: port `scripts/e2e.mjs`; AR and EN screenshots of every screen at 390px and 1440px; axe accessibility checks.
- Deploy a preview to `workers.dev`, then switch `intro.sa` DNS only after the user signs off.

---
**Implementation**: Phase 1 — PR #13
**Status**: in progress
