# intro

Request intake → intent understanding → sourced pipeline → account-manager review → outreach.

Arabic-first (RTL), Saudi market.

## Run it

```bash
npm install
cp .env.example .env.local     # already points at the local database
sh scripts/pg-start.sh         # Postgres, nothing to install
npm run db:reset               # apply the schema and seed
npm run dev                    # http://localhost:3000
```

No API keys, no database to provision. `scripts/db-local.mjs` serves PGlite — Postgres
compiled to WASM — over the real Postgres wire protocol, so local development runs the
same driver path as Neon rather than a stand-in. `npm run db:reset` returns it to a
known state.

Set `ANTHROPIC_API_KEY` to have Claude extract the intent brief. Without one the app
falls back to a deterministic keyword extractor, so every screen still works — the
confirm screen shows which was used.

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
| AI-drafted pipeline, evidence-gated approval | working |
| Offline attach — CSV, pasted rows/LinkedIn URLs, predefined list | working |
| Pipeline versioning with outreach carry-forward | working |
| Account states (observer / verified / managed) | working — no real auth behind them yet |
| Send gate: suppression, cooldown, daily cap, credits, near-duplicate | working, 24 unit tests |
| Credit ledger (append-only, balance as a projection) | working |
| Outreach — recorded as state transitions through the gate | no email sending yet |
| Replies, inbox, double opt-in delivery | not built |
| Auth, roles, RLS | not built — `lib/session.ts` is the stand-in |
| Billing / PSP | not built — "فعّل الإرسال" is a dev grant of 5 credits |

## Deploying

**Not deployable yet, on purpose.** State still lives in a JSON file, and a
serverless filesystem loses writes between requests — so `lib/env.ts` refuses to
start the store when `NODE_ENV=production` without a `DATABASE_URL`. A request
that looked accepted and then vanished is worse than a boot failure.

What clearing that takes:

1. A Neon `DATABASE_URL`, then `npm run db:migrate` as an explicit deploy step —
   never from `build`, where a preview deploy sharing the URL would run DDL
   against production.
2. Porting `lib/store.ts` reads and writes onto `lib/db/scoped.ts`.
3. Real auth, replacing `lib/session.ts`.

The development-only account shortcuts (verify + grant credits) are disabled
whenever `NODE_ENV=production`, and `lib/__tests__/env.test.ts` holds that.

Copy `.env.example` to `.env.local` to run locally. No variable is required for
the local flow.

## Release flow

`main` is the default branch and is protected by CI. Work lands through pull
requests; every one runs typecheck, the unit suite, a schema-drift check, a
production build, and the Chromium flow.

The drift check regenerates migrations and fails if anything changes — a schema
edit without `npm run db:generate` cannot merge.

## Docs

- [`docs/00-demo-review.md`](docs/00-demo-review.md) — review of the original `introsademo.html` prototype, extracted design tokens, and the gaps this MVP closes
- [`docs/01-mvp-plan.md`](docs/01-mvp-plan.md) — the loop, request state machine, pipeline versioning, compliance, milestones
- [`docs/02-data-model.md`](docs/02-data-model.md) — the target Postgres schema
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

Next.js 15 (App Router, server actions) · Claude API for intent extraction ·
JSON file store.

The store is a stand-in for Supabase (Postgres + Auth + RLS + Storage), kept behind
`lib/store.ts` so the swap is contained. It has no write locking, so it is fine for one
person walking the flow and not for concurrent use.
