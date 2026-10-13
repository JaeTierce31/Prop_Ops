# PROP-OPS-PILOT-OFFER-001 — Paid Property Ops Pilot

**Status:** COMMERCIAL DRAFT v0.1 — price/SOW require J3S approval before external commitment.  
**Product scope source:** `PROP-OPS-PILOT-001`.

## Offer

A bounded, governed maintenance-operations pilot for one property that connects resident issue intake, management authorization, technician execution, evidence-backed verification, resident outcome confirmation/dispute, and settlement-ready records without replacing the customer's property-management system.

## Proposed term and price

**Recommended starting offer (proposal, not yet authorized):** 45-day pilot, **$2,500 implementation + $750 pilot platform fee**. Credit the platform fee toward the first 90 days of a production subscription if the pilot converts.

Pricing is intentionally sized to validate willingness-to-pay, implementation friction, workflow value, and integration requirements without promising enterprise-wide rollout.

## Included scope

- one property / one designated management team
- one bounded plumbing maintenance workflow
- resident, manager, worker, and ops access
- authenticated tenant-scoped workflow
- guided onboarding and seeded synthetic rehearsal before live pilot authorization
- governed work-order flow and status tracking
- evidence-backed completion and independent verification
- resident confirm/dispute loop
- audit timeline and settlement-ready record
- bounded PMS export/reconciliation interface; no live write-back unless separately verified and authorized
- weekly pilot operating review
- end-of-pilot outcome report

## Explicit exclusions

No autonomous payments, escrow/custody, legal advice, unrestricted vendor marketplace, compliance certification, unrestricted PMS write-back, emergency-response replacement, or portfolio-wide production commitment.

## Customer implementation assumptions

Customer supplies one executive sponsor, one property manager, participating maintenance staff, a bounded resident cohort, approved pilot property/unit data, and any PMS/API/export access it wishes evaluated. Property Ops remains the workflow coordination layer; the existing PMS remains system-of-record where contractually designated.

## Success metrics

Baseline during week 0, then measure:

1. median resident-report → manager-triage time
2. median authorized → accepted time
3. median accepted → work-reported-complete time
4. percent of completed work with required evidence
5. percent independently verified without rework
6. resident confirm/dispute rate and dispute resolution time
7. manual handoffs/sign-offs eliminated or shortened
8. PMS reconciliation exceptions
9. audit completeness for material transitions
10. operator time saved per completed work order

**Pilot success recommendation:** technical/security gates remain green; >=90% required evidence completeness; >=95% material transitions auditable; no cross-tenant/unauthorized data exposure; and a measurable improvement in at least two agreed operational cycle-time metrics. Commercial conversion still requires buyer acceptance, not metric gaming.

## Procurement/security summary

Before real resident data is authorized, provide the customer with:

- architecture/data-flow summary
- tenant-isolation model and adversarial-test receipt
- authentication/authorization description
- data retention/deletion policy
- evidence storage/access model
- encryption and secret-management statement
- incident/notification process
- backup/restore and rollback receipt
- subprocessors/service-provider list as applicable
- privacy statement and DPA posture as applicable
- explicit list of capabilities that remain prototype or non-production

## Conversion path

**Discovery → scoped pilot SOW → synthetic rehearsal → production-readiness/security signoff → bounded live pilot → outcome review → production proposal.**

A production proposal should price against property/unit volume, operator seats, integration burden, support/SLA, and proven operational value rather than simply extending the pilot fee.

## Commercial stop conditions

Do not accept or represent a live-data start date until `PROP-OPS-DATA-AUTH-001`, staging, recovery, and pilot security-critical acceptance tests are PASS. Do not promise live PMS write-back, payments, escrow, compliance certification, or vendor marketplace functionality without separately verified release gates.
