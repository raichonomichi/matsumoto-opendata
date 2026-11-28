import { describe, expect, it } from "vitest";
import {
  compareYamagoyaItems,
  getYamagoyaPresetState,
  matchesPhysicalLevel,
  matchesPresetExtra,
  matchesYamagoyaFilter,
  type YamagoyaFilterItem,
} from "./yamagoya-client";

const sampleHuts: YamagoyaFilterItem[] = [
  {
    area: "北アルプス",
    difficulty: "D",
    physical: 8,
    hasGtfs: false,
    search: "北穂高小屋 ほだか",
    capacity: 63,
    elevation: 3100,
    permitted: "1969-08-19",
  },
  {
    area: "美ヶ原",
    difficulty: "B",
    physical: 3,
    hasGtfs: true,
    search: "王ヶ頭ホテル うつくしがはら",
    capacity: 150,
    elevation: 2034,
    permitted: "1955-05-01",
  },
  {
    area: "北アルプス",
    difficulty: "B",
    physical: 5,
    hasGtfs: true,
    search: "徳本峠小屋 とくごうとうげ",
    capacity: 24,
    elevation: 2135,
    permitted: "2010-07-29",
  },
];

describe("yamagoya-client helpers", () => {
  it("evaluates physical level ranges accurately", () => {
    expect(matchesPhysicalLevel(1, "1-4")).toBe(true);
    expect(matchesPhysicalLevel(4, "1-4")).toBe(true);
    expect(matchesPhysicalLevel(5, "1-4")).toBe(false);
    expect(matchesPhysicalLevel(5, "1-5")).toBe(true);
    expect(matchesPhysicalLevel(6, "1-5")).toBe(false);
    expect(matchesPhysicalLevel(5, "6-10")).toBe(false);
    expect(matchesPhysicalLevel(6, "6-10")).toBe(true);
    expect(matchesPhysicalLevel(10, "6-10")).toBe(true);
    expect(matchesPhysicalLevel(10, "all")).toBe(true);
  });

  it("resolves preset state and extra preset constraints", () => {
    expect(getYamagoyaPresetState("beginner")).toEqual({
      difficulty: "B",
      physicalRange: "1-4",
      sortBy: "physical-asc",
    });
    expect(getYamagoyaPresetState("one-night")).toEqual({
      difficulty: "B",
      physicalRange: "1-5",
      sortBy: "elevation-desc",
    });
    expect(getYamagoyaPresetState("large")).toEqual({
      difficulty: "all",
      physicalRange: "all",
      sortBy: "capacity-desc",
    });
    expect(getYamagoyaPresetState("high-ridge")).toEqual({
      difficulty: "all",
      physicalRange: "all",
      sortBy: "elevation-desc",
    });
    expect(getYamagoyaPresetState("unknown")).toBeNull();

    expect(
      matchesPresetExtra({ capacity: 100, elevation: 1500 }, "large"),
    ).toBe(true);
    expect(matchesPresetExtra({ capacity: 99, elevation: 1500 }, "large")).toBe(
      false,
    );
    expect(
      matchesPresetExtra({ capacity: 10, elevation: 2800 }, "high-ridge"),
    ).toBe(true);
    expect(
      matchesPresetExtra({ capacity: 10, elevation: 2799 }, "high-ridge"),
    ).toBe(false);
    expect(matchesPresetExtra({ capacity: 1, elevation: 1 }, "")).toBe(true);
  });

  it("filters huts by area, difficulty, physical, gtfsOnly, keyword, and preset", () => {
    const base = {
      selectedArea: "all",
      difficulty: "all",
      physicalRange: "all",
      gtfsOnly: false,
      keyword: "",
      activePreset: "",
    };

    expect(
      sampleHuts.filter((h) => matchesYamagoyaFilter(h, base)),
    ).toHaveLength(3);

    expect(
      sampleHuts.filter((h) =>
        matchesYamagoyaFilter(h, {
          ...base,
          selectedArea: "北アルプス",
          gtfsOnly: true,
        }),
      ),
    ).toHaveLength(1);

    expect(
      sampleHuts.filter((h) =>
        matchesYamagoyaFilter(h, {
          ...base,
          keyword: "  うつくしがはら ",
        }),
      ),
    ).toHaveLength(1);

    expect(
      sampleHuts.filter((h) =>
        matchesYamagoyaFilter(h, { ...base, activePreset: "high-ridge" }),
      ),
    ).toHaveLength(1);
  });

  it("sorts huts across all 6 sort modes", () => {
    const byElevDesc = [...sampleHuts].sort((a, b) =>
      compareYamagoyaItems(a, b, "elevation-desc"),
    );
    expect(byElevDesc.map((h) => h.elevation)).toEqual([3100, 2135, 2034]);

    const byElevAsc = [...sampleHuts].sort((a, b) =>
      compareYamagoyaItems(a, b, "elevation-asc"),
    );
    expect(byElevAsc.map((h) => h.elevation)).toEqual([2034, 2135, 3100]);

    const byPhysAsc = [...sampleHuts].sort((a, b) =>
      compareYamagoyaItems(a, b, "physical-asc"),
    );
    expect(byPhysAsc.map((h) => h.physical)).toEqual([3, 5, 8]);

    const byPhysDesc = [...sampleHuts].sort((a, b) =>
      compareYamagoyaItems(a, b, "physical-desc"),
    );
    expect(byPhysDesc.map((h) => h.physical)).toEqual([8, 5, 3]);

    const byCapDesc = [...sampleHuts].sort((a, b) =>
      compareYamagoyaItems(a, b, "capacity-desc"),
    );
    expect(byCapDesc.map((h) => h.capacity)).toEqual([150, 63, 24]);

    const byPermittedAsc = [...sampleHuts].sort((a, b) =>
      compareYamagoyaItems(a, b, "permitted-asc"),
    );
    expect(byPermittedAsc.map((h) => h.permitted)).toEqual([
      "1955-05-01",
      "1969-08-19",
      "2010-07-29",
    ]);
  });
});
