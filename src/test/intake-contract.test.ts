import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADV_FIXTURES } from "./fixtures/intake/adv-001-020";
import { INT_FIXTURES } from "./fixtures/intake/int-001-020";
import { evaluateInferenceAcceptance } from "@/domain/intake/epistemics";
import { qualifyPropOps } from "@/domain/intake/qualification";
import { routePropOps } from "@/domain/intake/routing";
import {
  isTerminalSubmissionState,
  transitionSubmission,
} from "@/domain/intake/state-machine";
import { isRequiredFieldSatisfied } from "@/domain/intake/validation";
import type { PropOpsDimensionScores } from "@/domain/intake/qualification";

const migration = readFileSync(
  resolve("db/migrations/008_crm_intake_001b.sql"),
  "utf8",
);

const strong: PropOpsDimensionScores = {
  ICP_FIT: 90,
  WORKFLOW_PAIN: 90,
  PAIN_FREQUENCY: 90,
  ECONOMIC_IMPACT: 90,
  WORKFLOW_FRAGMENTATION: 90,
  DATA_ACCESSIBILITY: 90,
  INTEGRATION_COMPLEXITY: 10,
  BUYER_ACCESS: 90,
  PILOT_SCOPE_CLARITY: 90,
  PILOT_REVERSIBILITY: 90,
  EVIDENCE_QUALITY: 90,
};

describe("J3S-CRM-INTAKE-001B 40-case fixture catalog", () => {
  it("contains exactly INT-001 through INT-020 and ADV-001 through ADV-020", () => {
    expect(INT_FIXTURES).toHaveLength(20);
    expect(ADV_FIXTURES).toHaveLength(20);

    expect(INT_FIXTURES.map((fixture) => fixture.id)).toEqual(
      Array.from(
        { length: 20 },
        (_, index) => `INT-${String(index + 1).padStart(3, "0")}`,
      ),
    );
    expect(ADV_FIXTURES.map((fixture) => fixture.id)).toEqual(
      Array.from(
        { length: 20 },
        (_, index) => `ADV-${String(index + 1).padStart(3, "0")}`,
      ),
    );
  });

  it("keeps every fixture explicit and non-empty", () => {
    const fixtures = [...INT_FIXTURES, ...ADV_FIXTURES];
    expect(new Set(fixtures.map((fixture) => fixture.id)).size).toBe(40);
    for (const fixture of fixtures) {
      expect(fixture.name.length).toBeGreaterThan(0);
      expect(fixture.invariant.length).toBeGreaterThan(0);
      expect(fixture.expected.length).toBeGreaterThan(0);
    }
  });
});

describe("contract-executable INT/ADV invariants", () => {
  it("INT-001/002/013/019 and ADV-014/019 are represented by immutable/versioned schema lineage", () => {
    expect(migration).toContain("prevent_published_intake_version_mutation");
    expect(migration).toContain("definition_version_id uuid NOT NULL");
    expect(migration).toContain("crm_intake_consent_events");
    expect(migration).toContain("retention_policy_version_id uuid NOT NULL");
    expect(migration).toContain("supersedes_result_id uuid");
    expect(migration).toContain("deleted_at timestamptz");
    expect(migration).toContain("deletion_reason text");
  });

  it("INT-003/015/016 and ADV-001/002/016 have tenant-scoped RLS primitives", () => {
    expect(migration).toContain("prop_ops.current_tenant_id()");
    expect(migration).toContain("prop_ops.crm_tenant_permitted(tenant_id)");
    expect(migration).toContain(
      "ALTER TABLE crm_intake_submissions ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "ALTER TABLE crm_intake_evidence ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "ALTER TABLE crm_intake_provisional_identities ENABLE ROW LEVEL SECURITY",
    );
  });

  it("INT-004 and ADV-018 preserve UNKNOWN rather than coercing it to zero", () => {
    expect(
      isRequiredFieldSatisfied({
        epistemicState: "UNKNOWN",
        qualificationCritical: true,
      }),
    ).toBe(false);

    const complete = qualifyPropOps({ dimensions: strong });
    const partial = qualifyPropOps({
      dimensions: { ...strong, ECONOMIC_IMPACT: undefined },
    });
    expect(partial.score).toBeCloseTo(complete.score, 6);
    expect(partial.coverage).toBeLessThan(complete.coverage);
  });

  it("INT-005/006/019 and ADV-010/012 preserve the AI authority boundary", () => {
    expect(
      evaluateInferenceAcceptance({
        qualificationCritical: true,
        confidence: 0.99,
        confirmedByHuman: false,
        blockingContradiction: false,
        allowAiAutoAccept: false,
      }),
    ).toEqual({ accepted: false, reason: "HUMAN_CONFIRMATION_REQUIRED" });

    expect(() =>
      evaluateInferenceAcceptance({
        qualificationCritical: false,
        confidence: 1.01,
        confirmedByHuman: false,
        blockingContradiction: false,
        allowAiAutoAccept: true,
      }),
    ).toThrow(RangeError);
  });

  it("INT-010/011 and ADV-011 enforce bounded deterministic qualification and routing", () => {
    expect(() =>
      qualifyPropOps({
        dimensions: { ...strong, ICP_FIT: 101 },
      }),
    ).toThrow(RangeError);

    const qualification = qualifyPropOps({
      dimensions: { ...strong, BUYER_ACCESS: undefined },
    });
    expect(qualification.state).toBe("QUALIFIED");

    const input = {
      qualification,
      dimensions: { ...strong, BUYER_ACCESS: undefined },
    };
    expect(routePropOps(input)).toEqual(routePropOps(input));
    expect(routePropOps(input).state).toBe("BLOCKED_MISSING_EVIDENCE");
  });

  it("INT-008/017/018 and ADV-007/009/015/020 expose idempotency, revision, and outbox constraints", () => {
    expect(migration).toContain("revision bigint NOT NULL DEFAULT 0");
    expect(migration).toContain("UNIQUE (tenant_id, idempotency_key)");
    expect(migration).toContain(
      "UNIQUE (tenant_id, target_context, idempotency_key)",
    );
    expect(migration).toContain("CREATE TABLE crm_intake_outbox");
    expect(migration).toContain(
      "Outbox insertion MUST occur in the same database transaction",
    );
  });

  it("ADV-008 rejects terminal-state transitions", () => {
    for (const state of [
      "PROCESSED",
      "ABANDONED",
      "REJECTED",
      "EXPIRED",
      "CANCELLED",
    ] as const) {
      expect(isTerminalSubmissionState(state)).toBe(true);
      expect(() => transitionSubmission(state, "StartSubmission")).toThrow(
        "INVALID_STATE_TRANSITION",
      );
    }
  });

  it("INT-012 keeps opportunity effects behind command proposals", () => {
    expect(migration).toContain("CREATE TABLE crm_intake_commands");
    expect(migration).toContain("routing_decision_id uuid NOT NULL");
    expect(migration).not.toContain("CREATE TABLE crm_opportunities");
  });
});
