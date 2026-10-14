import { describe, expect, it } from "vitest";
import {
  evaluateInferenceAcceptance,
  resolveAcceptedValue,
} from "@/domain/intake/epistemics";
import { appendTransformation } from "@/domain/intake/provenance";

describe("J3S intake AI epistemic boundary", () => {
  it("rejects unconfirmed AI inference for qualification-critical fields", () => {
    expect(
      evaluateInferenceAcceptance({
        qualificationCritical: true,
        confidence: 0.99,
        confirmedByHuman: false,
        blockingContradiction: false,
        allowAiAutoAccept: false,
      }),
    ).toEqual({ accepted: false, reason: "HUMAN_CONFIRMATION_REQUIRED" });
  });

  it("accepts confirmed critical inference only without a blocking contradiction", () => {
    expect(
      evaluateInferenceAcceptance({
        qualificationCritical: true,
        confidence: 0.8,
        confirmedByHuman: true,
        blockingContradiction: false,
        allowAiAutoAccept: false,
      }),
    ).toEqual({ accepted: true, reason: "HUMAN_CONFIRMED" });
    expect(
      evaluateInferenceAcceptance({
        qualificationCritical: true,
        confidence: 1,
        confirmedByHuman: true,
        blockingContradiction: true,
        allowAiAutoAccept: false,
      }),
    ).toEqual({ accepted: false, reason: "BLOCKING_CONTRADICTION" });
  });

  it("keeps non-critical inference advisory by default", () => {
    expect(
      evaluateInferenceAcceptance({
        qualificationCritical: false,
        confidence: 1,
        confirmedByHuman: false,
        blockingContradiction: false,
        allowAiAutoAccept: false,
        autoAcceptThreshold: 0.9,
      }).accepted,
    ).toBe(false);
  });

  it("permits explicit non-critical auto-accept only at threshold", () => {
    expect(
      evaluateInferenceAcceptance({
        qualificationCritical: false,
        confidence: 0.95,
        confirmedByHuman: false,
        blockingContradiction: false,
        allowAiAutoAccept: true,
        autoAcceptThreshold: 0.9,
      }).accepted,
    ).toBe(true);
    expect(
      evaluateInferenceAcceptance({
        qualificationCritical: false,
        confidence: 0.89,
        confirmedByHuman: false,
        blockingContradiction: false,
        allowAiAutoAccept: true,
        autoAcceptThreshold: 0.9,
      }).accepted,
    ).toBe(false);
  });

  it("rejects confidence outside 0..1", () => {
    expect(() =>
      evaluateInferenceAcceptance({
        qualificationCritical: false,
        confidence: 1.1,
        confirmedByHuman: false,
        blockingContradiction: false,
        allowAiAutoAccept: true,
      }),
    ).toThrow(RangeError);
  });

  it("preserves the raw respondent answer while resolving a structured candidate", () => {
    const resolved = resolveAcceptedValue({
      rawAnswer: "We manage about 800 units.",
      candidateValue: 800,
      acceptance: { accepted: true, reason: "HUMAN_CONFIRMED" },
    });
    expect(resolved.rawAnswer).toBe("We manage about 800 units.");
    expect(resolved.acceptedValue).toBe(800);
    expect(resolved.epistemicState).toBe("KNOWN");
  });
});

describe("J3S intake provenance", () => {
  it("allows ORIGINAL provenance without parents", () => {
    expect(
      appendTransformation([], {
        id: "p-1",
        sourceType: "RESPONDENT",
        transformationType: "ORIGINAL",
        parentProvenanceIds: [],
        capturedAt: "2026-10-14T00:00:00Z",
      }),
    ).toHaveLength(1);
  });

  it("requires transformed provenance to reference an existing parent", () => {
    const original = {
      id: "p-1",
      sourceType: "RESPONDENT" as const,
      transformationType: "ORIGINAL" as const,
      parentProvenanceIds: [] as string[],
      capturedAt: "2026-10-14T00:00:00Z",
    };
    expect(
      appendTransformation([original], {
        id: "p-2",
        sourceType: "AI",
        transformationType: "EXTRACTED",
        parentProvenanceIds: ["p-1"],
        capturedAt: "2026-10-14T00:00:01Z",
        confidence: 0.95,
      }),
    ).toHaveLength(2);
    expect(() =>
      appendTransformation([original], {
        id: "p-3",
        sourceType: "AI",
        transformationType: "EXTRACTED",
        parentProvenanceIds: ["missing"],
        capturedAt: "2026-10-14T00:00:01Z",
      }),
    ).toThrow("missing provenance parent");
  });
});
