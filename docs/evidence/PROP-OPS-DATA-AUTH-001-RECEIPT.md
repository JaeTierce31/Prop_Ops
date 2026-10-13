# PROP-OPS-DATA-AUTH-001 Verification Receipt

Status: candidate for pilot-grade review
Branch: `prop-ops-data-auth-001`
Scope: replace browser-local canonical state and synthetic identity with PostgreSQL-backed, authenticated, tenant-scoped server-side execution while preserving verified governance invariants.

## Implemented authority boundary

- Canonical case state is persisted server-side in PostgreSQL.
- Mutations pass through a server authority boundary and require an authenticated subject.
- Tenant context is resolved from authenticated organization memberships, not from browser-local identity.
- PostgreSQL row-level security is enabled for tenant-scoped Property Ops tables.
- State mutation uses optimistic version checks and row locking.
- External effects are represented through a transactional outbox and idempotency keys.
- Evidence artifacts carry SHA-256 integrity values.
- Authoritative audit events are hash-chained and sequenced per organization.
- Synthetic bootstrap is isolated behind an explicit environment gate and synthetic-tenant restriction.
- The existing deterministic domain dispatcher remains the transition-policy oracle rather than duplicating state-machine policy in the UI.

## Verification lineage

- GitHub Actions workflow: `DATA-AUTH-001 Verification`.
- Run 9 on commit `08dbf22b7db4f5238b0811c98ac6ca9b3f699bc2` passed install, formatting, typecheck, lint, test, and build.
- The workflow then produced bot commit `e7f912e8fd692c4542a874985dca1959c387247e` containing the generated dependency lockfile and normalized formatting.
- This receipt commit exists to force a clean verification pass against the post-normalization branch head before review/merge.

## Required adversarial gates before production adoption

1. Cross-tenant read denied.
2. Cross-tenant mutation denied.
3. IDOR by guessed case/work-order/evidence identifier denied.
4. Role escalation denied when membership lacks the required operational role.
5. Inactive membership denied.
6. Ambiguous multi-organization identity fails closed unless an explicit organization is selected.
7. Stale `expectedVersion` mutation returns conflict without partial state change.
8. Evidence SHA mismatch is rejected before acceptance as authoritative evidence.
9. Duplicate external-effect idempotency key cannot create a second effect.
10. Unknown/ambiguous external completion remains non-final until reconciled.
11. Audit sequence/hash lineage remains monotonic under concurrent mutations.
12. Resident, worker, manager, and ops property/unit scopes are enforced server-side.

## Release posture

This branch is not authorized for production merely by passing CI. Promotion requires: clean branch-head CI, review of the tenant/RLS adversarial suite, staging configuration with real authentication, seeded demo tenant, observability, backup/restore drill, and an explicit release decision.
