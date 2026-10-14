import { describe, expect, it } from "vitest";
import {
  isTerminalSubmissionState,
  transitionSubmission,
} from "@/domain/intake/state-machine";
import { isRequiredFieldSatisfied } from "@/domain/intake/validation";

describe("J3S intake submission state machine", () => {
  it.each([
    ["CREATED", "StartSubmission", "IN_PROGRESS"],
    ["IN_PROGRESS", "RecordAnswer", "IN_PROGRESS"],
    ["IN_PROGRESS", "AttachEvidence", "IN_PROGRESS"],
    ["IN_PROGRESS", "RecordConsent", "IN_PROGRESS"],
    ["IN_PROGRESS", "BeginValidation", "VALIDATING"],
    ["VALIDATING", "ValidationPassed", "IDENTITY_RESOLUTION"],
    ["VALIDATING", "ValidationFailed", "IN_PROGRESS"],
    ["IN_PROGRESS", "AbandonSubmission", "ABANDONED"],
    ["IN_PROGRESS", "ExpireSubmission", "EXPIRED"],
    ["IN_PROGRESS", "CancelSubmission", "CANCELLED"],
    ["IDENTITY_RESOLUTION", "IdentityResolved", "QUALIFYING"],
    ["IDENTITY_RESOLUTION", "IdentityAmbiguous", "IN_PROGRESS"],
    ["IDENTITY_RESOLUTION", "IdentityResolutionFailed", "PROCESSING_FAILED"],
    ["QUALIFYING", "QualificationComputed", "ROUTING"],
    ["QUALIFYING", "QualificationFailed", "PROCESSING_FAILED"],
    ["ROUTING", "RoutingDecisionCreated", "SUBMITTED"],
    ["ROUTING", "RoutingFailed", "PROCESSING_FAILED"],
    ["SUBMITTED", "ProcessSubmission", "PROCESSED"],
    ["SUBMITTED", "ProcessingFailed", "PROCESSING_FAILED"],
    ["PROCESSING_FAILED", "RetryProcessing", "SUBMITTED"],
    ["PROCESSING_FAILED", "RejectSubmission", "REJECTED"],
  ] as const)("%s + %s -> %s", (from, event, expected) => {
    expect(transitionSubmission(from, event)).toEqual({ ok: true, state: expected });
  });

  it("rejects an unspecified transition", () => {
    expect(transitionSubmission("CREATED", "ProcessSubmission")).toEqual({
      ok: false,
      code: "INVALID_STATE_TRANSITION",
    });
  });

  it.each(["PROCESSED", "ABANDONED", "REJECTED", "EXPIRED", "CANCELLED"] as const)(
    "%s is terminal and rejects further mutation",
    (state) => {
      expect(isTerminalSubmissionState(state)).toBe(true);
      expect(transitionSubmission(state, "RecordAnswer")).toEqual({
        ok: false,
        code: "INVALID_STATE_TRANSITION",
      });
    },
  );
});

describe("J3S intake required-field oracle", () => {
  it("accepts KNOWN and ASSERTED answers", () => {
    expect(isRequiredFieldSatisfied({ required: true, epistemicState: "KNOWN" })).toBe(true);
    expect(isRequiredFieldSatisfied({ required: true, epistemicState: "ASSERTED" })).toBe(true);
  });

  it("rejects UNKNOWN, CONFLICTING, and unconfirmed critical INFERRED values", () => {
    expect(isRequiredFieldSatisfied({ required: true, epistemicState: "UNKNOWN" })).toBe(false);
    expect(isRequiredFieldSatisfied({ required: true, epistemicState: "CONFLICTING" })).toBe(false);
    expect(
      isRequiredFieldSatisfied({
        required: true,
        epistemicState: "INFERRED",
        qualificationCritical: true,
        confirmedByHuman: false,
      }),
    ).toBe(false);
  });

  it("allows NOT_APPLICABLE only when deterministic applicability is false", () => {
    expect(
      isRequiredFieldSatisfied({
        required: true,
        epistemicState: "NOT_APPLICABLE",
        applicabilityEstablishedFalse: true,
      }),
    ).toBe(true);
    expect(
      isRequiredFieldSatisfied({
        required: true,
        epistemicState: "NOT_APPLICABLE",
        applicabilityEstablishedFalse: false,
      }),
    ).toBe(false);
  });

  it("permits UNKNOWN only when completion policy explicitly allows it", () => {
    expect(
      isRequiredFieldSatisfied({
        required: true,
        epistemicState: "UNKNOWN",
        allowUnknownCompletion: true,
      }),
    ).toBe(true);
  });
});
