-- PROP-OPS-AUTHZ-HARDEN-001
-- Resource-aware authorization hardening layered on top of existing org-scoped RLS.

CREATE OR REPLACE FUNCTION prop_ops.current_roles()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    string_to_array(nullif(current_setting('app.roles', true), ''), ','),
    ARRAY[]::text[]
  )
$$;

CREATE OR REPLACE FUNCTION prop_ops.current_property_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN nullif(current_setting('app.property_ids', true), '') IS NULL THEN ARRAY[]::uuid[]
    ELSE string_to_array(current_setting('app.property_ids', true), ',')::uuid[]
  END
$$;

CREATE OR REPLACE FUNCTION prop_ops.current_unit_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN nullif(current_setting('app.unit_ids', true), '') IS NULL THEN ARRAY[]::uuid[]
    ELSE string_to_array(current_setting('app.unit_ids', true), ',')::uuid[]
  END
$$;

CREATE OR REPLACE FUNCTION prop_ops.has_role(target_role text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT target_role = ANY(prop_ops.current_roles())
$$;

CREATE OR REPLACE FUNCTION prop_ops.can_access_property(target_property uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT prop_ops.has_role('ops')
      OR prop_ops.has_role('manager')
         AND target_property = ANY(prop_ops.current_property_ids())
      OR prop_ops.has_role('worker')
         AND target_property = ANY(prop_ops.current_property_ids())
      OR prop_ops.has_role('resident')
         AND target_property = ANY(prop_ops.current_property_ids())
$$;

CREATE OR REPLACE FUNCTION prop_ops.can_access_unit(target_unit uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT prop_ops.has_role('ops')
      OR prop_ops.has_role('manager')
      OR prop_ops.has_role('worker')
      OR prop_ops.has_role('resident')
         AND target_unit = ANY(prop_ops.current_unit_ids())
$$;

-- Add RESTRICTIVE policies so existing permissive tenant policies remain necessary but are no longer sufficient.
CREATE POLICY properties_scope_restrictive
ON prop_ops.properties
AS RESTRICTIVE
FOR ALL
USING (prop_ops.can_access_property(id))
WITH CHECK (prop_ops.can_access_property(id));

CREATE POLICY units_scope_restrictive
ON prop_ops.units
AS RESTRICTIVE
FOR ALL
USING (
  prop_ops.can_access_property(property_id)
  AND (
    NOT prop_ops.has_role('resident')
    OR prop_ops.can_access_unit(id)
  )
)
WITH CHECK (
  prop_ops.can_access_property(property_id)
  AND (
    NOT prop_ops.has_role('resident')
    OR prop_ops.can_access_unit(id)
  )
);

CREATE POLICY cases_scope_restrictive
ON prop_ops.cases
AS RESTRICTIVE
FOR ALL
USING (
  prop_ops.can_access_property(property_id)
  AND (
    NOT prop_ops.has_role('resident')
    OR unit_id = ANY(prop_ops.current_unit_ids())
  )
)
WITH CHECK (
  prop_ops.can_access_property(property_id)
  AND (
    NOT prop_ops.has_role('resident')
    OR unit_id = ANY(prop_ops.current_unit_ids())
  )
);

CREATE POLICY work_orders_scope_restrictive
ON prop_ops.work_orders
AS RESTRICTIVE
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM prop_ops.cases c
    WHERE c.id = work_orders.case_id
      AND c.org_id = work_orders.org_id
      AND prop_ops.can_access_property(c.property_id)
      AND (
        NOT prop_ops.has_role('resident')
        OR c.unit_id = ANY(prop_ops.current_unit_ids())
      )
      AND (
        NOT prop_ops.has_role('worker')
        OR work_orders.assignee_user_id = prop_ops.current_user_id()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM prop_ops.cases c
    WHERE c.id = work_orders.case_id
      AND c.org_id = work_orders.org_id
      AND prop_ops.can_access_property(c.property_id)
      AND (
        NOT prop_ops.has_role('resident')
        OR c.unit_id = ANY(prop_ops.current_unit_ids())
      )
      AND (
        NOT prop_ops.has_role('worker')
        OR work_orders.assignee_user_id = prop_ops.current_user_id()
      )
  )
);

CREATE POLICY evidence_scope_restrictive
ON prop_ops.evidence_artifacts
AS RESTRICTIVE
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM prop_ops.cases c
    WHERE c.id = evidence_artifacts.case_id
      AND c.org_id = evidence_artifacts.org_id
      AND prop_ops.can_access_property(c.property_id)
      AND (
        NOT prop_ops.has_role('resident')
        OR c.unit_id = ANY(prop_ops.current_unit_ids())
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM prop_ops.cases c
    WHERE c.id = evidence_artifacts.case_id
      AND c.org_id = evidence_artifacts.org_id
      AND prop_ops.can_access_property(c.property_id)
      AND (
        NOT prop_ops.has_role('resident')
        OR c.unit_id = ANY(prop_ops.current_unit_ids())
      )
  )
);

CREATE POLICY audit_scope_restrictive
ON prop_ops.audit_events
AS RESTRICTIVE
FOR SELECT
USING (
  prop_ops.has_role('ops')
  OR prop_ops.has_role('manager')
);

CREATE POLICY outbox_scope_restrictive
ON prop_ops.outbox
AS RESTRICTIVE
FOR ALL
USING (prop_ops.has_role('ops'))
WITH CHECK (prop_ops.has_role('ops'));

CREATE POLICY effects_scope_restrictive
ON prop_ops.external_effects
AS RESTRICTIVE
FOR ALL
USING (
  prop_ops.has_role('ops')
  OR prop_ops.has_role('manager')
)
WITH CHECK (
  prop_ops.has_role('ops')
  OR prop_ops.has_role('manager')
);
