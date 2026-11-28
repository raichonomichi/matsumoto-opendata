import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCuratedEvents,
  buildMonthlyStats,
  DATASET_RANGE,
} from "../../pipelines/build-matsumoto-castle";
import {
  excelSerialToYmd,
  normalizeEventUrl,
  parseCaoHolidaysCsv,
  parseLinkDataEventsTsv,
  parseLinkDataWeatherTsv,
} from "../../pipelines/matsumoto-castle/parsers";
import {
  buildCalendarDays,
  enumerateDates,
} from "../../pipelines/matsumoto-castle/scoring";
import { matsumotoCastleDatasetSchema } from "./matsumoto-castle-schema";

describe("matsumoto-castle parsers", () => {
  it("converts Excel serial dates in UTC accurately", () => {
    expect(excelSerialToYmd(46145)).toBe("2026-05-03");
    expect(excelSerialToYmd(46152)).toBe("2026-05-10");
    expect(excelSerialToYmd(46235)).toBe("2026-08-01");
    expect(excelSerialToYmd(46329)).toBe("2026-11-03");
  });

  it("normalizes malformed, fullwidth, relative, and scheme-less event URLs", () => {
    expect(normalizeEventUrl("https//matsumoto-artmuse.jp")).toBe(
      "https://matsumoto-artmuse.jp/",
    );
    expect(normalizeEventUrl("ｈｔｔｐｓ//matsumoto-artmuse.jp")).toBe(
      "https://matsumoto-artmuse.jp/",
    );
    expect(normalizeEventUrl("matsumoto-castle.jp")).toBe(
      "https://www.matsumoto-castle.jp/",
    );
    expect(normalizeEventUrl("/soshiki/149/114387.html")).toBe(
      "https://www.city.matsumoto.nagano.jp/soshiki/149/114387.html",
    );
    expect(normalizeEventUrl("")).toBeNull();
    expect(normalizeEventUrl("javascript:alert(1)")).toBeNull();
  });

  it("parses LinkData events TSV, weather TSV, and Shift_JIS CAO holidays CSV", () => {
    const eventsTsv = [
      "#LINK",
      "#attribution_name\t松本市　DX推進本部",
      "#license\thttp://creativecommons.org/licenses/by/3.0/deed.ja",
      "#download_from\thttp://linkdata.org/work/rdf1s9164i",
      "#property\t主なイベント事業名\tイベント名（カナ）\tカテゴリー\t開催時期\t開催時期特記事項\t場所\t所在地\t内容\t問合先名称\t問合先電話番号\tURL\t備考",
      "1\t国宝松本城夜桜会\tヨザクラカイ\t教育・文化\t開花宣言の3日後より8日間\t\t松本城本丸庭園\t丸の内4-1\t\t松本城管理課\t0263-32-2902\tmatsumoto-castle.jp\t",
    ].join("\n");
    const parsedEvents = parseLinkDataEventsTsv(eventsTsv);
    expect(parsedEvents.records).toHaveLength(1);
    expect(parsedEvents.records[0].name).toBe("国宝松本城夜桜会");

    const weatherLines = ["#LINK", "#property\t時間軸コード"];
    for (let month = 1; month <= 12; month++) {
      const mm = String(month).padStart(2, "0");
      weatherLines.push(
        `${month}\t201400${mm}${mm}\t${month}.0\t${month + 5}.0\t${month - 5}.0\t100.0\t30.0\t2.0\t8.0\t15.0\t70\t180.0\t1015`,
      );
      weatherLines.push(
        `${month + 12}\t202300${mm}${mm}\t${month + 2}.0\t${month + 7}.0\t${month - 3}.0\t120.0\t40.0\t2.4\t9.0\t16.0\t68\t200.0\t1016`,
      );
    }
    const weather = parseLinkDataWeatherTsv(
      weatherLines.join("\n"),
      2014,
      2023,
    );
    expect(weather).toHaveLength(12);
    expect(weather[0].weather).toMatchObject({
      meanTempC: 2.0,
      maxTempC: 7.0,
      minTempC: -3.0,
      precipitationMm: 110.0,
      sunshineHours: 190.0,
    });

    const holidaysCsv = [
      "国民の祝日・休日月日,国民の祝日・休日名称",
      "2025/1/1,元日",
      "2026/5/4,みどりの日",
      "2027/1/1,元日",
    ].join("\r\n");
    const holidays = parseCaoHolidaysCsv(holidaysCsv, 2026, 2027);
    expect(holidays.has("2025-01-01")).toBe(false);
    expect(holidays.get("2026-05-04")).toBe("みどりの日");
    expect(holidays.get("2027-01-01")).toBe("元日");
  });
});

describe("matsumoto-castle scoring", () => {
  it("applies closed days, low weekday baselines, very_busy peaks, event caps, and excludes nearby_exhibition", () => {
    const weatherMonths = Array.from({ length: 12 }, (_, idx) => ({
      month: idx + 1,
      weather: {
        meanTempC: 10,
        maxTempC: 15,
        minTempC: 5,
        precipitationMm: 80,
        sunshineHours: 180,
      },
    }));
    const monthlyStats = buildMonthlyStats(weatherMonths);
    const holidays = new Map<string, string>([
      ["2026-05-03", "憲法記念日"],
      ["2026-05-04", "みどりの日"],
      ["2026-05-05", "こどもの日"],
      ["2026-05-06", "休日"],
      ["2026-10-12", "スポーツの日"],
    ]);

    const events = [
      {
        id: "soba-matsuri",
        sourceRecordId: "35",
        name: "信州・松本そば祭り（仮称）",
        scope: "castle" as const,
        category: "教育・文化",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        datePrecision: "exact" as const,
        dateNote: "2026年10月10日〜12日",
        venue: "松本城公園他",
        address: "松本市",
        summary: null,
        impactPoints: 30,
        isNightEvent: false,
        trafficNote: null,
        officialUrl: null,
        contact: null,
      },
      {
        id: "godo-chakai",
        sourceRecordId: "36",
        name: "国宝松本城合同茶会",
        scope: "castle" as const,
        category: "教育・文化",
        startDate: "2026-10-12",
        endDate: "2026-10-12",
        datePrecision: "exact" as const,
        dateNote: "2026年10月12日",
        venue: "松本城本丸庭園",
        address: "丸の内4-1",
        summary: null,
        impactPoints: 15,
        isNightEvent: false,
        trafficNote: null,
        officialUrl: null,
        contact: null,
      },
      {
        id: "exhibition-ignore",
        sourceRecordId: "40",
        name: "今昔はかり展",
        scope: "nearby_exhibition" as const,
        category: "教育・文化",
        startDate: "2026-12-01",
        endDate: "2026-12-25",
        datePrecision: "exact" as const,
        dateNote: "12月",
        venue: "はかり資料館",
        address: "中央3-4-21",
        summary: null,
        impactPoints: 0,
        isNightEvent: false,
        trafficNote: null,
        officialUrl: null,
        contact: null,
      },
    ];

    const days = buildCalendarDays({
      startDate: "2026-04-01",
      endDate: "2027-12-31",
      eventsCoveredUntil: "2027-03-31",
      holidays,
      monthlyStats,
      events,
    });
    const byDate = new Map(days.map((d) => [d.date, d]));

    // Year-end closure
    expect(byDate.get("2026-12-30")).toMatchObject({
      crowdLevel: "closed",
      crowdScore: null,
      hoursType: "closed",
    });

    // December Tuesday without castle/downtown event -> low (nearby_exhibition must not be included)
    const decTue = byDate.get("2026-12-08");
    expect(decTue).toMatchObject({
      crowdLevel: "low",
      crowdScore: 5,
      eventIds: [],
    });

    // Golden Week peak middle day
    expect(byDate.get("2026-05-04")).toMatchObject({
      crowdLevel: "very_busy",
      isLongWeekend: true,
      hoursType: "gw_extended",
    });
    expect(byDate.get("2026-05-04")?.crowdScore).toBeGreaterThanOrEqual(75);

    // Multiple events on 2026-10-12: event factor capped at +30
    const oct12 = byDate.get("2026-10-12");
    const eventFactor = oct12?.factors.find((f) => f.kind === "event");
    expect(eventFactor?.points).toBe(30);
    expect(oct12?.crowdLevel).toBe("very_busy");
    expect(oct12?.eventIds).toEqual(["soba-matsuri", "godo-chakai"]);
  });

  it("verifies buildCuratedEvents guards against raw Excel serial mismatches", () => {
    expect(() =>
      buildCuratedEvents({
        metadata: {
          attributionName: "松本市",
          licenseUrl: "https://creativecommons.org/licenses/by/3.0/deed.ja",
          downloadFrom: "http://linkdata.org/work/rdf1s9164i",
        },
        records: [],
      }),
    ).toThrow();
  });
});

describe("src/data/matsumoto-castle.json integrity", () => {
  it("conforms to schema with contiguous 640 days, valid coverage boundary, and clean event references", async () => {
    const raw = await readFile(
      path.resolve("src/data/matsumoto-castle.json"),
      "utf-8",
    );
    const dataset = matsumotoCastleDatasetSchema.parse(JSON.parse(raw));

    const expectedDates = enumerateDates(
      DATASET_RANGE.startDate,
      DATASET_RANGE.endDate,
    );
    expect(expectedDates).toHaveLength(640);
    expect(dataset.days.map((d) => d.date)).toEqual(expectedDates);

    expect(dataset.monthlyStats).toHaveLength(12);
    expect(dataset.monthlyStats.map((m) => m.month)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);

    const scopes = new Set(dataset.events.map((e) => e.scope));
    expect(scopes.has("castle")).toBe(true);
    expect(scopes.has("downtown")).toBe(true);
    expect(scopes.has("nearby_exhibition")).toBe(true);

    const eventMap = new Map(dataset.events.map((e) => [e.id, e]));
    for (const ev of dataset.events) {
      if (ev.scope === "nearby_exhibition") {
        expect(ev.impactPoints).toBe(0);
      }
    }

    for (const day of dataset.days) {
      if (day.date <= DATASET_RANGE.eventsCoveredUntil) {
        expect(day.dataCoverage).toBe("events_included");
      } else {
        expect(day.dataCoverage).toBe("stats_and_holidays_only");
        expect(day.eventIds).toEqual([]);
      }

      for (const evId of day.eventIds) {
        const ev = eventMap.get(evId);
        expect(ev).toBeDefined();
        expect(ev?.scope).not.toBe("nearby_exhibition");
      }
    }
  });
});
