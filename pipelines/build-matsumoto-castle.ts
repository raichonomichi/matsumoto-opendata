import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type CastleEvent,
  type MatsumotoCastleDataset,
  type MonthlyStat,
  matsumotoCastleDatasetSchema,
} from "../src/lib/matsumoto-castle-schema";
import { CURATED_EVENTS } from "./matsumoto-castle/curation";
import {
  MATSUMOTO_CASTLE_MONTHLY_BASELINES,
  MATSUMOTO_TOURISM_MONTHLY_SOURCE,
} from "./matsumoto-castle/monthly-stats-data";
import {
  excelSerialToYmd,
  normalizeEventUrl,
  type ParsedLinkDataEvents,
  type ParsedWeatherMonth,
  parseCaoHolidaysCsv,
  parseLinkDataEventsTsv,
  parseLinkDataWeatherTsv,
} from "./matsumoto-castle/parsers";
import { buildCalendarDays } from "./matsumoto-castle/scoring";

const EVENTS_TSV_URL =
  "http://linkdata.org/download/rdf1s9164i/link/ivento_itiran.txt";
const WEATHER_TSV_URL =
  "http://linkdata.org/download/rdf1s8695i/link/matsumoto_kisho.txt";
const CAO_HOLIDAYS_CSV_URL =
  "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";

const OUTPUT_PATH = path.resolve("src/data/matsumoto-castle.json");

export const DATASET_RANGE = {
  startDate: "2026-04-01",
  endDate: "2027-12-31",
  eventsCoveredUntil: "2027-03-31",
} as const;

export function buildMonthlyStats(
  weatherMonths: ParsedWeatherMonth[],
): MonthlyStat[] {
  const weatherByMonth = new Map(
    weatherMonths.map((w) => [w.month, w.weather]),
  );

  return MATSUMOTO_CASTLE_MONTHLY_BASELINES.map((base) => {
    const weather = weatherByMonth.get(base.month);
    if (!weather) {
      throw new Error(`Missing weather baseline for month ${base.month}`);
    }
    const avgVisitors = Math.round(
      (base.yearlyVisitors.y2023 +
        base.yearlyVisitors.y2024 +
        base.yearlyVisitors.y2025) /
        3,
    );
    const avgDailyVisitors = Math.round(avgVisitors / base.openDays);

    return {
      month: base.month,
      avgVisitors,
      avgDailyVisitors,
      yearlyVisitors: base.yearlyVisitors,
      baselineScore: base.baselineScore,
      weather,
      seasonTag: base.seasonTag,
      seasonTip: base.seasonTip,
    };
  });
}

export function buildCuratedEvents(
  parsedEvents: ParsedLinkDataEvents,
): CastleEvent[] {
  const byId = new Map(parsedEvents.records.map((r) => [r.id, r]));

  return CURATED_EVENTS.map((spec) => {
    const raw = byId.get(spec.sourceRecordId);
    if (!raw) {
      throw new Error(
        `Curated event ${spec.id} references missing record ID ${spec.sourceRecordId}`,
      );
    }
    if (!raw.name.includes(spec.expectedNameSubstring)) {
      throw new Error(
        `Record ${spec.sourceRecordId} name mismatch: expected "${spec.expectedNameSubstring}", got "${raw.name}"`,
      );
    }

    if (/^\d{5}$/.test(raw.periodText)) {
      const parsedSerialDate = excelSerialToYmd(
        Number.parseInt(raw.periodText, 10),
      );
      if (parsedSerialDate !== spec.startDate) {
        throw new Error(
          `Excel serial date mismatch for ${spec.id} (record ${spec.sourceRecordId}): parsed ${parsedSerialDate}, expected ${spec.startDate}`,
        );
      }
    }

    const contactParts = [raw.contactName, raw.contactPhone].filter(Boolean);
    const officialUrl =
      spec.officialUrlOverride ?? normalizeEventUrl(raw.url) ?? null;

    return {
      id: spec.id,
      sourceRecordId: spec.sourceRecordId,
      name: raw.name,
      scope: spec.scope,
      category: raw.category,
      startDate: spec.startDate,
      endDate: spec.endDate,
      datePrecision: spec.datePrecision,
      dateNote: spec.dateNote,
      venue: raw.venue || "松本城公園・周辺",
      address: raw.address || null,
      summary: raw.description || null,
      impactPoints: spec.scope === "nearby_exhibition" ? 0 : spec.impactPoints,
      isNightEvent: spec.isNightEvent,
      trafficNote: spec.trafficNote,
      officialUrl,
      contact: contactParts.length > 0 ? contactParts.join(" / ") : null,
    };
  });
}

export interface BuildMatsumotoCastleDatasetInput {
  parsedEvents: ParsedLinkDataEvents;
  weatherMonths: ParsedWeatherMonth[];
  holidays: Map<string, string>;
  generatedAt: string;
}

export function buildMatsumotoCastleDataset(
  input: BuildMatsumotoCastleDatasetInput,
): MatsumotoCastleDataset {
  const monthlyStats = buildMonthlyStats(input.weatherMonths);
  const events = buildCuratedEvents(input.parsedEvents);
  const days = buildCalendarDays({
    startDate: DATASET_RANGE.startDate,
    endDate: DATASET_RANGE.endDate,
    eventsCoveredUntil: DATASET_RANGE.eventsCoveredUntil,
    holidays: input.holidays,
    monthlyStats,
    events,
  });

  const annualAvgVisitors = monthlyStats.reduce(
    (sum, m) => sum + m.avgVisitors,
    0,
  );

  const dataset: MatsumotoCastleDataset = {
    version: "1.0",
    generatedAt: input.generatedAt,
    site: "https://modata.raichonomichi.net",
    range: { ...DATASET_RANGE },
    annualAvgVisitors,
    notice:
      "本カレンダーの混雑度スコアは、松本市の過去3年（2023〜2025年）の月別延利用者数、令和8年度イベント一覧、国民の祝日・連休等をもとに算出した参考目安です。令和9年度（2027年4月以降）の市イベントは未公開のため、統計・祝日ベースの参考予測を表示しています。天候や最新の入場制限・天守入口までの待ち時間は国宝松本城公式サイトをご確認ください。",
    officialLinks: {
      home: "https://www.matsumoto-castle.jp/",
      info: "https://www.matsumoto-castle.jp/info",
      eventCalendar: "https://www.matsumoto-castle.jp/topics/7590.html",
      eTicket: "https://www.matsumoto-castle.jp/topics/10128.html",
    },
    sources: {
      events: {
        name: "松本市 令和8年度イベント一覧",
        sourceUrl: "http://linkdata.org/work/rdf1s9164i",
        license: "CC BY 3.0",
        attribution:
          "松本市 DX推進本部「松本市 令和8年度イベント一覧（ivento_itiran）」（クリエイティブ・コモンズ・ライセンス 表示 3.0 非移植）",
      },
      tourismMonthly: { ...MATSUMOTO_TOURISM_MONTHLY_SOURCE },
      weather: {
        name: "松本市 気象実況（2014〜2023年 月別平均）",
        sourceUrl: "http://linkdata.org/work/rdf1s8695i",
        license: "CC BY 3.0",
        attribution:
          "松本市 DX推進本部「松本市 気象実況（matsumoto_kisho）」（クリエイティブ・コモンズ・ライセンス 表示 3.0 非移植）",
      },
      holidays: {
        name: "国民の祝日（内閣府 CSV）",
        sourceUrl: "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv",
        license: "政府標準利用規約2.0",
        attribution: "内閣府「国民の祝日について（syukujitsu.csv）」",
      },
    },
    monthlyStats,
    events,
    days,
  };

  return matsumotoCastleDatasetSchema.parse(dataset);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.arrayBuffer();
}

export async function runMatsumotoCastlePipeline(): Promise<void> {
  console.log("Fetching Matsumoto events, weather, and CAO holidays...");
  const [eventsTsv, weatherTsv, holidaysBuffer] = await Promise.all([
    fetchText(EVENTS_TSV_URL),
    fetchText(WEATHER_TSV_URL),
    fetchBuffer(CAO_HOLIDAYS_CSV_URL),
  ]);

  const parsedEvents = parseLinkDataEventsTsv(eventsTsv);
  const weatherMonths = parseLinkDataWeatherTsv(weatherTsv, 2014, 2023);
  const holidays = parseCaoHolidaysCsv(holidaysBuffer, 2026, 2027);
  const generatedAt = new Date().toISOString().slice(0, 10);

  const dataset = buildMatsumotoCastleDataset({
    parsedEvents,
    weatherMonths,
    holidays,
    generatedAt,
  });

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(dataset, null, 2)}\n`,
    "utf-8",
  );
  console.log(
    `Generated ${path.relative(process.cwd(), OUTPUT_PATH)} (${dataset.events.length} events, ${dataset.days.length} days)`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
  await runMatsumotoCastlePipeline();
}
