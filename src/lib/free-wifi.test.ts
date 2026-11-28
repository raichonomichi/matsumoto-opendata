import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseCsvRows,
  parsePublicFacilitiesCsv,
  parseWifiCsv,
} from "../../pipelines/free-wifi/parsers";
import {
  deriveScheduleFlags,
  parseFacilitySchedule,
} from "../../pipelines/free-wifi/schedule-parser";
import {
  evaluateOpenStatus,
  getJstDateParts,
  haversineDistanceKm,
} from "./free-wifi-schedule";
import { freeWifiDatasetSchema } from "./free-wifi-schema";

describe("free-wifi CSV parsers", () => {
  it("parses quoted CSV fields, BOM, fullwidth numbers, and normalizes phone numbers", () => {
    const wifiCsv = [
      "\uFEFF項番,施設名称,住所,SSID,AP数,経度,緯度,分類",
      '２２,"Ｍウイング（第一地区公民館）","松本市中央1丁目18番1号",Matsumoto_Community_Free_WiFi,４,137.967,36.231,公衆無線LANアクセスポイント',
      '79,"松本市音楽文化ホール","松本市大字島内4351",,4,137.934,36.256,公衆無線LANアクセスポイント',
    ].join("\r\n");

    const wifiRows = parseWifiCsv(wifiCsv);
    expect(wifiRows).toHaveLength(2);
    expect(wifiRows[0]).toMatchObject({
      id: "22",
      name: "Ｍウイング（第一地区公民館）",
      ssid: "Matsumoto_Community_Free_WiFi",
      apCount: 4,
    });
    expect(wifiRows[1].ssid).toBeNull();

    const facilityCsv = [
      "施設番号,施設名,所在地,地域区分,部局名,課名,区分,電話番号,利用可能曜日,開始時間,終了時間,利用可能時間特記事項,経度,緯度",
      '880,"四賀支所","会田1001-1","四賀","住民自治局","四賀地域づくりセンター","市庁舎・支所・出張所","64-3111","月;火;水;木;金","8:30","17:15","土日祝日及び12/29～1/3を除く",137.98,36.31',
    ].join("\n");

    const facRows = parsePublicFacilitiesCsv(facilityCsv);
    expect(facRows).toHaveLength(1);
    expect(facRows[0].phone).toBe("0263-64-3111");
    expect(facRows[0].district).toBe("四賀");
    expect(parseCsvRows("a,b\n1,2")[0]).toEqual({ a: "1", b: "2" });
  });
});

describe("free-wifi schedule parser & JST open evaluation", () => {
  const sampleHolidays: Record<string, string> = {
    "2026-05-03": "憲法記念日",
    "2026-05-04": "みどりの日",
    "2026-05-05": "こどもの日",
    "2026-05-06": "休日",
    "2026-11-03": "文化の日",
    "2026-11-23": "勤労感謝の日",
    "2026-12-25": "テスト祝日",
  };

  it("parses M-Wing (2nd/4th Wednesday closed) and evaluates JST hours accurately", () => {
    const schedule = parseFacilitySchedule({
      openDaysRaw: "月;火;水;木;金;土;日",
      startRaw: "9:00",
      endRaw: "22:00",
      noteRaw: "毎月第2・4水曜日、12/29～1/3は休館日",
    });

    expect(schedule.kind).toBe("structured");
    const flags = deriveScheduleFlags(schedule);
    expect(flags).toEqual({
      openLate: true,
      openMonday: true,
      openWeekend: true,
      latestCloseMinutes: 22 * 60,
    });

    // 2026-11-04 is 1st Wednesday, 10:00 JST (01:00 UTC) -> open
    const firstWedOpen = evaluateOpenStatus(
      schedule,
      new Date("2026-11-04T01:00:00Z"),
      sampleHolidays,
    );
    expect(firstWedOpen.status).toBe("open");
    expect(firstWedOpen.todayHoursText).toBe("9:00〜22:00");

    // 2026-11-11 is 2nd Wednesday, 10:00 JST -> closed
    const secondWedClosed = evaluateOpenStatus(
      schedule,
      new Date("2026-11-11T01:00:00Z"),
      sampleHolidays,
    );
    expect(secondWedClosed.status).toBe("closed");
    expect(secondWedClosed.reason).toContain("第2水曜");

    // 2026-12-30 -> year-end closed
    const yearEnd = evaluateOpenStatus(
      schedule,
      new Date("2026-12-30T03:00:00Z"),
      sampleHolidays,
    );
    expect(yearEnd.status).toBe("closed");
    expect(yearEnd.reason).toContain("年末年始");
  });

  it("parses Chuo Library and handles Monday holidays, substitute Tuesdays, and 4th Fridays", () => {
    const schedule = parseFacilitySchedule({
      openDaysRaw: "火;水;木;金;土;日",
      startRaw: "9:30",
      endRaw: "火～金　19：00、土；日；休日　17：00",
      noteRaw:
        "月曜日については休日は開館し、翌日振替休館。翌日も休日の場合は振替休館なし。毎月第4金曜日は休館。休日の場合は、前日が休館、当日が開館。12/29～1/3は休館。特別整理期間は休館",
    });

    expect(schedule.kind).toBe("structured");
    if (schedule.kind !== "structured") throw new Error("Expected structured");
    expect(schedule.mondayHolidayRule).toBe(
      "open_and_close_next_day_if_not_holiday",
    );

    // 2026-11-23 Mon (勤労感謝の日) 14:00 JST -> open until 17:00
    const monHoliday = evaluateOpenStatus(
      schedule,
      new Date("2026-11-23T05:00:00Z"),
      sampleHolidays,
    );
    expect(monHoliday.status).toBe("open");
    expect(monHoliday.todayHoursText).toBe("9:30〜17:00");

    // 2026-11-24 Tue -> substitute closed for Monday holiday
    const tueSubstitute = evaluateOpenStatus(
      schedule,
      new Date("2026-11-24T05:00:00Z"),
      sampleHolidays,
    );
    expect(tueSubstitute.status).toBe("closed");
    expect(tueSubstitute.reason).toContain("振替休館");

    // 2026-11-27 4th Fri -> regular closed
    const fourthFri = evaluateOpenStatus(
      schedule,
      new Date("2026-11-27T03:00:00Z"),
      sampleHolidays,
    );
    expect(fourthFri.status).toBe("closed");

    // 2026-12-24 Thu before 4th Fri holiday (2026-12-25) -> prev_day closed, 12-25 open
    const thuBeforeHolidayFri = evaluateOpenStatus(
      schedule,
      new Date("2026-12-24T03:00:00Z"),
      sampleHolidays,
    );
    expect(thuBeforeHolidayFri.status).toBe("closed");
    const holidayFri = evaluateOpenStatus(
      schedule,
      new Date("2026-12-25T03:00:00Z"),
      sampleHolidays,
    );
    expect(holidayFri.status).toBe("open");
  });

  it("parses Nanbu Library (Monday open until 22:00, Tuesday closed, holiday rules)", () => {
    const schedule = parseFacilitySchedule({
      openDaysRaw: "月;水;木;金;土;日",
      startRaw: "10:00",
      endRaw: "月・水～土　22：00、日　17：00",
      noteRaw:
        "休日は日曜日を除いて休館・毎月第4金曜日は休館。休日の場合は、前日と当日が休館。12/29～1/3は休館・特別整理期間は休館",
    });

    // Regular Monday 20:30 JST (2026-11-16T11:30:00Z) -> open
    const monNight = evaluateOpenStatus(
      schedule,
      new Date("2026-11-16T11:30:00Z"),
      sampleHolidays,
    );
    expect(monNight.status).toBe("open");
    expect(monNight.todayHoursText).toBe("10:00〜22:00");

    // Tuesday -> closed
    const tue = evaluateOpenStatus(
      schedule,
      new Date("2026-11-17T03:00:00Z"),
      sampleHolidays,
    );
    expect(tue.status).toBe("closed");

    // Monday holiday (2026-11-23) -> closed
    const monHol = evaluateOpenStatus(
      schedule,
      new Date("2026-11-23T03:00:00Z"),
      sampleHolidays,
    );
    expect(monHol.status).toBe("closed");

    // 2026-12-24 & 2026-12-25 -> both closed (both_prev_and_day)
    expect(
      evaluateOpenStatus(
        schedule,
        new Date("2026-12-24T03:00:00Z"),
        sampleHolidays,
      ).status,
    ).toBe("closed");
    expect(
      evaluateOpenStatus(
        schedule,
        new Date("2026-12-25T03:00:00Z"),
        sampleHolidays,
      ).status,
    ).toBe("closed");
  });

  it("parses Hata Library seasonal hours (Apr-Nov 19:00 vs Dec-Mar 17:00) and day-after-holiday closure", () => {
    const schedule = parseFacilitySchedule({
      openDaysRaw: "火;水;木;金;土;日",
      startRaw: "10:00",
      endRaw:
        "・火～金　4月～11月　19：00、12月～3月　17：00、土；日；休日　17：00",
      noteRaw:
        "休日の翌日は休館。当該日が土、日、休日にあたるときは、当該日以後の休館日を除いた最初の平日が休館。毎月第4金曜日は休館。休日の場合は、前日が休館、当日が開館。12/29～1/3は休館。特別整理期間は休館",
    });

    // 2026-11-12 Thu 18:30 JST (09:30 UTC) -> open (closes 19:00)
    const novEvening = evaluateOpenStatus(
      schedule,
      new Date("2026-11-12T09:30:00Z"),
      sampleHolidays,
    );
    expect(novEvening.status).toBe("open");
    expect(novEvening.todayHoursText).toBe("10:00〜19:00");

    // 2026-12-10 Thu 18:30 JST (09:30 UTC) -> closed (closes 17:00 in Dec)
    const decEvening = evaluateOpenStatus(
      schedule,
      new Date("2026-12-10T09:30:00Z"),
      sampleHolidays,
    );
    expect(decEvening.status).toBe("closed");
    expect(decEvening.todayHoursText).toBe("10:00〜17:00");

    // 2026-11-04 Wed (day after 文化の日) -> closed
    const afterCultureDay = evaluateOpenStatus(
      schedule,
      new Date("2026-11-04T03:00:00Z"),
      sampleHolidays,
    );
    expect(afterCultureDay.status).toBe("closed");

    // 2026-05-07 Thu (first open weekday after May 3-6 GW) -> closed
    const afterGw = evaluateOpenStatus(
      schedule,
      new Date("2026-05-07T03:00:00Z"),
      sampleHolidays,
    );
    expect(afterGw.status).toBe("closed");
  });

  it("handles outdoor_24h, stale construction fallback, and JST date parts consistently", () => {
    const jst = getJstDateParts(new Date("2026-11-28T23:30:00Z"));
    expect(jst.ymd).toBe("2026-11-29");
    expect(jst.weekday).toBe(0);
    expect(jst.minutesOfDay).toBe(8 * 60 + 30);

    const stale = parseFacilitySchedule({
      openDaysRaw: "月;火;水;木;金;土;日(※12/29～1/3除く)",
      startRaw: "9:00",
      endRaw: "17:00",
      noteRaw:
        "【休館日】3～11月:第3月曜日（※耐震対策等工事のため令和6年秋頃まで休館中）",
    });
    expect(stale.kind).toBe("check_official");
    expect(evaluateOpenStatus(stale, new Date(), {}).status).toBe("unknown");

    const outdoor = evaluateOpenStatus(
      { kind: "outdoor_24h", summaryText: "屋外", holidayNote: null },
      new Date(),
      {},
    );
    expect(outdoor.status).toBe("outdoor");
  });
});

describe("haversineDistanceKm", () => {
  it("computes realistic distance between Matsumoto Station and Matsumoto Castle", () => {
    const km = haversineDistanceKm(36.2309, 137.9644, 36.2386, 137.9701);
    expect(km).toBeGreaterThan(0.85);
    expect(km).toBeLessThan(1.15);
  });
});

describe("generated free-wifi.json dataset integrity", () => {
  it("validates schema, spot counts, coordinates, supplements, and cleaned notes", async () => {
    const raw = await readFile(
      path.resolve("src/data/free-wifi.json"),
      "utf-8",
    );
    const dataset = freeWifiDatasetSchema.parse(JSON.parse(raw));

    expect(dataset.count).toBe(85);
    expect(dataset.spots).toHaveLength(85);

    const ids = new Set(dataset.spots.map((s) => s.id));
    expect(ids.size).toBe(85);

    for (const spot of dataset.spots) {
      expect(spot.lat).toBeGreaterThanOrEqual(36.0);
      expect(spot.lat).toBeLessThanOrEqual(36.5);
      expect(spot.lng).toBeGreaterThanOrEqual(137.5);
      expect(spot.lng).toBeLessThanOrEqual(138.2);
      expect(spot.schedule.summaryText).not.toMatch(/令和[56]年秋頃まで休館中/);
      expect(spot.schedule.holidayNote ?? "").not.toMatch(
        /令和[56]年秋頃まで休館中/,
      );
    }

    const agata = dataset.spots.find((s) => s.id === "agata-no-mori-library");
    expect(agata).toBeDefined();
    expect(agata?.ssid).toBe("MLib-wifi");
    expect(agata?.purposes).toContain("study_work");

    const ekimae = dataset.spots.find((s) => s.id === "matsumoto-eki-hiroba");
    expect(ekimae?.facilityNumber).toBeNull();
    expect(ekimae?.schedule.kind).toBe("outdoor_24h");

    const hataKominkan = dataset.spots.find((s) => s.id === "hata-kominkan");
    expect(hataKominkan?.facilityNumber).toBe("ga02");

    expect(
      dataset.spots.filter((s) => s.purposes.includes("study_work")).length,
    ).toBe(15);
    expect(
      dataset.spots.filter((s) => s.purposes.includes("sightseeing")).length,
    ).toBe(22);
    expect(
      dataset.spots.filter((s) => s.purposes.includes("meeting_rental")).length,
    ).toBe(40);
  });
});
