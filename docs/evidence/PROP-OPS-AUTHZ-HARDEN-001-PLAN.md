# PROP-OPS-AUTHZ-HARDEN-001 — Adversarial Authorization Hardening Plan

Status: ACTIVE / MERGE-BLOCKING

## Objective

Prove that authenticated organization membership cannot be abused to cross property, unit, role, or external-effect authority boundaries.

## Required vectors

1. Cross-property IDOR: actor scoped to Property A cannot read or mutate Property B.
2. Cross-unit resident isolation: resident of Unit A cannot read or mutate Unit B cases/evidence.
3. Forged organization selection: valid token + unauthorized `x-prop-ops-org` fails closed.
4. Inactive membership: inactive membership resolves to no authority.
5. Role escalation: client-supplied role/route intent cannot create database authority.
6. Worker assignment: worker cannot access or mutate work orders not assigned to the authenticated user.
7. Self-verification: performer cannot use server mutation path to verify own work.
8. Stale-version write: optimistic version mismatch is rejected without mutation.
9. Concurrent audit lineage: two concurrent state transitions cannot create duplicate sequence/hash ancestry.
10. Outbox replay: duplicate `dedupe_key` cannot create a second external effect; ambiguous completion must reconcile before retry.
11. Evidence integrity: SHA-256 format required; supersession cannot erase the original artifact.
12. Tenant escape: authenticated user in Org A cannot select/read/mutate Org B resources.

## PASS criteria

All vectors must produce deterministic PASS evidence on the isolated Neon branch and the GitHub verification workflow must remain green. Any HIGH/CRITICAL authorization bypass keeps PR #1 merge-blocked.
