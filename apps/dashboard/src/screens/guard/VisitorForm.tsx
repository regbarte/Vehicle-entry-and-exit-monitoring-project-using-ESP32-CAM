import type { Detection, Entry, House, Purpose } from "@guardhouse/api-types";
import { type FormEvent, useState } from "react";
import { useHouses, useSaveVisitor } from "../../api/queries";
import { useWorkspace } from "../../components/Shell";
import { Button, ErrorNote, Field, Input, Plate } from "../../components/ui";
import { WebcamCapture } from "../../components/WebcamCapture";
import { PURPOSES } from "../../lib/format";

type DestinationKind = "block" | "residence";

// Delivery riders usually give a block; guests usually name a residence.
const SUGGESTED_KIND: Record<Purpose, DestinationKind> = {
  delivery: "block",
  guest: "residence",
  service: "block",
  other: "block",
};

export function VisitorForm({
  detection,
  plate,
  onSaved,
  onBack,
}: {
  detection: Detection;
  plate: string;
  onSaved: (entry: Entry) => void;
  onBack: () => void;
}) {
  const { sid, readOnly } = useWorkspace();
  const save = useSaveVisitor(sid);
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [kind, setKind] = useState<DestinationKind>("block");
  const [block, setBlock] = useState("");
  const [residence, setResidence] = useState<House | null>(null);
  const [idPhoto, setIdPhoto] = useState<Blob | null>(null);

  const choosePurpose = (value: Purpose) => {
    setPurpose(value);
    setKind(SUGGESTED_KIND[value]);
  };

  const destinationReady = kind === "block" ? block.trim() !== "" : residence !== null;
  const ready = purpose !== null && destinationReady && !readOnly;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!purpose || !destinationReady) return;
    save.mutate(
      {
        detectionId: detection.id,
        plate,
        purpose,
        destination:
          kind === "block"
            ? { kind: "block", block: block.trim() }
            : { kind: "residence", houseId: residence?.id ?? "" },
        idPhoto,
      },
      { onSuccess: onSaved },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-6 rounded-lg border border-line bg-white p-6"
    >
      <div className="flex flex-wrap items-center gap-4 rounded-md bg-clay-wash px-4 py-3">
        <span className="text-2xl font-semibold text-clay-deep">Not registered</span>
        <Plate plate={plate} />
        <button
          type="button"
          onClick={onBack}
          className="ml-auto text-sm text-ink-soft underline hover:text-ink"
        >
          Wrong plate? Go back
        </button>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Purpose</legend>
        <div className="grid grid-cols-4 gap-2">
          {PURPOSES.map((p) => (
            <button
              type="button"
              key={p.value}
              aria-pressed={purpose === p.value}
              onClick={() => choosePurpose(p.value)}
              className={`h-11 rounded-md border text-sm font-medium ${
                purpose === p.value
                  ? "border-teal bg-teal text-paper"
                  : "border-ink/20 bg-white hover:border-ink/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Destination</legend>
        <div className="flex gap-1 self-start rounded-md bg-paper p-1 text-sm">
          {(["block", "residence"] as const).map((k) => (
            <button
              type="button"
              key={k}
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`rounded px-3 py-1.5 ${kind === k ? "bg-white font-medium shadow-sm" : "text-ink-soft"}`}
            >
              {k === "block" ? "A block" : "A residence"}
            </button>
          ))}
        </div>
        {kind === "block" ? (
          <Field label="Block number">
            <Input
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              inputMode="numeric"
              placeholder="19"
              className="w-32"
            />
          </Field>
        ) : (
          <ResidencePicker value={residence} onChange={setResidence} />
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">ID photo</span>
        <WebcamCapture photo={idPhoto} onChange={setIdPhoto} />
      </div>

      <ErrorNote error={save.error} />

      <Button type="submit" variant="primary" size="lg" disabled={!ready || save.isPending}>
        {save.isPending ? "Saving…" : idPhoto ? "Save visitor entry" : "Save without ID photo"}
      </Button>
    </form>
  );
}

function ResidencePicker({
  value,
  onChange,
}: {
  value: House | null;
  onChange: (house: House | null) => void;
}) {
  const { sid } = useWorkspace();
  const [q, setQ] = useState("");
  const houses = useHouses(sid, q);

  if (value)
    return (
      <div className="flex items-center justify-between rounded-md border border-teal bg-teal-wash px-4 py-3">
        <div>
          <p className="font-medium">{value.residenceLabel}</p>
          <p className="text-sm text-ink-soft">{value.label}</p>
        </div>
        <Button variant="quiet" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by family name, block or lot"
        aria-label="Search residences"
      />
      <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-md border border-line">
        {(houses.data ?? []).map((house) => (
          <li key={house.id}>
            <button
              type="button"
              onClick={() => onChange(house)}
              className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-paper"
            >
              <span className="font-medium">{house.residenceLabel}</span>
              <span className="text-ink-soft">{house.label}</span>
            </button>
          </li>
        ))}
        {houses.data?.length === 0 && (
          <li className="px-3 py-2 text-sm text-ink-soft">No house matches “{q}”.</li>
        )}
      </ul>
    </div>
  );
}
