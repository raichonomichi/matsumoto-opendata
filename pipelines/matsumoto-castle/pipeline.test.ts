import { describe, expect, it } from "vitest";
import type { MonthlyStat } from "../../src/lib/matsumoto-castle-schema";
import {
  buildCuratedEvents,
  buildMatsumotoCastleDataset,
  buildMonthlyStats,
} from "../build-matsumoto-castle";
import { CURATED_EVENTS } from "./curation";
import {
  excelSerialToYmd,
  normalizeEventUrl,
  parseCaoHolidaysCsv,
  parseLinkDataEventsTsv,
  parseLinkDataWeatherTsv,
} from "./parsers";
import {
  buildCalendarDays,
  classifyCrowdLevel,
  getCastleOpeningHours,
} from "./scoring";

function makeUniformMonthlyStats(baselineScore = 10): MonthlyStat[] {
  return Array.from({ length: 12 }, (_, idx) => ({
    month: idx + 1,
    avgVisitors: 60_000,
    avgDailyVisitors: 2_000,
    yearlyVisitors: { y2023: 58_000, y2024: 60_000, y2025: 62_000 },
    baselineScore,
    weather: {
      meanTempC: 12,
      maxTempC: 18,
      minTempC: 6,
      precipitationMm: 70,
      sunshineHours: 180,
    },
    seasonTag: "通常",
    seasonTip: "メモ",
  }));
}

describe("matsumoto-castle parsers", () => {
  it("truncates fractional Excel serial dates and rejects non-positive/non-finite inputs", () => {
    expect(excelSerialToYmd(46145.75)).toBe("2026-05-03");
    expect(() => excelSerialToYmd(0)).toThrow(/Invalid Excel serial/);
    expect(() => excelSerialToYmd(-1)).toThrow(/Invalid Excel serial/);
    expect(() => excelSerialToYmd(Number.NaN)).toThrow(/Invalid Excel serial/);
    expect(() => excelSerialToYmd(Number.POSITIVE_INFINITY)).toThrow(
      /Invalid Excel serial/,
    );
  });

  it("normalizes additional URL edge cases and rejects unsafe schemes or dotless hosts", () => {
    expect(normalizeEventUrl("http//example.org/info。")).toBe(
      "http://example.org/info",
    );
    expect(normalizeEventUrl("  https://example.org/path?a=1  ")).toBe(
      "https://example.org/path?a=1",
    );
    expect(normalizeEventUrl("data:text/html,<script>")).toBeNull();
    expect(normalizeEventUrl("vbscript:msgbox(1)")).toBeNull();
    expect(normalizeEventUrl("http://localhost/test")).toBeNull();
    expect(normalizeEventUrl("not a valid url!")).toBeNull();
  });

  it("skips non-numeric IDs in events TSV and defaults metadata when headers are absent", () => {
    const parsed = parseLinkDataEventsTsv(
      "\uFEFFheader\tignored\r\nabc\tnot numeric\r\n5\t松本城イベント\t\t文化\t5月\t\t\t\t\t\t\t\t\r\n",
    );
    expect(parsed.metadata.licenseUrl).toBe(
      "https://creativecommons.org/licenses/by/3.0/deed.ja",
    );
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]?.id).toBe("5");
  });

  it("filters weather rows by year/validity and throws if any month is missing", () => {
    const lines: string[] = [];
    for (let month = 1; month <= 11; month++) {
      const mm = String(month).padStart(2, "0");
      lines.push(
        `${month}\t202000${mm}${mm}\t10\t15\t5\t80\t0\t0\t0\t0\t0\t180`,
      );
    }
    // Out-of-range year, short line, bad timecode, NaN value must all be skipped
    lines.push("99\t2000001212\t10\t15\t5\t80\t0\t0\t0\t0\t0\t180");
    lines.push("98\tshort");
    lines.push("97\tbadcode\t10\t15\t5\t80\t0\t0\t0\t0\t0\t180");
    lines.push("96\t2020001212\tNaN\t15\t5\t80\t0\t0\t0\t0\t0\t180");

    expect(() => parseLinkDataWeatherTsv(lines.join("\n"), 2014, 2023)).toThrow(
      /Missing weather observations for month 12/,
    );
  });

  it("decodes Shift_JIS binary buffer in parseCaoHolidaysCsv and ignores malformed lines", () => {
    // "2026/1/1,\u5143\u65e5\r\nbadline\r\n2025/1/1,skip\r\n" in Shift_JIS:
    // 元 = 0x8c 0xb3, 日 = 0x93 0xfa
    const asciiPrefix = Array.from(Buffer.from("2026/1/1,", "ascii"));
    const ganjitsu = [0x8c, 0xb3, 0x93, 0xfa];
    const rest = Array.from(
      Buffer.from("\r\n\r\nbadline\r\n2026/1/2,\r\n2025/1/1,past", "ascii"),
    );
    const bytes = Uint8Array.from([...asciiPrefix, ...ganjitsu, ...rest]);

    const holidays = parseCaoHolidaysCsv(bytes, 2026, 2027);
    expect(holidays.size).toBe(1);
    expect(holidays.get("2026-01-01")).toBe("元日");
  });
});

describe("matsumoto-castle opening hours, classification, and scoring", () => {
  it("classifies opening hours across all 5 hoursType branches", () => {
    expect(getCastleOpeningHours("2026-12-29")).toMatchObject({
      hoursType: "closed",
      lastEntryLabel: null,
    });
    expect(getCastleOpeningHours("2027-01-02")).toMatchObject({
      hoursType: "new_year",
      lastEntryLabel: "15:00",
    });
    expect(getCastleOpeningHours("2026-04-25").hoursType).toBe("gw_extended");
    expect(getCastleOpeningHours("2027-05-05").hoursType).toBe("gw_extended");
    expect(getCastleOpeningHours("2026-08-08").hoursType).toBe(
      "summer_extended",
    );
    expect(getCastleOpeningHours("2027-08-15").hoursType).toBe(
      "summer_extended",
    );
    expect(getCastleOpeningHours("2026-06-10")).toMatchObject({
      hoursType: "regular",
      hoursLabel: "8:30〜17:00",
      lastEntryLabel: "16:30",
    });
  });

  it("classifies crowdLevel at exact score boundaries", () => {
    expect(classifyCrowdLevel(0)).toBe("low");
    expect(classifyCrowdLevel(24)).toBe("low");
    expect(classifyCrowdLevel(25)).toBe("moderate");
    expect(classifyCrowdLevel(49)).toBe("moderate");
    expect(classifyCrowdLevel(50)).toBe("busy");
    expect(classifyCrowdLevel(74)).toBe("busy");
    expect(classifyCrowdLevel(75)).toBe("very_busy");
    expect(classifyCrowdLevel(100)).toBe("very_busy");
  });

  it("evaluates weekday factors, 3-day long weekend middle vs edge, peak seasons, clamping, and advice rules", () => {
    const monthlyStats = makeUniformMonthlyStats(25);
    const holidays = new Map<string, string>([
      ["2026-05-03", "憲法記念日"],
      ["2026-05-04", "みどりの日"],
      ["2026-05-05", "こどもの日"],
      ["2026-05-06", "休日"],
      ["2026-07-20", "海の日"], // 2026-07-18(Sat), 19(Sun), 20(Mon)
    ]);

    const events = [
      {
        id: "night-with-traffic",
        sourceRecordId: "1",
        name: "ナイトイベント",
        scope: "castle" as const,
        category: "文化",
        startDate: "2026-08-12",
        endDate: "2026-08-12",
        datePrecision: "exact" as const,
        dateNote: "8/12",
        venue: "松本城",
        address: null,
        summary: null,
        impactPoints: 25,
        isNightEvent: true,
        trafficNote: "交通規制あり",
        officialUrl: null,
        contact: null,
      },
      {
        id: "day-ev",
        sourceRecordId: "2",
        name: "日中イベント",
        scope: "downtown" as const,
        category: "文化",
        startDate: "2026-05-04",
        endDate: "2026-05-04",
        datePrecision: "exact" as const,
        dateNote: "5/4",
        venue: "市街地",
        address: null,
        summary: null,
        impactPoints: 30,
        isNightEvent: false,
        trafficNote: null,
        officialUrl: null,
        contact: null,
      },
      {
        id: "night-extra",
        sourceRecordId: "3",
        name: "夜のみ",
        scope: "castle" as const,
        category: "文化",
        startDate: "2026-05-04",
        endDate: "2026-05-04",
        datePrecision: "exact" as const,
        dateNote: "5/4",
        venue: "松本城",
        address: null,
        summary: null,
        impactPoints: 10,
        isNightEvent: true,
        trafficNote: null,
        officialUrl: null,
        contact: null,
      },
    ];

    const days = buildCalendarDays({
      startDate: "2026-04-01",
      endDate: "2027-02-28",
      eventsCoveredUntil: "2027-03-31",
      holidays,
      monthlyStats,
      events,
    });
    const byDate = new Map(days.map((d) => [d.date, d]));

    // Monday (+5) + Sakura (+18)
    const apr13Mon = byDate.get("2026-04-13");
    expect(
      apr13Mon?.factors.find((f) => f.kind === "weekday_holiday")?.points,
    ).toBe(5);
    expect(
      apr13Mon?.factors.find((f) => f.kind === "peak_season")?.points,
    ).toBe(18);

    // 3-day weekend edge (2026-07-18 Sat: +30) vs middle (2026-07-19 Sun: +32)
    expect(
      byDate
        .get("2026-07-18")
        ?.factors.find((f) => f.kind === "weekday_holiday")?.points,
    ).toBe(30);
    expect(
      byDate
        .get("2026-07-19")
        ?.factors.find((f) => f.kind === "weekday_holiday")?.points,
    ).toBe(32);

    // 2026-05-04: baseline 25 + middle 32 + GW peak 35 + event 30 = 122 -> clamped to 100
    // Mixed day + night events -> night-only tip is omitted; advice capped at 3 items
    const may4 = byDate.get("2026-05-04");
    expect(may4?.crowdScore).toBe(100);
    expect(may4?.advice.some((a) => a.includes("GW延長期間"))).toBe(true);
    expect(may4?.advice.some((a) => a.includes("夜間中心"))).toBe(false);
    expect(may4?.advice.length).toBeLessThanOrEqual(3);

    // 2026-08-12: summer_extended + single night event with trafficNote (capped at 3)
    const aug12 = byDate.get("2026-08-12");
    expect(aug12?.advice.some((a) => a.includes("和服での来場者"))).toBe(true);
    expect(aug12?.advice).toHaveLength(3);

    // Winter floor tip in Jan + New Year peak (+15)
    const jan2 = byDate.get("2027-01-02");
    expect(jan2?.factors.find((f) => f.kind === "peak_season")?.points).toBe(
      15,
    );
    expect(jan2?.advice.some((a) => a.includes("厚手の靴下"))).toBe(true);

    // Autumn leaves peak (+10) & spring break (+8)
    expect(
      byDate.get("2026-10-25")?.factors.find((f) => f.kind === "peak_season")
        ?.points,
    ).toBe(10);
    expect(
      byDate.get("2026-08-20")?.factors.find((f) => f.kind === "peak_season")
        ?.points,
    ).toBe(8);
  });

  it("throws when monthlyStats is missing a month", () => {
    expect(() =>
      buildCalendarDays({
        startDate: "2026-04-01",
        endDate: "2026-04-02",
        eventsCoveredUntil: "2026-04-02",
        holidays: new Map(),
        monthlyStats: [],
        events: [],
      }),
    ).toThrow(/Missing monthly stat for month 4/);
  });
});

describe("buildMonthlyStats, buildCuratedEvents, and buildMatsumotoCastleDataset", () => {
  const weatherMonths = Array.from({ length: 12 }, (_, idx) => ({
    month: idx + 1,
    weather: {
      meanTempC: 12,
      maxTempC: 18,
      minTempC: 6,
      precipitationMm: 70,
      sunshineHours: 180,
    },
  }));

  it("throws when a weather month is missing or curated record mismatches", () => {
    expect(() => buildMonthlyStats(weatherMonths.slice(0, 11))).toThrow(
      /Missing weather baseline for month 12/,
    );

    const first = CURATED_EVENTS[0];
    expect(() =>
      buildCuratedEvents({
        metadata: {
          attributionName: "松本市",
          licenseUrl: "https://creativecommons.org/licenses/by/3.0/deed.ja",
          downloadFrom: "http://linkdata.org/work/rdf1s9164i",
        },
        records: [
          {
            id: first.sourceRecordId,
            name: "まったく別の名前",
            kana: "",
            category: "文化",
            periodText: "",
            periodNote: "",
            venue: "",
            address: "",
            description: "",
            contactName: "",
            contactPhone: "",
            url: "",
            remarks: "",
          },
        ],
      }),
    ).toThrow(/name mismatch/);

    expect(() =>
      buildCuratedEvents({
        metadata: {
          attributionName: "松本市",
          licenseUrl: "https://creativecommons.org/licenses/by/3.0/deed.ja",
          downloadFrom: "http://linkdata.org/work/rdf1s9164i",
        },
        records: [
          {
            id: first.sourceRecordId,
            name: first.expectedNameSubstring,
            kana: "",
            category: "文化",
            periodText: "46000", // serial does not match first.startDate
            periodNote: "",
            venue: "",
            address: "",
            description: "",
            contactName: "",
            contactPhone: "",
            url: "",
            remarks: "",
          },
        ],
      }),
    ).toThrow(/Excel serial date mismatch/);
  });

  it("builds a complete validated dataset from synthetic inputs", () => {
    const records = CURATED_EVENTS.map((spec) => ({
      id: spec.sourceRecordId,
      name: `テスト_${spec.expectedNameSubstring}`,
      kana: "",
      category: "教育・文化",
      periodText: spec.dateNote,
      periodNote: "",
      venue: "松本城",
      address: "丸の内4-1",
      description: "",
      contactName: "担当課",
      contactPhone: "0263-34-3000",
      url: "https://www.matsumoto-castle.jp/",
      remarks: "",
    }));

    const dataset = buildMatsumotoCastleDataset({
      parsedEvents: {
        metadata: {
          attributionName: "松本市",
          licenseUrl: "https://creativecommons.org/licenses/by/3.0/deed.ja",
          downloadFrom: "http://linkdata.org/work/rdf1s9164i",
        },
        records,
      },
      weatherMonths,
      holidays: new Map([["2026-05-03", "憲法記念日"]]),
      generatedAt: "2026-11-28",
    });

    const expectedAnnual = dataset.monthlyStats.reduce(
      (sum, m) => sum + m.avgVisitors,
      0,
    );
    expect(dataset.annualAvgVisitors).toBe(expectedAnnual);
    expect(dataset.events).toHaveLength(CURATED_EVENTS.length);
    expect(dataset.days).toHaveLength(640);
  });
});
