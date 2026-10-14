import type { PropOpsDimensionScores } from "@/domain/intake/qualification";

export type DogfoodEpistemicState = "ASSERTED" | "INFERRED" | "UNKNOWN";

export interface DogfoodEvidenceFact {
  fieldKey: string;
  rawValue: string;
  epistemicState: DogfoodEpistemicState;
  sourceType: "OPERATOR" | "AI";
  qualificationCritical: boolean;
}

export const WHITNEY_GROVE_DOGFOOD = {
  scenarioId: "J3S-PROP-OPS-WHITNEY-GROVE-DOGFOOD-001",
  property: "Whitney Grove Townhomes",
  managementOrganization: "The Community Builders",
  evidence: [
    {
      fieldKey: "property.name",
      rawValue: "Whitney Grove Townhomes",
      epistemicState: "ASSERTED",
      sourceType: "OPERATOR",
      qualificationCritical: false,
    },
    {
      fieldKey: "organization.name",
      rawValue: "The Community Builders",
      epistemicState: "ASSERTED",
      sourceType: "OPERATOR",
      qualificationCritical: true,
    },
    {
      fieldKey: "technology.property_management_platform",
      rawValue: "Yardi ecosystem",
      epistemicState: "ASSERTED",
      sourceType: "OPERATOR",
      qualificationCritical: false,
    },
    {
      fieldKey: "workflow.primary_pain",
      rawValue:
        "Vendor payment delays involving multiple manual sign-offs and siloed workflows.",
      epistemicState: "ASSERTED",
      sourceType: "OPERATOR",
      qualificationCritical: true,
    },
    {
      fieldKey: "workflow.capability_gap",
      rawValue:
        "Resident-to-maintenance work-order coordination is reported as a capability gap.",
      epistemicState: "ASSERTED",
      sourceType: "OPERATOR",
      qualificationCritical: false,
    },
  ] satisfies DogfoodEvidenceFact[],
  criticalUnknowns: [
    "buying.problem_owner",
    "buying.economic_buyer",
    "buying.target_timeline",
    "pilot.problem_definition",
    "pilot.success_condition",
  ],
  modeledDimensions: {
    ICP_FIT: 85,
    WORKFLOW_PAIN: 80,
    PAIN_FREQUENCY: undefined,
    ECONOMIC_IMPACT: undefined,
    WORKFLOW_FRAGMENTATION: 85,
    DATA_ACCESSIBILITY: 50,
    INTEGRATION_COMPLEXITY: 55,
    BUYER_ACCESS: undefined,
    PILOT_SCOPE_CLARITY: undefined,
    PILOT_REVERSIBILITY: 70,
    EVIDENCE_QUALITY: 45,
  } satisfies PropOpsDimensionScores,
  modelNote:
    "Dimension values are internal dogfood assumptions used to exercise policy behavior; they are not independently verified facts about Whitney Grove or The Community Builders.",
} as const;
