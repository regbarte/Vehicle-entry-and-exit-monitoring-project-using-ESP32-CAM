// Where each house sits on the subdivision grid. The registry stores no coordinates,
// so the grid comes from each house's block and lot: one square cluster of lots per
// block, with an empty row or column of street between blocks. One unit is one lot.

export type LotRef = { id: string; block: string; lot: string };

export type PlacedLot = { col: number; row: number; block: string };
export type PlacedBlock = { block: string; col: number; row: number; cols: number; rows: number };

export type GridLayout = {
  lots: Map<string, PlacedLot>;
  blocks: PlacedBlock[];
  /** Width and depth of the whole grid, in lots. */
  cols: number;
  rows: number;
};

const natural = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/** Blocks are laid out in rows about twice as wide as they are deep. */
function blocksPerRow(blockCount: number): number {
  return Math.max(1, Math.min(blockCount, Math.ceil(Math.sqrt(blockCount * 2))));
}

export function layoutHouses(houses: LotRef[]): GridLayout {
  const byBlock = new Map<string, LotRef[]>();
  for (const house of houses) {
    const block = house.block.trim();
    byBlock.set(block, [...(byBlock.get(block) ?? []), house]);
  }
  const names = [...byBlock.keys()].sort(natural);
  if (names.length === 0) return { lots: new Map(), blocks: [], cols: 0, rows: 0 };

  // Every block gets the same footprint, sized for the fullest one.
  const fullest = Math.max(...[...byBlock.values()].map((lots) => lots.length));
  const blockCols = Math.ceil(Math.sqrt(fullest));
  const blockRows = Math.ceil(fullest / blockCols);
  const perRow = blocksPerRow(names.length);

  const lots = new Map<string, PlacedLot>();
  const blocks: PlacedBlock[] = [];
  names.forEach((block, i) => {
    const col = (i % perRow) * (blockCols + 1);
    const row = Math.floor(i / perRow) * (blockRows + 1);
    blocks.push({ block, col, row, cols: blockCols, rows: blockRows });
    [...(byBlock.get(block) ?? [])]
      .sort((a, b) => natural(a.lot, b.lot) || natural(a.id, b.id))
      .forEach((house, n) => {
        lots.set(house.id, {
          block,
          col: col + (n % blockCols),
          row: row + Math.floor(n / blockCols),
        });
      });
  });

  const across = Math.min(perRow, names.length);
  const down = Math.ceil(names.length / perRow);
  return {
    lots,
    blocks,
    cols: across * blockCols + (across - 1),
    rows: down * blockRows + (down - 1),
  };
}

/** The numbers behind one house's bar. */
export type GridHouse = {
  id: string;
  col: number;
  row: number;
  registered: number;
  visitors: number;
  hasVehicle: boolean;
};

export const totalOf = (house: Pick<GridHouse, "registered" | "visitors">) =>
  house.registered + house.visitors;

/** Bar heights in lots. The busiest house reaches `maxHeight`; any entry shows at least `min`. */
export function barHeights(
  houses: Pick<GridHouse, "registered" | "visitors">[],
  maxHeight = 4,
  min = 0.15,
) {
  const busiest = Math.max(1, ...houses.map(totalOf));
  const height = (count: number) =>
    count === 0 ? 0 : Math.max(min, (count / busiest) * maxHeight);
  return (house: Pick<GridHouse, "registered" | "visitors">) => ({
    registered: height(house.registered),
    visitors: height(house.visitors),
  });
}
