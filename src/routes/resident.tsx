import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Camera } from "lucide-react";
import { useDemo } from "@/domain/store";
import {
  ACTORS,
  MAIN_CASE_ID,
  SEEDED_PHOTO_CAPTION,
  SEEDED_REPORT_TEXT,
} from "@/domain/model";
import {
  AiBadge,
  Btn,
  Card,
  CaseHeader,
  PageTitle,
  Stepper,
} from "@/components/wg/ui";

export const Route = createFileRoute("/resident")({
  head: () => ({
    meta: [
      { title: "Resident · Report an issue — Whitney Grove" },
      {
        name: "description",
        content:
          "Report a maintenance issue, review the AI summary and track the repair.",
      },
      { property: "og:title", content: "Resident · Whitney Grove Maintenance" },
      {
        property: "og:description",
        content: "Report, confirm, track and accept or dispute a repair.",
      },
    ],
  }),
  component: ResidentPage,
});

function ResidentPage() {
  const { state, run } = useDemo();
  const me = ACTORS.resident;
  const c = state.cases[MAIN_CASE_ID]!;
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");

  const submit = () => {
    const r = run(
      {
        type: "SUBMIT_REPORT",
        caseId: c.id,
        text,
        photoCaption: photo ? SEEDED_PHOTO_CAPTION : undefined,
      },
      me,
    );
    if (r.ok)
      run(
        { type: "AI_NORMALIZE", caseId: c.id },
        ACTORS.ai,
        "Report submitted. Review the summary below.",
      );
  };

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="Resident · Unit 3B" title="My maintenance request" />
      {c.status !== "DRAFT" && <CaseHeader c={c} state={state} />}

      {c.status === "DRAFT" && (
        <Card title="Describe the problem">
          <textarea
            className="min-h-32 w-full rounded-md border border-border bg-background p-3 text-sm"
            placeholder="Tell us what's wrong, in your own words…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="mt-1 text-xs font-medium text-primary underline"
            onClick={() => setText(SEEDED_REPORT_TEXT)}
          >
            Use seeded demo text
          </button>
          <div className="mt-3">
            {photo ? (
              <div className="flex items-center gap-3 rounded-md border border-border p-2">
                <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="flex-1 text-sm">{SEEDED_PHOTO_CAPTION}</p>
                <button
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setPhoto(false)}
                >
                  Remove
                </button>
              </div>
            ) : (
              <Btn
                variant="secondary"
                className="w-full"
                onClick={() => setPhoto(true)}
              >
                <Camera className="h-4 w-4" /> Attach photo (simulated)
              </Btn>
            )}
          </div>
          <Btn className="mt-4 w-full" onClick={submit}>
            Submit report
          </Btn>
        </Card>
      )}

      {c.summary && c.status === "NORMALIZED" && !c.summaryConfirmed && (
        <Card title="Please check this summary" aside={<AiBadge />}>
          <Summary c={c} />
          <p className="mt-3 text-xs text-muted-foreground">
            The assistant only organizes your report. Your property manager
            decides priority and authorizes any work.
          </p>
          <Btn
            className="mt-3 w-full"
            onClick={() =>
              run(
                { type: "CONFIRM_SUMMARY", caseId: c.id },
                me,
                "Thanks. Your manager has been notified.",
              )
            }
          >
            Confirm summary is accurate
          </Btn>
        </Card>
      )}

      {c.status === "VERIFIED" && !c.residentOutcome && (
        <Card title="Your manager verified the repair">
          <p className="text-sm">Is the problem fixed?</p>
          {!disputing ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Btn
                onClick={() =>
                  run(
                    { type: "CONFIRM_OUTCOME", caseId: c.id },
                    me,
                    "Thanks for confirming.",
                  )
                }
              >
                Yes, it's fixed
              </Btn>
              <Btn variant="danger" onClick={() => setDisputing(true)}>
                No, dispute
              </Btn>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                className="min-h-20 w-full rounded-md border border-border bg-background p-2 text-sm"
                placeholder="What's still wrong?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
                className="text-xs text-primary underline"
                onClick={() =>
                  setReason(
                    "Still dripping slowly from the trap after an hour of use.",
                  )
                }
              >
                Use demo reason
              </button>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="ghost" onClick={() => setDisputing(false)}>
                  Cancel
                </Btn>
                <Btn
                  variant="danger"
                  onClick={() => {
                    const r = run(
                      { type: "DISPUTE", caseId: c.id, reason },
                      me,
                      "Dispute recorded. Your case is reopened.",
                    );
                    if (r.ok) setDisputing(false);
                  }}
                >
                  Submit dispute
                </Btn>
              </div>
            </div>
          )}
        </Card>
      )}

      {c.residentOutcome === "CONFIRMED" && c.status === "VERIFIED" && (
        <Card>
          <p className="text-sm">
            You confirmed the repair. Your manager will finalize the record.
          </p>
        </Card>
      )}
      {c.status === "DISPUTED" && (
        <Card>
          <p className="text-sm">
            Your dispute was recorded: “{c.disputeReason}”. The manager will
            authorize follow-up work.
          </p>
        </Card>
      )}
      {c.receiptId && (
        <Link
          to="/receipt"
          className="block rounded-lg border border-success/40 bg-success/5 p-4 text-sm font-medium text-success"
        >
          View completion receipt {c.receiptId} →
        </Link>
      )}

      {c.status !== "DRAFT" && (
        <Card title="Progress">
          <Stepper c={c} state={state} />
        </Card>
      )}
      {c.summary && c.summaryConfirmed && (
        <Card title="Summary you confirmed" aside={<AiBadge />}>
          <Summary c={c} />
        </Card>
      )}
    </div>
  );
}

function Summary({
  c,
}: {
  c: NonNullable<ReturnType<typeof useDemo>["state"]["cases"][string]>;
}) {
  const s = c.summary!;
  const rows: [string, string][] = [
    ["Category", s.category],
    ["Location", s.location],
    ["Issue", s.symptom],
    [
      "Suggested priority",
      `${s.recommendedSeverity} · ${s.recommendedSlaHours}h`,
    ],
    ["Safety", s.safetyNote],
  ];
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
