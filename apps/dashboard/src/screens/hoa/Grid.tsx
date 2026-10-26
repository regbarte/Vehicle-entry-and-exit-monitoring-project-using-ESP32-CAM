import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router";
import type { StatsDays } from "../../api/keys";
import { useHouseStats, useHouses } from "../../api/queries";
import { PLAN_TINTS, PlanGrid } from "../../components/PlanGrid";
import { useWorkspace } from "../../components/Shell";
import {
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Loading,
  PageHeader,
  Plate,
  Segmented,
  Select,
  StatTile,
} from "../../components/ui";
import { type GridHouse, layoutHouses, totalOf } from "../../lib/grid";

// three.js is large and only this screen needs it.
const SubdivisionGrid3D = lazy(() => import("../../components/SubdivisionGrid3D"));

const WINDOWS: { value: StatsDays; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
];
const VIEWS = [
  { value: "3d", label: "3D" },
  { value: "plan", label: "Plan" },
] as const;
type View = (typeof VIEWS)[number]["value"];

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The HOA officer's subdivision grid: every house, shaded or built up by its gate entries. */
export function Grid() {
  const { sid } = useWorkspace();
  const [days, setDays] = useState<StatsDays>(7);
  const [view, setView] = useState<View>(() => (supportsWebGL() ? "3d" : "plan"));
  // The house the officer picked. Until then, the card shows the busiest house.
  const [picked, setPicked] = useState<string | null>(null);

  const housesQuery = useHouses(sid, "");
  const stats = useHouseStats(sid, days);
  const registry = useMemo(() => housesQuery.data ?? [], [housesQuery.data]);

  const layout = useMemo(
    () => layoutHouses(registry.map((h) => ({ id: h.id, block: h.block, lot: h.lot }))),
    [registry],
  );
  const counts = useMemo(
    () => new Map((stats.data?.houses ?? []).map((h) => [h.houseId, h])),
    [stats.data],
  );
  const grid = useMemo<GridHouse[]>(
    () =>
      registry.flatMap((house) => {
        const at = layout.lots.get(house.id);
        if (!at) return [];
        return {
          id: house.id,
          col: at.col,
          row: at.row,
          registered: counts.get(house.id)?.registered ?? 0,
          visitors: counts.get(house.id)?.visitors ?? 0,
          hasVehicle: house.vehicle !== null,
        };
      }),
    [registry, layout, counts],
  );
  const byId = useMemo(() => new Map(registry.map((h) => [h.id, h])), [registry]);
  const labels = useMemo(() => new Map(registry.map((h) => [h.id, h.label])), [registry]);
  const descriptions = useMemo(
    () =>
      new Map(
        grid.map((g) => [
          g.id,
          `${byId.get(g.id)?.label}, ${byId.get(g.id)?.residenceLabel}, ${plural(g.registered, "registered entry", "registered entries")}, ${plural(g.visitors, "visitor", "visitors")}`,
        ]),
      ),
    [grid, byId],
  );

  const busiest = grid.reduce<GridHouse | undefined>(
    (best, g) => (!best || totalOf(g) > totalOf(best) ? g : best),
    undefined,
  );
  const mostVisited = grid.reduce<GridHouse | undefined>(
    (best, g) => (!best || g.visitors > best.visitors ? g : best),
    undefined,
  );
  const quiet = grid.filter((g) => totalOf(g) === 0).length;
  const pickedId = picked && byId.has(picked) ? picked : null;
  const shownId = pickedId ?? busiest?.id ?? null;
  const shown = shownId ? byId.get(shownId) : undefined;
  const shownCounts = grid.find((g) => g.id === shownId);

  const blockVisitors = useMemo(() => {
    const byBlock = new Map(layout.blocks.map((b) => [b.block, 0]));
    for (const b of stats.data?.blocks ?? []) {
      const name = b.block.trim();
      byBlock.set(name, (byBlock.get(name) ?? 0) + b.visitors);
    }
    return [...byBlock].map(([block, visitors]) => ({ block, visitors }));
  }, [layout, stats.data]);
  const mostBlockVisitors = Math.max(1, ...blockVisitors.map((b) => b.visitors));

  const pick = (id: string) => setPicked((now) => (now === id ? null : id));
  const label = (g: GridHouse | undefined) => (g ? (labels.get(g.id) ?? "") : "None");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Subdivision grid" />
      <ErrorNote error={housesQuery.error ?? stats.error} />
      {housesQuery.isPending ? (
        <Loading />
      ) : registry.length === 0 ? (
        <Empty title="No houses yet">
          <Link to="../houses" className="text-teal underline">
            Add houses to the registry
          </Link>{" "}
          and they appear here.
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Busiest house"
              value={label(busiest)}
              note={
                busiest && totalOf(busiest) > 0
                  ? `${byId.get(busiest.id)?.residenceLabel} · ${plural(totalOf(busiest), "entry", "entries")}`
                  : "No entries yet"
              }
            />
            <StatTile
              label="Most visitors received"
              value={label(mostVisited && mostVisited.visitors > 0 ? mostVisited : undefined)}
              note={
                mostVisited && mostVisited.visitors > 0
                  ? plural(mostVisited.visitors, "visitor", "visitors")
                  : "No visitors named a house"
              }
            />
            <StatTile
              label="Houses with no entries"
              value={quiet}
              note={`of ${registry.length}, last ${days} days`}
            />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <Card
              title={`Entries per house, last ${days} days`}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Segmented label="View" options={[...VIEWS]} value={view} onChange={setView} />
                  <Segmented
                    label="Time window"
                    options={WINDOWS}
                    value={days}
                    onChange={setDays}
                  />
                </div>
              }
            >
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                {view === "3d" ? (
                  <>
                    <li className="flex items-center gap-2">
                      <span aria-hidden="true" className="size-3 rounded-sm bg-chart-1" />
                      Registered
                    </li>
                    <li className="flex items-center gap-2">
                      <span aria-hidden="true" className="size-3 rounded-sm bg-chart-2" />
                      Visitors
                    </li>
                  </>
                ) : (
                  <li className="flex items-center gap-2">
                    Fewer entries
                    {PLAN_TINTS.map((color) => (
                      <span
                        key={color}
                        aria-hidden="true"
                        className="size-4 rounded-sm"
                        style={{ background: color }}
                      />
                    ))}
                    More entries
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-4 rounded-sm border-2 border-dashed border-ink-faint bg-almond"
                  />
                  House with no vehicle
                </li>
              </ul>

              {view === "3d" ? (
                <div
                  role="img"
                  aria-label={`${registry.length} houses in ${layout.blocks.length} blocks, drawn as bars. Use the plan view for the numbers.`}
                  className="h-[28rem] w-full min-w-0 touch-none md:h-[34rem]"
                >
                  <Suspense fallback={<Loading />}>
                    <SubdivisionGrid3D
                      layout={layout}
                      houses={grid}
                      labels={labels}
                      selectedId={pickedId}
                      onSelect={pick}
                    />
                  </Suspense>
                </div>
              ) : (
                <PlanGrid
                  layout={layout}
                  houses={grid}
                  descriptions={descriptions}
                  selectedId={pickedId}
                  onSelect={pick}
                />
              )}
              <p className="text-sm text-ink-soft">
                {view === "3d"
                  ? "Drag to rotate and scroll to zoom. Click a house to see its details and fade the rest; click it again to show all."
                  : "The number in each square is that house's entries. Darker squares have more."}
              </p>

              <details className="text-sm">
                <summary className="cursor-pointer text-teal underline">Show as a table</summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left">
                    <caption className="pb-1.5 text-left text-xs text-ink-soft">
                      The ten houses with the most entries, last {days} days
                    </caption>
                    <thead className="text-xs text-ink-soft">
                      <tr>
                        {["House", "Owner", "Registered", "Visitors", "Total"].map((h) => (
                          <th key={h} scope="col" className="py-1 pr-4 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {[...grid]
                        .sort((a, b) => totalOf(b) - totalOf(a))
                        .slice(0, 10)
                        .map((g) => (
                          <tr key={g.id} className="border-t border-line">
                            <td className="py-1 pr-4">{labels.get(g.id)}</td>
                            <td className="py-1 pr-4">{byId.get(g.id)?.ownerName}</td>
                            <td className="py-1 pr-4">{g.registered}</td>
                            <td className="py-1 pr-4">{g.visitors}</td>
                            <td className="py-1 pr-4 font-medium">{totalOf(g)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </Card>

            <aside className="flex flex-col gap-6">
              <Card
                title="Selected house"
                actions={
                  pickedId && (
                    <Button size="md" onClick={() => setPicked(null)}>
                      Show all houses
                    </Button>
                  )
                }
              >
                <Field label="Jump to a house">
                  <Select
                    value={pickedId ?? ""}
                    onChange={(e) => setPicked(e.target.value || null)}
                  >
                    <option value="">Busiest house</option>
                    {registry.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.label} · {h.ownerName}
                      </option>
                    ))}
                  </Select>
                </Field>
                {shown && shownCounts && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-xl font-semibold">{shown.label}</p>
                      <p>{shown.residenceLabel}</p>
                      <p className="text-sm text-ink-soft">
                        {shown.ownerName}
                        {shown.street ? ` · ${shown.street}` : ""}
                      </p>
                    </div>
                    {shown.vehicle ? (
                      <div>
                        <Plate plate={shown.vehicle.plate} />
                      </div>
                    ) : (
                      <p className="text-sm text-ink-soft">No vehicle</p>
                    )}
                    <ul className="flex flex-col gap-2 tabular-nums">
                      <li className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true" className="size-3 rounded-sm bg-chart-1" />
                          Registered entries
                        </span>
                        <strong>{shownCounts.registered}</strong>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true" className="size-3 rounded-sm bg-chart-2" />
                          Visitors received
                        </span>
                        <strong>{shownCounts.visitors}</strong>
                      </li>
                    </ul>
                    <Link to="../houses" className="text-sm text-teal underline">
                      Open houses
                    </Link>
                  </div>
                )}
              </Card>

              <Card title="Visitors headed to a block">
                <p className="-mt-2 text-sm text-ink-soft">
                  Deliveries and others who named a block, not a house. Last {days} days.
                </p>
                <ul className="flex flex-col gap-3">
                  {blockVisitors.map((b) => (
                    <li key={b.block} className="flex flex-col gap-1.5">
                      <span className="flex justify-between">
                        <span>Block {b.block}</span>
                        <strong className="tabular-nums">{b.visitors}</strong>
                      </span>
                      <span className="block h-3 rounded bg-muted">
                        <span
                          className="block h-3 rounded bg-chart-2"
                          style={{ width: `${(b.visitors / mostBlockVisitors) * 100}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
