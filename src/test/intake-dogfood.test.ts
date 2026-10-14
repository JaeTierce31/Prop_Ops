import { describe, expect, it } from "vitest";
import { WHITNEY_GROVE_DOGFOOD } from "./fixtures/intake/whitney-grove-dogfood";
import {
  evaluateInferenceAcceptance,
  resolveAcceptedValue,
} from "@/domain/intake/epistemics";
import { appendTransformation } from "@/domain/intake/provenance";
import { qualifyPropOps } from "@/domain/intake/qualification";
import { routePropOps } from "@/domain/intake/routing";
import type { PropOpsDimensionScores } from "@/domain/intake/qualification";

describe("Whitney Grove Property Ops intake dogfood", () => {
  it("keeps scenario inputs asserted rather than promoting them to verified facts", () => {
    expect(WHITNEY_GROVE_DOGFOOD.evidence).toHaveLength(5);
    for (const fact of WHITNEY_GROVE_DOGFOOD.evidence) {
      expect(fact.epistemicState).toBe("ASSERTED");
      expect(fact.sourceType).toBe("OPERATOR");
    }
    expect(WHITNEY_GROVE_DOGFOOD.modelNote).toContain(
      "not independently verified facts",
    );
  });

  it("preserves the raw pain statement when AI proposes a structured candidate", () => {
    const original = {
      id: "prov-original-pain",
      sourceType: "OPERATOR" as const,
      sourceRef: "whitney-grove-dogfood",
      capturedAt: "2026-10-14T00:00:00Z",
      transformationType: "ORIGINAL" as const,
      parentProvenanceIds: [],
    };

    const extracted = {
      id: "prov-ai-pain-category",
      sourceType: "AI" as const,
      sourceRef: "dogfood-extraction",
      capturedAt: "2026-10-14T00:00:01Z",
      transformationType: "EXTRACTED" as const,
      parentProvenanceIds: [original.id],
      confidence: 0.96,
      policyVersion: "J3S-CRM-INTAKE-001A@0.1.0",
    };

    const lineage = appendTransformation(
      appendTransformation([], original),
      extracted,
    );

    expect(lineage).toEqual([original, extracted]);
    expect(lineage[1]?.parentProvenanceIds).toEqual([original.id]);
  });

  it("does not let a high-confidence AI classification satisfy a critical pain field without confirmation", () => {
    const acceptance = evaluateInferenceAcceptance({
      qualificationCritical: true,
      confidence: 0.96,
      confirmedByHuman: false,
      blockingContradiction: false,
      allowAiAutoAccept: false,
    });

    expect(acceptance).toEqual({
      accepted: false,
      reason: "HUMAN_CONFIRMATION_REQUIRED",
    });

    const resolved = resolveAcceptedValue({
      rawAnswer:
        "Vendor payment delays involving multiple manual sign-offs and siloed workflows.",
      candidateValue: "WORKFLOW_FRAGMENTATION",
      acceptance,
    });

    expect(resolved.rawAnswer).toContain("multiple manual sign-offs");
    expect(resolved.candidateValue).toBe("WORKFLOW_FRAGMENTATION");
    expect(resolved).not.toHaveProperty("acceptedValue");
    expect(resolved.epistemicState).toBe("INFERRED");
  });

  it("surfaces the current evidence gaps as routing blockers", () => {
    expect(WHITNEY_GROVE_DOGFOOD.criticalUnknowns).toEqual([
      "buying.problem_owner",
      "buying.economic_buyer",
      "buying.target_timeline",
      "pilot.problem_definition",
      "pilot.success_condition",
    ]);

    const qualification = qualifyPropOps({
      dimensions: WHITNEY_GROVE_DOGFOOD.modeledDimensions,
      economicBuyerKnown: false,
      timelineKnown: false,
    });
    const routing = routePropOps({
      qualification,
      dimensions: WHITNEY_GROVE_DOGFOOD.modeledDimensions,
    });

    expect(qualification.coverage).toBeLessThan(1);
    expect(qualification.state).not.toBe("SALES_READY");
    expect(routing).toEqual({
      policy: "PROP-OPS-ROUTE-001@1.0.0",
      state: "BLOCKED_MISSING_EVIDENCE",
      ruleId: "R-001",
      commands: ["RequestEvidence", "CreateTask"],
    });
    expect(routing.commands).not.toContain("CreateOpportunity");
    expect(routing.commands).not.toContain("CreatePilotCandidate");
  });

  it("permits a counterfactual pilot route only after missing facts are explicitly supplied", () => {
    const counterfactualDimensions: PropOpsDimensionScores = {
      ...WHITNEY_GROVE_DOGFOOD.modeledDimensions,
      PAIN_FREQUENCY: 80,
      ECONOMIC_IMPACT: 70,
      BUYER_ACCESS: 75,
      PILOT_SCOPE_CLARITY: 80,
      EVIDENCE_QUALITY: 65,
    };

    const qualification = qualifyPropOps({
      dimensions: counterfactualDimensions,
      economicBuyerKnown: true,
      timelineKnown: true,
    });
    const routing = routePropOps({
      qualification,
      dimensions: counterfactualDimensions,
    });

    expect(routing.state).toMatch(/PILOT_CANDIDATE$/);
    expect(routing.commands).toContain("CreateOpportunity");
    expect(routing.commands).toContain("CreatePilotCandidate");
  });
});
