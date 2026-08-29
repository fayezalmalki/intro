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

## The self-serve GTM flow

Alongside the account-manager loop below, `/gtm` is the unattended path: a
website in, and segments, decision makers and an Arabic opener out.

1. **`/gtm`** — one field, the user's own website. `careers.sa`.
2. The run rail shows six steps with real per-step states. Steps 1–4 run
   automatically because every one of them is free; a step that fails says
   *what* failed and offers the manual correction beside it.
3. **Segments** — 4–6 campaigns, each with a pain line, three criteria and a
   count. Every count prints the exact free-search query that produced it. A
   count that cannot be sourced shows the reason in place of the number; there
   is no estimate anywhere.
4. **Companies → people** — the search endpoints return **ids, not records**, so
   a company name and a person's name are both purchases. Keeping a row is free
   and reversible; the buy button names the credit cost and the confirmation
   carries that figure back to the server, which refuses if the selection moved.
5. **`/gtm/<id>/review`** — the person beside their letter. Approve, reject, edit
   inline, toggle Arabic/English. Delivery is copy, LinkedIn, or the user's own
   mail client — sending from Intro is off, and the screen says so.
6. **The paywall** — at the send moment, after everything above is visible. It
   states what a credit is and that this screen charges nothing today.

**`/examples`** is public and needs no key, no credit and no sign-up: it renders
the composer live over hand-written fixtures, so the Arabic drafts can be read
before anyone signs up.

Set `ANTHROPIC_API_KEY` for the site analysis and the segment proposals, and
`CORESIGNAL_API_KEY` for real counts and real rows. Without either, every screen
still works and each one says which half is missing rather than filling in.

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

`npm test` runs the unit suite — the send gate, the OTP limiter, the Coresignal
credit accounting, migrations and the RLS rehearsal. `npm run build && sh scripts/restart.sh`,
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
| Account states (observer / verified / managed) | working |
| Send gate: suppression, cooldown, daily cap, credits, near-duplicate | working, 24 unit tests |
| Credit ledger (append-only, balance as a projection) | working |
| Outreach — recorded as state transitions through the gate | no email sending yet |
| Replies, inbox, double opt-in delivery | not built |
| Auth — NextAuth v5: Google, email OTP, magic link, over `@auth/drizzle-adapter` | working |
| OTP hardening — sha256 at rest, ≤8 attempts, ≤3 sends / 10 min, precheck → send → commit | working |
| Roles (requester / account_manager / admin), enforced inside every server action | working |
| Row-level security | policies written (`drizzle/policies/rls.sql`), not applied — queries are scoped in `lib/db/scoped.ts` and rehearsed in `lib/__tests__/rls.probe.test.ts` |
| Usage instrumentation + `/am/ops` — OTP delivery health, vendor spend | working |
| Coresignal client — typed, credit-accounted, per-args dedupe | working; wired into the GTM flow's free searches |
| Sourcing (AM loop) | `lib/sourcing.ts` still returns eight fixed people |
| GTM flow — site analysis, segments, sourced counts, paid-collect gate | working |
| Arabic intro composer — three templates, English variant, worked examples | working, 25 unit tests |
| Draft review — approval, email-status gate, copy / LinkedIn / mailto | working |
| Outbound sending | off behind `INTRO_SENDING_ENABLED`; nothing can be marked sent without a provider message id |
| Webhook idempotency log | wired: `webhook_events` + the ledger's own idempotency index |
| Billing / PSP | StreamPay seam built; falls back to a clearly-marked test provider when no credentials are present |

## Deploying

Everything is in Postgres and auth is real, so a deploy needs an environment
rather than a rewrite:

1. A Neon `DATABASE_URL` — and `DATABASE_URL_UNPOOLED`, which the migrator
   prefers, because pgbouncer in transaction mode can mangle DDL. Then
   `npm run db:migrate` as an explicit deploy step, never from `build`, where a
   preview deploy sharing the URL would run DDL against production.
2. `AUTH_SECRET` and `ADMIN_EMAILS`. Without the first there is no session at
   all; without the second no account can ever become an admin, so nobody can
   grant a role or verify an account.
3. `SMTP_USER` and `SMTP_PASSWORD` for the intro.sa ImprovMX alias. Without them
   `/api/auth/send-otp` refuses in production rather than pretending to have
   sent. intro.sa is also connected to Resend, which is where sign-in mail is
   headed — see [`docs/sending-domains.md`](docs/sending-domains.md).

`/api/health` reports which of those is missing, so an opaque 500 becomes a URL
that names the problem.

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
- [`docs/sending-domains.md`](docs/sending-domains.md) — the three reputation pools, the DNS records to create, and why cold sending is deferred
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

Next.js 15 (App Router, server actions) · React 19 · **Drizzle ORM over Postgres** — Neon in
production, PGlite locally and in tests · NextAuth v5 with `@auth/drizzle-adapter` ·
nodemailer over ImprovMX SMTP · Claude API for intent extraction · Zod · Vitest, plus a
Playwright driver at `scripts/e2e.mjs`.

Outbound mail is deliberately minimal: pool 1 (sign-in codes to our own users) is the only
thing that sends. Cold outreach is deferred — see
[`docs/sending-domains.md`](docs/sending-domains.md).

There is no file store and no `lib/store.ts`. Every read goes through `lib/db/loaders.ts`,
which assembles the `Db` shape the pure domain functions already consume, and every write
goes through `lib/db/repo.ts`. That indirection is what let the send gate, the pipeline
logic and the credit ledger move to Postgres without a line of domain logic changing.

Authorization lives in `lib/session.ts` and is called from inside each server action rather
than from the pages — a server action is a POST endpoint anyone can invoke without ever
loading the page it sits on, so a route guard alone would look like authorization and
enforce nothing.
