import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, Lock } from "lucide-react";
import { useDemo } from "@/domain/store";
import {
  WORKERS,
  currentEvidence,
  type Evidence,
  type EvidenceKind,
} from "@/domain/model";
import {
  Btn,
  Card,
  Chip,
  EvidenceList,
  PageTitle,
  fmtDateTime,
} from "@/components/wg/ui";

export const Route = createFileRoute("/worker")({
  head: () => ({
    meta: [
      { title: "Technician · Task Pack — Whitney Grove" },
      {
        name: "description",
        content:
          "Bounded task pack: accept, start, record evidence and report work complete.",
      },
      {
        property: "og:title",
        content: "Technician Task Pack · Whitney Grove Maintenance",
      },
      {
        property: "og:description",
        content: "Scoped work order execution with before and after evidence.",
      },
    ],
  }),
  component: WorkerPage,
});

function WorkerPage() {
  const { state, run } = useDemo();
  const [meId, setMeId] = useState(WORKERS[0]!.id);
  const me = WORKERS.find((w) => w.id === meId)!;
  const mine = Object.values(state.workOrders).filter(
    (w) => w.assigneeId === me.id && !w.supersededBy,
  );
  const [correcting, setCorrecting] = useState<Evidence | null>(null);
  return (
    <div className="space-y-4">
      <PageTitle eyebrow="Maintenance worker" title="My Task Packs" />
      <Card>
        <label className="text-xs font-medium">Signed in as (demo)</label>
        <select
          className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
          value={meId}
          onChange={(e) => setMeId(e.target.value)}
        >
          {WORKERS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </Card>
      {mine.length === 0 && (
        <Card>
          <p className="text-sm text-muted-foreground">
            No work orders are assigned to you. A manager must authorize and
            assign work first.
          </p>
        </Card>
      )}
      {mine.map((wo) => {
        const c = state.cases[wo.caseId]!;
        const ev = state.evidence.filter((e) => e.woId === wo.id);
        const cur = currentEvidence(state, wo.id);
        const add = (kind: EvidenceKind) => {
          const caption =
            kind === "BEFORE"
              ? "BEFORE: supply line wet at compression nut; P-trap washer degraded (simulated)"
              : "AFTER: new supply line and trap washer, dry after 10 min run (simulated)";
          run(
            {
              type: "ADD_EVIDENCE",
              woId: wo.id,
              kind,
              caption: correcting ? `${caption}, retaken` : caption,
              supersedes: correcting?.id,
            },
            me,
            correcting
              ? `Correction appended; ${correcting.id} kept as superseded.`
              : `${kind} evidence appended.`,
          );
          setCorrecting(null);
        };
        return (
          <div key={wo.id} className="space-y-4">
            <Card title="Task Pack" aside={<Chip value={wo.status} />}>
              <p className="font-mono text-xs text-muted-foreground">
                {wo.id} · revision {wo.revision}
              </p>
              <dl className="mt-2 grid grid-cols-[96px_1fr] gap-1.5 text-sm">
                <dt className="text-muted-foreground">Location</dt>
                <dd>
                  {c.unit} · {c.summary?.location ?? c.title}
                </dd>
                <dt className="text-muted-foreground">Issue</dt>
                <dd>{c.summary?.symptom ?? c.title}</dd>
                <dt className="text-muted-foreground">Priority</dt>
                <dd>
                  {c.severity}
                  {c.slaDueAt ? ` · due ${fmtDateTime(c.slaDueAt)}` : ""}
                </dd>
                <dt className="text-muted-foreground">Scope</dt>
                <dd className="whitespace-pre-line">{wo.scope}</dd>
                <dt className="text-muted-foreground">Access</dt>
                <dd>
                  Entry permitted 9:00 to 17:00. Resident notified by the office
                  (synthetic).
                </dd>
                <dt className="text-muted-foreground">Safety</dt>
                <dd>{c.summary?.safetyNote ?? "Standard PPE."}</dd>
              </dl>
              {wo.reworkReason && (
                <p className="mt-3 rounded border border-warning/40 bg-warning/10 p-2 text-sm">
                  <strong>Rework:</strong> {wo.reworkReason}
                </p>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" /> Not in your pack: resident contact
                details, costs, verification, settlement.
              </p>
            </Card>
            <Card title="Actions">
              <div className="space-y-2">
                {wo.status === "ASSIGNED" && (
                  <Btn
                    className="w-full"
                    onClick={() =>
                      run(
                        { type: "ACCEPT", woId: wo.id },
                        me,
                        "Assignment accepted.",
                      )
                    }
                  >
                    Accept assignment
                  </Btn>
                )}
                {wo.status === "ACCEPTED" && (
                  <Btn
                    className="w-full"
                    onClick={() =>
                      run({ type: "START", woId: wo.id }, me, "Work started.")
                    }
                  >
                    Start work
                  </Btn>
                )}
                {wo.status === "IN_PROGRESS" && (
                  <>
                    {correcting && (
                      <p className="rounded bg-muted p-2 text-xs">
                        Correcting {correcting.id} ({correcting.kind}). The
                        original stays in the record.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Btn
                        variant="secondary"
                        disabled={!!correcting && correcting.kind !== "BEFORE"}
                        onClick={() => add("BEFORE")}
                      >
                        <Camera className="h-4 w-4" /> Before photo
                      </Btn>
                      <Btn
                        variant="secondary"
                        disabled={!!correcting && correcting.kind !== "AFTER"}
                        onClick={() => add("AFTER")}
                      >
                        <Camera className="h-4 w-4" /> After photo
                      </Btn>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current: {cur.filter((e) => e.kind === "BEFORE").length}{" "}
                      before · {cur.filter((e) => e.kind === "AFTER").length}{" "}
                      after
                    </p>
                    <Btn
                      className="w-full"
                      onClick={() =>
                        run(
                          { type: "REPORT_COMPLETE", woId: wo.id },
                          me,
                          "Reported complete. Awaiting manager verification.",
                        )
                      }
                    >
                      Report work complete
                    </Btn>
                  </>
                )}
                {["WORK_REPORTED_COMPLETE", "EVIDENCE_REVIEW"].includes(
                  wo.status,
                ) && (
                  <>
                    <p className="text-sm">
                      Reported complete. A manager must verify. You cannot
                      verify your own work.
                    </p>
                    <Btn
                      variant="secondary"
                      className="w-full"
                      onClick={() => run({ type: "VERIFY", woId: wo.id }, me)}
                    >
                      Try to self-verify (will be denied)
                    </Btn>
                  </>
                )}
                {wo.status === "VERIFIED" && (
                  <p className="text-sm">
                    Verified by a manager. Nothing further for you.
                  </p>
                )}
                {wo.status === "AUTHORIZED" && (
                  <p className="text-sm text-muted-foreground">
                    Awaiting assignment.
                  </p>
                )}
              </div>
            </Card>
            <Card title="Evidence (append-only)">
              <EvidenceList
                items={ev}
                state={state}
                onCorrect={
                  wo.status === "IN_PROGRESS"
                    ? (e) => setCorrecting(e)
                    : undefined
                }
              />
            </Card>
          </div>
        );
      })}
    </div>
  );
}
