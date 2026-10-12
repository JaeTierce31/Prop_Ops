// Whitney Grove Maintenance MVP — governed workflow core.
// Pure TypeScript: every transition goes through dispatch(), which denies by default.

export type Role = "resident" | "manager" | "worker" | "ops" | "ai" | "system";
export interface Actor {
  role: Role;
  id: string;
  name: string;
}

export const ACTORS = {
  resident: { role: "resident", id: "res-3b", name: "Resident, Unit 3B (synthetic)" },
  manager: { role: "manager", id: "mgr-01", name: "M. Okafor · Manager (synthetic)" },
  worker1: { role: "worker", id: "wkr-01", name: "D. Rivera · Technician (synthetic)" },
  worker2: { role: "worker", id: "wkr-02", name: "S. Lin · Technician (synthetic)" },
  ops: { role: "ops", id: "ops-01", name: "Ops Auditor (synthetic)" },
  ai: { role: "ai", id: "ai-normalizer", name: "AI Assistant (recommendation only)" },
  system: { role: "system", id: "system", name: "System" },
} as const satisfies Record<string, Actor>;

export const WORKERS: Actor[] = [ACTORS.worker1, ACTORS.worker2];
export const MAIN_CASE_ID = "WG-C-1042";
export const SEED_EPOCH = Date.UTC(2026, 9, 7, 13, 0, 0);

export const SEEDED_REPORT_TEXT =
  "The bathroom sink in my unit is leaking underneath the vanity. There's a puddle in the cabinet and it drips constantly when the tap runs.";
export const SEEDED_PHOTO_CAPTION = "IMG_0412.jpg · under-sink cabinet, standing water (simulated)";
export const SEEDED_SCOPE =
  "Diagnose and repair under-sink leak at bathroom vanity. Replace supply line / P-trap washer as needed. Not-to-exceed $250 (synthetic).";

export type Severity = "EMERGENCY" | "PRIORITY" | "ROUTINE";
export type CaseStatus =
  | "DRAFT"
  | "REPORTED"
  | "NORMALIZED"
  | "TRIAGED"
  | "AUTHORIZED"
  | "IN_WORK"
  | "VERIFIED"
  | "DISPUTED"
  | "SETTLEMENT_READY"
  | "CLOSED";
export type WOStatus =
  | "AUTHORIZED"
  | "ASSIGNED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "WORK_REPORTED_COMPLETE"
  | "EVIDENCE_REVIEW"
  | "VERIFIED"
  | "REWORK_REQUIRED";

export interface AiSummary {
  label: "AI RECOMMENDATION — NOT AN AUTHORIZATION";
  category: string;
  location: string;
  symptom: string;
  recommendedSeverity: Severity;
  recommendedSlaHours: number;
  recommendedTrade: string;
  safetyNote: string;
  confidence: number;
}

export interface Case {
  id: string;
  unit: string;
  title: string;
  residentId: string;
  status: CaseStatus;
  background?: boolean;
  reportText?: string;
  reportedAt?: number;
  summary?: AiSummary;
  summaryConfirmed: boolean;
  severity?: Severity;
  slaHours?: number;
  slaDueAt?: number;
  residentOutcome?: "CONFIRMED" | "DISPUTED" | undefined;
  disputeReason?: string;
  woIds: string[];
  currentWoId?: string;
  receiptId?: string;
}

export interface WorkOrder {
  id: string;
  caseId: string;
  revision: number;
  status: WOStatus;
  scope: string;
  assigneeId?: string | undefined;
  authorizedBy: string;
  authorizedAt: number;
  verifiedBy?: string;
  verifiedAt?: number;
  supersedes?: string | undefined;
  supersededBy?: string;
  reworkReason?: string;
}

export type EvidenceKind = "RESIDENT_PHOTO" | "BEFORE" | "AFTER" | "NOTE";
export interface Evidence {
  id: string;
  caseId: string;
  woId?: string | undefined;
  kind: EvidenceKind;
  caption: string;
  byId: string;
  byRole: Role;
  at: number;
  hash: string;
  supersedes?: string | undefined;
}

export type Outcome = "OK" | "DENIED" | "DEDUPED" | "AMBIGUOUS";
export interface AuditEvent {
  seq: number;
  at: number;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  entity: "CASE" | "WORK_ORDER" | "EVIDENCE" | "EXTERNAL" | "POLICY" | "SYSTEM";
  entityId: string;
  from?: string;
  to?: string;
  authority: string;
  outcome: Outcome;
  note?: string;
  evidenceIds?: string[];
  prevHash: string;
  hash: string;
}

export type EffectStatus = "CONFIRMED" | "UNKNOWN" | "NOT_FOUND";
export interface ExternalEffect {
  id: string;
  key: string;
  kind: string;
  caseId: string;
  status: EffectStatus;
  attempts: number;
  externalRef?: string;
  createdAt: number;
  updatedAt: number;
}

export type PmsMode = "NORMAL" | "TIMEOUT_AFTER_WRITE" | "TIMEOUT_BEFORE_WRITE";

export interface DemoState {
  version: 1;
  cases: Record<string, Case>;
  workOrders: Record<string, WorkOrder>;
  evidence: Evidence[];
  events: AuditEvent[];
  effects: ExternalEffect[];
  pmsLedger: Record<string, string>;
  pmsMode: PmsMode;
}

export type Action =
  | { type: "SUBMIT_REPORT"; caseId: string; text: string; photoCaption?: string | undefined }
  | { type: "AI_NORMALIZE"; caseId: string }
  | { type: "CONFIRM_SUMMARY"; caseId: string }
  | { type: "TRIAGE"; caseId: string; severity: Severity; slaHours: number }
  | { type: "AUTHORIZE_WORK"; caseId: string; scope: string }
  | { type: "ASSIGN"; woId: string; workerId: string }
  | { type: "ACCEPT"; woId: string }
  | { type: "START"; woId: string }
  | { type: "ADD_EVIDENCE"; woId: string; kind: EvidenceKind; caption: string; supersedes?: string | undefined }
  | { type: "REPORT_COMPLETE"; woId: string }
  | { type: "BEGIN_REVIEW"; woId: string }
  | { type: "VERIFY"; woId: string }
  | { type: "REQUIRE_REWORK"; woId: string; reason: string }
  | { type: "CONFIRM_OUTCOME"; caseId: string }
  | { type: "DISPUTE"; caseId: string; reason: string }
  | { type: "MARK_SETTLEMENT_READY"; caseId: string }
  | { type: "CLOSE"; caseId: string }
  | { type: "GENERATE_RECEIPT"; caseId: string }
  | { type: "RECONCILE_EFFECT"; effectId: string }
  | { type: "RETRY_EFFECT"; effectId: string }
  | { type: "REPLAY_EFFECT"; effectId: string }
  | { type: "SET_PMS_MODE"; mode: PmsMode };
export type ActionType = Action["type"];

export const POLICY: Record<ActionType, { roles: Role[]; authority: string }> = {
  SUBMIT_REPORT: { roles: ["resident"], authority: "Resident of record for unit" },
  AI_NORMALIZE: { roles: ["ai"], authority: "Advisory only: structures the report, no decision rights" },
  CONFIRM_SUMMARY: { roles: ["resident"], authority: "Reporting resident attests summary accuracy" },
  TRIAGE: { roles: ["manager"], authority: "Manager triage authority (Policy MX-2)" },
  AUTHORIZE_WORK: { roles: ["manager"], authority: "Manager work authorization (Policy MX-3, routine ≤ $500)" },
  ASSIGN: { roles: ["manager"], authority: "Dispatcher assignment authority (Policy MX-4)" },
  ACCEPT: { roles: ["worker"], authority: "Assigned technician on work order" },
  START: { roles: ["worker"], authority: "Assigned technician on work order" },
  ADD_EVIDENCE: { roles: ["worker"], authority: "Assigned technician; append-only evidence (Policy EV-1)" },
  REPORT_COMPLETE: { roles: ["worker"], authority: "Performer completion report (not verification)" },
  BEGIN_REVIEW: { roles: ["manager"], authority: "Manager verification authority (Policy VR-1)" },
  VERIFY: { roles: ["manager"], authority: "Manager verification authority (Policy VR-1); verifier ≠ performer" },
  REQUIRE_REWORK: { roles: ["manager"], authority: "Manager verification authority (Policy VR-1)" },
  CONFIRM_OUTCOME: { roles: ["resident"], authority: "Reporting resident outcome acknowledgement" },
  DISPUTE: { roles: ["resident"], authority: "Reporting resident dispute right (Policy RS-2)" },
  MARK_SETTLEMENT_READY: {
    roles: ["manager"],
    authority: "Manager settlement readiness (Policy ST-1): needs VERIFIED, resident confirmation and reconciled PMS",
  },
  CLOSE: { roles: ["manager"], authority: "Manager closure authority (Policy CL-1)" },
  GENERATE_RECEIPT: { roles: ["manager", "ops", "resident"], authority: "Read-only attestation of recorded facts" },
  RECONCILE_EFFECT: { roles: ["ops", "manager"], authority: "Read-only reconciliation query to system of record" },
  RETRY_EFFECT: { roles: ["ops"], authority: "Ops retry, only after reconciliation proves the write is absent" },
  REPLAY_EFFECT: { roles: ["ops"], authority: "Idempotency check: replay with the same key" },
  SET_PMS_MODE: { roles: ["ops"], authority: "Demo fault-injection control" },
};

export function fnv(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

class Deny extends Error {}
function deny(msg: string): never {
  throw new Deny(msg);
}

type EventInput = Omit<AuditEvent, "seq" | "at" | "actorId" | "actorName" | "actorRole" | "prevHash" | "hash">;

function appendEvent(s: DemoState, now: number, actor: Actor, p: EventInput) {
  const last = s.events[s.events.length - 1];
  const body = {
    seq: s.events.length + 1,
    at: now,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    ...p,
    prevHash: last ? last.hash : "GENESIS",
  };
  s.events.push(Object.freeze({ ...body, hash: fnv(JSON.stringify(body)) }) as AuditEvent);
}

export function verifyChain(events: AuditEvent[]): boolean {
  let prev = "GENESIS";
  for (const e of events) {
    if (e.prevHash !== prev) return false;
    const { hash, ...body } = e;
    if (fnv(JSON.stringify(body)) !== hash) return false;
    prev = hash;
  }
  return true;
}

export function normalizeReport(text: string): AiSummary {
  const t = text.toLowerCase();
  const plumbing = /leak|drip|sink|faucet|pipe|water|drain|toilet/.test(t);
  const location = /bath|vanity/.test(t) ? "Bathroom vanity sink" : /kitchen/.test(t) ? "Kitchen sink" : "Unspecified fixture";
  const emergency = /flood|burst|ceiling|electric|sewage/.test(t);
  const sev: Severity = emergency ? "EMERGENCY" : /leak|drip|puddle/.test(t) ? "PRIORITY" : "ROUTINE";
  return {
    label: "AI RECOMMENDATION — NOT AN AUTHORIZATION",
    category: plumbing ? "Plumbing · Fixture leak" : "General maintenance",
    location,
    symptom: /under|cabinet|vanity/.test(t)
      ? "Active leak below sink (supply line or drain connection); standing water in cabinet"
      : "Reported fixture issue",
    recommendedSeverity: sev,
    recommendedSlaHours: sev === "EMERGENCY" ? 4 : sev === "PRIORITY" ? 24 : 72,
    recommendedTrade: plumbing ? "Plumbing (in-house tech)" : "General tech",
    safetyNote: "If the leak worsens, close the shut-off valve under the sink.",
    confidence: plumbing ? 0.86 : 0.55,
  };
}

function getCase(s: DemoState, id: string): Case {
  const c = s.cases[id];
  if (!c) deny(`Case ${id} not found.`);
  if (c.background) deny(`${id} is a read-only background seed record in this demo.`);
  return c;
}
function getWo(s: DemoState, id: string): { wo: WorkOrder; c: Case } {
  const wo = s.workOrders[id];
  if (!wo) deny(`Work order ${id} not found.`);
  const c = getCase(s, wo.caseId);
  if (wo.supersededBy) deny(`${id} has been superseded by ${wo.supersededBy}; act on the current revision.`);
  return { wo, c };
}
function expectStatus<T extends string>(actual: T, allowed: T[], what: string) {
  if (!allowed.includes(actual)) deny(`${what} is ${actual}; this action requires ${allowed.join(" or ")}.`);
}
function mustBeAssignee(wo: WorkOrder, actor: Actor) {
  if (wo.assigneeId !== actor.id) deny("Only the assigned technician may act on this work order.");
}
function mustBeResidentOfRecord(c: Case, actor: Actor) {
  if (c.residentId !== actor.id) deny("Only the resident of record for this unit may do this.");
}
export function isSuperseded(s: DemoState, evidenceId: string) {
  return s.evidence.some((e) => e.supersedes === evidenceId);
}
export function currentEvidence(s: DemoState, woId: string) {
  return s.evidence.filter((e) => e.woId === woId && !isSuperseded(s, e.id));
}
export function unresolvedEffects(s: DemoState, caseId: string) {
  return s.effects.filter((e) => e.caseId === caseId && e.status !== "CONFIRMED");
}

function addEvidence(
  s: DemoState,
  now: number,
  actor: Actor,
  p: { caseId: string; woId?: string; kind: EvidenceKind; caption: string; supersedes?: string | undefined },
): Evidence {
  const id = `EV-${String(s.evidence.length + 1).padStart(3, "0")}`;
  const e: Evidence = {
    id,
    ...p,
    byId: actor.id,
    byRole: actor.role,
    at: now,
    hash: fnv(`${id}|${p.kind}|${p.caption}|${actor.id}|${now}`),
  };
  s.evidence.push(Object.freeze(e) as Evidence);
  return e;
}

function emitEffect(s: DemoState, now: number, actor: Actor, kind: string, caseId: string, key: string) {
  const existing = s.effects.find((e) => e.key === key);
  if (existing) {
    appendEvent(s, now, actor, {
      action: "PMS_EFFECT_DEDUPED",
      entity: "EXTERNAL",
      entityId: existing.id,
      authority: "Idempotency key match: no second write",
      outcome: "DEDUPED",
      note: `Key ${key} already ${existing.status}${existing.externalRef ? ` (${existing.externalRef})` : ""}. Nothing re-sent.`,
    });
    return;
  }
  const ref = `YDI-${fnv(key).slice(0, 6).toUpperCase()}`;
  const eff: ExternalEffect = {
    id: `FX-${String(s.effects.length + 1).padStart(3, "0")}`,
    key,
    kind,
    caseId,
    status: "CONFIRMED",
    attempts: 1,
    createdAt: now,
    updatedAt: now,
  };
  if (s.pmsMode === "TIMEOUT_AFTER_WRITE") {
    s.pmsLedger[key] = ref;
    eff.status = "UNKNOWN";
  } else if (s.pmsMode === "TIMEOUT_BEFORE_WRITE") {
    eff.status = "UNKNOWN";
  } else {
    s.pmsLedger[key] = ref;
    eff.externalRef = ref;
  }
  const ambiguous = s.pmsMode !== "NORMAL";
  s.pmsMode = "NORMAL";
  s.effects.push(eff);
  appendEvent(s, now, actor, {
    action: ambiguous ? "PMS_EFFECT_AMBIGUOUS" : "PMS_EFFECT_CONFIRMED",
    entity: "EXTERNAL",
    entityId: eff.id,
    authority: "Mock Yardi adapter (system of record)",
    outcome: ambiguous ? "AMBIGUOUS" : "OK",
    to: eff.status,
    note: ambiguous
      ? `${kind}: timeout, outcome unknown. Auto-retry blocked; reconcile first.`
      : `${kind} written (${ref}). Key ${key}.`,
  });
}

export interface DispatchResult {
  state: DemoState;
  ok: boolean;
  reason?: string;
}

function targetOf(a: Action): string {
  if ("caseId" in a) return a.caseId;
  if ("woId" in a) return a.woId;
  if ("effectId" in a) return a.effectId;
  return "demo";
}

export function dispatch(state: DemoState, action: Action, actor: Actor, now: number): DispatchResult {
  const pol = (POLICY as Partial<Record<string, { roles: Role[]; authority: string }>>)[action.type];
  const denied = (reason: string): DispatchResult => {
    const s = structuredClone(state);
    appendEvent(s, now, actor, {
      action: `DENIED:${action.type}`,
      entity: "POLICY",
      entityId: targetOf(action),
      authority: pol ? `Requires: ${pol.authority}` : "No policy entry. Denied by default.",
      outcome: "DENIED",
      note: reason,
    });
    return { state: s, ok: false, reason };
  };
  if (!pol) return denied("Unknown action. Denied by default.");
  if (!pol.roles.includes(actor.role)) {
    return denied(`Role "${actor.role}" is not permitted to ${action.type}. Permitted: ${pol.roles.join(", ")}.`);
  }
  const next = structuredClone(state);
  try {
    apply(next, action, actor, now, pol.authority);
    return { state: next, ok: true };
  } catch (e) {
    if (e instanceof Deny) return denied(e.message);
    throw e;
  }
}

function apply(s: DemoState, a: Action, actor: Actor, now: number, authority: string) {
  const log = (p: Omit<EventInput, "authority" | "outcome"> & { authority?: string }) =>
    appendEvent(s, now, actor, { authority, outcome: "OK", ...p });

  switch (a.type) {
    case "SUBMIT_REPORT": {
      const c = getCase(s, a.caseId);
      mustBeResidentOfRecord(c, actor);
      expectStatus(c.status, ["DRAFT"], "Case");
      if (a.text.trim().length < 10) deny("Please describe the issue (at least 10 characters).");
      c.reportText = a.text.trim();
      c.reportedAt = now;
      const ids: string[] = [];
      if (a.photoCaption) ids.push(addEvidence(s, now, actor, { caseId: c.id, kind: "RESIDENT_PHOTO", caption: a.photoCaption }).id);
      c.status = "REPORTED";
      log({ action: "REPORT_SUBMITTED", entity: "CASE", entityId: c.id, from: "DRAFT", to: "REPORTED", evidenceIds: ids });
      return;
    }
    case "AI_NORMALIZE": {
      const c = getCase(s, a.caseId);
      expectStatus(c.status, ["REPORTED"], "Case");
      c.summary = normalizeReport(c.reportText ?? "");
      c.status = "NORMALIZED";
      log({ action: "AI_SUMMARY_PROPOSED", entity: "CASE", entityId: c.id, from: "REPORTED", to: "NORMALIZED", note: `Recommendation only: ${c.summary.category}, ${c.summary.recommendedSeverity}, ${c.summary.recommendedSlaHours}h SLA.` });
      return;
    }
    case "CONFIRM_SUMMARY": {
      const c = getCase(s, a.caseId);
      mustBeResidentOfRecord(c, actor);
      expectStatus(c.status, ["NORMALIZED"], "Case");
      if (c.summaryConfirmed) deny("Summary already confirmed.");
      c.summaryConfirmed = true;
      log({ action: "SUMMARY_CONFIRMED_BY_RESIDENT", entity: "CASE", entityId: c.id, from: "NORMALIZED", to: "NORMALIZED" });
      return;
    }
    case "TRIAGE": {
      const c = getCase(s, a.caseId);
      expectStatus(c.status, ["NORMALIZED"], "Case");
      if (!c.summaryConfirmed) deny("The resident must confirm the structured summary before triage.");
      if (!(a.slaHours > 0)) deny("SLA hours must be positive.");
      c.severity = a.severity;
      c.slaHours = a.slaHours;
      c.slaDueAt = (c.reportedAt ?? now) + a.slaHours * 3600_000;
      c.status = "TRIAGED";
      const override = c.summary && c.summary.recommendedSeverity !== a.severity;
      log({ action: "CASE_TRIAGED", entity: "CASE", entityId: c.id, from: "NORMALIZED", to: "TRIAGED", note: `${a.severity}, ${a.slaHours}h SLA.${override ? " Manager overrode AI recommendation." : " Manager adopted AI recommendation."}` });
      return;
    }
    case "AUTHORIZE_WORK": {
      const c = getCase(s, a.caseId);
      expectStatus(c.status, ["TRIAGED", "DISPUTED"], "Case");
      if (a.scope.trim().length < 10) deny("Authorized scope is required.");
      const from = c.status;
      const prev = c.currentWoId ? s.workOrders[c.currentWoId] : undefined;
      const rev = c.woIds.length + 1;
      const wo: WorkOrder = {
        id: `${c.id.replace("-C-", "-WO-")}-R${rev}`,
        caseId: c.id,
        revision: rev,
        status: "AUTHORIZED",
        scope: a.scope.trim(),
        authorizedBy: actor.id,
        authorizedAt: now,
        supersedes: prev?.id,
      };
      if (prev) prev.supersededBy = wo.id;
      s.workOrders[wo.id] = wo;
      c.woIds.push(wo.id);
      c.currentWoId = wo.id;
      c.status = "AUTHORIZED";
      if (from === "DISPUTED") c.residentOutcome = undefined;
      log({ action: "WORK_AUTHORIZED", entity: "CASE", entityId: c.id, from, to: "AUTHORIZED" });
      log({ action: "WORK_ORDER_CREATED", entity: "WORK_ORDER", entityId: wo.id, to: "AUTHORIZED", note: prev ? `Revision ${rev}; supersedes ${prev.id} (dispute reopen).` : `Revision ${rev}.` });
      emitEffect(s, now, actor, "CREATE_WORK_ORDER", c.id, `pms:wo:${wo.id}:create`);
      return;
    }
    case "ASSIGN": {
      const { wo, c } = getWo(s, a.woId);
      expectStatus(wo.status, ["AUTHORIZED"], "Work order");
      const w = WORKERS.find((x) => x.id === a.workerId);
      if (!w) deny("Unknown technician.");
      wo.assigneeId = w.id;
      wo.status = "ASSIGNED";
      const cFrom = c.status;
      c.status = "IN_WORK";
      log({ action: "WORK_ORDER_ASSIGNED", entity: "WORK_ORDER", entityId: wo.id, from: "AUTHORIZED", to: "ASSIGNED", note: `Assigned to ${w.name}.` });
      if (cFrom !== "IN_WORK") log({ action: "CASE_IN_WORK", entity: "CASE", entityId: c.id, from: cFrom, to: "IN_WORK" });
      return;
    }
    case "ACCEPT":
    case "START": {
      const { wo } = getWo(s, a.woId);
      mustBeAssignee(wo, actor);
      const [from, to] = a.type === "ACCEPT" ? (["ASSIGNED", "ACCEPTED"] as const) : (["ACCEPTED", "IN_PROGRESS"] as const);
      expectStatus(wo.status, [from], "Work order");
      wo.status = to;
      log({ action: a.type === "ACCEPT" ? "ASSIGNMENT_ACCEPTED" : "WORK_STARTED", entity: "WORK_ORDER", entityId: wo.id, from, to });
      return;
    }
    case "ADD_EVIDENCE": {
      const { wo } = getWo(s, a.woId);
      mustBeAssignee(wo, actor);
      expectStatus(wo.status, ["IN_PROGRESS"], "Work order");
      if (!["BEFORE", "AFTER", "NOTE"].includes(a.kind)) deny("Technicians may add BEFORE, AFTER or NOTE evidence only.");
      if (a.caption.trim().length < 3) deny("Evidence needs a caption.");
      if (a.supersedes) {
        const old = s.evidence.find((e) => e.id === a.supersedes);
        if (!old || old.woId !== wo.id) deny("Can only correct evidence on this work order.");
        if (old.byId !== actor.id) deny("Can only correct your own evidence.");
        if (old.kind !== a.kind) deny("A correction must keep the same evidence type.");
        if (isSuperseded(s, old.id)) deny(`${old.id} is already superseded.`);
      }
      const e = addEvidence(s, now, actor, { caseId: wo.caseId, woId: wo.id, kind: a.kind, caption: a.caption.trim(), supersedes: a.supersedes });
      log({ action: a.supersedes ? "EVIDENCE_SUPERSEDED" : "EVIDENCE_APPENDED", entity: "EVIDENCE", entityId: e.id, evidenceIds: [e.id], note: a.supersedes ? `${e.id} supersedes ${a.supersedes}; original retained.` : `${a.kind} evidence on ${wo.id}.` });
      return;
    }
    case "REPORT_COMPLETE": {
      const { wo } = getWo(s, a.woId);
      mustBeAssignee(wo, actor);
      expectStatus(wo.status, ["IN_PROGRESS"], "Work order");
      const cur = currentEvidence(s, wo.id);
      if (!cur.some((e) => e.kind === "BEFORE")) deny("A BEFORE photo is required before reporting complete.");
      if (!cur.some((e) => e.kind === "AFTER")) deny("An AFTER photo is required before reporting complete.");
      wo.status = "WORK_REPORTED_COMPLETE";
      log({ action: "WORK_REPORTED_COMPLETE", entity: "WORK_ORDER", entityId: wo.id, from: "IN_PROGRESS", to: "WORK_REPORTED_COMPLETE", evidenceIds: cur.map((e) => e.id), note: "Performer claim only. Not verified." });
      return;
    }
    case "BEGIN_REVIEW": {
      const { wo } = getWo(s, a.woId);
      expectStatus(wo.status, ["WORK_REPORTED_COMPLETE"], "Work order");
      wo.status = "EVIDENCE_REVIEW";
      log({ action: "EVIDENCE_REVIEW_STARTED", entity: "WORK_ORDER", entityId: wo.id, from: "WORK_REPORTED_COMPLETE", to: "EVIDENCE_REVIEW" });
      return;
    }
    case "VERIFY": {
      const { wo, c } = getWo(s, a.woId);
      expectStatus(wo.status, ["EVIDENCE_REVIEW"], "Work order");
      if (wo.assigneeId === actor.id) deny("Separation of duties: the performer cannot verify their own work.");
      wo.status = "VERIFIED";
      wo.verifiedBy = actor.id;
      wo.verifiedAt = now;
      c.status = "VERIFIED";
      c.residentOutcome = undefined;
      log({ action: "WORK_VERIFIED", entity: "WORK_ORDER", entityId: wo.id, from: "EVIDENCE_REVIEW", to: "VERIFIED", evidenceIds: currentEvidence(s, wo.id).map((e) => e.id) });
      log({ action: "CASE_VERIFIED", entity: "CASE", entityId: c.id, from: "IN_WORK", to: "VERIFIED", note: "Verified ≠ closed. Awaiting resident outcome." });
      emitEffect(s, now, actor, "UPDATE_WO_STATUS_VERIFIED", c.id, `pms:wo:${wo.id}:status:verified`);
      return;
    }
    case "REQUIRE_REWORK": {
      const { wo, c } = getWo(s, a.woId);
      expectStatus(wo.status, ["EVIDENCE_REVIEW"], "Work order");
      if (a.reason.trim().length < 3) deny("A rework reason is required.");
      wo.status = "REWORK_REQUIRED";
      wo.reworkReason = a.reason.trim();
      const rev = c.woIds.length + 1;
      const nwo: WorkOrder = {
        id: `${c.id.replace("-C-", "-WO-")}-R${rev}`,
        caseId: c.id,
        revision: rev,
        status: "ASSIGNED",
        scope: `${wo.scope}\nREWORK: ${wo.reworkReason}`,
        assigneeId: wo.assigneeId,
        authorizedBy: wo.authorizedBy,
        authorizedAt: wo.authorizedAt,
        supersedes: wo.id,
        reworkReason: wo.reworkReason,
      };
      wo.supersededBy = nwo.id;
      s.workOrders[nwo.id] = nwo;
      c.woIds.push(nwo.id);
      c.currentWoId = nwo.id;
      log({ action: "REWORK_REQUIRED", entity: "WORK_ORDER", entityId: wo.id, from: "EVIDENCE_REVIEW", to: "REWORK_REQUIRED", note: wo.reworkReason });
      log({ action: "REWORK_ORDER_ISSUED", entity: "WORK_ORDER", entityId: nwo.id, to: "ASSIGNED", authority: `Rework under original authorization by ${wo.authorizedBy}`, note: `Supersedes ${wo.id}; prior evidence retained.` });
      return;
    }
    case "CONFIRM_OUTCOME": {
      const c = getCase(s, a.caseId);
      mustBeResidentOfRecord(c, actor);
      expectStatus(c.status, ["VERIFIED"], "Case");
      if (c.residentOutcome) deny("Outcome already recorded.");
      c.residentOutcome = "CONFIRMED";
      log({ action: "RESIDENT_CONFIRMED_OUTCOME", entity: "CASE", entityId: c.id, from: "VERIFIED", to: "VERIFIED" });
      return;
    }
    case "DISPUTE": {
      const c = getCase(s, a.caseId);
      mustBeResidentOfRecord(c, actor);
      expectStatus(c.status, ["VERIFIED"], "Case");
      if (a.reason.trim().length < 3) deny("Please describe what is still wrong.");
      c.status = "DISPUTED";
      c.residentOutcome = "DISPUTED";
      c.disputeReason = a.reason.trim();
      const e = addEvidence(s, now, actor, { caseId: c.id, kind: "NOTE", caption: `Dispute: ${c.disputeReason}` });
      log({ action: "RESIDENT_DISPUTED", entity: "CASE", entityId: c.id, from: "VERIFIED", to: "DISPUTED", evidenceIds: [e.id], note: c.disputeReason });
      return;
    }
    case "MARK_SETTLEMENT_READY": {
      const c = getCase(s, a.caseId);
      expectStatus(c.status, ["VERIFIED"], "Case");
      const wo = c.currentWoId ? s.workOrders[c.currentWoId] : undefined;
      if (!wo || wo.status !== "VERIFIED") deny("The current work order is not VERIFIED.");
      if (c.residentOutcome !== "CONFIRMED") deny("The resident has not confirmed the outcome.");
      if (unresolvedEffects(s, c.id).length) deny("PMS effects are unreconciled. Reconcile in Audit first.");
      c.status = "SETTLEMENT_READY";
      log({ action: "SETTLEMENT_READY", entity: "CASE", entityId: c.id, from: "VERIFIED", to: "SETTLEMENT_READY", note: `Verified WO ${wo.id} by ${wo.verifiedBy}. No payment executed (demo).` });
      emitEffect(s, now, actor, "POST_COMPLETION_RECORD", c.id, `pms:case:${c.id}:completion`);
      return;
    }
    case "CLOSE": {
      const c = getCase(s, a.caseId);
      expectStatus(c.status, ["SETTLEMENT_READY"], "Case");
      if (unresolvedEffects(s, c.id).length) deny("PMS effects are unreconciled. Reconcile in Audit first.");
      c.status = "CLOSED";
      log({ action: "CASE_CLOSED", entity: "CASE", entityId: c.id, from: "SETTLEMENT_READY", to: "CLOSED" });
      emitEffect(s, now, actor, "CLOSE_SERVICE_REQUEST", c.id, `pms:case:${c.id}:close`);
      return;
    }
    case "GENERATE_RECEIPT": {
      const c = getCase(s, a.caseId);
      if (actor.role === "resident") mustBeResidentOfRecord(c, actor);
      expectStatus(c.status, ["SETTLEMENT_READY", "CLOSED"], "Case");
      const head = s.events[s.events.length - 1]?.hash ?? "";
      c.receiptId = `RCPT-${fnv(`${c.id}|${head}`).toUpperCase()}`;
      log({ action: "RECEIPT_GENERATED", entity: "CASE", entityId: c.id, note: `${c.receiptId}, anchored at chain head ${head}.` });
      return;
    }
    case "RECONCILE_EFFECT": {
      const eff = s.effects.find((e) => e.id === a.effectId);
      if (!eff) deny("Effect not found.");
      if (eff.status === "CONFIRMED") deny("Effect already confirmed; nothing to reconcile.");
      const ref = s.pmsLedger[eff.key];
      const from = eff.status;
      eff.updatedAt = now;
      if (ref) {
        eff.status = "CONFIRMED";
        eff.externalRef = ref;
      } else eff.status = "NOT_FOUND";
      log({ action: "PMS_RECONCILED", entity: "EXTERNAL", entityId: eff.id, from, to: eff.status, note: ref ? `Found existing write ${ref} in PMS. Marked confirmed with no resend.` : "No write found in PMS. A single retry is now permitted." });
      return;
    }
    case "RETRY_EFFECT": {
      const eff = s.effects.find((e) => e.id === a.effectId);
      if (!eff) deny("Effect not found.");
      if (eff.status === "UNKNOWN") deny("Outcome is ambiguous. Blind retry blocked; reconcile first.");
      if (eff.status === "CONFIRMED") deny("Effect already confirmed; a retry would duplicate the write.");
      const ref = `YDI-${fnv(eff.key).slice(0, 6).toUpperCase()}`;
      s.pmsLedger[eff.key] = ref;
      eff.status = "CONFIRMED";
      eff.externalRef = ref;
      eff.attempts += 1;
      eff.updatedAt = now;
      log({ action: "PMS_RETRY_CONFIRMED", entity: "EXTERNAL", entityId: eff.id, from: "NOT_FOUND", to: "CONFIRMED", note: `Retried with same key ${eff.key}; ${ref}.` });
      return;
    }
    case "REPLAY_EFFECT": {
      const eff = s.effects.find((e) => e.id === a.effectId);
      if (!eff) deny("Effect not found.");
      emitEffect(s, now, actor, eff.kind, eff.caseId, eff.key);
      return;
    }
    case "SET_PMS_MODE": {
      s.pmsMode = a.mode;
      log({ action: "PMS_FAULT_MODE_SET", entity: "SYSTEM", entityId: "mock-yardi", to: a.mode, note: "Applies to the next outbound effect only." });
      return;
    }
  }
}

export function seedState(now: number): DemoState {
  const h = 3600_000;
  const s: DemoState = {
    version: 1,
    cases: {
      [MAIN_CASE_ID]: {
        id: MAIN_CASE_ID,
        unit: "Building B · Unit 3B",
        title: "Bathroom sink leak",
        residentId: ACTORS.resident.id,
        status: "DRAFT",
        summaryConfirmed: false,
        woIds: [],
      },
      "WG-C-1038": {
        id: "WG-C-1038",
        unit: "Building A · Unit 1A",
        title: "AC not cooling",
        residentId: "res-1a",
        status: "TRIAGED",
        background: true,
        reportText: "AC blowing warm air since yesterday.",
        reportedAt: now - 46 * h,
        summaryConfirmed: true,
        severity: "PRIORITY",
        slaHours: 48,
        slaDueAt: now + 2 * h,
        woIds: [],
      },
      "WG-C-1040": {
        id: "WG-C-1040",
        unit: "Building C · Unit 2C",
        title: "Dishwasher not draining",
        residentId: "res-2c",
        status: "IN_WORK",
        background: true,
        reportText: "Dishwasher leaves standing water.",
        reportedAt: now - 20 * h,
        summaryConfirmed: true,
        severity: "ROUTINE",
        slaHours: 72,
        slaDueAt: now + 52 * h,
        woIds: ["WG-WO-1040-R1"],
        currentWoId: "WG-WO-1040-R1",
      },
    },
    workOrders: {
      "WG-WO-1040-R1": {
        id: "WG-WO-1040-R1",
        caseId: "WG-C-1040",
        revision: 1,
        status: "WORK_REPORTED_COMPLETE",
        scope: "Clear dishwasher drain line.",
        assigneeId: ACTORS.worker2.id,
        authorizedBy: ACTORS.manager.id,
        authorizedAt: now - 18 * h,
      },
    },
    evidence: [],
    events: [],
    effects: [],
    pmsLedger: {},
    pmsMode: "NORMAL",
  };
  appendEvent(s, now, ACTORS.system, {
    action: "DEMO_SEEDED",
    entity: "SYSTEM",
    entityId: "demo",
    authority: "Demo reset (synthetic data only)",
    outcome: "OK",
    note: "Seeded case WG-C-1042 plus two read-only background cases.",
  });
  return s;
}

export type SlaRisk = "N/A" | "OK" | "AT_RISK" | "BREACHED" | "MET";
export function slaRisk(c: Case, now: number): SlaRisk {
  if (!c.slaDueAt || !c.slaHours) return "N/A";
  if (["VERIFIED", "SETTLEMENT_READY", "CLOSED"].includes(c.status)) return "MET";
  const left = c.slaDueAt - now;
  if (left <= 0) return "BREACHED";
  if (left < c.slaHours * 3600_000 * 0.25) return "AT_RISK";
  return "OK";
}

export function metrics(s: DemoState, now: number) {
  const cases = Object.values(s.cases);
  const open = cases.filter((c) => c.status !== "DRAFT" && c.status !== "CLOSED");
  return {
    open: open.length,
    slaRisk: open.filter((c) => ["AT_RISK", "BREACHED"].includes(slaRisk(c, now))).length,
    awaitingVerification: cases.filter((c) => {
      const wo = c.currentWoId ? s.workOrders[c.currentWoId] : undefined;
      return wo && (wo.status === "WORK_REPORTED_COMPLETE" || wo.status === "EVIDENCE_REVIEW");
    }).length,
    settlementReady: cases.filter((c) => c.status === "SETTLEMENT_READY").length,
  };
}

export const STAGES = [
  "REPORTED",
  "NORMALIZED",
  "TRIAGED",
  "AUTHORIZED",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "WORK_REPORTED_COMPLETE",
  "EVIDENCE_REVIEW",
  "VERIFIED",
  "SETTLEMENT_READY",
  "CLOSED",
] as const;

export function stageOf(s: DemoState, c: Case): string {
  if (c.status === "AUTHORIZED" || c.status === "IN_WORK") {
    const wo = c.currentWoId ? s.workOrders[c.currentWoId] : undefined;
    return wo ? wo.status : c.status;
  }
  return c.status;
}