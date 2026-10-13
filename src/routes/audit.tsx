import { createFileRoute, Link } from "@tanstack/react-router";
import { useDemo } from "@/domain/store";
import {
  ACTORS,
  MAIN_CASE_ID,
  unresolvedEffects,
  type Action,
  type Actor,
} from "@/domain/model";
import {
  Btn,
  Card,
  Chip,
  EvidenceList,
  PageTitle,
  Timeline,
} from "@/components/wg/ui";
import { PmsPanel } from "@/components/wg/PmsPanel";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Operations · Audit trail — Whitney Grove" },
      {
        name: "description",
        content:
          "Append-only event chain, authority basis, verification, settlement readiness and PMS reconciliation.",
      },
      {
        property: "og:title",
        content: "Audit Trail · Whitney Grove Maintenance",
      },
      {
        property: "og:description",
        content:
          "Immutable-style timeline, receipts and mock Yardi reconciliation.",
      },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { state, run } = useDemo();
  const c = state.cases[MAIN_CASE_ID]!;
  const wo = c.currentWoId ? state.workOrders[c.currentWoId] : undefined;
  const unresolved = unresolvedEffects(state, c.id);
  const checks: [string, boolean][] = [
    [
      "Current work order VERIFIED by a non-performer",
      wo?.status === "VERIFIED" && wo.verifiedBy !== wo.assigneeId,
    ],
    ["Resident confirmed outcome", c.residentOutcome === "CONFIRMED"],
    ["No unreconciled PMS effects", unresolved.length === 0],
    [
      "Case is SETTLEMENT_READY",
      c.status === "SETTLEMENT_READY" || c.status === "CLOSED",
    ],
  ];
  const woId = c.currentWoId ?? "WG-WO-1042-R1";
  const probes: [string, Action, Actor][] = [
    [
      "AI tries to authorize work",
      {
        type: "AUTHORIZE_WORK",
        caseId: c.id,
        scope: "AI-proposed scope for leak",
      },
      ACTORS.ai,
    ],
    ["Worker tries to verify", { type: "VERIFY", woId }, ACTORS.worker1],
    [
      "Worker tries settlement-ready",
      { type: "MARK_SETTLEMENT_READY", caseId: c.id },
      ACTORS.worker1,
    ],
    [
      "Resident tries to close",
      { type: "CLOSE", caseId: c.id },
      ACTORS.resident,
    ],
    ["Unassigned tech tries to start", { type: "START", woId }, ACTORS.worker2],
    [
      "Manager tries settlement-ready now",
      { type: "MARK_SETTLEMENT_READY", caseId: c.id },
      ACTORS.manager,
    ],
  ];
  return (
    <div className="space-y-4">
      <PageTitle eyebrow="Operations / Audit" title="Audit and reconciliation">
        {ACTORS.ops.name}
      </PageTitle>
      <Card title="Status" aside={<Chip value={c.status} />}>
        <dl className="grid grid-cols-[130px_1fr] gap-1.5 text-sm">
          <dt className="text-muted-foreground">Case</dt>
          <dd className="font-mono text-xs">{c.id}</dd>
          <dt className="text-muted-foreground">Work order</dt>
          <dd className="font-mono text-xs">
            {wo ? `${wo.id} (${wo.status})` : "none"}
          </dd>
          <dt className="text-muted-foreground">Verification</dt>
          <dd>
            {wo?.verifiedBy ? (
              <Chip value="VERIFIED" label={`Verified by ${wo.verifiedBy}`} />
            ) : (
              <Chip value="DRAFT" label="Not verified" />
            )}
          </dd>
          <dt className="text-muted-foreground">PMS reconciliation</dt>
          <dd>
            {state.effects.filter((e) => e.caseId === c.id).length === 0 ? (
              <Chip value="N/A" label="No effects" />
            ) : unresolved.length ? (
              <Chip value="UNKNOWN" label={`${unresolved.length} unresolved`} />
            ) : (
              <Chip value="OK" label="Reconciled" />
            )}
          </dd>
        </dl>
      </Card>
      <Card title="Settlement readiness">
        <ul className="space-y-1.5 text-sm">
          {checks.map(([l, ok]) => (
            <li key={l} className="flex items-center justify-between gap-2">
              <span>{l}</span>
              <Chip
                value={ok ? "OK" : "DRAFT"}
                label={ok ? "Pass" : "Pending"}
              />
            </li>
          ))}
        </ul>
        <div className="mt-3">
          {c.receiptId ? (
            <Link
              to="/receipt"
              className="flex min-h-11 items-center justify-center rounded-md border border-success/40 bg-success/5 text-sm font-medium text-success"
            >
              View receipt {c.receiptId}
            </Link>
          ) : (
            <Btn
              variant="secondary"
              className="w-full"
              onClick={() =>
                run(
                  { type: "GENERATE_RECEIPT", caseId: c.id },
                  ACTORS.ops,
                  "Receipt generated.",
                )
              }
            >
              Generate completion receipt
            </Btn>
          )}
        </div>
      </Card>
      <PmsPanel interactive />
      <Card title="Authorization probes">
        <p className="mb-3 text-xs text-muted-foreground">
          These buttons send real requests to the rules engine as the wrong
          actor. Each refusal is enforced and written to the timeline. The
          buttons are not just hidden.
        </p>
        <div className="grid gap-2">
          {probes.map(([l, a, actor]) => (
            <Btn
              key={l}
              variant="secondary"
              className="justify-start text-left"
              onClick={() =>
                run(a, actor, "Allowed (the current state permits this actor).")
              }
            >
              {l}
            </Btn>
          ))}
        </div>
      </Card>
      <Card title="Evidence ledger">
        <EvidenceList items={state.evidence} state={state} />
      </Card>
      <Card title="Event timeline">
        <Timeline events={state.events} />
      </Card>
    </div>
  );
}
