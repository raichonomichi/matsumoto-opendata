import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildLastBusDataset,
  parseRawGtfsFeed,
  parseTimeToMinutes,
} from "../../pipelines/last-bus/parsers";
import {
  describeDayPattern,
  evaluateCountdownBoard,
  findNearestStops,
  formatCountdown,
  formatMinutesToHHMM,
  getJstDateTimeParts,
  isServiceActiveOnDate,
  parseJstDateTimeInput,
} from "./last-bus-engine";
import { type LastBusService, lastBusDatasetSchema } from "./last-bus-schema";

describe("GTFS-JP parser & dataset builder", () => {
  it("parses GTFS times, excludes drop-off only stops, prioritizes stop_headsign, and separates near-terminal visits", () => {
    expect(parseTimeToMinutes("22:10:00")).toBe(22 * 60 + 10);
    expect(parseTimeToMinutes("invalid")).toBeNull();

    const feed1 = parseRawGtfsFeed({
      feedId: "guruttomatsumotobus1",
      feedInfoCsv:
        "feed_publisher_name,feed_start_date,feed_end_date,feed_version\n松本市,20260801,20280331,test-v1",
      routesCsv:
        "route_id,route_long_name,route_color,route_text_color\n10,信大横田循環線,FF9900,FFFFFF",
      stopsCsv: [
        "stop_id,stop_name,stop_lat,stop_lon,platform_code",
        "100_03,松本バスターミナル,36.23024,137.96676,3",
        "119_03,松本駅お城口,36.23071,137.96537,23",
        "120_01,バスターミナル北,36.23118,137.96669,",
        "200_01,信州大学前,36.24850,137.97720,",
      ].join("\n"),
      tripsCsv: [
        "route_id,service_id,trip_id,trip_headsign",
        "10,平日,t1,松本バスターミナル",
        "10,平日,t2,松本バスターミナル",
      ].join("\n"),
      calendarCsv:
        "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n平日,1,1,1,1,1,0,0,20260801,20280331",
      calendarDatesCsv: "service_id,date,exception_type\n平日,20261123,2",
      stopTimesCsv: [
        "trip_id,arrival_time,departure_time,stop_id,stop_sequence,stop_headsign,pickup_type",
        "t1,06:00:00,06:00:00,119_03,1,信州大学経由松本バスターミナル,0",
        "t1,06:02:00,06:02:00,120_01,2,信州大学経由松本バスターミナル,0",
        "t1,06:15:00,06:15:00,200_01,3,松本バスターミナル,0",
        "t1,06:28:00,06:28:00,120_01,4,松本バスターミナル,0",
        "t1,06:30:00,06:30:00,100_03,5,松本バスターミナル,1",
        "t2,22:10:00,22:10:00,119_03,1,信州大学経由松本バスターミナル,0",
        "t2,22:12:00,22:12:00,120_01,2,信州大学経由松本バスターミナル,0",
        "t2,22:25:00,22:25:00,200_01,3,松本バスターミナル,0",
        "t2,22:38:00,22:38:00,120_01,4,松本バスターミナル,1",
        "t2,22:40:00,22:40:00,100_03,5,松本バスターミナル,1",
      ].join("\n"),
    });

    const feed2 = parseRawGtfsFeed({
      feedId: "guruttomatsumotobus2",
      feedInfoCsv:
        "feed_publisher_name,feed_start_date,feed_end_date,feed_version\n松本市,20260801,20280331,test-v1",
      routesCsv:
        "route_id,route_long_name,route_color,route_text_color\n11,タウンスニーカー東コース,33CC33,FFFFFF",
      stopsCsv: [
        "stop_id,stop_name,stop_lat,stop_lon,platform_code",
        "10_01,松本駅アルプス口,36.23045,137.96356,31",
        "22_02,松本駅お城口,36.23080,137.96511,22",
        "23_01,バスターミナル北,36.23102,137.96669,",
        "360_01,南松本駅,36.20981,137.96860,",
        "400_01,松本城・市役所前,36.23740,137.96980,",
        "401_01,信大病院玄関前,36.25120,137.98100,",
        "402_01,浅間温泉,36.26210,137.98990,",
        "403_01,美ヶ原温泉,36.24500,137.99700,",
        "404_01,信州まつもと空港,36.16670,137.92270,",
        "405_01,村井駅,36.17630,137.95880,",
        "406_01,波田駅,36.19730,137.86170,",
        "407_01,アイシティ２１,36.17690,137.90120,",
        "408_01,四賀支所,36.32700,137.99120,",
        "409_01,新島々,36.19200,137.82350,",
      ].join("\n"),
      tripsCsv:
        "route_id,service_id,trip_id,trip_headsign\n11,全日,ts1,松本駅お城口",
      calendarCsv:
        "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n全日,1,1,1,1,1,1,1,20260801,20280331",
      stopTimesCsv: [
        "trip_id,arrival_time,departure_time,stop_id,stop_sequence,stop_headsign,pickup_type",
        "ts1,10:00:00,10:00:00,22_02,1,イオンモール経由松本駅,0",
        "ts1,10:02:00,10:02:00,23_01,2,イオンモール経由松本駅,0",
        "ts1,10:05:00,10:05:00,10_01,3,松本駅,0",
        "ts1,10:08:00,10:08:00,360_01,4,松本駅,0",
        "ts1,10:10:00,10:10:00,400_01,5,松本駅,0",
        "ts1,10:12:00,10:12:00,401_01,6,松本駅,0",
        "ts1,10:14:00,10:14:00,402_01,7,松本駅,0",
        "ts1,10:16:00,10:16:00,403_01,8,松本駅,0",
        "ts1,10:18:00,10:18:00,404_01,9,松本駅,0",
        "ts1,10:20:00,10:20:00,405_01,10,松本駅,0",
        "ts1,10:22:00,10:22:00,406_01,11,松本駅,0",
        "ts1,10:24:00,10:24:00,407_01,12,松本駅,0",
        "ts1,10:26:00,10:26:00,408_01,13,松本駅,0",
        "ts1,10:28:00,10:28:00,409_01,14,松本駅,0",
        "ts1,10:30:00,10:30:00,22_02,15,松本駅お城口,1",
      ].join("\n"),
    });

    const ds = buildLastBusDataset({
      feeds: [feed1, feed2],
      generatedAt: "2026-11-28",
    });

    expect(ds.stats.routeCount).toBe(2);
    // Stop headsign is prioritized over trip_headsign
    expect(ds.headsigns).toContain("信州大学経由松本バスターミナル");
    // Drop-off only terminal stop 100_03 (松本バスターミナル) is never boardable
    expect(ds.stops.some((s) => s.name === "松本バスターミナル")).toBe(false);

    // At 2026-11-27 21:50 JST, only origin departure 22:10 from 松本駅お城口 should appear
    const board = evaluateCountdownBoard(
      ds,
      { kind: "preset", presetId: "matsumoto-station-area" },
      new Date("2026-11-27T21:50:00+09:00"),
    );
    const shindai = board.items.find((i) => i.routeName === "信大横田循環線");
    expect(shindai).toBeDefined();
    expect(shindai?.headsign).toBe("信州大学経由松本バスターミナル");
    expect(shindai?.lastDepartureMinutes).toBe(22 * 60 + 10);
    expect(shindai?.remainingSeconds).toBe(20 * 60);
    expect(shindai?.status).toBe("imminent");
  });
});

describe("GTFS calendar & countdown engine", () => {
  const sampleService: LastBusService = {
    key: "guruttomatsumotobus1:平日",
    feedId: "guruttomatsumotobus1",
    serviceId: "平日",
    daysLabel: "平日（月〜金）",
    weekdayMask: 31, // Mon..Fri
    startDate: "2026-08-01",
    endDate: "2028-03-31",
    addedDates: ["2026-12-26"], // Saturday special run
    removedDates: ["2026-11-23", "2026-08-13"], // Holiday & Obon excluded
  };

  it("evaluates regular weekdays, weekends, exceptions, and valid date ranges", () => {
    // 2026-11-27 Fri -> active
    expect(isServiceActiveOnDate(sampleService, "2026-11-27", 5)).toBe(true);
    // 2026-11-28 Sat -> inactive
    expect(isServiceActiveOnDate(sampleService, "2026-11-28", 6)).toBe(false);
    // 2026-11-23 Mon (removed holiday) -> inactive
    expect(isServiceActiveOnDate(sampleService, "2026-11-23", 1)).toBe(false);
    // 2026-12-26 Sat (added date) -> active
    expect(isServiceActiveOnDate(sampleService, "2026-12-26", 6)).toBe(true);
    // Out of feed validity
    expect(isServiceActiveOnDate(sampleService, "2026-07-31", 5)).toBe(false);
    expect(isServiceActiveOnDate(sampleService, "2028-04-03", 1)).toBe(false);
  });

  it("handles JST date conversion and formatting helpers accurately", () => {
    const jst = getJstDateTimeParts(new Date("2026-11-27T15:05:09Z"));
    expect(jst.ymd).toBe("2026-11-28");
    expect(jst.weekday).toBe(6);
    expect(jst.hour).toBe(0);
    expect(jst.minute).toBe(5);
    expect(jst.second).toBe(9);

    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(1800)).toBe("00:30:00");
    expect(formatCountdown(3661)).toBe("01:01:01");
    expect(formatMinutesToHHMM(22 * 60 + 5)).toBe("22:05");

    expect(parseJstDateTimeInput("2026-02-30", "19:30")).toBeNull();
    expect(parseJstDateTimeInput("2026-11-28", "19:30")?.toISOString()).toBe(
      "2026-11-28T10:30:00.000Z",
    );
  });
});

describe("generated last-bus.json dataset integrity & engine scenarios", () => {
  it("validates schema, route/stop coverage, coordinates, and colors", async () => {
    const raw = await readFile(path.resolve("src/data/last-bus.json"), "utf-8");
    const ds = lastBusDatasetSchema.parse(JSON.parse(raw));

    expect(ds.stats.routeCount).toBe(34);
    expect(ds.routes).toHaveLength(34);
    expect(ds.stats.stopCount).toBe(674);
    expect(ds.stops).toHaveLength(674);
    expect(ds.stats.stationOriginRouteCount).toBe(26);

    for (const stop of ds.stops) {
      expect(stop.lat).toBeGreaterThanOrEqual(35.9);
      expect(stop.lat).toBeLessThanOrEqual(36.6);
      expect(stop.lng).toBeGreaterThanOrEqual(137.5);
      expect(stop.lng).toBeLessThanOrEqual(138.3);
    }

    // Matsumoto Station area preset covers all 26 station-origin routes cleanly
    const stationBoard = evaluateCountdownBoard(
      ds,
      { kind: "preset", presetId: "matsumoto-station-area" },
      new Date("2026-11-27T21:40:00+09:00"),
    );
    expect(stationBoard.dayPatternLabel).toBe("平日ダイヤ");
    expect(new Set(stationBoard.items.map((i) => i.routeKey)).size).toBe(26);

    // At 21:40 JST on Friday, 信大横田循環線 (22:10) is 30m00s away -> imminent
    const shindaiLoop = stationBoard.items.find(
      (i) => i.routeName === "信大横田循環線",
    );
    expect(shindaiLoop?.status).toBe("imminent");
    expect(shindaiLoop?.remainingSeconds).toBe(1800);
    expect(shindaiLoop?.lastDepartureMinutes).toBe(22 * 60 + 10);

    // At 21:39:59 JST, 1801s -> soon; at 21:09:59 -> 3601s -> running; at 22:10:00 -> ended
    const atSoon = evaluateCountdownBoard(
      ds,
      { kind: "preset", presetId: "matsumoto-station-area" },
      new Date("2026-11-27T21:39:59+09:00"),
    ).items.find((i) => i.routeName === "信大横田循環線");
    expect(atSoon?.status).toBe("soon");
    expect(atSoon?.remainingSeconds).toBe(1801);

    const atRunning = evaluateCountdownBoard(
      ds,
      { kind: "preset", presetId: "matsumoto-station-area" },
      new Date("2026-11-27T21:09:59+09:00"),
    ).items.find((i) => i.routeName === "信大横田循環線");
    expect(atRunning?.status).toBe("running");

    const atEnded = evaluateCountdownBoard(
      ds,
      { kind: "preset", presetId: "matsumoto-station-area" },
      new Date("2026-11-27T22:10:00+09:00"),
    ).items.find((i) => i.routeName === "信大横田循環線");
    expect(atEnded?.status).toBe("ended");
    expect(atEnded?.nextOperating?.ymd).toBe("2026-11-28"); // Saturday runs

    // Remaining trips = 1 check on 寿台線 (小池四ツ角 has 1 trip at 21:10)
    const kotobukidai = evaluateCountdownBoard(
      ds,
      { kind: "preset", presetId: "matsumoto-station-area" },
      new Date("2026-11-27T20:30:00+09:00"),
    ).items.find(
      (i) => i.routeName === "寿台線" && i.headsign === "小池四ツ角",
    );
    expect(kotobukidai?.remainingTrips).toBe(1);
    expect(kotobukidai?.nextDepartureMinutes).toBe(
      kotobukidai?.lastDepartureMinutes,
    );

    // Holiday & Obon calendar pattern detection
    expect(describeDayPattern(ds, "2026-11-23", 1)).toBe(
      "祝日・お盆特例（土休日ダイヤ）",
    );
    expect(describeDayPattern(ds, "2026-08-13", 4)).toBe(
      "祝日・お盆特例（土休日ダイヤ）",
    );
    expect(describeDayPattern(ds, "2028-04-01", 6)).toBe("ダイヤ有効期間外");

    // Multi-service merge on 入山辺線 @ バスターミナル北 (Monday runs both 平日 and 月・水・木)
    const btNorthIdx = ds.stops.findIndex((s) => s.name === "バスターミナル北");
    expect(btNorthIdx).toBeGreaterThanOrEqual(0);
    const monIriyamabe = evaluateCountdownBoard(
      ds,
      { kind: "stop", stopIndex: btNorthIdx },
      new Date("2026-11-30T08:00:00+09:00"),
    ).items.filter((i) => i.routeName === "入山辺線");
    expect(
      monIriyamabe.find((i) => i.headsign === "牛立")?.todayDepartures.length,
    ).toBeGreaterThan(0);
    expect(
      monIriyamabe.find((i) => i.headsign === "大和合")?.todayDepartures.length,
    ).toBeGreaterThan(0);
    expect(monIriyamabe.find((i) => i.headsign === "大仏公民館")?.status).toBe(
      "suspended",
    );

    // All routes view covers all 34 routes including non-station-origin routes
    const allRoutesBoard = evaluateCountdownBoard(
      ds,
      { kind: "all_routes" },
      new Date("2026-11-27T18:00:00+09:00"),
    );
    expect(new Set(allRoutesBoard.items.map((i) => i.routeKey)).size).toBe(34);

    // Next operating date lookup skips holiday Monday (2026-11-23 勤労感謝の日) for weekday-only route
    const sunBeforeHoliday = evaluateCountdownBoard(
      ds,
      { kind: "preset", presetId: "matsumoto-station-area" },
      new Date("2026-11-22T12:00:00+09:00"),
    ).items.find((i) => i.routeName === "鹿教湯温泉線");
    expect(sunBeforeHoliday?.status).toBe("suspended");
    expect(sunBeforeHoliday?.nextOperating?.ymd).toBe("2026-11-24");

    // Haversine nearest stop lookup from Matsumoto Station Oshiroguchi
    const nearest = findNearestStops(ds.stops, 36.2308, 137.9651, 5);
    expect(nearest[0].stop.name).toBe("松本駅お城口");
    expect(nearest[0].distanceKm).toBeLessThan(0.1);
  });
});
