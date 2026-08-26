# Design review

## Context

The MVP runs end to end today: intake → Claude-extracted brief → confirm → AM queue →
evidence-gated pipeline review → publish → versioned attach → outreach recorded as state.
Nothing actually sends, there is no auth, no billing, and no suppression list. This review
settles the eight decisions that turn that working demo into a product people can be let
into and charged for, and names what changes in the codebase for each.

Four decisions were taken by the user in this session:

| Decision | Chosen |
|---|---|
| Data residency | Managed Postgres now, kept portable; in-Kingdom later |
| Billable unit | **Per-send credits** |
| Access model | Open the intake, gate the sending |
| Sender model | See correction below — Boardy is the OAuth model, not a shared mailer |

### Correction carried into this plan

Boardy does not send from its own mailer. It holds a Google OAuth grant and sends from the
user's mailbox, as the user. That is the target model here too. The two routes are not
interchangeable:

- **From `intro.sa`** — Intro is the sender. One user's complaint rate degrades delivery for
  every other user, including password resets. Intro is the data controller under PDPL for
  every message.
- **From the user's mailbox** — the user is the sender, the reputation at risk is theirs, the
  message lands in a real thread, and Intro is a processor. Materially better on every axis
  except build cost.

Google's `gmail.send` is a restricted scope: annual CASA assessment plus app verification,
weeks of lead time. So the plan ships **copy-to-send first** and OAuth behind it, rather than
blocking the product on a Google review.

---

## 1. Feature map

Bold = exists today.

### Requester
**Intake** · **brief confirm** · **in_sourcing wait** · **results with version banner** ·
**per-person "why them"** · message composer · send queue with cap · reply inbox ·
**feedback (بالضبط / قريب / لا)** · requests list · saved lists · credits & billing

### Target (never has an account)
Opt-in page (accept / decline) · post-acceptance shared thread · one-click unsubscribe ·
suppression preferences · "why am I getting this"

### Account manager
**Queue with SLA** · **brief view** · **pipeline review with evidence gate** ·
**offline attach (CSV / paste / list)** · **publish with version carry-forward** ·
list CRUD · person & company records · first-send approvals · complaint queue

### Admin
Account verification & tiering · credit grants and refunds · global suppression list ·
deliverability dashboard (bounce, complaint, reply rate per sender identity) ·
**audit log** · sender-identity health

The gaps that block launch, in order: **suppression list**, **auth/roles**, **message
composer**, **sending**, **credits**, **opt-in page**, **inbox**.

---

## 2. Sending architecture — three separate reputation pools

The single most consequential decision here. Mixing these is what kills a product like this.

| Pool | Domain | Carries | Provider |
|---|---|---|---|
| **Transactional** | `mail.intro.sa` | Login, receipts, notifications to *our own users* | Resend or Postmark |
| **Intro requests** | `intros.intro.sa` | The double opt-in ask sent to a target | Amazon SES, dedicated |
| **Direct outreach** | the user's own domain | The user's cold message | Gmail API / MS Graph, as the user |

**Why SES for pool 2 and not Resend/Postmark.** An intro request goes to someone who never
signed up. However well-mannered it is, that is unsolicited mail, and the AUP of every
mainstream transactional ESP prohibits it — Postmark is strictly transactional-only and
Resend prohibits unsolicited email. Discovering this after launch means a suspension that
also takes down pool 1 if they share an account. SES is the pragmatic home: you own the
reputation, set your own policy, and are judged on your actual bounce and complaint rates.
Verify the current AUP wording with whichever vendor you pick before sending a single
message.

**Pool 3 never touches our infrastructure.** Phase 1 the user copies and sends. Phase 2 we
hold an OAuth grant and call the Gmail/Graph send API. Either way the mail originates from
their mailbox.

**LinkedIn is copy-to-clipboard, permanently.** No automation, no scraping in-product.
LinkedIn litigates against automation vendors and it is not a risk worth carrying.

### Non-negotiable send-path controls
Every send, on every pool, passes through one `canSend()` gate:

1. Global suppression list check (email hash) — a target who opts out is out everywhere.
2. Per-recipient cooldown — one message per person per requester, ever; one per person
   across all requesters per 90 days.
3. Per-account daily cap, independent of credit balance.
4. Near-duplicate detection across recipients — see §4.
5. Complaint-rate circuit breaker — an account over threshold is frozen pending AM review.

---

## 3. Access model — open the intake, gate the sending

Three account states, replacing today's two-role enum:

- `observer` — signs up freely, creates requests, sees the brief and the published pipeline.
  Cannot send. This is the whole demo, and it costs us nothing to give away.
- `verified` — passed verification, can send within tier caps.
- `managed` — AM assigned, concierge sourcing, higher caps.

**Verification** = work-email domain matches the claimed company + LinkedIn URL + one line on
what they're working on. First N sends per account are held for AM release, reusing the
existing approvals surface.

The point: **hitting the send gate is the qualification event.** It is a far better intent
signal than a waitlist form, and it arrives with a fully-specified brief and pipeline
attached. Instrument that moment above all others.

---

## 4. Message preparation

The Intro route has **two distinct artifacts**, and conflating them is a design error:

| Artifact | Seen by | Written by | When |
|---|---|---|---|
| **The reason** | the target, before deciding | Intro/Claude from the brief, requester may edit within limits | at request time |
| **The first message** | the target, only after accepting | the requester, Claude-drafted | released on acceptance |

The direct route has only the opener. `lib/sourcing.ts` already produces `opener`,
`leadWith` and `avoid` per person — the composer builds on those, it does not replace them.

**Composer behaviour**
- Claude drafts per recipient from the brief plus that person's evidence — never one body
  fanned out. Variables (`{{first_name}}`, `{{company}}`, `{{signal}}`) are a convenience,
  not the mechanism.
- Inline edit, with `leadWith` / `avoid` shown alongside as coaching.
- Send-time guardrails: ~120-word cap on first touch, no attachments, no links in the first
  message, banned-phrase list.
- **Near-duplicate detection** — normalized shingle similarity across a requester's outbound.
  Above threshold, the send is blocked, not warned. Under per-send credits this is the
  primary defence against the meter's own incentive.

---

## 5. Monetization — per-send credits, parameterized against the downside

Per-send credits as chosen. The incentive problem is real, so the parameters carry the load:

- **Refund on failure.** Hard bounce, invalid address, or suppression hit refunds the credit.
  You are not charging for mail that never arrived.
- **Bonus on acceptance.** An accepted intro or a reply returns a credit. Cheap, and it
  quietly steers behaviour toward quality without changing the meter.
- **No volume discounts.** Never price so that blasting is cheaper per send. Larger bundles
  buy convenience, not a lower unit rate.
- **Caps are separate from balance.** A daily cap the credit balance cannot override.

**Revenue lines**
1. Credit bundles (self-serve).
2. **Concierge retainer** — AM builds and maintains your pipelines. Monthly. This is where
   the money actually is in year one; the software is the delivery mechanism.
3. **List access** — the curated READY lists as a paid asset. See §8 on why these are the moat.

**Payments: Stripe does not serve Saudi merchants.** Use a local PSP — Moyasar, Tap, HyperPay
or PayTabs — and **mada support is mandatory**, not optional, for a Saudi consumer product.
Confirm current Stripe availability before committing either way.

---

## 6. Database

**Supabase Postgres**, nearest region, as already chosen. Portability is the discipline that
makes the residency decision reversible:

- Schema as plain Postgres. Migrations checked into the repo (Drizzle or Prisma), never
  applied through the dashboard.
- RLS policies as SQL files under version control.
- No Supabase-only extension in business logic. `pgvector` for semantic person/list matching
  is fine — it is stock Postgres.
- File storage behind a thin interface, as `lib/store.ts` is today.

**Escape hatch when residency becomes a procurement gate:** Google Cloud has a Dammam region
and Oracle has Jeddah/Riyadh; self-hosted Supabase on either preserves the developer
experience. Budget weeks, not days, and do it when a deal demands it.

`lib/store.ts` is the seam — every access already goes through `getDb()` / `mutate()`, so the
swap is contained to that file plus the actions that call it.

---

## 7. Tools

| Need | Pick | Why / alternates |
|---|---|---|
| App | **Next.js 15** (in place) | Server actions already carry the mutations |
| DB / auth / storage | **Supabase** | Postgres-native auth keeps RLS honest; see §6 |
| Intent + drafting | **Claude API** (in place) | `output_config` structured outputs, already wired |
| Transactional mail | **Resend** or **Postmark** | Pool 1 only |
| Intro-request mail | **Amazon SES**, dedicated subdomain | Pool 2 — own the reputation and the policy |
| Direct outreach | **Gmail API / MS Graph OAuth** | Pool 3 — the Boardy model |
| Background work | **Inngest** or **Trigger.dev** | Send pacing, retries, warmup, weekly list refresh |
| Payments | **Moyasar / Tap** | mada is mandatory; Stripe is unavailable to Saudi merchants |
| Product analytics | **PostHog** | Instrument the send gate above all else |
| Errors | **Sentry** | |
| Person/company data | curated lists + AM research first | See §8 |

---

## 8. The uncomfortable strategic point

Global enrichment vendors (Apollo, ZoomInfo, Clay and the LinkedIn-derived data layer beneath
them) have **weak Saudi coverage** — thin titles, stale companies, few verified emails, almost
no Arabic-name resolution. LinkedIn has also litigated aggressively against scraping vendors,
so that supply is legally unstable as well as thin.

That is not a problem with the plan; it is the reason the plan is shaped this way. **The
curated lists and the account manager's research are the asset — not the AI.** Claude drafts,
scores and explains; it does not know who runs product at a Riyadh fintech. Budget for list
building as a standing operational cost, and treat every AM-verified person record as an
appreciating asset. §5's "list access" revenue line follows directly from this.

---

## 9. Data model additions

On top of `docs/02-data-model.md`:

- `accounts` — `state (observer|verified|managed)`, `verified_at`, `daily_cap`, `credit_balance`
- `sender_identities` — `account_id`, `kind (intro_managed|gmail_oauth|ms_oauth)`, encrypted
  token ref, `health`, `last_verified_at`
- `messages` — split into `intro_reason` and `first_message` per §4; `body`, `variant_hash`
  for near-duplicate detection
- `suppressions` — `email_hash` unique, `reason`, `source`, `created_at`. Checked on **every**
  send, across all accounts.
- `credit_ledger` — append-only: `account_id`, `delta`, `reason (purchase|send|refund_bounce|
  bonus_accept|grant)`, `ref`. Balance is a projection, never a mutable column.
- `send_attempts` — `outreach_id`, `pool`, `provider_message_id`, `result`, `gate_failures[]`

`Outreach` keyed by `(requestId, personId)` in `lib/types.ts:120` stays exactly as it is —
that key is what already makes pipeline replacement non-destructive, and it is the right
anchor for `send_attempts` too.

---

## 10. Build order

| # | Ships | Blocks |
|---|---|---|
| 1 | Supabase migration, auth, three account states, RLS | everything |
| 2 | Suppression list + `canSend()` gate, with no sender attached yet | any send |
| 3 | Message composer, two artifacts, near-duplicate detection | any send |
| 4 | Pool 2: SES, opt-in page, accept/decline, shared thread | the Intro route |
| 5 | Credit ledger, bundles, PSP, refund/bonus rules | charging |
| 6 | Pool 3 phase 1: copy-to-send with tracking-free status marking | direct route |
| 7 | Reply inbox, inbound webhook | the loop closing |
| 8 | Pool 3 phase 2: Gmail/Graph OAuth — start CASA early, it gates the date | the Boardy model |

Start the Google verification paperwork at step 1, not step 8. It is the longest pole and it
runs in parallel with everything else.

---

## 11. Verification

- `npm run build && sh scripts/restart.sh` then `node scripts/e2e.mjs <dir>` — the existing
  end-to-end run must stay green through the Supabase migration. It is the regression net.
- Extend `scripts/e2e.mjs` per milestone: an `observer` blocked at the send gate; a suppressed
  address refused on every pool; a near-duplicate second send blocked; a credit refunded on
  simulated bounce; ledger balance reconciling against `credit_ledger` sum.
- Seed a suppression fixture and assert `canSend()` refuses it before any provider is called —
  that test should exist before the first real send is ever wired.
