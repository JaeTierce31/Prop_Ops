import { describe, expect, it } from "vitest";
import { proposeIntakeCommands } from "@/domain/intake/commands";
import type { PropOpsRoutingDecision } from "@/domain/intake/routing";

const context = {
  tenantId: "10000000-0000-0000-0000-000000000001",
  submissionId: "60000000-0000-0000-0000-000000000001",
  routingDecisionId: "80000000-0000-0000-0000-000000000001",
  policyVersionId: "PROP-OPS-ROUTE-001@1.0.0",
};

describe("intake proposed command envelopes", () => {
  it("materializes blocked-routing commands without creating an opportunity", () => {
    const routing: PropOpsRoutingDecision = {
      policy: "PROP-OPS-ROUTE-001@1.0.0",
      state: "BLOCKED_MISSING_EVIDENCE",
      ruleId: "R-001",
      commands: ["RequestEvidence", "CreateTask"],
    };

    const commands = proposeIntakeCommands(context, routing);

    expect(commands.map((command) => command.commandType)).toEqual([
      "RequestEvidence",
      "CreateTask",
    ]);
    expect(commands.every((command) => command.status === "PROPOSED")).toBe(
      true,
    );
    expect(commands.some((command) => command.commandType === "CreateOpportunity")).toBe(
      false,
    );
  });

  it("binds every proposal to tenant, submission, routing decision, policy, and deterministic idempotency", () => {
    const routing: PropOpsRoutingDecision = {
      policy: "PROP-OPS-ROUTE-001@1.0.0",
      state: "PILOT_CANDIDATE",
      ruleId: "R-006",
      commands: [
        "CreatePersonCandidate",
        "CreateOrganizationCandidate",
        "CreateOpportunity",
        "CreatePilotCandidate",
        "CreateTask",
      ],
    };

    const first = proposeIntakeCommands(context, routing);
    const second = proposeIntakeCommands(context, routing);

    expect(second).toEqual(first);
    expect(new Set(first.map((command) => command.idempotencyKey)).size).toBe(
      first.length,
    );
    for (const command of first) {
      expect(command).toMatchObject({
        tenantId: context.tenantId,
        submissionId: context.submissionId,
        routingDecisionId: context.routingDecisionId,
        policyVersionId: context.policyVersionId,
        status: "PROPOSED",
      });
      expect(command.idempotencyKey).toContain(context.submissionId);
      expect(command.idempotencyKey).toContain(context.routingDecisionId);
    }
  });

  it("requires human approval for opportunity and pilot proposals", () => {
    const routing: PropOpsRoutingDecision = {
      policy: "PROP-OPS-ROUTE-001@1.0.0",
      state: "HIGH_PRIORITY_PILOT_CANDIDATE",
      ruleId: "R-007",
      commands: ["CreateOpportunity", "CreatePilotCandidate", "AssignOwner"],
    };

    const commands = proposeIntakeCommands(context, routing);
    const opportunity = commands.find(
      (command) => command.commandType === "CreateOpportunity",
    );
    const pilot = commands.find(
      (command) => command.commandType === "CreatePilotCandidate",
    );
    const owner = commands.find((command) => command.commandType === "AssignOwner");

    expect(opportunity?.requiresHumanApproval).toBe(true);
    expect(pilot?.requiresHumanApproval).toBe(true);
    expect(owner?.requiresHumanApproval).toBe(false);
  });

  it("rejects command types that are not allowed by the resolved routing state", () => {
    const malformed = {
      policy: "PROP-OPS-ROUTE-001@1.0.0",
      state: "BLOCKED_MISSING_EVIDENCE",
      ruleId: "R-001",
      commands: ["CreateOpportunity"],
    } as unknown as PropOpsRoutingDecision;

    expect(() => proposeIntakeCommands(context, malformed)).toThrow(
      "COMMAND_NOT_ALLOWED_FOR_ROUTING_STATE",
    );
  });
});
