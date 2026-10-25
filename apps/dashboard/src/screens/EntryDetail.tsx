import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useEntry, useReturnId } from "../api/queries";
import { useWorkspace } from "../components/Shell";
import { Button, ErrorNote, Loading, Plate, VerdictBadge } from "../components/ui";
import { formatDateTime, formatPlate, purposeLabel } from "../lib/format";
import { destinationText } from "./EntryLog";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-4 py-2.5">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function EntryDetail() {
  const { sid, role } = useWorkspace();
  const { entryId = "" } = useParams();
  const entry = useEntry(sid, entryId);
  const returnId = useReturnId(sid);

  if (entry.isPending) return <Loading />;
  if (entry.isError) return <ErrorNote error={entry.error} />;
  const e = entry.data;
  const inside = e.visitor && !e.visitor.exitAt;

  return (
    <div className="flex flex-col gap-6">
      <Link to=".." relative="path" className="text-sm text-teal underline">
        Back to the entry log
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <Plate plate={e.plate} size="xl" />
        <VerdictBadge verdict={e.verdict} />
        {inside && role === "guard" && (
          <Button
            variant="primary"
            className="ml-auto"
            disabled={returnId.isPending}
            onClick={() => returnId.mutate(e.id)}
          >
            Return ID
          </Button>
        )}
      </div>
      <ErrorNote error={returnId.error} />

      <div className="grid gap-8 lg:grid-cols-2">
        <dl className="divide-y divide-line rounded-lg border border-line bg-white px-5">
          <Row label="Entered">{formatDateTime(e.at)}</Row>
          <Row label={e.verdict === "registered" ? "House" : "Destination"}>
            {destinationText(e)}
          </Row>
          {e.visitor && <Row label="Purpose">{purposeLabel(e.visitor.purpose)}</Row>}
          {e.visitor && (
            <Row label="Exit">
              {e.visitor.exitAt
                ? formatDateTime(e.visitor.exitAt)
                : role === "guard"
                  ? "Not yet exited, ID held"
                  : "Not yet exited"}
            </Row>
          )}
          <Row label="Plate reading">
            {e.plateRaw ? (
              <span className="font-mono">{e.plateRaw}</span>
            ) : (
              <span className="text-ink-soft">No plate found; the guard typed it</span>
            )}
            {e.plateRaw && formatPlate(e.plate) !== e.plateRaw && (
              <span className="ml-2 text-sm text-ink-soft">(corrected by the guard)</span>
            )}
          </Row>
        </dl>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Photo src={e.frameUrl} label="Gate camera" />
          {e.visitor && <Photo src={e.visitor.idPhotoUrl} label="ID photo" />}
        </div>
      </div>
    </div>
  );
}

function Photo({ src, label }: { src: string | null; label: string }) {
  return (
    <figure className="flex flex-col gap-1.5">
      {src ? (
        <img src={src} alt={label} className="aspect-4/3 w-full rounded-md bg-ink object-cover" />
      ) : (
        <div className="flex aspect-4/3 items-center justify-center rounded-md border border-dashed border-line text-sm text-ink-soft">
          No photo
        </div>
      )}
      <figcaption className="text-xs text-ink-soft">{label}</figcaption>
    </figure>
  );
}
