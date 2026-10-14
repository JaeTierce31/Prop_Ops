import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("db/migrations/008_crm_intake_001b.sql");

function migration(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("J3S-CRM-INTAKE-001B schema contract", () => {
  it("INT-001 schema spine exists as migration 008", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("declares every canonical intake table", () => {
    const sql = migration();
    for (const table of [
      "crm_intake_definitions",
      "crm_intake_definition_versions",
      "crm_intake_submissions",
      "crm_intake_sessions",
      "crm_intake_provisional_identities",
      "crm_intake_answers",
      "crm_intake_provenance",
      "crm_intake_subject_refs",
      "crm_intake_evidence",
      "crm_intake_consent_events",
      "crm_intake_contradictions",
      "crm_intake_identity_resolution_runs",
      "crm_qualification_policy_versions",
      "crm_intake_qualification_results",
      "crm_routing_policy_versions",
      "crm_intake_routing_decisions",
      "crm_intake_commands",
      "crm_intake_outbox",
    ]) {
      expect(sql).toContain(`CREATE TABLE ${table}`);
    }
  });

  it("pins published-version immutability, tenant RLS, revision, idempotency, and outbox uniqueness", () => {
    const sql = migration();
    expect(sql).toContain("prevent_published_intake_version_mutation");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("current_setting('app.tenant_id', true)");
    expect(sql).toContain("revision bigint NOT NULL DEFAULT 0");
    expect(sql).toContain("idempotency_key text NOT NULL");
    expect(sql).toContain("UNIQUE (tenant_id, idempotency_key)");
    expect(sql).toContain("crm_intake_outbox");
  });
});
