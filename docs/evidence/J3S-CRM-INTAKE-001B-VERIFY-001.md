# J3S-CRM-INTAKE-001B-VERIFY-001

## Reference Implementation Verification Receipt

**Artifact:** J3S-CRM-INTAKE-001B  
**Repository:** JaeTierce31/Prop_Ops  
**Branch:** `j3s-crm-intake-001b`  
**Verified commit:** `de88857149ee4283c1d3fc6185ffc99ec0a34294`  
**State:** `CORE_VERIFIED_NOT_FROZEN`  
**Date:** 2026-10-14

## 1. Verified implementation surfaces

The following implementation surfaces are present and verified at the referenced commit:

- canonical intake PostgreSQL schema and migrations;
- published intake-definition immutability;
- active policy immutability;
- tenant-bound RLS integrated with the existing Property Ops organization authority;
- runtime grants for `prop_ops_app` with forced RLS;
- intake submission state machine;
- required-field and epistemic-state validation;
- deterministic Property Ops qualification policy;
- deterministic Property Ops routing policy;
- critical-unknown ceilings and coverage renormalization;
- append-only provenance transformations;
- AI inference confirmation gates;
- governed proposed-command envelopes;
- deterministic command idempotency keys;
- INT-001 through INT-020 fixture catalog;
- ADV-001 through ADV-020 fixture catalog;
- contract-executable INT/ADV harness;
- real PostgreSQL runtime RLS/immutability/idempotency/rollback checks;
- independent-connection idempotency contention check;
- independent-connection optimistic-revision contention check;
- Whitney Grove Property Ops domain dogfood scenario.

## 2. CI evidence

Workflow: `J3S CRM Intake 001B Verification`

At the verified commit, both CI jobs passed.

### TypeScript / application verification

PASS:

- dependency install;
- formatting;
- TypeScript typecheck;
- lint with zero errors;
- Vitest suite: **92 passed / 0 failed** across 9 test files;
- production client/SSR/Nitro build.

Existing non-blocking lint warnings remain in pre-existing React files and are not intake-contract failures.

### PostgreSQL runtime verification

PASS:

- PostgreSQL 16 disposable runtime;
- migrations 001 through 009 apply cleanly;
- published intake-definition mutation rejected;
- active policy mutation rejected;
- authorized tenant sees its scoped intake resources;
- forged `app.tenant_id` disagreement fails closed;
- cross-tenant organization switch without membership exposes no rows;
- duplicate submission idempotency key rejected;
- submission + outbox rollback leaves neither artifact committed;
- two independent DB connections racing the same idempotency key produce exactly one committed row;
- two independent DB connections racing the same expected revision produce exactly one winning revision transition.

## 3. Important defect discovered and repaired

Real PostgreSQL execution exposed a runtime integration defect in migration 008:

> RLS was enabled for intake tables, but the existing `prop_ops_app` execution role had not been granted table access.

This was repaired additively by migration:

`009_crm_intake_runtime_access.sql`

The repair:

- grants the governed runtime role explicit intake table access;
- revokes public execution of intake tenant-authority helper functions;
- grants those helper functions explicitly to `prop_ops_app`;
- enables `FORCE ROW LEVEL SECURITY` on intake tables.

The repair is covered by the real PostgreSQL runtime gate.

## 4. Whitney Grove dogfood result

The dogfood scenario preserves the following as **ASSERTED** test evidence rather than independently verified external facts:

- Whitney Grove Townhomes;
- The Community Builders;
- Yardi ecosystem signal;
- reported vendor-payment delay involving manual sign-offs and siloed workflow;
- reported resident-to-maintenance workflow capability gap.

The current scenario intentionally leaves the following unresolved:

- problem owner;
- economic buyer;
- target timeline;
- bounded pilot problem definition;
- pilot success condition.

Because those qualification-critical facts remain unresolved, the current modeled dogfood route is:

`BLOCKED_MISSING_EVIDENCE`

Permitted command proposals:

- `RequestEvidence`;
- `CreateTask`.

Forbidden at the current evidence state:

- `CreateOpportunity`;
- `CreatePilotCandidate`.

A separate explicitly counterfactual test proves that pilot routing becomes available only after the missing facts are supplied. It does not promote those counterfactual values into real Whitney Grove evidence.

## 5. Command authority boundary

Routing outputs are now materialized into governed proposed-command envelopes containing:

- tenant ID;
- submission ID;
- routing decision ID;
- policy version;
- target context;
- deterministic idempotency key;
- human-approval requirement;
- `PROPOSED` status.

`CreateOpportunity` and `CreatePilotCandidate` proposals require human approval.

The intake domain still does **not** directly mutate canonical CRM opportunity or pilot state.

## 6. What this receipt does NOT prove

This receipt does not claim that all 40 INT/ADV cases have full HTTP-level adversarial runtime coverage.

The fixture catalog is complete, and core domain/database invariants are executable, but the following transport/application surfaces remain to be implemented and tested before freeze:

- authenticated intake session HTTP API;
- public intake token issuance/expiry/definition scoping;
- public anti-enumeration behavior;
- evidence upload MIME/size/quarantine pipeline;
- authoritative human-confirmation endpoint semantics;
- identity-resolution ambiguity workflow against canonical CRM identities;
- consent withdrawal enforcement in protected downstream processing;
- receiving-domain command authorization/replay receipts;
- full request → identity → answer/evidence → qualification → routing → command → downstream-effect correlation chain;
- production/staging managed-auth execution against the actual deployed runtime.

## 7. Freeze disposition

Current disposition:

`NOT_FROZEN`

Reason:

The domain/database core is verified, but the HTTP/application authority boundary and the remaining runtime-adversarial cases have not yet been proven.

The renderer MUST NOT be treated as authoritative and SHOULD NOT be admitted as the next primary workstream until the intake API authority boundary is verified.

## 8. Next verification target

`J3S-CRM-INTAKE-001B-API-VERIFY-001`

Required proof sequence:

1. authenticated session creation through `/api/crm/intakes/*`;
2. revision-bound answer mutation;
3. authoritative human-confirmation path separated from AI inference;
4. submit/evaluate transaction producing immutable qualification + routing records;
5. persisted proposed-command envelopes and outbox events;
6. forged tenant/org/header/body attacks;
7. command replay and receiving-domain authorization proof;
8. one Whitney Grove dogfood run through the real HTTP API;
9. complete correlation/audit reconstruction.

Only after this boundary passes should the adaptive mobile renderer become the next implementation surface.
