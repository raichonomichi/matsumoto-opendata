import { describe, expect, it } from "vitest";
import {
  addDaysYmd,
  clampDateToRange,
  formatFullDateJa,
  formatShortDateJa,
  getActiveNearbyExhibitions,
  getAnchorDate,
  pickRecommendedDays,
  resolveJumpMonthTarget,
  resolveRecommendationWindow,
} from "./matsumoto-castle-client";
import type { CalendarDay, CastleEvent } from "./matsumoto-castle-schema";

function makeDay(
  overrides: Partial<CalendarDay> & { date: string; dayOfWeek: number },
): CalendarDay {
  return {
    isWeekend: overrides.dayOfWeek === 0 || overrides.dayOfWeek === 6,
    holidayName: null,
    isLongWeekend: false,
    dataCoverage: "events_included",
    crowdLevel: "moderate",
    crowdScore: 30,
    factors: [],
    hoursType: "regular",
    hoursLabel: "8:30〜17:00",
    lastEntryLabel: "16:30",
    eventIds: [],
    advice: [],
    ...overrides,
  };
}

function makeExhibition(
  id: string,
  startDate: string,
  endDate: string,
): CastleEvent {
  return {
    id,
    sourceRecordId: id,
    name: id,
    scope: "nearby_exhibition",
    category: "展示",
    startDate,
    endDate,
    datePrecision: "exact",
    dateNote: `${startDate}〜${endDate}`,
    venue: "博物館",
    address: null,
    summary: null,
    impactPoints: 0,
    isNightEvent: false,
    trafficNote: null,
    officialUrl: null,
    contact: null,
  };
}

describe("matsumoto-castle-client date & label helpers", () => {
  const range = { startDate: "2026-04-01", endDate: "2027-12-31" };

  it("clamps dates, adds/subtracts UTC days cleanly, and formats Japanese dates", () => {
    expect(clampDateToRange("2026-01-01", range)).toBe("2026-04-01");
    expect(clampDateToRange("2028-01-01", range)).toBe("2027-12-31");
    expect(clampDateToRange("2026-11-28", range)).toBe("2026-11-28");

    expect(addDaysYmd("2026-12-30", 5)).toBe("2027-01-04");
    expect(addDaysYmd("2026-03-01", -1)).toBe("2026-02-28");

    expect(formatShortDateJa("2026-05-03", 0)).toBe("5月3日(日)");
    expect(formatShortDateJa("2026-05-03", undefined)).toBe("5月3日()");
    expect(formatFullDateJa({ date: "2026-05-03", dayOfWeek: 0 })).toBe(
      "2026年5月3日（日）",
    );
  });

  it("computes anchor date and recommendation windows across next_30, next_90, and current_month", () => {
    expect(getAnchorDate("2026-11-28", "2026-11", range)).toBe("2026-11-28");
    expect(getAnchorDate("2028-02-15", "2027-05", range)).toBe("2027-05-01");

    const days = [
      makeDay({ date: "2026-11-01", dayOfWeek: 0 }),
      makeDay({ date: "2026-11-28", dayOfWeek: 6 }),
      makeDay({ date: "2026-11-30", dayOfWeek: 1 }),
      makeDay({ date: "2027-12-27", dayOfWeek: 1 }),
      makeDay({ date: "2027-12-31", dayOfWeek: 5 }),
    ];
    const dayByDate = new Map(days.map((d) => [d.date, d]));

    const next30 = resolveRecommendationWindow({
      anchor: "2027-12-20",
      currentMonth: "2027-12",
      windowFilter: "next_30",
      days,
      range,
      dayByDate,
    });
    expect(next30.rangeStart).toBe("2027-12-20");
    expect(next30.rangeEnd).toBe("2027-12-31");

    const next90 = resolveRecommendationWindow({
      anchor: "2026-11-01",
      currentMonth: "2026-11",
      windowFilter: "next_90",
      days,
      range,
      dayByDate,
    });
    expect(next90.rangeEnd).toBe("2027-01-29");

    const curMonth = resolveRecommendationWindow({
      anchor: "2026-11-28",
      currentMonth: "2026-11",
      windowFilter: "current_month",
      days,
      range,
      dayByDate,
    });
    expect(curMonth).toEqual({
      rangeStart: "2026-11-01",
      rangeEnd: "2026-11-30",
      windowText: "2026年11月",
    });
  });
});

describe("pickRecommendedDays, nearby exhibitions, and jump month resolution", () => {
  it("excludes closed days, filters weekday vs weekend/holiday, sorts by goalMode, and caps at 6", () => {
    const days: CalendarDay[] = [
      makeDay({
        date: "2026-10-01",
        dayOfWeek: 4,
        crowdLevel: "closed",
        crowdScore: null,
      }),
      makeDay({
        date: "2026-10-02",
        dayOfWeek: 5,
        crowdLevel: "low",
        crowdScore: 15,
        eventIds: ["downtown-ev"],
      }),
      makeDay({
        date: "2026-10-03",
        dayOfWeek: 6,
        crowdLevel: "busy",
        crowdScore: 60,
        eventIds: ["castle-ev"],
      }),
      makeDay({
        date: "2026-10-04",
        dayOfWeek: 0,
        crowdLevel: "low",
        crowdScore: 10,
      }),
      makeDay({
        date: "2026-10-05",
        dayOfWeek: 1,
        holidayName: "特別祝日",
        crowdLevel: "moderate",
        crowdScore: 30,
      }),
      makeDay({
        date: "2026-10-06",
        dayOfWeek: 2,
        crowdLevel: "low",
        crowdScore: 15,
      }),
      makeDay({
        date: "2026-10-07",
        dayOfWeek: 3,
        crowdLevel: "low",
        crowdScore: 12,
      }),
      makeDay({
        date: "2026-10-08",
        dayOfWeek: 4,
        crowdLevel: "low",
        crowdScore: 14,
      }),
      makeDay({
        date: "2026-10-09",
        dayOfWeek: 5,
        crowdLevel: "low",
        crowdScore: 18,
      }),
    ];

    const eventById = new Map<string, Pick<CastleEvent, "scope">>([
      ["downtown-ev", { scope: "downtown" }],
      ["castle-ev", { scope: "castle" }],
    ]);

    const avoidCrowdAll = pickRecommendedDays({
      days,
      rangeStart: "2026-10-01",
      rangeEnd: "2026-10-09",
      goalMode: "avoid_crowd",
      dowFilter: "all",
      eventById,
    });
    expect(avoidCrowdAll).toHaveLength(6);
    expect(avoidCrowdAll.map((d) => d.date)).toEqual([
      "2026-10-04",
      "2026-10-07",
      "2026-10-08",
      "2026-10-02",
      "2026-10-06",
      "2026-10-09",
    ]);

    // Weekday excludes weekends AND weekday holidays (2026-10-05)
    const weekdayOnly = pickRecommendedDays({
      days,
      rangeStart: "2026-10-01",
      rangeEnd: "2026-10-09",
      goalMode: "avoid_crowd",
      dowFilter: "weekday",
      eventById,
    });
    expect(weekdayOnly.some((d) => d.date === "2026-10-05")).toBe(false);

    // Weekend/holiday includes weekday holiday
    const offDaysOnly = pickRecommendedDays({
      days,
      rangeStart: "2026-10-01",
      rangeEnd: "2026-10-09",
      goalMode: "avoid_crowd",
      dowFilter: "weekend_holiday",
      eventById,
    });
    expect(offDaysOnly.map((d) => d.date)).toEqual([
      "2026-10-04",
      "2026-10-05",
      "2026-10-03",
    ]);

    // with_event prioritizes castle scope before downtown scope
    const withEvent = pickRecommendedDays({
      days,
      rangeStart: "2026-10-01",
      rangeEnd: "2026-10-09",
      goalMode: "with_event",
      dowFilter: "all",
      eventById,
    });
    expect(withEvent.map((d) => d.date)).toEqual(["2026-10-03", "2026-10-02"]);
  });

  it("matches nearby exhibitions overlapping month boundaries (including February)", () => {
    const exhibitions = [
      makeExhibition("prev-only", "2026-12-01", "2027-01-31"),
      makeExhibition("feb-end-touch", "2027-02-28", "2027-03-10"),
      makeExhibition("spanning", "2027-01-15", "2027-04-01"),
      makeExhibition("next-only", "2027-03-01", "2027-03-20"),
    ];

    const activeFeb = getActiveNearbyExhibitions(exhibitions, "2027-02");
    expect(activeFeb.map((e) => e.id)).toEqual(["feb-end-touch", "spanning"]);
  });

  it("resolves seasonal jump month targets cleanly", () => {
    const months = [
      "2026-04",
      "2026-08",
      "2026-11",
      "2027-01",
      "2027-04",
      "2027-08",
    ];
    expect(resolveJumpMonthTarget(0, months, "2026-11-28")).toBeNull();
    expect(resolveJumpMonthTarget(13, months, "2026-11-28")).toBeNull();
    expect(resolveJumpMonthTarget(12, months, "2026-11-28")).toBeNull();

    // Same month as initialDate -> picks 2026-11 and initialDate
    expect(resolveJumpMonthTarget(11, months, "2026-11-28")).toEqual({
      targetMonth: "2026-11",
      targetDate: "2026-11-28",
    });

    // Future occurrence exists -> picks 2027-04-01
    expect(resolveJumpMonthTarget(4, months, "2026-11-28")).toEqual({
      targetMonth: "2027-04",
      targetDate: "2027-04-01",
    });

    // Past-only month -> wraps to earliest occurrence (2027-01 -> none before? Wait 2026-08 is past when anchor is 2027-09)
    expect(resolveJumpMonthTarget(1, months, "2027-09-01")).toEqual({
      targetMonth: "2027-01",
      targetDate: "2027-01-01",
    });
  });
});
