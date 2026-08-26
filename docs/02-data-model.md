# Data model

Postgres (Supabase). All tables carry `id uuid pk`, `created_at`, `updated_at`.
RLS on every table; `app_role ∈ requester | account_manager | admin`.

## Identity

- **profiles** — `user_id fk auth.users`, `full_name`, `locale ('ar'|'en')`, `role app_role`
- **assignments** — `account_manager_id`, `segment` — round-robin routing of new requests

## Request & intent

- **requests** — `requester_id`, `raw_text`, `locale`, `status request_status`,
  `assigned_am_id`, `sourcing_due_at`, `closed_reason`
- **request_briefs** — `request_id`, `goal_type (job|sales|partnership|investment|specific_person)`,
  `target_roles text[]`, `seniority text[]`, `industries text[]`, `geos text[]`,
  `company_size_min/max`, `inclusions text[]`, `exclusions text[]`, `must_haves text[]`,
  `model_version`, `confidence numeric`, `confirmed_at`, `confirmed_text`

  One row per generated version; the confirmed one is the latest with `confirmed_at not null`.

## People graph

- **companies** — `name`, `name_ar`, `domain`, `industry`, `size_bucket`, `geo`, `linkedin_url`
- **people** — `latin_name`, `first_name_ar`, `title`, `title_ar`, `company_id`, `geo`,
  `linkedin_url`, `email`, `email_verified bool`, `open_to_intros bool`,
  `source (ai|am|import|list)`, `confidence numeric`,
  `lawful_basis text`, `suppressed_at timestamptz`
  - unique on `lower(linkedin_url)`; secondary match on `lower(email)`; fuzzy fallback on
    `(latin_name, company_id)` for dedupe during import

## Pipelines — the core of this MVP

- **pipelines** — `request_id`, `version int`, `source pipeline_source`,
  `status (draft|submitted|published|superseded|rejected)`,
  `created_by`, `approved_by`, `approved_at`, `note`
  - `pipeline_source ∈ ai_generated | manual | imported_csv | pasted | from_list`
  - partial unique index: one `published` pipeline per `request_id`

- **pipeline_items** — `pipeline_id`, `person_id`, `rank int`,
  `fit (strong|medium|possible)`, `thin bool`,
  `why`, `why_now`, `role_relevance`, `company_relevance`, `timing`,
  `lead_with`, `avoid`, `opener_draft`,
  `route (intro|email|linkedin)`,
  `status (proposed|approved|removed)`, `am_note`,
  `generated_by (ai|am)`, `edited_by_am bool`

- **item_evidence** — `pipeline_item_id`, `url`, `title`, `published_at`,
  `asserted_by (ai|am)`, `confidence` — gap #3

## Lists

- **lists** — `name`, `name_ar`, `description_ar`, `kind (ready|dynamic)`, `owner_id`,
  `people_count`, `companies_count`
- **list_criteria** — `list_id`, `field`, `op`, `value` — v2 auto-refresh reads these
- **list_members** — `list_id`, `person_id`, `added_by`, `added_at`

`from_list` pipelines snapshot `list_members` at attach time — later list edits do not
mutate a published pipeline.

## Outreach

- **outreach_threads** — `pipeline_item_id`, `channel (intro|email|linkedin)`,
  `status (queued|sent|delivered|opened|replied|accepted|declined|bounced|failed)`,
  `provider_message_id`, `sent_at`, `last_event_at`
- **messages** — `thread_id`, `direction (outbound|inbound)`, `from_email`, `to_email`,
  `subject`, `body`, `raw_provider_payload jsonb`
- **intro_requests** — `pipeline_item_id`, `state (requested|notified|accepted|declined|expired)`,
  `opt_in_token`, `notified_at`, `responded_at`
- **suppressions** — `email` unique, `reason`, `source`, `created_at` — checked at every send
- **send_counters** — `request_id`, `day date`, `count` — enforces the cap of 10

## Feedback & audit

- **request_feedback** — `request_id`, `pipeline_id`, `verdict (exact|close|off)`, `note`
- **audit_events** — `actor_id`, `entity_type`, `entity_id`, `action`, `diff jsonb`

Every pipeline publish, replace, and send writes an audit event. That log is what lets a
requester be told *why* their list changed.
