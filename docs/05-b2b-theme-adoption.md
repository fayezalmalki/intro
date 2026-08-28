# Adopting the B2B theme

The design handoff (`Intro.sa_prototype_design_2.zip`) replaces the visual system this app grew
from the first prototype. This records what was adopted, what was not, and the two decisions a
future reader is most likely to want to reverse.

## Which of the two themes

The bundle ships **two** complete systems:

| | palette | type | direction |
|---|---|---|---|
| **B2B** *(adopted)* | ink `#0C0C0B`, off-white `#FAFAF7`, emerald `#0E5A4A` | Space Grotesk | LTR, with an Arabic variant |
| Consumer | paper `#F6F1E7`, ink `#17150F`, oxblood `#6B2C2C` | IBM Plex Sans Arabic 300 + Libre Caslon | RTL |

The consumer set is the closer match to what was shipped — its landing already carried this app's
own copy, «مين ودك توصل له؟» — and it remains the reference for tone. The B2B set was chosen
deliberately, so the consumer palette is the road not taken rather than an oversight.

## The RTL problem, and how the designer solved it

Four of the five artboards are LTR English. This app is `<html lang="ar" dir="rtl">` and every
screen is Arabic. Two things follow, and both were live faults the browser caught rather than
theory:

**Space Grotesk has no Arabic glyphs.** It is scoped to `.lat` — Latin names, the wordmark, the
`EN` toggle — and never set on `body`, where it would silently fall back for every Arabic string
in the product. The first build put `.lat` on the language control's *wrapper* and on a kicker
that mixed a Latin numeral with Arabic words, and both fell back invisibly until a probe compared
computed `font-family` against the presence of Arabic characters.

**The tight tracking is Latin-only.** The English H1 is 74px at `-0.035em`. Arabic is a connected
script and negative letter-spacing damages the joins — the designer's own Arabic artboard says so,
specifying 60px/700/1.25 with no tracking. `h1`/`h2` previously carried `-0.015em`/`-0.01em`
inherited from the old theme, which meant *every heading in the app*. Tracking now lives only on
`.lat`.

This is the judgement the earlier Refero pass could not make: an index of Western LTR products has
no opinion on the one thing that most distinguishes this product. Here the designer had already
made it, in the Arabic landing variant.

## Two decisions worth naming

**The primary button inverts.** It was the deepest green on the page, because the accent was doing
eight jobs and a filled button in the same value read as "this is also green". The handoff
separates action from state by *hue* rather than value: the action is ink and hovers to the
accent, and green now means state and nothing else. `--accent-deep`/`--accent-deepest` are gone.

**The rail is for the console only.** The handoff draws a 240px sidebar and the account-manager
console takes it. The requester keeps a top bar, because it has two destinations and a fixed rail
for two items is over-structure — the same argument made against the sidebar references in
`04-design-flow-review.md`, and it did not stop being true when a bundle drew one.

## What was not built, and why

- **Signals.** The handoff's fifth dashboard view. There is no signals table, no ingestion, and no
  rows. Its own footer describes announcements, registry updates, job boards and licensed news
  feeds — a Signals view is that pipeline, not a screen. Building it with placeholder rows would
  have made the dashboard's only invented surface also its most prominent one.
- **The requester dashboard's right rail.** Its two cards are Signals and a concierge cross-sell
  for a service that does not exist. The table takes the width instead.
- **Lists and Introductions as routes.** `people_lists`, `list_members` and `outreach` would back
  both. They are new product surfaces rather than a restyle, so they are named here rather than
  smuggled in.
- **Pricing and Concierge pages.** Fully specified in the bundle — three tiers with a
  monthly/annual toggle, six use-case cards, a PATH BRIEF mock — and outside "landing and
  dashboard".
- **A live `EN|عربي` toggle.** Rendered, showing Arabic as current, but not clickable: a second
  content tree does not exist, and a toggle that does nothing is worse than one that says where it
  stands.

## Brand assets

`public/logo/` holds four marks. The bundle's fixed-colour variants are all in the *consumer*
palette (`#17150F` on `#F6F1E7`), and the `currentColor` masters cannot be used through an `<img>`
— an SVG in an `<img>` is an isolated document and inherits nothing. So the B2B values are
substituted into the masters, which keeps the marks in step with the tokens if the palette moves
again.

## What the browser checks, and why each exists

Every one of these was added because it caught something:

- **Computed font-family against Arabic content** — three strings were falling back.
- **Computed letter-spacing on Arabic** — every heading in the app carried negative tracking.
- **Both viewport edges, not just the right** — RTL overflow runs leftward, which is how a 330px
  sidebar once escaped a `scrollWidth` check.
- **Contrast against the walked-up background** — a previous dark-surface pass shipped two
  elements at 1.8:1, and `.btn-ghost` on the new rail would have been 1.9:1.
- **The `?q=` walk end to end signed out** — the hero's form is the product's front door, and the
  artboard puts two buttons where it lives.

One process note: `npm run build` and `next dev` share `.next/`, so running a build against a live
dev server invalidates its chunk graph and serves unstyled HTML. An audit run in that state
reported failures in all three categories at once, none of them real.
