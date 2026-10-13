import { useDemo } from "@/domain/store";
import { ACTORS, type PmsMode } from "@/domain/model";
import { Btn, Card, Chip } from "./ui";

export function PmsPanel({ interactive }: { interactive?: boolean }) {
  const { state, run } = useDemo();
  const ops = ACTORS.ops;
  return (
    <Card
      title="Yardi (PMS) · mock adapter"
      aside={<Chip value="DRAFT" label="Mock · no live connection" />}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        System of record for work orders. Each write carries an idempotency key.
        If a response times out, the write is held as UNKNOWN and must be
        reconciled before any retry.
      </p>
      {interactive && (
        <div className="mb-3">
          <label className="text-xs font-medium">
            Next write behavior (fault injection)
          </label>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
            value={state.pmsMode}
            onChange={(e) =>
              run(
                { type: "SET_PMS_MODE", mode: e.target.value as PmsMode },
                ops,
                "Fault mode set for next PMS write.",
              )
            }
          >
            <option value="NORMAL">Normal: write confirmed</option>
            <option value="TIMEOUT_AFTER_WRITE">
              Timeout after write (PMS has it)
            </option>
            <option value="TIMEOUT_BEFORE_WRITE">
              Timeout before write (PMS lacks it)
            </option>
          </select>
        </div>
      )}
      {state.effects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No outbound effects yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {state.effects.map((e) => (
            <li key={e.id} className="rounded-md border border-border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {e.kind.replaceAll("_", " ")}
                </span>
                <Chip value={e.status} />
              </div>
              <p className="break-all font-mono text-[10.5px] text-muted-foreground">
                {e.id} · key {e.key} · attempts {e.attempts}
                {e.externalRef ? ` · ${e.externalRef}` : ""}
              </p>
              {interactive && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Btn
                    variant="secondary"
                    className="min-h-9 px-3 text-xs"
                    onClick={() =>
                      run(
                        { type: "RECONCILE_EFFECT", effectId: e.id },
                        ops,
                        "Reconciliation query complete.",
                      )
                    }
                  >
                    Reconcile
                  </Btn>
                  <Btn
                    variant="secondary"
                    className="min-h-9 px-3 text-xs"
                    onClick={() =>
                      run(
                        { type: "RETRY_EFFECT", effectId: e.id },
                        ops,
                        "Retry confirmed.",
                      )
                    }
                  >
                    Retry
                  </Btn>
                  <Btn
                    variant="ghost"
                    className="min-h-9 px-3 text-xs"
                    onClick={() =>
                      run(
                        { type: "REPLAY_EFFECT", effectId: e.id },
                        ops,
                        "Replay deduplicated by idempotency key.",
                      )
                    }
                  >
                    Replay same key
                  </Btn>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
