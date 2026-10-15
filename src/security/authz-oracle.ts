export type AuthzRole = "resident" | "manager" | "worker" | "ops";

export type AuthzOperation =
  | "case.read"
  | "case.mutate"
  | "work_order.read"
  | "work_order.mutate"
  | "membership.read"
  | "outbox.enqueue"
  | "outbox.read";

export interface AuthoritativeActor {
  userId: string;
  orgId: string;
  membershipActive: boolean;
  roles: AuthzRole[];
  propertyIds: string[];
  unitIds: string[];
}

export interface AuthoritativeResource {
  orgId: string;
  propertyId?: string;
  unitId?: string;
  residentUserId?: string;
  assignedWorkerUserId?: string;
  membershipUserId?: string;
}

export interface UntrustedRequestHints {
  role?: string;
  orgId?: string;
  propertyId?: string;
  unitId?: string;
}

export interface AuthorizationInput {
  actor: AuthoritativeActor;
  operation: AuthzOperation;
  resource: AuthoritativeResource;
  /**
   * Client-controlled values are carried only so regression tests can prove
   * that changing them cannot change the authorization result. The oracle
   * MUST NOT use this object to grant authority.
   */
  untrusted?: UntrustedRequestHints;
}

export interface AuthorizationDecision {
  allow: boolean;
  reason:
    | "ALLOW_OPS"
    | "ALLOW_MANAGER_SCOPE"
    | "ALLOW_RESIDENT_SCOPE"
    | "ALLOW_WORKER_ASSIGNMENT"
    | "ALLOW_SELF_MEMBERSHIP"
    | "ALLOW_OUTBOX_ENQUEUE"
    | "DENY_INACTIVE_MEMBERSHIP"
    | "DENY_ORG_MISMATCH"
    | "DENY_ROLE"
    | "DENY_SCOPE"
    | "DENY_OUTBOX_READ";
}

function hasRole(actor: AuthoritativeActor, role: AuthzRole): boolean {
  return actor.roles.includes(role);
}

function inPropertyScope(
  actor: AuthoritativeActor,
  resource: AuthoritativeResource,
): boolean {
  return Boolean(
    resource.propertyId && actor.propertyIds.includes(resource.propertyId),
  );
}

function inUnitScope(
  actor: AuthoritativeActor,
  resource: AuthoritativeResource,
): boolean {
  return Boolean(resource.unitId && actor.unitIds.includes(resource.unitId));
}

function residentOwnsResource(
  actor: AuthoritativeActor,
  resource: AuthoritativeResource,
): boolean {
  return (
    hasRole(actor, "resident") &&
    resource.residentUserId === actor.userId &&
    inUnitScope(actor, resource)
  );
}

function workerAssigned(
  actor: AuthoritativeActor,
  resource: AuthoritativeResource,
): boolean {
  return (
    hasRole(actor, "worker") && resource.assignedWorkerUserId === actor.userId
  );
}

function managerScoped(
  actor: AuthoritativeActor,
  resource: AuthoritativeResource,
): boolean {
  return hasRole(actor, "manager") && inPropertyScope(actor, resource);
}

function baseDeny(input: AuthorizationInput): AuthorizationDecision | null {
  if (!input.actor.membershipActive) {
    return { allow: false, reason: "DENY_INACTIVE_MEMBERSHIP" };
  }

  if (input.actor.orgId !== input.resource.orgId) {
    return { allow: false, reason: "DENY_ORG_MISMATCH" };
  }

  return null;
}

/**
 * J3S-AUTHZ-ORACLE-001
 *
 * Implementation-independent policy oracle for authorization regression tests.
 * The decision is intentionally derived only from authoritative actor/resource
 * state. Client-provided role, org, property, or unit hints never grant access.
 */
export function authorize(input: AuthorizationInput): AuthorizationDecision {
  const denied = baseDeny(input);
  if (denied) return denied;

  const { actor, operation, resource } = input;

  if (hasRole(actor, "ops")) {
    if (operation === "outbox.read") {
      return { allow: true, reason: "ALLOW_OPS" };
    }
    return { allow: true, reason: "ALLOW_OPS" };
  }

  if (operation === "outbox.read") {
    return { allow: false, reason: "DENY_OUTBOX_READ" };
  }

  if (operation === "outbox.enqueue") {
    // Mirrors the bounded SECURITY DEFINER bridge: active same-org membership
    // may enqueue a domain effect after the surrounding domain mutation has
    // already been authorized. This does not grant direct outbox visibility.
    return { allow: true, reason: "ALLOW_OUTBOX_ENQUEUE" };
  }

  if (operation === "membership.read") {
    if (resource.membershipUserId === actor.userId) {
      return { allow: true, reason: "ALLOW_SELF_MEMBERSHIP" };
    }
    if (managerScoped(actor, resource)) {
      return { allow: true, reason: "ALLOW_MANAGER_SCOPE" };
    }
    return { allow: false, reason: "DENY_SCOPE" };
  }

  if (operation === "case.read" || operation === "case.mutate") {
    if (managerScoped(actor, resource)) {
      return { allow: true, reason: "ALLOW_MANAGER_SCOPE" };
    }
    if (residentOwnsResource(actor, resource)) {
      return { allow: true, reason: "ALLOW_RESIDENT_SCOPE" };
    }
    if (workerAssigned(actor, resource)) {
      return { allow: true, reason: "ALLOW_WORKER_ASSIGNMENT" };
    }
    if (
      hasRole(actor, "resident") ||
      hasRole(actor, "manager") ||
      hasRole(actor, "worker")
    ) {
      return { allow: false, reason: "DENY_SCOPE" };
    }
    return { allow: false, reason: "DENY_ROLE" };
  }

  if (operation === "work_order.read" || operation === "work_order.mutate") {
    if (managerScoped(actor, resource)) {
      return { allow: true, reason: "ALLOW_MANAGER_SCOPE" };
    }
    if (residentOwnsResource(actor, resource)) {
      return { allow: true, reason: "ALLOW_RESIDENT_SCOPE" };
    }
    if (workerAssigned(actor, resource)) {
      return { allow: true, reason: "ALLOW_WORKER_ASSIGNMENT" };
    }
    if (
      hasRole(actor, "resident") ||
      hasRole(actor, "manager") ||
      hasRole(actor, "worker")
    ) {
      return { allow: false, reason: "DENY_SCOPE" };
    }
    return { allow: false, reason: "DENY_ROLE" };
  }

  return { allow: false, reason: "DENY_ROLE" };
}
