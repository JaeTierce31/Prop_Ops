import type { QualificationState } from "./types";

export const PROP_OPS_DIMENSION_KEYS = [
  "ICP_FIT",
  "WORKFLOW_PAIN",
  "PAIN_FREQUENCY",
  "ECONOMIC_IMPACT",
  "WORKFLOW_FRAGMENTATION",
  "DATA_ACCESSIBILITY",
  "INTEGRATION_COMPLEXITY",
  "BUYER_ACCESS",
  "PILOT_SCOPE_CLARITY",
  "PILOT_REVERSIBILITY",
  "EVIDENCE_QUALITY",
] as const;

export type PropOpsDimensionKey = (typeof PROP_OPS_DIMENSION_KEYS)[number];
export type PropOpsDimensionScores = Record<
  PropOpsDimensionKey,
  number | undefined
>;

export const PROP_OPS_QUAL_POLICY = {
  namespace: "PROP-OPS-QUAL-001",
  version: "1.0.0",
  weights: {
    ICP_FIT: 0.14,
    WORKFLOW_PAIN: 0.16,
    PAIN_FREQUENCY: 0.08,
    ECONOMIC_IMPACT: 0.12,
    WORKFLOW_FRAGMENTATION: 0.12,
    DATA_ACCESSIBILITY: 0.07,
    INTEGRATION_COMPLEXITY: 0.07,
    BUYER_ACCESS: 0.08,
    PILOT_SCOPE_CLARITY: 0.08,
    PILOT_REVERSIBILITY: 0.04,
    EVIDENCE_QUALITY: 0.04,
  } satisfies Record<PropOpsDimensionKey, number>,
} as const;

export interface PropOpsQualificationInput {
  dimensions: PropOpsDimensionScores;
  blockingContradiction?: boolean;
  economicBuyerKnown?: boolean;
  timelineKnown?: boolean;
}

export interface PropOpsQualificationResult {
  policy: "PROP-OPS-QUAL-001@1.0.0";
  score: number;
  coverage: number;
  state: Exclude<QualificationState, "CUSTOMER">;
  dimensions: PropOpsDimensionScores;
  blockingContradiction: boolean;
}

const qualificationOrder: Array<Exclude<QualificationState, "CUSTOMER">> = [
  "DISQUALIFIED",
  "UNQUALIFIED",
  "DISCOVERY",
  "POTENTIAL",
  "QUALIFIED",
  "HIGH_PRIORITY",
  "SALES_READY",
];

function capState(
  current: Exclude<QualificationState, "CUSTOMER">,
  ceiling: Exclude<QualificationState, "CUSTOMER">,
): Exclude<QualificationState, "CUSTOMER"> {
  if (current === "DISQUALIFIED") return current;
  const currentIndex = qualificationOrder.indexOf(current);
  const ceilingIndex = qualificationOrder.indexOf(ceiling);
  return currentIndex > ceilingIndex ? ceiling : current;
}

function band(score: number): Exclude<QualificationState, "CUSTOMER"> {
  if (score < 35) return "UNQUALIFIED";
  if (score < 50) return "DISCOVERY";
  if (score < 65) return "POTENTIAL";
  if (score < 80) return "QUALIFIED";
  return "HIGH_PRIORITY";
}

function assertScore(value: number, key: PropOpsDimensionKey): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${key} must be within 0..100`);
  }
}

function normalizeScore(score: number): number {
  return Math.round(score * 1_000_000_000) / 1_000_000_000;
}

export function qualifyPropOps(
  input: PropOpsQualificationInput,
): PropOpsQualificationResult {
  let weightedTotal = 0;
  let knownWeight = 0;

  for (const key of PROP_OPS_DIMENSION_KEYS) {
    const raw = input.dimensions[key];
    if (raw === undefined) continue;
    assertScore(raw, key);

    const effective = key === "INTEGRATION_COMPLEXITY" ? 100 - raw : raw;
    const weight = PROP_OPS_QUAL_POLICY.weights[key];
    weightedTotal += effective * weight;
    knownWeight += weight;
  }

  const rawScore = knownWeight === 0 ? 0 : weightedTotal / knownWeight;
  const score = normalizeScore(rawScore);
  const coverage = knownWeight;
  let state = band(score);

  if (input.dimensions.ICP_FIT === undefined) {
    state = capState(state, "DISCOVERY");
  }
  if (input.dimensions.WORKFLOW_PAIN === undefined) {
    state = capState(state, "DISCOVERY");
  }
  if (input.dimensions.BUYER_ACCESS === undefined) {
    state = capState(state, "QUALIFIED");
  }
  if (input.dimensions.PILOT_SCOPE_CLARITY === undefined) {
    state = capState(state, "QUALIFIED");
  }
  if (
    input.dimensions.EVIDENCE_QUALITY !== undefined &&
    input.dimensions.EVIDENCE_QUALITY < 30
  ) {
    state = capState(state, "POTENTIAL");
  }
  if (input.blockingContradiction === true) {
    state = capState(state, "POTENTIAL");
  }

  const salesReady =
    score >= 80 &&
    (input.dimensions.BUYER_ACCESS ?? -1) >= 70 &&
    (input.dimensions.PILOT_SCOPE_CLARITY ?? -1) >= 70 &&
    (input.dimensions.EVIDENCE_QUALITY ?? -1) >= 60 &&
    input.blockingContradiction !== true &&
    input.economicBuyerKnown === true &&
    input.timelineKnown === true;

  if (salesReady) state = "SALES_READY";

  return {
    policy: "PROP-OPS-QUAL-001@1.0.0",
    score,
    coverage,
    state,
    dimensions: input.dimensions,
    blockingContradiction: input.blockingContradiction === true,
  };
}
