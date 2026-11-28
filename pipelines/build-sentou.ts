import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type BathFacility,
  type BathSchedule,
  type BathTimeWindow,
  type SentouDataset,
  sentouDatasetSchema,
} from "../src/lib/sentou-schema";
import { parseCaoHolidaysCsv } from "./matsumoto-castle/parsers";
import {
  ACCESS_CATEGORY_LABELS,
  BATH_CURATIONS,
  inferAreaFromAddress,
  OFFICIAL_BATH_LINKS,
} from "./sentou/curation";
import { parseLinkDataBathTsv, type RawBathRecord } from "./sentou/parsers";

const BATH_REGISTRY_URL =
  "http://linkdata.org/download/rdf1s8757i/link/matsumoto_bath.txt";

const CAO_HOLIDAYS_CSV_URL =
  "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";

const OUTPUT_PATH = path.resolve("src/data/sentou.json");

function normalizeForMatch(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectScheduleWindows(schedule: BathSchedule): BathTimeWindow[] {
  if (schedule.kind !== "structured") return [];
  const windows: BathTimeWindow[] = [...schedule.defaultSessions];
  if (schedule.daySessions) {
    for (const list of Object.values(schedule.daySessions)) {
      windows.push(...list);
    }
  }
  for (const ov of schedule.seasonalOverrides) {
    if (ov.weekday) windows.push(...ov.weekday);
    if (ov.saturday) windows.push(...ov.saturday);
    if (ov.sunday) windows.push(...ov.sunday);
    if (ov.holiday) windows.push(...ov.holiday);
  }
  return windows;
}

function deriveScheduleFlags(schedule: BathSchedule): {
  hasMorningBath: boolean;
  openLateNight: boolean;
  latestLastEntryMinutes: number | null;
} {
  const windows = collectScheduleWindows(schedule);
  if (windows.length === 0) {
    return {
      hasMorningBath: false,
      openLateNight: false,
      latestLastEntryMinutes: null,
    };
  }

  return {
    hasMorningBath: windows.some((w) => w.openMinutes <= 9 * 60),
    openLateNight: windows.some(
      (w) => w.lastEntryMinutes >= 21 * 60 || w.closeMinutes >= 22 * 60,
    ),
    latestLastEntryMinutes: Math.max(...windows.map((w) => w.lastEntryMinutes)),
  };
}

function buildFallbackFacility(raw: RawBathRecord): BathFacility {
  const inferred = inferAreaFromAddress(raw.address, raw.postalCode);
  const accessCategory = "check_lodging_or_status" as const;
  const isHotSpringArea =
    inferred.areaGroup === "asama_utsukushigahara" ||
    inferred.areaGroup === "norikura_shirahone";

  return {
    id: `bath-${raw.id}`,
    sourceRecordId: raw.id,
    name: raw.registryName,
    registryName: raw.registryName,
    permitCategory: raw.permitCategory,
    permittedAt: raw.permittedAt,
    permitNumber: raw.permitNumber,
    operator: raw.operator,
    postalCode: raw.postalCode,
    address: raw.address,
    subArea: inferred.subArea,
    areaGroup: inferred.areaGroup,
    accessCategory,
    accessLabel: ACCESS_CATEGORY_LABELS[accessCategory],
    accessNote:
      "公衆浴場台帳に収録されている温泉旅館・宿泊施設等の許可施設です。日帰り入浴（立ち寄り湯）を受け入れているかは施設・季節・混雑状況により異なるため、事前に公式案内や電話でご確認ください。",
    facilityType: "lodging_other",
    waterType: isHotSpringArea ? "onsen" : "unknown",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: null,
    phone: null,
    officialUrl: null,
    mapQuery: `${raw.registryName} ${raw.address}`,
    lat: null,
    lng: null,
    recommendedRank: 90,
    schedule: {
      kind: "check_official",
      summaryText: "宿泊施設等のため日帰り入浴可否・時間は要事前確認",
      lastEntryText: null,
      holidayNote: null,
      irregularNote: null,
    },
    hasMorningBath: false,
    openLateNight: false,
    latestLastEntryMinutes: null,
  };
}

export interface BuildSentouDatasetInput {
  bathRecords: RawBathRecord[];
  holidays: Map<string, string>;
  generatedAt: string;
}

/**
 * 取得済みの松本市公衆浴場台帳・内閣府祝日データ・キュレーション辞書から
 * 検証済みデータセットを構築する。
 */
export function buildSentouDataset(
  input: BuildSentouDatasetInput,
): SentouDataset {
  const byId = new Map(input.bathRecords.map((r) => [r.id, r]));

  for (const [recordId, spec] of Object.entries(BATH_CURATIONS)) {
    const raw = byId.get(recordId);
    if (!raw) {
      throw new Error(
        `Curated bath record id=${recordId} (${spec.expectedRegistryName}) not found in matsumoto_bath.txt`,
      );
    }
    if (
      normalizeForMatch(raw.registryName) !==
      normalizeForMatch(spec.expectedRegistryName)
    ) {
      throw new Error(
        `Registry name mismatch for id=${recordId}: expected="${spec.expectedRegistryName}", actual="${raw.registryName}"`,
      );
    }
  }

  const facilities: BathFacility[] = input.bathRecords.map((raw) => {
    const spec = BATH_CURATIONS[raw.id];
    if (!spec) {
      return buildFallbackFacility(raw);
    }

    const inferred = inferAreaFromAddress(raw.address, raw.postalCode);
    const displayName = spec.displayName ?? raw.registryName;
    const flags = deriveScheduleFlags(spec.schedule);

    return {
      id: spec.id,
      sourceRecordId: raw.id,
      name: displayName,
      registryName: raw.registryName,
      permitCategory: raw.permitCategory,
      permittedAt: raw.permittedAt,
      permitNumber: raw.permitNumber,
      operator: raw.operator,
      postalCode: raw.postalCode,
      address: raw.address,
      subArea: spec.subAreaOverride ?? inferred.subArea,
      areaGroup: spec.areaGroupOverride ?? inferred.areaGroup,
      accessCategory: spec.accessCategory,
      accessLabel: ACCESS_CATEGORY_LABELS[spec.accessCategory],
      accessNote: spec.accessNote,
      facilityType: spec.facilityType,
      waterType: spec.waterType,
      hasSauna: spec.hasSauna,
      hasRotenburo: spec.hasRotenburo,
      feeSummary: spec.feeSummary,
      phone: spec.phone,
      officialUrl: spec.officialUrl,
      mapQuery: `${displayName} ${raw.address}`,
      lat: spec.lat,
      lng: spec.lng,
      recommendedRank: spec.recommendedRank,
      schedule: spec.schedule,
      hasMorningBath: flags.hasMorningBath,
      openLateNight: flags.openLateNight,
      latestLastEntryMinutes: flags.latestLastEntryMinutes,
    };
  });

  facilities.sort((a, b) => {
    if (a.recommendedRank !== b.recommendedRank) {
      return a.recommendedRank - b.recommendedRank;
    }
    return a.name.localeCompare(b.name, "ja");
  });

  const holidaysRecord = Object.fromEntries(
    Array.from(input.holidays.entries()).sort(([a], [b]) => a.localeCompare(b)),
  );

  const publicDropInCount = facilities.filter(
    (f) => f.accessCategory === "public_drop_in",
  ).length;
  const dayUseOrReservedCount = facilities.filter(
    (f) =>
      f.accessCategory === "day_use_inn" ||
      f.accessCategory === "reservation_required",
  ).length;
  const restrictedCount = facilities.filter(
    (f) =>
      f.accessCategory === "local_only" ||
      f.accessCategory === "eligible_only" ||
      f.accessCategory === "members_only" ||
      f.accessCategory === "guests_only",
  ).length;
  const ippanSentouCount = facilities.filter(
    (f) => f.permitCategory === "一般公衆浴場",
  ).length;
  const localOnlyCount = facilities.filter(
    (f) => f.accessCategory === "local_only",
  ).length;

  const dataset: SentouDataset = {
    version: "1.0",
    generatedAt: input.generatedAt,
    site: "https://modata.raichonomichi.net",
    notice:
      "本ページの営業状況・最終受付表示は、松本市オープンデータ「生活衛生施設データ（公衆浴場）」と各施設公式案内・内閣府「国民の祝日」CSVをもとに整理した参考目安です。臨時休業・設備点検・冬季閉鎖・燃料事情・混雑による日帰り制限や料金改定の最新情報は、お出かけ前に必ず各施設公式案内・電話等でご確認ください。",
    holidays: holidaysRecord,
    officialLinks: { ...OFFICIAL_BATH_LINKS },
    sources: {
      baths: {
        name: "松本市の生活衛生施設データ（公衆浴場・matsumoto_bath）",
        sourceUrl: "http://linkdata.org/work/rdf1s8757i",
        license: "CC BY 3.0",
        attribution:
          "松本市　DX推進本部「松本市の生活衛生施設データ（matsumoto_bath）」（クリエイティブ・コモンズ・ライセンス 表示 3.0 非移植）",
      },
      holidays: {
        name: "国民の祝日（内閣府 CSV）",
        sourceUrl: "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv",
        license: "政府標準利用規約2.0",
        attribution: "内閣府「国民の祝日について（syukujitsu.csv）」",
      },
    },
    counts: {
      total: facilities.length,
      publicDropIn: publicDropInCount,
      dayUseOrReserved: dayUseOrReservedCount,
      restricted: restrictedCount,
      ippanSentou: ippanSentouCount,
      localOnly: localOnlyCount,
    },
    count: facilities.length,
    facilities,
  };

  return sentouDatasetSchema.parse(dataset);
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.arrayBuffer();
}

export async function runSentouPipeline(): Promise<void> {
  console.log("Fetching Matsumoto Bath Registry TSV and CAO Holidays CSV...");
  const [bathBuffer, holidaysBuffer] = await Promise.all([
    fetchBuffer(BATH_REGISTRY_URL),
    fetchBuffer(CAO_HOLIDAYS_CSV_URL),
  ]);

  const bathTsv = new TextDecoder("utf-8").decode(bathBuffer);
  const parsedBath = parseLinkDataBathTsv(bathTsv);
  const holidays = parseCaoHolidaysCsv(holidaysBuffer, 2026, 2027);
  const generatedAt = new Date().toISOString().slice(0, 10);

  const dataset = buildSentouDataset({
    bathRecords: parsedBath.records,
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
    `Generated ${path.relative(process.cwd(), OUTPUT_PATH)} (${dataset.count} facilities: publicDropIn=${dataset.counts.publicDropIn}, dayUseOrReserved=${dataset.counts.dayUseOrReserved}, restricted=${dataset.counts.restricted})`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
  await runSentouPipeline();
}
