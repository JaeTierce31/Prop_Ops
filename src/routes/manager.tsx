import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useDemo } from "@/domain/store";
import {
  ACTORS,
  MAIN_CASE_ID,
  SEEDED_SCOPE,
  WORKERS,
  currentEvidence,
  metrics,
  slaRisk,
  stageOf,
  type Severity,
} from "@/domain/model";
import {
  AiBadge,
  Btn,
  Card,
  Chip,
  EvidenceList,
  PageTitle,
  fmtDateTime,
} from "@/components/wg/ui";
import { PmsPanel } from "@/components/wg/PmsPanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/manager")({
  head: () => ({
    meta: [
      { title: "Manager · Dispatch queue — Whitney Grove" },
      {
        name: "description",
        content:
          "Triage, authorize, assign and verify maintenance work with SLA visibility.",
      },
      {
        property: "og:title",
        content: "Manager Dispatch · Whitney Grove Maintenance",
      },
      {
        property: "og:description",
        content: "Queue, SLA risk, explicit authorization and verification.",
      },
    ],
  }),
  component: ManagerPage,
});

function ManagerPage() {
  const { state, now, run } = useDemo();
  const me = ACTORS.manager;
  const m = metrics(state, now);
  const [sel, setSel] = useState(MAIN_CASE_ID);
  const c = state.cases[sel] ?? state.cases[MAIN_CASE_ID]!;
  const wo = c.currentWoId ? state.workOrders[c.currentWoId] : undefined;
  const [severity, setSeverity] = useState<Severity | "">("");
  const [scope, setScope] = useState(SEEDED_SCOPE);
  const [worker, setWorker] = useState(WORKERS[0]!.id);
  const [reworkOpen, setReworkOpen] = useState(false);
  const [reason, setReason] = useState("");
  const sev = (severity ||
    c.summary?.recommendedSeverity ||
    "ROUTINE") as Severity;
  const slaFor = (s: Severity) =>
    s === "EMERGENCY" ? 4 : s === "PRIORITY" ? 24 : 72;
  const risk = slaRisk(c, now);
  const residentEv = state.evidence.filter((e) => e.caseId === c.id && !e.woId);

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="Manager / Dispatcher" title="Maintenance queue">
        {me.name}
      </PageTitle>
      <div className="grid grid-cols-2 gap-2">
        {[
          ["Open cases", m.open, "info"],
          ["SLA risk", m.slaRisk, m.slaRisk ? "warn" : "info"],
          ["Awaiting verification", m.awaitingVerification, "info"],
          ["Settlement-ready", m.settlementReady, "ok"],
        ].map(([l, v, t]) => (
          <div
            key={l as string}
            className="rounded-lg border border-border bg-card p-3 shadow-sm"
          >
            <p
              className={cn(
                "text-2xl font-semibold",
                t === "warn" && "text-warning-foreground",
                t === "ok" && "text-success",
              )}
            >
              {v}
            </p>
            <p className="text-xs text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <Card title="Queue">
        <ul className="divide-y divide-border">
          {Object.values(state.cases).map((q) => (
            <li key={q.id}>
              <button
                onClick={() => setSel(q.id)}
                className={cn(
                  "flex w-full items-center gap-2 py-2.5 text-left",
                  q.id === c.id && "font-semibold",
                )}
              >
                <div className="flex-1">
                  <p className="text-sm">{q.title}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {q.id} · {q.unit}
                    {q.background ? " · read-only seed" : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Chip value={stageOf(state, q)} />
                  {slaRisk(q, now) !== "N/A" && (
                    <Chip
                      value={slaRisk(q, now)}
                      label={`SLA ${slaRisk(q, now).replace("_", " ")}`}
                    />
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={`Case ${c.id}`} aside={<Chip value={c.status} />}>
        {c.status === "DRAFT" ? (
          <p className="text-sm text-muted-foreground">
            No report yet. The resident has not submitted this case.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <p>“{c.reportText}”</p>
            <div className="flex flex-wrap gap-1.5">
              {c.severity && (
                <Chip value="IN_PROGRESS" label={`Severity ${c.severity}`} />
              )}
              <Chip value={risk} label={`SLA ${risk.replace("_", " ")}`} />
              {c.slaDueAt && (
                <span className="text-xs text-muted-foreground">
                  due {fmtDateTime(c.slaDueAt)}
                </span>
              )}
              <Chip
                value={c.summaryConfirmed ? "OK" : "DRAFT"}
                label={
                  c.summaryConfirmed
                    ? "Resident confirmed summary"
                    : "Summary unconfirmed"
                }
              />
              {c.residentOutcome && (
                <Chip
                  value={c.residentOutcome}
                  label={`Resident ${c.residentOutcome}`}
                />
              )}
            </div>
            {residentEv.length > 0 && (
              <EvidenceList items={residentEv} state={state} />
            )}
          </div>
        )}
      </Card>
      {c.summary && (
        <Card title="Assistant output" aside={<AiBadge />}>
          <dl className="grid grid-cols-[120px_1fr] gap-1.5 text-sm">
            <dt className="text-muted-foreground">Category</dt>
            <dd>{c.summary.category}</dd>
            <dt className="text-muted-foreground">Rec. severity</dt>
            <dd>
              {c.summary.recommendedSeverity} · {c.summary.recommendedSlaHours}h
              SLA
            </dd>
            <dt className="text-muted-foreground">Rec. trade</dt>
            <dd>{c.summary.recommendedTrade}</dd>
            <dt className="text-muted-foreground">Confidence</dt>
            <dd>{Math.round(c.summary.confidence * 100)}%</dd>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            The assistant has no authority. Triage, authorization, verification,
            settlement and closure need a named human manager.
          </p>
        </Card>
      )}
      {!c.background && (
        <Card title="Decisions">
          <div className="space-y-3">
            {c.status === "NORMALIZED" && (
              <div className="space-y-2">
                <label className="text-xs font-medium">
                  Severity (your decision)
                </label>
                <select
                  className="w-full rounded-md border border-border bg-background p-2 text-sm"
                  value={sev}
                  onChange={(e) => setSeverity(e.target.value as Severity)}
                >
                  {(["EMERGENCY", "PRIORITY", "ROUTINE"] as const).map((s) => (
                    <option key={s} value={s}>
                      {s} · {slaFor(s)}h SLA
                    </option>
                  ))}
                </select>
                <Btn
                  className="w-full"
                  onClick={() =>
                    run(
                      {
                        type: "TRIAGE",
                        caseId: c.id,
                        severity: sev,
                        slaHours: slaFor(sev),
                      },
                      me,
                      "Case triaged.",
                    )
                  }
                >
                  Record triage
                </Btn>
              </div>
            )}
            {(c.status === "TRIAGED" || c.status === "DISPUTED") && (
              <div className="space-y-2">
                {c.status === "DISPUTED" && (
                  <p className="rounded border border-warning/40 bg-warning/10 p-2 text-sm">
                    Resident dispute: “{c.disputeReason}”
                  </p>
                )}
                <label className="text-xs font-medium">Authorized scope</label>
                <textarea
                  className="min-h-24 w-full rounded-md border border-border bg-background p-2 text-sm"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                />
                <Btn
                  className="w-full"
                  onClick={() =>
                    run(
                      { type: "AUTHORIZE_WORK", caseId: c.id, scope },
                      me,
                      "Work authorized. Work order created.",
                    )
                  }
                >
                  {c.status === "DISPUTED"
                    ? "Authorize follow-up work order"
                    : "Authorize work"}
                </Btn>
              </div>
            )}
            {wo?.status === "AUTHORIZED" && (
              <div className="space-y-2">
                <label className="text-xs font-medium">Assign technician</label>
                <select
                  className="w-full rounded-md border border-border bg-background p-2 text-sm"
                  value={worker}
                  onChange={(e) => setWorker(e.target.value)}
                >
                  {WORKERS.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <Btn
                  className="w-full"
                  onClick={() =>
                    run(
                      { type: "ASSIGN", woId: wo.id, workerId: worker },
                      me,
                      "Assigned. Task Pack sent to the technician.",
                    )
                  }
                >
                  Assign
                </Btn>
              </div>
            )}
            {wo &&
              ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"].includes(wo.status) && (
                <p className="text-sm text-muted-foreground">
                  Waiting on the technician (
                  {wo.status.replaceAll("_", " ").toLowerCase()}).
                </p>
              )}
            {wo?.status === "WORK_REPORTED_COMPLETE" && (
              <>
                <p className="text-sm">
                  The technician reports the work complete. This is{" "}
                  <strong>not verified</strong> until you review the evidence.
                </p>
                <Btn
                  className="w-full"
                  onClick={() => run({ type: "BEGIN_REVIEW", woId: wo.id }, me)}
                >
                  Begin evidence review
                </Btn>
              </>
            )}
            {wo?.status === "EVIDENCE_REVIEW" && (
              <div className="space-y-2">
                <EvidenceList
                  items={currentEvidence(state, wo.id)}
                  state={state}
                />
                {!reworkOpen ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Btn
                      onClick={() =>
                        run(
                          { type: "VERIFY", woId: wo.id },
                          me,
                          "Verified. The case is not closed yet.",
                        )
                      }
                    >
                      Verify work
                    </Btn>
                    <Btn variant="danger" onClick={() => setReworkOpen(true)}>
                      Require rework
                    </Btn>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      className="min-h-20 w-full rounded-md border border-border bg-background p-2 text-sm"
                      placeholder="Rework reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <button
                      className="text-xs text-primary underline"
                      onClick={() =>
                        setReason(
                          "After photo does not show the trap connection. Re-seat the washer and re-photograph.",
                        )
                      }
                    >
                      Use demo reason
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <Btn variant="ghost" onClick={() => setReworkOpen(false)}>
                        Cancel
                      </Btn>
                      <Btn
                        variant="danger"
                        onClick={() => {
                          const r = run(
                            { type: "REQUIRE_REWORK", woId: wo.id, reason },
                            me,
                            "Rework order issued to the same technician.",
                          );
                          if (r.ok) {
                            setReworkOpen(false);
                            setReason("");
                          }
                        }}
                      >
                        Issue rework
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
            )}
            {c.status === "VERIFIED" && (
              <>
                <p className="text-sm">
                  Verified. Resident outcome:{" "}
                  <strong>{c.residentOutcome ?? "pending"}</strong>.
                  Settlement-ready requires resident confirmation and reconciled
                  PMS effects.
                </p>
                <Btn
                  className="w-full"
                  onClick={() =>
                    run(
                      { type: "MARK_SETTLEMENT_READY", caseId: c.id },
                      me,
                      "Marked settlement-ready. No payment executed.",
                    )
                  }
                >
                  Mark settlement-ready
                </Btn>
              </>
            )}
            {(c.status === "SETTLEMENT_READY" || c.status === "CLOSED") && (
              <div className="space-y-2">
                {!c.receiptId ? (
                  <Btn
                    className="w-full"
                    onClick={() =>
                      run(
                        { type: "GENERATE_RECEIPT", caseId: c.id },
                        me,
                        "Receipt generated.",
                      )
                    }
                  >
                    Generate completion receipt
                  </Btn>
                ) : (
                  <Link
                    to="/receipt"
                    className="flex min-h-11 items-center justify-center rounded-md border border-success/40 bg-success/5 text-sm font-medium text-success"
                  >
                    View receipt {c.receiptId}
                  </Link>
                )}
                {c.status === "SETTLEMENT_READY" && (
                  <Btn
                    variant="secondary"
                    className="w-full"
                    onClick={() =>
                      run({ type: "CLOSE", caseId: c.id }, me, "Case closed.")
                    }
                  >
                    Close case
                  </Btn>
                )}
              </div>
            )}
            {c.status === "DRAFT" && (
              <p className="text-sm text-muted-foreground">
                Nothing to decide yet.
              </p>
            )}
            {c.status === "REPORTED" && (
              <p className="text-sm text-muted-foreground">
                The assistant is structuring the report.
              </p>
            )}
            {c.status === "NORMALIZED" && !c.summaryConfirmed && (
              <p className="text-xs text-muted-foreground">
                Triage is blocked until the resident confirms the summary.
              </p>
            )}
          </div>
        </Card>
      )}
      {c.woIds.length > 0 && (
        <Card title="Work orders (distinct from case)">
          <ul className="space-y-2">
            {c.woIds.map((id) => {
              const w = state.workOrders[id]!;
              return (
                <li
                  key={id}
                  className="rounded-md border border-border p-2.5 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">
                      {w.id} · rev {w.revision}
                    </span>
                    <div className="flex gap-1">
                      {w.supersededBy && <Chip value="SUPERSEDED" />}
                      <Chip value={w.status} />
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                    {w.scope}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Authorized by {w.authorizedBy}
                    {w.assigneeId ? ` · assignee ${w.assigneeId}` : ""}
                    {w.verifiedBy ? ` · verified by ${w.verifiedBy}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <PmsPanel />
    </div>
  );
}
