import { describe, expect, it } from "vitest";
import weatherData from "../data/matsumoto-weather-history.json";
import { getWeatherComparisons } from "./matsumoto-weather-history";

const temperatures = { minC: -2, maxC: 7.1 };

describe("getWeatherComparisons", () => {
  it("matches the official Matsumoto observations for November 28", () => {
    const { today, comparisons } = getWeatherComparisons(
      weatherData,
      new Date("2026-11-27T15:00:00Z"),
    );
    expect(today).toBe("2026-11-28");
    expect(comparisons).toEqual([
      {
        yearsAgo: 1,
        requestedOn: "2025-11-28",
        observation: {
          date: "2025-11-28",
          temperatures: { minC: 4.7, maxC: 14 },
        },
      },
      {
        yearsAgo: 5,
        requestedOn: "2021-11-28",
        observation: {
          date: "2021-11-28",
          temperatures: { minC: -4, maxC: 8.3 },
        },
      },
      {
        yearsAgo: 10,
        requestedOn: "2016-11-28",
        observation: {
          date: "2016-11-28",
          temperatures: { minC: -0.4, maxC: 8.7 },
        },
      },
    ]);
  });

  it("switches target years at midnight in Japan", () => {
    const before = getWeatherComparisons({}, new Date("2026-12-31T14:59:59Z"));
    const after = getWeatherComparisons({}, new Date("2026-12-31T15:00:00Z"));
    expect(before.comparisons.map(({ requestedOn }) => requestedOn)).toEqual([
      "2025-12-31",
      "2021-12-31",
      "2016-12-31",
    ]);
    expect(after.comparisons.map(({ requestedOn }) => requestedOn)).toEqual([
      "2026-01-01",
      "2022-01-01",
      "2017-01-01",
    ]);
  });

  it("prefers the previous observation when both dates are equally close", () => {
    const { comparisons } = getWeatherComparisons(
      {
        "2025-12-31": temperatures,
        "2026-01-01": null,
        "2026-01-02": temperatures,
      },
      new Date("2026-12-31T15:00:00Z"),
    );
    expect(comparisons[0]?.observation?.date).toBe("2025-12-31");
  });

  it("finds the closest observation within seven days on either side", () => {
    const { comparisons } = getWeatherComparisons(
      {
        "2025-11-26": temperatures,
        "2025-11-29": temperatures,
        "2021-12-05": temperatures,
        "2016-12-06": temperatures,
      },
      new Date("2026-11-28T00:00:00Z"),
    );
    expect(comparisons.map(({ observation }) => observation?.date)).toEqual([
      "2025-11-29",
      "2021-12-05",
      undefined,
    ]);
  });

  it("uses February 28 as the fallback search anchor in a non-leap year", () => {
    const { comparisons } = getWeatherComparisons(
      { "2027-02-28": temperatures, "2027-03-01": temperatures },
      new Date("2028-02-28T15:00:00Z"),
    );
    expect(comparisons[0]).toMatchObject({
      requestedOn: "2027-02-29",
      observation: { date: "2027-02-28" },
    });
  });
});
