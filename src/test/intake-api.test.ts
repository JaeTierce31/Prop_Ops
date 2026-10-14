import { describe, expect, it } from "vitest";
import { handleCrmIntakeApiWithTransaction } from "@/server/intake-api";
import type { TenantIdentity } from "@/server/data-auth";

type QueryResult = { rows: Array<Record<string, unknown>>; rowCount?: number };

type FakeQuery = {
  text: string;
  values: unknown[];
};

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

describe("CRM intake authenticated API boundary", () => {
  it("ignores client-supplied tenant authority when creating a session", async () => {
    const queries: FakeQuery[] = [];
    const tx = fakeTransaction((text) => {
      if (text.includes("FROM crm_intake_definitions d")) {
        return {
          rows: [
            {
              definition_id: "50000000-0000-0000-0000-000000000001",
              version_id: "51000000-0000-0000-0000-000000000001",
              version: "1.0.0",
            },
          ],
        };
      }
      if (text.includes("INSERT INTO crm_intake_submissions")) {
        return {
          rows: [
            {
              id: "60000000-0000-0000-0000-000000000001",
              revision: 1,
            },
          ],
        };
      }
      if (text.includes("INSERT INTO crm_intake_sessions")) {
        return {
          rows: [{ id: "61000000-0000-0000-0000-000000000001" }],
        };
      }
      return { rows: [] };
    }, queries);

    const request = new Request(
      "https://example.test/api/crm/intakes/50000000-0000-0000-0000-000000000001/sessions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId: "10000000-0000-0000-0000-000000000002",
          definitionVersion: "1.0.0",
          source: "MOBILE",
          idempotencyKey: "create-session-1",
        }),
      },
    );

    const response = await handleCrmIntakeApiWithTransaction(request, {}, tx);
    expect(response?.status).toBe(201);
    expect(await response?.json()).toMatchObject({
      ok: true,
      submissionId: "60000000-0000-0000-0000-000000000001",
      sessionId: "61000000-0000-0000-0000-000000000001",
      state: "IN_PROGRESS",
      revision: 1,
    });

    const submissionInsert = queries.find((query) =>
      query.text.includes("INSERT INTO crm_intake_submissions"),
    );
    expect(submissionInsert?.values).toContain(identity.orgId);
    expect(submissionInsert?.values).not.toContain(
      "10000000-0000-0000-0000-000000000002",
    );
  });

  it("rejects a client attempt to forge human confirmation", async () => {
    const queries: FakeQuery[] = [];
    const tx = fakeTransaction(() => ({ rows: [] }), queries);
    const request = new Request(
      "https://example.test/api/crm/intake-sessions/61000000-0000-0000-0000-000000000001/answers",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fieldKey: "workflow.primary_pain",
          rawValue: "Manual approvals create delays",
          epistemicState: "ASSERTED",
          confirmedByHuman: true,
          expectedRevision: 1,
          idempotencyKey: "answer-1",
        }),
      },
    );

    const response = await handleCrmIntakeApiWithTransaction(request, {}, tx);
    expect(response?.status).toBe(400);
    expect(await response?.json()).toMatchObject({
      ok: false,
      error: "HUMAN_CONFIRMATION_FORBIDDEN",
    });
    expect(queries).toHaveLength(0);
  });

  it("rejects AI-only epistemic states on the respondent answer endpoint", async () => {
    const queries: FakeQuery[] = [];
    const tx = fakeTransaction(() => ({ rows: [] }), queries);
    const request = new Request(
      "https://example.test/api/crm/intake-sessions/61000000-0000-0000-0000-000000000001/answers",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fieldKey: "workflow.primary_pain",
          rawValue: "Manual approvals create delays",
          epistemicState: "INFERRED",
          expectedRevision: 1,
          idempotencyKey: "answer-2",
        }),
      },
    );

    const response = await handleCrmIntakeApiWithTransaction(request, {}, tx);
    expect(response?.status).toBe(400);
    expect(await response?.json()).toMatchObject({
      ok: false,
      error: "EPISTEMIC_STATE_FORBIDDEN",
    });
    expect(queries).toHaveLength(0);
  });

  it("persists an asserted answer with optimistic revision and provenance", async () => {
    const queries: FakeQuery[] = [];
    const tx = fakeTransaction((text) => {
      if (text.includes("FROM crm_intake_sessions s")) {
        return {
          rows: [
            {
              session_id: "61000000-0000-0000-0000-000000000001",
              submission_id: "60000000-0000-0000-0000-000000000001",
              submission_revision: 1,
              submission_state: "IN_PROGRESS",
              session_state: "ACTIVE",
            },
          ],
        };
      }
      if (text.includes("FROM crm_intake_answers")) return { rows: [] };
      if (text.includes("INSERT INTO crm_intake_answers")) {
        return {
          rows: [{ id: "62000000-0000-0000-0000-000000000001" }],
        };
      }
      if (text.includes("UPDATE crm_intake_submissions")) {
        return { rows: [{ revision: 2 }] };
      }
      return { rows: [] };
    }, queries);

    const request = new Request(
      "https://example.test/api/crm/intake-sessions/61000000-0000-0000-0000-000000000001/answers",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fieldKey: "workflow.primary_pain",
          rawValue: "Manual approvals create delays",
          epistemicState: "ASSERTED",
          expectedRevision: 1,
          idempotencyKey: "answer-3",
        }),
      },
    );

    const response = await handleCrmIntakeApiWithTransaction(request, {}, tx);
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({
      ok: true,
      answerId: "62000000-0000-0000-0000-000000000001",
      submissionRevision: 2,
      accepted: true,
    });

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

  it("returns STALE_REVISION without inserting an answer", async () => {
    const queries: FakeQuery[] = [];
    const tx = fakeTransaction((text) => {
      if (text.includes("FROM crm_intake_sessions s")) {
        return {
          rows: [
            {
              session_id: "61000000-0000-0000-0000-000000000001",
              submission_id: "60000000-0000-0000-0000-000000000001",
              submission_revision: 4,
              submission_state: "IN_PROGRESS",
              session_state: "ACTIVE",
            },
          ],
        };
      }
      return { rows: [] };
    }, queries);

    const request = new Request(
      "https://example.test/api/crm/intake-sessions/61000000-0000-0000-0000-000000000001/answers",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fieldKey: "workflow.primary_pain",
          rawValue: "Manual approvals create delays",
          epistemicState: "ASSERTED",
          expectedRevision: 3,
          idempotencyKey: "answer-4",
        }),
      },
    );

    const response = await handleCrmIntakeApiWithTransaction(request, {}, tx);
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

  it("returns null for non-intake paths", async () => {
    const tx = fakeTransaction(() => ({ rows: [] }), []);
    const response = await handleCrmIntakeApiWithTransaction(
      new Request("https://example.test/api/property-ops/work-orders", {
        method: "GET",
      }),
      {},
      tx,
    );
    expect(response).toBeNull();
  });
});
