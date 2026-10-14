\set ON_ERROR_STOP on

-- J3S-CRM-INTAKE-001B runtime database verification.
-- Runs against a disposable PostgreSQL service after migrations 001-008.

INSERT INTO prop_ops.organizations (id, slug, name) VALUES
  ('10000000-0000-0000-0000-000000000001', 'intake-a', 'Intake Test A'),
  ('10000000-0000-0000-0000-000000000002', 'intake-b', 'Intake Test B');

INSERT INTO prop_ops.users (id, auth_subject, display_name) VALUES
  ('20000000-0000-0000-0000-000000000001', 'intake-user-a', 'Intake User A');

INSERT INTO prop_ops.memberships (id, org_id, user_id, role, active) VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'ops',
    true
  );

INSERT INTO crm_qualification_policy_versions (
  id, tenant_id, namespace, version, policy_document, policy_hash, status, activated_at
) VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'runtime-qual-a', '1.0.0', '{}'::jsonb, 'qual-a', 'ACTIVE', now()
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'runtime-qual-b', '1.0.0', '{}'::jsonb, 'qual-b', 'ACTIVE', now()
  );

INSERT INTO crm_routing_policy_versions (
  id, tenant_id, namespace, version, policy_document, policy_hash, status, activated_at
) VALUES
  (
    '41000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'runtime-route-a', '1.0.0', '{}'::jsonb, 'route-a', 'ACTIVE', now()
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'runtime-route-b', '1.0.0', '{}'::jsonb, 'route-b', 'ACTIVE', now()
  );

INSERT INTO crm_retention_policy_versions (
  id, tenant_id, namespace, version, policy_document, policy_hash, status, activated_at
) VALUES
  (
    '42000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'runtime-retention-a', '1.0.0', '{}'::jsonb, 'retention-a', 'ACTIVE', now()
  ),
  (
    '42000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'runtime-retention-b', '1.0.0', '{}'::jsonb, 'retention-b', 'ACTIVE', now()
  );

INSERT INTO crm_identity_policy_versions (
  id, tenant_id, namespace, version, policy_document, policy_hash, status
) VALUES
  (
    '43000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'runtime-identity-a', '1.0.0', '{}'::jsonb, 'identity-a', 'ACTIVE'
  ),
  (
    '43000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'runtime-identity-b', '1.0.0', '{}'::jsonb, 'identity-b', 'ACTIVE'
  );

INSERT INTO crm_duplicate_policy_versions (
  id, tenant_id, namespace, version, policy_document, policy_hash, status
) VALUES
  (
    '44000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'runtime-duplicate-a', '1.0.0', '{}'::jsonb, 'duplicate-a', 'ACTIVE'
  ),
  (
    '44000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'runtime-duplicate-b', '1.0.0', '{}'::jsonb, 'duplicate-b', 'ACTIVE'
  );

INSERT INTO crm_intake_definitions (
  id, tenant_id, namespace, name, intake_type, lifecycle_state, created_by
) VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'runtime-intake-a', 'Runtime Intake A', 'PROSPECT', 'ACTIVE', '{"actorType":"SYSTEM"}'::jsonb
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'runtime-intake-b', 'Runtime Intake B', 'PROSPECT', 'ACTIVE', '{"actorType":"SYSTEM"}'::jsonb
  );

INSERT INTO crm_intake_definition_versions (
  id,
  tenant_id,
  intake_definition_id,
  version,
  schema_document,
  schema_hash,
  qualification_policy_version_id,
  routing_policy_version_id,
  identity_policy_version_id,
  duplicate_policy_version_id,
  retention_policy_version_id,
  published_at,
  published_by
) VALUES
  (
    '51000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    '1.0.0',
    '{"fields":[]}'::jsonb,
    'schema-a',
    '40000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    '43000000-0000-0000-0000-000000000001',
    '44000000-0000-0000-0000-000000000001',
    '42000000-0000-0000-0000-000000000001',
    now(),
    '{"actorType":"SYSTEM"}'::jsonb
  ),
  (
    '51000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000002',
    '1.0.0',
    '{"fields":[]}'::jsonb,
    'schema-b',
    '40000000-0000-0000-0000-000000000002',
    '41000000-0000-0000-0000-000000000002',
    '43000000-0000-0000-0000-000000000002',
    '44000000-0000-0000-0000-000000000002',
    '42000000-0000-0000-0000-000000000002',
    now(),
    '{"actorType":"SYSTEM"}'::jsonb
  );

-- Published definition versions must be immutable.
DO $$
BEGIN
  BEGIN
    UPDATE crm_intake_definition_versions
    SET schema_document = '{"fields":[{"key":"mutated"}]}'::jsonb
    WHERE id = '51000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'published definition mutation unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'published definition mutation unexpectedly succeeded' THEN
        RAISE;
      END IF;
  END;
END
$$;

-- Active policy versions must be immutable.
DO $$
BEGIN
  BEGIN
    UPDATE crm_qualification_policy_versions
    SET policy_document = '{"mutated":true}'::jsonb
    WHERE id = '40000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'active policy mutation unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'active policy mutation unexpectedly succeeded' THEN
        RAISE;
      END IF;
  END;
END
$$;

-- Runtime role must be able to reach only its authorized tenant through RLS.
SET ROLE prop_ops_app;
SELECT set_config('app.user_id', '20000000-0000-0000-0000-000000000001', false);
SELECT set_config('app.org_id', '10000000-0000-0000-0000-000000000001', false);
SELECT set_config('app.tenant_id', '10000000-0000-0000-0000-000000000001', false);

DO $$
DECLARE
  visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM crm_intake_definitions;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'authorized tenant expected 1 visible intake definition, got %', visible_count;
  END IF;
END
$$;

-- Forged tenant payload/scope disagreement must fail closed.
SELECT set_config('app.tenant_id', '10000000-0000-0000-0000-000000000002', false);
DO $$
DECLARE
  visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM crm_intake_definitions;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'forged tenant scope exposed % rows', visible_count;
  END IF;
END
$$;

-- Switching org without membership must expose nothing.
SELECT set_config('app.org_id', '10000000-0000-0000-0000-000000000002', false);
SELECT set_config('app.tenant_id', '10000000-0000-0000-0000-000000000002', false);
DO $$
DECLARE
  visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM crm_intake_definitions;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'cross-tenant membership isolation exposed % rows', visible_count;
  END IF;
END
$$;
RESET ROLE;

-- Duplicate submission idempotency keys must be rejected.
INSERT INTO crm_intake_submissions (
  id, tenant_id, definition_id, definition_version_id, state, source, idempotency_key
) VALUES (
  '60000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  'CREATED', 'API', 'runtime-idempotency-key'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO crm_intake_submissions (
      id, tenant_id, definition_id, definition_version_id, state, source, idempotency_key
    ) VALUES (
      '60000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      'CREATED', 'API', 'runtime-idempotency-key'
    );
    RAISE EXCEPTION 'duplicate idempotency key unexpectedly succeeded';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;
END
$$;

-- State + outbox rollback must leave neither row committed.
BEGIN;
INSERT INTO crm_intake_submissions (
  id, tenant_id, definition_id, definition_version_id, state, source, idempotency_key
) VALUES (
  '60000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  'SUBMITTED', 'API', 'rollback-submission'
);
INSERT INTO crm_intake_outbox (
  id, tenant_id, event_type, event_version, aggregate_type, aggregate_id,
  payload, actor_ref, correlation_id, idempotency_key
) VALUES (
  '70000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'SubmissionSubmitted', 1, 'IntakeSubmission',
  '60000000-0000-0000-0000-000000000003',
  '{}'::jsonb, '{"actorType":"SYSTEM"}'::jsonb,
  '71000000-0000-0000-0000-000000000001', 'rollback-outbox'
);
ROLLBACK;

DO $$
DECLARE
  submission_count integer;
  outbox_count integer;
BEGIN
  SELECT count(*) INTO submission_count
  FROM crm_intake_submissions
  WHERE id = '60000000-0000-0000-0000-000000000003';

  SELECT count(*) INTO outbox_count
  FROM crm_intake_outbox
  WHERE id = '70000000-0000-0000-0000-000000000001';

  IF submission_count <> 0 OR outbox_count <> 0 THEN
    RAISE EXCEPTION 'atomic rollback failed: submission %, outbox %', submission_count, outbox_count;
  END IF;
END
$$;

SELECT 'J3S-CRM-INTAKE-001B runtime database checks PASS' AS result;
