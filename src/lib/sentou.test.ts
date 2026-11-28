import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BATH_CURATIONS } from "../../pipelines/sentou/curation";
import { parseLinkDataBathTsv } from "../../pipelines/sentou/parsers";
import {
  buildTargetDateForPreset,
  evaluateBathAvailability,
  formatBathMinutes,
  formatDurationJa,
  haversineDistanceKm,
} from "./sentou-schedule";
import { type BathSchedule, sentouDatasetSchema } from "./sentou-schema";

describe("parseLinkDataBathTsv", () => {
  it("parses LinkData matsumoto_bath TSV, skipping metadata lines and handling blank operators", () => {
    const tsv = [
      "\uFEFF#LINK",
      "#lang\tja",
      "#attribution_name\t松本市　DX推進本部",
      "#license\thttp://creativecommons.org/licenses/by/3.0/deed.ja",
      "#property\t施設名称\t施設郵便番号\t施設所在地\t営業者\t種別\t許可日\t許可番号",
      "3\t塩井乃湯\t390-0874\t松本市大手３－６－４\t\t一般公衆浴場\t1962-11-09\t第4774号",
      "54\tふれあい山辺館　白糸の湯\t390-0221\t松本市里山辺湯ノ原８５－１他\t美ヶ原温泉旅館協同組合\tその他の公衆浴場\t2003-06-30\t第3-1号",
    ].join("\r\n");

    const parsed = parseLinkDataBathTsv(tsv);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]).toMatchObject({
      id: "3",
      name: "塩井乃湯",
      registryName: "塩井乃湯",
      postalCode: "390-0874",
      address: "松本市大手3-6-4",
      operator: null,
      permitCategory: "一般公衆浴場",
      permittedAt: "1962-11-09",
      permitNumber: "第4774号",
    });
    expect(parsed.records[1].registryName).toBe("ふれあい山辺館 白糸の湯");
    expect(parsed.records[1].operator).toBe("美ヶ原温泉旅館協同組合");
  });

  it("throws on unexpected permitCategory", () => {
    const tsv =
      "999\tテスト浴場\t390-0000\t松本市中央1-1\t\t未知の浴場種別\t2025-01-01\t第1号";
    expect(() => parseLinkDataBathTsv(tsv)).toThrow(
      /Unexpected permitCategory/,
    );
  });
});

describe("evaluateBathAvailability & helpers", () => {
  const holidays: Record<string, string> = {
    "2026-05-03": "憲法記念日",
    "2026-05-04": "みどりの日",
    "2026-05-05": "こどもの日",
    "2026-05-06": "休日",
    "2026-11-03": "文化の日",
    "2026-11-23": "勤労感謝の日",
    "2027-05-03": "憲法記念日",
    "2027-05-04": "みどりの日",
    "2027-05-05": "こどもの日",
  };

  it("formats 24:00 and durations cleanly", () => {
    expect(formatBathMinutes(1440)).toBe("24:00");
    expect(formatBathMinutes(9 * 60 + 5)).toBe("9:05");
    expect(formatDurationJa(135)).toBe("2時間15分");
    expect(formatDurationJa(120)).toBe("2時間");
    expect(formatDurationJa(45)).toBe("45分");
  });

  it("builds JST preset target dates accurately across midnight boundaries", () => {
    // 2026-11-28T23:30:00Z = 2026-11-29 08:30 JST
    const now = new Date("2026-11-28T23:30:00Z");
    const today17 = buildTargetDateForPreset(now, "today_17");
    const today20 = buildTargetDateForPreset(now, "today_20");
    const tomorrow08 = buildTargetDateForPreset(now, "tomorrow_08");

    expect(today17.toISOString()).toBe("2026-11-29T08:00:00.000Z");
    expect(today20.toISOString()).toBe("2026-11-29T11:00:00.000Z");
    expect(tomorrow08.toISOString()).toBe("2026-11-29T23:00:00.000Z");
  });

  it("evaluates open_now, opening_later_today, last-entry cutoff, 24:00 close, and nth weekday closure", () => {
    const zuishoSchedule = BATH_CURATIONS["59"].schedule;

    // 2026-11-10 Tue 10:00 JST (01:00 UTC) -> open_now, closes 24:00, last entry 23:20
    const open = evaluateBathAvailability(
      zuishoSchedule,
      new Date("2026-11-10T01:00:00Z"),
      holidays,
    );
    expect(open.status).toBe("open_now");
    expect(open.canEnterToday).toBe(true);
    expect(open.todayHoursText).toBe("9:30〜24:00（最終受付 23:20）");
    expect(open.minutesUntilLastEntry).toBe(13 * 60 + 20);

    // 2026-11-10 Tue 08:00 JST (2026-11-09T23:00:00Z) -> opening_later_today (9:30)
    const beforeOpen = evaluateBathAvailability(
      zuishoSchedule,
      new Date("2026-11-09T23:00:00Z"),
      holidays,
    );
    expect(beforeOpen.status).toBe("opening_later_today");
    expect(beforeOpen.canEnterToday).toBe(true);
    expect(beforeOpen.minutesUntilOpen).toBe(90);

    // 2026-11-10 Tue 23:30 JST (14:30 UTC) -> closed_today (after 23:20 last entry, before 24:00 close)
    const afterLastEntry = evaluateBathAvailability(
      zuishoSchedule,
      new Date("2026-11-10T14:30:00Z"),
      holidays,
    );
    expect(afterLastEntry.status).toBe("closed_today");
    expect(afterLastEntry.canEnterToday).toBe(false);
    expect(afterLastEntry.detailText).toContain("最終受付（23:20）終了");

    // 2026-11-17 3rd Tuesday -> regular monthly closure
    const thirdTue = evaluateBathAvailability(
      zuishoSchedule,
      new Date("2026-11-17T03:00:00Z"),
      holidays,
    );
    expect(thirdTue.status).toBe("closed_today");
    expect(thirdTue.detailText).toContain("第3火曜");
  });

  it("handles holiday shift rules (next day vs next weekday including GW chain)", () => {
    const hotPlaza = BATH_CURATIONS["81"].schedule; // Tue closed -> open on Tue holiday, closed Wed
    const lala = BATH_CURATIONS["111"].schedule; // Tue closed -> open on Tue holiday, closed next weekday
    const ryushima = BATH_CURATIONS["91"].schedule; // Mon closed -> open on Mon holiday, closed next weekday

    // 2026-11-03 Tue (文化の日) 15:00 JST -> Hot Plaza open
    expect(
      evaluateBathAvailability(
        hotPlaza,
        new Date("2026-11-03T06:00:00Z"),
        holidays,
      ).status,
    ).toBe("open_now");
    // 2026-11-04 Wed -> Hot Plaza closed (substitute)
    const hotPlazaWed = evaluateBathAvailability(
      hotPlaza,
      new Date("2026-11-04T06:00:00Z"),
      holidays,
    );
    expect(hotPlazaWed.status).toBe("closed_today");
    expect(hotPlazaWed.detailText).toContain("翌日振替休館");

    // 2026-05-05 Tue (こどもの日) -> Lala open; 2026-05-06 Wed (GW 休日) -> Lala open; 2026-05-07 Thu -> Lala closed
    expect(
      evaluateBathAvailability(lala, new Date("2026-05-05T03:00:00Z"), holidays)
        .status,
    ).toBe("open_now");
    expect(
      evaluateBathAvailability(lala, new Date("2026-05-06T03:00:00Z"), holidays)
        .status,
    ).toBe("open_now");
    const lalaMay7 = evaluateBathAvailability(
      lala,
      new Date("2026-05-07T03:00:00Z"),
      holidays,
    );
    expect(lalaMay7.status).toBe("closed_today");
    expect(lalaMay7.detailText).toContain("翌平日振替休館");

    // 2026-11-23 Mon (勤労感謝の日) -> Ryushima open; 2026-11-24 Tue -> Ryushima closed
    expect(
      evaluateBathAvailability(
        ryushima,
        new Date("2026-11-23T03:00:00Z"),
        holidays,
      ).status,
    ).toBe("open_now");
    expect(
      evaluateBathAvailability(
        ryushima,
        new Date("2026-11-24T03:00:00Z"),
        holidays,
      ).status,
    ).toBe("closed_today");

    // 枇杷の湯 (Mon closed -> open on Mon holiday, closed next day EVEN if next day is also a holiday)
    const biwanoyu = BATH_CURATIONS["36"].schedule;
    expect(
      evaluateBathAvailability(
        biwanoyu,
        new Date("2027-05-03T03:00:00Z"), // Mon 2027-05-03 12:00 JST (憲法記念日)
        holidays,
      ).status,
    ).toBe("open_now");
    const biwanoyuNextHoliday = evaluateBathAvailability(
      biwanoyu,
      new Date("2027-05-04T03:00:00Z"), // Tue 2027-05-04 12:00 JST (みどりの日)
      holidays,
    );
    expect(biwanoyuNextHoliday.status).toBe("closed_today");
    expect(biwanoyuNextHoliday.detailText).toContain("翌日振替休館");
  });

  it("handles seasonal closures, seasonal hours/openDays overrides, and multi-session schedules", () => {
    const shirahone = BATH_CURATIONS["113"].schedule;
    const shiraito = BATH_CURATIONS["54"].schedule;
    const azusaKohan = BATH_CURATIONS["39"].schedule;
    const kamikochiHotel = BATH_CURATIONS["31"].schedule;

    // 白骨温泉公共野天風呂: 11/28 & 01/15 winter closed; 07/15 Wed open
    expect(
      evaluateBathAvailability(
        shirahone,
        new Date("2026-11-28T03:00:00Z"),
        holidays,
      ).status,
    ).toBe("closed_today");
    expect(
      evaluateBathAvailability(
        shirahone,
        new Date("2026-01-15T03:00:00Z"),
        holidays,
      ).status,
    ).toBe("closed_today");
    expect(
      evaluateBathAvailability(
        shirahone,
        new Date("2026-07-15T03:00:00Z"),
        holidays,
      ).status,
    ).toBe("open_now");

    // 白糸の湯: Apr-Sep opens 6:30 vs Oct-Mar opens 7:00; 1st/3rd Tue holiday -> check_official
    expect(
      evaluateBathAvailability(
        shiraito,
        new Date("2026-07-08T21:45:00Z"), // 2026-07-09 06:45 JST
        holidays,
      ).status,
    ).toBe("open_now");
    expect(
      evaluateBathAvailability(
        shiraito,
        new Date("2026-11-11T21:45:00Z"), // 2026-11-12 06:45 JST
        holidays,
      ).status,
    ).toBe("opening_later_today");
    expect(
      evaluateBathAvailability(
        shiraito,
        new Date("2026-11-03T03:00:00Z"), // 1st Tue + holiday
        holidays,
      ).status,
    ).toBe("check_official");

    // 梓湖畔の湯: winter weekday (2026-11-27 Fri) closed, winter weekend (2026-11-28 Sat) open
    expect(
      evaluateBathAvailability(
        azusaKohan,
        new Date("2026-11-27T03:00:00Z"),
        holidays,
      ).status,
    ).toBe("closed_today");
    expect(
      evaluateBathAvailability(
        azusaKohan,
        new Date("2026-11-28T03:00:00Z"),
        holidays,
      ).status,
    ).toBe("open_now");

    // 上高地温泉ホテル: 2026-07-15 10:30 JST (between 9:30 and 12:00) -> opening_later_today (12:00)
    const betweenSessions = evaluateBathAvailability(
      kamikochiHotel,
      new Date("2026-07-15T01:30:00Z"),
      holidays,
    );
    expect(betweenSessions.status).toBe("opening_later_today");
    expect(betweenSessions.minutesUntilOpen).toBe(90);
  });

  it("handles not_public and check_official schedules", () => {
    const notPublic: BathSchedule = {
      kind: "not_public",
      summaryText: "地元専用",
      lastEntryText: null,
      holidayNote: null,
      irregularNote: null,
    };
    const checkOfficial: BathSchedule = {
      kind: "check_official",
      summaryText: "要確認",
      lastEntryText: null,
      holidayNote: null,
      irregularNote: null,
    };

    expect(
      evaluateBathAvailability(notPublic, new Date(), holidays).status,
    ).toBe("not_public");
    expect(
      evaluateBathAvailability(checkOfficial, new Date(), holidays).status,
    ).toBe("check_official");
  });

  it("calculates realistic distance in Matsumoto and respects zero/symmetry", () => {
    const km = haversineDistanceKm(36.2309, 137.9644, 36.262989, 137.9888);
    expect(km).toBeGreaterThan(3.5);
    expect(km).toBeLessThan(4.8);
    expect(haversineDistanceKm(36.2309, 137.9644, 36.2309, 137.9644)).toBe(0);
    expect(
      haversineDistanceKm(36.262989, 137.9888, 36.2309, 137.9644),
    ).toBeCloseTo(km, 10);
  });

  it("checks exact open/lastEntry/close minute boundaries, yearEndClosed, daySessions, and seasonal openOnHolidaysOverride", () => {
    const schedule: BathSchedule = {
      kind: "structured",
      openDays: [1, 2, 3, 4, 5],
      defaultSessions: [
        {
          openMinutes: 10 * 60,
          lastEntryMinutes: 20 * 60,
          closeMinutes: 21 * 60,
        },
      ],
      daySessions: {
        "6": [
          {
            openMinutes: 9 * 60,
            lastEntryMinutes: 21 * 60,
            closeMinutes: 22 * 60,
          },
        ],
        holiday: [
          {
            openMinutes: 8 * 60,
            lastEntryMinutes: 18 * 60,
            closeMinutes: 19 * 60,
          },
        ],
      },
      seasonalOverrides: [
        {
          months: [5],
          openOnHolidaysOverride: true,
          note: "GW特別営業",
        },
      ],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: { startMmdd: "12-30", endMmdd: "01-02" },
      summaryText: "平日 10:00〜21:00",
      lastEntryText: "20:00",
      holidayNote: null,
      irregularNote: null,
    };

    // 2026-11-10 Tue 09:59 JST -> opening_later_today
    expect(
      evaluateBathAvailability(schedule, new Date("2026-11-10T00:59:00Z"), {})
        .status,
    ).toBe("opening_later_today");
    // 10:00 JST -> open_now
    expect(
      evaluateBathAvailability(schedule, new Date("2026-11-10T01:00:00Z"), {})
        .status,
    ).toBe("open_now");
    // 19:59 JST -> open_now
    expect(
      evaluateBathAvailability(schedule, new Date("2026-11-10T10:59:00Z"), {})
        .status,
    ).toBe("open_now");
    // 20:00 JST -> closed_today (at last entry, before 21:00 close)
    const atLastEntry = evaluateBathAvailability(
      schedule,
      new Date("2026-11-10T11:00:00Z"),
      {},
    );
    expect(atLastEntry.status).toBe("closed_today");
    expect(atLastEntry.detailText).toContain("閉館 21:00");
    // 21:00 JST -> closed_today (after close)
    const afterClose = evaluateBathAvailability(
      schedule,
      new Date("2026-11-10T12:00:00Z"),
      {},
    );
    expect(afterClose.status).toBe("closed_today");
    expect(afterClose.detailText).toBe("本日の受付終了（最終受付 20:00）");

    // 2026-12-30 -> year-end closed; 2027-01-03 -> open (if weekday, wait 2027-01-04 Mon is open)
    expect(
      evaluateBathAvailability(schedule, new Date("2026-12-30T03:00:00Z"), {})
        .label,
    ).toBe("年末年始休業（目安）");
    expect(
      evaluateBathAvailability(schedule, new Date("2027-01-02T03:00:00Z"), {})
        .label,
    ).toBe("年末年始休業（目安）");

    // 2026-05-03 Sun (in May + holiday + openOnHolidaysOverride=true) -> uses daySessions.holiday (8:00〜19:00)
    const mayHoliday = evaluateBathAvailability(
      schedule,
      new Date("2026-05-03T00:00:00Z"), // 09:00 JST
      holidays,
    );
    expect(mayHoliday.status).toBe("open_now");
    expect(mayHoliday.todayHoursText).toBe("8:00〜19:00（最終受付 18:00）");
  });
});

describe("generated sentou.json dataset integrity", () => {
  it("validates schema, counts, coordinates, local-only rules, and record #87/#122 accuracy", async () => {
    const raw = await readFile(path.resolve("src/data/sentou.json"), "utf-8");
    const dataset = sentouDatasetSchema.parse(JSON.parse(raw));

    expect(dataset.count).toBe(126);
    expect(dataset.facilities).toHaveLength(126);
    expect(dataset.counts.total).toBe(126);
    expect(dataset.counts.publicDropIn).toBe(25);
    expect(dataset.counts.dayUseOrReserved).toBe(11);
    expect(dataset.counts.restricted).toBe(31);
    expect(dataset.counts.ippanSentou).toBe(7);
    expect(dataset.counts.localOnly).toBe(12);

    const ids = new Set(dataset.facilities.map((f) => f.id));
    const sourceIds = new Set(dataset.facilities.map((f) => f.sourceRecordId));
    expect(ids.size).toBe(126);
    expect(sourceIds.size).toBe(126);

    const ippanSentou = dataset.facilities.filter(
      (f) => f.permitCategory === "一般公衆浴場",
    );
    expect(ippanSentou).toHaveLength(7);
    for (const s of ippanSentou) {
      expect(s.accessCategory).toBe("public_drop_in");
    }

    const withCuratedCoords = dataset.facilities.filter(
      (f) =>
        f.accessCategory === "public_drop_in" ||
        f.accessCategory === "day_use_inn" ||
        f.accessCategory === "reservation_required",
    );
    expect(withCuratedCoords).toHaveLength(36);
    for (const f of withCuratedCoords) {
      expect(f.lat).not.toBeNull();
      expect(f.lng).not.toBeNull();
      expect(f.lat ?? 0).toBeGreaterThanOrEqual(36.0);
      expect(f.lat ?? 0).toBeLessThanOrEqual(36.5);
      expect(f.lng ?? 0).toBeGreaterThanOrEqual(137.5);
      expect(f.lng ?? 0).toBeLessThanOrEqual(138.2);
    }

    const localOnly = dataset.facilities.filter(
      (f) => f.accessCategory === "local_only",
    );
    expect(localOnly).toHaveLength(12);
    for (const f of localOnly) {
      expect(f.schedule.kind).toBe("not_public");
    }

    const rec87 = dataset.facilities.find((f) => f.sourceRecordId === "87");
    expect(rec87?.name).toContain("梓水苑");
    expect(rec87?.name).not.toContain("山の神");
    expect(rec87?.officialUrl).toBe("https://www.shisuien.jp/");

    const rec122 = dataset.facilities.find((f) => f.sourceRecordId === "122");
    expect(rec122?.accessCategory).toBe("check_lodging_or_status");
    expect(rec122?.schedule.kind).toBe("check_official");
  });
});
