import { Link } from "react-router";
import { useInside, useReturnId } from "../api/queries";
import { useWorkspace } from "../components/Shell";
import { Button, Empty, ErrorNote, Loading, Plate } from "../components/ui";
import { formatDuration, formatTime, purposeLabel } from "../lib/format";
import { destinationText } from "./EntryLog";

/** Visitors whose held ID has not been returned. Guard screens only. */
export function InsideNowList() {
  const { sid } = useWorkspace();
  const inside = useInside(sid);
  const returnId = useReturnId(sid);

  if (inside.isPending) return <Loading />;
  return (
    <div className="flex flex-col gap-3">
      <ErrorNote error={inside.error ?? returnId.error} />
      {inside.data?.length === 0 ? (
        <Empty title="No visitors inside">Every held ID has been returned.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {inside.data?.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <Link to={`../entries/${entry.id}`}>
                <Plate plate={entry.plate} />
              </Link>
              <span className="text-sm">
                {entry.visitor ? purposeLabel(entry.visitor.purpose) : ""} ·{" "}
                {destinationText(entry)}
              </span>
              <span className="text-xs text-ink-soft">
                In since {formatTime(entry.at)} ({formatDuration(entry.at)})
              </span>
              <Button
                variant="primary"
                className="ml-auto"
                disabled={returnId.isPending && returnId.variables === entry.id}
                onClick={() => returnId.mutate(entry.id)}
              >
                Return ID
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
