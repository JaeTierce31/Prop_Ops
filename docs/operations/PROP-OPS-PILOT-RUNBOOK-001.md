# PROP-OPS-PILOT-RUNBOOK-001 — Pilot Operations Runbook

**Status:** IMPLEMENTATION RUNBOOK v0.1  
**Scope:** staging and bounded paid pilot for `PROP-OPS-PILOT-001`.

## Environment model

1. **Development:** synthetic data only; local/cloud developer environment.
2. **Staging:** isolated database branch/project, production-like auth/RLS/object storage, synthetic tenant, no customer production data.
3. **Pilot production:** dedicated environment and secrets; one authorized customer tenant/property; real data only after security/recovery gates pass.

Production credentials MUST be server-only. Browser code MUST NOT receive database credentials, object-storage service credentials, or privileged auth secrets.

## Required staging configuration

- `DATABASE_URL` bound to the least-privilege runtime role, not database owner
- auth issuer/JWKS configuration
- explicit allowed origins/redirect domains
- private evidence bucket
- tenant/org bootstrap data
- server-side logs and trace correlation ID
- environment marker (`development|staging|pilot`)
- no fallback to synthetic actor selection when auth is unavailable

## Deployment gate

Before staging deploy:

1. dependency lockfile exists and `npm ci` passes
2. typecheck/lint/unit/invariant tests pass
3. migrations applied to staging only
4. RLS cross-tenant read/write tests pass as low-privilege runtime role
5. auth-negative tests pass
6. SHA-256 evidence/audit path passes
7. outbox/idempotency tests pass
8. browser E2E plumbing loop passes
9. build artifact created from the tested SHA
10. deployment SHA and environment recorded in an evidence receipt

## Seeded demo tenant

Use an explicitly synthetic Whitney Grove tenant with resident, manager, two worker, and ops identities. Synthetic records MUST be visibly labeled and MUST NOT be presented as customer data.

The seeded plumbing scenario starts at `WG-C-1042` and exercises the complete pilot workflow. Reset must be an explicit staging administrative operation; production history must never be reset through the demo mechanism.

## Executive demo sequence

1. resident authenticates and submits leak report
2. AI creates recommendation labeled non-authoritative
3. resident confirms structured summary
4. manager triages and authorizes scope
5. manager assigns eligible same-property worker
6. worker accepts, starts, attaches before/after evidence, reports complete
7. manager independently verifies or requests rework
8. resident confirms or disputes outcome
9. system shows PMS reconciliation/external-effect state
10. manager marks settlement-ready only when all prerequisites are satisfied
11. audit view demonstrates actor, authority, evidence and state lineage

## Incident / fail-closed behavior

- invalid/missing auth: deny request
- ambiguous tenant: deny request and require explicit tenant selection
- database unavailable: do not fall back to browser-local canonical state
- evidence storage unavailable: do not claim evidence recorded
- authorization uncertainty: deny mutation
- external PMS timeout: mark effect UNKNOWN/AMBIGUOUS and reconcile before retry
- hash-chain inconsistency: raise integrity incident and block trusted receipt generation

## Rollback

Rollback is code + schema aware:

1. stop new pilot mutations or put environment in maintenance mode
2. identify last verified application SHA and migration level
3. deploy prior verified application artifact
4. do not down-migrate destructively without separately reviewed recovery procedure
5. replay/inspect outbox for effects committed before rollback
6. run smoke tests using synthetic tenant
7. record rollback receipt with start/end times, reason, SHAs, migration level and unresolved effects

## Backup / restore drill

A recovery receipt MUST demonstrate restoration into an isolated environment and verify:

- organization/property/unit memberships
- case/work-order relationships
- evidence metadata and object references
- audit order/hash linkage
- outbox/external-effect state
- tenant RLS after restore

Current infrastructure note: the attempted snapshot operation on the isolated Neon child branch was rejected by the platform because snapshots are limited to root branches in this configuration. Therefore backup/restore remains **NOT VERIFIED** for this branch and MUST NOT be marked PASS. A dedicated pilot database project/root branch is the preferred production recovery boundary.

## Pilot onboarding checklist

- signed SOW and data scope
- named executive sponsor and property manager
- tenant/property/unit import approved
- user roster and role mapping approved
- retention/privacy terms acknowledged
- support/escalation contacts named
- production-readiness receipt accepted
- synthetic rehearsal completed
- go-live window approved
- post-go-live review scheduled

## Exit criteria

Operations gate is PASS only when staging deployment, rollback drill, backup/restore drill, observability checks, seeded E2E demo, and pilot onboarding rehearsal each have fresh evidence receipts bound to an exact release SHA.
