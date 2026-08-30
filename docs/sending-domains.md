# Sending domains — runbook

Who to call, what to create, and in what order. This is the operational half of
[`03-design-review.md` §2](03-design-review.md); that document argues the architecture, this
one is the list of things to go and do.

**Status: sending is deferred.** Fayez has parked outbound infrastructure while the product
works on intro logic, templates, and the approval and review screens — none of which need a
message to actually leave the building. So nothing below is blocking today. It is written
down now because reputation is the one part of the system that cannot be built in a sprint
at the end: a cold domain sending to strangers gets filtered, and the fix costs weeks of
calendar time no matter how much attention it gets. When outbound is picked back up, start
at "Pool 2" and read down.

What *is* live is pool 1 — sign-in codes to our own users — and that is enough for
everything currently being built.

---

## The hard rule, first

> **intro.sa never shares careers.sa's sending domain, and never uses careers.sa's ImprovMX
> credential.**

Not a preference — the thing that would break, and it holds whether or not pool 2 is ever
built. careers.sa's ImprovMX alias carries its own sign-in codes. intro.sa's pool 2 would
send to people who never signed up, at addresses that are sometimes *guessed* (Coresignal
returns `guessed_common_pattern` alongside `verified`; see `lib/coresignal.ts`). Guessed
addresses bounce. A bounce rate built on intro.sa's outreach, landing on careers.sa's
domain, degrades the deliverability of careers.sa's OTP mail — and the failure mode is
silent: people simply stop being able to log in to a product that has nothing to do with the
mail that caused it.

`lib/mailer.ts` enforces this rather than trusting it: `resolveSender()` refuses to
authenticate as any alias that is not on `intro.sa`, and derives the `From:` from the
credential's own domain so a mismatched pair cannot be configured by accident.

---

## The three pools

| Pool | Domain | Carries | Provider | Status |
|---|---|---|---|---|
| **1 — transactional** | `intro.sa` | Sign-in codes, receipts, "your unlock is ready" — mail to **our own users** | **Resend** (connected), ImprovMX SMTP as fallback | **live** |
| **2 — intro requests** | a dedicated subdomain, not yet chosen | The double opt-in ask sent to a **target who never signed up** | **open decision** — SES or equivalent | **deferred, and unresolved** |
| **3 — the user's own mailbox** | the user's own domain | The user's own cold message, sent as them | Gmail API / MS Graph OAuth | not built (Boardy model, later phase) |

They never share a domain, a subdomain, a credential or a provider account. A complaint on
pool 2 must not be able to take pool 1 down with it, and the only way to guarantee that is
separation at the domain level.

### Pool 1 — live today

**intro.sa is already connected to Resend, and Resend is where pool 1 should go.** It is a
real sending provider: it handles bounces, exposes complaint feedback, and gives us a
reputation we can actually see. ImprovMX is a *forwarding relay* — fine as a way to get mail
out of the door, but it reports almost nothing back, so a delivery problem shows up as
users saying they never got a code.

What the code does today: `lib/mailer.ts` speaks SMTP to ImprovMX, and that path is
deliberately **kept, not ripped out**. It works, it is tested, and it is the fallback if
Resend is unavailable or unconfigured. Moving pool 1's primary path to Resend is a small,
self-contained change to that one module — the OTP rules in `lib/otp.ts` sit above the
transport and do not care which one is underneath.

The ImprovMX setup, for the fallback path:

| | |
|---|---|
| Host | `smtp.improvmx.com` |
| Port | `587`, STARTTLS |
| Credential A | single-alias, `noreply@intro.sa` |
| Credential B | **any-alias**, `any-alias-1@intro.sa` — may set `MAIL FROM` to any address on `intro.sa` |

Use **credential B** (`SMTP_USER=any-alias-1@intro.sa`), because pool 1 needs more than one
mailbox — `noreply@` for codes, something a human answers for receipts — and the any-alias
credential covers all of them without a second setup. Set `SMTP_FROM` to whichever address a
given message should come from; anything not on `intro.sa` is ignored and the default used
instead.

Credentials go in the deployment's environment (`SMTP_PASSWORD`, and a Resend API key when
that path lands), never in the repo. `.env.example` carries the names only.

### Pool 2 — deferred, and genuinely unresolved

Fayez has parked this. Nothing below is blocking; it is recorded so the decision is not
re-litigated from scratch when outbound comes back.

**A subdomain on Resend is not the answer, and this is the trap worth naming.** The obvious
move is `m.intro.sa` on the Resend account that already exists. A subdomain does buy
something real — it isolates reputation, so bounces on outreach do not land on the domain
carrying our sign-in codes — but it does **not** make the mail permitted. An intro request
goes to someone who never asked to hear from us, and that is unsolicited mail under the
acceptable-use policy of every mainstream transactional ESP: Resend prohibits it, Postmark
is transactional-only by policy. Sending it from a subdomain of the same Resend account
risks a suspension of **the account**, which takes pool 1 down with it — the exact failure
the pool separation exists to prevent.

ImprovMX is not a candidate either: it is a forwarding relay for a domain's own mail, with
no bounce handling, no feedback loop and no reputation to own.

So the open decision is a provider that permits this class of mail on terms we can meet —
**Amazon SES on a dedicated subdomain** is the standing candidate, since you own the
reputation, set your own policy, and are judged on your actual bounce and complaint rates.
It needs a written production-access request that a human reads, which is why it has lead
time even once someone starts.

Until that is settled, intro requests do not go out from intro.sa at all. Pool 3 — the
user's own mailbox, copy-and-paste for now — is the only route, and it is the better one on
every axis anyway: the user is the sender, the reputation at risk is theirs, and the message
lands in a real thread.

---

## Records to create

Create these once per sending domain. A record is not live until DNS has propagated and the
provider's console says verified — check the console, not `dig`.

### Pool 1 — `intro.sa` (done, listed for reference)

ImprovMX, the fallback path:

| Type | Name | Value |
|---|---|---|
| MX | `intro.sa` | ImprovMX's two MX hosts, priorities 10 and 20 |
| TXT | `intro.sa` | `v=spf1 include:spf.improvmx.com ~all` |
| TXT | `improvmx._domainkey.intro.sa` | the DKIM value from the ImprovMX console |
| TXT | `_dmarc.intro.sa` | `v=DMARC1; p=none; rua=mailto:dmarc@intro.sa; fo=1` |

Resend, already connected — verify these read as they should in its console before pool 1's
primary path moves onto it. Two senders on one domain is fine as long as SPF lists both:

| Type | Name | Value |
|---|---|---|
| TXT | `resend._domainkey.intro.sa` | the DKIM value from the Resend console |
| TXT | `intro.sa` | SPF must include **both** senders: `v=spf1 include:spf.improvmx.com include:amazonses.com ~all` — Resend sends over SES infrastructure, so a lone ImprovMX `include` fails SPF on everything Resend sends |
| MX / TXT | `send.intro.sa` | Resend's custom-return-path records, if that feature is turned on |

One SPF record per domain, always. Two separate `v=spf1` TXT records is a permanent failure,
not a merge — if a second one exists, fold the includes into the first and delete it.

### Pool 2 — a dedicated subdomain (deferred; do none of this yet)

**Only when the provider decision above is settled.** Written against SES because that is
the standing candidate, and the subdomain is named `intros.intro.sa` here for concreteness —
neither is committed to.

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

## Warmup — 2–4 weeks, and it starts the day pool 2's domain is chosen

A new domain has no sending history, and receivers treat "no history" as "unknown, therefore
suspicious". They form their judgement from volume, consistency and complaint rate over
*days*, and nothing shortens that: the warmup clock is calendar time, not effort. Two to
four weeks is the normal range to reach a few hundred a day on a cold subdomain, longer if
early complaints have to be lived down.

Deferred along with the rest of pool 2, with one thing worth remembering when it is picked
back up: **warmup is the long pole, and it runs in parallel with nothing.** It cannot start
before the domain exists and it cannot be compressed once it has. The day pool 2's first
real campaign is ready, the domain needs to already be warm — starting warmup then means the
launch waits a month. So the order is: decide the provider, verify the domain, start
warming, and build the campaign while it warms.

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

Nothing here can be done from the repo — each one needs an account only he holds.

### Now — pool 1, so people can sign in

1. **`SMTP_PASSWORD` for `any-alias-1@intro.sa`** in the Vercel environment, plus
   `SMTP_USER=any-alias-1@intro.sa`. Until it is set, `/api/auth/send-otp` refuses in
   production rather than pretending to have sent (`lib/mailer.ts`). This is the shortest
   path to a working sign-in today.
2. **Check the SPF record on `intro.sa` lists both senders** before pool 1 moves onto
   Resend. One record, both includes — see the table above.

### Deferred — pool 2, on Fayez's explicit call

Not blocking anything currently being built. Listed so the lead times are known when it
comes back:

3. **The provider decision.** Resend is connected and is right for pool 1, but its AUP does
   not permit cold intro requests, and putting them on a subdomain of the same account risks
   the account — and therefore pool 1. SES on a dedicated subdomain is the standing
   alternative. This is the decision everything else in pool 2 waits on.
4. **Whatever that provider needs**: domain identity, DKIM, custom MAIL FROM, and — for SES
   — a **production-access request that a human reviews**. That review is the long pole, and
   it wants a written answer about double opt-in and unsubscribe.
5. **`dmarc@intro.sa`** as a real mailbox or an aggregate-report service, so the DMARC
   reports go somewhere someone reads. Worth doing for pool 1 alone.
6. **Start the warmup schedule the day pool 2's domain verifies**, not the day the campaign
   is code-complete.
