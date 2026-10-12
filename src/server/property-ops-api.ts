import type { ClientBase } from "@neondatabase/serverless";

import {
  ACTORS,
  MAIN_CASE_ID,
  POLICY,
  dispatch,
  seedState,
  type Action,
  type Actor,
  type DemoState,
  type Role,
} from "../domain/model";
import {
  ApiError,
  apiErrorResponse,
  jsonResponse,
  requireEnv,
  withTenantTransaction,
  type RuntimeEnv,
  type TenantIdentity,
} from "./data-auth";

interface AggregateRow {
  state: DemoState;
  version: string | number;
}

interface ActionBody {
  action?: unknown;
  expectedVersion?: unknown;
}

function isAction(value: unknown): value is Action {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === "string" && type in POLICY;
}

function parseExpectedVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new ApiError(
      400,
      "EXPECTED_VERSION_REQUIRED",
      "expectedVersion must be a positive integer.",
    );
  }
  return Number(value);
}

function roleForAction(identity: TenantIdentity, action: Action): Role {
  const validRoles = identity.roles.filter((role): role is Role =>
    ["resident", "manager", "worker", "ops"].includes(role),
  );
  const policyRoles = POLICY[action.type].roles;
  const eligible = validRoles.filter((role) => policyRoles.includes(role));

  if (eligible.length === 1) return eligible[0]!;
  if (validRoles.length === 1) return validRoles[0]!;
  if (eligible.length > 1) {
    throw new ApiError(
      409,
      "ROLE_AMBIGUOUS",
      "Multiple authorized roles are available for this action; split the identity into explicit operational memberships before pilot use.",
    );
  }
  return validRoles[0] ?? "ops";
}

function actorForAction(
  identity: TenantIdentity,
  action: Action,
  current: DemoState,
): Actor {
  if (action.type === "AI_NORMALIZE") {
    const target = current.cases[action.caseId];
    if (
      !identity.roles.includes("resident") ||
      !target ||
      target.residentId !== identity.domainActorId
    ) {
      return {
        id: identity.domainActorId,
        name: identity.domainActorId,
        role: roleForAction(identity, action),
      };
    }
    return ACTORS.ai;
  }

  return {
    id: identity.domainActorId,
    name: identity.domainActorId,
    role: roleForAction(identity, action),
  };
}

async function loadAggregate(
  client: ClientBase,
  casePublicId: string,
  forUpdate: boolean,
): Promise<{ state: DemoState; version: number }> {
  const result = await client.query<AggregateRow>(
    `SELECT state, version
       FROM prop_ops.case_aggregate_state
      WHERE case_public_id = $1
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [casePublicId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new ApiError(
      404,
      "STATE_NOT_FOUND",
      "No canonical server state exists for this case.",
    );
  }
  return { state: row.state, version: Number(row.version) };
}

async function appendAuthoritativeAudit(
  client: ClientBase,
  identity: TenantIdentity,
  action: Action,
  actor: Actor,
  ok: boolean,
  reason: string | undefined,
  aggregateVersion: number,
): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [identity.orgId]);
  const last = await client.query<{ seq: string | number; event_hash: string }>(
    `SELECT seq, event_hash
       FROM prop_ops.audit_events
      WHERE org_id = $1
      ORDER BY seq DESC
      LIMIT 1`,
    [identity.orgId],
  );
  const previous = last.rows[0];
  const seq = previous ? Number(previous.seq) + 1 : 1;
  const prevHash = previous?.event_hash ?? "GENESIS";
  const entityId =
    "caseId" in action
      ? action.caseId
      : "woId" in action
        ? action.woId
        : "effectId" in action
          ? action.effectId
          : MAIN_CASE_ID;
  const payload = {
    action,
    authenticatedSubject: identity.authSubject,
    domainActorId: actor.id,
    aggregateVersion,
    reason: reason ?? null,
  };

  await client.query(
    `INSERT INTO prop_ops.audit_events (
       org_id, seq, actor_user_id, actor_subject, actor_role,
       action, entity_type, entity_id, authority, outcome, note,
       prev_hash, event_hash, payload
     )
     VALUES (
       $1, $2, $3, $4, $5,
       $6, 'CASE', $7, $8, $9, $10,
       $11,
       prop_ops.sha256_hex($11 || ($12::jsonb)::text),
       $12::jsonb
     )`,
    [
      identity.orgId,
      seq,
      identity.userId,
      identity.authSubject,
      actor.role,
      action.type,
      entityId,
      POLICY[action.type].authority,
      ok ? "OK" : "DENIED",
      reason ?? null,
      prevHash,
      JSON.stringify(payload),
    ],
  );
}

async function projectCase(
  client: ClientBase,
  state: DemoState,
  aggregateVersion: number,
): Promise<void> {
  const current = state.cases[MAIN_CASE_ID];
  if (!current) return;

  await client.query(
    `UPDATE prop_ops.cases
        SET status = $2,
            title = $3,
            report_text = $4,
            summary = $5::jsonb,
            summary_confirmed = $6,
            severity = $7,
            sla_hours = $8,
            sla_due_at = CASE WHEN $9::bigint IS NULL THEN NULL ELSE to_timestamp($9::bigint / 1000.0) END,
            resident_outcome = $10,
            dispute_reason = $11,
            version = $12,
            updated_at = now()
      WHERE public_id = $1`,
    [
      current.id,
      current.status,
      current.title,
      current.reportText ?? null,
      current.summary ? JSON.stringify(current.summary) : null,
      current.summaryConfirmed,
      current.severity ?? null,
      current.slaHours ?? null,
      current.slaDueAt ?? null,
      current.residentOutcome ?? null,
      current.disputeReason ?? null,
      aggregateVersion,
    ],
  );
}

async function enqueueCommittedAction(
  client: ClientBase,
  identity: TenantIdentity,
  action: Action,
  aggregateVersion: number,
): Promise<void> {
  const dedupeKey = `${MAIN_CASE_ID}:${aggregateVersion}:${action.type}`;
  await client.query(
    `INSERT INTO prop_ops.outbox (
       org_id, aggregate_type, aggregate_id, event_type, payload, dedupe_key
     )
     SELECT $1, 'CASE', c.id, 'DOMAIN_ACTION_COMMITTED', $2::jsonb, $3
       FROM prop_ops.cases c
      WHERE c.public_id = $4
     ON CONFLICT (org_id, dedupe_key) DO NOTHING`,
    [
      identity.orgId,
      JSON.stringify({ action, aggregateVersion }),
      dedupeKey,
      MAIN_CASE_ID,
    ],
  );
}

async function readJson(request: Request): Promise<ActionBody> {
  try {
    return (await request.json()) as ActionBody;
  } catch {
    throw new ApiError(400, "JSON_INVALID", "Request body must be valid JSON.");
  }
}

async function session(request: Request, env: unknown): Promise<Response> {
  const result = await withTenantTransaction(request, env, async (_client, identity) => ({
    ok: true,
    identity: {
      userId: identity.userId,
      domainActorId: identity.domainActorId,
      orgId: identity.orgId,
      roles: identity.roles,
      propertyIds: identity.propertyIds,
      unitIds: identity.unitIds,
    },
  }));
  return jsonResponse(result);
}

async function state(request: Request, env: unknown): Promise<Response> {
  const result = await withTenantTransaction(request, env, async (client, identity) => {
    const aggregate = await loadAggregate(client, MAIN_CASE_ID, false);
    return {
      ok: true,
      state: aggregate.state,
      version: aggregate.version,
      identity: {
        domainActorId: identity.domainActorId,
        roles: identity.roles,
        orgId: identity.orgId,
      },
    };
  });
  return jsonResponse(result);
}

async function bootstrap(request: Request, rawEnv: unknown): Promise<Response> {
  const result = await withTenantTransaction(request, rawEnv, async (client, identity, env) => {
    if (requireEnv(env, "PROP_OPS_ALLOW_SYNTHETIC_BOOTSTRAP") !== "true") {
      throw new ApiError(404, "NOT_FOUND", "Not found.");
    }
    if (!identity.roles.includes("ops")) {
      throw new ApiError(403, "OPS_REQUIRED", "Ops authority is required.");
    }

    const syntheticOrg = requireEnv(env, "PROP_OPS_SYNTHETIC_ORG_ID");
    if (identity.orgId !== syntheticOrg) {
      throw new ApiError(403, "SYNTHETIC_ONLY", "Bootstrap is restricted to the synthetic tenant.");
    }

    const seeded = seedState(Date.now());
    const inserted = await client.query<AggregateRow>(
      `INSERT INTO prop_ops.case_aggregate_state (org_id, case_public_id, state, version)
       VALUES ($1, $2, $3::jsonb, 1)
       ON CONFLICT (org_id, case_public_id) DO NOTHING
       RETURNING state, version`,
      [identity.orgId, MAIN_CASE_ID, JSON.stringify(seeded)],
    );
    const aggregate = inserted.rows[0] ?? (await loadAggregate(client, MAIN_CASE_ID, false));
    return {
      ok: true,
      state: "state" in aggregate ? aggregate.state : aggregate,
      version: Number("version" in aggregate ? aggregate.version : 1),
    };
  });
  return jsonResponse(result, 201);
}

async function mutate(request: Request, env: unknown): Promise<Response> {
  const body = await readJson(request);
  if (!isAction(body.action)) {
    throw new ApiError(400, "ACTION_INVALID", "A recognized domain action is required.");
  }
  const expectedVersion = parseExpectedVersion(body.expectedVersion);

  const result = await withTenantTransaction(request, env, async (client, identity) => {
    const aggregate = await loadAggregate(client, MAIN_CASE_ID, true);
    if (aggregate.version !== expectedVersion) {
      throw new ApiError(
        409,
        "VERSION_CONFLICT",
        `Expected version ${expectedVersion}, current version is ${aggregate.version}.`,
      );
    }

    const actor = actorForAction(identity, body.action!, aggregate.state);
    const now = Date.now();
    const transition = dispatch(aggregate.state, body.action!, actor, now);
    const nextVersion = aggregate.version + 1;

    const updated = await client.query(
      `UPDATE prop_ops.case_aggregate_state
          SET state = $1::jsonb,
              version = $2,
              updated_at = now()
        WHERE case_public_id = $3
          AND version = $4
        RETURNING version`,
      [
        JSON.stringify(transition.state),
        nextVersion,
        MAIN_CASE_ID,
        aggregate.version,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new ApiError(409, "VERSION_CONFLICT", "Canonical state changed concurrently.");
    }

    await projectCase(client, transition.state, nextVersion);
    await appendAuthoritativeAudit(
      client,
      identity,
      body.action!,
      actor,
      transition.ok,
      transition.reason,
      nextVersion,
    );
    if (transition.ok) {
      await enqueueCommittedAction(client, identity, body.action!, nextVersion);
    }

    return {
      ok: transition.ok,
      reason: transition.reason,
      state: transition.state,
      version: nextVersion,
    };
  });

  return jsonResponse(result);
}

export async function handlePropertyOpsApi(
  request: Request,
  env: unknown,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/property-ops/")) return null;

  try {
    if (url.pathname === "/api/property-ops/session" && request.method === "GET") {
      return await session(request, env);
    }
    if (url.pathname === "/api/property-ops/state" && request.method === "GET") {
      return await state(request, env);
    }
    if (url.pathname === "/api/property-ops/bootstrap" && request.method === "POST") {
      return await bootstrap(request, env);
    }
    if (url.pathname === "/api/property-ops/action" && request.method === "POST") {
      return await mutate(request, env);
    }
    return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
