import { describe, expect, it } from "vitest";
import { buildFreeWifiDataset } from "../build-free-wifi";
import { inferAreaGroup, inferSsidSystem } from "./curation";
import {
  parsePublicFacilitiesCsv,
  parseWifiCsv,
  type RawFacilityRecord,
  type RawWifiRecord,
} from "./parsers";
import { deriveScheduleFlags, parseFacilitySchedule } from "./schedule-parser";

describe("free-wifi CSV parsers edge cases", () => {
  it("falls back to sequential ID and apCount=1, and rejects invalid rows", () => {
    const csv = [
      "項番,施設名称,住所,SSID,AP数,経度,緯度,分類",
      ",テスト施設,松本市中央1-1,,0,137.96,36.23,",
    ].join("\n");
    const rows = parseWifiCsv(csv);
    expect(rows[0]).toMatchObject({
      id: "1",
      ssid: null,
      apCount: 1,
      category: "",
    });

    expect(() =>
      parseWifiCsv(
        "項番,施設名称,住所,SSID,AP数,経度,緯度,分類\n5,,住所,,1,137.9,36.2,",
      ),
    ).toThrow(/Invalid Wi-Fi CSV row/);

    expect(() =>
      parseWifiCsv(
        "項番,施設名称,住所,SSID,AP数,経度,緯度,分類\n5,名称,住所,,1,abc,36.2,",
      ),
    ).toThrow(/Invalid Wi-Fi CSV row/);
  });

  it("filters empty facility rows, handles phone normalization variants, and missing coordinates", () => {
    const csv = [
      "施設番号,施設名,所在地,地域区分,部局名,課名,区分,電話番号,利用可能曜日,開始時間,終了時間,利用可能時間特記事項,経度,緯度",
      ',空ID,,,,,,,,,,,,"",""',
      "10,テスト公民館,松本市,中央,部,課,公民館,0263-33-1111,月,9:00,17:00,,,",
      "11,テスト支所,松本市,四賀,部,課,支所,,月,9:00,17:00,,137.9,36.3",
    ].join("\n");
    const rows = parsePublicFacilitiesCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      facilityNumber: "10",
      phone: "0263-33-1111",
      lng: null,
      lat: null,
    });
    expect(rows[1]).toMatchObject({
      facilityNumber: "11",
      phone: null,
      lng: 137.9,
      lat: 36.3,
    });
  });
});

describe("parseFacilitySchedule & deriveScheduleFlags", () => {
  it("returns check_official for blank, 未定, invalid days, or unparseable times", () => {
    expect(
      parseFacilitySchedule({
        openDaysRaw: "",
        startRaw: "9:00",
        endRaw: "17:00",
        noteRaw: "",
      }).kind,
    ).toBe("check_official");

    expect(
      parseFacilitySchedule({
        openDaysRaw: "月;火",
        startRaw: "未定",
        endRaw: "17:00",
        noteRaw: "",
      }).kind,
    ).toBe("check_official");

    expect(
      parseFacilitySchedule({
        openDaysRaw: "不明",
        startRaw: "9:00",
        endRaw: "17:00",
        noteRaw: "",
      }).kind,
    ).toBe("check_official");

    expect(
      parseFacilitySchedule({
        openDaysRaw: "月;火",
        startRaw: "9:00",
        endRaw: "随時",
        noteRaw: "",
      }).kind,
    ).toBe("check_official");
  });

  it("parses 通年 + 毎週火曜日 and all 4 year-end closure patterns", () => {
    const s1 = parseFacilitySchedule({
      openDaysRaw: "通年",
      startRaw: "9:00",
      endRaw: "21:00",
      noteRaw: "毎週火曜日、12/28～1/3は休館",
    });
    expect(s1.kind).toBe("structured");
    if (s1.kind === "structured") {
      expect(s1.openDays).toEqual([0, 1, 3, 4, 5, 6]);
      expect(s1.yearEndClosed).toEqual({
        startMmdd: "12-28",
        endMmdd: "01-03",
      });
    }

    const s2 = parseFacilitySchedule({
      openDaysRaw: "月;火;水;木;金",
      startRaw: "9:00",
      endRaw: "17:00",
      noteRaw: "12月31日から1月3日休館",
    });
    if (s2.kind === "structured") {
      expect(s2.yearEndClosed).toEqual({
        startMmdd: "12-31",
        endMmdd: "01-03",
      });
    }

    const s3 = parseFacilitySchedule({
      openDaysRaw: "月;火;水;木;金",
      startRaw: "9:00",
      endRaw: "17:00",
      noteRaw: "年末年始は休館",
    });
    if (s3.kind === "structured") {
      expect(s3.yearEndClosed).toEqual({
        startMmdd: "12-29",
        endMmdd: "01-03",
      });
    }
  });

  it("parses Hata Culture Center seasonal hours, variable closing note, Hata Kominkan, Shonan, and Kyoiku Bunka Center", () => {
    const hataCulture = parseFacilitySchedule({
      openDaysRaw: "月;火;水;木;金;土;日",
      startRaw: "9:00",
      endRaw: "4月～11月 22:00、12月～3月 17:00(夜間利用がない場合は17:00)",
      noteRaw: "月曜日が祝日の場合は翌平日が休館日",
    });
    expect(hataCulture.kind).toBe("structured");
    if (hataCulture.kind === "structured") {
      expect(hataCulture.seasonalOverrides).toHaveLength(2);
      expect(hataCulture.seasonalOverrides[0]?.saturday?.closeMinutes).toBe(
        22 * 60,
      );
      expect(hataCulture.seasonalOverrides[1]?.weekday?.closeMinutes).toBe(
        17 * 60,
      );
      expect(hataCulture.variableClosingNote).toBe("夜間利用がない場合は17:00");
      expect(hataCulture.mondayHolidayRule).toBe("open_and_close_next_weekday");
    }

    const nightVar = parseFacilitySchedule({
      openDaysRaw: "月;火;水;木;金;土;日",
      startRaw: "9:00",
      endRaw: "22:00（夜間利用のない日は17:00まで）",
      noteRaw: "月曜日については当日が休日にあたるときは、当日と翌日が休館",
    });
    if (nightVar.kind === "structured") {
      expect(nightVar.variableClosingNote).toBe("夜間利用のない日は17:00まで");
      expect(nightVar.mondayHolidayRule).toBe("close_monday_and_next_day");
    }

    const hataKominkan = parseFacilitySchedule({
      openDaysRaw: "月;火;水;木;金;土",
      startRaw: "9:00",
      endRaw: "22:00(日曜日・休日は17:00)",
      noteRaw: "第1・3日曜日休館",
    });
    if (hataKominkan.kind === "structured") {
      expect(hataKominkan.openDays).toContain(0);
      expect(hataKominkan.dayHours?.["0"]?.closeMinutes).toBe(17 * 60);
      expect(hataKominkan.dayHours?.holiday?.closeMinutes).toBe(17 * 60);
      expect(hataKominkan.nthWeekdaysClosed).toEqual([
        { nth: 1, weekday: 0, shiftIfHoliday: "none" },
        { nth: 3, weekday: 0, shiftIfHoliday: "none" },
      ]);
    }

    const shonan = parseFacilitySchedule({
      openDaysRaw: "月;火;水;木;金;土;日",
      startRaw: "9:00",
      endRaw: "22:00（日曜日のみ17:00）",
      noteRaw: "祝日の翌日(祝日にあたる時は翌平日)",
    });
    if (shonan.kind === "structured") {
      expect(shonan.dayHours?.["0"]?.closeMinutes).toBe(17 * 60);
      expect(shonan.dayHours?.holiday).toBeUndefined();
      expect(shonan.dayAfterHolidayClosed).toBe(true);
    }

    const kyoiku = parseFacilitySchedule({
      openDaysRaw: "火;水;木;金;土;日",
      startRaw: "9:00",
      endRaw: "21:00",
      noteRaw: "日曜日及び祝日は17:00閉館。祝日・年末年始は閉庁",
    });
    if (kyoiku.kind === "structured") {
      expect(kyoiku.dayHours?.["0"]?.closeMinutes).toBe(17 * 60);
      expect(kyoiku.dayHours?.holiday?.closeMinutes).toBe(17 * 60);
      expect(kyoiku.closedOnHolidays).toBe("always");
    }
  });

  it("derives schedule flags accurately across kinds and 19:00 threshold", () => {
    expect(
      deriveScheduleFlags({
        kind: "outdoor_24h",
        summaryText: "屋外",
        holidayNote: null,
      }),
    ).toEqual({
      openLate: true,
      openMonday: true,
      openWeekend: true,
      latestCloseMinutes: 1440,
    });

    expect(
      deriveScheduleFlags({
        kind: "check_official",
        summaryText: "要確認",
        holidayNote: null,
      }),
    ).toEqual({
      openLate: false,
      openMonday: false,
      openWeekend: false,
      latestCloseMinutes: null,
    });

    const closes1859 = parseFacilitySchedule({
      openDaysRaw: "火;水;木;金",
      startRaw: "9:00",
      endRaw: "18:59",
      noteRaw: "",
    });
    expect(deriveScheduleFlags(closes1859)).toEqual({
      openLate: false,
      openMonday: false,
      openWeekend: false,
      latestCloseMinutes: 18 * 60 + 59,
    });

    const closes1900 = parseFacilitySchedule({
      openDaysRaw: "月;火;土",
      startRaw: "9:00",
      endRaw: "19:00",
      noteRaw: "",
    });
    expect(deriveScheduleFlags(closes1900)).toEqual({
      openLate: true,
      openMonday: true,
      openWeekend: true,
      latestCloseMinutes: 19 * 60,
    });
  });
});

describe("inferSsidSystem, inferAreaGroup, and buildFreeWifiDataset", () => {
  it("infers all 5 SSID systems and all 3 area groups", () => {
    expect(inferSsidSystem("Matsumoto_Community_Free_WiFi")).toBe("community");
    expect(inferSsidSystem("MLib-wifi")).toBe("library");
    expect(inferSsidSystem("Matsumoto_City_Free_Wi-Fi")).toBe("city");
    expect(inferSsidSystem("Matsumoto Free Wi-Fi")).toBe("city_hall");
    expect(inferSsidSystem(null)).toBe("facility_other");
    expect(inferSsidSystem("Other_SSID")).toBe("facility_other");

    expect(inferAreaGroup("中央")).toBe("central");
    expect(inferAreaGroup("安曇")).toBe("mountains");
    expect(inferAreaGroup("奈川")).toBe("mountains");
    expect(inferAreaGroup("四賀")).toBe("suburbs");
  });

  const agataFacility: RawFacilityRecord = {
    facilityNumber: "9",
    name: "あがたの森図書館",
    address: "県3-1-1",
    district: "第一",
    department: "教育部",
    section: "中央図書館",
    category: "図書館",
    phone: "0263-32-1812",
    openDaysRaw: "火;水;木;金;土;日",
    startRaw: "9:30",
    endRaw: "17:00",
    noteRaw: "12/29～1/3は休館",
    lng: 137.98,
    lat: 36.23,
  };

  it("executes all facility matching paths, supplements Agata-no-mori once, and sorts output", () => {
    const facilities: RawFacilityRecord[] = [
      agataFacility,
      {
        ...agataFacility,
        facilityNumber: "3",
        name: "松本市美術館",
        district: "中央",
        category: "文化施設",
      },
      {
        ...agataFacility,
        facilityNumber: "30",
        name: "第二地区公民館",
        district: "第二",
        category: "公民館",
      },
      {
        ...agataFacility,
        facilityNumber: "31",
        name: "第二福祉ひろば",
        district: "第二",
        category: "福祉",
      },
    ];

    const wifiRecords: RawWifiRecord[] = [
      // "1" has noFacilityJoin: true
      {
        id: "1",
        name: "観光案内",
        address: "松本市",
        ssid: "Matsumoto_City_Free_Wi-Fi",
        apCount: 1,
        lat: 36.23,
        lng: 137.96,
        category: "観光",
      },
      // "6" uses facilityNumberOverride: "3"
      {
        id: "6",
        name: "美術館Wi-Fi",
        address: "松本市中央",
        ssid: "Matsumoto_City_Free_Wi-Fi",
        apCount: 3,
        lat: 36.23,
        lng: 137.97,
        category: "文化",
      },
      // "23" has no facilityNumberOverride -> paren match prefers category=公民館 over 福祉
      {
        id: "23",
        name: "第二福祉ひろば（第二地区公民館）",
        address: "松本市",
        ssid: "Matsumoto_Community_Free_WiFi",
        apCount: 1,
        lat: 36.23,
        lng: 137.97,
        category: "公共",
      },
      // Uncurated ID -> fallback slug + check_official schedule
      {
        id: "999 Test!",
        name: "未登録スポット",
        address: "",
        ssid: null,
        apCount: 1,
        lat: 36.24,
        lng: 137.98,
        category: "公共",
      },
    ];

    const dataset = buildFreeWifiDataset({
      wifiRecords,
      facilities,
      holidays: new Map([
        ["2026-11-23", "勤労感謝の日"],
        ["2026-05-03", "憲法記念日"],
      ]),
      generatedAt: "2026-11-28",
    });

    // 4 input + 1 supplemented agata-no-mori
    expect(dataset.count).toBe(5);
    const bySourceId = new Map(dataset.spots.map((s) => [s.sourceRecordId, s]));
    expect(bySourceId.get("6")?.facilityNumber).toBe("3");
    expect(bySourceId.get("23")?.facilityNumber).toBe("30");
    expect(bySourceId.get("999 Test!")?.id).toBe("wifi-999-test");
    expect(bySourceId.get("999 Test!")?.schedule.kind).toBe("check_official");
    expect(dataset.spots.some((s) => s.id === "agata-no-mori-library")).toBe(
      true,
    );
    expect(Object.keys(dataset.holidays)).toEqual(["2026-05-03", "2026-11-23"]);

    // Does not duplicate agata-no-mori when already present in wifiRecords
    const withAgata = buildFreeWifiDataset({
      wifiRecords: [
        ...wifiRecords,
        {
          id: "888",
          name: "あがたの森図書館",
          address: "松本市県",
          ssid: "MLib-wifi",
          apCount: 1,
          lat: 36.23,
          lng: 137.98,
          category: "図書館",
        },
      ],
      facilities,
      holidays: new Map(),
      generatedAt: "2026-11-28",
    });
    expect(withAgata.count).toBe(5);
  });

  it("throws when facilityNumberOverride or agata-no-mori supplement data is invalid", () => {
    expect(() =>
      buildFreeWifiDataset({
        wifiRecords: [
          {
            id: "6",
            name: "美術館",
            address: "松本市",
            ssid: null,
            apCount: 1,
            lat: 36.23,
            lng: 137.97,
            category: "文化",
          },
        ],
        facilities: [agataFacility],
        holidays: new Map(),
        generatedAt: "2026-11-28",
      }),
    ).toThrow(/Facility override 3 not found/);

    expect(() =>
      buildFreeWifiDataset({
        wifiRecords: [],
        facilities: [],
        holidays: new Map(),
        generatedAt: "2026-11-28",
      }),
    ).toThrow(/Missing facilityNumber=9/);

    expect(() =>
      buildFreeWifiDataset({
        wifiRecords: [],
        facilities: [{ ...agataFacility, name: "別施設" }],
        holidays: new Map(),
        generatedAt: "2026-11-28",
      }),
    ).toThrow(/Unexpected facilityNumber=9 name/);

    expect(() =>
      buildFreeWifiDataset({
        wifiRecords: [],
        facilities: [{ ...agataFacility, lat: null, lng: null }],
        holidays: new Map(),
        generatedAt: "2026-11-28",
      }),
    ).toThrow(/missing coordinates/);
  });
});
