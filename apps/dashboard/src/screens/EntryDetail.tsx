import { type ReactNode, useEffect, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    // The viewer covers the page, so Escape should always close it.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <figure className="flex flex-col gap-1.5">
        {src ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group relative overflow-hidden rounded-md bg-ink text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            aria-label={`View ${label} full size`}
          >
            <img src={src} alt={label} className="aspect-4/3 w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-ink/85 px-3 py-2 text-center text-sm font-medium text-paper transition-colors group-hover:bg-teal group-focus-visible:bg-teal">
              Click to view photo
            </span>
          </button>
        ) : (
          <div className="flex aspect-4/3 items-center justify-center rounded-md border border-dashed border-line text-sm text-ink-soft">
            No photo
          </div>
        )}
        <figcaption className="text-xs text-ink-soft">{label}</figcaption>
      </figure>

      {open && src && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} full-size photo`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4 sm:p-8"
        >
          {/* Clicking anywhere outside the photo closes it. Keyboards use Close or Escape. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="pointer-events-none relative flex h-full w-full flex-col gap-3">
            <div className="flex items-center justify-between text-paper">
              <p className="text-lg font-semibold">{label}</p>
              <button
                ref={closeButton}
                type="button"
                onClick={() => setOpen(false)}
                className="pointer-events-auto rounded-md border border-paper/40 px-4 py-2 font-medium hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
              >
                Close
              </button>
            </div>
            <img
              src={src}
              alt={`${label} full size`}
              className="pointer-events-auto min-h-0 flex-1 self-center rounded-md object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
