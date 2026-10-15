import { Client, type ClientBase } from "@neondatabase/serverless";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type RuntimeEnv = Record<string, unknown>;

export interface TenantIdentity {
  authSubject: string;
  userId: string;
  domainActorId: string;
  orgId: string;
  roles: string[];
  propertyIds: string[];
  unitIds: string[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function readEnv(env: RuntimeEnv, key: string): string | undefined {
  const fromBinding = env[key];
  if (typeof fromBinding === "string" && fromBinding.length > 0) {
    return fromBinding;
  }
  if (typeof process !== "undefined") {
    const fromProcess = process.env[key];
    if (typeof fromProcess === "string" && fromProcess.length > 0) {
      return fromProcess;
    }
  }
  return undefined;
}

export function requireEnv(env: RuntimeEnv, key: string): string {
  const value = readEnv(env, key);
  if (!value) {
    throw new ApiError(503, "CONFIG_MISSING", `${key} is not configured.`);
  }
  return value;
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) {
    throw new ApiError(
      401,
      "AUTH_REQUIRED",
      "A Bearer access token is required.",
    );
  }
  return match[1];
}

async function verifyAccessToken(
  request: Request,
  env: RuntimeEnv,
): Promise<string> {
  const token = bearerToken(request);
  const jwksUrl = requireEnv(env, "AUTH_JWKS_URL");
  const issuer = requireEnv(env, "AUTH_ISSUER");
  const audience = readEnv(env, "AUTH_AUDIENCE");

  let jwks = jwksCache.get(jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
    jwksCache.set(jwksUrl, jwks);
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      ...(audience ? { audience } : {}),
    });
    if (!payload.sub) {
      throw new ApiError(
        401,
        "AUTH_SUBJECT_MISSING",
        "Token subject is missing.",
      );
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      401,
      "AUTH_INVALID",
      "The access token is invalid or expired.",
    );
  }
}

function requestedOrgId(request: Request): string | null {
  const value = request.headers.get("x-prop-ops-org")?.trim();
  if (!value) return null;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new ApiError(400, "ORG_INVALID", "x-prop-ops-org must be a UUID.");
  }
  return value;
}

interface IdentityRow {
  user_id: string;
  domain_actor_id: string | null;
  org_id: string;
  roles: string[];
  property_ids: string[] | null;
  unit_ids: string[] | null;
}

async function resolveIdentity(
  client: ClientBase,
  authSubject: string,
  explicitOrgId: string | null,
): Promise<TenantIdentity> {
  const result = await client.query<IdentityRow>(
    `SELECT * FROM prop_ops.resolve_identity_v2($1, $2::uuid)`,
    [authSubject, explicitOrgId],
  );

  if (result.rows.length === 0) {
    throw new ApiError(
      403,
      "MEMBERSHIP_REQUIRED",
      "No active Property Ops membership was found.",
    );
  }
  if (!explicitOrgId && result.rows.length !== 1) {
    throw new ApiError(
      409,
      "ORG_AMBIGUOUS",
      "Multiple organizations are available; explicitly select one.",
    );
  }

  const row = result.rows[0]!;
  if (!row.domain_actor_id) {
    throw new ApiError(
      403,
      "DOMAIN_ACTOR_UNBOUND",
      "The authenticated identity is not bound to a governed domain actor.",
    );
  }

  return {
    authSubject,
    userId: row.user_id,
    domainActorId: row.domain_actor_id,
    orgId: row.org_id,
    roles: row.roles ?? [],
    propertyIds: row.property_ids ?? [],
    unitIds: row.unit_ids ?? [],
  };
}

function sessionScope(identity: TenantIdentity): [string, string, string] {
  return [
    identity.roles.join(","),
    identity.propertyIds.join(","),
    identity.unitIds.join(","),
  ];
}

export async function withTenantTransaction<T>(
  request: Request,
  rawEnv: unknown,
  operation: (
    client: ClientBase,
    identity: TenantIdentity,
    env: RuntimeEnv,
  ) => Promise<T>,
): Promise<T> {
  const env =
    rawEnv && typeof rawEnv === "object"
      ? (rawEnv as RuntimeEnv)
      : ({} as RuntimeEnv);
  const authSubject = await verifyAccessToken(request, env);
  const explicitOrgId = requestedOrgId(request);
  const databaseUrl = requireEnv(env, "DATABASE_URL");

  const client = new Client(databaseUrl);
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE prop_ops_app");

    const identity = await resolveIdentity(client, authSubject, explicitOrgId);
    const [roles, propertyIds, unitIds] = sessionScope(identity);

    await client.query(
      `SELECT
         set_config('app.user_id', $1, true),
         set_config('app.org_id', $2, true),
         set_config('app.roles', $3, true),
         set_config('app.property_ids', $4, true),
         set_config('app.unit_ids', $5, true)`,
      [identity.userId, identity.orgId, roles, propertyIds, unitIds],
    );

    const result = await operation(client, identity, env);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original failure. The connection is closed below.
    }
    throw error;
  } finally {
    await client.end();
  }
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonResponse(
      {
        ok: false,
        error: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      error.status,
    );
  }
  console.error(error);
  return jsonResponse(
    {
      ok: false,
      error: "INTERNAL_ERROR",
      message: "The request could not be completed.",
    },
    500,
  );
}
