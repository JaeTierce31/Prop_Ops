import { describe, expect, it } from "vitest";
import {
  PROP_OPS_QUAL_POLICY,
  qualifyPropOps,
} from "@/domain/intake/qualification";
import { routePropOps } from "@/domain/intake/routing";
import type { PropOpsDimensionScores } from "@/domain/intake/qualification";

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

describe("PROP-OPS-QUAL-001 v1", () => {
  it("pins the frozen weights to exactly 1.00", () => {
    const sum = Object.values(PROP_OPS_QUAL_POLICY.weights).reduce(
      (total, weight) => total + weight,
      0,
    );
    expect(sum).toBeCloseTo(1, 10);
    expect(PROP_OPS_QUAL_POLICY.weights.WORKFLOW_PAIN).toBe(0.16);
    expect(PROP_OPS_QUAL_POLICY.weights.ICP_FIT).toBe(0.14);
  });

  it("inverse-scores integration complexity", () => {
    const lowComplexity = qualifyPropOps({ dimensions: strong });
    const highComplexity = qualifyPropOps({
      dimensions: { ...strong, INTEGRATION_COMPLEXITY: 90 },
    });
    expect(lowComplexity.score).toBeGreaterThan(highComplexity.score);
  });

  it("renormalizes known non-critical weights instead of treating unknown as zero", () => {
    const result = qualifyPropOps({
      dimensions: { ...strong, ECONOMIC_IMPACT: undefined },
    });
    expect(result.score).toBeCloseTo(90, 6);
    expect(result.coverage).toBeLessThan(1);
    expect(result.coverage).toBeGreaterThan(0.8);
  });

  it.each([
    [34, "UNQUALIFIED"],
    [35, "DISCOVERY"],
    [49, "DISCOVERY"],
    [50, "POTENTIAL"],
    [64, "POTENTIAL"],
    [65, "QUALIFIED"],
    [79, "QUALIFIED"],
    [80, "HIGH_PRIORITY"],
  ] as const)("maps score %s to %s", (score, state) => {
    const result = qualifyPropOps({
      dimensions: Object.fromEntries(
        Object.keys(strong).map((key) => [
          key,
          key === "INTEGRATION_COMPLEXITY" ? 100 - score : score,
        ]),
      ) as PropOpsDimensionScores,
    });
    expect(result.state).toBe(state);
  });

  it("caps critical unknown ICP fit at DISCOVERY", () => {
    const result = qualifyPropOps({
      dimensions: { ...strong, ICP_FIT: undefined },
    });
    expect(result.state).toBe("DISCOVERY");
  });

  it("caps an unresolved blocking contradiction at POTENTIAL", () => {
    const result = qualifyPropOps({
      dimensions: strong,
      blockingContradiction: true,
    });
    expect(result.state).toBe("POTENTIAL");
  });

  it("does not produce SALES_READY from score alone", () => {
    const result = qualifyPropOps({
      dimensions: strong,
      economicBuyerKnown: false,
      timelineKnown: false,
    });
    expect(result.state).toBe("HIGH_PRIORITY");
  });

  it("produces SALES_READY only when all explicit guards are satisfied", () => {
    const result = qualifyPropOps({
      dimensions: strong,
      economicBuyerKnown: true,
      timelineKnown: true,
    });
    expect(result.state).toBe("SALES_READY");
  });
});

describe("PROP-OPS-ROUTE-001 v1", () => {
  it("blocks missing evidence before lower-precedence rules", () => {
    const qualification = qualifyPropOps({
      dimensions: { ...strong, BUYER_ACCESS: undefined },
    });
    expect(routePropOps({ qualification, dimensions: { ...strong, BUYER_ACCESS: undefined } })).toMatchObject({
      state: "BLOCKED_MISSING_EVIDENCE",
      ruleId: "R-001",
      commands: ["RequestEvidence", "CreateTask"],
    });
  });

  it("routes a clearly poor ICP fit to NOT_CURRENT_FIT without opportunity creation", () => {
    const dimensions = { ...strong, ICP_FIT: 20 };
    const qualification = qualifyPropOps({ dimensions });
    const routing = routePropOps({ qualification, dimensions });
    expect(routing.state).toBe("NOT_CURRENT_FIT");
    expect(routing.commands).not.toContain("CreateOpportunity");
  });

  it("routes medium discovery signal to DISCOVERY_REQUIRED", () => {
    const dimensions: PropOpsDimensionScores = {
      ...strong,
      ICP_FIT: 55,
      WORKFLOW_PAIN: 55,
      PAIN_FREQUENCY: 55,
      ECONOMIC_IMPACT: 55,
      WORKFLOW_FRAGMENTATION: 55,
      DATA_ACCESSIBILITY: 55,
      INTEGRATION_COMPLEXITY: 45,
      BUYER_ACCESS: 55,
      PILOT_SCOPE_CLARITY: 55,
      PILOT_REVERSIBILITY: 55,
      EVIDENCE_QUALITY: 55,
    };
    const qualification = qualifyPropOps({ dimensions });
    expect(routePropOps({ qualification, dimensions }).state).toBe(
      "DISCOVERY_REQUIRED",
    );
  });

  it("routes a bounded qualified workflow to PILOT_CANDIDATE", () => {
    const dimensions: PropOpsDimensionScores = {
      ...strong,
      BUYER_ACCESS: 60,
      PILOT_SCOPE_CLARITY: 70,
      PILOT_REVERSIBILITY: 70,
      EVIDENCE_QUALITY: 60,
    };
    const qualification = qualifyPropOps({ dimensions });
    const routing = routePropOps({ qualification, dimensions });
    expect(routing.state).toBe("PILOT_CANDIDATE");
    expect(routing.commands).toContain("CreateOpportunity");
    expect(routing.commands).toContain("CreatePilotCandidate");
  });

  it("gives HIGH_PRIORITY_PILOT_CANDIDATE precedence over ordinary pilot routing", () => {
    const qualification = qualifyPropOps({
      dimensions: strong,
      economicBuyerKnown: true,
      timelineKnown: true,
    });
    const routing = routePropOps({ qualification, dimensions: strong });
    expect(routing).toMatchObject({
      state: "HIGH_PRIORITY_PILOT_CANDIDATE",
      ruleId: "R-007",
    });
    expect(routing.commands).toContain("AssignOwner");
  });

  it("never treats a blocking contradiction as a pilot candidate", () => {
    const qualification = qualifyPropOps({
      dimensions: strong,
      blockingContradiction: true,
    });
    const routing = routePropOps({
      qualification,
      dimensions: strong,
      blockingContradiction: true,
    });
    expect(routing.state).not.toContain("PILOT_CANDIDATE");
  });
});
