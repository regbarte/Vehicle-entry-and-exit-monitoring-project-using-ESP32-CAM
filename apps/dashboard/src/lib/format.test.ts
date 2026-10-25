import { describe, expect, it } from "vitest";
import { formatDuration, formatPlate, manilaToday } from "./format";

describe("formatPlate", () => {
  it("puts a space between the letters and digits", () => {
    expect(formatPlate("NBC1234")).toBe("NBC 1234");
  });
  it("leaves other shapes alone", () => {
    expect(formatPlate("1234AB")).toBe("1234AB");
  });
});

describe("manilaToday", () => {
  it("uses Manila time, eight hours ahead of UTC", () => {
    expect(manilaToday(new Date("2026-10-24T17:30:00Z"))).toBe("2026-10-25");
  });
});

describe("formatDuration", () => {
  it("shows hours and minutes", () => {
    const now = Date.parse("2026-10-25T10:05:00Z");
    expect(formatDuration("2026-10-25T08:00:00Z", now)).toBe("2 h 05 min");
    expect(formatDuration("2026-10-25T09:53:00Z", now)).toBe("12 min");
  });
});
