import { describe, expect, it } from "vitest";
import { handleCrmIntakeApiWithTransaction } from "@/server/intake-api";
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

const sessionId = "61000000-0000-0000-0000-000000000001";
const sourceAnswerId = "62000000-0000-0000-0000-000000000001";
const submissionId = "60000000-0000-0000-0000-000000000001";

function confirmationRequest(expectedRevision = 2) {
  return new Request(
    `https://example.test/api/crm/intake-sessions/${sessionId}/answers/${sourceAnswerId}/confirm`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedRevision,
        idempotencyKey: "confirm-ai-answer-1",
      }),
    },
  );
}

describe("CRM intake authoritative human confirmation", () => {
  it("creates a superseding KNOWN answer instead of mutating an AI inference", async () => {
    const queries: FakeQuery[] = [];
    const tx = fakeTransaction((text) => {
      if (
        text.includes("FROM crm_intake_sessions s") &&
        text.includes("crm_intake_answers a")
      ) {
        return {
          rows: [
            {
              submission_id: submissionId,
              submission_revision: 2,
              submission_state: "IN_PROGRESS",
              session_state: "ACTIVE",
              answer_id: sourceAnswerId,
              field_key: "workflow.primary_pain_category",
              raw_value: "Manual approvals create delays",
              normalized_value: "WORKFLOW_FRAGMENTATION",
              epistemic_state: "INFERRED",
              confidence: 0.96,
            },
          ],
        };
      }
      if (
        text.includes("FROM crm_intake_answers") &&
        text.includes("idempotency_key")
      ) {
        return { rows: [] };
      }
      if (text.includes("INSERT INTO crm_intake_answers")) {
        return {
          rows: [{ id: "62000000-0000-0000-0000-000000000002" }],
        };
      }
      if (text.includes("UPDATE crm_intake_submissions")) {
        return { rows: [{ revision: 3 }] };
      }
      if (text.includes("FROM crm_intake_provenance")) {
        return { rows: [{ id: "63000000-0000-0000-0000-000000000001" }] };
      }
      return { rows: [] };
    }, queries);

    const response = await handleCrmIntakeApiWithTransaction(
      confirmationRequest(),
      {},
      tx,
    );

    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({
      ok: true,
      sourceAnswerId,
      answerId: "62000000-0000-0000-0000-000000000002",
      submissionRevision: 3,
      epistemicState: "KNOWN",
      confirmedByHuman: true,
    });

    const answerInsert = queries.find((query) =>
      query.text.includes("INSERT INTO crm_intake_answers"),
    );
    expect(answerInsert?.values).toContain(sourceAnswerId);
    expect(answerInsert?.text).toContain("confirmed_by_human");
    expect(answerInsert?.text).toContain("true");
    expect(
      queries.some((query) =>
        query.text.includes("INSERT INTO crm_intake_provenance"),
      ),
    ).toBe(true);
    expect(
      queries.some((query) =>
        query.text.includes("INSERT INTO crm_intake_outbox"),
      ),
    ).toBe(true);
  });

  it("rejects confirmation of a non-INFERRED source answer", async () => {
    const tx = fakeTransaction((text) => {
      if (
        text.includes("FROM crm_intake_sessions s") &&
        text.includes("crm_intake_answers a")
      ) {
        return {
          rows: [
            {
              submission_id: submissionId,
              submission_revision: 2,
              submission_state: "IN_PROGRESS",
              session_state: "ACTIVE",
              answer_id: sourceAnswerId,
              field_key: "workflow.primary_pain",
              raw_value: "Manual approvals create delays",
              normalized_value: null,
              epistemic_state: "ASSERTED",
              confidence: null,
            },
          ],
        };
      }
      return { rows: [] };
    }, []);

    const response = await handleCrmIntakeApiWithTransaction(
      confirmationRequest(),
      {},
      tx,
    );
    expect(response?.status).toBe(409);
    expect(await response?.json()).toMatchObject({
      ok: false,
      error: "ANSWER_NOT_CONFIRMABLE",
    });
  });

  it("rejects a stale confirmation without creating a superseding answer", async () => {
    const queries: FakeQuery[] = [];
    const tx = fakeTransaction((text) => {
      if (
        text.includes("FROM crm_intake_sessions s") &&
        text.includes("crm_intake_answers a")
      ) {
        return {
          rows: [
            {
              submission_id: submissionId,
              submission_revision: 5,
              submission_state: "IN_PROGRESS",
              session_state: "ACTIVE",
              answer_id: sourceAnswerId,
              field_key: "workflow.primary_pain_category",
              raw_value: "Manual approvals create delays",
              normalized_value: "WORKFLOW_FRAGMENTATION",
              epistemic_state: "INFERRED",
              confidence: 0.96,
            },
          ],
        };
      }
      return { rows: [] };
    }, queries);

    const response = await handleCrmIntakeApiWithTransaction(
      confirmationRequest(4),
      {},
      tx,
    );
    expect(response?.status).toBe(409);
    expect(await response?.json()).toMatchObject({
      ok: false,
      error: "STALE_REVISION",
    });
    expect(
      queries.some((query) =>
        query.text.includes("INSERT INTO crm_intake_answers"),
      ),
    ).toBe(false);
  });
});
