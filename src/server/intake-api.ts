import {
  ApiError,
  apiErrorResponse,
  jsonResponse,
  withTenantTransaction,
  type RuntimeEnv,
  type TenantIdentity,
} from "./data-auth";

type QueryResult = {
  rows: Array<Record<string, unknown>>;
  rowCount?: number | null;
};

export interface IntakeDbClient {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
}

export type IntakeTransactionRunner = <T>(
  request: Request,
  rawEnv: unknown,
  operation: (
    client: IntakeDbClient,
    identity: TenantIdentity,
    env: RuntimeEnv,
  ) => Promise<T>,
) => Promise<T>;

const productionRunner: IntakeTransactionRunner = (
  request,
  rawEnv,
  operation,
) =>
  withTenantTransaction(request, rawEnv, (client, identity, env) =>
    operation(client as unknown as IntakeDbClient, identity, env),
  );

const intakeSources = new Set([
  "WEB",
  "MOBILE",
  "OPERATOR",
  "API",
  "IMPORT",
  "CONVERSATIONAL",
]);

const respondentEpistemicStates = new Set([
  "ASSERTED",
  "UNKNOWN",
  "NOT_APPLICABLE",
]);

function actorRef(identity: TenantIdentity) {
  return {
    actorType: "HUMAN",
    actorId: identity.domainActorId,
    externalRef: identity.userId,
  };
}

function randomId(): string {
  return globalThis.crypto.randomUUID();
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "A valid JSON body is required.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(
      400,
      "INVALID_INPUT",
      "The request body must be an object.",
    );
  }
  return parsed as Record<string, unknown>;
}

function requiredString(
  body: Record<string, unknown>,
  key: string,
  maxLength = 200,
): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "INVALID_INPUT", `${key} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ApiError(400, "INVALID_INPUT", `${key} is too long.`);
  }
  return normalized;
}

function optionalString(
  body: Record<string, unknown>,
  key: string,
  maxLength = 200,
): string | null {
  const value = body[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "INVALID_INPUT", `${key} is invalid.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ApiError(400, "INVALID_INPUT", `${key} is too long.`);
  }
  return normalized;
}

function expectedRevision(body: Record<string, unknown>): number {
  const value = body["expectedRevision"];
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new ApiError(
      400,
      "INVALID_INPUT",
      "expectedRevision must be a non-negative integer.",
    );
  }
  return Number(value);
}

function pathUuid(value: string, label: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new ApiError(400, "INVALID_INPUT", `${label} must be a UUID.`);
  }
  return value;
}

async function createSession(
  request: Request,
  client: IntakeDbClient,
  identity: TenantIdentity,
  definitionId: string,
): Promise<Response> {
  const body = await jsonBody(request);
  const definitionVersion = optionalString(body, "definitionVersion", 64);
  const source = requiredString(body, "source", 32).toUpperCase();
  const idempotencyKey = requiredString(body, "idempotencyKey");

  if (!intakeSources.has(source)) {
    throw new ApiError(400, "INVALID_INPUT", "source is not supported.");
  }

  const definition = await client.query(
    `SELECT
       d.id AS definition_id,
       v.id AS version_id,
       v.version
     FROM crm_intake_definitions d
     JOIN crm_intake_definition_versions v
       ON v.intake_definition_id = d.id
      AND v.tenant_id = d.tenant_id
     WHERE d.id = $1::uuid
       AND d.tenant_id = $2::uuid
       AND d.lifecycle_state = 'ACTIVE'
       AND v.published_at IS NOT NULL
       AND (
         ($3::text IS NOT NULL AND v.version = $3::text)
         OR ($3::text IS NULL AND v.id = d.current_version_id)
       )
     LIMIT 1`,
    [definitionId, identity.orgId, definitionVersion],
  );

  const definitionRow = definition.rows[0];
  if (!definitionRow) {
    throw new ApiError(
      404,
      "INTAKE_DEFINITION_NOT_FOUND",
      "The intake definition is unavailable.",
    );
  }

  const versionId = String(definitionRow["version_id"]);
  const inserted = await client.query(
    `INSERT INTO crm_intake_submissions (
       tenant_id, definition_id, definition_version_id,
       state, revision, source, idempotency_key
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'IN_PROGRESS', 1, $4, $5)
     ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
     RETURNING id, revision`,
    [identity.orgId, definitionId, versionId, source, idempotencyKey],
  );

  let submissionId: string;
  let revision: number;
  let sessionId: string;
  const created = Boolean(inserted.rows[0]);

  if (created) {
    submissionId = String(inserted.rows[0]!["id"]);
    revision = Number(inserted.rows[0]!["revision"]);

    const session = await client.query(
      `INSERT INTO crm_intake_sessions (
         tenant_id, submission_id, definition_version_id,
         actor_ref, channel, state, revision
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5, 'ACTIVE', 0)
       RETURNING id`,
      [
        identity.orgId,
        submissionId,
        versionId,
        JSON.stringify(actorRef(identity)),
        source,
      ],
    );
    if (!session.rows[0]) {
      throw new ApiError(
        500,
        "SESSION_CREATE_FAILED",
        "The session was not created.",
      );
    }
    sessionId = String(session.rows[0]["id"]);

    await client.query(
      `INSERT INTO crm_intake_outbox (
         tenant_id, event_type, event_version, aggregate_type, aggregate_id,
         payload, actor_ref, correlation_id, idempotency_key
       ) VALUES (
         $1::uuid, 'IntakeStarted', 1, 'IntakeSubmission', $2::uuid,
         $3::jsonb, $4::jsonb, $5::uuid, $6
       )`,
      [
        identity.orgId,
        submissionId,
        JSON.stringify({
          definitionId,
          definitionVersionId: versionId,
          source,
        }),
        JSON.stringify(actorRef(identity)),
        randomId(),
        `IntakeStarted:${submissionId}`,
      ],
    );
  } else {
    const existing = await client.query(
      `SELECT id, revision, definition_id, definition_version_id, source
       FROM crm_intake_submissions
       WHERE tenant_id = $1::uuid
         AND idempotency_key = $2
       LIMIT 1`,
      [identity.orgId, idempotencyKey],
    );
    const row = existing.rows[0];
    if (
      !row ||
      String(row["definition_id"]) !== definitionId ||
      String(row["definition_version_id"]) !== versionId ||
      String(row["source"]) !== source
    ) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "The idempotency key was already used for a different request.",
      );
    }

    submissionId = String(row["id"]);
    revision = Number(row["revision"]);
    const session = await client.query(
      `SELECT id
       FROM crm_intake_sessions
       WHERE tenant_id = $1::uuid
         AND submission_id = $2::uuid
       ORDER BY started_at ASC
       LIMIT 1`,
      [identity.orgId, submissionId],
    );
    if (!session.rows[0]) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "The prior submission has no matching intake session.",
      );
    }
    sessionId = String(session.rows[0]["id"]);
  }

  return jsonResponse(
    {
      ok: true,
      submissionId,
      sessionId,
      state: "IN_PROGRESS",
      revision,
      definitionVersionId: versionId,
    },
    created ? 201 : 200,
  );
}

async function recordAnswer(
  request: Request,
  client: IntakeDbClient,
  identity: TenantIdentity,
  sessionId: string,
): Promise<Response> {
  const body = await jsonBody(request);

  if (Object.prototype.hasOwnProperty.call(body, "confirmedByHuman")) {
    throw new ApiError(
      400,
      "HUMAN_CONFIRMATION_FORBIDDEN",
      "Human confirmation requires a separate authoritative operation.",
    );
  }

  const epistemicState = requiredString(
    body,
    "epistemicState",
    32,
  ).toUpperCase();
  if (!respondentEpistemicStates.has(epistemicState)) {
    throw new ApiError(
      400,
      "EPISTEMIC_STATE_FORBIDDEN",
      "This endpoint cannot establish the requested epistemic state.",
    );
  }

  const fieldKey = requiredString(body, "fieldKey");
  const revisionExpected = expectedRevision(body);
  const idempotencyKey = requiredString(body, "idempotencyKey");
  const answerId = optionalString(body, "answerId", 64) ?? randomId();
  const supersedesAnswerId = optionalString(body, "supersedesAnswerId", 64);
  const rawValue = body["rawValue"] ?? null;

  const session = await client.query(
    `SELECT
       s.id AS session_id,
       s.submission_id,
       s.state AS session_state,
       sub.state AS submission_state,
       sub.revision AS submission_revision
     FROM crm_intake_sessions s
     JOIN crm_intake_submissions sub
       ON sub.id = s.submission_id
      AND sub.tenant_id = s.tenant_id
     WHERE s.id = $1::uuid
       AND s.tenant_id = $2::uuid
     LIMIT 1`,
    [sessionId, identity.orgId],
  );

  const sessionRow = session.rows[0];
  if (!sessionRow) {
    throw new ApiError(
      404,
      "SESSION_NOT_FOUND",
      "The intake session was not found.",
    );
  }
  if (
    String(sessionRow["session_state"]) !== "ACTIVE" ||
    String(sessionRow["submission_state"]) !== "IN_PROGRESS"
  ) {
    throw new ApiError(
      409,
      "INVALID_STATE_TRANSITION",
      "The intake session cannot accept answers in its current state.",
    );
  }

  const submissionId = String(sessionRow["submission_id"]);
  const currentRevision = Number(sessionRow["submission_revision"]);
  if (currentRevision !== revisionExpected) {
    throw new ApiError(
      409,
      "STALE_REVISION",
      "Submission revision does not match.",
    );
  }

  const existing = await client.query(
    `SELECT id, field_key, raw_value, epistemic_state
     FROM crm_intake_answers
     WHERE tenant_id = $1::uuid
       AND submission_id = $2::uuid
       AND idempotency_key = $3
     LIMIT 1`,
    [identity.orgId, submissionId, idempotencyKey],
  );

  if (existing.rows[0]) {
    const row = existing.rows[0];
    const samePayload =
      String(row["field_key"]) === fieldKey &&
      String(row["epistemic_state"]) === epistemicState &&
      JSON.stringify(row["raw_value"] ?? null) === JSON.stringify(rawValue);
    if (!samePayload) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "The idempotency key was already used for a different answer.",
      );
    }
    return jsonResponse({
      ok: true,
      answerId: String(row["id"]),
      submissionRevision: currentRevision,
      accepted: true,
    });
  }

  const inserted = await client.query(
    `INSERT INTO crm_intake_answers (
       id, tenant_id, submission_id, session_id, field_key,
       raw_value, epistemic_state, confirmed_by_human,
       supersedes_answer_id, idempotency_key
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
       $6::jsonb, $7, false, $8::uuid, $9
     )
     RETURNING id`,
    [
      answerId,
      identity.orgId,
      submissionId,
      sessionId,
      fieldKey,
      JSON.stringify(rawValue),
      epistemicState,
      supersedesAnswerId,
      idempotencyKey,
    ],
  );
  if (!inserted.rows[0]) {
    throw new ApiError(
      500,
      "ANSWER_CREATE_FAILED",
      "The answer was not created.",
    );
  }

  const revision = await client.query(
    `UPDATE crm_intake_submissions
     SET revision = revision + 1,
         updated_at = now()
     WHERE id = $1::uuid
       AND tenant_id = $2::uuid
       AND revision = $3
       AND state = 'IN_PROGRESS'
     RETURNING revision`,
    [submissionId, identity.orgId, revisionExpected],
  );
  if (!revision.rows[0]) {
    throw new ApiError(
      409,
      "STALE_REVISION",
      "Submission revision does not match.",
    );
  }
  const newRevision = Number(revision.rows[0]["revision"]);
  const persistedAnswerId = String(inserted.rows[0]["id"]);

  await client.query(
    `INSERT INTO crm_intake_provenance (
       tenant_id, answer_id, source_type, source_ref, actor_ref,
       transformation_type, parent_provenance_ids
     ) VALUES (
       $1::uuid, $2::uuid, 'RESPONDENT', $3, $4::jsonb,
       'ORIGINAL', '{}'::uuid[]
     )`,
    [
      identity.orgId,
      persistedAnswerId,
      `intake-session:${sessionId}`,
      JSON.stringify(actorRef(identity)),
    ],
  );

  await client.query(
    `UPDATE crm_intake_sessions
     SET revision = revision + 1,
         last_activity_at = now()
     WHERE id = $1::uuid
       AND tenant_id = $2::uuid`,
    [sessionId, identity.orgId],
  );

  await client.query(
    `INSERT INTO crm_intake_outbox (
       tenant_id, event_type, event_version, aggregate_type, aggregate_id,
       payload, actor_ref, correlation_id, idempotency_key
     ) VALUES (
       $1::uuid, 'AnswerRecorded', 1, 'IntakeSubmission', $2::uuid,
       $3::jsonb, $4::jsonb, $5::uuid, $6
     )`,
    [
      identity.orgId,
      submissionId,
      JSON.stringify({
        answerId: persistedAnswerId,
        fieldKey,
        epistemicState,
        revision: newRevision,
      }),
      JSON.stringify(actorRef(identity)),
      randomId(),
      `AnswerRecorded:${submissionId}:${persistedAnswerId}`,
    ],
  );

  return jsonResponse({
    ok: true,
    answerId: persistedAnswerId,
    submissionRevision: newRevision,
    accepted: true,
  });
}

export async function handleCrmIntakeApiWithTransaction(
  request: Request,
  rawEnv: unknown,
  transactionRunner: IntakeTransactionRunner,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  const sessionMatch = /^\/api\/crm\/intakes\/([^/]+)\/sessions$/.exec(
    pathname,
  );
  const answerMatch = /^\/api\/crm\/intake-sessions\/([^/]+)\/answers$/.exec(
    pathname,
  );

  if (!sessionMatch && !answerMatch) return null;

  try {
    if (request.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Only POST is supported.");
    }

    if (sessionMatch) {
      const definitionId = pathUuid(sessionMatch[1]!, "definitionId");
      return await transactionRunner(request, rawEnv, (client, identity) =>
        createSession(request, client, identity, definitionId),
      );
    }

    const sessionId = pathUuid(answerMatch![1]!, "sessionId");
    return await transactionRunner(request, rawEnv, (client, identity) =>
      recordAnswer(request, client, identity, sessionId),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleCrmIntakeApi(
  request: Request,
  rawEnv: unknown,
): Promise<Response | null> {
  return handleCrmIntakeApiWithTransaction(request, rawEnv, productionRunner);
}
