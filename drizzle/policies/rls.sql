-- Row-level security policies.
--
-- WRITTEN NOW, NOT YET APPLIED. The production driver is neon-http, which is
-- stateless and carries no per-request Postgres role, so these policies would
-- have nothing to match on. lib/db/scoped.ts enforces the same rules in
-- application code today.
--
-- Adopting these is a driver switch, not a schema rewrite: postgres-js holds a
-- session, so `SET LOCAL app.account_id = '<id>'` per transaction makes the
-- database enforce isolation regardless of application bugs. The escape hatch
-- already exists in lib/db/index.ts.
--
-- Trigger for applying this: before the first `managed` account outside the
-- founding team. See docs/03-design-review.md §3.

CREATE OR REPLACE FUNCTION current_account_id() RETURNS text AS $$
  SELECT nullif(current_setting('app.account_id', true), '')
$$ LANGUAGE sql STABLE;

ALTER TABLE requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach      ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger        ENABLE ROW LEVEL SECURITY;

CREATE POLICY requests_own ON requests
  USING (account_id = current_account_id());

CREATE POLICY pipelines_own ON pipelines
  USING (EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = pipelines.request_id AND r.account_id = current_account_id()
  ));

CREATE POLICY pipeline_items_own ON pipeline_items
  USING (EXISTS (
    SELECT 1 FROM pipelines p
    JOIN requests r ON r.id = p.request_id
    WHERE p.id = pipeline_items.pipeline_id AND r.account_id = current_account_id()
  ));

CREATE POLICY outreach_own ON outreach
  USING (EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = outreach.request_id AND r.account_id = current_account_id()
  ));

CREATE POLICY send_attempts_own ON send_attempts
  USING (account_id = current_account_id());

CREATE POLICY ledger_own ON ledger
  USING (account_id = current_account_id());

-- people, companies and suppressions are deliberately global: the people graph
-- is shared across accounts, and a suppression must bind every account.
