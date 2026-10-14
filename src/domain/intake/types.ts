export type SubmissionState =
  | "CREATED"
  | "IN_PROGRESS"
  | "VALIDATING"
  | "IDENTITY_RESOLUTION"
  | "QUALIFYING"
  | "ROUTING"
  | "SUBMITTED"
  | "PROCESSED"
  | "ABANDONED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED"
  | "PROCESSING_FAILED";

export type SubmissionEvent =
  | "StartSubmission"
  | "RecordAnswer"
  | "AttachEvidence"
  | "RecordConsent"
  | "BeginValidation"
  | "ValidationPassed"
  | "ValidationFailed"
  | "AbandonSubmission"
  | "ExpireSubmission"
  | "CancelSubmission"
  | "IdentityResolved"
  | "IdentityAmbiguous"
  | "IdentityResolutionFailed"
  | "QualificationComputed"
  | "QualificationFailed"
  | "RoutingDecisionCreated"
  | "RoutingFailed"
  | "ProcessSubmission"
  | "ProcessingFailed"
  | "RetryProcessing"
  | "RejectSubmission";

export type EpistemicState =
  | "KNOWN"
  | "ASSERTED"
  | "INFERRED"
  | "CONFLICTING"
  | "UNKNOWN"
  | "NOT_APPLICABLE";

export type QualificationState =
  | "UNQUALIFIED"
  | "DISCOVERY"
  | "POTENTIAL"
  | "QUALIFIED"
  | "HIGH_PRIORITY"
  | "SALES_READY"
  | "CUSTOMER"
  | "DISQUALIFIED";

export type RoutingState =
  | "NOT_CURRENT_FIT"
  | "NURTURE"
  | "DISCOVERY_REQUIRED"
  | "AUDIT_CANDIDATE"
  | "PILOT_CANDIDATE"
  | "HIGH_PRIORITY_PILOT_CANDIDATE"
  | "BLOCKED_MISSING_EVIDENCE";
