import { describe, expect, it } from "vitest";
import { handleCrmIntakeSubmitApiWithTransaction } from "@/server/intake-submit-api";
import type { TenantIdentity } from "@/server/data-auth";

type QueryResult = { rows: Array<Record<string, unknown>>; rowCount?: number };
type FakeQuery = { text: string; values: unknown[] };
type FakeClient = {
  query: (text: string, values?: unknown[]) => Promise<QueryResult>;
};

const identity: TenantIdentity = {
  authSubject: "auth-subject-1",
  userId: "20000000-0000-0000-0000-000000000001",
  domainActorId: "21000000-0000-0000-0000-000000000001",
  orgId: "10000000-0000-0000-0000-000000000001",
  roles: ["ops"],
  propertyIds: [],
  unitIds: [],
};

const sessionId = "61000000-0000-0000-0000-000000000001";
const submissionId = "60000000-0000-0000-0000-000000000001";
const qualPolicyId = "71000000-0000-0000-0000-000000000001";
const routePolicyId = "72000000-0000-0000-0000-000000000001";
const identityPolicyId = "73000000-0000-0000-0000-000000000001";

function fakeTransaction(
  responder: (text: string, values: unknown[]) => QueryResult,
  queries: FakeQuery[],
) {
  return async <T>(
    _request: Request,
    _env: unknown,
    operation: (
      client: FakeClient,
      resolvedIdentity: TenantIdentity,
      env: Record<string, unknown>,
    ) => Promise<T>,
  ): Promise<T> => {
    const client: FakeClient = {
      async query(text: string, values: unknown[] = []) {
        queries.push({ text, values });
        return responder(text, values);
      },
    };
    return operation(client, identity, {});
  };
}

function submitRequest(body: Record<string, unknown> = {}) {
  return new Request(
    `https://example.test/api/crm/intake-sessions/${sessionId}/submit`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedRevision: 11,
        idempotencyKey: "submit-1",
        ...body,
      }),
    },
  );
}

function baseResponder(text: string): QueryResult {
  if (
    text.includes("FROM crm_intake_sessions s") &&
    text.includes("crm_intake_definition_versions v")
  ) {
    return {
      rows: [
        {
          submission_id: submissionId,
          submission_revision: 11,
          submission_state: "IN_PROGRESS",
          session_state: "ACTIVE",
          qualification_policy_version_id: qualPolicyId,
          routing_policy_version_id: routePolicyId,
          identity_policy_version_id: identityPolicyId,
          qualification_namespace: "PROP-OPS-QUAL-001",
          qualification_version: "1.0.0",
          routing_namespace: "PROP-OPS-ROUTE-001",
          routing_version: "1.0.0",
        },
      ],
    };
  }
  if (text.includes("FROM crm_intake_answers a")) {
    const dimensions = [
      "ICP_FIT",
      "WORKFLOW_PAIN",
      "PAIN_FREQUENCY",
      "ECONOMIC_IMPACT",
      "WORKFLOW_FRAGMENTATION",
      "DATA_ACCESSIBILITY",
      "INTEGRATION_COMPLEXITY",
      "BUYER_ACCESS",
      "PILOT_SCOPE_CLARITY",
      "PILOT_REVERSIBILITY",
      "EVIDENCE_QUALITY",
    ];
    return {
      rows: [
        ...dimensions.map((key) => ({
          field_key: `qualification.${key}`,
          normalized_value: key === "INTEGRATION_COMPLEXITY" ? 10 : 90,
          raw_value: null,
          epistemic_state: "KNOWN",
          confirmed_by_human: true,
        })),
        {
          field_key: "buying.economic_buyer",
          normalized_value: "Regional Director",
          raw_value: null,
          epistemic_state: "ASSERTED",
          confirmed_by_human: false,
        },
        {
          field_key: "buying.target_timeline",
          normalized_value: "Q4 2026",
          raw_value: null,
          epistemic_state: "ASSERTED",
          confirmed_by_human: false,
        },
      ],
    };
  }
  if (text.includes("FROM crm_intake_contradictions")) return { rows: [] };
  if (text.includes("FROM crm_intake_evidence")) return { rows: [] };
  if (text.includes("INSERT INTO crm_intake_identity_resolution_runs")) {
    return { rows: [{ id: "74000000-0000-0000-0000-000000000001" }] };
  }
  if (text.includes("INSERT INTO crm_intake_qualification_results")) {
    return { rows: [{ id: "75000000-0000-0000-0000-000000000001" }] };
  }
  if (text.includes("INSERT INTO crm_intake_routing_decisions")) {
    return { rows: [{ id: "76000000-0000-0000-0000-000000000001" }] };
  }
  if (text.includes("INSERT INTO crm_intake_commands")) {
    return { rows: [{ id: crypto.randomUUID() }] };
  }
  if (text.includes("UPDATE crm_intake_submissions")) {
    return { rows: [{ revision: 12 }] };
  }
  return { rows: [] };
}

describe("CRM intake submit authority", () => {
  it("rejects client-supplied qualification, routing, or command authority", async () => {
    const response = await handleCrmIntakeSubmitApiWithTransaction(
      submitRequest({
        score: 99,
        routingState: "HIGH_PRIORITY_PILOT_CANDIDATE",
      }),
      {},
      fakeTransaction(baseResponder, []),
    );
    expect(response?.status).toBe(400);
    expect(await response?.json()).toMatchObject({
      ok: false,
      error: "INPUT_AUTHORITY_VIOLATION",
    });
  });

  it("derives qualification, routing, provisional identity, and proposed commands from persisted state", async () => {
    const queries: FakeQuery[] = [];
    const response = await handleCrmIntakeSubmitApiWithTransaction(
      submitRequest(),
      {},
      fakeTransaction(baseResponder, queries),
    );

    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({
      ok: true,
      submissionId,
      state: "SUBMITTED",
      revision: 12,
      identityResolution: "PROVISIONAL",
      qualification: {
        state: "SALES_READY",
        score: 90,
      },
      routing: {
        state: "HIGH_PRIORITY_PILOT_CANDIDATE",
        ruleId: "R-007",
      },
    });

    expect(
      queries.some((query) =>
        query.text.includes("INSERT INTO crm_intake_identity_resolution_runs"),
      ),
    ).toBe(true);
    expect(
      queries.some((query) =>
        query.text.includes("INSERT INTO crm_intake_qualification_results"),
      ),
    ).toBe(true);
    expect(
      queries.some((query) =>
        query.text.includes("INSERT INTO crm_intake_routing_decisions"),
      ),
    ).toBe(true);
    expect(
      queries.some((query) =>
        query.text.includes("INSERT INTO crm_intake_commands"),
      ),
    ).toBe(true);
    expect(
      queries.some((query) =>
        query.text.includes("INSERT INTO crm_intake_outbox"),
      ),
    ).toBe(true);

    const opportunityInsert = queries.find(
      (query) =>
        query.text.includes("INSERT INTO crm_intake_commands") &&
        query.values.includes("CreateOpportunity"),
    );
    expect(opportunityInsert?.values).toContain(true);
  });

  it("rejects a stale revision before producing qualification effects", async () => {
    const queries: FakeQuery[] = [];
    const responder = (text: string, values: unknown[]) => {
      const result = baseResponder(text);
      if (
        text.includes("FROM crm_intake_sessions s") &&
        text.includes("crm_intake_definition_versions v")
      ) {
        result.rows[0]!["submission_revision"] = 12;
      }
      return result;
    };
    const response = await handleCrmIntakeSubmitApiWithTransaction(
      submitRequest(),
      {},
      fakeTransaction(responder, queries),
    );
    expect(response?.status).toBe(409);
    expect(await response?.json()).toMatchObject({
      ok: false,
      error: "STALE_REVISION",
    });
    expect(
      queries.some((query) =>
        query.text.includes("INSERT INTO crm_intake_qualification_results"),
      ),
    ).toBe(false);
  });
});
