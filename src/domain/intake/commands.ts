import type { PropOpsCommandType, PropOpsRoutingDecision } from "./routing";
import type { RoutingState } from "./types";

export type ProposedCommandStatus = "PROPOSED";

export interface IntakeCommandContext {
  tenantId: string;
  submissionId: string;
  routingDecisionId: string;
  policyVersionId: string;
}

export interface ProposedIntakeCommand {
  commandType: PropOpsCommandType;
  commandVersion: "1";
  tenantId: string;
  submissionId: string;
  routingDecisionId: string;
  targetContext: string;
  payload: Record<string, never>;
  policyVersionId: string;
  idempotencyKey: string;
  requiresHumanApproval: boolean;
  status: ProposedCommandStatus;
}

const allowedCommands: Record<RoutingState, readonly PropOpsCommandType[]> = {
  BLOCKED_MISSING_EVIDENCE: ["RequestEvidence", "CreateTask"],
  NOT_CURRENT_FIT: ["SendAcknowledgement"],
  NURTURE: ["CreatePersonCandidate", "EnterNurtureSequence"],
  DISCOVERY_REQUIRED: [
    "CreatePersonCandidate",
    "CreateOrganizationCandidate",
    "CreateTask",
    "ScheduleDiscovery",
  ],
  AUDIT_CANDIDATE: [
    "CreatePersonCandidate",
    "CreateOrganizationCandidate",
    "CreateOpportunity",
    "CreateTask",
  ],
  PILOT_CANDIDATE: [
    "CreatePersonCandidate",
    "CreateOrganizationCandidate",
    "CreateOpportunity",
    "CreatePilotCandidate",
    "CreateTask",
  ],
  HIGH_PRIORITY_PILOT_CANDIDATE: [
    "CreatePersonCandidate",
    "CreateOrganizationCandidate",
    "CreateOpportunity",
    "CreatePilotCandidate",
    "AssignOwner",
    "CreateTask",
    "ScheduleDiscovery",
  ],
};

const targetContexts: Record<PropOpsCommandType, string> = {
  RequestEvidence: "CRM.INTAKE.EVIDENCE.v1",
  CreateTask: "CRM.TASK.v1",
  SendAcknowledgement: "CRM.COMMUNICATION.v1",
  CreatePersonCandidate: "CRM.IDENTITY.PERSON_CANDIDATE.v1",
  EnterNurtureSequence: "CRM.NURTURE.v1",
  CreateOrganizationCandidate: "CRM.IDENTITY.ORGANIZATION_CANDIDATE.v1",
  ScheduleDiscovery: "CRM.SCHEDULING.DISCOVERY.v1",
  CreateOpportunity: "CRM.OPPORTUNITY.v1",
  CreatePilotCandidate: "CRM.PILOT_CANDIDATE.v1",
  AssignOwner: "CRM.OWNERSHIP.v1",
};

const approvalRequired = new Set<PropOpsCommandType>([
  "CreateOpportunity",
  "CreatePilotCandidate",
]);

function idempotencyKey(
  context: IntakeCommandContext,
  commandType: PropOpsCommandType,
  targetContext: string,
): string {
  return [
    context.submissionId,
    context.routingDecisionId,
    commandType,
    targetContext,
  ].join(":");
}

export function proposeIntakeCommands(
  context: IntakeCommandContext,
  routing: PropOpsRoutingDecision,
): ProposedIntakeCommand[] {
  if (routing.policy !== context.policyVersionId) {
    throw new Error("ROUTING_POLICY_VERSION_MISMATCH");
  }

  const allowed = new Set(allowedCommands[routing.state]);
  for (const commandType of routing.commands) {
    if (!allowed.has(commandType)) {
      throw new Error("COMMAND_NOT_ALLOWED_FOR_ROUTING_STATE");
    }
  }

  return routing.commands.map((commandType) => {
    const targetContext = targetContexts[commandType];
    return {
      commandType,
      commandVersion: "1",
      tenantId: context.tenantId,
      submissionId: context.submissionId,
      routingDecisionId: context.routingDecisionId,
      targetContext,
      payload: {},
      policyVersionId: context.policyVersionId,
      idempotencyKey: idempotencyKey(context, commandType, targetContext),
      requiresHumanApproval: approvalRequired.has(commandType),
      status: "PROPOSED",
    };
  });
}
