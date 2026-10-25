import { Link } from "react-router";
import { useInside, useReturnId } from "../api/queries";
import { useWorkspace } from "../components/Shell";
import { Button, Empty, ErrorNote, Loading, PageHeader, Plate, Table } from "../components/ui";
import { formatDuration, formatTime, purposeLabel } from "../lib/format";
import { destinationText } from "./EntryLog";

/** Visitors whose held ID has not been returned. Guards return IDs here. */
export function InsideNow() {
  const { sid, role } = useWorkspace();
  const inside = useInside(sid);
  const returnId = useReturnId(sid);
  const isGuard = role === "guard";

  return (
    <>
      <PageHeader title={`Inside now${inside.data ? ` · ${inside.data.length}` : ""}`} />
      <ErrorNote error={inside.error ?? returnId.error} />
      {inside.isPending ? (
        <Loading />
      ) : inside.data?.length === 0 ? (
        <Empty title="No visitors inside">Every held ID has been returned.</Empty>
      ) : (
        <Table
          head={[
            "Plate",
            "Destination",
            "Purpose",
            "Entered",
            "Inside for",
            ...(isGuard ? [""] : []),
          ]}
        >
          {inside.data?.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-3">
                <Link to={`../entries/${entry.id}`}>
                  <Plate plate={entry.plate} />
                </Link>
              </td>
              <td className="px-4 py-3">{destinationText(entry)}</td>
              <td className="px-4 py-3">
                {entry.visitor ? purposeLabel(entry.visitor.purpose) : ""}
              </td>
              <td className="px-4 py-3">{formatTime(entry.at)}</td>
              <td className="px-4 py-3 text-ink-soft">{formatDuration(entry.at)}</td>
              {isGuard && (
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="primary"
                    disabled={returnId.isPending && returnId.variables === entry.id}
                    onClick={() => returnId.mutate(entry.id)}
                  >
                    Return ID
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
