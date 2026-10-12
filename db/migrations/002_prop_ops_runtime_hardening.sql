-- PROP-OPS-DATA-AUTH-001 runtime hardening
-- Apply after 001_prop_ops_data_auth.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prop_ops_app') THEN
    CREATE ROLE prop_ops_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA prop_ops TO prop_ops_app;
GRANT SELECT, INSERT, UPDATE ON
  prop_ops.organizations,
  prop_ops.properties,
  prop_ops.units,
  prop_ops.memberships,
  prop_ops.cases,
  prop_ops.work_orders,
  prop_ops.evidence_artifacts,
  prop_ops.audit_events,
  prop_ops.external_effects,
  prop_ops.outbox
TO prop_ops_app;

GRANT EXECUTE ON FUNCTION prop_ops.current_user_id() TO prop_ops_app;
GRANT EXECUTE ON FUNCTION prop_ops.current_org_id() TO prop_ops_app;
GRANT EXECUTE ON FUNCTION prop_ops.has_org_membership(uuid) TO prop_ops_app;
GRANT EXECUTE ON FUNCTION prop_ops.sha256_hex(text) TO prop_ops_app;

CREATE OR REPLACE FUNCTION prop_ops.resolve_identity(
  p_auth_subject text,
  p_org_id uuid DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  org_id uuid,
  roles text[],
  property_ids uuid[],
  unit_ids uuid[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = prop_ops, pg_temp
AS $$
  SELECT
    u.id,
    m.org_id,
    array_agg(DISTINCT m.role ORDER BY m.role),
    array_remove(array_agg(DISTINCT m.property_id), NULL),
    array_remove(array_agg(DISTINCT m.unit_id), NULL)
  FROM users u
  JOIN memberships m ON m.user_id = u.id AND m.active
  WHERE u.auth_subject = p_auth_subject
    AND (p_org_id IS NULL OR m.org_id = p_org_id)
  GROUP BY u.id, m.org_id
$$;

REVOKE ALL ON FUNCTION prop_ops.resolve_identity(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prop_ops.resolve_identity(text, uuid) TO prop_ops_app;

ALTER TABLE prop_ops.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.properties FORCE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.units FORCE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.cases FORCE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.work_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.evidence_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.external_effects FORCE ROW LEVEL SECURITY;
ALTER TABLE prop_ops.outbox FORCE ROW LEVEL SECURITY;

-- The login-bearing role is created outside this migration by the database platform.
-- Grant prop_ops_app to that runtime role after creation, e.g.:
--   GRANT prop_ops_app TO prop_ops_runtime;
-- Runtime credentials MUST NOT be exposed to browser code.
