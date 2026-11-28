import { describe, expect, it } from "vitest";
import {
  compareSentouFacilities,
  formatBathDistanceBadge,
  matchesSentouFiltersWithoutTab,
  type SentouFilterableFacility,
} from "./sentou-client";
import type { BathAvailability } from "./sentou-schedule";

const facilities: SentouFilterableFacility[] = [
  {
    id: "zuisho",
    tabGroup: "public_drop_in",
    accessCategory: "public_drop_in",
    permitCategory: "その他の公衆浴場",
    permittedAt: "2002-04-01",
    areaGroup: "central",
    waterType: "onsen",
    hasSauna: true,
    hasRotenburo: true,
    hasMorningBath: false,
    openLateNight: true,
    latestLastEntryMinutes: 23 * 60 + 20,
    lat: 36.22,
    lng: 137.97,
    recommendedRank: 1,
    schedule: {
      kind: "check_official",
      summaryText: "x",
      lastEntryText: null,
      holidayNote: null,
      irregularNote: null,
    },
    searchText: "瑞祥 松本 スーパー銭湯",
  },
  {
    id: "shioi",
    tabGroup: "public_drop_in",
    accessCategory: "public_drop_in",
    permitCategory: "一般公衆浴場",
    permittedAt: "1962-11-09",
    areaGroup: "central",
    waterType: "non_onsen",
    hasSauna: false,
    hasRotenburo: false,
    hasMorningBath: false,
    openLateNight: false,
    latestLastEntryMinutes: 21 * 60 + 30,
    lat: 36.23,
    lng: 137.97,
    recommendedRank: 5,
    schedule: {
      kind: "check_official",
      summaryText: "x",
      lastEntryText: null,
      holidayNote: null,
      irregularNote: null,
    },
    searchText: "塩井乃湯 銭湯",
  },
  {
    id: "shiraito",
    tabGroup: "public_drop_in",
    accessCategory: "public_drop_in",
    permitCategory: "その他の公衆浴場",
    permittedAt: "2003-06-30",
    areaGroup: "asama_utsukushigahara",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    hasMorningBath: true,
    openLateNight: false,
    latestLastEntryMinutes: null,
    lat: null,
    lng: null,
    recommendedRank: 5,
    schedule: {
      kind: "check_official",
      summaryText: "x",
      lastEntryText: null,
      holidayNote: null,
      irregularNote: null,
    },
    searchText: "白糸の湯 美ヶ原温泉",
  },
];

describe("sentou-client helpers", () => {
  const availabilities = new Map<string, BathAvailability>([
    [
      "zuisho",
      {
        status: "opening_later_today",
        canEnterToday: true,
        label: "これから",
        detailText: null,
        todayHoursText: null,
        minutesUntilLastEntry: 200,
        minutesUntilOpen: 30,
      },
    ],
    [
      "shioi",
      {
        status: "open_now",
        canEnterToday: true,
        label: "今すぐ",
        detailText: null,
        todayHoursText: null,
        minutesUntilLastEntry: 60,
        minutesUntilOpen: 0,
      },
    ],
    [
      "shiraito",
      {
        status: "closed_today",
        canEnterToday: false,
        label: "定休日",
        detailText: null,
        todayHoursText: null,
        minutesUntilLastEntry: null,
        minutesUntilOpen: null,
      },
    ],
  ]);

  it("formats bath distance badges cleanly", () => {
    expect(formatBathDistanceBadge(0.32)).toBe("現在地から 約320m");
    expect(formatBathDistanceBadge(3.84)).toBe("現在地から 約3.8km");
  });

  it("evaluates all 8 quick filters, area filter, and keyword search", () => {
    const base = {
      selectedArea: "all" as const,
      keyword: "",
      activeQuickFilters: new Set<string>(),
    };

    expect(
      facilities
        .filter((f) =>
          matchesSentouFiltersWithoutTab(
            f,
            {
              ...base,
              activeQuickFilters: new Set([
                "can-enter-today",
                "onsen",
                "sauna",
                "rotenburo",
                "late-night",
              ]),
            },
            availabilities,
          ),
        )
        .map((f) => f.id),
    ).toEqual(["zuisho"]);

    expect(
      facilities
        .filter((f) =>
          matchesSentouFiltersWithoutTab(
            f,
            {
              ...base,
              activeQuickFilters: new Set(["open-now", "sentou"]),
            },
            availabilities,
          ),
        )
        .map((f) => f.id),
    ).toEqual(["shioi"]);

    expect(
      facilities
        .filter((f) =>
          matchesSentouFiltersWithoutTab(
            f,
            {
              ...base,
              selectedArea: "asama_utsukushigahara",
              keyword: " 白糸 ",
              activeQuickFilters: new Set(["morning-bath"]),
            },
            availabilities,
          ),
        )
        .map((f) => f.id),
    ).toEqual(["shiraito"]);
  });

  it("sorts facilities across available_first, distance, last_entry_desc, permitted_desc, and fallback", () => {
    const distanceMap = new Map<string, number>([
      ["shioi", 0.5],
      ["zuisho", 1.8],
    ]);

    expect(
      [...facilities]
        .sort((a, b) =>
          compareSentouFacilities(a, b, "available_first", {
            availabilities,
            distanceMap,
            hasUserLocation: false,
          }),
        )
        .map((f) => f.id),
    ).toEqual(["shioi", "zuisho", "shiraito"]);

    expect(
      [...facilities]
        .sort((a, b) =>
          compareSentouFacilities(a, b, "distance", {
            availabilities,
            distanceMap,
            hasUserLocation: true,
          }),
        )
        .map((f) => f.id),
    ).toEqual(["shioi", "zuisho", "shiraito"]);

    expect(
      [...facilities]
        .sort((a, b) =>
          compareSentouFacilities(a, b, "last_entry_desc", {
            availabilities,
            distanceMap,
            hasUserLocation: false,
          }),
        )
        .map((f) => f.id),
    ).toEqual(["zuisho", "shioi", "shiraito"]);

    expect(
      [...facilities]
        .sort((a, b) =>
          compareSentouFacilities(a, b, "permitted_desc", {
            availabilities,
            distanceMap,
            hasUserLocation: false,
          }),
        )
        .map((f) => f.id),
    ).toEqual(["shiraito", "zuisho", "shioi"]);

    // Fallback order: recommendedRank ascending, then id ascending
    expect(
      [...facilities]
        .sort((a, b) =>
          compareSentouFacilities(a, b, "recommended", {
            availabilities,
            distanceMap,
            hasUserLocation: false,
          }),
        )
        .map((f) => f.id),
    ).toEqual(["zuisho", "shioi", "shiraito"]);
  });
});
