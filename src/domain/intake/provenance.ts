export type ProvenanceSourceType =
  "RESPONDENT" | "OPERATOR" | "SYSTEM" | "AI" | "EXTERNAL";

export type ProvenanceTransformationType =
  | "ORIGINAL"
  | "NORMALIZED"
  | "EXTRACTED"
  | "TRANSLATED"
  | "CORRECTED"
  | "MERGED";

export interface ProvenanceRecord {
  id: string;
  sourceType: ProvenanceSourceType;
  sourceRef?: string;
  actorRef?: unknown;
  capturedAt: string;
  transformationType: ProvenanceTransformationType;
  parentProvenanceIds: string[];
  confidence?: number;
  policyVersion?: string;
}

function assertConfidence(confidence: number | undefined): void {
  if (
    confidence !== undefined &&
    (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
  ) {
    throw new RangeError("confidence must be within 0..1");
  }
}

export function appendTransformation(
  existing: readonly ProvenanceRecord[],
  record: ProvenanceRecord,
): ProvenanceRecord[] {
  assertConfidence(record.confidence);

  if (existing.some((entry) => entry.id === record.id)) {
    throw new Error("duplicate provenance id");
  }

  if (record.transformationType === "ORIGINAL") {
    if (record.parentProvenanceIds.length > 0) {
      throw new Error("original provenance must not have parents");
    }
  } else {
    if (record.parentProvenanceIds.length === 0) {
      throw new Error("transformed provenance requires a parent");
    }

    const knownIds = new Set(existing.map((entry) => entry.id));
    for (const parentId of record.parentProvenanceIds) {
      if (!knownIds.has(parentId)) {
        throw new Error(`missing provenance parent: ${parentId}`);
      }
    }
  }

  return [
    ...existing,
    { ...record, parentProvenanceIds: [...record.parentProvenanceIds] },
  ];
}
