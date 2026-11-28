import type {
  GtfsFeedId,
  LastBusDataset,
  LastBusService,
  LastBusStop,
  ScheduleTuple,
} from "./last-bus-schema";

export const FLAG_IS_ORIGIN = 1;
export const FLAG_IS_NEAR_TERMINAL = 2;

export interface JstDateTimeParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
  second: number;
  ymd: string;
  secondsOfDay: number;
}

export type CountdownStatus =
  | "imminent"
  | "soon"
  | "running"
  | "ended"
  | "suspended";

export type SelectionTarget =
  | { kind: "preset"; presetId: string }
  | { kind: "stop"; stopIndex: number }
  | { kind: "all_routes" };

export interface NextOperatingInfo {
  ymd: string;
  weekday: number;
  firstDepartureMinutes: number;
  lastDepartureMinutes: number;
  tripCount: number;
}

export interface CountdownCardItem {
  key: string;
  stopIndex: number;
  stopName: string;
  stopLat: number;
  stopLng: number;
  routeIndex: number;
  routeKey: string;
  routeId: string;
  feedId: GtfsFeedId;
  feedLabel: string;
  routeName: string;
  routeColor: string;
  routeTextColor: string;
  isCircular: boolean;
  headsign: string;
  platformCode: string;
  isOrigin: boolean;
  isNearTerminal: boolean;
  status: CountdownStatus;
  remainingSeconds: number | null;
  firstDepartureMinutes: number | null;
  lastDepartureMinutes: number | null;
  nextDepartureMinutes: number | null;
  remainingTrips: number;
  totalTrips: number;
  lastTrips: number[];
  todayDepartures: number[];
  registeredDaysLabels: string[];
  activeServiceLabels: string[];
  nextOperating: NextOperatingInfo | null;
}

export interface CountdownBoardSummary {
  totalCount: number;
  imminentCount: number;
  soonCount: number;
  runningCount: number;
  endedCount: number;
  suspendedCount: number;
  activeCount: number;
  latestActiveItem: CountdownCardItem | null;
  earliestUrgentItem: CountdownCardItem | null;
}

export interface CountdownBoardResult {
  jst: JstDateTimeParts;
  dayPatternLabel: string;
  items: CountdownCardItem[];
  summary: CountdownBoardSummary;
}

export interface NearestStopCandidate {
  stopIndex: number;
  stop: LastBusStop;
  distanceKm: number;
}

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

const jstDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * 任意の Date を日本標準時（Asia/Tokyo）の日時パーツへ変換する。
 */
export function getJstDateTimeParts(date: Date): JstDateTimeParts {
  const parts = jstDateTimeFormatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  const year = Number.parseInt(map.year ?? "1970", 10);
  const month = Number.parseInt(map.month ?? "1", 10);
  const day = Number.parseInt(map.day ?? "1", 10);
  const hour = Number.parseInt(map.hour ?? "0", 10) % 24;
  const minute = Number.parseInt(map.minute ?? "0", 10);
  const second = Number.parseInt(map.second ?? "0", 10);

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return {
    year,
    month,
    day,
    weekday,
    hour,
    minute,
    second,
    ymd: `${year}-${mm}-${dd}`,
    secondsOfDay: hour * 3600 + minute * 60 + second,
  };
}

/**
 * YYYY-MM-DD と HH:MM 文字列を JST (+09:00) の Date へ変換する。
 */
export function parseJstDateTimeInput(ymd: string, hhmm: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!dateMatch || !timeMatch) return null;

  const year = Number.parseInt(dateMatch[1], 10);
  const month = Number.parseInt(dateMatch[2], 10);
  const day = Number.parseInt(dateMatch[3], 10);
  const hour = Number.parseInt(timeMatch[1], 10);
  const minute = Number.parseInt(timeMatch[2], 10);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(
    `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${hh}:${mm}:00+09:00`,
  );
}

/**
 * YYYY-MM-DD 文字列を日数だけ前後移動し、YMD と曜日を返す。
 */
export function shiftYmd(
  ymd: string,
  deltaDays: number,
): { ymd: string; weekday: number } {
  const [y, m, d] = ymd.split("-").map((v) => Number.parseInt(v, 10));
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return {
    ymd: `${year}-${month}-${day}`,
    weekday: dt.getUTCDay(),
  };
}

/**
 * JS Date.getUTCDay() (0=日..6=土) を GTFS 曜日ビットへ変換する。
 * bit0=月(1), bit1=火(2), bit2=水(4), bit3=木(8), bit4=金(16), bit5=土(32), bit6=日(64)
 */
export function weekdayToGtfsBit(jsWeekday: number): number {
  const gtfsIdx = jsWeekday === 0 ? 6 : jsWeekday - 1;
  return 1 << gtfsIdx;
}

/**
 * GTFS 標準仕様（calendar + calendar_dates 例外日）に基づき、指定日に運行するか判定する。
 */
export function isServiceActiveOnDate(
  service: LastBusService,
  ymd: string,
  jsWeekday: number,
): boolean {
  if (service.removedDates.includes(ymd)) {
    return false;
  }
  if (service.addedDates.includes(ymd)) {
    return true;
  }
  if (ymd < service.startDate || ymd > service.endDate) {
    return false;
  }
  return (service.weekdayMask & weekdayToGtfsBit(jsWeekday)) !== 0;
}

/**
 * 指定日の代表ダイヤ種別ラベルを返す。
 */
export function describeDayPattern(
  dataset: LastBusDataset,
  ymd: string,
  jsWeekday: number,
): string {
  const inPeriod = dataset.sources.gtfs.feeds.some(
    (f) => ymd >= f.validFrom && ymd <= f.validUntil,
  );
  if (!inPeriod) {
    return "ダイヤ有効期間外";
  }

  const holidayService = dataset.services.find(
    (s) => s.key === "guruttomatsumotobus1:土休日",
  );
  const weekdayService = dataset.services.find(
    (s) => s.key === "guruttomatsumotobus1:平日",
  );
  const isWeekday = jsWeekday >= 1 && jsWeekday <= 5;

  if (
    isWeekday &&
    holidayService?.addedDates.includes(ymd) &&
    weekdayService?.removedDates.includes(ymd)
  ) {
    return "祝日・お盆特例（土休日ダイヤ）";
  }

  if (!isWeekday) {
    return "土休日ダイヤ";
  }

  return "平日ダイヤ";
}

function collectSchedulesForSelection(
  dataset: LastBusDataset,
  selection: SelectionTarget,
): ScheduleTuple[] {
  if (selection.kind === "preset") {
    const preset =
      dataset.presets.find((p) => p.id === selection.presetId) ??
      dataset.presets[0];
    if (!preset) return [];
    const stopSet = new Set(preset.stopIndices);
    return dataset.schedules.filter((tuple) => {
      if (!stopSet.has(tuple[0])) return false;
      if (preset.originOnly && (tuple[5] & FLAG_IS_ORIGIN) === 0) return false;
      return true;
    });
  }

  if (selection.kind === "stop") {
    return dataset.schedules.filter(
      (tuple) => tuple[0] === selection.stopIndex,
    );
  }

  const originSetByRoute = dataset.routes.map(
    (route) => new Set(route.originStopIndices),
  );
  return dataset.schedules.filter((tuple) => {
    const [stopIdx, routeIdx, , , , flags] = tuple;
    if ((flags & FLAG_IS_ORIGIN) === 0) return false;
    return originSetByRoute[routeIdx]?.has(stopIdx) ?? false;
  });
}

function findNextOperating(
  dataset: LastBusDataset,
  groupTuples: ScheduleTuple[],
  baseYmd: string,
  maxLookahead = 14,
): NextOperatingInfo | null {
  for (let delta = 1; delta <= maxLookahead; delta++) {
    const nextDay = shiftYmd(baseYmd, delta);
    const times = new Set<number>();
    for (const tuple of groupTuples) {
      const service = dataset.services[tuple[2]];
      if (!service) continue;
      if (isServiceActiveOnDate(service, nextDay.ymd, nextDay.weekday)) {
        for (const dep of tuple[6]) {
          times.add(dep);
        }
      }
    }
    if (times.size > 0) {
      const sorted = [...times].sort((a, b) => a - b);
      return {
        ymd: nextDay.ymd,
        weekday: nextDay.weekday,
        firstDepartureMinutes: sorted[0],
        lastDepartureMinutes: sorted[sorted.length - 1],
        tripCount: sorted.length,
      };
    }
  }
  return null;
}

const STATUS_PRIORITY: Record<CountdownStatus, number> = {
  imminent: 0,
  soon: 1,
  running: 2,
  ended: 3,
  suspended: 4,
};

/**
 * 選択中の停留所・プリセット・全路線ビューに対する終バスカウントダウン一覧と集計値を返す。
 */
export function evaluateCountdownBoard(
  dataset: LastBusDataset,
  selection: SelectionTarget,
  nowDate: Date,
): CountdownBoardResult {
  const jst = getJstDateTimeParts(nowDate);
  const dayPatternLabel = describeDayPattern(dataset, jst.ymd, jst.weekday);
  const targetTuples = collectSchedulesForSelection(dataset, selection);

  const grouped = new Map<
    string,
    {
      stopIdx: number;
      routeIdx: number;
      headsignIdx: number;
      platformCode: string;
      isNearTerminal: boolean;
      isOrigin: boolean;
      tuples: ScheduleTuple[];
    }
  >();

  for (const tuple of targetTuples) {
    const [stopIdx, routeIdx, , headsignIdx, platformCode, flags] = tuple;
    const isOrigin = (flags & FLAG_IS_ORIGIN) !== 0;
    const isNearTerminal = (flags & FLAG_IS_NEAR_TERMINAL) !== 0;
    const key = `${stopIdx}|${routeIdx}|${headsignIdx}|${platformCode}|${isNearTerminal ? 1 : 0}`;
    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        stopIdx,
        routeIdx,
        headsignIdx,
        platformCode,
        isNearTerminal,
        isOrigin,
        tuples: [],
      };
      grouped.set(key, entry);
    } else if (isOrigin) {
      entry.isOrigin = true;
    }
    entry.tuples.push(tuple);
  }

  const activeServiceCache = new Map<number, boolean>();
  const isSvcActive = (serviceIdx: number): boolean => {
    const cached = activeServiceCache.get(serviceIdx);
    if (cached !== undefined) return cached;
    const svc = dataset.services[serviceIdx];
    const active = svc
      ? isServiceActiveOnDate(svc, jst.ymd, jst.weekday)
      : false;
    activeServiceCache.set(serviceIdx, active);
    return active;
  };

  const nowSeconds = jst.secondsOfDay;
  const items: CountdownCardItem[] = [];

  for (const [key, entry] of grouped) {
    const stop = dataset.stops[entry.stopIdx];
    const route = dataset.routes[entry.routeIdx];
    const headsign = dataset.headsigns[entry.headsignIdx];
    if (!stop || !route || !headsign) continue;

    const todayTimeSet = new Set<number>();
    const registeredLabels = new Set<string>();
    const activeLabels = new Set<string>();

    for (const tuple of entry.tuples) {
      const svcIdx = tuple[2];
      const svc = dataset.services[svcIdx];
      if (!svc) continue;
      registeredLabels.add(svc.daysLabel);
      if (isSvcActive(svcIdx)) {
        activeLabels.add(svc.daysLabel);
        for (const m of tuple[6]) {
          todayTimeSet.add(m);
        }
      }
    }

    const todayDepartures = [...todayTimeSet].sort((a, b) => a - b);
    let status: CountdownStatus;
    let remainingSeconds: number | null = null;
    let firstDepartureMinutes: number | null = null;
    let lastDepartureMinutes: number | null = null;
    let nextDepartureMinutes: number | null = null;
    let remainingTrips = 0;
    let lastTrips: number[] = [];
    let nextOperating: NextOperatingInfo | null = null;

    if (todayDepartures.length === 0) {
      status = "suspended";
      nextOperating = findNextOperating(dataset, entry.tuples, jst.ymd);
    } else {
      firstDepartureMinutes = todayDepartures[0];
      lastDepartureMinutes = todayDepartures[todayDepartures.length - 1];
      lastTrips = todayDepartures.slice(-3);
      const diffSeconds = lastDepartureMinutes * 60 - nowSeconds;

      if (diffSeconds <= 0) {
        status = "ended";
        nextOperating = findNextOperating(dataset, entry.tuples, jst.ymd);
      } else {
        const remainingList = todayDepartures.filter(
          (m) => m * 60 > nowSeconds,
        );
        remainingTrips = remainingList.length;
        nextDepartureMinutes = remainingList[0] ?? null;
        remainingSeconds = diffSeconds;
        status =
          diffSeconds <= 1800
            ? "imminent"
            : diffSeconds <= 3600
              ? "soon"
              : "running";
      }
    }

    items.push({
      key,
      stopIndex: entry.stopIdx,
      stopName: stop.name,
      stopLat: stop.lat,
      stopLng: stop.lng,
      routeIndex: entry.routeIdx,
      routeKey: route.key,
      routeId: route.routeId,
      feedId: route.feedId,
      feedLabel: route.feedLabel,
      routeName: route.name,
      routeColor: route.color,
      routeTextColor: route.textColor,
      isCircular: route.isCircular,
      headsign,
      platformCode: entry.platformCode,
      isOrigin: entry.isOrigin,
      isNearTerminal: entry.isNearTerminal,
      status,
      remainingSeconds,
      firstDepartureMinutes,
      lastDepartureMinutes,
      nextDepartureMinutes,
      remainingTrips,
      totalTrips: todayDepartures.length,
      lastTrips,
      todayDepartures,
      registeredDaysLabels: [...registeredLabels],
      activeServiceLabels: [...activeLabels],
      nextOperating,
    });
  }

  items.sort((a, b) => {
    const pDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (pDiff !== 0) return pDiff;
    if (a.remainingSeconds !== null && b.remainingSeconds !== null) {
      if (a.remainingSeconds !== b.remainingSeconds) {
        return a.remainingSeconds - b.remainingSeconds;
      }
    }
    if (a.lastDepartureMinutes !== null && b.lastDepartureMinutes !== null) {
      if (b.lastDepartureMinutes !== a.lastDepartureMinutes) {
        return b.lastDepartureMinutes - a.lastDepartureMinutes;
      }
    }
    const rCmp = a.routeName.localeCompare(b.routeName, "ja");
    if (rCmp !== 0) return rCmp;
    return a.headsign.localeCompare(b.headsign, "ja");
  });

  let imminentCount = 0;
  let soonCount = 0;
  let runningCount = 0;
  let endedCount = 0;
  let suspendedCount = 0;
  let latestActiveItem: CountdownCardItem | null = null;
  let earliestUrgentItem: CountdownCardItem | null = null;

  for (const item of items) {
    if (item.status === "imminent") imminentCount++;
    else if (item.status === "soon") soonCount++;
    else if (item.status === "running") runningCount++;
    else if (item.status === "ended") endedCount++;
    else suspendedCount++;

    if (item.remainingSeconds !== null && item.lastDepartureMinutes !== null) {
      if (
        !earliestUrgentItem ||
        (earliestUrgentItem.remainingSeconds ?? Number.MAX_SAFE_INTEGER) >
          item.remainingSeconds
      ) {
        earliestUrgentItem = item;
      }
      if (
        !latestActiveItem ||
        (latestActiveItem.lastDepartureMinutes ?? -1) <
          item.lastDepartureMinutes
      ) {
        latestActiveItem = item;
      }
    }
  }

  return {
    jst,
    dayPatternLabel,
    items,
    summary: {
      totalCount: items.length,
      imminentCount,
      soonCount,
      runningCount,
      endedCount,
      suspendedCount,
      activeCount: imminentCount + soonCount + runningCount,
      latestActiveItem,
      earliestUrgentItem,
    },
  };
}

/**
 * 2点間の測地線近似距離（Haversine 公式, km）を返す。
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * 指定座標から近い順に停留所を返す。
 */
export function findNearestStops(
  stops: LastBusStop[],
  lat: number,
  lng: number,
  limit = 5,
): NearestStopCandidate[] {
  return stops
    .map((stop, stopIndex) => ({
      stopIndex,
      stop,
      distanceKm: haversineDistanceKm(lat, lng, stop.lat, stop.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, Math.max(1, limit));
}

/**
 * 残り秒数をデジタル発車標形式（HH:MM:SS）で整形する。
 */
export function formatCountdown(remainingSeconds: number): string {
  const safe = Math.max(0, Math.floor(remainingSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * 残り秒数を読みやすい日本語テキスト（例: あと1時間23分）へ整形する。
 */
export function formatRemainingJapanese(remainingSeconds: number): string {
  const safe = Math.max(0, Math.floor(remainingSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return m > 0 ? `あと${h}時間${m}分` : `あと${h}時間`;
  }
  if (m > 0) {
    return `あと${m}分${String(s).padStart(2, "0")}秒`;
  }
  return `あと${s}秒`;
}

/**
 * 分単位整数を HH:MM 形式へ整形する。
 */
export function formatMinutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * YYYY-MM-DD を M/D(曜) 形式へ整形する。
 */
export function formatYmdWithWeekday(ymd: string, weekday: number): string {
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  const month = Number.parseInt(parts[1], 10);
  const day = Number.parseInt(parts[2], 10);
  return `${month}/${day}(${WEEKDAY_JA[weekday] ?? ""})`;
}
