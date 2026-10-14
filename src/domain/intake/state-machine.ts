import type { SubmissionEvent, SubmissionState } from "./types";

type TransitionResult =
  | { ok: true; state: SubmissionState }
  | { ok: false; code: "INVALID_STATE_TRANSITION" };

const terminalStates = new Set<SubmissionState>([
  "PROCESSED",
  "ABANDONED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
]);

const transitions = new Map<string, SubmissionState>([
  ["CREATED:StartSubmission", "IN_PROGRESS"],
  ["IN_PROGRESS:RecordAnswer", "IN_PROGRESS"],
  ["IN_PROGRESS:AttachEvidence", "IN_PROGRESS"],
  ["IN_PROGRESS:RecordConsent", "IN_PROGRESS"],
  ["IN_PROGRESS:BeginValidation", "VALIDATING"],
  ["VALIDATING:ValidationPassed", "IDENTITY_RESOLUTION"],
  ["VALIDATING:ValidationFailed", "IN_PROGRESS"],
  ["IN_PROGRESS:AbandonSubmission", "ABANDONED"],
  ["IN_PROGRESS:ExpireSubmission", "EXPIRED"],
  ["IN_PROGRESS:CancelSubmission", "CANCELLED"],
  ["IDENTITY_RESOLUTION:IdentityResolved", "QUALIFYING"],
  ["IDENTITY_RESOLUTION:IdentityAmbiguous", "IN_PROGRESS"],
  ["IDENTITY_RESOLUTION:IdentityResolutionFailed", "PROCESSING_FAILED"],
  ["QUALIFYING:QualificationComputed", "ROUTING"],
  ["QUALIFYING:QualificationFailed", "PROCESSING_FAILED"],
  ["ROUTING:RoutingDecisionCreated", "SUBMITTED"],
  ["ROUTING:RoutingFailed", "PROCESSING_FAILED"],
  ["SUBMITTED:ProcessSubmission", "PROCESSED"],
  ["SUBMITTED:ProcessingFailed", "PROCESSING_FAILED"],
  ["PROCESSING_FAILED:RetryProcessing", "SUBMITTED"],
  ["PROCESSING_FAILED:RejectSubmission", "REJECTED"],
]);

export function isTerminalSubmissionState(state: SubmissionState): boolean {
  return terminalStates.has(state);
}

export function transitionSubmission(
  currentState: SubmissionState,
  event: SubmissionEvent,
): TransitionResult {
  if (isTerminalSubmissionState(currentState)) {
    return { ok: false, code: "INVALID_STATE_TRANSITION" };
  }

  const nextState = transitions.get(`${currentState}:${event}`);
  if (!nextState) {
    return { ok: false, code: "INVALID_STATE_TRANSITION" };
  }

  return { ok: true, state: nextState };
}
