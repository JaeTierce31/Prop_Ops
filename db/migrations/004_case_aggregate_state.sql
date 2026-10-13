-- PROP-OPS-DATA-AUTH-001-B
-- Canonical governed aggregate state persisted in PostgreSQL.
-- This preserves the already-verified pure domain kernel while moving canonical
-- state out of browser localStorage. Relational tables remain durable projections
-- and integration surfaces; this aggregate row is the version-checked mutation root.

CREATE TABLE IF NOT EXISTS prop_ops.case_aggregate_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  case_public_id text NOT NULL,
  state jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, case_public_id)
);

ALTER TABLE prop_ops.case_aggregate_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.case_aggregate_state FORCE ROW LEVEL SECURITY;

CREATE POLICY case_aggregate_tenant_all
ON prop_ops.case_aggregate_state
FOR ALL
USING (
  org_id = prop_ops.current_org_id()
  AND prop_ops.has_org_membership(org_id)
)
WITH CHECK (
  org_id = prop_ops.current_org_id()
  AND prop_ops.has_org_membership(org_id)
);

GRANT SELECT, INSERT, UPDATE ON prop_ops.case_aggregate_state TO prop_ops_app;

CREATE INDEX IF NOT EXISTS idx_case_aggregate_org_case
  ON prop_ops.case_aggregate_state(org_id, case_public_id);
