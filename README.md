# intro

Request intake → intent understanding → sourced pipeline → account-manager review → outreach.

Arabic-first (RTL), Saudi market.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

No API keys or external services required. State lives in a JSON file at `.data/db.json`,
created and seeded on first request; delete it to reset.

Set `ANTHROPIC_API_KEY` to have Claude extract the intent brief. Without one the app
falls back to a deterministic keyword extractor, so every screen still works — the
confirm screen shows which was used.

## Walk the loop

1. **`/`** — write a request. `أدور وظيفة قيادية في الـ Product في شركات تقنية سعودية.`
2. **confirm** — the extracted brief, editable. Confirming queues it for an account manager.
3. **`/am`** — the queue, with an SLA countdown per request.
4. **review** — the AI-drafted pipeline. Approve rows, remove rows, publish.
   The row with no sourced evidence cannot be approved.
5. **`/requests/<id>`** — what the requester sees. Reach out to someone.
6. **attach** — replace the list from a file, pasted rows or LinkedIn URLs, or a
   predefined list. It lands back in review as the next version.
7. **publish again** — the requester sees v2, and the person you already contacted
   keeps their status.

`npm run build && npm start`, then `node scripts/e2e.mjs <dir>` drives that whole
sequence in Chromium and writes screenshots plus a step log.

## What's built

| Area | State |
|---|---|
| Intake + Claude intent extraction + confirm | working |
| AM queue with SLA | working |
| AI-drafted pipeline, evidence-gated approval | working |
| Offline attach — CSV, pasted rows/LinkedIn URLs, predefined list | working |
| Pipeline versioning with outreach carry-forward | working |
| Outreach — recorded as state transitions | no email sending yet |
| Replies, inbox, double opt-in delivery | not built |
| Auth, roles, RLS | not built — the AM console is open, switchable from the top bar |

## Docs

- [`docs/00-demo-review.md`](docs/00-demo-review.md) — review of the original `introsademo.html` prototype, extracted design tokens, and the gaps this MVP closes
- [`docs/01-mvp-plan.md`](docs/01-mvp-plan.md) — the loop, request state machine, pipeline versioning, compliance, milestones
- [`docs/02-data-model.md`](docs/02-data-model.md) — the target Postgres schema
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
