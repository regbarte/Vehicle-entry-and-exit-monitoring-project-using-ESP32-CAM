import { describe, expect, it } from "vitest";
import { barHeights, layoutHouses } from "./grid";

const lots = (block: string, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `${block}-${i + 1}`, block, lot: String(i + 1) }));

describe("layoutHouses", () => {
  it("returns an empty grid for no houses", () => {
    expect(layoutHouses([])).toEqual({ lots: new Map(), blocks: [], cols: 0, rows: 0 });
  });

  it("puts every house on its own cell", () => {
    const houses = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((b) => lots(String(b), 16));
    const layout = layoutHouses(houses);
    const cells = [...layout.lots.values()].map((p) => `${p.col},${p.row}`);
    expect(cells).toHaveLength(128);
    expect(new Set(cells).size).toBe(128);
  });

  it("lays 8 blocks of 16 lots in two rows of four, with a street between", () => {
    const layout = layoutHouses([1, 2, 3, 4, 5, 6, 7, 8].flatMap((b) => lots(String(b), 16)));
    expect(layout.cols).toBe(19);
    expect(layout.rows).toBe(9);
    expect(layout.blocks.map((b) => [b.block, b.col, b.row])).toEqual([
      ["1", 0, 0],
      ["2", 5, 0],
      ["3", 10, 0],
      ["4", 15, 0],
      ["5", 0, 5],
      ["6", 5, 5],
      ["7", 10, 5],
      ["8", 15, 5],
    ]);
  });

  it("orders blocks and lots by number, not by text", () => {
    const layout = layoutHouses([
      ...lots("10", 1),
      ...lots("2", 1),
      { id: "a", block: "2", lot: "10" },
      { id: "b", block: "2", lot: "9" },
    ]);
    expect(layout.blocks.map((b) => b.block)).toEqual(["2", "10"]);
    const lot = (id: string) => layout.lots.get(id);
    // Lot 9 comes before lot 10 inside block 2.
    expect((lot("b")?.row ?? 0) * 100 + (lot("b")?.col ?? 0)).toBeLessThan(
      (lot("a")?.row ?? 0) * 100 + (lot("a")?.col ?? 0),
    );
  });

  it("keeps a lone house in a 1 by 1 grid", () => {
    const layout = layoutHouses(lots("5", 1));
    expect(layout).toMatchObject({ cols: 1, rows: 1 });
    expect(layout.lots.get("5-1")).toEqual({ block: "5", col: 0, row: 0 });
  });

  it("sizes every block for the fullest one", () => {
    const layout = layoutHouses([...lots("1", 9), ...lots("2", 2)]);
    expect(layout.blocks.map((b) => [b.cols, b.rows])).toEqual([
      [3, 3],
      [3, 3],
    ]);
  });
});

describe("barHeights", () => {
  it("makes the busiest house the tallest and stacks visitors on top", () => {
    const height = barHeights(
      [
        { registered: 8, visitors: 2 },
        { registered: 2, visitors: 0 },
      ],
      4,
    );
    expect(height({ registered: 8, visitors: 2 })).toEqual({ registered: 3.2, visitors: 0.8 });
    expect(height({ registered: 2, visitors: 0 })).toEqual({ registered: 0.8, visitors: 0 });
  });

  it("keeps a single entry visible and handles an empty window", () => {
    expect(barHeights([{ registered: 1, visitors: 0 }])({ registered: 1, visitors: 0 })).toEqual({
      registered: 4,
      visitors: 0,
    });
    const quiet = barHeights([{ registered: 0, visitors: 0 }]);
    expect(quiet({ registered: 0, visitors: 0 })).toEqual({ registered: 0, visitors: 0 });
    const lopsided = barHeights([
      { registered: 100, visitors: 0 },
      { registered: 1, visitors: 0 },
    ]);
    expect(lopsided({ registered: 1, visitors: 0 }).registered).toBe(0.15);
  });
});
