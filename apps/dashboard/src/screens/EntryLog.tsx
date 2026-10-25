import type { Entry } from "@guardhouse/api-types";
import { useState } from "react";
import { useNavigate } from "react-router";
import type { EntryFilters } from "../api/keys";
import { useEntries } from "../api/queries";
import { useWorkspace } from "../components/Shell";
import {
  Empty,
  ErrorNote,
  Field,
  Input,
  Loading,
  PageHeader,
  Plate,
  Select,
  Table,
  VerdictBadge,
} from "../components/ui";
import { formatDateTime, manilaToday, purposeLabel } from "../lib/format";

export function destinationText(entry: Entry): string {
  if (entry.verdict === "registered") return entry.houseLabel ?? "";
  const destination = entry.visitor?.destination;
  if (!destination) return "";
  return destination.kind === "block" ? `Block ${destination.block}` : destination.label;
}

export function EntryLog() {
  const { sid } = useWorkspace();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<EntryFilters>({ date: manilaToday() });
  const entries = useEntries(sid, filters);
  const set = (patch: Partial<EntryFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <>
      <PageHeader title="Entry log" />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Field label="Plate">
          <Input
            value={filters.plate ?? ""}
            onChange={(e) => set({ plate: e.target.value })}
            placeholder="NBC 1234"
            className="w-40 font-mono uppercase"
          />
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={filters.date ?? ""}
            onChange={(e) => set({ date: e.target.value })}
          />
        </Field>
        <Field label="Verdict">
          <Select
            value={filters.verdict ?? ""}
            onChange={(e) =>
              set({ verdict: (e.target.value || undefined) as EntryFilters["verdict"] })
            }
          >
            <option value="">All</option>
            <option value="registered">Registered</option>
            <option value="visitor">Visitors</option>
          </Select>
        </Field>
        {filters.date && (
          <button
            type="button"
            onClick={() => set({ date: "" })}
            className="h-10 text-sm text-teal underline"
          >
            Any date
          </button>
        )}
      </div>

      <ErrorNote error={entries.error} />
      {entries.isPending ? (
        <Loading />
      ) : entries.data?.length === 0 ? (
        <Empty title="No entries match">Change the plate, date or verdict filter.</Empty>
      ) : (
        <Table head={["Time", "Plate", "Verdict", "House or destination", "Purpose", "Exit"]}>
          {entries.data?.map((entry) => (
            <tr
              key={entry.id}
              onClick={() => navigate(entry.id)}
              className="cursor-pointer hover:bg-paper"
            >
              <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(entry.at)}</td>
              <td className="px-4 py-3">
                <Plate plate={entry.plate} />
              </td>
              <td className="px-4 py-3">
                <VerdictBadge verdict={entry.verdict} />
              </td>
              <td className="px-4 py-3">{destinationText(entry)}</td>
              <td className="px-4 py-3">
                {entry.visitor ? purposeLabel(entry.visitor.purpose) : ""}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                {entry.visitor
                  ? entry.visitor.exitAt
                    ? formatDateTime(entry.visitor.exitAt)
                    : "Inside"
                  : ""}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
