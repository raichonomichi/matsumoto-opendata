import {
  FLAG_IS_NEAR_TERMINAL,
  FLAG_IS_ORIGIN,
} from "../../src/lib/last-bus-engine";
import {
  type GtfsFeedId,
  type LastBusDataset,
  type LastBusPreset,
  type LastBusRoute,
  type LastBusService,
  type LastBusStop,
  lastBusDatasetSchema,
  type ScheduleTuple,
} from "../../src/lib/last-bus-schema";
import { parseCsvRows } from "../csv";
import {
  FEED_FULL_NAMES,
  FEED_LABELS,
  MATSUMOTO_STATION_STOP_NAMES,
  OFFICIAL_BUS_LINKS,
  PRESET_SPECS,
} from "./curation";

export interface RawGtfsFeedFiles {
  feedId: GtfsFeedId;
  feedInfoCsv: string;
  routesCsv: string;
  stopsCsv: string;
  tripsCsv: string;
  calendarCsv: string;
  calendarDatesCsv?: string;
  stopTimesCsv: string;
}

export interface ParsedGtfsStop {
  stopId: string;
  stopName: string;
  lat: number;
  lng: number;
  platformCode: string;
}

export interface ParsedGtfsRoute {
  routeId: string;
  name: string;
  color: string;
  textColor: string;
}

export interface ParsedGtfsTrip {
  tripId: string;
  routeId: string;
  serviceId: string;
  headsign: string;
}

export interface ParsedGtfsStopTime {
  tripId: string;
  stopId: string;
  stopSequence: number;
  departureMinutes: number;
  stopHeadsign: string;
  pickupType: string;
}

export interface ParsedGtfsCalendar {
  serviceId: string;
  daysLabel: string;
  weekdayMask: number;
  startDate: string;
  endDate: string;
  addedDates: string[];
  removedDates: string[];
}

export interface ParsedRawGtfsFeed {
  feedId: GtfsFeedId;
  feedName: string;
  version: string;
  validFrom: string;
  validUntil: string;
  calendarDatesUntil: string | null;
  routes: ParsedGtfsRoute[];
  stopsById: Map<string, ParsedGtfsStop>;
  trips: ParsedGtfsTrip[];
  calendarsById: Map<string, ParsedGtfsCalendar>;
  stopTimes: ParsedGtfsStopTime[];
}

const STATION_STOP_SET = new Set<string>(MATSUMOTO_STATION_STOP_NAMES);

function normalizeDate(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  return null;
}

function normalizeHexColor(
  value: string | undefined,
  fallback: string,
): string {
  const clean = (value ?? "").trim().replace(/^#/, "");
  return /^[0-9A-Fa-f]{6}$/.test(clean) ? clean.toUpperCase() : fallback;
}

/**
 * GTFS 時刻文字列 (HH:MM:SS / HH:MM) を 0:00 からの経過分数へ変換する。
 */
export function parseTimeToMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!m) return null;
  const hh = Number.parseInt(m[1], 10);
  const mm = Number.parseInt(m[2], 10);
  if (Number.isNaN(hh) || Number.isNaN(mm) || mm < 0 || mm > 59 || hh > 30) {
    return null;
  }
  return hh * 60 + mm;
}

function computeWeekdayMask(row: Record<string, string>): number {
  const cols = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ] as const;
  let mask = 0;
  for (let i = 0; i < cols.length; i++) {
    if (row[cols[i]] === "1") {
      mask |= 1 << i;
    }
  }
  return mask;
}

function formatDaysLabel(mask: number, hasAddedDates: boolean): string {
  if (mask === 127) return "毎日";
  if (mask === 31) return "平日（月〜金）";
  if (mask === 96) return hasAddedDates ? "土休日" : "土日";
  if (mask === 63) return "月〜土";
  if (mask === 0) return "特定日";
  const labels = ["月", "火", "水", "木", "金", "土", "日"];
  const active: string[] = [];
  for (let i = 0; i < labels.length; i++) {
    if ((mask & (1 << i)) !== 0) {
      active.push(labels[i]);
    }
  }
  return active.join("・");
}

function compareRouteId(a: string, b: string): number {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) {
    return na - nb;
  }
  return a.localeCompare(b, "ja");
}

/**
 * 生 GTFS-JP CSV ファイル群を構造化オブジェクトへパースする。
 */
export function parseRawGtfsFeed(files: RawGtfsFeedFiles): ParsedRawGtfsFeed {
  const feedInfo = parseCsvRows(files.feedInfoCsv)[0] ?? {};
  const routeRows = parseCsvRows(files.routesCsv);
  const stopRows = parseCsvRows(files.stopsCsv);
  const tripRows = parseCsvRows(files.tripsCsv);
  const calendarRows = parseCsvRows(files.calendarCsv);
  const calendarDateRows = files.calendarDatesCsv
    ? parseCsvRows(files.calendarDatesCsv)
    : [];
  const stopTimeRows = parseCsvRows(files.stopTimesCsv);

  const routes: ParsedGtfsRoute[] = routeRows.map((r) => ({
    routeId: r.route_id,
    name: r.route_long_name || r.route_short_name || r.route_id,
    color: normalizeHexColor(r.route_color, "244666"),
    textColor: normalizeHexColor(r.route_text_color, "FFFFFF"),
  }));

  const stopsById = new Map<string, ParsedGtfsStop>();
  for (const s of stopRows) {
    const lat = Number.parseFloat(s.stop_lat ?? "");
    const lng = Number.parseFloat(s.stop_lon ?? "");
    if (
      !s.stop_id ||
      !s.stop_name ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      continue;
    }
    stopsById.set(s.stop_id, {
      stopId: s.stop_id,
      stopName: s.stop_name,
      lat,
      lng,
      platformCode: (s.platform_code ?? "").trim(),
    });
  }

  const trips: ParsedGtfsTrip[] = tripRows
    .filter((t) => t.trip_id && t.route_id && t.service_id)
    .map((t) => ({
      tripId: t.trip_id,
      routeId: t.route_id,
      serviceId: t.service_id,
      headsign: (t.trip_headsign ?? "").trim() || "方面指定なし",
    }));

  const exceptionsByService = new Map<
    string,
    { added: Set<string>; removed: Set<string> }
  >();
  let calendarDatesUntil: string | null = null;

  for (const cd of calendarDateRows) {
    const serviceId = cd.service_id;
    const date = normalizeDate(cd.date);
    if (!serviceId || !date) continue;
    if (!calendarDatesUntil || date > calendarDatesUntil) {
      calendarDatesUntil = date;
    }
    let bucket = exceptionsByService.get(serviceId);
    if (!bucket) {
      bucket = { added: new Set<string>(), removed: new Set<string>() };
      exceptionsByService.set(serviceId, bucket);
    }
    if (cd.exception_type === "1") {
      bucket.added.add(date);
    } else if (cd.exception_type === "2") {
      bucket.removed.add(date);
    }
  }

  const validFrom = normalizeDate(feedInfo.feed_start_date) ?? "2026-08-01";
  const validUntil = normalizeDate(feedInfo.feed_end_date) ?? "2028-03-31";

  const calendarsById = new Map<string, ParsedGtfsCalendar>();
  for (const c of calendarRows) {
    if (!c.service_id) continue;
    const mask = computeWeekdayMask(c);
    const ex = exceptionsByService.get(c.service_id);
    const addedDates = ex ? [...ex.added].sort() : [];
    const removedDates = ex ? [...ex.removed].sort() : [];
    calendarsById.set(c.service_id, {
      serviceId: c.service_id,
      daysLabel: formatDaysLabel(mask, addedDates.length > 0),
      weekdayMask: mask,
      startDate: normalizeDate(c.start_date) ?? validFrom,
      endDate: normalizeDate(c.end_date) ?? validUntil,
      addedDates,
      removedDates,
    });
  }

  const stopTimes: ParsedGtfsStopTime[] = [];
  for (const st of stopTimeRows) {
    const minutes = parseTimeToMinutes(st.departure_time || st.arrival_time);
    const seq = Number.parseInt(st.stop_sequence ?? "", 10);
    if (!st.trip_id || !st.stop_id || minutes === null || Number.isNaN(seq)) {
      continue;
    }
    stopTimes.push({
      tripId: st.trip_id,
      stopId: st.stop_id,
      stopSequence: seq,
      departureMinutes: minutes,
      stopHeadsign: (st.stop_headsign ?? "").trim(),
      pickupType: (st.pickup_type ?? "0").trim(),
    });
  }

  return {
    feedId: files.feedId,
    feedName: FEED_FULL_NAMES[files.feedId],
    version: feedInfo.feed_version || "unknown",
    validFrom,
    validUntil,
    calendarDatesUntil,
    routes,
    stopsById,
    trips,
    calendarsById,
    stopTimes,
  };
}

/**
 * 2つの GTFS-JP フィードを統合・正規化し、Zod 検証済みデータセットを構築する。
 */
export function buildLastBusDataset(params: {
  feeds: ParsedRawGtfsFeed[];
  generatedAt: string;
}): LastBusDataset {
  const { feeds, generatedAt } = params;

  interface StopAccum {
    name: string;
    latSum: number;
    lngSum: number;
    coordCount: number;
    seenCoordKeys: Set<string>;
    routeKeys: Set<string>;
  }

  interface BoardableEvent {
    feedId: GtfsFeedId;
    routeKey: string;
    serviceKey: string;
    stopName: string;
    platformCode: string;
    headsign: string;
    departureMinutes: number;
    isOrigin: boolean;
    isNearTerminal: boolean;
  }

  const stopAccumMap = new Map<string, StopAccum>();
  const rawRouteMap = new Map<
    string,
    {
      feedId: GtfsFeedId;
      route: ParsedGtfsRoute;
      circularTripCount: number;
      totalTripCount: number;
      originCounts: Map<string, number>;
      stopPaths: string[][];
    }
  >();
  const rawServiceMap = new Map<
    string,
    { feedId: GtfsFeedId; calendar: ParsedGtfsCalendar }
  >();
  const events: BoardableEvent[] = [];

  let totalTrips = 0;
  let totalStopTimes = 0;

  for (const feed of feeds) {
    totalTrips += feed.trips.length;
    totalStopTimes += feed.stopTimes.length;

    const tripById = new Map(feed.trips.map((t) => [t.tripId, t]));
    const stopTimesByTrip = new Map<string, ParsedGtfsStopTime[]>();
    for (const st of feed.stopTimes) {
      let arr = stopTimesByTrip.get(st.tripId);
      if (!arr) {
        arr = [];
        stopTimesByTrip.set(st.tripId, arr);
      }
      arr.push(st);
    }

    for (const r of feed.routes) {
      const routeKey = `${feed.feedId}:${r.routeId}`;
      rawRouteMap.set(routeKey, {
        feedId: feed.feedId,
        route: r,
        circularTripCount: 0,
        totalTripCount: 0,
        originCounts: new Map(),
        stopPaths: [],
      });
    }

    for (const [serviceId, cal] of feed.calendarsById) {
      rawServiceMap.set(`${feed.feedId}:${serviceId}`, {
        feedId: feed.feedId,
        calendar: cal,
      });
    }

    for (const [tripId, sts] of stopTimesByTrip) {
      sts.sort((a, b) => a.stopSequence - b.stopSequence);
      const trip = tripById.get(tripId);
      if (!trip) continue;
      const routeInfo = rawRouteMap.get(`${feed.feedId}:${trip.routeId}`);
      if (!routeInfo) continue;

      const firstStop = feed.stopsById.get(sts[0].stopId);
      const lastStop = feed.stopsById.get(sts[sts.length - 1].stopId);
      if (firstStop && lastStop) {
        routeInfo.totalTripCount++;
        const sameTerminal = firstStop.stopName === lastStop.stopName;
        const bothStationArea =
          STATION_STOP_SET.has(firstStop.stopName) &&
          STATION_STOP_SET.has(lastStop.stopName);
        if (sameTerminal || bothStationArea) {
          routeInfo.circularTripCount++;
        }
      }

      const tripPath: string[] = [];
      for (let i = 0; i < sts.length; i++) {
        const st = sts[i];
        const isLast = i === sts.length - 1;
        if (isLast || st.pickupType === "1") continue;

        const stop = feed.stopsById.get(st.stopId);
        if (!stop) continue;

        tripPath.push(stop.stopName);

        let accum = stopAccumMap.get(stop.stopName);
        if (!accum) {
          accum = {
            name: stop.stopName,
            latSum: 0,
            lngSum: 0,
            coordCount: 0,
            seenCoordKeys: new Set(),
            routeKeys: new Set(),
          };
          stopAccumMap.set(stop.stopName, accum);
        }
        const coordKey = `${stop.stopId}:${stop.lat.toFixed(6)},${stop.lng.toFixed(6)}`;
        if (!accum.seenCoordKeys.has(coordKey)) {
          accum.seenCoordKeys.add(coordKey);
          accum.latSum += stop.lat;
          accum.lngSum += stop.lng;
          accum.coordCount++;
        }
        accum.routeKeys.add(`${feed.feedId}:${trip.routeId}`);

        const isOrigin = i === 0;
        if (isOrigin) {
          routeInfo.originCounts.set(
            stop.stopName,
            (routeInfo.originCounts.get(stop.stopName) ?? 0) + 1,
          );
        }
        const remainingStops = sts.length - 1 - i;
        const isNearTerminal = remainingStops <= 1;

        events.push({
          feedId: feed.feedId,
          routeKey: `${feed.feedId}:${trip.routeId}`,
          serviceKey: `${feed.feedId}:${trip.serviceId}`,
          stopName: stop.stopName,
          platformCode: stop.platformCode,
          headsign: st.stopHeadsign || trip.headsign,
          departureMinutes: st.departureMinutes,
          isOrigin,
          isNearTerminal,
        });
      }

      if (tripPath.length > 0) {
        routeInfo.stopPaths.push(tripPath);
      }
    }
  }

  // 1. Stops table (sorted deterministically by Japanese name)
  const sortedStops = [...stopAccumMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "ja"),
  );
  const stopIdxByName = new Map<string, number>();
  const stops: LastBusStop[] = sortedStops.map((acc, idx) => {
    stopIdxByName.set(acc.name, idx);
    const lat = Math.round((acc.latSum / acc.coordCount) * 1e5) / 1e5;
    const lng = Math.round((acc.lngSum / acc.coordCount) * 1e5) / 1e5;
    return {
      id: `s-${String(idx + 1).padStart(3, "0")}`,
      name: acc.name,
      lat,
      lng,
      routeCount: acc.routeKeys.size,
    };
  });

  // 2. Routes table (sorted by feedId then routeId)
  const sortedRouteInfos = [...rawRouteMap.entries()].sort(([, ra], [, rb]) => {
    if (ra.feedId !== rb.feedId) {
      return ra.feedId.localeCompare(rb.feedId);
    }
    return compareRouteId(ra.route.routeId, rb.route.routeId);
  });

  const routeIdxByKey = new Map<string, number>();
  const routes: LastBusRoute[] = sortedRouteInfos.map(
    ([routeKey, info], idx) => {
      routeIdxByKey.set(routeKey, idx);

      const originStopIndices = [...info.originCounts.entries()]
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return (
            (stopIdxByName.get(a[0]) ?? 0) - (stopIdxByName.get(b[0]) ?? 0)
          );
        })
        .map(([name]) => stopIdxByName.get(name))
        .filter((v): v is number => v !== undefined);

      // Order route stops starting with the longest path, then appending any branch stops
      const orderedPaths = [...info.stopPaths].sort(
        (a, b) => b.length - a.length,
      );
      const seenStopIndices = new Set<number>();
      const stopIndices: number[] = [];
      for (const p of orderedPaths) {
        for (const name of p) {
          const sIdx = stopIdxByName.get(name);
          if (sIdx !== undefined && !seenStopIndices.has(sIdx)) {
            seenStopIndices.add(sIdx);
            stopIndices.push(sIdx);
          }
        }
      }

      const hasStationOrigin = [...info.originCounts.keys()].some((name) =>
        STATION_STOP_SET.has(name),
      );
      const isCircular =
        info.totalTripCount > 0 &&
        info.circularTripCount * 2 >= info.totalTripCount;

      return {
        key: routeKey,
        feedId: info.feedId,
        feedLabel: FEED_LABELS[info.feedId],
        routeId: info.route.routeId,
        name: info.route.name,
        color: info.route.color,
        textColor: info.route.textColor,
        isCircular,
        hasStationOrigin,
        originStopIndices,
        stopIndices,
      };
    },
  );

  // 3. Group schedule events and resolve used services & headsigns
  const usedServiceKeys = new Set<string>();
  const headsignIdxByText = new Map<string, number>();
  const headsigns: string[] = [];

  const groupMap = new Map<
    string,
    {
      stopIdx: number;
      routeIdx: number;
      serviceKey: string;
      headsignIdx: number;
      platformCode: string;
      flags: number;
      times: Set<number>;
    }
  >();

  for (const ev of events) {
    const stopIdx = stopIdxByName.get(ev.stopName);
    const routeIdx = routeIdxByKey.get(ev.routeKey);
    if (stopIdx === undefined || routeIdx === undefined) continue;
    if (!rawServiceMap.has(ev.serviceKey)) continue;

    usedServiceKeys.add(ev.serviceKey);

    let headsignIdx = headsignIdxByText.get(ev.headsign);
    if (headsignIdx === undefined) {
      headsignIdx = headsigns.length;
      headsignIdxByText.set(ev.headsign, headsignIdx);
      headsigns.push(ev.headsign);
    }

    const flags =
      (ev.isOrigin ? FLAG_IS_ORIGIN : 0) |
      (ev.isNearTerminal ? FLAG_IS_NEAR_TERMINAL : 0);

    const gKey = `${stopIdx}|${routeIdx}|${ev.serviceKey}|${headsignIdx}|${ev.platformCode}|${flags}`;
    let group = groupMap.get(gKey);
    if (!group) {
      group = {
        stopIdx,
        routeIdx,
        serviceKey: ev.serviceKey,
        headsignIdx,
        platformCode: ev.platformCode,
        flags,
        times: new Set(),
      };
      groupMap.set(gKey, group);
    }
    group.times.add(ev.departureMinutes);
  }

  const sortedServiceKeys = [...usedServiceKeys].sort((a, b) =>
    a.localeCompare(b, "ja"),
  );
  const serviceIdxByKey = new Map<string, number>();
  const services: LastBusService[] = sortedServiceKeys.flatMap((key) => {
    const raw = rawServiceMap.get(key);
    if (!raw) return [];
    const idx = serviceIdxByKey.size;
    serviceIdxByKey.set(key, idx);
    return [
      {
        key,
        feedId: raw.feedId,
        serviceId: raw.calendar.serviceId,
        daysLabel: raw.calendar.daysLabel,
        weekdayMask: raw.calendar.weekdayMask,
        startDate: raw.calendar.startDate,
        endDate: raw.calendar.endDate,
        addedDates: raw.calendar.addedDates,
        removedDates: raw.calendar.removedDates,
      },
    ];
  });

  const schedules: ScheduleTuple[] = [...groupMap.values()]
    .flatMap((g): ScheduleTuple[] => {
      const svcIdx = serviceIdxByKey.get(g.serviceKey);
      if (svcIdx === undefined) return [];
      const times = [...g.times].sort((a, b) => a - b);
      return [
        [
          g.stopIdx,
          g.routeIdx,
          svcIdx,
          g.headsignIdx,
          g.platformCode,
          g.flags,
          times,
        ],
      ];
    })
    .sort((a, b) => {
      if (a[0] !== b[0]) return a[0] - b[0];
      if (a[1] !== b[1]) return a[1] - b[1];
      if (a[2] !== b[2]) return a[2] - b[2];
      if (a[3] !== b[3]) return a[3] - b[3];
      return a[5] - b[5];
    });

  // 4. Resolve presets
  const presets: LastBusPreset[] = PRESET_SPECS.map((spec) => {
    const stopIndices = spec.stopNames
      .map((name) => stopIdxByName.get(name))
      .filter((idx): idx is number => idx !== undefined);
    if (stopIndices.length === 0) {
      throw new Error(`Preset ${spec.id} matched no stops in GTFS feeds`);
    }
    return {
      id: spec.id,
      label: spec.label,
      shortLabel: spec.shortLabel,
      category: spec.category,
      description: spec.description,
      stopIndices,
      originOnly: spec.originOnly,
    };
  });

  const feedMetaList = [...feeds]
    .sort((a, b) => a.feedId.localeCompare(b.feedId))
    .map((f) => ({
      feedId: f.feedId,
      feedName: f.feedName,
      version: f.version,
      validFrom: f.validFrom,
      validUntil: f.validUntil,
      calendarDatesUntil: f.calendarDatesUntil,
      routeCount: f.routes.length,
      stopCount: f.stopsById.size,
      tripCount: f.trips.length,
      stopTimeCount: f.stopTimes.length,
    }));

  const stationOriginRouteCount = routes.filter(
    (r) => r.hasStationOrigin,
  ).length;

  return lastBusDatasetSchema.parse({
    version: "1.0",
    generatedAt,
    site: "https://modata.raichonomichi.net",
    notice:
      "本ページは松本市公式の静的 GTFS-JP 時刻表データに基づく参考表示です。道路渋滞による遅延・天候や事故等による臨時運休・年末年始（12/29〜1/3）や2028年1〜3月の祝日特例ダイヤは反映されない場合があります。また、アルピコ交通の高速バス・上高地/乗鞍シャトルバス・上高地線電車およびJR線は本データの対象外です。",
    officialLinks: { ...OFFICIAL_BUS_LINKS },
    sources: {
      gtfs: {
        name: "松本市 バス情報データ（GTFS-JP）",
        sourceUrl:
          "https://www.city.matsumoto.nagano.jp/soshiki/222/88191.html",
        license: "CC BY 4.0",
        attribution:
          "松本市「バス情報データ（GTFS-JPデータ）」（GTFSデータリポジトリ公開 / CC BY 4.0）",
        feeds: feedMetaList,
      },
    },
    stats: {
      routeCount: routes.length,
      stopCount: stops.length,
      tripCount: totalTrips,
      stopTimeCount: totalStopTimes,
      stationOriginRouteCount,
      scheduleGroupCount: schedules.length,
    },
    presets,
    stops,
    routes,
    services,
    headsigns,
    schedules,
  });
}
