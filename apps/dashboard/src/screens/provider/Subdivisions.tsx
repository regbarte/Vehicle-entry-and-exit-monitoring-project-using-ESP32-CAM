import type { SubdivisionSummary } from "@guardhouse/api-types";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  useCreateSubdivision,
  useSubdivision,
  useSubdivisions,
  useUpdateSubdivision,
} from "../../api/queries";
import {
  Button,
  Empty,
  ErrorNote,
  Field,
  Input,
  Loading,
  PageHeader,
  Table,
} from "../../components/ui";
import { saveSession } from "../../lib/session";

function ProviderShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen">
      <header className="bg-ink text-almond">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-3">
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-paper">Guardhouse</span>
            <span className="text-xs text-almond/70">Provider</span>
          </div>
          <Link to="/provider" className="text-sm text-almond/85 hover:text-paper">
            Subdivisions
          </Link>
          <button
            type="button"
            onClick={() => {
              saveSession(null);
              navigate("/");
            }}
            className="ml-auto text-xs text-almond/70 hover:text-paper"
          >
            Switch role
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

/** Status and counts only. The provider never sees houses, entries or photos. */
export function Subdivisions() {
  const subdivisions = useSubdivisions();
  return (
    <ProviderShell>
      <PageHeader
        title="Subdivisions"
        actions={
          <Link
            to="/provider/new"
            className="inline-flex h-10 items-center rounded-md bg-teal px-4 text-sm font-medium text-paper hover:bg-teal-deep"
          >
            Add subdivision
          </Link>
        }
      />
      <ErrorNote error={subdivisions.error} />
      {subdivisions.isPending ? (
        <Loading />
      ) : subdivisions.data?.length === 0 ? (
        <Empty title="No subdivisions yet">
          Add the first one to give its guard a gate screen.
        </Empty>
      ) : (
        <Table head={["Subdivision", "Status", "Camera", "Houses", ""]}>
          {subdivisions.data?.map((s) => (
            <SubdivisionRow key={s.id} subdivision={s} />
          ))}
        </Table>
      )}
    </ProviderShell>
  );
}

function SubdivisionRow({ subdivision: s }: { subdivision: SubdivisionSummary }) {
  const update = useUpdateSubdivision(s.id);
  const toggle = () => {
    const verb = s.active ? "Deactivate" : "Reactivate";
    const effect = s.active
      ? "Its guard and HOA officer can still view records, but can't save entries or change the registry."
      : "Its guard can scan and save entries again.";
    if (window.confirm(`${verb} ${s.name}? ${effect}`)) update.mutate({ active: !s.active });
  };
  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium">{s.name}</p>
        {s.address && <p className="text-xs text-ink-soft">{s.address}</p>}
        {update.error && <ErrorNote error={update.error} />}
      </td>
      <td className="px-4 py-3">
        {s.active ? (
          <span className="text-teal">Active</span>
        ) : (
          <span className="text-clay-deep">Inactive</span>
        )}
      </td>
      <td className="px-4 py-3">
        {s.active ? (
          s.cameraOnline ? (
            "Online"
          ) : (
            "Offline"
          )
        ) : (
          <span className="text-ink-soft">—</span>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums">{s.houseCount}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <Link to={`/provider/${s.id}/edit`} className="mr-2 text-sm text-teal underline">
          Edit
        </Link>
        <Button
          variant={s.active ? "danger" : "secondary"}
          onClick={toggle}
          disabled={update.isPending}
        >
          {s.active ? "Deactivate" : "Reactivate"}
        </Button>
      </td>
    </tr>
  );
}

export function NewSubdivision() {
  const navigate = useNavigate();
  const create = useCreateSubdivision();
  return (
    <ProviderShell>
      <SubdivisionForm
        title="Add a subdivision"
        submitLabel="Add subdivision"
        initial={{ name: "", address: "", cameraUrl: "http://guardcam.local" }}
        pending={create.isPending}
        error={create.error}
        onSubmit={(body) => create.mutate(body, { onSuccess: () => navigate("/provider") })}
      />
    </ProviderShell>
  );
}

export function EditSubdivision({ sid }: { sid: string }) {
  const navigate = useNavigate();
  const subdivision = useSubdivision(sid);
  const update = useUpdateSubdivision(sid);
  return (
    <ProviderShell>
      {subdivision.isPending ? (
        <Loading />
      ) : subdivision.isError ? (
        <ErrorNote error={subdivision.error} />
      ) : (
        <SubdivisionForm
          title={`Edit ${subdivision.data.name}`}
          submitLabel="Save changes"
          initial={subdivision.data}
          pending={update.isPending}
          error={update.error}
          onSubmit={(body) => update.mutate(body, { onSuccess: () => navigate("/provider") })}
        />
      )}
    </ProviderShell>
  );
}

type FormValues = { name: string; address: string; cameraUrl: string };

function SubdivisionForm({
  title,
  submitLabel,
  initial,
  pending,
  error,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  initial: FormValues;
  pending: boolean;
  error: unknown;
  onSubmit: (values: FormValues) => void;
}) {
  const [form, setForm] = useState<FormValues>({
    name: initial.name,
    address: initial.address,
    cameraUrl: initial.cameraUrl,
  });
  const set = (field: keyof FormValues) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(form);
  };
  return (
    <form onSubmit={submit} className="flex max-w-lg flex-col gap-4">
      <PageHeader title={title} />
      <Field label="Name">
        <Input value={form.name} onChange={set("name")} required />
      </Field>
      <Field label="Address">
        <Input value={form.address} onChange={set("address")} />
      </Field>
      <Field label="Camera address" hint="The gate's ESP32-CAM on the guardhouse hotspot.">
        <Input value={form.cameraUrl} onChange={set("cameraUrl")} required className="font-mono" />
      </Field>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link to="/provider" className="inline-flex h-10 items-center px-4 text-sm text-ink-soft">
          Cancel
        </Link>
      </div>
    </form>
  );
}
