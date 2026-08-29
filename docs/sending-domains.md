# Sending domains — runbook

Who to call, what to create, and in what order. This is the operational half of
[`03-design-review.md` §2](03-design-review.md); that document argues the architecture, this
one is the list of things to go and do.

**Do these now, in this order.** Reputation is the one part of the system that cannot be
built in a sprint at the end — a cold domain sending to strangers gets filtered, and the fix
takes weeks of calendar time no matter how much attention it gets.

---

## The hard rule, first

> **intro.sa never shares careers.sa's sending domain, and never uses careers.sa's ImprovMX
> credential.**

Not a preference — the thing that would break. careers.sa's ImprovMX alias carries its own
sign-in codes. intro.sa's pool 2 sends to people who never signed up, at addresses that are
sometimes *guessed* (Coresignal returns `guessed_common_pattern` alongside `verified`; see
`lib/coresignal.ts`). Guessed addresses bounce. A bounce rate built on intro.sa's outreach,
landing on careers.sa's domain, degrades the deliverability of careers.sa's OTP mail — and
the failure mode is silent: people simply stop being able to log in to a product that has
nothing to do with the mail that caused it.

`lib/mailer.ts` enforces this rather than trusting it: `resolveSender()` refuses to
authenticate as any alias that is not on `intro.sa`, and derives the `From:` from the
credential's own domain so a mismatched pair cannot be configured by accident.

---

## The three pools

| Pool | Domain | Carries | Provider | Status |
|---|---|---|---|---|
| **1 — transactional** | `intro.sa` (ImprovMX) | Sign-in codes, receipts, "your unlock is ready" — mail to **our own users** | ImprovMX SMTP relay | **live** |
| **2 — intro requests** | `intros.intro.sa` | The double opt-in ask sent to a **target who never signed up** | Amazon SES, dedicated subdomain | **not provisioned — blocker for outreach GA** |
| **3 — the user's own mailbox** | the user's own domain | The user's own cold message, sent as them | Gmail API / MS Graph OAuth | not built (Boardy model, phase 3) |

They never share a domain, a subdomain, a credential or an ESP account. A complaint on pool
2 must not be able to take pool 1 down with it, and the only way to guarantee that is
separation at the domain level.

### Pool 1 — live today

ImprovMX on `intro.sa` is **Active**: MX and SPF verified, two SMTP credentials provisioned.

| | |
|---|---|
| Host | `smtp.improvmx.com` |
| Port | `587`, STARTTLS |
| Credential A | single-alias, `noreply@intro.sa` |
| Credential B | **any-alias**, `any-alias-1@intro.sa` — may set `MAIL FROM` to any address on `intro.sa` |

Use **credential B** (`SMTP_USER=any-alias-1@intro.sa`), because pool 1 will need more than
one mailbox — `noreply@` for codes, something a human answers for receipts — and the
any-alias credential covers all of them without a second setup. Set `SMTP_FROM` to whichever
address a given message should come from; anything not on `intro.sa` is ignored and the
default is used instead.

Passwords go in the deployment's environment (`SMTP_PASSWORD`), never in the repo.
`.env.example` carries the names only.

### Pool 2 — not provisioned, and the blocker for outreach

**ImprovMX does not cover pool 2, and must not be stretched to.** It is a forwarding and
relay product for a domain's own mail, not a bulk sender, and it gives you no bounce
handling, no complaint feedback loop and no reputation you control. Nor do Resend or
Postmark: an intro request goes to someone who never asked to hear from us, which is
unsolicited mail under the AUP of every mainstream transactional ESP — Postmark is
transactional-only by policy, Resend prohibits unsolicited email. Discovering that after
launch is a suspension, and a suspension on a shared account takes pool 1 with it.

So pool 2 is **Amazon SES on a dedicated subdomain, `intros.intro.sa`**, where we own the
reputation, set the policy, and are judged on our own bounce and complaint rates. Until it
exists, outreach cannot go out from intro.sa at all — pool 3 (the user's own mailbox, copy
and paste for now) is the only route.

---

## Records to create

Create these once per sending domain. A record is not live until DNS has propagated and the
provider's console says verified — check the console, not `dig`.

### Pool 1 — `intro.sa` (done, listed for reference)

| Type | Name | Value |
|---|---|---|
| MX | `intro.sa` | ImprovMX's two MX hosts, priorities 10 and 20 |
| TXT | `intro.sa` | `v=spf1 include:spf.improvmx.com ~all` |
| TXT | `improvmx._domainkey.intro.sa` | the DKIM value from the ImprovMX console |
| TXT | `_dmarc.intro.sa` | `v=DMARC1; p=none; rua=mailto:dmarc@intro.sa; fo=1` |

### Pool 2 — `intros.intro.sa` (to create)

1. In SES, verify the **domain identity** `intros.intro.sa` and enable **Easy DKIM**. SES
   gives three CNAMEs.

| Type | Name | Value |
|---|---|---|
| CNAME ×3 | `<token>._domainkey.intros.intro.sa` | the three values from SES |
| TXT | `intros.intro.sa` | `v=spf1 include:amazonses.com ~all` |
| MX | `intros.intro.sa` | `10 feedback-smtp.<region>.amazonses.com` (custom MAIL FROM) |
| TXT | `intros.intro.sa` | `v=spf1 include:amazonses.com -all` (on the custom MAIL FROM subdomain) |
| TXT | `_dmarc.intros.intro.sa` | `v=DMARC1; p=none; rua=mailto:dmarc@intro.sa; fo=1` |

2. Set a **custom MAIL FROM domain** in SES so the bounce path is on our subdomain and
   alignment is strict.
3. Request **production access** (SES starts in the sandbox and will only send to verified
   addresses). Say plainly what the mail is, that every send is double opt-in, and how
   people unsubscribe — the review reads the answer.
4. Turn on the **SNS bounce and complaint notifications** and wire them to `suppressions`.
   `lib/gate.ts` already refuses anyone on that list; nothing feeds it yet.

**Move DMARC to `p=quarantine` only after two weeks of clean aggregate reports**, and only
per-domain — never raise pool 2's policy because pool 1 looks healthy.

---

## Warmup — start now, it takes 2–4 weeks

A new domain has no sending history, and receivers treat "no history" as "unknown, therefore
suspicious". They form their judgement from volume, consistency and complaint rate over
*days*, and nothing shortens that: the warmup clock is calendar time, not effort. Two to
four weeks is the normal range to reach a few hundred a day on a cold subdomain, longer if
early complaints have to be lived down.

This is why it is in Phase 0. The day pool 2's first real campaign is ready, the domain
needs to already be warm; starting warmup then means the launch waits a month.

The shape of it:

| Week | Per day | To whom |
|---|---|---|
| 1 | 10–20 | our own team's mailboxes, across Gmail, Outlook and a Saudi ISP, opened and replied to |
| 2 | 30–60 | friendly design partners who agreed in advance |
| 3 | 100–200 | real, consented targets only |
| 4+ | double every 2–3 days while complaints stay under 0.1% and bounces under 2% |

Rules that matter more than the numbers:

- **Send every day.** A gap resets more progress than a small volume does.
- **Engagement over volume.** Twenty opened and replied-to beats two hundred ignored.
- **Never warm up on guessed addresses.** A `guessed_common_pattern` address from Coresignal
  is not a warmup recipient; it is a bounce waiting to be counted against a domain with no
  history to absorb it. Warm up on `verified` only.
- **Watch, and stop.** Above 0.1% complaints or 2% bounces, hold the volume where it is and
  find out why before going further.
- **Pool 1 needs no warmup** but has its own ceiling: it is already sending sign-in codes to
  people who asked for them, and it must never be borrowed for anything else.

---

## Needs Fayez

Nothing in this list can be done from the repo — each one needs an account only he holds.

1. **SES account and `intros.intro.sa` identity**, the DNS records above, custom MAIL FROM,
   and the production-access request. Nothing in pool 2 can start until the identity
   verifies, and the access request is the long pole.
2. **`dmarc@intro.sa`** as a real mailbox or an aggregate-report service, so the DMARC
   reports go somewhere someone reads.
3. **`SMTP_PASSWORD` for `any-alias-1@intro.sa`** in the Vercel environment, plus
   `SMTP_USER=any-alias-1@intro.sa`. Until it is set, `/api/auth/send-otp` refuses in
   production rather than pretending to have sent (`lib/mailer.ts`).
4. **Start the warmup schedule above the day the SES identity verifies**, not the day pool 2
   is code-complete.
