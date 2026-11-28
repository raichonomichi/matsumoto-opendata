import { describe, expect, it } from "vitest";
import {
  buildWifiSearchText,
  compareWifiSpots,
  formatDistanceBadge,
  getSsrInitialStatusLabel,
  matchesWifiQuickFilters,
  matchesWifiSpotFilter,
  type WifiFilterableSpot,
} from "./free-wifi-client";
import type { OpenEvaluation } from "./free-wifi-schedule";
import type { WifiSpot } from "./free-wifi-schema";

const spots: WifiFilterableSpot[] = [
  {
    id: "m-wing",
    purposes: ["study_work", "meeting_rental"],
    areaGroup: "central",
    district: "中央",
    ssid: "Matsumoto_Community_Free_WiFi",
    accessPolicy: "drop_in",
    powerAvailability: "available",
    openLate: true,
    openMonday: true,
    openWeekend: true,
    apCount: 4,
    recommendedRank: 1,
    latestCloseMinutes: 22 * 60,
    lat: 36.231,
    lng: 137.967,
    schedule: { kind: "outdoor_24h", summaryText: "屋外", holidayNote: null },
    searchText: "mウイング 中央 公民館",
  },
  {
    id: "museum",
    purposes: ["sightseeing"],
    areaGroup: "central",
    district: "中央",
    ssid: null,
    accessPolicy: "facility_visitor",
    powerAvailability: "none",
    openLate: false,
    openMonday: false,
    openWeekend: true,
    apCount: 25,
    recommendedRank: 13,
    latestCloseMinutes: 17 * 60,
    lat: 36.231,
    lng: 137.971,
    schedule: {
      kind: "check_official",
      summaryText: "要確認",
      holidayNote: null,
    },
    searchText: "松本市美術館 博物館",
  },
  {
    id: "station-outdoor",
    purposes: ["sightseeing"],
    areaGroup: "central",
    district: "深志",
    ssid: "Matsumoto_City_Free_Wi-Fi",
    accessPolicy: "outdoor_open",
    powerAvailability: "limited_seats",
    openLate: true,
    openMonday: true,
    openWeekend: true,
    apCount: 2,
    recommendedRank: 13,
    latestCloseMinutes: null,
    lat: 36.23,
    lng: 137.964,
    schedule: { kind: "outdoor_24h", summaryText: "屋外", holidayNote: null },
    searchText: "松本駅前 広場",
  },
];

describe("free-wifi-client helpers", () => {
  it("builds search text, SSR initial status labels, and distance badges", () => {
    const sampleSpot: WifiSpot = {
      id: "agata",
      sourceRecordId: "99",
      facilityNumber: "9",
      name: "あがたの森図書館",
      facilityName: "あがたの森図書館",
      category: "図書館",
      address: "松本市県3-1-1",
      district: "第一",
      areaGroup: "central",
      lat: 36.23,
      lng: 137.98,
      phone: null,
      ssid: "MLib-wifi",
      ssidSystem: "library",
      apCount: 1,
      indoorOutdoor: "indoor",
      purposes: ["study_work"],
      accessPolicy: "drop_in",
      powerAvailability: "none",
      powerNote: "電源なし",
      studyWorkNote: "絵本コーナーあり",
      complexGroup: null,
      complexNote: null,
      officialUrl: null,
      recommendedRank: 5,
      schedule: { kind: "outdoor_24h", summaryText: "屋外", holidayNote: null },
      openLate: false,
      openMonday: false,
      openWeekend: true,
      latestCloseMinutes: 17 * 60,
    };

    const text = buildWifiSearchText(sampleSpot, "中心市街地");
    expect(text).toContain("あがたの森図書館");
    expect(text).toContain("中心市街地");
    expect(text).toContain("mlib-wifi");
    expect(text).toContain("絵本コーナーあり");

    expect(
      getSsrInitialStatusLabel({
        schedule: { kind: "outdoor_24h", summaryText: "x", holidayNote: null },
      }).label,
    ).toBe("屋外・終日目安");
    expect(
      getSsrInitialStatusLabel({
        schedule: {
          kind: "check_official",
          summaryText: "x",
          holidayNote: null,
        },
      }).label,
    ).toBe("開館時間要確認");
    expect(
      getSsrInitialStatusLabel({
        schedule: {
          kind: "structured",
          openDays: [1],
          defaultHours: { openMinutes: 540, closeMinutes: 1020 },
          seasonalOverrides: [],
          closedOnHolidays: "never",
          mondayHolidayRule: "none",
          dayAfterHolidayClosed: false,
          nthWeekdaysClosed: [],
          yearEndClosed: null,
          summaryText: "月",
          holidayNote: null,
          variableClosingNote: null,
        },
      }).label,
    ).toBe("開館目安あり");

    expect(formatDistanceBadge(0.456)).toBe("現在地から 約456m");
    expect(formatDistanceBadge(0.9999)).toBe("現在地から 約1000m");
    expect(formatDistanceBadge(1.0)).toBe("現在地から 約1.0km");
    expect(formatDistanceBadge(2.34)).toBe("現在地から 約2.3km");
  });

  it("evaluates quick filters and composite spot filters", () => {
    const evals = new Map<string, OpenEvaluation>([
      [
        "m-wing",
        { status: "open", label: "開館", reason: null, todayHoursText: null },
      ],
      [
        "museum",
        {
          status: "closed",
          label: "閉館",
          reason: "休館",
          todayHoursText: null,
        },
      ],
      [
        "station-outdoor",
        {
          status: "outdoor",
          label: "屋外",
          reason: null,
          todayHoursText: null,
        },
      ],
    ]);

    expect(
      matchesWifiQuickFilters(
        spots[0],
        new Set([
          "open-now",
          "drop-in",
          "open-late",
          "open-monday",
          "open-weekend",
          "has-power",
        ]),
        evals,
      ),
    ).toBe(true);
    expect(
      matchesWifiQuickFilters(
        spots[2],
        new Set(["open-now", "drop-in", "has-power"]),
        evals,
      ),
    ).toBe(true);
    expect(
      matchesWifiQuickFilters(spots[1], new Set(["open-now"]), evals),
    ).toBe(false);

    const baseCriteria = {
      activeTab: "all" as const,
      selectedArea: "all" as const,
      district: "all",
      ssid: "all",
      keyword: "",
      activeQuickFilters: new Set<string>(),
    };

    expect(
      spots
        .filter((s) =>
          matchesWifiSpotFilter(s, { ...baseCriteria, ssid: "none" }, evals),
        )
        .map((s) => s.id),
    ).toEqual(["museum"]);

    expect(
      spots
        .filter((s) =>
          matchesWifiSpotFilter(
            s,
            { ...baseCriteria, activeTab: "study_work", keyword: "mウイング" },
            evals,
          ),
        )
        .map((s) => s.id),
    ).toEqual(["m-wing"]);
  });

  it("sorts spots by distance, ap-desc, close-desc, and recommended rank/id tie-breaker", () => {
    const distanceMap = new Map<string, number>([
      ["station-outdoor", 0.2],
      ["m-wing", 0.6],
    ]);

    expect(
      [...spots]
        .sort((a, b) => compareWifiSpots(a, b, "distance", distanceMap, true))
        .map((s) => s.id),
    ).toEqual(["station-outdoor", "m-wing", "museum"]);

    expect(
      [...spots]
        .sort((a, b) => compareWifiSpots(a, b, "ap-desc", distanceMap, false))
        .map((s) => s.id),
    ).toEqual(["museum", "m-wing", "station-outdoor"]);

    expect(
      [...spots]
        .sort((a, b) =>
          compareWifiSpots(a, b, "close-desc", distanceMap, false),
        )
        .map((s) => s.id),
    ).toEqual(["m-wing", "museum", "station-outdoor"]);

    // Same recommendedRank (13) -> tie-break by id ascending
    expect(
      [...spots]
        .sort((a, b) =>
          compareWifiSpots(a, b, "recommended", distanceMap, false),
        )
        .map((s) => s.id),
    ).toEqual(["m-wing", "museum", "station-outdoor"]);
  });
});
