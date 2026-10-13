# PROP-OPS-PILOT-001 — Paid Pilot Workflow Freeze

**Status:** FROZEN FOR IMPLEMENTATION v0.1  
**Parent gate:** `PROP-OPS-DATA-AUTH-001`  
**Release target:** controlled paid pilot after DATA-AUTH, integration, deployment, and recovery gates pass.

## Pilot promise

A resident reports a bounded plumbing maintenance issue. Property Ops preserves the original report, structures it with advisory AI, requires resident confirmation, routes it to authorized management triage, assigns an eligible worker, records append-only evidence, requires independent verification, lets the resident confirm or dispute the outcome, and produces a settlement-ready auditable record without granting AI financial, authorization, verification, or closure authority.

## Scope

**Included:** one property; routine/priority bathroom or kitchen fixture leak; authenticated resident/manager/worker/ops identities; structured intake; resident confirmation; manager triage and work authorization; same-property worker assignment; accept/start/complete workflow; before/after evidence; independent manager verification; resident confirmation/dispute; bounded PMS export/reconciliation; audit trail; settlement-readiness state.

**Excluded:** emergency life-safety dispatch automation; unrestricted vendor marketplace; autonomous money movement; escrow/custody; legal advice; predictive maintenance ML; unrestricted PMS writes; portfolio-wide rollout; cross-customer analytics.

## Normative invariants

1. Original resident report is immutable source evidence; AI output is a derived recommendation.
2. AI MUST NOT authorize work, verify work, mark settlement-ready, close a case, or move money.
3. Resident confirmation of the normalized summary is required before manager triage.
4. Case and WorkOrder remain distinct aggregates.
5. Assignment requires an active worker membership in the same organization/property and any required pilot credential rule.
6. Only the assigned worker may accept/start/submit worker evidence/report completion.
7. Performer MUST NOT verify their own work.
8. Work complete != verified; verified != closed; verified != paid.
9. Evidence correction uses supersession; prior evidence is retained.
10. A disputed outcome creates a governed revision/rework path rather than rewriting history.
11. External effects require stable idempotency keys.
12. UNKNOWN/AMBIGUOUS external-write outcomes MUST be reconciled before retry.
13. Every material state transition is authenticated, tenant-scoped, authorized, version-checked, audited, and committed transactionally.
14. Client-supplied actor identity is never authoritative.
15. Cross-tenant object identifiers MUST resolve to zero accessible rows / fail closed.

## Acceptance matrix

| ID | Requirement | Acceptance oracle |
|---|---|---|
| PILOT-AT-001 | Resident report preserved | Stored source text equals submitted source; AI summary stored separately. |
| PILOT-AT-002 | AI bounded | AI attempt to authorize/verify/settle/close is denied and audited. |
| PILOT-AT-003 | Resident summary gate | Triage before resident confirmation is denied. |
| PILOT-AT-004 | Tenant isolation | Tenant A cannot read Tenant B case by guessed UUID/public ID. |
| PILOT-AT-005 | Cross-tenant write isolation | Tenant A cannot insert/update a Tenant B-scoped row. |
| PILOT-AT-006 | Server-derived actor | Supplying another actor ID does not change authenticated authority. |
| PILOT-AT-007 | Worker eligibility | Inactive/wrong-property/non-worker assignee is rejected. |
| PILOT-AT-008 | Assigned worker only | Unassigned worker cannot accept/start/evidence/complete. |
| PILOT-AT-009 | No self-verification | Performer verification attempt is denied. |
| PILOT-AT-010 | Evidence supersession | Correction creates a new artifact linked to the old artifact; old artifact remains. |
| PILOT-AT-011 | SHA-256 evidence | Stored evidence digest validates against uploaded bytes/normalized payload. |
| PILOT-AT-012 | Audit chain | Mutation/removal/reorder of an event invalidates chain verification. |
| PILOT-AT-013 | Completion separation | Worker completion does not set VERIFIED. |
| PILOT-AT-014 | Verification separation | Verification alone does not set CLOSED or PAID. |
| PILOT-AT-015 | Resident dispute | Dispute opens governed rework/revision path and preserves prior record. |
| PILOT-AT-016 | Settlement gate | Settlement-ready requires verified work + resident confirmation + no unresolved external effect. |
| PILOT-AT-017 | PMS idempotency | Same idempotency key never creates a second external write intent. |
| PILOT-AT-018 | Ambiguous completion | UNKNOWN external outcome blocks blind retry until reconciliation. |
| PILOT-AT-019 | Concurrent version safety | Stale expected-version mutation is rejected. |
| PILOT-AT-020 | Auth fail closed | Missing/invalid/expired auth session cannot read or mutate tenant data. |
| PILOT-AT-021 | Durable restart | State survives application/browser restart with no localStorage dependency. |
| PILOT-AT-022 | Recovery | Staging backup/restore drill reconstructs pilot data and audit relationships. |
| PILOT-AT-023 | E2E plumbing loop | Browser flow reaches settlement-ready through every governed checkpoint. |
| PILOT-AT-024 | Production claim control | UI/demo material never claims live PMS/payment/compliance capability without verified adapter/gate evidence. |

## Exit gate

`PROP-OPS-PILOT-001` may move from implementation-frozen to **PILOT AUTHORIZED** only when all security-critical acceptance tests (AT-004 through AT-012, AT-016 through AT-022) are PASS with fresh receipts, deployment/rollback is verified, and the commercial SOW names the same bounded workflow.
