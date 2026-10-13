-- PROP-OPS-DATA-AUTH-001
-- Canonical PostgreSQL foundation for Property Ops pilot-grade execution.
-- Applied first to isolated Neon branch: prop-ops-data-auth-001.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS prop_ops;

CREATE TABLE IF NOT EXISTS prop_ops.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prop_ops.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  external_ref text,
  name text NOT NULL,
  address_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, external_ref)
);

CREATE TABLE IF NOT EXISTS prop_ops.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  property_id uuid NOT NULL REFERENCES prop_ops.properties(id) ON DELETE RESTRICT,
  external_ref text,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id, label),
  UNIQUE(org_id, external_ref)
);

CREATE TABLE IF NOT EXISTS prop_ops.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject text NOT NULL UNIQUE,
  email text,
  display_name text NOT NULL,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prop_ops.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES prop_ops.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES prop_ops.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES prop_ops.units(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('resident','manager','worker','ops')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id,user_id,property_id,unit_id,role)
);

CREATE TABLE IF NOT EXISTS prop_ops.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  org_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  property_id uuid NOT NULL REFERENCES prop_ops.properties(id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL REFERENCES prop_ops.units(id) ON DELETE RESTRICT,
  resident_user_id uuid NOT NULL REFERENCES prop_ops.users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('DRAFT','REPORTED','NORMALIZED','TRIAGED','AUTHORIZED','IN_WORK','VERIFIED','DISPUTED','SETTLEMENT_READY','CLOSED')),
  title text NOT NULL,
  report_text text,
  summary jsonb,
  summary_confirmed boolean NOT NULL DEFAULT false,
  severity text CHECK (severity IN ('EMERGENCY','PRIORITY','ROUTINE')),
  sla_hours integer CHECK (sla_hours IS NULL OR sla_hours > 0),
  sla_due_at timestamptz,
  resident_outcome text CHECK (resident_outcome IS NULL OR resident_outcome IN ('CONFIRMED','DISPUTED')),
  dispute_reason text,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prop_ops.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  org_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL REFERENCES prop_ops.cases(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  status text NOT NULL CHECK (status IN ('AUTHORIZED','ASSIGNED','ACCEPTED','IN_PROGRESS','WORK_REPORTED_COMPLETE','EVIDENCE_REVIEW','VERIFIED','REWORK_REQUIRED')),
  scope text NOT NULL,
  assignee_user_id uuid REFERENCES prop_ops.users(id) ON DELETE RESTRICT,
  authorized_by uuid NOT NULL REFERENCES prop_ops.users(id) ON DELETE RESTRICT,
  authorized_at timestamptz NOT NULL,
  verified_by uuid REFERENCES prop_ops.users(id) ON DELETE RESTRICT,
  verified_at timestamptz,
  supersedes_id uuid REFERENCES prop_ops.work_orders(id) ON DELETE RESTRICT,
  superseded_by_id uuid REFERENCES prop_ops.work_orders(id) ON DELETE RESTRICT,
  rework_reason text,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, revision)
);

CREATE TABLE IF NOT EXISTS prop_ops.evidence_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  org_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL REFERENCES prop_ops.cases(id) ON DELETE RESTRICT,
  work_order_id uuid REFERENCES prop_ops.work_orders(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('RESIDENT_PHOTO','BEFORE','AFTER','NOTE')),
  caption text NOT NULL,
  object_key text,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES prop_ops.users(id) ON DELETE RESTRICT,
  supersedes_id uuid REFERENCES prop_ops.evidence_artifacts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prop_ops.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  seq bigint NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES prop_ops.users(id) ON DELETE RESTRICT,
  actor_subject text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('resident','manager','worker','ops','ai','system')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  from_state text,
  to_state text,
  authority text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('OK','DENIED','DEDUPED','AMBIGUOUS')),
  note text,
  evidence_ids uuid[] NOT NULL DEFAULT '{}',
  prev_hash text NOT NULL,
  event_hash text NOT NULL CHECK (event_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id,seq),
  UNIQUE(org_id,event_hash)
);

CREATE TABLE IF NOT EXISTS prop_ops.external_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL REFERENCES prop_ops.cases(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING','CONFIRMED','UNKNOWN','NOT_FOUND','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  external_ref text,
  last_error text,
  next_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id,idempotency_key)
);

CREATE TABLE IF NOT EXISTS prop_ops.outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','DELIVERED','FAILED','AMBIGUOUS')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id,dedupe_key)
);

CREATE OR REPLACE FUNCTION prop_ops.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true),'')::uuid
$$;

CREATE OR REPLACE FUNCTION prop_ops.current_org_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.org_id', true),'')::uuid
$$;

CREATE OR REPLACE FUNCTION prop_ops.has_org_membership(target_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = prop_ops, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.org_id = target_org
      AND m.user_id = current_user_id()
      AND m.active
  )
$$;

CREATE OR REPLACE FUNCTION prop_ops.sha256_hex(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT encode(digest(input, 'sha256'),'hex')
$$;

ALTER TABLE prop_ops.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.evidence_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.external_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_tenant_select ON prop_ops.organizations FOR SELECT
USING (id = prop_ops.current_org_id() AND prop_ops.has_org_membership(id));

CREATE POLICY properties_tenant_all ON prop_ops.properties FOR ALL
USING (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id))
WITH CHECK (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id));

CREATE POLICY units_tenant_all ON prop_ops.units FOR ALL
USING (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id))
WITH CHECK (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id));

CREATE POLICY memberships_tenant_select ON prop_ops.memberships FOR SELECT
USING (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id));

CREATE POLICY cases_tenant_all ON prop_ops.cases FOR ALL
USING (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id))
WITH CHECK (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id));

CREATE POLICY work_orders_tenant_all ON prop_ops.work_orders FOR ALL
USING (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id))
WITH CHECK (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id));

CREATE POLICY evidence_tenant_all ON prop_ops.evidence_artifacts FOR ALL
USING (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id))
WITH CHECK (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id));

CREATE POLICY audit_tenant_all ON prop_ops.audit_events FOR ALL
USING (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id))
WITH CHECK (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id));

CREATE POLICY effects_tenant_all ON prop_ops.external_effects FOR ALL
USING (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id))
WITH CHECK (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id));

CREATE POLICY outbox_tenant_all ON prop_ops.outbox FOR ALL
USING (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id))
WITH CHECK (org_id = prop_ops.current_org_id() AND prop_ops.has_org_membership(org_id));

CREATE INDEX IF NOT EXISTS idx_properties_org ON prop_ops.properties(org_id);
CREATE INDEX IF NOT EXISTS idx_units_org_property ON prop_ops.units(org_id,property_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_org ON prop_ops.memberships(user_id,org_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_cases_org_property_status ON prop_ops.cases(org_id,property_id,status);
CREATE INDEX IF NOT EXISTS idx_work_orders_org_case_status ON prop_ops.work_orders(org_id,case_id,status);
CREATE INDEX IF NOT EXISTS idx_evidence_org_case ON prop_ops.evidence_artifacts(org_id,case_id,created_at);
CREATE INDEX IF NOT EXISTS idx_audit_org_seq ON prop_ops.audit_events(org_id,seq);
CREATE INDEX IF NOT EXISTS idx_effects_org_status ON prop_ops.external_effects(org_id,status,next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_outbox_claim ON prop_ops.outbox(status,available_at,created_at)
WHERE status IN ('PENDING','FAILED');
