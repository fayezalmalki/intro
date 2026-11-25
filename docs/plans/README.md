# `docs/plans/` — design plans alongside the code

This folder is the durable record of every Claude Code plan-mode plan written for intro.sa. Plans live here so they:

- **Persist** beyond the transient `/root/.claude/plans/` sandbox file.
- **Version** alongside the code they describe — `git log docs/plans/` is a project-wide design history.
- **Review** in PRs — reviewers see the plan and the implementation in one diff.
- **Sync to Obsidian** — point Obsidian's vault at `~/github/` (or the repo root) and search `path:docs/plans` to browse.

## Naming convention

```
docs/plans/<YYYY-MM-DD>-<short-slug>.md
```

- `YYYY-MM-DD` is the date the plan was approved.
- `<short-slug>` is 2–6 hyphenated words capturing the plan's intent (e.g. `onboarding-tier-1`, `pricing-tune`, `credits-no-tx-hotfix`).
- Two plans on the same day → suffix `-am` / `-pm` or `-1` / `-2`.

## File template

```markdown
# <Plan title>

## Context
Why this change is being made — the problem, the prompt, the intended outcome.

## Approach
The recommended path. Single recommendation, not all alternatives.

## Critical files
A table of the files this plan modifies + what each change does.

## Reused
Existing functions and utilities the plan leans on, with file paths.

## Out of scope
What this plan deliberately doesn't tackle.

## Verification
How to test the change end-to-end after it ships.

---
**Implementation**: PR #34, PR #35
**Status**: shipped | partially shipped | superseded
```

The footer updates over time as PRs land. `Status: superseded` means a later plan replaced this one — link to the successor.

## How a plan flows

```
plan mode in Claude Code
  ↓
write plan to /root/.claude/plans/<slug>.md
  ↓
user approves
  ↓
implementation PR includes:
  • the code changes
  • a copy of the plan at docs/plans/<dated-slug>.md
  • a one-line append to docs/plans/CHANGELOG.md
  ↓
PR merges → plan is permanent project history
```

## CHANGELOG

`docs/plans/CHANGELOG.md` is the append-only journal: one line per plan, with date / slug / implementation PR(s) / status. Scan it to get a high-level project timeline without opening individual plan files.

## Why not Notion / Linear / GDocs?

Three reasons we keep plans in the repo:

1. **Reviewable in the same PR** as the implementation. No tab-switching to confirm intent vs. code.
2. **Versioned with git** — every change to a plan has an author, a timestamp, and a diff.
3. **Survives tooling shifts.** Linear gets replaced; markdown in a git repo is forever.

External tools (project trackers, customer-facing docs) coexist fine — they just aren't where decisions get recorded.
