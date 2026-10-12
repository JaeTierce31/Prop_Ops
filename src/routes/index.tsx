import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, ShieldCheck, User, Wrench, ChevronRight } from "lucide-react";
import { useDemo } from "@/domain/store";
import { MAIN_CASE_ID, metrics, stageOf } from "@/domain/model";
import { Card, Chip, PageTitle } from "@/components/wg/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Whitney Grove Maintenance MVP — Governed demo" },
      { name: "description", content: "One governed multifamily maintenance transaction, end to end, with synthetic data." },
      { property: "og:title", content: "Whitney Grove Maintenance MVP" },
      { property: "og:description", content: "Resident, manager, technician and audit roles for one governed work order." },
    ],
  }),
  component: Index,
});

const ROLES = [
  { to: "/resident", label: "Resident", desc: "Report the leak, confirm the AI summary, accept or dispute the result", icon: User },
  { to: "/manager", label: "Manager / Dispatcher", desc: "Triage, authorize, assign, verify or require rework", icon: ClipboardList },
  { to: "/worker", label: "Maintenance Worker", desc: "Task Pack, accept, start, before/after evidence, report complete", icon: Wrench },
  { to: "/audit", label: "Operations / Audit", desc: "Event chain, settlement readiness, PMS reconciliation, receipt", icon: ShieldCheck },
] as const;

const SCRIPT = [
  "Resident: use the seeded report, attach the photo, submit, confirm the summary",
  "Manager: triage, authorize work, assign D. Rivera",
  "Worker: accept, start, add before and after photos, report complete",
  "Manager: begin review, then verify (or require rework)",
  "Resident: confirm outcome (or dispute to reopen)",
  "Manager: mark settlement-ready, generate receipt",
  "Audit: inspect timeline, PMS effects, receipt",
];

function Index() {
  const { state, now } = useDemo();
  const c = state.cases[MAIN_CASE_ID]!;
  const m = metrics(state, now);
  return (
    <div className="space-y-4">
      <PageTitle eyebrow="Governed maintenance demo" title="Whitney Grove Maintenance MVP">
        One routine plumbing case taken from report to settlement-ready. All people and data are synthetic.
      </PageTitle>
      <Card title="Seeded scenario" aside={<Chip value={stageOf(state, c)} />}>
        <p className="font-mono text-xs text-muted-foreground">{c.id}</p>
        <p className="font-semibold">{c.title}</p>
        <p className="text-sm text-muted-foreground">{c.unit}</p>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[
            ["Open", m.open],
            ["SLA risk", m.slaRisk],
            ["Await verify", m.awaitingVerification],
            ["Settle-ready", m.settlementReady],
          ].map(([l, v]) => (
            <div key={l} className="rounded-md bg-muted p-2">
              <p className="text-lg font-semibold">{v}</p>
              <p className="text-[10.5px] text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </Card>
      <div className="space-y-2">
        {ROLES.map(({ to, label, desc, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm hover:border-primary/40">
            <Icon className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-semibold">{label}</p>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
      <Card title="Demo walkthrough">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {SCRIPT.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
