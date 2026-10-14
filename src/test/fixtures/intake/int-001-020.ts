export type IntakeContractFixtureKind =
  | "SCHEMA"
  | "DOMAIN"
  | "POLICY"
  | "SECURITY"
  | "INTEGRATION";

export interface IntakeContractFixture {
  id: `INT-${string}` | `ADV-${string}`;
  name: string;
  kind: IntakeContractFixtureKind;
  invariant: string;
  expected: string;
}

export const INT_FIXTURES: IntakeContractFixture[] = [
  {
    id: "INT-001",
    name: "Definition immutability",
    kind: "SCHEMA",
    invariant: "Published intake versions cannot be mutated in place.",
    expected: "Published semantic fields are immutable.",
  },
  {
    id: "INT-002",
    name: "Version lineage",
    kind: "SCHEMA",
    invariant: "Historical submissions resolve their original definition version.",
    expected: "No reinterpretation through current version.",
  },
  {
    id: "INT-003",
    name: "Tenant isolation",
    kind: "SECURITY",
    invariant: "Cross-tenant access is denied.",
    expected: "No record or existence leakage across tenant authority.",
  },
  {
    id: "INT-004",
    name: "Unknown preservation",
    kind: "DOMAIN",
    invariant: "Missing information remains UNKNOWN.",
    expected: "UNKNOWN never collapses to false, zero, or empty fact.",
  },
  {
    id: "INT-005",
    name: "Raw evidence preservation",
    kind: "DOMAIN",
    invariant: "Structured extraction preserves the source answer.",
    expected: "Raw respondent evidence remains addressable.",
  },
  {
    id: "INT-006",
    name: "AI authority boundary",
    kind: "DOMAIN",
    invariant: "AI alone cannot establish critical authority facts.",
    expected: "Unconfirmed critical inference remains non-authoritative.",
  },
  {
    id: "INT-007",
    name: "Identity ambiguity",
    kind: "INTEGRATION",
    invariant: "Ambiguous identity candidates never silently merge.",
    expected: "AMBIGUOUS result requires explicit resolution.",
  },
  {
    id: "INT-008",
    name: "Processing idempotency",
    kind: "INTEGRATION",
    invariant: "Repeated processing cannot duplicate downstream effects.",
    expected: "One canonical command/effect per idempotency key.",
  },
  {
    id: "INT-009",
    name: "Qualification explainability",
    kind: "POLICY",
    invariant: "Qualification output preserves policy, dimensions, evidence, and coverage.",
    expected: "Derived state is explainable from frozen inputs.",
  },
  {
    id: "INT-010",
    name: "Critical unknown protection",
    kind: "POLICY",
    invariant: "Critical unknowns cap qualification and routing.",
    expected: "High score cannot erase buyer or scope unknowns.",
  },
  {
    id: "INT-011",
    name: "Routing determinism",
    kind: "POLICY",
    invariant: "Identical snapshot and policy yield identical routing.",
    expected: "State, matched rule, and command types are stable.",
  },
  {
    id: "INT-012",
    name: "Command authorization",
    kind: "SECURITY",
    invariant: "Intake proposes commands but cannot directly mutate protected CRM state.",
    expected: "Receiving domain independently authorizes effects.",
  },
  {
    id: "INT-013",
    name: "Consent lineage",
    kind: "SCHEMA",
    invariant: "Consent is append-only event evidence.",
    expected: "Withdrawal supersedes but does not destroy history.",
  },
  {
    id: "INT-014",
    name: "Contradiction preservation",
    kind: "DOMAIN",
    invariant: "Conflicting evidence remains explicit until resolved.",
    expected: "No silent overwrite of contradictory facts.",
  },
  {
    id: "INT-015",
    name: "Public intake isolation",
    kind: "SECURITY",
    invariant: "Public intake authority is definition-scoped and non-enumerating.",
    expected: "Public token cannot search CRM or switch tenant.",
  },
  {
    id: "INT-016",
    name: "Upload isolation",
    kind: "SECURITY",
    invariant: "Evidence retrieval remains tenant-bound.",
    expected: "Cross-tenant evidence access is denied.",
  },
  {
    id: "INT-017",
    name: "Stale write protection",
    kind: "INTEGRATION",
    invariant: "Mutations require the current aggregate revision.",
    expected: "Stale revision returns conflict with no mutation.",
  },
  {
    id: "INT-018",
    name: "Outbox atomicity",
    kind: "INTEGRATION",
    invariant: "State mutation and required outbox event commit atomically.",
    expected: "Both commit or neither commits.",
  },
  {
    id: "INT-019",
    name: "AI degradation",
    kind: "DOMAIN",
    invariant: "Optional AI failure cannot make structured intake unavailable.",
    expected: "Manual structured intake remains viable.",
  },
  {
    id: "INT-020",
    name: "Audit reconstruction",
    kind: "INTEGRATION",
    invariant: "A completed intake is reconstructable through causation and correlation evidence.",
    expected: "Request-to-effect lineage remains traceable.",
  },
];
