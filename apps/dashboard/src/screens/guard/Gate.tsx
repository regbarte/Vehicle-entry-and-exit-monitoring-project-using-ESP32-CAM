import type { ConfirmResult, Detection, Entry } from "@guardhouse/api-types";
import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import { useConfirm, useDismiss, useScan, useWaiting } from "../../api/queries";
import { CameraView } from "../../components/CameraView";
import { useWorkspace } from "../../components/Shell";
import { Button, ErrorNote, Plate } from "../../components/ui";
import { formatPlate, formatTime } from "../../lib/format";
import { playRegistered, startNotRegistered, stopNotRegistered } from "../../lib/sound";
import { VisitorForm } from "./VisitorForm";

type Outcome =
  | { kind: "registered"; result: ConfirmResult }
  | { kind: "visitor"; detection: Detection; plate: string }
  | { kind: "visitor-saved"; entry: Entry };

export function Gate() {
  const { sid, readOnly } = useWorkspace();
  const waiting = useWaiting(sid);
  const scan = useScan(sid);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const queue = waiting.data ?? [];
  const current = outcome ? null : queue[0];
  const next =
    outcome?.kind === "visitor"
      ? queue.filter((d) => d.id !== outcome.detection.id)
      : queue.slice(current ? 1 : 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="flex flex-col gap-4">
        <CameraView sid={sid} />
        <Button
          variant="primary"
          size="lg"
          disabled={readOnly || scan.isPending}
          onClick={() => scan.mutate()}
        >
          {scan.isPending ? "Scanning…" : "Scan"}
        </Button>
        <ErrorNote error={scan.error} />
        <WaitingList detections={next} />
      </section>

      <section aria-live="polite">
        {outcome?.kind === "registered" && (
          <RegisteredCard result={outcome.result} onNext={() => setOutcome(null)} />
        )}
        {outcome?.kind === "visitor" && (
          <VisitorForm
            detection={outcome.detection}
            plate={outcome.plate}
            onSaved={(entry) => setOutcome({ kind: "visitor-saved", entry })}
            onBack={() => setOutcome(null)}
          />
        )}
        {outcome?.kind === "visitor-saved" && (
          <VisitorSavedCard entry={outcome.entry} onNext={() => setOutcome(null)} />
        )}
        {!outcome && current && (
          <ConfirmPlate
            key={current.id}
            detection={current}
            readOnly={readOnly}
            onOutcome={setOutcome}
          />
        )}
        {!outcome && !current && <NoCar loading={waiting.isPending} />}
      </section>
    </div>
  );
}

function NoCar({ loading }: { loading: boolean }) {
  return (
    <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-line text-center">
      <p className="text-lg font-medium">{loading ? "Loading…" : "No car waiting"}</p>
      {!loading && (
        <p className="mt-1 max-w-xs text-sm text-ink-soft">
          When a car stops at the gate, press Scan to read its plate.
        </p>
      )}
    </div>
  );
}

function ConfirmPlate({
  detection,
  readOnly,
  onOutcome,
}: {
  detection: Detection;
  readOnly: boolean;
  onOutcome: (outcome: Outcome) => void;
}) {
  const { sid } = useWorkspace();
  const confirm = useConfirm(sid);
  const dismiss = useDismiss(sid);
  const [plate, setPlate] = useState(
    detection.plateReading ? formatPlate(detection.plateReading) : "",
  );
  const exact = detection.suggestions.some((s) => s.distance === 0);

  // A car with no exact registered match: sound the alarm until the guard confirms.
  useEffect(() => {
    if (!exact && !readOnly) startNotRegistered();
    return stopNotRegistered;
  }, [exact, readOnly]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!plate.trim()) return;
    // mutateAsync, not mutate callbacks: a registered confirm removes this detection
    // from the waiting list, which unmounts this form before per-call callbacks run.
    const result = await confirm
      .mutateAsync({ detectionId: detection.id, plate })
      .catch(() => null);
    if (!result) return;
    stopNotRegistered();
    if (result.verdict === "registered") {
      playRegistered();
      onOutcome({ kind: "registered", result });
    } else {
      onOutcome({ kind: "visitor", detection, plate: result.plate });
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5 rounded-lg border border-line bg-white p-6"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Confirm the plate</h2>
        <span className="text-sm text-ink-soft">Scanned {formatTime(detection.at)}</span>
      </div>

      <img
        src={detection.frameUrl}
        alt="The car at the gate, from the camera"
        className="h-56 w-full rounded-md bg-ink object-contain"
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="plate" className="text-sm font-medium">
          {detection.plateReading
            ? "Plate reading. Check it against the car, and correct it if needed."
            : "No plate found in the photo. Type the plate."}
        </label>
        <input
          id="plate"
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          autoComplete="off"
          spellCheck={false}
          // biome-ignore lint/a11y/noAutofocus: the guard's next action is always this field
          autoFocus
          className="h-16 rounded-md border-2 border-ink/30 bg-paper px-4 font-mono text-3xl font-semibold tracking-wider focus:border-teal focus:outline-none"
        />
      </div>

      {detection.suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-soft">
            {exact ? "In the registry" : "Close to a registered plate"}
          </span>
          <div className="flex flex-wrap gap-2">
            {detection.suggestions.map((s) => (
              <button
                type="button"
                key={s.plate}
                onClick={() => setPlate(s.plateDisplay)}
                className="flex items-center gap-3 rounded-md border border-line bg-paper px-3 py-2 text-left text-sm hover:border-teal"
              >
                <Plate plate={s.plate} />
                <span>
                  {s.houseLabel} · {s.ownerName}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ErrorNote error={confirm.error ?? dismiss.error} />

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={readOnly || confirm.isPending || !plate.trim()}
        >
          {confirm.isPending ? "Checking…" : "Confirm plate"}
        </Button>
        <Button
          variant="quiet"
          disabled={dismiss.isPending}
          onClick={() => dismiss.mutate(detection.id)}
          title="Drop this photo without saving an entry"
        >
          Dismiss
        </Button>
      </div>
    </form>
  );
}

function RegisteredCard({ result, onNext }: { result: ConfirmResult; onNext: () => void }) {
  const house = result.house;
  return (
    <div className="flex flex-col gap-6 rounded-lg bg-teal p-8 text-paper">
      <div>
        <p className="text-sm uppercase tracking-widest text-almond/80">Verdict</p>
        <p className="text-5xl font-semibold">Registered</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Plate plate={result.plate} size="xl" />
        {house && (
          <div>
            <p className="text-xl font-medium">{house.label}</p>
            <p className="text-almond">
              {house.ownerName}
              {house.street && ` · ${house.street}`}
            </p>
          </div>
        )}
      </div>
      <p className="text-sm text-almond/80">
        Entry saved at {result.entry ? formatTime(result.entry.at) : "—"}.
      </p>
      <Button variant="secondary" size="lg" onClick={onNext} className="self-start">
        Next car
      </Button>
    </div>
  );
}

function VisitorSavedCard({ entry, onNext }: { entry: Entry; onNext: () => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-white p-8">
      <p className="text-2xl font-semibold">Visitor entry saved</p>
      <p className="text-ink-soft">
        <Plate plate={entry.plate} /> to{" "}
        {entry.visitor?.destination.kind === "block"
          ? `Block ${entry.visitor.destination.block}`
          : entry.visitor?.destination.label}
        . Keep the ID until they leave, then return it from{" "}
        <Link to="../today" className="text-teal underline">
          Inside now on Today
        </Link>
        .
      </p>
      <Button variant="primary" size="lg" onClick={onNext} className="self-start">
        Next car
      </Button>
    </div>
  );
}

function WaitingList({ detections }: { detections: Detection[] }) {
  if (detections.length === 0) return null;
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="mb-3 text-sm font-medium">Waiting list · {detections.length}</p>
      <ul className="flex flex-col gap-2">
        {detections.map((d) => (
          <li key={d.id} className="flex items-center justify-between text-sm">
            {d.plateReading ? <Plate plate={d.plateReading} /> : <span>No plate found</span>}
            <span className="text-ink-soft">{formatTime(d.at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
