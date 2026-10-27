import { useBarrier, useBarrierCommand } from "../api/queries";
import { Button, ErrorNote } from "./ui";

const LABELS = { open: "Open", closed: "Closed", unknown: "Not connected" } as const;

/** The boom barrier's state, and buttons to open or close it. The state only
 * changes when the SSE `barrier` event arrives, after the Arduino has moved. */
export function BarrierControl({ sid, readOnly }: { sid: string; readOnly: boolean }) {
  const barrier = useBarrier(sid);
  const command = useBarrierCommand(sid);
  const state = barrier.data?.state ?? "unknown";
  const busy = readOnly || command.isPending;

  return (
    <section aria-label="Barrier" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <p aria-live="polite" className="mr-auto font-medium">
          Barrier: {LABELS[state]}
        </p>
        <Button
          variant="primary"
          disabled={busy || state !== "closed"}
          onClick={() => command.mutate("open")}
        >
          Open barrier
        </Button>
        <Button disabled={busy || state !== "open"} onClick={() => command.mutate("close")}>
          Close barrier
        </Button>
      </div>
      <ErrorNote error={command.error ?? barrier.error} />
    </section>
  );
}
