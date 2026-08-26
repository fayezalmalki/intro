# intro

Request intake → intent understanding → sourced pipeline → account-manager review → outreach.

Arabic-first (RTL), Saudi market. See `docs/`:

- [`docs/00-demo-review.md`](docs/00-demo-review.md) — review of the original `introsademo.html` prototype, extracted design tokens, and the gaps this MVP closes
- [`docs/01-mvp-plan.md`](docs/01-mvp-plan.md) — the loop, request state machine, pipeline versioning, compliance, milestones
- [`docs/02-data-model.md`](docs/02-data-model.md) — Postgres schema

## Shape

The account manager is always in the path. Claude drafts a pipeline from the confirmed
brief; the AM approves it, edits it, or replaces it with a list built offline (CSV, pasted
rows, or a predefined list). The approved pipeline is attached to the request as a new
immutable version, and the requester reaches people through Intro's double opt-in or
directly by email or LinkedIn.

## Stack

Next.js 15 (App Router) · Supabase (Postgres, Auth, RLS, Storage) · Resend · Claude API.
