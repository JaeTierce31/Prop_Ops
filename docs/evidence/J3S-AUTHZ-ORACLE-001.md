# J3S-AUTHZ-ORACLE-001

**Parent:** `PROP-OPS-AUTHZ-HARDEN-001`  
**Branch:** `j3s-authz-oracle-001`  
**Status:** CANDIDATE / verification required  
**Purpose:** Establish one implementation-independent authorization truth model that can be executed against application policy, PostgreSQL RLS behavior, and protected API behavior without allowing client-controlled authority inputs to alter the decision.

## Governing rule

Authentication establishes a subject/session. Authorization is derived from authoritative server/database state.

The following request-controlled values MUST NOT grant authority:

- role headers or body fields;
- organization selectors;
- property selectors;
- unit selectors;
- custom client claims that are not independently resolved against authoritative membership state.

Changing those values while authenticated subject and authoritative database state remain constant MUST NOT change the authorization decision.

## Decision tuple

The oracle uses an AuthZEN-compatible conceptual shape:

`subject + action + resource + context -> decision`

The current implementation intentionally keeps policy evaluation in-process. No remote PDP is introduced by this artifact.

### Subject / actor

Authoritative actor state contains:

- `userId`
- `orgId`
- active membership state
- resolved role set
- resolved property scope
- resolved unit scope

### Resource

Authoritative resource state may contain:

- `orgId`
- `propertyId`
- `unitId`
- resident-of-record user
- assigned worker user
- membership owner

### Operations

Initial oracle operations:

- `case.read`
- `case.mutate`
- `work_order.read`
- `work_order.mutate`
- `membership.read`
- `outbox.enqueue`
- `outbox.read`

## Invariants

### AO-001 — active membership

Inactive membership MUST deny before role or resource scope is evaluated.

### AO-002 — organization boundary

Actor organization and resource organization MUST match. Cross-organization access MUST deny even for an `ops` role scoped to another organization.

### AO-003 — resident scope

Resident access requires both:

1. resident-of-record equality; and
2. authoritative unit scope membership.

Possession of an object identifier is insufficient.

### AO-004 — manager scope

Manager access requires authoritative property scope membership.

### AO-005 — worker assignment

Worker access requires authoritative assignment of the work order/case to the authenticated database user.

### AO-006 — membership visibility

Membership visibility is limited to self, organization ops, or a manager whose authoritative property scope contains the membership property.

### AO-007 — outbox visibility

Direct outbox read remains ops-only.

### AO-008 — bounded outbox enqueue

An active same-organization member may call the bounded enqueue bridge only after the surrounding domain mutation has independently passed authorization. The bridge does not grant direct outbox visibility.

### AO-009 — untrusted-input noninterference

Changing client-provided role/org/property/unit hints MUST NOT alter an authorization result when authoritative actor/resource state is unchanged.

This is the core DB-derived-authority regression invariant.

## Current executable fixture set

The initial Vitest suite proves:

1. resident own-unit allow;
2. cross-unit resident denial;
3. manager in-property allow;
4. cross-property manager denial;
5. assigned-worker allow;
6. unassigned-worker denial;
7. inactive-membership fail-closed behavior;
8. cross-organization denial;
9. forged role/org/property/unit hints cannot turn DENY into ALLOW;
10. forged hints cannot turn ALLOW into DENY;
11. self-only resident membership visibility;
12. scoped-manager membership visibility;
13. direct non-ops outbox read denial;
14. bounded same-org outbox enqueue for active membership;
15. cross-property IDOR denial despite a forged target-property claim;
16. case/work-order scope alignment.

## Required adapters before gate promotion

This oracle is not sufficient evidence by itself. AUTHZ-HARDEN remains PARTIAL until the same decisions are proven at three execution layers.

### A. Application adapter

For each fixture, exercise the application authorization path and compare the result to the oracle.

Required property:

`application_decision == oracle_decision`

### B. PostgreSQL/RLS adapter

Seed equivalent actor/resource state, set only server-derived transaction context, execute SELECT/INSERT/UPDATE operations, and compare database allow/deny behavior to the oracle.

Required coverage:

- SELECT visibility;
- INSERT `WITH CHECK` semantics;
- UPDATE source-row `USING` semantics;
- UPDATE target-row `WITH CHECK` semantics;
- immutable tenant/property/unit ownership fields where applicable.

Required property:

`rls_decision == oracle_decision`

### C. Authenticated API adapter

Execute protected `/api/property-ops/*` operations with real signed identities and mutate all client-controlled authority hints.

Required property:

`api_decision == oracle_decision`

and

`mutating_untrusted_authority_hints does not change api_decision`

## Merge-gate relation

This artifact strengthens, but does not close, the current merge blockers.

- **AUTH-E2E-01:** unaffected; still requires real cryptographic token validation evidence.
- **AUTH-E2E-02:** strengthened by AO-009 and the future authenticated API adapter.
- **CONC-01:** unaffected; still requires genuinely independent DB connections proving unique audit lineage.
- **PLUMB-01:** future API adapter can be reused during the resident -> manager -> worker -> verification -> resident-confirmation closed loop.
- **OBS-01:** each oracle fixture should eventually emit one decision/correlation identifier that can be followed through identity, authorization, SQL, audit, and outbox.
- **RECOVERY-01 / ROLLBACK-01:** restored/rolled-back runtimes must rerun this same oracle suite; successful boot alone is insufficient.

## Standards alignment

- OpenID AuthZEN Authorization API 1.0: conceptual PDP/PEP request/decision separation.
- OWASP Authorization Regression Testing: machine-readable Actor-Resource-Action regression matrix, IDOR, vertical/horizontal/tenant-boundary testing, CI gating.
- RFC 9700: authentication/token possession is not treated as application-resource authority.
- PostgreSQL RLS: database enforcement remains a separate defense layer whose `USING` and `WITH CHECK` behavior must be tested independently.

## Freeze condition

`J3S-AUTHZ-ORACLE-001` may move from CANDIDATE to VERIFIED only when:

1. source verification passes on the oracle branch;
2. application adapter parity passes;
3. RLS adapter parity passes;
4. authenticated API adapter parity passes with forged client authority inputs;
5. no fixture produces contradictory decisions among oracle, application, database, and API layers.

Any contradiction is merge-blocking and MUST be resolved by correcting policy/specification or implementation explicitly; the oracle must not be silently changed to match an implementation defect.
