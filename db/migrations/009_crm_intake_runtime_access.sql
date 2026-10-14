-- J3S-CRM-INTAKE-001B runtime access hardening
-- Binds intake tables to the existing prop_ops_app execution role and hardened RLS posture.

GRANT SELECT, INSERT, UPDATE ON
  crm_qualification_policy_versions,
  crm_routing_policy_versions,
  crm_retention_policy_versions,
  crm_identity_policy_versions,
  crm_duplicate_policy_versions,
  crm_intake_definitions,
  crm_intake_definition_versions,
  crm_intake_submissions,
  crm_intake_sessions,
  crm_intake_provisional_identities,
  crm_intake_answers,
  crm_intake_evidence,
  crm_intake_provenance,
  crm_intake_subject_refs,
  crm_intake_consent_events,
  crm_intake_contradictions,
  crm_intake_identity_resolution_runs,
  crm_intake_qualification_results,
  crm_intake_routing_decisions,
  crm_intake_commands,
  crm_intake_outbox
TO prop_ops_app;

REVOKE ALL ON FUNCTION prop_ops.current_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION prop_ops.crm_tenant_permitted(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prop_ops.current_tenant_id() TO prop_ops_app;
GRANT EXECUTE ON FUNCTION prop_ops.crm_tenant_permitted(uuid) TO prop_ops_app;

ALTER TABLE crm_qualification_policy_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_routing_policy_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_retention_policy_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_identity_policy_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_duplicate_policy_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_definition_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_provisional_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_answers FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_provenance FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_subject_refs FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_consent_events FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_contradictions FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_identity_resolution_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_qualification_results FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_routing_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_commands FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_intake_outbox FORCE ROW LEVEL SECURITY;
