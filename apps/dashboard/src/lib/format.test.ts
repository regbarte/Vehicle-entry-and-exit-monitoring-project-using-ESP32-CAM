import { describe, expect, it } from "vitest";
import { formatDuration, formatHour, formatPlate, localToday } from "./format";

describe("formatPlate", () => {
  it("puts a space between the letters and digits", () => {
    expect(formatPlate("NBC1234")).toBe("NBC 1234");
  });
  it("leaves other shapes alone", () => {
    expect(formatPlate("1234AB")).toBe("1234AB");
  });
});

describe("localToday", () => {
  it("formats the local date as YYYY-MM-DD", () => {
    expect(localToday(new Date(2026, 9, 25, 23, 30))).toBe("2026-10-25");
  });
});

describe("formatHour", () => {
  it("uses a 12-hour clock", () => {
    expect(formatHour(0)).toBe("12 AM");
    expect(formatHour(7)).toBe("7 AM");
    expect(formatHour(12)).toBe("12 PM");
    expect(formatHour(21)).toBe("9 PM");
  });
});

describe("formatDuration", () => {
  it("shows hours and minutes", () => {
    const now = Date.parse("2026-10-25T10:05:00Z");
    expect(formatDuration("2026-10-25T08:00:00Z", now)).toBe("2 h 05 min");
    expect(formatDuration("2026-10-25T09:53:00Z", now)).toBe("12 min");
  });
});
