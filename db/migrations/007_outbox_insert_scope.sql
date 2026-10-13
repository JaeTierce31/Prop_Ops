-- PROP-OPS-AUTHZ-HARDEN-001
-- Preserve ops-only visibility/update authority while allowing authenticated domain
-- transitions to enqueue a bounded CASE event in the same transaction.

ALTER POLICY outbox_scope_restrictive
ON prop_ops.outbox
USING (prop_ops.has_role('ops'))
WITH CHECK (
  org_id = prop_ops.current_org_id()
  AND prop_ops.has_org_membership(org_id)
  AND aggregate_type = 'CASE'
  AND event_type = 'DOMAIN_ACTION_COMMITTED'
  AND (
    prop_ops.has_role('resident')
    OR prop_ops.has_role('manager')
    OR prop_ops.has_role('worker')
    OR prop_ops.has_role('ops')
  )
  AND EXISTS (
    SELECT 1
    FROM prop_ops.cases c
    WHERE c.id = aggregate_id
      AND c.org_id = outbox.org_id
      AND prop_ops.can_access_case(c.id)
  )
);
