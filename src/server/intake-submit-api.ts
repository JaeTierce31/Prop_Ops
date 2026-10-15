import { proposeIntakeCommands } from "../domain/intake/commands";
import {
  PROP_OPS_DIMENSION_KEYS,
  qualifyPropOps,
  type PropOpsDimensionScores,
} from "../domain/intake/qualification";
import { routePropOps } from "../domain/intake/routing";
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

export interface IntakeSubmitDbClient {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
}

export type IntakeSubmitTransactionRunner = <T>(
  request: Request,
  rawEnv: unknown,
  operation: (
    client: IntakeSubmitDbClient,
    identity: TenantIdentity,
    env: RuntimeEnv,
  ) => Promise<T>,
) => Promise<T>;

const productionRunner: IntakeSubmitTransactionRunner = (
  request,
  rawEnv,
  operation,
) =>
  withTenantTransaction(request, rawEnv, (client, identity, env) =>
    operation(client as unknown as IntakeSubmitDbClient, identity, env),
  );

const allowedRequestKeys = new Set(["expectedRevision", "idempotencyKey"]);
const qualificationPrefix = "qualification.";

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

function rejectClientAuthority(body: Record<string, unknown>): void {
  const unauthorized = Object.keys(body).filter(
    (key) => !allowedRequestKeys.has(key),
  );
  if (unauthorized.length > 0) {
    throw new ApiError(
      400,
      "INPUT_AUTHORITY_VIOLATION",
      "Qualification, routing, and command authority are server-derived.",
      { fields: unauthorized },
    );
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function acceptedAnswer(row: Record<string, unknown>): boolean {
  const state = String(row["epistemic_state"] ?? "");
  if (state === "KNOWN" || state === "ASSERTED") return true;
  return state === "INFERRED" && row["confirmed_by_human"] === true;
}

function presentValue(row: Record<string, unknown>): unknown {
  return row["normalized_value"] ?? row["raw_value"] ?? null;
}

function factKnown(row: Record<string, unknown> | undefined): boolean {
  if (!row || !acceptedAnswer(row)) return false;
  const value = presentValue(row);
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function dimensionsFromAnswers(
  answers: Array<Record<string, unknown>>,
): PropOpsDimensionScores {
  const dimensions = Object.fromEntries(
    PROP_OPS_DIMENSION_KEYS.map((key) => [key, undefined]),
  ) as PropOpsDimensionScores;

  for (const row of answers) {
    if (!acceptedAnswer(row)) continue;
    const fieldKey = String(row["field_key"] ?? "");
    if (!fieldKey.startsWith(qualificationPrefix)) continue;
    const dimensionKey = fieldKey.slice(qualificationPrefix.length);
    if (!PROP_OPS_DIMENSION_KEYS.includes(dimensionKey as never)) continue;
    const value = presentValue(row);
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    dimensions[dimensionKey as keyof PropOpsDimensionScores] = value;
  }

  return dimensions;
}

async function insertOutbox(
  client: IntakeSubmitDbClient,
  identity: TenantIdentity,
  submissionId: string,
  eventType: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
): Promise<void> {
  await client.query(
    `INSERT INTO crm_intake_outbox (
       tenant_id, event_type, event_version, aggregate_type, aggregate_id,
       payload, actor_ref, correlation_id, idempotency_key
     ) VALUES (
       $1::uuid, $2, 1, 'IntakeSubmission', $3::uuid,
       $4::jsonb, $5::jsonb, $6::uuid, $7
     )`,
    [
      identity.orgId,
      eventType,
      submissionId,
      JSON.stringify(payload),
      JSON.stringify(actorRef(identity)),
      randomId(),
      idempotencyKey,
    ],
  );
}

async function submitIntake(
  request: Request,
  client: IntakeSubmitDbClient,
  identity: TenantIdentity,
  sessionId: string,
): Promise<Response> {
  const body = await jsonBody(request);
  rejectClientAuthority(body);
  const revisionExpected = expectedRevision(body);
  const requestIdempotencyKey = requiredString(body, "idempotencyKey");

  const context = await client.query(
    `SELECT
       s.submission_id,
       s.state AS session_state,
       sub.state AS submission_state,
       sub.revision AS submission_revision,
       v.qualification_policy_version_id,
       v.routing_policy_version_id,
       v.identity_policy_version_id,
       q.namespace AS qualification_namespace,
       q.version AS qualification_version,
       r.namespace AS routing_namespace,
       r.version AS routing_version
     FROM crm_intake_sessions s
     JOIN crm_intake_submissions sub
       ON sub.id = s.submission_id
      AND sub.tenant_id = s.tenant_id
     JOIN crm_intake_definition_versions v
       ON v.id = s.definition_version_id
      AND v.tenant_id = s.tenant_id
     JOIN crm_qualification_policy_versions q
       ON q.id = v.qualification_policy_version_id
      AND q.tenant_id = s.tenant_id
      AND q.status = 'ACTIVE'
     JOIN crm_routing_policy_versions r
       ON r.id = v.routing_policy_version_id
      AND r.tenant_id = s.tenant_id
      AND r.status = 'ACTIVE'
     WHERE s.id = $1::uuid
       AND s.tenant_id = $2::uuid
     LIMIT 1`,
    [sessionId, identity.orgId],
  );

  const contextRow = context.rows[0];
  if (!contextRow) {
    throw new ApiError(
      404,
      "SESSION_NOT_FOUND",
      "The intake session was not found or its policies are inactive.",
    );
  }
  if (
    String(contextRow["session_state"]) !== "ACTIVE" ||
    String(contextRow["submission_state"]) !== "IN_PROGRESS"
  ) {
    throw new ApiError(
      409,
      "INVALID_STATE_TRANSITION",
      "The intake submission cannot be submitted in its current state.",
    );
  }

  const submissionId = String(contextRow["submission_id"]);
  const currentRevision = Number(contextRow["submission_revision"]);
  if (currentRevision !== revisionExpected) {
    throw new ApiError(
      409,
      "STALE_REVISION",
      "Submission revision does not match.",
    );
  }

  const qualificationPolicy = `${String(contextRow["qualification_namespace"])}@${String(contextRow["qualification_version"])}`;
  const routingPolicy = `${String(contextRow["routing_namespace"])}@${String(contextRow["routing_version"])}`;
  if (
    qualificationPolicy !== "PROP-OPS-QUAL-001@1.0.0" ||
    routingPolicy !== "PROP-OPS-ROUTE-001@1.0.0"
  ) {
    throw new ApiError(
      409,
      "POLICY_VERSION_MISMATCH",
      "The active intake policy does not match the implemented oracle.",
    );
  }

  const answersResult = await client.query(
    `SELECT
       a.id, a.field_key, a.raw_value, a.normalized_value,
       a.epistemic_state, a.confirmed_by_human
     FROM crm_intake_answers a
     WHERE a.tenant_id = $1::uuid
       AND a.submission_id = $2::uuid
       AND NOT EXISTS (
         SELECT 1
         FROM crm_intake_answers successor
         WHERE successor.tenant_id = a.tenant_id
           AND successor.submission_id = a.submission_id
           AND successor.supersedes_answer_id = a.id
       )
     ORDER BY a.field_key, a.recorded_at DESC, a.id DESC`,
    [identity.orgId, submissionId],
  );
  const answers = answersResult.rows;

  const contradictionResult = await client.query(
    `SELECT id, severity, resolution_state
     FROM crm_intake_contradictions
     WHERE tenant_id = $1::uuid
       AND submission_id = $2::uuid`,
    [identity.orgId, submissionId],
  );
  const blockingContradiction = contradictionResult.rows.some(
    (row) =>
      String(row["severity"]) === "BLOCKING" &&
      !["CORRECTED", "CONFIRMED_VALID"].includes(
        String(row["resolution_state"]),
      ),
  );

  const evidenceResult = await client.query(
    `SELECT id
     FROM crm_intake_evidence
     WHERE tenant_id = $1::uuid
       AND submission_id = $2::uuid
       AND deleted_at IS NULL
     ORDER BY captured_at ASC, id ASC`,
    [identity.orgId, submissionId],
  );

  const answerByField = new Map(
    answers.map((row) => [String(row["field_key"]), row] as const),
  );
  const dimensions = dimensionsFromAnswers(answers);
  const economicBuyerKnown = factKnown(
    answerByField.get("buying.economic_buyer"),
  );
  const timelineKnown = factKnown(answerByField.get("buying.target_timeline"));
  const snapshot = {
    answers: answers.map((row) => ({
      id: row["id"],
      fieldKey: row["field_key"],
      value: presentValue(row),
      epistemicState: row["epistemic_state"],
      confirmedByHuman: row["confirmed_by_human"] === true,
    })),
    contradictionIds: contradictionResult.rows.map((row) => row["id"]),
    evidenceIds: evidenceResult.rows.map((row) => row["id"]),
  };
  const inputSnapshotHash = await sha256(snapshot);

  const identityRun = await client.query(
    `INSERT INTO crm_intake_identity_resolution_runs (
       tenant_id, submission_id, policy_version_id, result,
       duplicate_outcome, candidate_refs, input_snapshot_hash
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, 'PROVISIONAL',
       'NO_MATCH', '[]'::jsonb, $4
     )
     RETURNING id`,
    [
      identity.orgId,
      submissionId,
      String(contextRow["identity_policy_version_id"]),
      inputSnapshotHash,
    ],
  );
  if (!identityRun.rows[0]) {
    throw new ApiError(
      500,
      "IDENTITY_RESOLUTION_FAILED",
      "The provisional identity resolution record was not created.",
    );
  }

  const qualification = qualifyPropOps({
    dimensions,
    blockingContradiction,
    economicBuyerKnown,
    timelineKnown,
  });

  const evidenceIds = evidenceResult.rows.map((row) => String(row["id"]));
  const contradictionIds = contradictionResult.rows.map((row) =>
    String(row["id"]),
  );
  const qualificationInsert = await client.query(
    `INSERT INTO crm_intake_qualification_results (
       tenant_id, submission_id, policy_version_id, input_snapshot_hash,
       weighted_score, coverage, qualification_state, dimensions,
       evidence_refs, contradiction_refs, explanation
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4,
       $5, $6, $7, $8::jsonb,
       $9::uuid[], $10::uuid[], $11::jsonb
     )
     RETURNING id`,
    [
      identity.orgId,
      submissionId,
      String(contextRow["qualification_policy_version_id"]),
      inputSnapshotHash,
      qualification.score,
      qualification.coverage,
      qualification.state,
      JSON.stringify(qualification.dimensions),
      evidenceIds,
      contradictionIds,
      JSON.stringify({
        policy: qualification.policy,
        blockingContradiction,
        economicBuyerKnown,
        timelineKnown,
      }),
    ],
  );
  if (!qualificationInsert.rows[0]) {
    throw new ApiError(
      500,
      "QUALIFICATION_FAILED",
      "The qualification result was not persisted.",
    );
  }
  const qualificationResultId = String(qualificationInsert.rows[0]["id"]);

  const routing = routePropOps({
    qualification,
    dimensions,
    blockingContradiction,
  });
  const routingInsert = await client.query(
    `INSERT INTO crm_intake_routing_decisions (
       tenant_id, submission_id, qualification_result_id,
       policy_version_id, routing_state, matched_rule_id,
       input_snapshot_hash, explanation
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid,
       $4::uuid, $5, $6,
       $7, $8::jsonb
     )
     RETURNING id`,
    [
      identity.orgId,
      submissionId,
      qualificationResultId,
      String(contextRow["routing_policy_version_id"]),
      routing.state,
      routing.ruleId,
      inputSnapshotHash,
      JSON.stringify({ policy: routing.policy, commands: routing.commands }),
    ],
  );
  if (!routingInsert.rows[0]) {
    throw new ApiError(
      500,
      "ROUTING_FAILED",
      "The routing decision was not persisted.",
    );
  }
  const routingDecisionId = String(routingInsert.rows[0]["id"]);

  const commands = proposeIntakeCommands(
    {
      tenantId: identity.orgId,
      submissionId,
      routingDecisionId,
      policyVersionId: routing.policy,
    },
    routing,
  );

  for (const command of commands) {
    await client.query(
      `INSERT INTO crm_intake_commands (
         tenant_id, submission_id, routing_decision_id,
         command_type, command_version, target_context, payload,
         policy_version_id, idempotency_key, requires_human_approval, status
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid,
         $4, $5, $6, $7::jsonb,
         $8::uuid, $9, $10, 'PROPOSED'
       )
       RETURNING id`,
      [
        identity.orgId,
        submissionId,
        routingDecisionId,
        command.commandType,
        command.commandVersion,
        command.targetContext,
        JSON.stringify(command.payload),
        String(contextRow["routing_policy_version_id"]),
        command.idempotencyKey,
        command.requiresHumanApproval,
      ],
    );
  }

  const revision = await client.query(
    `UPDATE crm_intake_submissions
     SET state = 'SUBMITTED',
         revision = revision + 1,
         submitted_at = now(),
         submission_hash = $4,
         updated_at = now()
     WHERE id = $1::uuid
       AND tenant_id = $2::uuid
       AND revision = $3
       AND state = 'IN_PROGRESS'
     RETURNING revision`,
    [submissionId, identity.orgId, revisionExpected, inputSnapshotHash],
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
    `UPDATE crm_intake_sessions
     SET state = 'COMPLETED',
         revision = revision + 1,
         last_activity_at = now(),
         ended_at = now()
     WHERE id = $1::uuid
       AND tenant_id = $2::uuid
       AND state = 'ACTIVE'`,
    [sessionId, identity.orgId],
  );

  await insertOutbox(
    client,
    identity,
    submissionId,
    "IdentityResolutionCompleted",
    { result: "PROVISIONAL", inputSnapshotHash },
    `IdentityResolutionCompleted:${submissionId}:${requestIdempotencyKey}`,
  );
  await insertOutbox(
    client,
    identity,
    submissionId,
    "QualificationComputed",
    {
      qualificationResultId,
      state: qualification.state,
      score: qualification.score,
      coverage: qualification.coverage,
    },
    `QualificationComputed:${submissionId}:${requestIdempotencyKey}`,
  );
  await insertOutbox(
    client,
    identity,
    submissionId,
    "RoutingDecisionCreated",
    {
      routingDecisionId,
      state: routing.state,
      ruleId: routing.ruleId,
    },
    `RoutingDecisionCreated:${submissionId}:${requestIdempotencyKey}`,
  );
  for (const command of commands) {
    await insertOutbox(
      client,
      identity,
      submissionId,
      "CommandProposed",
      {
        routingDecisionId,
        commandType: command.commandType,
        requiresHumanApproval: command.requiresHumanApproval,
      },
      `CommandProposed:${submissionId}:${command.idempotencyKey}`,
    );
  }
  await insertOutbox(
    client,
    identity,
    submissionId,
    "SubmissionSubmitted",
    { revision: newRevision, inputSnapshotHash },
    `SubmissionSubmitted:${submissionId}:${requestIdempotencyKey}`,
  );

  return jsonResponse({
    ok: true,
    submissionId,
    state: "SUBMITTED",
    revision: newRevision,
    identityResolution: "PROVISIONAL",
    qualification: {
      state: qualification.state,
      score: qualification.score,
      coverage: qualification.coverage,
    },
    routing: {
      state: routing.state,
      ruleId: routing.ruleId,
    },
    proposedCommands: commands.map((command) => ({
      type: command.commandType,
      status: command.status,
      requiresHumanApproval: command.requiresHumanApproval,
    })),
  });
}

export async function handleCrmIntakeSubmitApiWithTransaction(
  request: Request,
  rawEnv: unknown,
  transactionRunner: IntakeSubmitTransactionRunner,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  const match = /^\/api\/crm\/intake-sessions\/([^/]+)\/submit$/.exec(pathname);
  if (!match) return null;

  try {
    if (request.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Only POST is supported.");
    }
    const sessionId = pathUuid(match[1]!, "sessionId");
    return await transactionRunner(request, rawEnv, (client, identity) =>
      submitIntake(request, client, identity, sessionId),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleCrmIntakeSubmitApi(
  request: Request,
  rawEnv: unknown,
): Promise<Response | null> {
  return handleCrmIntakeSubmitApiWithTransaction(
    request,
    rawEnv,
    productionRunner,
  );
}
