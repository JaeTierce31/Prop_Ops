# PROP-OPS-DATA-AUTH-001-DB-VERIFY-001 — Database / Authority Foundation Receipt

**Repository:** `JaeTierce31/Prop_Ops`  
**Git branch:** `prop-ops-data-auth-001`  
**Parent application baseline:** `78fc29184a9b04d7fa84ad83288dfdd739389afc`  
**Isolated database branch:** `prop-ops-data-auth-001` (`br-old-bird-b7si0tkx`)  
**Database project:** `J3S-SOVEREIGN-KERNEL` (`patient-snow-59842370`)  
**GitHub Actions run:** `38322740096`  
**Verification job:** `115054339387`  
**Current gate:** **PARTIAL — substrate verified; application server authority path not yet complete.**

## 1. Verified database foundation

### PASS — isolated development boundary

All DATA-AUTH database work in this receipt was executed on an isolated child branch, not the Neon default/root branch.

### PASS — canonical pilot schema exists

`prop_ops` schema contains:

- organizations
- properties
- units
- users
- memberships
- cases
- work_orders
- evidence_artifacts
- audit_events
- external_effects
- outbox

The schema preserves Case/WorkOrder separation, tenant `org_id` boundaries, evidence supersession, SHA-256 digest fields, audit-chain fields, idempotency keys, ambiguous external-effect states, and a transactional outbox substrate.

### PASS — cryptographic primitive

`pgcrypto` is enabled on the isolated branch and `prop_ops.sha256_hex(text)` produces SHA-256 hexadecimal digests. This proves the database cryptographic primitive exists; it does **not** yet prove that every application evidence/audit write uses it.

### PASS — least-privilege database role substrate

A no-login `prop_ops_app` role exists with `NOBYPASSRLS`; a login-bearing runtime role exists and is granted `prop_ops_app`. Privileged connection credentials are intentionally not recorded in this receipt or repository.

### PASS — RLS enabled and forced

Tenant-scoped tables have Row Level Security enabled and FORCE ROW LEVEL SECURITY applied. Runtime tenant context derives from transaction-scoped `app.user_id` and `app.org_id` settings plus active membership.

### PASS — authenticated identity directory substrate

Neon Auth is provisioned on the isolated branch. Synthetic pilot identities exist for resident, manager, two workers, and ops. Application user records map auth subjects to stable domain actor IDs so the existing governed kernel can be preserved while client-selected synthetic identity is retired.

### PASS — private evidence storage substrate

A private branchable evidence bucket named `prop-ops-evidence` exists. No browser credential or public-read assumption is authorized by this receipt.

## 2. Fresh adversarial RLS evidence

Resident context was established through the low-privilege app role for the synthetic Whitney Grove tenant.

Observed results:

| Test | Expected | Observed | Verdict |
|---|---:|---:|---|
| Same-tenant case visibility | 1 seeded case | 1 | **PASS** |
| Adversary org visibility | 0 | 0 | **PASS** |
| Adversary property visibility | 0 | 0 | **PASS** |
| Cross-tenant property insert | denied | denied | **PASS** |
| Cross-tenant inserted row count | 0 | 0 | **PASS** |
| Identity resolution | resident + correct property/unit | matched | **PASS** |

These results establish a real database-level cross-tenant read/write isolation baseline for the tested role/context. They do not yet prove complete IDOR resistance through the application HTTP/API layer.

## 3. Source migrations

The Git branch contains:

- `db/migrations/001_prop_ops_data_auth.sql` — core schema, pgcrypto, RLS and indexes
- `db/migrations/002_prop_ops_runtime_hardening.sql` — runtime role grants, forced RLS, identity resolution
- `db/migrations/003_identity_domain_actor_bridge.sql` — authenticated subject → governed domain actor bridge

The first attempt to change the return signature of the existing identity function was transactionally rejected by PostgreSQL. No partial change from that failed transaction was accepted. The implementation was corrected additively with `resolve_identity_v2`, avoiding a destructive function replacement.

## 4. Fresh code verification

GitHub Actions run `38322740096`, job `115054339387` completed **SUCCESS**.

| Step | Result |
|---|---|
| clean | **PASS** |
| dependency install | **PASS** |
| TypeScript typecheck | **PASS** |
| lint | **PASS** |
| tests | **PASS** |
| production build | **PASS** |
| generated package-lock freeze step | **PASS** |

The workflow was designed so a generated lockfile is committed when absent; a subsequent run is required to establish that `npm ci` against the frozen lock is also green before dependency determinism is promoted to full PASS.

## 5. Recovery evidence

### NOT VERIFIED

A snapshot was attempted on the isolated Neon child branch and the platform rejected it because this configuration permits snapshots only on a root branch. No recovery PASS is claimed.

This creates an explicit production architecture decision: before a live-data pilot, Property Ops should have a recovery boundary that supports independent backup/restore drills — preferably a dedicated Property Ops database project/root branch rather than relying on a child branch of a broader sovereign-kernel project.

## 6. Gate classification

### PASS

- isolated database branch
- normalized pilot schema
- Postgres tenant keys and membership model
- forced RLS substrate
- low-privilege app role
- same-tenant positive visibility
- cross-tenant read isolation
- cross-tenant write isolation
- Neon Auth directory substrate
- five synthetic pilot identities
- authenticated-subject/domain-actor bridge
- SHA-256 database primitive
- private evidence-storage substrate
- external-effect/outbox tables
- CI install/typecheck/lint/test/build on DATA-AUTH branch

### PARTIAL

- authenticated session → application server identity binding
- role/action authorization at HTTP/server mutation boundary
- authoritative SHA-256 audit-chain writes
- secure evidence upload/signing flow
- transactional state transition + audit + outbox commit path
- dependency lock determinism until `npm ci` rerun succeeds
- full same-org role/privilege adversarial suite

### FAIL / NOT YET IMPLEMENTED

- removal of browser `localStorage` as canonical state
- removal of client-controlled actor selection
- integration test suite against live Postgres/auth boundary
- browser E2E pilot workflow
- staging deployment receipt
- rollback drill
- backup/restore drill
- production secret/environment binding
- default/root database promotion

## 7. Release decision

**Real-customer data remains NO-GO.**

The decisive substrate is now materially in place, but the application still needs the server-side authority/mutation boundary and durable repository wiring before `PROP-OPS-DATA-AUTH-001` can be considered complete.

## 8. Next implementation slice

`PROP-OPS-DATA-AUTH-001-B`:

1. verify auth token server-side and derive `sub`
2. resolve `sub` + explicit org to application user/domain actor
3. establish RLS transaction context
4. load canonical case/work-order state from Postgres
5. invoke the existing pure governed transition kernel with the server-derived actor
6. persist state + SHA-256 audit event + outbox intent atomically
7. return authoritative post-commit state
8. replace `DemoProvider` localStorage writes with authenticated server calls
9. add HTTP-level IDOR, impersonation, role-escalation and stale-version tests
10. run a second deterministic CI pass using the frozen npm lockfile
