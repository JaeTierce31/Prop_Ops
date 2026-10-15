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

export interface IntakeConfirmationDbClient {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
}

export type IntakeConfirmationTransactionRunner = <T>(
  request: Request,
  rawEnv: unknown,
  operation: (
    client: IntakeConfirmationDbClient,
    identity: TenantIdentity,
    env: RuntimeEnv,
  ) => Promise<T>,
) => Promise<T>;

const productionRunner: IntakeConfirmationTransactionRunner = (
  request,
  rawEnv,
  operation,
) =>
  withTenantTransaction(request, rawEnv, (client, identity, env) =>
    operation(client as unknown as IntakeConfirmationDbClient, identity, env),
  );

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

async function confirmAnswer(
  request: Request,
  client: IntakeConfirmationDbClient,
  identity: TenantIdentity,
  sessionId: string,
  sourceAnswerId: string,
): Promise<Response> {
  const body = await jsonBody(request);
  const revisionExpected = expectedRevision(body);
  const idempotencyKey = requiredString(body, "idempotencyKey");

  const source = await client.query(
    `SELECT
       s.submission_id,
       s.state AS session_state,
       sub.state AS submission_state,
       sub.revision AS submission_revision,
       a.id AS answer_id,
       a.field_key,
       a.raw_value,
       a.normalized_value,
       a.epistemic_state,
       a.confidence
     FROM crm_intake_sessions s
     JOIN crm_intake_submissions sub
       ON sub.id = s.submission_id
      AND sub.tenant_id = s.tenant_id
     JOIN crm_intake_answers a
       ON a.submission_id = sub.id
      AND a.tenant_id = sub.tenant_id
     WHERE s.id = $1::uuid
       AND a.id = $2::uuid
       AND s.tenant_id = $3::uuid
     LIMIT 1`,
    [sessionId, sourceAnswerId, identity.orgId],
  );

  const sourceRow = source.rows[0];
  if (!sourceRow) {
    throw new ApiError(
      404,
      "ANSWER_NOT_FOUND",
      "The intake answer was not found.",
    );
  }

  if (
    String(sourceRow["session_state"]) !== "ACTIVE" ||
    String(sourceRow["submission_state"]) !== "IN_PROGRESS"
  ) {
    throw new ApiError(
      409,
      "INVALID_STATE_TRANSITION",
      "The intake answer cannot be confirmed in its current state.",
    );
  }

  const submissionId = String(sourceRow["submission_id"]);
  const currentRevision = Number(sourceRow["submission_revision"]);
  if (currentRevision !== revisionExpected) {
    throw new ApiError(
      409,
      "STALE_REVISION",
      "Submission revision does not match.",
    );
  }

  if (String(sourceRow["epistemic_state"]) !== "INFERRED") {
    throw new ApiError(
      409,
      "ANSWER_NOT_CONFIRMABLE",
      "Only an inferred answer may be confirmed through this operation.",
    );
  }

  const existing = await client.query(
    `SELECT
       id, supersedes_answer_id, epistemic_state, confirmed_by_human
     FROM crm_intake_answers
     WHERE tenant_id = $1::uuid
       AND submission_id = $2::uuid
       AND idempotency_key = $3
     LIMIT 1`,
    [identity.orgId, submissionId, idempotencyKey],
  );

  const existingRow = existing.rows[0];
  if (existingRow) {
    const sameOperation =
      String(existingRow["supersedes_answer_id"]) === sourceAnswerId &&
      String(existingRow["epistemic_state"]) === "KNOWN" &&
      existingRow["confirmed_by_human"] === true;
    if (!sameOperation) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "The idempotency key was already used for a different operation.",
      );
    }

    return jsonResponse({
      ok: true,
      sourceAnswerId,
      answerId: String(existingRow["id"]),
      submissionRevision: currentRevision,
      epistemicState: "KNOWN",
      confirmedByHuman: true,
    });
  }

  const provenance = await client.query(
    `SELECT id
     FROM crm_intake_provenance
     WHERE tenant_id = $1::uuid
       AND answer_id = $2::uuid
     ORDER BY captured_at ASC, id ASC
     LIMIT 1`,
    [identity.orgId, sourceAnswerId],
  );
  const parentProvenance = provenance.rows[0];
  if (!parentProvenance) {
    throw new ApiError(
      409,
      "PROVENANCE_REQUIRED",
      "The inferred answer has no provenance to confirm.",
    );
  }

  const answerId = randomId();
  const inserted = await client.query(
    `INSERT INTO crm_intake_answers (
       id, tenant_id, submission_id, session_id, field_key,
       raw_value, normalized_value, epistemic_state, confidence,
       confirmed_by_human, supersedes_answer_id, idempotency_key
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
       $6::jsonb, $7::jsonb, 'KNOWN', $8,
       true, $9::uuid, $10
     )
     RETURNING id`,
    [
      answerId,
      identity.orgId,
      submissionId,
      sessionId,
      String(sourceRow["field_key"]),
      JSON.stringify(sourceRow["raw_value"] ?? null),
      JSON.stringify(sourceRow["normalized_value"] ?? null),
      sourceRow["confidence"] ?? null,
      sourceAnswerId,
      idempotencyKey,
    ],
  );
  if (!inserted.rows[0]) {
    throw new ApiError(
      500,
      "ANSWER_CONFIRMATION_FAILED",
      "The confirmed answer was not created.",
    );
  }
  const persistedAnswerId = String(inserted.rows[0]["id"]);

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

  await client.query(
    `INSERT INTO crm_intake_provenance (
       tenant_id, answer_id, source_type, source_ref, actor_ref,
       transformation_type, parent_provenance_ids, confidence
     ) VALUES (
       $1::uuid, $2::uuid, 'OPERATOR', $3, $4::jsonb,
       'CORRECTED', ARRAY[$5::uuid], $6
     )`,
    [
      identity.orgId,
      persistedAnswerId,
      `human-confirmation:${sourceAnswerId}`,
      JSON.stringify(actorRef(identity)),
      String(parentProvenance["id"]),
      sourceRow["confidence"] ?? null,
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
       $1::uuid, 'AnswerCorrected', 1, 'IntakeSubmission', $2::uuid,
       $3::jsonb, $4::jsonb, $5::uuid, $6
     )`,
    [
      identity.orgId,
      submissionId,
      JSON.stringify({
        sourceAnswerId,
        answerId: persistedAnswerId,
        epistemicState: "KNOWN",
        confirmedByHuman: true,
        revision: newRevision,
      }),
      JSON.stringify(actorRef(identity)),
      randomId(),
      `AnswerCorrected:${submissionId}:${persistedAnswerId}`,
    ],
  );

  return jsonResponse({
    ok: true,
    sourceAnswerId,
    answerId: persistedAnswerId,
    submissionRevision: newRevision,
    epistemicState: "KNOWN",
    confirmedByHuman: true,
  });
}

export async function handleCrmIntakeConfirmationApiWithTransaction(
  request: Request,
  rawEnv: unknown,
  transactionRunner: IntakeConfirmationTransactionRunner,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  const match =
    /^\/api\/crm\/intake-sessions\/([^/]+)\/answers\/([^/]+)\/confirm$/.exec(
      pathname,
    );
  if (!match) return null;

  try {
    if (request.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Only POST is supported.");
    }

    const sessionId = pathUuid(match[1]!, "sessionId");
    const sourceAnswerId = pathUuid(match[2]!, "answerId");
    return await transactionRunner(request, rawEnv, (client, identity) =>
      confirmAnswer(request, client, identity, sessionId, sourceAnswerId),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleCrmIntakeConfirmationApi(
  request: Request,
  rawEnv: unknown,
): Promise<Response | null> {
  return handleCrmIntakeConfirmationApiWithTransaction(
    request,
    rawEnv,
    productionRunner,
  );
}
