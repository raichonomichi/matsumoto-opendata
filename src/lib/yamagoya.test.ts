import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CURATED_HUTS } from "../../pipelines/yamagoya/curation";
import {
  buildYamagoyaDataset,
  extractGtfsStopSchedules,
  parseGtfsCsv,
  parseGtfsFeed,
  parseLinkDataHotelTsv,
} from "../../pipelines/yamagoya/parsers";
import { yamagoyaDatasetSchema } from "./yamagoya-schema";

describe("parseLinkDataHotelTsv", () => {
  it("parses LinkData metadata headers and facility rows", () => {
    const sample = [
      "#LINK",
      "#attribution_name\t松本市　DX推進本部",
      "#license\thttp://creativecommons.org/licenses/by/3.0/deed.ja",
      "#download_from\thttp://linkdata.org/work/rdf1s8757i",
      "#property\t施設名称\t施設郵便番号\t施設所在地\t営業者\t種別\t室数\t定員数\t許可日\t許可番号",
      "1\t肩の小屋\t390-1513\t松本市安曇前川国有林１４４\t\t簡易宿所\t27\t147\t1947-08-14\t第909-4号",
      "26\t北穂高小屋\t390-1516\t松本市安曇上高地北穂高\t株式会社北穂高小屋\t簡易宿所\t20\t63\t1969-08-19\t第22-11号",
    ].join("\n");

    const parsed = parseLinkDataHotelTsv(sample);
    expect(parsed.metadata.attributionName).toBe("松本市　DX推進本部");
    expect(parsed.metadata.licenseUrl).toBe(
      "https://creativecommons.org/licenses/by/3.0/deed.ja",
    );
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]).toMatchObject({
      id: "1",
      name: "肩の小屋",
      rooms: 27,
      capacity: 147,
      permittedAt: "1947-08-14",
      permitNumber: "第909-4号",
    });
  });
});

describe("GTFS-JP parsing & schedule extraction", () => {
  it("parses quoted CSV fields and extracts sorted departure schedules", () => {
    const csv = `col_a,col_b\n"hello, world",123\nplain,"with ""quotes"""`;
    const rows = parseGtfsCsv(csv);
    expect(rows).toEqual([
      { col_a: "hello, world", col_b: "123" },
      { col_a: "plain", col_b: 'with "quotes"' },
    ]);

    const feed = parseGtfsFeed({
      feedId: "guruttomatsumotobus2",
      feedInfoCsv:
        "feed_publisher_name,feed_start_date,feed_end_date,feed_version\n松本市,20260801,20280331,v1",
      routesCsv: "route_id,route_long_name\n23,奈川・安曇線",
      tripsCsv: [
        "route_id,service_id,trip_id,trip_headsign",
        "23,平日,t1,川浦",
        "23,平日,t2,川浦",
        "23,平日,t3,新島々",
        "23,平日,t4,終点降車専用",
      ].join("\n"),
      calendarCsv:
        "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n平日,1,1,1,1,1,0,0,20260801,20280331",
      calendarDatesCsv: [
        "service_id,date,exception_type",
        "平日,20260811,2",
        "平日,20261230,1",
      ].join("\n"),
      stopTimesCsv: [
        "trip_id,arrival_time,departure_time,stop_id,pickup_type,drop_off_type",
        "t1,13:53:00,13:53:00,227_01,0,0",
        "t2,11:01:00,11:01:00,227_01,0,0",
        "t3,06:57:00,06:57:00,227_02,0,0",
        "t4,18:38:00,18:38:00,227_01,1,0",
      ].join("\n"),
    });

    const schedules = extractGtfsStopSchedules(feed, "23", [
      "227_01",
      "227_02",
    ]);
    // Drop-off-only (pickup_type=1) trip t4 must be excluded
    expect(schedules).toHaveLength(2);
    expect(schedules.some((s) => s.headsign === "終点降車専用")).toBe(false);
    const kawaura = schedules.find((s) => s.headsign === "川浦");
    expect(kawaura).toMatchObject({
      daysLabel: "平日（月〜金）",
      serviceStartDate: "2026-08-01",
      serviceEndDate: "2028-03-31",
      addedDates: ["2026-12-30"],
      removedDates: ["2026-08-11"],
      tripCount: 2,
      firstDeparture: "11:01",
      lastDeparture: "13:53",
      departures: ["11:01", "13:53"],
    });
  });

  it("joins curated huts with registry, grading, and GTFS feeds", () => {
    const hotelData = parseLinkDataHotelTsv(
      "202\t徳本峠小屋\t390-1516\t松本市安曇上高地島々谷３２\t\t簡易宿所\t2\t24\t2010-07-29\t第37-8号",
    );
    const feed2 = parseGtfsFeed({
      feedId: "guruttomatsumotobus2",
      feedInfoCsv:
        "feed_publisher_name,feed_start_date,feed_end_date,feed_version\n松本市,20260801,20280331,v1",
      routesCsv: "route_id,route_long_name\n23,奈川・安曇線",
      tripsCsv: "route_id,service_id,trip_id,trip_headsign\n23,平日,t1,新島々",
      calendarCsv:
        "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday\n平日,1,1,1,1,1,0,0",
      stopTimesCsv:
        "trip_id,arrival_time,departure_time,stop_id\nt1,06:57:00,06:57:00,227_02",
    });

    const tokugoSpec = CURATED_HUTS.filter((h) => h.id === "tokugotoge-goya");
    const dataset = buildYamagoyaDataset({
      hotelData,
      gtfsFeeds: { guruttomatsumotobus2: feed2 },
      generatedAt: "2026-11-25",
      curationList: tokugoSpec,
    });

    expect(dataset.count).toBe(1);
    expect(dataset.huts[0].busAccess[0].kind).toBe("gtfs");
    expect(dataset.huts[0].grading[0].routeName).toContain("霞沢岳");
  });
});

describe("public/api/v1/yamagoya.json integrity", () => {
  it("conforms to yamagoyaDatasetSchema and matches curated huts without urban noise", async () => {
    const raw = await readFile(
      path.resolve("public/api/v1/yamagoya.json"),
      "utf-8",
    );
    const parsed = yamagoyaDatasetSchema.parse(JSON.parse(raw));

    expect(parsed.count).toBe(CURATED_HUTS.length);
    expect(parsed.huts).toHaveLength(CURATED_HUTS.length);

    const ids = new Set(parsed.huts.map((h) => h.id));
    expect(ids.size).toBe(CURATED_HUTS.length);

    // Covers all three target areas
    const areas = new Set(parsed.huts.map((h) => h.area));
    expect(areas.has("北アルプス")).toBe(true);
    expect(areas.has("乗鞍")).toBe(true);
    expect(areas.has("美ヶ原")).toBe(true);

    // At least one GTFS-joined hut and one external timetable hut exist
    expect(
      parsed.huts.some((h) => h.busAccess.some((b) => b.kind === "gtfs")),
    ).toBe(true);
    expect(
      parsed.huts.some((h) =>
        h.busAccess.some((b) => b.kind === "external_timetable"),
      ),
    ).toBe(true);

    // Sorted by elevation descending
    for (let i = 1; i < parsed.huts.length; i++) {
      expect(parsed.huts[i - 1].elevationM).toBeGreaterThanOrEqual(
        parsed.huts[i].elevationM,
      );
    }

    // Drop-off-only stop (大和合 -> 大和合) must not appear as a departure
    const ogatou = parsed.huts.find((h) => h.id === "ogatou-hotel");
    const yamatoai = ogatou?.busAccess.find(
      (b) => b.kind === "gtfs" && b.stopName === "大和合",
    );
    expect(yamatoai?.kind).toBe("gtfs");
    if (yamatoai?.kind === "gtfs") {
      expect(yamatoai.schedules.some((s) => s.headsign === "大和合")).toBe(
        false,
      );
      expect(
        yamatoai.schedules.some(
          (s) => s.removedDates.length > 0 || s.addedDates.length > 0,
        ),
      ).toBe(true);
    }
  });
});
