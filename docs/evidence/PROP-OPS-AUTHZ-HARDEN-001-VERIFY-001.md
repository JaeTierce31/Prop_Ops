# PROP-OPS-AUTHZ-HARDEN-001 — Verification Receipt 001

**Repository:** `JaeTierce31/Prop_Ops`  
**Git branch:** `prop-ops-authz-harden-001`  
**Parent branch:** `prop-ops-data-auth-001`  
**Neon project:** `patient-snow-59842370`  
**Neon isolated branch:** `br-hidden-cloud-b72mwb3p` (`prop-ops-authz-harden-001`)  
**Gate state:** **PARTIAL — merge-blocking tests remain**

## Implemented hardening

- Server transaction context propagates authenticated `user_id`, `org_id`, roles, property IDs, and unit IDs into transaction-local PostgreSQL settings.
- Resource-aware restrictive RLS overlays the existing tenant boundary.
- Resident case access requires resident-of-record + scoped unit.
- Worker case/work-order access requires assignment to the authenticated database user.
- Manager access is constrained to scoped properties.
- Membership visibility is self/ops/scoped-manager bounded.
- Outbox direct visibility remains ops-only.
- Domain mutations enqueue external effects through the bounded `SECURITY DEFINER` function `prop_ops.enqueue_domain_outbox(...)` rather than direct application-table insertion.
- Outbox dedupe remains unique per `(org_id, dedupe_key)`.
- Audit sequence/hash uniqueness and the application advisory transaction lock remain in place.

## Adversarial evidence matrix

| Vector | Result | Evidence |
|---|---|---|
| Cross-property IDOR | **PASS** | Manager scoped to Whitney Grove saw allowed property/case = `1`; adversarial Property B/case = `0`. |
| Cross-unit resident access | **PASS** | Resident scoped to Unit 3B saw own case = `1`; adversarial cross-property/unit case = `0`. |
| Forged organization selection | **PASS** | `resolve_identity_v2` returned `0` rows for Worker 2 selecting an organization without active membership; active org returned `1`. |
| Inactive membership | **PASS** | Inactive Org B membership did not resolve authority. |
| Worker assignment isolation | **PASS** | Assigned Worker 1 saw work order/case; unassigned Worker 2 saw both as `0`. |
| Role escalation | **PARTIAL** | Roles are resolved server-side from membership and propagated by server code; no live signed-token/API spoof test has yet been executed in staging. |
| Stale-version write | **PASS** | Wrong optimistic version predicate returned zero rows; API also checks expected aggregate version before mutation. |
| Concurrent audit lineage | **PARTIAL** | Unique `(org_id, seq)` and `(org_id, event_hash)` constraints plus per-org `pg_advisory_xact_lock` verified structurally; true two-connection concurrency test remains pending. |
| Outbox replay | **PASS** | Two enqueue calls with identical dedupe key returned the same outbox UUID; exactly one row persisted. |
| Direct non-ops outbox write | **PASS (denied)** | Manager direct table INSERT was rejected by RLS. Application path was changed to bounded security-definer enqueue bridge. |
| Evidence hash format | **PASS (schema)** | Evidence artifact SHA-256 column requires 64 lowercase hex characters. |
| Tenant escape | **PASS** | Original tenant RLS remains required and restrictive resource policies further narrow visibility. |

## CI evidence

### Run 1 — expected corrective failure

Workflow: `AUTHZ-HARDEN-001 Verification`  
Run: `38327430277`  
Result: **FAIL** at formatting because generated `src/routeTree.gen.ts` is not formatter-owned.

Corrective action: added `.prettierignore` for generated route tree rather than rewriting generated code in CI.

### Run 2 — green source verification

Workflow: `AUTHZ-HARDEN-001 Verification`  
Run: `38327518961`  
Head: `4f62629b653193607d4f225b0c707a3cf48f01e8`  
Result: **PASS**

Passed stages:

- clean checkout
- frozen dependency install via `npm ci`
- formatting verification
- TypeScript typecheck
- ESLint
- tests
- production build

## Findings discovered during hardening

A restrictive `FOR ALL` outbox RLS policy correctly blocked manager direct inserts even after broadening its `WITH CHECK`. This exposed a mismatch with the application path, which still inserted directly into the outbox table.

The application has therefore been changed to call `prop_ops.enqueue_domain_outbox(...)`, a narrowly scoped `SECURITY DEFINER` bridge that:

- requires the session organization to match the target organization;
- requires active organization membership;
- preserves a unique dedupe key;
- does not grant direct outbox read authority to non-ops actors.

This is preferable to weakening outbox visibility/update RLS.

## Remaining merge blockers

`AUTHZ-HARDEN-001` is **not yet a full PASS**. The following evidence remains required before PR #1 becomes merge-eligible:

1. staging signed-token test proving forged client role claims/headers cannot elevate server membership authority;
2. true two-connection concurrent mutation test proving audit sequence/hash lineage under contention;
3. seeded canonical aggregate and one complete plumbing closed-loop executed through the authenticated server API;
4. staging observability + backup/restore + rollback evidence.

Until these are completed, PR #1 remains merge-withheld.
