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
| AUTH-E2E-01 | **PARTIAL — token issuance proven** | A dedicated staging Neon Function executed Managed Better Auth email signup/sign-in, maintained the HTTP-only session cookie, called the JWT `/token` endpoint, and obtained raw JWTs for Resident, Manager, Worker, and Ops. All four JWTs contained the expected `sub`, issuer, and audience values. Raw token material is intentionally excluded from this receipt. Cryptographic verification through the Property Ops API/JWKS verifier remains required before this gate becomes PASS. |
| AUTH-E2E-02 | **PARTIAL** | The four live JWT subjects were bound to existing canonical Property Ops domain actors. `prop_ops.resolve_identity_v2(...)` returned exactly DB-derived scope: Resident → `resident`, Whitney Grove property, unit 3B; Manager → `manager`, Whitney Grove property; Worker → `worker`, Whitney Grove property; Ops → `ops`, organization-wide. Live forged-header/body/org-substitution and altered-JWT-signature execution against the deployed Property Ops API remains pending. |
| CONC-01 | **PARTIAL** | Audit uniqueness constraints and per-org advisory-lock design were previously verified structurally. True two-independent-connection contention has not yet been executed in this gate. |
| PLUMB-01 | **PARTIAL** | Staging contains seeded canonical data and the four real Auth subjects are now bound to canonical actors. No authenticated resident→manager→worker→verification→resident-confirmation run through `/api/property-ops/*` has yet completed. |
| OBS-01 | **PARTIAL** | Neon Functions provide a working public runtime surface and the auth probes are reconstructable by version/suffix. End-to-end application request correlation through API → DB → audit/outbox is still pending. |
| RECOVERY-01 | **BLOCKED/PARTIAL** | Direct snapshot on the non-root staging branch remains unsupported (`not allowed to snapshot non-root branch`). No substitution is accepted as PASS. A supported PITR/snapshot topology and before/mutation/restore invariant proof remain required. |
| ROLLBACK-01 | **PENDING** | No canonical Property Ops N+1 staging deploy and rollback-to-N receipt exists yet. |

## Runtime authentication evidence

### Network/auth probe progression

1. Initial live runtime probe reached Managed Better Auth but signup/sign-in failed with `MISSING_ORIGIN` / `MISSING_OR_NULL_ORIGIN`.
2. A fresh function implementation supplied `Origin: http://localhost:3000` and absolute `callbackURL` values; signup/sign-in then succeeded.
3. Managed Better Auth returned an opaque session token/cookie as expected for browser sessions; this was not misclassified as a JWT.
4. Following the Managed Better Auth JWT-plugin flow, a second probe retained the session cookie and called `/token`.
5. `/token` returned JWTs for all four roles. The probe decoded only non-secret claims and did not emit raw JWTs.

### Live JWT subjects

| Role | Auth subject (`sub`) | DB domain actor | DB authority result |
|---|---|---|---|
| Resident | `04b144b8-d354-4059-97e5-5dcc5f08b346` | `res-3b` | role `resident`; property `41cb96e8-53c3-482c-be54-e8f5355c2c98`; unit `b1471629-2c16-4eab-a6e9-babe8473f99c` |
| Manager | `11aa5abb-5c8a-417a-b764-eb80ab3bdefa` | `mgr-01` | role `manager`; property `41cb96e8-53c3-482c-be54-e8f5355c2c98`; no unit scope |
| Worker | `11b66f40-fefd-4b66-bf86-406f83ac760a` | `wkr-01` | role `worker`; property `41cb96e8-53c3-482c-be54-e8f5355c2c98`; no unit scope |
| Ops | `1185c848-aff3-4e39-9b4b-b28ad87aa7d3` | `ops-01` | role `ops`; organization-wide; no property/unit restriction |

All four resolve under organization `4a918942-cd4c-4a36-9b06-42a679d7fcd3` (Whitney Grove Demo).

## Auth implementation evidence

`src/server/data-auth.ts` performs:

1. `Authorization: Bearer <token>` extraction;
2. JWKS signature verification;
3. issuer verification and optional audience verification;
4. `payload.sub` extraction as the authentication subject;
5. optional organization selection from `x-prop-ops-org`;
6. membership resolution via `prop_ops.resolve_identity_v2(auth_subject, org_id)`;
7. fail-closed handling for no membership, ambiguous organization, and unbound domain actor;
8. transaction-local propagation of DB-derived `user_id`, `org_id`, `roles`, `property_ids`, and `unit_ids`.

The live subject-binding result now demonstrates that the JWT identity and Property Ops authority model can converge without taking role/property/unit authority from JWT custom claims or request-body fields. The negative/spoof execution still must be run against the live API before AUTH-E2E-02 is PASS.

## Managed Better Auth JWT semantics

Managed Better Auth uses the session cookie for normal browser authentication and exposes raw JWTs through the JWT plugin `/token` flow. The emitted JWTs use the Neon Auth user ID as `sub`; the observed issuer and audience both matched the staging Neon Auth origin. Access tokens are short lived. This receipt stores subject identifiers and test results only, not credentials or token material.

## Recovery finding

Snapshot creation on this non-root staging branch is unsupported in the current topology. `RECOVERY-01` remains open. Acceptable remediation remains:

1. execute point-in-time/snapshot recovery on an eligible isolated topology and preserve exact before/mutation/after receipts; or
2. re-establish the recovery drill on a snapshot-capable root/eligible branch without weakening staging isolation.

A copy-on-write branch by itself is not promoted to snapshot PASS.

## Remaining hard blockers

1. Cryptographic live JWT acceptance/rejection through the Property Ops verifier, including tampered signature and forged authority inputs.
2. Two genuinely independent database connections contending on the same organization with monotonic/non-forking audit proof.
3. Full authenticated plumbing closed loop through `/api/property-ops/*`.
4. Correlated observability across request → authority resolution → mutation → audit/outbox.
5. Supported recovery drill with invariant verification.
6. Canonical application deploy N+1 → rollback N with canonical database-state proof.

## Merge posture

- `PROP-OPS-STAGING-AUTH-E2E-001`: **PARTIAL**
- `PROP-OPS-AUTHZ-HARDEN-001`: remains **PARTIAL**
- PR #2: remains **DRAFT / MERGE WITHHELD**
- PR #1: remains **MERGE WITHHELD**

No merge-state promotion is authorized until every conjunct in the final invariant is evidenced as PASS.
