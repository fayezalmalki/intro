# intro

Request intake → intent understanding → sourced pipeline → account-manager review → outreach.

Arabic-first (RTL), Saudi market.

## Run it

```bash
npm install
cp .dev.vars.example .dev.vars   # set BETTER_AUTH_SECRET (openssl rand -hex 32) and ADMIN_EMAILS
npm run dev                      # http://localhost:3000 — Next.js on vinext, inside workerd
npm run db:local -- --seed       # in a second terminal: apply migrations + demo data to local D1
```

Everything runs locally in the Workers runtime: D1, the AccountGate Durable Object and
Cloudflare Email Service (simulated — sign-in codes are written to
`.cloudflare/tmp/email/` and logged in the dev server output). No Cloudflare account is
needed to develop. `npm run db:local -- --reset --seed` returns the local database to a
known state.

Set `ANTHROPIC_API_KEY` in `.dev.vars` to have Claude extract the intent brief. Without
one the app falls back to a deterministic keyword extractor, so every screen still works —
the confirm screen shows which was used.

## Walk the loop

1. **`/`** — write a request. `أدور وظيفة قيادية في الـ Product في شركات تقنية سعودية.`
2. **confirm** — the extracted brief, editable. Confirming queues it for an account manager.
3. **`/am`** — the queue, with an SLA countdown per request.
4. **review** — the AI-drafted pipeline. Approve rows, remove rows, publish.
   The row with no sourced evidence cannot be approved.
5. **`/requests/<id>`** — what the requester sees. Try to send: the account is an
   `observer`, so the gate refuses and says why. Hit **فعّل الإرسال** (a dev stand-in for
   verification and billing), then send.
6. **attach** — replace the list from a file, pasted rows or LinkedIn URLs, or a
   predefined list. It lands back in review as the next version.
7. **publish again** — the requester sees v2, and the person you already contacted
   keeps their status.

`npm test` runs the unit suite (the send gate). `npm run build && sh scripts/restart.sh`,
then `node scripts/e2e.mjs <dir>` drives the whole sequence above in Chromium and writes
screenshots plus a step log.

### The send gate

Nothing reaches a sender without an `allowed` verdict from `canSend()` in `lib/gate.ts`.
It enforces, in one place: global suppression (hashed, so the list is not itself a mailing
list), one message per person per request, a 90-day cross-request cooldown, a daily cap that
the credit balance cannot override, sufficient credits, and near-duplicate detection across
the account's own outbound. Both verdicts are written to `sendAttempts`, so refusals are
auditable too.

Near-duplicate detection uses trigram-shingle Jaccard similarity at a 0.7 threshold —
swapping only the recipient's name scores 0.75 and is refused; a genuinely rewritten opener
scores around 0.25 and passes. `lib/__tests__/similarity.probe.test.ts` pins that calibration.

## What's built

| Area | State |
|---|---|
| Intake + Claude intent extraction + confirm | working |
| AM queue with SLA | working |
| AI-drafted pipeline, evidence-gated approval | working — sourcing is still seeded (real sourcing is Phase 2) |
| Offline attach — CSV, pasted rows/LinkedIn URLs, predefined list | working |
| Pipeline versioning with outreach carry-forward | working |
| Auth — email OTP + Google (Better Auth), roles, account states | working |
| Send gate: suppression, 90-day cross-account cooldown, daily cap, credits, near-duplicate | working — serialised per account in the AccountGate Durable Object |
| Credit ledger (append-only, balance as a projection) | working |
| Sign-in email | working — Cloudflare Email Service |
| Outreach email, replies, intros, reminders | not built — Phase 4 |
| Billing / PSP | not built — "فعّل الإرسال" is a dev grant of 5 credits |

The rebuild plan, phase by phase: [`docs/plans/2026-11-25-intro-cloudflare-rebuild.md`](docs/plans/2026-11-25-intro-cloudflare-rebuild.md).

## Deploying

Cloudflare Workers, deployed with `npm run deploy` (`vinext-cloudflare deploy`).
`cloudflare.config.ts` is the source of truth for the Worker and its bindings.

1. `npx cf auth login` (CI: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`).
2. Set the Worker secrets declared in `cloudflare.config.ts`: `BETTER_AUTH_SECRET`,
   `BETTER_AUTH_URL`, `ADMIN_EMAILS`, and optionally `ANTHROPIC_API_KEY`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
3. Onboard `intro.sa` to Cloudflare Email Service so `noreply@intro.sa` can send.
4. `npm run deploy`. The first deploy provisions the `intro-db` D1 database.
5. Put its id in `D1_DATABASE_ID`, then `npm run db:migrate:remote` and
   `npm run db:seed:remote` — or let the Migrate workflow do it on merge to `main`.
6. Check `https://<host>/api/health`: it names whatever is still missing.

Migrations are never applied from a build. The development-only account shortcuts
(verify + grant credits) are disabled whenever `NODE_ENV=production`, and
`lib/__tests__/env.test.ts` holds that.

## Release flow

`main` is the default branch and is protected by CI. Work lands through pull
requests; every one runs typecheck, the unit suite, a schema-drift check, a
production build, and the Chromium flow.

The drift check regenerates migrations and fails if anything changes — a schema
edit without `npm run db:generate` cannot merge.

## Docs

- [`docs/00-demo-review.md`](docs/00-demo-review.md) — review of the original `introsademo.html` prototype, extracted design tokens, and the gaps this MVP closes
- [`docs/01-mvp-plan.md`](docs/01-mvp-plan.md) — the loop, request state machine, pipeline versioning, compliance, milestones
- [`docs/02-data-model.md`](docs/02-data-model.md) — the original data model (Postgres era; `lib/db/schema.ts` is current)
- [`docs/plans/`](docs/plans/) — approved plans, with [`CHANGELOG.md`](docs/plans/CHANGELOG.md)
- [`docs/03-design-review.md`](docs/03-design-review.md) — sending architecture, access model, monetization, tools, and the build order
- [`design/`](design/) — the Claude Design canvas source (`.dc.html` artboards + `canvas.json`)

## Shape

The account manager is always in the path. Claude drafts a pipeline from the confirmed
brief; the AM approves it, edits it, or replaces it with a list built offline. The
approved pipeline is attached to the request as a new immutable version, and the
requester reaches people through Intro's double opt-in or directly by email or LinkedIn.

Two rules do most of the work:

- **A row with no sourced evidence cannot be approved.** Every claim carries
  `{url, source, date, assertedBy}`, and publishing drops whatever was not approved.
- **Outreach is keyed by `(requestId, personId)`, not by pipeline row.** Replacing a
  pipeline therefore cannot lose a sent message or an open intro.

## Stack

Next.js App Router on **vinext** (Vite) · **Cloudflare Workers** · **D1** via Drizzle ·
a per-account **Durable Object** for the send/credit path · **Better Auth** (email OTP,
Google) · **Cloudflare Email Service** · Claude API for intent extraction · tests in
workerd via `@cloudflare/vitest-plugin`.

D1 has no interactive transactions: multi-write operations commit with `db.batch()`
(atomic), conditions that must hold at write time live in the write's own `WHERE`, and the
one read-decide-write path that moves money runs in the account's AccountGate Durable
Object. See `lib/db/repo.ts`.
