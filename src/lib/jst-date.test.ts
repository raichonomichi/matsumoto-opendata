import { describe, expect, it } from "vitest";
import { getJstDateParts } from "./jst-date";

describe("getJstDateParts", () => {
  it("switches calendar day accurately across UTC/JST midnight boundary", () => {
    // 2026-12-31 14:59:59Z == 2026-12-31 23:59:59 JST (Thursday = 4)
    const justBeforeMidnight = getJstDateParts(
      new Date("2026-12-31T14:59:59Z"),
    );
    expect(justBeforeMidnight).toEqual({
      year: 2026,
      month: 12,
      day: 31,
      weekday: 4,
      minutesOfDay: 23 * 60 + 59,
      ymd: "2026-12-31",
      mmdd: "12-31",
      nthOfWeekday: 5,
    });

    // 2026-12-31 15:00:00Z == 2027-01-01 00:00:00 JST (Friday = 5)
    const midnight = getJstDateParts(new Date("2026-12-31T15:00:00Z"));
    expect(midnight).toEqual({
      year: 2027,
      month: 1,
      day: 1,
      weekday: 5,
      minutesOfDay: 0,
      ymd: "2027-01-01",
      mmdd: "01-01",
      nthOfWeekday: 1,
    });
  });

  it("handles leap year February 29 in JST", () => {
    const leap = getJstDateParts(new Date("2028-02-28T15:00:00Z"));
    expect(leap).toMatchObject({
      year: 2028,
      month: 2,
      day: 29,
      weekday: 2,
      ymd: "2028-02-29",
      mmdd: "02-29",
      nthOfWeekday: 5,
    });
  });

  it("computes nthOfWeekday boundaries for days 1, 7, 8, 14, 15, 28, and 29", () => {
    const cases: Array<[string, number]> = [
      ["2026-11-01T00:00:00Z", 1],
      ["2026-11-07T00:00:00Z", 1],
      ["2026-11-08T00:00:00Z", 2],
      ["2026-11-14T00:00:00Z", 2],
      ["2026-11-15T00:00:00Z", 3],
      ["2026-11-28T00:00:00Z", 4],
      ["2026-11-29T00:00:00Z", 5],
    ];
    for (const [iso, expectedNth] of cases) {
      expect(getJstDateParts(new Date(iso)).nthOfWeekday).toBe(expectedNth);
    }
  });
});
