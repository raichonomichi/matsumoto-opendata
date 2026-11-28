import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extractZipTextEntries } from "../build-yamagoya";
import { CURATED_HUTS } from "./curation";
import {
  buildYamagoyaDataset,
  extractGtfsStopSchedules,
  parseGtfsCsv,
  parseGtfsFeed,
  parseLinkDataHotelTsv,
} from "./parsers";

interface ZipInputEntry {
  name: string;
  content: string;
  method?: number;
}

function buildTestZip(entries: ZipInputEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const cdParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const method = entry.method ?? 0;
    const nameBuf = Buffer.from(entry.name, "utf-8");
    const rawBuf = Buffer.from(entry.content, "utf-8");
    const dataBuf = method === 8 ? deflateRawSync(rawBuf) : rawBuf;

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt32LE(dataBuf.length, 18);
    lfh.writeUInt32LE(rawBuf.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);

    localParts.push(lfh, nameBuf, dataBuf);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt32LE(dataBuf.length, 20);
    cdh.writeUInt32LE(rawBuf.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt32LE(offset, 42);

    cdParts.push(cdh, nameBuf);
    offset += lfh.length + nameBuf.length + dataBuf.length;
  }

  const cdBuf = Buffer.concat(cdParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, cdBuf, eocd]);
}

describe("extractZipTextEntries", () => {
  it("extracts stored and deflated UTF-8 entries, skips directories, and uses basename", () => {
    const zip = buildTestZip([
      { name: "gtfs/", content: "", method: 0 },
      {
        name: "gtfs/routes.txt",
        content: "route_id,route_long_name\n1,松本線",
        method: 0,
      },
      {
        name: "nested/trips.txt",
        content: "trip_id,route_id\nt1,1",
        method: 8,
      },
    ]);

    const entries = extractZipTextEntries(zip);
    expect(entries.size).toBe(2);
    expect(entries.get("routes.txt")).toBe(
      "route_id,route_long_name\n1,松本線",
    );
    expect(entries.get("trips.txt")).toBe("trip_id,route_id\nt1,1");
    expect(entries.has(path.basename("gtfs/"))).toBe(false);
  });

  it("throws on missing EOCD, invalid central directory, and unsupported compression method", () => {
    expect(() => extractZipTextEntries(Buffer.from("not a zip"))).toThrow(
      /EOCD signature not found/,
    );

    const valid = buildTestZip([
      { name: "a.txt", content: "hello", method: 0 },
    ]);
    const corruptedCd = Buffer.from(valid);
    // Corrupt CD signature right after the 30-byte LFH + 5-byte name + 5-byte data = offset 40
    corruptedCd.writeUInt32LE(0x12345678, 40);
    expect(() => extractZipTextEntries(corruptedCd)).toThrow(
      /central directory header mismatch/,
    );

    const unsupported = buildTestZip([
      { name: "a.txt", content: "hello", method: 99 },
    ]);
    expect(() => extractZipTextEntries(unsupported)).toThrow(
      /Unsupported ZIP compression method 99/,
    );
  });
});

describe("parseLinkDataHotelTsv edge cases", () => {
  it("handles BOM/CRLF, skips short lines, normalizes YYYYMMDD dates and invalid numbers", () => {
    const tsv = [
      "\uFEFF#LINK",
      "#license\thttp://creativecommons.org/licenses/by/3.0/deed.ja",
      "short\tline",
      "10\tテスト山荘\t390-1516\t松本市安曇\t\t簡易宿所\tabc\t\t20240501\t第1号",
      "11\t別館\t390-1516\t松本市安曇\t運営会社\t旅館\t5\t20\tinvalid-date\t第2号",
    ].join("\r\n");

    const parsed = parseLinkDataHotelTsv(tsv);
    expect(parsed.metadata.attributionName).toBe("松本市");
    expect(parsed.metadata.licenseUrl).toBe(
      "https://creativecommons.org/licenses/by/3.0/deed.ja",
    );
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]).toMatchObject({
      rooms: null,
      capacity: null,
      permittedAt: "2024-05-01",
    });
    expect(parsed.records[1]).toMatchObject({
      rooms: 5,
      capacity: 20,
      permittedAt: null,
    });
  });
});

describe("GTFS parsers & schedule formatting", () => {
  it("returns [] for empty or header-only CSV and skips blank lines", () => {
    expect(parseGtfsCsv("")).toEqual([]);
    expect(parseGtfsCsv("a,b\n   \n")).toEqual([]);
    expect(parseGtfsCsv("\uFEFFa,b\r\n1,2\r\n\r\n3,4\r\n")).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("handles route fallbacks, all daysLabel patterns, arrival_time fallback, and exception sorting", () => {
    const feed = parseGtfsFeed({
      feedId: "bus1",
      feedInfoCsv: "feed_version\nv2",
      routesCsv: [
        "route_id,route_short_name,route_long_name",
        "r1,,ロング路線",
        "r2,ショート,",
        "r3,,",
      ].join("\n"),
      tripsCsv: [
        "route_id,service_id,trip_id,trip_headsign",
        "r1,ALL,t_all,",
        "r1,WKND,t_wknd,土日行",
        "r1,SPEC,t_spec,特定日行",
        "r1,PART,t_part,火木行",
        "r1,MISSING_CAL,t_miss,未定義行",
      ].join("\n"),
      calendarCsv: [
        "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
        "ALL,1,1,1,1,1,1,1,20260101,20261231",
        "WKND,0,0,0,0,0,1,1,20260101,20261231",
        "SPEC,0,0,0,0,0,0,0,20260101,20261231",
        "PART,0,1,0,1,0,0,0,20260101,20261231",
      ].join("\n"),
      calendarDatesCsv: [
        "service_id,date,exception_type",
        "ALL,20260815,1",
        "ALL,20260810,1",
        "ALL,20260810,1",
        "ALL,20260812,2",
        "ALL,bad-date,1",
        "ALL,20260813,9",
      ].join("\n"),
      stopTimesCsv: [
        "trip_id,arrival_time,departure_time,stop_id,pickup_type",
        "t_all,09:15:00,,s1,0",
        "t_all,10:00:00,bad,s1,0",
        "t_wknd,08:00:00,08:00:00,s1,0",
        "t_spec,11:00:00,11:00:00,s1,0",
        "t_part,12:00:00,12:00:00,s1,0",
        "t_miss,13:00:00,13:00:00,s1,0",
      ].join("\n"),
    });

    expect(feed.validFrom).toBe("2026-01-01");
    expect(feed.validUntil).toBe("2026-12-31");
    expect(feed.routesById.get("r1")).toBe("ロング路線");
    expect(feed.routesById.get("r2")).toBe("ショート");
    expect(feed.routesById.get("r3")).toBe("r3");

    const schedules = extractGtfsStopSchedules(feed, "r1", ["s1"]);
    const byService = new Map(schedules.map((s) => [s.serviceId, s]));
    expect(byService.get("ALL")).toMatchObject({
      daysLabel: "毎日",
      headsign: "方面指定なし",
      departures: ["09:15"],
      addedDates: ["2026-08-10", "2026-08-15"],
      removedDates: ["2026-08-12"],
    });
    expect(byService.get("WKND")?.daysLabel).toBe("土日");
    expect(byService.get("SPEC")?.daysLabel).toBe("特定日");
    expect(byService.get("PART")?.daysLabel).toBe("火・木");
    expect(byService.get("MISSING_CAL")?.daysLabel).toBe("運行日指定");
  });
});

describe("buildYamagoyaDataset matching, sorting, and error guards", () => {
  const tokugoSpec = CURATED_HUTS.filter((h) => h.id === "tokugotoge-goya");
  const kitahotakaSpec = CURATED_HUTS.filter((h) => h.id === "kitahotaka-goya");

  const validFeed2 = parseGtfsFeed({
    feedId: "guruttomatsumotobus2",
    feedInfoCsv: "feed_version\nv1",
    routesCsv: "route_id,route_long_name\n23,奈川・安曇線",
    tripsCsv: "route_id,service_id,trip_id,trip_headsign\n23,平日,t1,新島々",
    calendarCsv:
      "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday\n平日,1,1,1,1,1,0,0",
    stopTimesCsv:
      "trip_id,arrival_time,departure_time,stop_id\nt1,06:57:00,06:57:00,227_02",
  });

  it("falls back to normalized name match when sourceRecordId differs and sorts huts/feeds", () => {
    const hotelData = parseLinkDataHotelTsv(
      [
        "999\t徳　本　峠　小　屋\t\t松本市安曇\t\t\t\t\t\t第999号",
        "26\t北穂高小屋\t390-1516\t松本市安曇上高地\t\t簡易宿所\t20\t63\t1969-08-19\t第22-11号",
      ].join("\n"),
    );
    if (hotelData.records[0]) {
      hotelData.records[0].permitNumber = "";
    }

    const feed1 = parseGtfsFeed({
      feedId: "guruttomatsumotobus1",
      feedInfoCsv: "feed_version\nv1",
      routesCsv: "route_id,route_long_name\n14,美ヶ原",
      tripsCsv: "",
      calendarCsv: "",
      stopTimesCsv: "",
    });

    const dataset = buildYamagoyaDataset({
      hotelData,
      gtfsFeeds: {
        guruttomatsumotobus2: validFeed2,
        guruttomatsumotobus1: feed1,
      },
      generatedAt: "2026-11-28",
      curationList: [...tokugoSpec, ...kitahotakaSpec],
    });

    // Elevation descending (3100 > 2135)
    expect(dataset.huts.map((h) => h.id)).toEqual([
      "kitahotaka-goya",
      "tokugotoge-goya",
    ]);
    // Feed metadata sorted ascending by feedId
    expect(dataset.sources.gtfs.feeds.map((f) => f.feedId)).toEqual([
      "guruttomatsumotobus1",
      "guruttomatsumotobus2",
    ]);
    // Empty permit fields fall back cleanly
    expect(dataset.huts[1]?.permit).toMatchObject({
      category: "不明",
      permitNumber: "記載なし",
      operator: null,
      postalCode: null,
    });
  });

  it("throws descriptive errors for missing hut, unknown grading route, missing feed, or empty schedules", () => {
    const emptyHotel = parseLinkDataHotelTsv("");
    expect(() =>
      buildYamagoyaDataset({
        hotelData: emptyHotel,
        gtfsFeeds: { guruttomatsumotobus2: validFeed2 },
        generatedAt: "2026-11-28",
        curationList: tokugoSpec,
      }),
    ).toThrow(/Curated hut not found/);

    const tokugoHotel = parseLinkDataHotelTsv(
      "202\t徳本峠小屋\t390-1516\t松本市安曇\t\t簡易宿所\t2\t24\t2010-07-29\t第37-8号",
    );

    expect(() =>
      buildYamagoyaDataset({
        hotelData: tokugoHotel,
        gtfsFeeds: { guruttomatsumotobus2: validFeed2 },
        generatedAt: "2026-11-28",
        curationList: [{ ...tokugoSpec[0], gradingRouteNumbers: [9999] }],
      }),
    ).toThrow(/Unknown Nagano grading route number/);

    expect(() =>
      buildYamagoyaDataset({
        hotelData: tokugoHotel,
        gtfsFeeds: {},
        generatedAt: "2026-11-28",
        curationList: tokugoSpec,
      }),
    ).toThrow(/Missing GTFS feed/);

    const emptyStopFeed = parseGtfsFeed({
      feedId: "guruttomatsumotobus2",
      feedInfoCsv: "feed_version\nv1",
      routesCsv: "route_id,route_long_name\n23,奈川・安曇線",
      tripsCsv: "",
      calendarCsv: "",
      stopTimesCsv: "",
    });
    expect(() =>
      buildYamagoyaDataset({
        hotelData: tokugoHotel,
        gtfsFeeds: { guruttomatsumotobus2: emptyStopFeed },
        generatedAt: "2026-11-28",
        curationList: tokugoSpec,
      }),
    ).toThrow(/No GTFS schedules found/);
  });
});
