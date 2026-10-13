-- PROP-OPS-AUTHZ-HARDEN-001 supplemental hardening.

CREATE OR REPLACE FUNCTION prop_ops.worker_assigned_case(target_case uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = prop_ops, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM work_orders wo
    WHERE wo.case_id = target_case
      AND wo.assignee_user_id = prop_ops.current_user_id()
      AND wo.org_id = prop_ops.current_org_id()
  )
$$;

CREATE OR REPLACE FUNCTION prop_ops.can_access_case(target_case uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = prop_ops, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM cases c
    WHERE c.id = target_case
      AND c.org_id = prop_ops.current_org_id()
      AND prop_ops.can_access_property(c.property_id)
      AND (
        prop_ops.has_role('ops')
        OR (prop_ops.has_role('manager') AND c.property_id = ANY(prop_ops.current_property_ids()))
        OR (prop_ops.has_role('resident') AND c.resident_user_id = prop_ops.current_user_id() AND c.unit_id = ANY(prop_ops.current_unit_ids()))
        OR (prop_ops.has_role('worker') AND prop_ops.worker_assigned_case(c.id))
      )
  )
$$;

CREATE OR REPLACE FUNCTION prop_ops.can_access_case_public(target_public_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = prop_ops, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM cases c
    WHERE c.public_id = target_public_id
      AND prop_ops.can_access_case(c.id)
  )
$$;

CREATE POLICY cases_actor_scope_restrictive
ON prop_ops.cases
AS RESTRICTIVE
FOR ALL
USING (prop_ops.can_access_case(id))
WITH CHECK (prop_ops.can_access_case(id));

CREATE POLICY evidence_actor_scope_restrictive
ON prop_ops.evidence_artifacts
AS RESTRICTIVE
FOR ALL
USING (prop_ops.can_access_case(case_id))
WITH CHECK (prop_ops.can_access_case(case_id));

CREATE POLICY aggregate_actor_scope_restrictive
ON prop_ops.case_aggregate_state
AS RESTRICTIVE
FOR ALL
USING (prop_ops.can_access_case_public(case_public_id))
WITH CHECK (prop_ops.can_access_case_public(case_public_id));

CREATE POLICY memberships_actor_scope_restrictive
ON prop_ops.memberships
AS RESTRICTIVE
FOR SELECT
USING (
  user_id = prop_ops.current_user_id()
  OR prop_ops.has_role('ops')
  OR (
    prop_ops.has_role('manager')
    AND property_id = ANY(prop_ops.current_property_ids())
  )
);

CREATE OR REPLACE FUNCTION prop_ops.enqueue_domain_outbox(
  p_org_id uuid,
  p_aggregate_id uuid,
  p_event_type text,
  p_payload jsonb,
  p_dedupe_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = prop_ops, pg_temp
AS $$
DECLARE
  outbox_id uuid;
BEGIN
  IF p_org_id <> prop_ops.current_org_id() OR NOT prop_ops.has_org_membership(p_org_id) THEN
    RAISE EXCEPTION 'outbox organization authority denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO outbox (
    org_id, aggregate_type, aggregate_id, event_type, payload, dedupe_key
  ) VALUES (
    p_org_id, 'CASE', p_aggregate_id, p_event_type, p_payload, p_dedupe_key
  )
  ON CONFLICT (org_id, dedupe_key) DO UPDATE
     SET dedupe_key = EXCLUDED.dedupe_key
  RETURNING id INTO outbox_id;

  RETURN outbox_id;
END;
$$;

REVOKE ALL ON FUNCTION prop_ops.enqueue_domain_outbox(uuid, uuid, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prop_ops.enqueue_domain_outbox(uuid, uuid, text, jsonb, text) TO prop_ops_app;
