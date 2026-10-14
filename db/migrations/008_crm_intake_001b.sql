-- J3S-CRM-INTAKE-001B
-- Executable intake-domain database contract.
-- `tenant_id` maps to the existing canonical prop_ops.organizations tenant authority.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION prop_ops.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN nullif(current_setting('app.tenant_id', true), '') IS NULL
      THEN prop_ops.current_org_id()
    WHEN nullif(current_setting('app.org_id', true), '') IS NULL
      THEN NULL
    WHEN current_setting('app.tenant_id', true)::uuid = prop_ops.current_org_id()
      THEN prop_ops.current_org_id()
    ELSE NULL
  END
$$;

CREATE TABLE crm_intake_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  namespace text NOT NULL,
  name text NOT NULL,
  description text,
  intake_type text NOT NULL,
  audience jsonb NOT NULL DEFAULT '[]'::jsonb,
  lifecycle_state text NOT NULL CHECK (lifecycle_state IN ('DRAFT','REVIEW','ACTIVE','SUSPENDED','RETIRED')),
  current_version_id uuid,
  created_by jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, namespace)
);

CREATE TABLE crm_qualification_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  namespace text NOT NULL,
  version text NOT NULL,
  policy_document jsonb NOT NULL,
  policy_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, namespace, version),
  UNIQUE (tenant_id, namespace, policy_hash)
);

CREATE TABLE crm_routing_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  namespace text NOT NULL,
  version text NOT NULL,
  policy_document jsonb NOT NULL,
  policy_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, namespace, version),
  UNIQUE (tenant_id, namespace, policy_hash)
);

CREATE TABLE crm_retention_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  namespace text NOT NULL,
  version text NOT NULL,
  policy_document jsonb NOT NULL,
  policy_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, namespace, version)
);

CREATE TABLE crm_identity_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  namespace text NOT NULL,
  version text NOT NULL,
  policy_document jsonb NOT NULL,
  policy_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, namespace, version)
);

CREATE TABLE crm_duplicate_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  namespace text NOT NULL,
  version text NOT NULL,
  policy_document jsonb NOT NULL,
  policy_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, namespace, version)
);

CREATE TABLE crm_intake_definition_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  intake_definition_id uuid NOT NULL REFERENCES crm_intake_definitions(id) ON DELETE RESTRICT,
  version text NOT NULL,
  schema_document jsonb NOT NULL,
  schema_hash text NOT NULL,
  qualification_policy_version_id uuid REFERENCES crm_qualification_policy_versions(id) ON DELETE RESTRICT,
  routing_policy_version_id uuid REFERENCES crm_routing_policy_versions(id) ON DELETE RESTRICT,
  identity_policy_version_id uuid NOT NULL REFERENCES crm_identity_policy_versions(id) ON DELETE RESTRICT,
  duplicate_policy_version_id uuid NOT NULL REFERENCES crm_duplicate_policy_versions(id) ON DELETE RESTRICT,
  retention_policy_version_id uuid NOT NULL REFERENCES crm_retention_policy_versions(id) ON DELETE RESTRICT,
  published_at timestamptz,
  published_by jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, intake_definition_id, version),
  UNIQUE (tenant_id, intake_definition_id, schema_hash)
);

ALTER TABLE crm_intake_definitions
  ADD CONSTRAINT crm_intake_definitions_current_version_fk
  FOREIGN KEY (current_version_id)
  REFERENCES crm_intake_definition_versions(id)
  ON DELETE RESTRICT;

CREATE TABLE crm_intake_provisional_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  normalized_email citext,
  normalized_phone text,
  normalized_name text,
  organization_name text,
  organization_domain citext,
  created_from_submission_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crm_intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  definition_id uuid NOT NULL REFERENCES crm_intake_definitions(id) ON DELETE RESTRICT,
  definition_version_id uuid NOT NULL REFERENCES crm_intake_definition_versions(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('CREATED','IN_PROGRESS','VALIDATING','IDENTITY_RESOLUTION','QUALIFYING','ROUTING','SUBMITTED','PROCESSED','ABANDONED','REJECTED','EXPIRED','CANCELLED','PROCESSING_FAILED')),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  respondent_identity_id uuid,
  provisional_identity_id uuid REFERENCES crm_intake_provisional_identities(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('WEB','MOBILE','OPERATOR','API','IMPORT','CONVERSATIONAL')),
  idempotency_key text NOT NULL,
  current_node_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  submission_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

ALTER TABLE crm_intake_provisional_identities
  ADD CONSTRAINT crm_intake_provisional_identity_submission_fk
  FOREIGN KEY (created_from_submission_id)
  REFERENCES crm_intake_submissions(id)
  ON DELETE SET NULL;

CREATE TABLE crm_intake_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES crm_intake_submissions(id) ON DELETE CASCADE,
  definition_version_id uuid NOT NULL REFERENCES crm_intake_definition_versions(id) ON DELETE RESTRICT,
  actor_ref jsonb NOT NULL,
  channel text NOT NULL,
  state text NOT NULL CHECK (state IN ('ACTIVE','PAUSED','COMPLETED','EXPIRED','CANCELLED')),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crm_intake_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES crm_intake_submissions(id) ON DELETE CASCADE,
  session_id uuid REFERENCES crm_intake_sessions(id) ON DELETE SET NULL,
  field_key text NOT NULL,
  raw_value jsonb,
  normalized_value jsonb,
  epistemic_state text NOT NULL CHECK (epistemic_state IN ('KNOWN','ASSERTED','INFERRED','CONFLICTING','UNKNOWN','NOT_APPLICABLE')),
  confidence numeric(5,4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  confirmed_by_human boolean NOT NULL DEFAULT false,
  supersedes_answer_id uuid REFERENCES crm_intake_answers(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, submission_id, idempotency_key)
);

CREATE TABLE crm_intake_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES crm_intake_submissions(id) ON DELETE CASCADE,
  evidence_type text NOT NULL CHECK (evidence_type IN ('USER_ASSERTION','DOCUMENT','SCREENSHOT','FILE','SYSTEM_OBSERVATION','OPERATOR_ASSERTION','EXTERNAL_SOURCE','AI_EXTRACTION')),
  subject_ref jsonb,
  source_ref text,
  content_hash text,
  storage_ref text,
  confidence numeric(5,4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  captured_by jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  supersedes uuid REFERENCES crm_intake_evidence(id) ON DELETE RESTRICT,
  retention_policy_version_id uuid NOT NULL REFERENCES crm_retention_policy_versions(id) ON DELETE RESTRICT,
  deleted_at timestamptz,
  deletion_reason text
);

CREATE TABLE crm_intake_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  answer_id uuid REFERENCES crm_intake_answers(id) ON DELETE CASCADE,
  evidence_id uuid REFERENCES crm_intake_evidence(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('RESPONDENT','OPERATOR','SYSTEM','AI','EXTERNAL')),
  source_ref text,
  actor_ref jsonb,
  transformation_type text NOT NULL CHECK (transformation_type IN ('ORIGINAL','NORMALIZED','EXTRACTED','TRANSLATED','CORRECTED','MERGED')),
  parent_provenance_ids uuid[] NOT NULL DEFAULT '{}',
  confidence numeric(5,4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  policy_version text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  CHECK (answer_id IS NOT NULL OR evidence_id IS NOT NULL),
  CHECK (transformation_type = 'ORIGINAL' OR cardinality(parent_provenance_ids) > 0)
);

CREATE TABLE crm_intake_subject_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES crm_intake_submissions(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('PERSON','ORGANIZATION','PROPERTY','WORKFLOW','CASE','OTHER')),
  subject_id uuid,
  provisional_id uuid,
  relationship text NOT NULL,
  CHECK (subject_id IS NOT NULL OR provisional_id IS NOT NULL)
);

CREATE TABLE crm_intake_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES crm_intake_submissions(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  policy_version text NOT NULL,
  language_hash text NOT NULL,
  locale text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('GRANTED','DENIED','WITHDRAWN')),
  actor_ref jsonb NOT NULL,
  idempotency_key text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, submission_id, idempotency_key)
);

CREATE TABLE crm_intake_contradictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES crm_intake_submissions(id) ON DELETE CASCADE,
  field_keys text[] NOT NULL,
  evidence_refs uuid[] NOT NULL DEFAULT '{}',
  contradiction_type text NOT NULL CHECK (contradiction_type IN ('VALUE_CONFLICT','SEMANTIC_CONFLICT','TEMPORAL_CONFLICT','PLAUSIBILITY_WARNING')),
  severity text NOT NULL CHECK (severity IN ('INFO','REVIEW','BLOCKING')),
  resolution_state text NOT NULL CHECK (resolution_state IN ('OPEN','CONFIRMED_VALID','CORRECTED','UNRESOLVED')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE crm_intake_identity_resolution_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES crm_intake_submissions(id) ON DELETE CASCADE,
  policy_version_id uuid NOT NULL REFERENCES crm_identity_policy_versions(id) ON DELETE RESTRICT,
  result text NOT NULL CHECK (result IN ('MATCHED','PROVISIONAL','AMBIGUOUS','NEW','FAILED')),
  duplicate_outcome text CHECK (duplicate_outcome IS NULL OR duplicate_outcome IN ('EXACT_MATCH','LIKELY_MATCH','MULTIPLE_CANDIDATES','NO_MATCH')),
  candidate_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_snapshot_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crm_intake_qualification_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES crm_intake_submissions(id) ON DELETE CASCADE,
  policy_version_id uuid NOT NULL REFERENCES crm_qualification_policy_versions(id) ON DELETE RESTRICT,
  input_snapshot_hash text NOT NULL,
  weighted_score numeric(6,3) CHECK (weighted_score IS NULL OR (weighted_score >= 0 AND weighted_score <= 100)),
  coverage numeric(5,4) NOT NULL CHECK (coverage >= 0 AND coverage <= 1),
  qualification_state text NOT NULL CHECK (qualification_state IN ('UNQUALIFIED','DISCOVERY','POTENTIAL','QUALIFIED','HIGH_PRIORITY','SALES_READY','DISQUALIFIED')),
  dimensions jsonb NOT NULL,
  evidence_refs uuid[] NOT NULL DEFAULT '{}',
  contradiction_refs uuid[] NOT NULL DEFAULT '{}',
  explanation jsonb NOT NULL,
  supersedes_result_id uuid REFERENCES crm_intake_qualification_results(id) ON DELETE RESTRICT,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crm_intake_routing_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES crm_intake_submissions(id) ON DELETE CASCADE,
  qualification_result_id uuid NOT NULL REFERENCES crm_intake_qualification_results(id) ON DELETE RESTRICT,
  policy_version_id uuid NOT NULL REFERENCES crm_routing_policy_versions(id) ON DELETE RESTRICT,
  routing_state text NOT NULL CHECK (routing_state IN ('NOT_CURRENT_FIT','NURTURE','DISCOVERY_REQUIRED','AUDIT_CANDIDATE','PILOT_CANDIDATE','HIGH_PRIORITY_PILOT_CANDIDATE','BLOCKED_MISSING_EVIDENCE')),
  matched_rule_id text NOT NULL,
  input_snapshot_hash text NOT NULL,
  explanation jsonb NOT NULL,
  supersedes_decision_id uuid REFERENCES crm_intake_routing_decisions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crm_intake_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES crm_intake_submissions(id) ON DELETE CASCADE,
  routing_decision_id uuid NOT NULL REFERENCES crm_intake_routing_decisions(id) ON DELETE RESTRICT,
  command_type text NOT NULL,
  command_version text NOT NULL,
  target_context text NOT NULL,
  payload jsonb NOT NULL,
  policy_version_id uuid NOT NULL REFERENCES crm_routing_policy_versions(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  requires_human_approval boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('PROPOSED','AUTHORIZED','REJECTED','DISPATCHED','ACCEPTED','FAILED_RETRYABLE','FAILED_FINAL','COMPLETED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, target_context, idempotency_key)
);

CREATE TABLE crm_intake_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES prop_ops.organizations(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  event_version integer NOT NULL CHECK (event_version > 0),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  actor_ref jsonb NOT NULL,
  correlation_id uuid NOT NULL,
  causation_id uuid,
  idempotency_key text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE OR REPLACE FUNCTION prevent_published_intake_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.published_at IS NOT NULL AND (
    NEW.schema_document IS DISTINCT FROM OLD.schema_document
    OR NEW.schema_hash IS DISTINCT FROM OLD.schema_hash
    OR NEW.qualification_policy_version_id IS DISTINCT FROM OLD.qualification_policy_version_id
    OR NEW.routing_policy_version_id IS DISTINCT FROM OLD.routing_policy_version_id
    OR NEW.identity_policy_version_id IS DISTINCT FROM OLD.identity_policy_version_id
    OR NEW.duplicate_policy_version_id IS DISTINCT FROM OLD.duplicate_policy_version_id
    OR NEW.retention_policy_version_id IS DISTINCT FROM OLD.retention_policy_version_id
  ) THEN
    RAISE EXCEPTION 'published intake definition versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_intake_definition_version_immutable
BEFORE UPDATE ON crm_intake_definition_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_published_intake_version_mutation();

CREATE OR REPLACE FUNCTION prevent_active_intake_policy_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'ACTIVE' AND (
    NEW.policy_document IS DISTINCT FROM OLD.policy_document
    OR NEW.policy_hash IS DISTINCT FROM OLD.policy_hash
    OR NEW.version IS DISTINCT FROM OLD.version
  ) THEN
    RAISE EXCEPTION 'active intake policy versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_qualification_policy_immutable
BEFORE UPDATE ON crm_qualification_policy_versions
FOR EACH ROW EXECUTE FUNCTION prevent_active_intake_policy_mutation();
CREATE TRIGGER crm_routing_policy_immutable
BEFORE UPDATE ON crm_routing_policy_versions
FOR EACH ROW EXECUTE FUNCTION prevent_active_intake_policy_mutation();
CREATE TRIGGER crm_retention_policy_immutable
BEFORE UPDATE ON crm_retention_policy_versions
FOR EACH ROW EXECUTE FUNCTION prevent_active_intake_policy_mutation();
CREATE TRIGGER crm_identity_policy_immutable
BEFORE UPDATE ON crm_identity_policy_versions
FOR EACH ROW EXECUTE FUNCTION prevent_active_intake_policy_mutation();
CREATE TRIGGER crm_duplicate_policy_immutable
BEFORE UPDATE ON crm_duplicate_policy_versions
FOR EACH ROW EXECUTE FUNCTION prevent_active_intake_policy_mutation();

CREATE INDEX idx_intake_submission_tenant_state ON crm_intake_submissions (tenant_id, state);
CREATE INDEX idx_intake_submission_definition ON crm_intake_submissions (tenant_id, definition_version_id);
CREATE INDEX idx_intake_answer_submission_field ON crm_intake_answers (tenant_id, submission_id, field_key, recorded_at DESC);
CREATE INDEX idx_evidence_submission ON crm_intake_evidence (tenant_id, submission_id);
CREATE INDEX idx_commands_submission ON crm_intake_commands (tenant_id, submission_id);
CREATE INDEX idx_outbox_unpublished ON crm_intake_outbox (occurred_at) WHERE published_at IS NULL;

ALTER TABLE crm_intake_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_definition_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_qualification_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_routing_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_retention_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_identity_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_duplicate_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_provisional_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_subject_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_contradictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_identity_resolution_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_qualification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_routing_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION prop_ops.crm_tenant_permitted(target_tenant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = prop_ops, public, pg_temp
AS $$
  SELECT target_tenant = prop_ops.current_tenant_id()
     AND prop_ops.has_org_membership(target_tenant)
$$;

CREATE POLICY crm_intake_definitions_tenant_all ON crm_intake_definitions FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_definition_versions_tenant_all ON crm_intake_definition_versions FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_qualification_policy_versions_tenant_all ON crm_qualification_policy_versions FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_routing_policy_versions_tenant_all ON crm_routing_policy_versions FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_retention_policy_versions_tenant_all ON crm_retention_policy_versions FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_identity_policy_versions_tenant_all ON crm_identity_policy_versions FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_duplicate_policy_versions_tenant_all ON crm_duplicate_policy_versions FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_provisional_identities_tenant_all ON crm_intake_provisional_identities FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_submissions_tenant_all ON crm_intake_submissions FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_sessions_tenant_all ON crm_intake_sessions FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_answers_tenant_all ON crm_intake_answers FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_evidence_tenant_all ON crm_intake_evidence FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_provenance_tenant_all ON crm_intake_provenance FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_subject_refs_tenant_all ON crm_intake_subject_refs FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_consent_events_tenant_all ON crm_intake_consent_events FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_contradictions_tenant_all ON crm_intake_contradictions FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_identity_resolution_runs_tenant_all ON crm_intake_identity_resolution_runs FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_qualification_results_tenant_all ON crm_intake_qualification_results FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_routing_decisions_tenant_all ON crm_intake_routing_decisions FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_commands_tenant_all ON crm_intake_commands FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));
CREATE POLICY crm_intake_outbox_tenant_all ON crm_intake_outbox FOR ALL USING (prop_ops.crm_tenant_permitted(tenant_id)) WITH CHECK (prop_ops.crm_tenant_permitted(tenant_id));

-- Outbox insertion MUST occur in the same database transaction as the state mutation that caused it.
-- The application must not acknowledge a state mutation unless its required outbox row committed atomically.
