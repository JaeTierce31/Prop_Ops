import { describe, expect, it } from "vitest";

import {
  authorize,
  type AuthoritativeActor,
  type AuthoritativeResource,
  type AuthorizationInput,
} from "../security/authz-oracle";

const ORG_A = "org-a";
const ORG_B = "org-b";
const PROPERTY_A = "property-a";
const PROPERTY_B = "property-b";
const UNIT_A = "unit-a";
const UNIT_B = "unit-b";

const actors = {
  residentA: {
    userId: "resident-a",
    orgId: ORG_A,
    membershipActive: true,
    roles: ["resident"],
    propertyIds: [PROPERTY_A],
    unitIds: [UNIT_A],
  },
  residentB: {
    userId: "resident-b",
    orgId: ORG_A,
    membershipActive: true,
    roles: ["resident"],
    propertyIds: [PROPERTY_A],
    unitIds: [UNIT_B],
  },
  managerA: {
    userId: "manager-a",
    orgId: ORG_A,
    membershipActive: true,
    roles: ["manager"],
    propertyIds: [PROPERTY_A],
    unitIds: [],
  },
  workerA: {
    userId: "worker-a",
    orgId: ORG_A,
    membershipActive: true,
    roles: ["worker"],
    propertyIds: [PROPERTY_A],
    unitIds: [],
  },
  opsA: {
    userId: "ops-a",
    orgId: ORG_A,
    membershipActive: true,
    roles: ["ops"],
    propertyIds: [],
    unitIds: [],
  },
} satisfies Record<string, AuthoritativeActor>;

const resources = {
  residentACase: {
    orgId: ORG_A,
    propertyId: PROPERTY_A,
    unitId: UNIT_A,
    residentUserId: "resident-a",
    assignedWorkerUserId: "worker-a",
  },
  residentBCase: {
    orgId: ORG_A,
    propertyId: PROPERTY_A,
    unitId: UNIT_B,
    residentUserId: "resident-b",
    assignedWorkerUserId: "worker-b",
  },
  propertyBCase: {
    orgId: ORG_A,
    propertyId: PROPERTY_B,
    unitId: "unit-c",
    residentUserId: "resident-c",
    assignedWorkerUserId: "worker-c",
  },
  orgBCase: {
    orgId: ORG_B,
    propertyId: "property-c",
    unitId: "unit-d",
    residentUserId: "resident-d",
    assignedWorkerUserId: "worker-d",
  },
} satisfies Record<string, AuthoritativeResource>;

function decide(
  actor: AuthoritativeActor,
  resource: AuthoritativeResource,
  operation: AuthorizationInput["operation"] = "case.read",
  untrusted?: AuthorizationInput["untrusted"],
) {
  return authorize(
    untrusted
      ? { actor, resource, operation, untrusted }
      : { actor, resource, operation },
  );
}

describe("J3S-AUTHZ-ORACLE-001", () => {
  it("allows a resident to access the resident-of-record case in the scoped unit", () => {
    expect(decide(actors.residentA, resources.residentACase)).toMatchObject({
      allow: true,
      reason: "ALLOW_RESIDENT_SCOPE",
    });
  });

  it("denies horizontal cross-unit resident access", () => {
    expect(decide(actors.residentA, resources.residentBCase)).toMatchObject({
      allow: false,
      reason: "DENY_SCOPE",
    });
  });

  it("allows a manager only inside authoritative property scope", () => {
    expect(decide(actors.managerA, resources.residentACase).allow).toBe(true);
    expect(decide(actors.managerA, resources.propertyBCase)).toMatchObject({
      allow: false,
      reason: "DENY_SCOPE",
    });
  });

  it("allows only the assigned worker", () => {
    expect(decide(actors.workerA, resources.residentACase)).toMatchObject({
      allow: true,
      reason: "ALLOW_WORKER_ASSIGNMENT",
    });
    expect(decide(actors.workerA, resources.residentBCase)).toMatchObject({
      allow: false,
      reason: "DENY_SCOPE",
    });
  });

  it("fails closed when membership is inactive", () => {
    expect(
      decide(
        { ...actors.managerA, membershipActive: false },
        resources.residentACase,
      ),
    ).toMatchObject({ allow: false, reason: "DENY_INACTIVE_MEMBERSHIP" });
  });

  it("denies cross-organization access before evaluating role or resource scope", () => {
    expect(decide(actors.opsA, resources.orgBCase)).toMatchObject({
      allow: false,
      reason: "DENY_ORG_MISMATCH",
    });
  });

  it("proves forged request hints cannot alter a denial", () => {
    const baseline = decide(actors.residentA, resources.residentBCase);
    const forged = decide(
      actors.residentA,
      resources.residentBCase,
      "case.read",
      {
        role: "ops",
        orgId: ORG_A,
        propertyId: PROPERTY_A,
        unitId: UNIT_A,
      },
    );

    expect(baseline.allow).toBe(false);
    expect(forged).toEqual(baseline);
  });

  it("proves forged request hints cannot alter an allow", () => {
    const baseline = decide(actors.managerA, resources.residentACase);
    const forged = decide(
      actors.managerA,
      resources.residentACase,
      "case.read",
      {
        role: "resident",
        orgId: ORG_B,
        propertyId: PROPERTY_B,
        unitId: UNIT_B,
      },
    );

    expect(baseline.allow).toBe(true);
    expect(forged).toEqual(baseline);
  });

  it("allows self membership visibility but denies unrelated membership visibility", () => {
    expect(
      decide(
        actors.residentA,
        { orgId: ORG_A, membershipUserId: actors.residentA.userId },
        "membership.read",
      ).allow,
    ).toBe(true);

    expect(
      decide(
        actors.residentA,
        { orgId: ORG_A, membershipUserId: actors.residentB.userId },
        "membership.read",
      ).allow,
    ).toBe(false);
  });

  it("permits scoped managers to read memberships in their property", () => {
    expect(
      decide(
        actors.managerA,
        {
          orgId: ORG_A,
          propertyId: PROPERTY_A,
          membershipUserId: actors.residentA.userId,
        },
        "membership.read",
      ),
    ).toMatchObject({ allow: true, reason: "ALLOW_MANAGER_SCOPE" });
  });

  it("keeps direct outbox read ops-only", () => {
    expect(
      decide(actors.managerA, { orgId: ORG_A }, "outbox.read"),
    ).toMatchObject({ allow: false, reason: "DENY_OUTBOX_READ" });
    expect(decide(actors.opsA, { orgId: ORG_A }, "outbox.read").allow).toBe(
      true,
    );
  });

  it("allows the bounded same-org outbox enqueue bridge for active members", () => {
    expect(
      decide(actors.workerA, { orgId: ORG_A }, "outbox.enqueue"),
    ).toMatchObject({ allow: true, reason: "ALLOW_OUTBOX_ENQUEUE" });

    expect(
      decide(
        { ...actors.workerA, membershipActive: false },
        { orgId: ORG_A },
        "outbox.enqueue",
      ).allow,
    ).toBe(false);
  });

  it("denies same-role cross-property IDOR even when the client claims the target property", () => {
    const result = decide(
      actors.managerA,
      resources.propertyBCase,
      "case.mutate",
      { role: "manager", propertyId: PROPERTY_B },
    );

    expect(result).toMatchObject({ allow: false, reason: "DENY_SCOPE" });
  });

  it("keeps work-order authorization aligned with case scope", () => {
    expect(
      decide(actors.workerA, resources.residentACase, "work_order.mutate")
        .allow,
    ).toBe(true);
    expect(
      decide(actors.workerA, resources.residentBCase, "work_order.mutate")
        .allow,
    ).toBe(false);
  });
});
