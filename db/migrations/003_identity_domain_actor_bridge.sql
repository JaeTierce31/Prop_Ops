-- PROP-OPS-DATA-AUTH-001 identity/domain bridge
-- Preserves existing governed kernel actor identifiers while replacing synthetic
-- client identity selection with authenticated server-resolved identities.

ALTER TABLE prop_ops.users
  ADD COLUMN IF NOT EXISTS domain_actor_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_domain_actor_id
  ON prop_ops.users(domain_actor_id)
  WHERE domain_actor_id IS NOT NULL;

-- Runtime identity resolution v2. We keep the original function intact so this
-- migration remains additive and safe on already-provisioned test branches.
CREATE OR REPLACE FUNCTION prop_ops.resolve_identity_v2(
  p_auth_subject text,
  p_org_id uuid DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  domain_actor_id text,
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
    u.domain_actor_id,
    m.org_id,
    array_agg(DISTINCT m.role ORDER BY m.role),
    array_remove(array_agg(DISTINCT m.property_id), NULL),
    array_remove(array_agg(DISTINCT m.unit_id), NULL)
  FROM users u
  JOIN memberships m ON m.user_id = u.id AND m.active
  WHERE u.auth_subject = p_auth_subject
    AND u.disabled_at IS NULL
    AND (p_org_id IS NULL OR m.org_id = p_org_id)
  GROUP BY u.id, u.domain_actor_id, m.org_id
$$;

REVOKE ALL ON FUNCTION prop_ops.resolve_identity_v2(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prop_ops.resolve_identity_v2(text, uuid) TO prop_ops_app;

-- Seed bindings are environment data and SHOULD be executed only in a synthetic
-- pilot/demo seed migration, never as production customer identity defaults.
