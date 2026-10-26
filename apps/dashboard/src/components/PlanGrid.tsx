// The subdivision grid seen from above: one square per house, shaded by its entries.
// It is the view for keyboards and screen readers, and for a laptop without WebGL.

import { type GridHouse, type GridLayout, totalOf } from "../lib/grid";

const TINTS = [
  "bg-[#d5e4e5] text-ink",
  "bg-[#a3c5c8] text-ink",
  "bg-[#3f737b] text-white",
  "bg-teal text-white",
];

type Props = {
  layout: GridLayout;
  houses: GridHouse[];
  /** The accessible name of each house's square, by house id. */
  descriptions: Map<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** Which of four shades a house gets: the quartile of its entries among houses with a vehicle. */
function tinter(houses: GridHouse[]) {
  const totals = houses
    .filter((h) => h.hasVehicle)
    .map(totalOf)
    .sort((a, b) => a - b);
  const at = (p: number) => totals[Math.floor(p * (totals.length - 1))] ?? 0;
  const [q1, q2, q3] = [at(0.25), at(0.5), at(0.75)];
  return (n: number) => (n <= q1 ? 0 : n <= q2 ? 1 : n <= q3 ? 2 : 3);
}

export function PlanGrid({ layout, houses, descriptions, selectedId, onSelect }: Props) {
  const tint = tinter(houses);
  return (
    <div
      className="mx-auto grid w-full max-w-4xl gap-1"
      style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}
    >
      {layout.blocks.map((b) => (
        <div
          key={`pad-${b.block}`}
          aria-hidden="true"
          className="-m-1 rounded-lg bg-[#efeadf]"
          style={{
            gridColumn: `${b.col + 1} / span ${b.cols}`,
            gridRow: `${b.row + 2} / span ${b.rows}`,
          }}
        />
      ))}
      {layout.blocks.map((b) => (
        <div
          key={`label-${b.block}`}
          className="pb-2 text-sm font-medium"
          style={{ gridColumn: `${b.col + 1} / span ${b.cols}`, gridRow: b.row + 1 }}
        >
          Block {b.block}
        </div>
      ))}
      {houses.map((house) => {
        const total = totalOf(house);
        const picked = house.id === selectedId;
        const look = house.hasVehicle
          ? `${TINTS[tint(total)]} ${picked ? "border-3 border-ink" : "border-2 border-transparent"}`
          : `bg-almond text-ink ${picked ? "border-3 border-ink" : "border-2 border-dashed border-ink-faint"}`;
        return (
          <button
            key={house.id}
            type="button"
            aria-label={descriptions.get(house.id)}
            aria-pressed={picked}
            onClick={() => onSelect(house.id)}
            className={`aspect-square rounded-md font-mono text-sm font-semibold tabular-nums transition-[opacity,background-color,color] duration-300 motion-reduce:transition-none ${selectedId && !picked ? "opacity-40" : ""} ${look}`}
            style={{ gridColumn: house.col + 1, gridRow: house.row + 2 }}
          >
            {total > 0 ? total : ""}
          </button>
        );
      })}
    </div>
  );
}

/** The four shades, lightest first, for the legend. */
export const PLAN_TINTS = ["#d5e4e5", "#a3c5c8", "#3f737b", "#1e555c"];
