import type { RoutingState } from "./types";
import type {
  PropOpsDimensionScores,
  PropOpsQualificationResult,
} from "./qualification";

export type PropOpsCommandType =
  | "RequestEvidence"
  | "CreateTask"
  | "SendAcknowledgement"
  | "CreatePersonCandidate"
  | "EnterNurtureSequence"
  | "CreateOrganizationCandidate"
  | "ScheduleDiscovery"
  | "CreateOpportunity"
  | "CreatePilotCandidate"
  | "AssignOwner";

export interface PropOpsRoutingInput {
  qualification: PropOpsQualificationResult;
  dimensions: PropOpsDimensionScores;
  blockingContradiction?: boolean;
}

export interface PropOpsRoutingDecision {
  policy: "PROP-OPS-ROUTE-001@1.0.0";
  state: RoutingState;
  ruleId: `R-00${1 | 2 | 3 | 4 | 5 | 6 | 7}`;
  commands: PropOpsCommandType[];
}

const criticalKeys = [
  "ICP_FIT",
  "WORKFLOW_PAIN",
  "BUYER_ACCESS",
  "PILOT_SCOPE_CLARITY",
] as const;

function hasCriticalUnknown(dimensions: PropOpsDimensionScores): boolean {
  return criticalKeys.some((key) => dimensions[key] === undefined);
}

function decision(
  state: RoutingState,
  ruleId: PropOpsRoutingDecision["ruleId"],
  commands: PropOpsCommandType[],
): PropOpsRoutingDecision {
  return {
    policy: "PROP-OPS-ROUTE-001@1.0.0",
    state,
    ruleId,
    commands,
  };
}

export function routePropOps(input: PropOpsRoutingInput): PropOpsRoutingDecision {
  const { qualification, dimensions } = input;
  const blockingContradiction =
    input.blockingContradiction === true || qualification.blockingContradiction;

  if (qualification.coverage < 0.5 || hasCriticalUnknown(dimensions)) {
    return decision("BLOCKED_MISSING_EVIDENCE", "R-001", [
      "RequestEvidence",
      "CreateTask",
    ]);
  }

  if (qualification.state === "DISQUALIFIED" || (dimensions.ICP_FIT ?? 0) <= 25) {
    return decision("NOT_CURRENT_FIT", "R-002", ["SendAcknowledgement"]);
  }

  if (
    qualification.state === "HIGH_PRIORITY" ||
    qualification.state === "SALES_READY"
  ) {
    if (
      qualification.score >= 82 &&
      (dimensions.WORKFLOW_PAIN ?? -1) >= 80 &&
      (dimensions.BUYER_ACCESS ?? -1) >= 70 &&
      (dimensions.PILOT_SCOPE_CLARITY ?? -1) >= 75 &&
      (dimensions.PILOT_REVERSIBILITY ?? -1) >= 70 &&
      (dimensions.EVIDENCE_QUALITY ?? -1) >= 60 &&
      qualification.coverage >= 0.8 &&
      !blockingContradiction
    ) {
      return decision("HIGH_PRIORITY_PILOT_CANDIDATE", "R-007", [
        "CreatePersonCandidate",
        "CreateOrganizationCandidate",
        "CreateOpportunity",
        "CreatePilotCandidate",
        "AssignOwner",
        "CreateTask",
        "ScheduleDiscovery",
      ]);
    }
  }

  if (
    ["QUALIFIED", "HIGH_PRIORITY", "SALES_READY"].includes(
      qualification.state,
    ) &&
    qualification.score >= 70 &&
    (dimensions.WORKFLOW_PAIN ?? -1) >= 70 &&
    (dimensions.PILOT_SCOPE_CLARITY ?? -1) >= 65 &&
    (dimensions.PILOT_REVERSIBILITY ?? -1) >= 60 &&
    (dimensions.BUYER_ACCESS ?? -1) >= 50 &&
    (dimensions.EVIDENCE_QUALITY ?? -1) >= 50 &&
    qualification.coverage >= 0.65 &&
    !blockingContradiction
  ) {
    return decision("PILOT_CANDIDATE", "R-006", [
      "CreatePersonCandidate",
      "CreateOrganizationCandidate",
      "CreateOpportunity",
      "CreatePilotCandidate",
      "CreateTask",
    ]);
  }

  if (
    ["QUALIFIED", "HIGH_PRIORITY", "SALES_READY"].includes(
      qualification.state,
    ) &&
    (dimensions.WORKFLOW_PAIN ?? -1) >= 60 &&
    (dimensions.EVIDENCE_QUALITY ?? -1) >= 40 &&
    qualification.coverage >= 0.6 &&
    ((dimensions.PILOT_SCOPE_CLARITY ?? -1) < 65 ||
      (dimensions.DATA_ACCESSIBILITY ?? -1) < 50)
  ) {
    return decision("AUDIT_CANDIDATE", "R-005", [
      "CreatePersonCandidate",
      "CreateOrganizationCandidate",
      "CreateOpportunity",
      "CreateTask",
    ]);
  }

  if (
    qualification.state === "DISCOVERY" ||
    qualification.state === "POTENTIAL" ||
    (dimensions.BUYER_ACCESS ?? -1) < 50
  ) {
    return decision("DISCOVERY_REQUIRED", "R-004", [
      "CreatePersonCandidate",
      "CreateOrganizationCandidate",
      "CreateTask",
      "ScheduleDiscovery",
    ]);
  }

  if (qualification.state === "UNQUALIFIED" && (dimensions.ICP_FIT ?? 0) > 25) {
    return decision("NURTURE", "R-003", [
      "CreatePersonCandidate",
      "EnterNurtureSequence",
    ]);
  }

  return decision("NURTURE", "R-003", [
    "CreatePersonCandidate",
    "EnterNurtureSequence",
  ]);
}
