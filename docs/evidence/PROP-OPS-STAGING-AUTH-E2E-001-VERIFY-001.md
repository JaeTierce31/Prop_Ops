# PROP-OPS-STAGING-AUTH-E2E-001 — Verification Receipt 001

**Repository:** `JaeTierce31/Prop_Ops`  
**Git branch:** `prop-ops-staging-auth-e2e-001`  
**Parent Git branch:** `prop-ops-authz-harden-001`  
**Neon project:** `patient-snow-59842370`  
**Neon staging branch:** `br-polished-base-b77tn1kp` (`prop-ops-staging-auth-e2e-001`)  
**Parent Neon branch:** `br-hidden-cloud-b72mwb3p` (`prop-ops-authz-harden-001`)  
**Gate state:** **PARTIAL — no parent promotion authorized**

## Final invariant

`AUTHZ-HARDEN PASS = AUTH-E2E ∧ CONCURRENCY ∧ CLOSED_LOOP ∧ OBSERVABILITY ∧ RECOVERY ∧ ROLLBACK`

No partial result promotes PR #2 or PR #1.

## Current evidence matrix

| Gate | State | Evidence |
|---|---|---|
| AUTH-E2E-01 | **PARTIAL** | Staging branch has Managed Better Auth (`better_auth`) with email/password enabled and branch-specific JWKS URL. Four synthetic staging identities were created through Neon Auth administration. A valid end-user session/access-token issuance path has not yet been exercised, so no token is accepted as evidence yet. |
| AUTH-E2E-02 | **PARTIAL** | Server code verifies bearer JWTs with JWKS and derives `authSubject = payload.sub`; role/property/unit scope is then resolved from `prop_ops.resolve_identity_v2(...)` and written to transaction-local DB context. Client-supplied roles are not an authority source in the inspected implementation. Live forged-header/body/claim tests remain pending because signed staging tokens are not yet available to the test runner. |
| CONC-01 | **PARTIAL** | Audit uniqueness constraints and per-org advisory-lock design were previously verified structurally. True two-independent-connection contention has not yet been executed in this gate. |
| PLUMB-01 | **PARTIAL** | Staging branch inherited seeded canonical data: 2 cases, 1 work order, 1 outbox row. No authenticated end-to-end resident→manager→worker→verification→resident-confirmation API execution has yet been completed. |
| OBS-01 | **PARTIAL** | Neon branch log query path is available; current pg-endpoint query returned no events in the sampled window. Application-request correlation and reconstructable trace evidence remain pending. |
| RECOVERY-01 | **BLOCKED/PARTIAL** | Attempting a Neon snapshot on the non-root staging branch returned `not allowed to snapshot non-root branch`. No substitution is accepted as PASS. A branch/PITR recovery procedure must be selected and executed with equivalent evidence or the staging topology must be adjusted so the required snapshot drill is supported. |
| ROLLBACK-01 | **PENDING** | No N+1 staging deploy and rollback-to-N execution receipt exists yet. |

## Auth implementation evidence

`src/server/data-auth.ts` currently performs:

1. `Authorization: Bearer <token>` extraction;
2. JWKS signature verification using `AUTH_JWKS_URL`;
3. issuer verification using `AUTH_ISSUER` and optional audience verification;
4. `payload.sub` extraction as the authentication subject;
5. optional organization selection from `x-prop-ops-org`;
6. membership resolution via `prop_ops.resolve_identity_v2(auth_subject, org_id)`;
7. fail-closed handling for no membership, ambiguous organization, and unbound domain actor;
8. transaction-local propagation of database-derived `user_id`, `org_id`, `roles`, `property_ids`, and `unit_ids`.

Therefore token claims or request body fields do not directly become Property Ops role/property/unit authority in the inspected code path. This remains a design/code fact until live signed-token adversarial execution confirms it.

## Managed Better Auth staging state

The isolated Neon branch reports:

- provider: `better_auth`
- email/password: enabled
- signup: enabled
- email verification required: no
- branch-specific JWKS endpoint: provisioned

Neon documentation confirms that successful email sign-in returns `session.access_token`, a signed JWT whose `sub` is the Neon Auth user ID. That is the token required by AUTH-E2E-01.

## Token issuance blocker

The currently available Neon administration connector can create Auth users but does not expose an end-user password/session/sign-in operation. The execution runtime used for this verification also could not resolve the external Neon Auth hostname, so a real `/auth/sign-in/email` session could not be established from the runner.

This blocker must not be bypassed with fabricated JWTs. The next valid token evidence must come from an actual Managed Better Auth sign-in/signup session or a staging runner with network access to the branch Auth endpoint.

## Recovery finding

Snapshot creation was attempted directly against the staging branch and rejected by Neon because snapshots are not allowed on a non-root branch in the current project topology. `RECOVERY-01` therefore remains open. Acceptable remediation paths are:

1. execute point-in-time/branch recovery on a topology Neon supports and preserve the exact before/mutation/after receipts; or
2. re-establish staging on a snapshot-capable root/eligible branch without weakening isolation.

A copy-on-write branch alone is not silently promoted to a snapshot PASS unless the gate contract is formally amended.

## Merge posture

- `PROP-OPS-STAGING-AUTH-E2E-001`: **PARTIAL**
- `PROP-OPS-AUTHZ-HARDEN-001`: remains **PARTIAL**
- PR #2: remains **DRAFT / MERGE WITHHELD**
- PR #1: remains **MERGE WITHHELD**

No merge-state promotion is authorized until every conjunct in the final invariant is evidenced as PASS.
