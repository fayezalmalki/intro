# Review — `introsademo.html`

Decoded from the bundled Claude Design canvas. Nine screens:
`landing → new → confirm → results → requests → lists → bulk → draft overlay → warm-intro overlay (3 steps)`.

## Design tokens (extracted, to be reused verbatim)

| Token | Value | Use |
|---|---|---|
| `--ink` | `#111111` | Primary text |
| `--ink-2` | `#686868` | Secondary text |
| `--ink-3` | `#A3A3A0` | Tertiary / disabled |
| `--accent` | `#4F6B4C` | Brand green, strong-fit |
| `--canvas` | `#F7F7F4` | Page background |
| `--surface` | `#FFFFFF` | Cards |
| `--line` | `#DEDED7` | Borders |
| `--line-2` | `#C9C9C2` | Emphasis borders |
| `--fill` | `#EFEFEA` / `#EDEDE7` | Selected states |
| `--accent-wash` | `#F2F5F1` / `#DDE6DA` | Accent backgrounds |
| `--danger-wash` | `#FBF5F5` / `#E4CFCF` | Destructive |

Type: `IBM Plex Sans Arabic` (UI), `IBM Plex Sans` (latin names / labels).
Direction: `dir="rtl"`. Numerals: Arabic-Indic (`٠١٢٣٤٥٦٧٨٩`).

## Strengths to preserve

1. **Intent confirmation before search.** The `confirm` screen restates the request as
   inclusions + exclusions and asks `تمام، كمّل` / `أعدّل الطلب`. This is the product.
2. **Reason-first result cards.** `roleRel / companyRel / timing / whyNow / leadWith / avoid`
   instead of a name list.
3. **Honesty affordances.** `thin: true`, `غير معروف`, `ما لقينا إيميل موثّق لهذا الشخص`.
4. **Double opt-in Intro.** Shows the recipient the exact email before it sends; the
   requester's message is withheld until both sides agree.
5. **Send cap designed in.** `sendCap = 10` per request, one message per person.

## Gaps blocking the MVP

| # | Gap | Fix in this MVP |
|---|---|---|
| 1 | No operator surface | Build the AM console: queue, brief, pipeline review, offline attach |
| 2 | No result versioning | `pipelines.version` + immutable published versions; requester sees "v2 attached" |
| 3 | No provenance on claims | `evidence[]` on every pipeline item: `{url, published_at, asserted_by}` |
| 4 | PDPL / consent | Lawful-basis record, suppression list, one-click opt-out on every outbound |
| 5 | No reply handling | Inbound webhook → `messages` → requester inbox + AM visibility |
| 6 | Deliverability | Dedicated sending subdomain, SPF/DKIM/DMARC, bounce + complaint handling |
| 7 | `fit` rubric undefined | Written rubric applied by AM; `fit` becomes a scored, explainable field |
| 8 | Dynamic lists aspirational | Ship READY-list attach now; auto-refresh criteria lists in v2 |
| 9 | Requester blind to human step | New request state `in_sourcing` with an SLA-aware waiting screen |

## Copy inconsistency to decide

UI chrome mixes English section labels (`READY`, `YOURS`, `WHY THEM`, `HOW TO APPROACH`)
into an otherwise Arabic RTL interface. Reads as deliberate, but needs a ruling before
the AM console doubles the surface area. Recommendation: keep English for
*category/system* labels, Arabic for everything the user reads as a sentence.
