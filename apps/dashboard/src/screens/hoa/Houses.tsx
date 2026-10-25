import type { House } from "@guardhouse/api-types";
import { type FormEvent, useState } from "react";
import { useAddHouse, useEditHouse, useHouses, useRemoveHouse } from "../../api/queries";
import { HousesTable } from "../../components/HousesTable";
import { useWorkspace } from "../../components/Shell";
import { Button, Empty, ErrorNote, Field, Input, Loading, PageHeader } from "../../components/ui";

type Editing = { mode: "add" } | { mode: "edit"; house: House } | null;

export function Houses() {
  const { sid, readOnly } = useWorkspace();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const houses = useHouses(sid, q);
  const remove = useRemoveHouse(sid);

  const confirmRemove = (house: House) => {
    if (
      window.confirm(
        `Remove ${house.label} (${house.ownerName}) from the registry? Past entries keep their copy.`,
      )
    )
      remove.mutate(house.id);
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div>
        <PageHeader
          title={`Houses${houses.data && !q ? ` · ${houses.data.length}` : ""}`}
          actions={
            !readOnly && (
              <Button variant="primary" onClick={() => setEditing({ mode: "add" })}>
                Add house
              </Button>
            )
          }
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by plate, owner, block or lot"
          aria-label="Search houses"
          className="mb-4 w-full max-w-md"
        />
        <ErrorNote error={houses.error ?? remove.error} />
        {houses.isPending ? (
          <Loading />
        ) : houses.data?.length === 0 ? (
          <Empty title={q ? `Nothing matches “${q}”` : "No houses yet"}>
            {q ? "" : "Add each house in the subdivision, with or without a car."}
          </Empty>
        ) : (
          <HousesTable
            houses={houses.data ?? []}
            actions={
              readOnly
                ? undefined
                : (house) => (
                    <>
                      <Button variant="quiet" onClick={() => setEditing({ mode: "edit", house })}>
                        Edit
                      </Button>
                      <Button variant="quiet" onClick={() => confirmRemove(house)}>
                        Remove
                      </Button>
                    </>
                  )
            }
          />
        )}
      </div>
      {editing && (
        <HouseForm
          key={editing.mode === "edit" ? editing.house.id : "add"}
          house={editing.mode === "edit" ? editing.house : null}
          onDone={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function HouseForm({ house, onDone }: { house: House | null; onDone: () => void }) {
  const { sid } = useWorkspace();
  const add = useAddHouse(sid);
  const edit = useEditHouse(sid);
  const [form, setForm] = useState({
    block: house?.block ?? "",
    lot: house?.lot ?? "",
    street: house?.street ?? "",
    ownerName: house?.ownerName ?? "",
    contact: house?.contact ?? "",
    plate: house?.vehicle?.plateDisplay ?? "",
  });
  const set = (field: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));
  const pending = add.isPending || edit.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = { ...form, plate: form.plate.trim() || null };
    if (house) edit.mutate({ id: house.id, body }, { onSuccess: onDone });
    else add.mutate(body, { onSuccess: onDone });
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 self-start rounded-lg border border-line bg-white p-6 xl:sticky xl:top-6"
    >
      <h2 className="text-lg font-semibold">{house ? `Edit ${house.label}` : "Add a house"}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Block">
          <Input value={form.block} onChange={set("block")} required />
        </Field>
        <Field label="Lot">
          <Input value={form.lot} onChange={set("lot")} required />
        </Field>
      </div>
      <Field label="Street">
        <Input value={form.street} onChange={set("street")} />
      </Field>
      <Field label="Owner" hint="The registered owner, or the representative they named.">
        <Input value={form.ownerName} onChange={set("ownerName")} required />
      </Field>
      <Field label="Contact number">
        <Input value={form.contact} onChange={set("contact")} inputMode="tel" />
      </Field>
      <Field label="Registered vehicle plate" hint="Leave empty if the house has no car.">
        <Input
          value={form.plate}
          onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))}
          className="font-mono"
          placeholder="NBC 1234"
        />
      </Field>
      <ErrorNote error={add.error ?? edit.error} />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : house ? "Save changes" : "Add house"}
        </Button>
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
