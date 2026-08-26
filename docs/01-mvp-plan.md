# Intro MVP — plan

**Shape (approved):** Balanced — AI drafts, the account manager decides.
**Stack (approved):** Next.js 15 (App Router) · Supabase (Postgres + Auth + RLS + Storage) · Resend · Claude API.
**Offline attach (approved):** CSV/XLSX upload with column mapping · paste rows or LinkedIn URLs · attach from a predefined list, then trim.
**Design (approved):** Claude Design canvas, extending the existing demo's tokens.

---

## 1. The loop

```
requester                     system                        account manager
─────────                     ──────                        ───────────────
writes one line   ──────────▶ LLM → structured brief
confirms / edits  ◀─────────  inclusions + exclusions
        │
        └── confirm ────────▶ request: in_sourcing
                              draft pipeline v1
                              (people DB + predefined lists
                               + LLM enrichment)      ──────▶ queue, SLA timer
                                                              reviews rows
                                                              ├─ approve v1
                                                              ├─ edit rows / reasons / openers
                                                              └─ replace: CSV · paste · list
                              pipeline vN published  ◀──────  approve
sees vN, picks up to cap ◀───
        │
        ├── Intro route ────▶ double opt-in email ──────────▶ accepted → shared thread
        └── Direct route ───▶ send email  ·  copy for LinkedIn
        │
        └── feedback ───────▶ بالضبط / قريب / لا ────────────▶ AM notified, ranking updated
```

The AM is **always** in the path in v1. The AI never publishes a pipeline on its own.
That is deliberate: it makes a bad draft a non-event.

## 2. Request state machine

| State | Meaning | Who moves it |
|---|---|---|
| `draft` | Text entered, not submitted | requester |
| `intent_review` | Brief generated, awaiting confirmation | requester |
| `in_sourcing` | Confirmed; AM queue; draft pipeline generating | system |
| `pipeline_ready` | A pipeline version is published | AM |
| `outreach` | At least one message sent | requester |
| `closed` | Fulfilled, expired, or withdrawn | either |

`in_sourcing` gets a visible SLA on the requester side (`عادة خلال ٢٤ ساعة`) — gap #9.

## 3. Pipeline versioning — gap #2

A request has many pipelines; each is immutable once published.

- `pipelines(request_id, version, source, status, created_by, approved_by, approved_at)`
- `source ∈ ai_generated | manual | imported_csv | pasted | from_list`
- Only one pipeline per request is `published` at a time; earlier ones become `superseded`.
- Requester state (selections, sent messages, feedback) hangs off `pipeline_items`, and
  carries forward by person identity when a new version is attached — so replacing a
  pipeline never loses a sent message or a live Intro.

This is what "attach it dynamically to the request" means concretely.

## 4. Provenance — gap #3

Every asserted claim on a card carries evidence:

```
evidence: [{ url, title, published_at, asserted_by: 'ai' | 'am', confidence }]
```

The AM console renders these as citations next to `whyNow`. An item with zero evidence
and `fit != possible` is blocked from approval. This is the single highest-leverage
addition for AM trust.

## 5. Fit rubric — gap #7

| Fit | Bar | Requires |
|---|---|---|
| `strong` (`توافق قوي`) | Decision-maker for the exact ask, with a timing signal | role match + company match + dated evidence |
| `medium` (`يستحق التجربة`) | Right role or right company, timing unclear | role match OR company match + evidence |
| `possible` (`احتمال توافق`) | Plausible from title alone | title match only; must set `thin: true` |

## 6. Outreach & compliance — gaps #4, #5, #6

- **Intro route (default).** Double opt-in. Recipient sees the reason, never the message,
  until they accept. Reply handled by Intro, no account needed — matches the demo.
- **Direct route.** Only when `email_verified`. Sent from a dedicated subdomain
  (`mail.intro.sa`) with SPF/DKIM/DMARC and warmup; `Reply-To` is the requester.
  Every outbound carries a one-click opt-out that writes to a global suppression list.
- **LinkedIn route.** Copy-to-clipboard only. No automation, no scraping-in-product.
- **Caps.** 10 per request, 1 per person, plus a global per-recipient cooldown.
- **PDPL.** Lawful basis recorded per person; suppression list checked at send time;
  data-subject deletion cascades to `pipeline_items` and `messages`.

## 7. Milestones

| # | Milestone | Ships |
|---|---|---|
| M0 | Foundation | Next.js + RTL/i18n, Supabase schema + RLS, roles (requester / AM / admin), design tokens as CSS vars |
| M1 | Intake + intent | New request, Claude-extracted brief, confirm screen, `in_sourcing` waiting state |
| M2 | AM console | Queue with SLA, brief view, draft pipeline review, per-row approve/edit/remove, publish |
| M3 | Offline attach | CSV/XLSX + column mapping, paste rows / LinkedIn URLs, attach-from-list + trim, dedupe & person matching |
| M4 | Results + outreach | Requester results (demo screens, wired), selection + cap, Intro double opt-in, direct email, LinkedIn copy |
| M5 | Replies + feedback | Inbound webhook → threads, requester inbox, `بالضبط / قريب / لا` loop back to AM |
| M6 | Predefined lists | READY lists CRUD, list → pipeline attach, membership dedupe |

Dynamic auto-refreshing criteria lists (`قائمة ديناميكية`, weekly auto-add) are **v2**,
not MVP — the attach direction is what unlocks the AM workflow today.

## 8. Out of scope for MVP

- Auto-publishing pipelines without AM approval
- LinkedIn automation or scraping
- Auto-refreshing dynamic lists
- Multi-tenant org billing
- Mobile apps
