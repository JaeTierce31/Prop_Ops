import type { EpistemicState } from "./types";

export interface RequiredFieldEvaluation {
  required: boolean;
  epistemicState: EpistemicState;
  qualificationCritical?: boolean;
  confirmedByHuman?: boolean;
  allowUnknownCompletion?: boolean;
  applicabilityEstablishedFalse?: boolean;
  allowUnconfirmedInference?: boolean;
}

export function isRequiredFieldSatisfied(
  input: RequiredFieldEvaluation,
): boolean {
  if (!input.required) return true;

  switch (input.epistemicState) {
    case "KNOWN":
    case "ASSERTED":
      return true;
    case "UNKNOWN":
      return input.allowUnknownCompletion === true;
    case "CONFLICTING":
      return false;
    case "NOT_APPLICABLE":
      return input.applicabilityEstablishedFalse === true;
    case "INFERRED":
      if (input.confirmedByHuman === true) return true;
      if (input.qualificationCritical === true) return false;
      return input.allowUnconfirmedInference === true;
  }
}
