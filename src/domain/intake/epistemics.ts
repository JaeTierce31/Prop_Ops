import type { EpistemicState } from "./types";

export type InferenceAcceptanceReason =
  | "HUMAN_CONFIRMATION_REQUIRED"
  | "HUMAN_CONFIRMED"
  | "BLOCKING_CONTRADICTION"
  | "AUTO_ACCEPT_DISABLED"
  | "BELOW_AUTO_ACCEPT_THRESHOLD"
  | "AUTO_ACCEPTED";

export interface InferenceAcceptanceInput {
  qualificationCritical: boolean;
  confidence: number;
  confirmedByHuman: boolean;
  blockingContradiction: boolean;
  allowAiAutoAccept: boolean;
  autoAcceptThreshold?: number;
}

export interface InferenceAcceptanceResult {
  accepted: boolean;
  reason: InferenceAcceptanceReason;
}

function assertConfidence(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be within 0..1`);
  }
}

export function evaluateInferenceAcceptance(
  input: InferenceAcceptanceInput,
): InferenceAcceptanceResult {
  assertConfidence(input.confidence, "confidence");
  if (input.autoAcceptThreshold !== undefined) {
    assertConfidence(input.autoAcceptThreshold, "autoAcceptThreshold");
  }

  if (input.blockingContradiction) {
    return { accepted: false, reason: "BLOCKING_CONTRADICTION" };
  }

  if (input.confirmedByHuman) {
    return { accepted: true, reason: "HUMAN_CONFIRMED" };
  }

  if (input.qualificationCritical) {
    return { accepted: false, reason: "HUMAN_CONFIRMATION_REQUIRED" };
  }

  if (!input.allowAiAutoAccept) {
    return { accepted: false, reason: "AUTO_ACCEPT_DISABLED" };
  }

  const threshold = input.autoAcceptThreshold ?? 1;
  if (input.confidence < threshold) {
    return { accepted: false, reason: "BELOW_AUTO_ACCEPT_THRESHOLD" };
  }

  return { accepted: true, reason: "AUTO_ACCEPTED" };
}

export interface ResolveAcceptedValueInput<TRaw, TValue> {
  rawAnswer: TRaw;
  candidateValue: TValue;
  acceptance: InferenceAcceptanceResult;
}

export interface ResolvedAcceptedValue<TRaw, TValue> {
  rawAnswer: TRaw;
  candidateValue: TValue;
  acceptedValue?: TValue;
  epistemicState: EpistemicState;
}

export function resolveAcceptedValue<TRaw, TValue>(
  input: ResolveAcceptedValueInput<TRaw, TValue>,
): ResolvedAcceptedValue<TRaw, TValue> {
  const base: ResolvedAcceptedValue<TRaw, TValue> = {
    rawAnswer: input.rawAnswer,
    candidateValue: input.candidateValue,
    epistemicState:
      input.acceptance.accepted && input.acceptance.reason === "HUMAN_CONFIRMED"
        ? "KNOWN"
        : "INFERRED",
  };

  return input.acceptance.accepted
    ? { ...base, acceptedValue: input.candidateValue }
    : base;
}
