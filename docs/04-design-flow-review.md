# Design and flow review

Every finding below was reproduced against the running app, not read off the source.
Screens were captured signed in as a requester (`faisal@example.sa`) and as an account
manager (`reem@example.sa`) at 1440×1000 and 390×844, using the `dev-email` provider through
`scripts/lib/auth-helper.mjs`.

**390px had never been opened before this pass.** The design canvas artboards were 1440/1180/960
and every previous screenshot was 1440. Arabic RTL on a phone was entirely unverified.

## On refero.design

The MCP endpoint is `https://api.refero.design/mcp`, not `refero.design/mcp` — `about-sa`
already carries the working config, and it is now copied into `.mcp.json` with `REFERO_API_KEY`
documented in `.env.example`. The server is **not reachable from this session**: a newly added
`.mcp.json` is only loaded at CLI start, and the key is not set. Add the key, restart, approve
the server, and its tools become available. The review below is mine, not Refero's.

---

## Blockers — the flow does not complete

### 1. There is no way to sign in

Middleware redirects every unauthenticated hit to `/login?next=…`. `/login` does not exist.

```
/am              -> redirect /login?next=%2Fam              -> 404
/am/requests/x   -> redirect /login?next=%2Fam%2Frequests%2Fx -> 404
/requests/x      -> redirect /login?next=%2Frequests%2Fx      -> 404
```

The 404 is Next.js's English default rendered inside `dir="rtl"`, so it reads
`.This page could not be found404`. A first-time visitor to `intro.sa` hits an English error
page with no way forward.

### 2. The account manager's first click from the queue is a 404

Reproduced end to end:

```
queue button label: افتح
queue button href : /am/requests/9d101aa7-…
clicking it returns HTTP 404
page says: 404 | This page could not be found.
```

`loadQueue()` selects **every** request with no status filter, so a request that was typed but
never confirmed appears in the queue. The draft pipeline is only created by `confirmBrief`, and
`app/am/requests/[id]/page.tsx` calls `notFound()` when no pipeline exists. So the queue
advertises rows it cannot open.

Two defensible fixes, and they are not the same product decision:

- **Filter the queue** to confirmed requests. Simple, but the account manager loses sight of
  people who started a request and stalled — which is exactly who a concierge service wants to
  chase.
- **Render the empty state**: show the brief and a "draft a pipeline" action. Keeps the stalled
  requests visible and makes the queue the real work list.

The second is the better product; the first is the smaller change. Taking the second.

### 3. There is no way to sign out

`signOut` is exported from `lib/auth.ts` and called nowhere. Neither bar renders it. Once you
are in, you cannot leave or switch identity — including on a shared machine.

### 4. The chrome is hardcoded to the two demo people

`components/Chrome.tsx` ignores the session entirely:

- `AmBar` prints `ريم · مديرة حسابات` and the avatar `R` for **every** account manager.
- `AppBar` prints the avatar `F` for **every** requester.

Real sign-ins now produce real accounts, so the first non-demo account manager sees Reem's name
above their own work. This is the same class of defect as `AM_NAME` below, and it survives auth
precisely because auth never touched the presentation layer.

### 5. Every requester is shown a door they cannot open

`AppBar` renders `لوحة مدير الحساب ←` linking to `/am`, unconditionally. A requester who clicks
it is bounced by middleware. The link should exist only when the account is an account manager.

### 6. New requests are still stamped with a fictional owner

`lib/actions.ts:12` — `const AM_NAME = "ريم"`, written to `assignedAm` on every create. The
pipeline view duly reports `مدير الحساب: ريم` for a request nobody has claimed. Requests should
start unassigned and read `غير مُسند` until an account manager takes one.

---

## Mobile — 164 lines of CSS, zero media queries

No page overflows horizontally; `scrollWidth` never exceeds the viewport on any of the ten
screens at 390px. The failure mode is internal crushing, which is why it went unnoticed.

### 7. The queue table is unusable at 390px

```css
.tr { grid-template-columns: 1fr 150px 130px 160px 130px 96px; }
```

666px of fixed track inside ~330px of content width. The `1fr` collapses to nothing and the
fixed columns shrink below their declared widths, so each cell lands around 40px and Arabic
wraps one word per line — a row becomes a column of single words. Needs to become stacked cards
below the breakpoint, not a shrunken table.

### 8. Labels and values overlap on the pipeline view

`app/am/requests/[id]/pipeline/page.tsx:112` — `repeat(2, minmax(0, 1fr))`, with a fixed
`width: 96px` label inside each cell. At 390px each column is ~135px, leaving 39px for the
value, and `الهدف / استثمار` collides with `الأدوار / —` into unreadable overlap. One column
below the breakpoint fixes it.

### 9. Both bars wrap and collide

`AmBar`'s nav pushes `حسابات` onto a second line straight through the `ريم · مديرة` label.
`AppBar` wraps `لوحة مدير الحساب ←` mid-phrase. Neither bar has a small-screen layout.

The requester screens survive: `/` and `/requests/[id]/confirm` hold up at 390px because their
rows are flex `.row between`, not fixed grids. The pattern that works is already in the codebase.

---

## Language and consistency

### 10. English column headers in an Arabic-first product

`app/am/page.tsx:59-63` — `REQUEST`, `REQUESTER`, `GOAL`, `STATE`, `SLA`.
`app/am/requests/[id]/page.tsx:56` — an eyebrow reading `REQUEST`.

These are the only untranslated strings in the app, and they sit at the top of the account
manager's main screen.

### 11. Two numeral systems for the same number

The confirm page renders confidence as `35%`; the pipeline view renders the same value as
`٣٥٪`. The `ar()` helper is applied on one screen and not the other.

### 12. Dead navigation

`طلباتي` in `AppBar` is a `<span>` — and there is no requester-facing list of your own requests
anywhere in the app, so the label promises a screen that was never built. `القوائم` and
`الأشخاص` in `AmBar` are likewise inert spans for features that do not exist.

Inert labels are worse than absent ones: they read as broken links rather than as future work.

---

## What holds up well

The requester path — intake, extracted brief, confirm — is the strongest part of the product and
needs no structural change. The pipeline view earns its place: seven stages with honest
`لم يبدأ` states communicates more than a progress bar. The evidence gate showing which rows
cannot be approved, and why, is the right shape for a concierge tool. The typographic system
(one accent, restrained greys, generous whitespace) is consistent across every screen, and RTL
composition is correct everywhere except the Next.js default 404.

## Order of work

1. Login page, sign-out, Arabic 404 — nobody can enter or leave
2. Queue empty state — the account manager's first click
3. Session-driven chrome, role-aware AM link, unassigned requests — no fictional identities
4. Breakpoint: stacked queue rows, single-column pipeline details, wrapping bars
5. Arabic headers, consistent numerals, remove or build the dead nav
