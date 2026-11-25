import {
  type BusAccess,
  type GtfsServiceSummary,
  type YamagoyaDataset,
  type YamagoyaRecord,
  yamagoyaDatasetSchema,
} from "../../src/lib/yamagoya-schema";
import { CURATED_HUTS, type CuratedHutSpec } from "./curation";
import { GRADING_ROUTES, NAGANO_GRADING_SOURCE } from "./grading-data";

export interface RawHotelRecord {
  id: string;
  name: string;
  postalCode: string;
  address: string;
  operator: string;
  category: string;
  rooms: number | null;
  capacity: number | null;
  permittedAt: string | null;
  permitNumber: string;
}

export interface ParsedLinkDataHotel {
  metadata: {
    attributionName: string;
    licenseUrl: string;
    downloadFrom: string;
  };
  records: RawHotelRecord[];
}

function parseOptionalInt(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeDate(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  return null;
}

export function parseLinkDataHotelTsv(tsvText: string): ParsedLinkDataHotel {
  const lines = tsvText.replace(/^\uFEFF/, "").split(/\r?\n/);
  const metadata = {
    attributionName: "松本市",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/deed.ja",
    downloadFrom: "http://linkdata.org/work/rdf1s8757i",
  };
  const records: RawHotelRecord[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    if (line.startsWith("#")) {
      const parts = line.split("\t");
      const key = parts[0]?.trim();
      const val = parts[1]?.trim();
      if (key === "#attribution_name" && val) metadata.attributionName = val;
      if (key === "#license" && val) {
        metadata.licenseUrl = val.replace(/^http:\/\//, "https://");
      }
      if (key === "#download_from" && val) metadata.downloadFrom = val;
      continue;
    }

    const cols = line.split("\t");
    if (cols.length < 10) continue;

    records.push({
      id: cols[0].trim(),
      name: cols[1].trim(),
      postalCode: cols[2].trim(),
      address: cols[3].trim(),
      operator: cols[4].trim(),
      category: cols[5].trim(),
      rooms: parseOptionalInt(cols[6]),
      capacity: parseOptionalInt(cols[7]),
      permittedAt: normalizeDate(cols[8]),
      permitNumber: cols[9].trim(),
    });
  }

  return { metadata, records };
}

export function parseGtfsCsv(csvText: string): Record<string, string>[] {
  const text = csvText.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = (cells[i] ?? "").trim();
    }
    return obj;
  });
}

export interface GtfsFeedFiles {
  feedId: string;
  feedInfoCsv: string;
  routesCsv: string;
  tripsCsv: string;
  calendarCsv: string;
  calendarDatesCsv?: string;
  stopTimesCsv: string;
}

export interface GtfsCalendarExceptions {
  addedDates: string[];
  removedDates: string[];
}

export interface ParsedGtfsFeed {
  feedId: string;
  version: string;
  validFrom: string;
  validUntil: string;
  routesById: Map<string, string>;
  trips: Record<string, string>[];
  calendarById: Map<string, Record<string, string>>;
  calendarExceptionsById: Map<string, GtfsCalendarExceptions>;
  stopTimes: Record<string, string>[];
}

export function parseGtfsFeed(files: GtfsFeedFiles): ParsedGtfsFeed {
  const feedInfo = parseGtfsCsv(files.feedInfoCsv)[0] ?? {};
  const routes = parseGtfsCsv(files.routesCsv);
  const trips = parseGtfsCsv(files.tripsCsv);
  const calendar = parseGtfsCsv(files.calendarCsv);
  const calendarDates = files.calendarDatesCsv
    ? parseGtfsCsv(files.calendarDatesCsv)
    : [];
  const stopTimes = parseGtfsCsv(files.stopTimesCsv);

  const routesById = new Map<string, string>();
  for (const r of routes) {
    const routeName = r.route_long_name || r.route_short_name || r.route_id;
    routesById.set(r.route_id, routeName);
  }

  const calendarById = new Map<string, Record<string, string>>();
  for (const c of calendar) {
    calendarById.set(c.service_id, c);
  }

  const exceptionSets = new Map<
    string,
    { added: Set<string>; removed: Set<string> }
  >();
  for (const cd of calendarDates) {
    const serviceId = cd.service_id;
    const date = normalizeDate(cd.date);
    if (!serviceId || !date) continue;
    let entry = exceptionSets.get(serviceId);
    if (!entry) {
      entry = { added: new Set<string>(), removed: new Set<string>() };
      exceptionSets.set(serviceId, entry);
    }
    if (cd.exception_type === "1") {
      entry.added.add(date);
    } else if (cd.exception_type === "2") {
      entry.removed.add(date);
    }
  }

  const calendarExceptionsById = new Map<string, GtfsCalendarExceptions>();
  for (const [serviceId, sets] of exceptionSets) {
    calendarExceptionsById.set(serviceId, {
      addedDates: [...sets.added].sort(),
      removedDates: [...sets.removed].sort(),
    });
  }

  return {
    feedId: files.feedId,
    version: feedInfo.feed_version || "unknown",
    validFrom: normalizeDate(feedInfo.feed_start_date) ?? "2026-01-01",
    validUntil: normalizeDate(feedInfo.feed_end_date) ?? "2026-12-31",
    routesById,
    trips,
    calendarById,
    calendarExceptionsById,
    stopTimes,
  };
}

function formatDaysLabel(cal: Record<string, string> | undefined): string {
  if (!cal) return "運行日指定";
  const mapping: [string, string][] = [
    ["monday", "月"],
    ["tuesday", "火"],
    ["wednesday", "水"],
    ["thursday", "木"],
    ["friday", "金"],
    ["saturday", "土"],
    ["sunday", "日"],
  ];
  const active = mapping
    .filter(([key]) => cal[key] === "1")
    .map(([, label]) => label);
  if (active.length === 7) return "毎日";
  if (active.join("") === "月火水木金") return "平日（月〜金）";
  if (active.join("") === "土日") return "土日";
  if (active.length === 0) return "特定日";
  return active.join("・");
}

export function extractGtfsStopSchedules(
  feed: ParsedGtfsFeed,
  routeId: string,
  stopIds: string[],
): GtfsServiceSummary[] {
  const stopSet = new Set(stopIds);
  const tripsById = new Map<string, { serviceId: string; headsign: string }>();
  for (const trip of feed.trips) {
    if (trip.route_id === routeId) {
      tripsById.set(trip.trip_id, {
        serviceId: trip.service_id,
        headsign: trip.trip_headsign || "方面指定なし",
      });
    }
  }

  const grouped = new Map<
    string,
    { serviceId: string; headsign: string; times: Set<string> }
  >();
  for (const st of feed.stopTimes) {
    if (!stopSet.has(st.stop_id)) continue;
    // GTFS pickup_type=1 means no pickup available (drop-off only / terminating stop)
    if (st.pickup_type === "1") continue;
    const trip = tripsById.get(st.trip_id);
    if (!trip) continue;
    const hhmm = (st.departure_time || st.arrival_time || "").slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(hhmm)) continue;

    const key = `${trip.serviceId}__${trip.headsign}`;
    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        serviceId: trip.serviceId,
        headsign: trip.headsign,
        times: new Set<string>(),
      };
      grouped.set(key, entry);
    }
    entry.times.add(hhmm);
  }

  return [...grouped.values()]
    .map((entry) => {
      const departures = [...entry.times].sort();
      const cal = feed.calendarById.get(entry.serviceId);
      const exceptions = feed.calendarExceptionsById.get(entry.serviceId);
      const daysLabel = formatDaysLabel(cal);
      return {
        serviceId: entry.serviceId,
        serviceLabel: entry.serviceId,
        daysLabel,
        serviceStartDate: normalizeDate(cal?.start_date),
        serviceEndDate: normalizeDate(cal?.end_date),
        addedDates: exceptions?.addedDates ?? [],
        removedDates: exceptions?.removedDates ?? [],
        headsign: entry.headsign,
        tripCount: departures.length,
        firstDeparture: departures[0],
        lastDeparture: departures[departures.length - 1],
        departures,
      };
    })
    .sort((a, b) =>
      `${a.serviceLabel}:${a.headsign}`.localeCompare(
        `${b.serviceLabel}:${b.headsign}`,
        "ja",
      ),
    );
}

function normalizeNameForMatch(value: string): string {
  return value.replace(/[\s\u3000]+/g, "").trim();
}

export function buildYamagoyaDataset(params: {
  hotelData: ParsedLinkDataHotel;
  gtfsFeeds: Record<string, ParsedGtfsFeed>;
  generatedAt: string;
  curationList?: CuratedHutSpec[];
}): YamagoyaDataset {
  const {
    hotelData,
    gtfsFeeds,
    generatedAt,
    curationList = CURATED_HUTS,
  } = params;

  const byId = new Map(hotelData.records.map((r) => [r.id, r]));
  const byNormalizedName = new Map(
    hotelData.records.map((r) => [normalizeNameForMatch(r.name), r]),
  );

  const huts: YamagoyaRecord[] = curationList.map((spec) => {
    const idMatch = byId.get(spec.sourceRecordId);
    const matched =
      idMatch &&
      normalizeNameForMatch(idMatch.name) ===
        normalizeNameForMatch(spec.expectedRegistryName)
        ? idMatch
        : byNormalizedName.get(
            normalizeNameForMatch(spec.expectedRegistryName),
          );

    if (!matched) {
      throw new Error(
        `Curated hut not found in Matsumoto hotel registry: id=${spec.sourceRecordId} name=${spec.expectedRegistryName}`,
      );
    }

    const grading = spec.gradingRouteNumbers.map((num) => {
      const route = GRADING_ROUTES[num];
      if (!route) {
        throw new Error(`Unknown Nagano grading route number: ${num}`);
      }
      return route;
    });

    const busAccess: BusAccess[] = spec.busAccess.map((busSpec) => {
      if (busSpec.kind === "external_timetable") {
        return busSpec;
      }
      const feed = gtfsFeeds[busSpec.feedId];
      if (!feed) {
        throw new Error(`Missing GTFS feed: ${busSpec.feedId}`);
      }
      const routeName =
        feed.routesById.get(busSpec.routeId) ?? `路線 ${busSpec.routeId}`;
      const schedules = extractGtfsStopSchedules(
        feed,
        busSpec.routeId,
        busSpec.stopIds,
      );
      if (schedules.length === 0) {
        throw new Error(
          `No GTFS schedules found for feed=${busSpec.feedId} route=${busSpec.routeId} stops=${busSpec.stopIds.join(",")}`,
        );
      }
      return {
        kind: "gtfs",
        stopName: busSpec.stopName,
        stopIds: busSpec.stopIds,
        routeId: busSpec.routeId,
        routeName,
        feedId: busSpec.feedId,
        operator: busSpec.operator,
        accessNote: busSpec.accessNote,
        validFrom: feed.validFrom,
        validUntil: feed.validUntil,
        schedules,
      };
    });

    return {
      id: spec.id,
      sourceRecordId: matched.id,
      name: spec.name,
      registryName: matched.name,
      area: spec.area,
      subArea: spec.subArea,
      elevationM: spec.elevationM,
      summary: spec.summary,
      permit: {
        category: matched.category || "不明",
        rooms: matched.rooms,
        capacity: matched.capacity,
        permittedAt: matched.permittedAt,
        permitNumber: matched.permitNumber || "記載なし",
        operator: matched.operator || null,
        postalCode: matched.postalCode || null,
        address: matched.address,
      },
      grading,
      primaryPhysicalLevel: grading[0].physicalLevel,
      primaryDifficultyGrade: grading[0].difficultyGrade,
      busAccess,
    };
  });

  huts.sort((a, b) => b.elevationM - a.elevationM);

  const feedMetaList = Object.values(gtfsFeeds)
    .map((feed) => ({
      feedId: feed.feedId,
      version: feed.version,
      validFrom: feed.validFrom,
      validUntil: feed.validUntil,
    }))
    .sort((a, b) => a.feedId.localeCompare(b.feedId));

  return yamagoyaDatasetSchema.parse({
    version: "1.0",
    generatedAt,
    site: "https://modata.raichonomichi.net",
    count: huts.length,
    notice:
      "本データは松本市の旅館業営業許可台帳・長野県「信州 山のグレーディング」・松本市公式 GTFS-JP 等を結合した参考データベースです。予約・空き状況・最新の営業期間や料金は行政台帳に含まれないため、必ず各山小屋および交通事業者の公式サイトをご確認ください。",
    sources: {
      hotelRegistry: {
        name: "松本市の生活衛生施設データ（旅館業）",
        sourceUrl: hotelData.metadata.downloadFrom,
        license: "CC BY 3.0",
        attribution: `${hotelData.metadata.attributionName}（LinkData.org 公開データ）`,
      },
      gtfs: {
        name: "松本市 バス情報データ（GTFS-JP）",
        sourceUrl:
          "https://www.city.matsumoto.nagano.jp/soshiki/222/88191.html",
        license: "CC BY 4.0",
        feeds: feedMetaList,
      },
      mountainGrading: {
        ...NAGANO_GRADING_SOURCE,
      },
    },
    huts,
  });
}
