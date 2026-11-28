import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type FreeWifiDataset,
  freeWifiDatasetSchema,
  type WifiSpot,
} from "../src/lib/free-wifi-schema";
import {
  AGATA_NO_MORI_SUPPLEMENT_ID,
  inferAreaGroup,
  inferSsidSystem,
  OFFICIAL_WIFI_LINKS,
  SPOT_CURATIONS,
  type SpotOverride,
  SSID_GUIDES,
} from "./free-wifi/curation";
import {
  parsePublicFacilitiesCsv,
  parseWifiCsv,
  type RawFacilityRecord,
  type RawWifiRecord,
} from "./free-wifi/parsers";
import {
  deriveScheduleFlags,
  parseFacilitySchedule,
} from "./free-wifi/schedule-parser";
import { parseCaoHolidaysCsv } from "./matsumoto-castle/parsers";

const WIFI_CSV_URL =
  "https://www2.wagmap.jp/matsumoto/matsumoto/opendata/map_3/CSV/opendata_32.csv";

const FACILITY_LAYER_IDS = [23, 24, 25, 26, 28, 29] as const;

const CAO_HOLIDAYS_CSV_URL =
  "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";

const OUTPUT_PATH = path.resolve("src/data/free-wifi.json");

function facilityLayerUrl(lid: number): string {
  return `https://www2.wagmap.jp/matsumoto/matsumoto/opendata/map_3/CSV/opendata_${lid}.csv`;
}

function normalizeJoinName(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, "").trim();
}

function extractParenParts(name: string): string[] {
  const norm = normalizeJoinName(name);
  const m = /^([^(（]+)[(（]([^)）]+)[)）]$/.exec(norm);
  if (!m) return [norm];
  return [m[1], m[2]];
}

function matchFacility(
  wifi: RawWifiRecord,
  override: SpotOverride | undefined,
  facilitiesByNumber: Map<string, RawFacilityRecord>,
  facilities: RawFacilityRecord[],
): RawFacilityRecord | null {
  if (override?.noFacilityJoin) {
    return null;
  }
  if (override?.facilityNumberOverride) {
    const matched = facilitiesByNumber.get(override.facilityNumberOverride);
    if (!matched) {
      throw new Error(
        `Facility override ${override.facilityNumberOverride} not found for Wi-Fi #${wifi.id} (${wifi.name})`,
      );
    }
    return matched;
  }

  const wifiNorm = normalizeJoinName(wifi.name);
  const wifiStripped = wifiNorm.replace(/^松本市/, "");

  // 1. 完全一致または「松本市」プレフィックス除去一致
  const exact = facilities.find((f) => {
    const fn = normalizeJoinName(f.name);
    return fn === wifiNorm || fn === wifiStripped;
  });
  if (exact) return exact;

  // 2. 括弧書きの両辺との完全一致（公民館名を優先）
  const parts = extractParenParts(wifi.name);
  const partMatches = facilities.filter((f) => {
    const fn = normalizeJoinName(f.name);
    return parts.some((p) => fn === p);
  });
  if (partMatches.length > 0) {
    if (wifi.name.includes("公民館")) {
      const kominkan = partMatches.find((f) => f.category === "公民館");
      if (kominkan) return kominkan;
    }
    return partMatches[0];
  }

  return null;
}

function sanitizeFallbackSlug(rawId: string): string {
  const clean = rawId
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `wifi-${clean || "spot"}`;
}

function buildSpotFromRaw(
  wifi: RawWifiRecord,
  facilitiesByNumber: Map<string, RawFacilityRecord>,
  facilities: RawFacilityRecord[],
): WifiSpot {
  const curation = SPOT_CURATIONS[wifi.id];
  const facility = matchFacility(
    wifi,
    curation,
    facilitiesByNumber,
    facilities,
  );

  const schedule =
    curation?.scheduleOverride ??
    (facility
      ? parseFacilitySchedule({
          openDaysRaw: facility.openDaysRaw,
          startRaw: facility.startRaw,
          endRaw: facility.endRaw,
          noteRaw: facility.noteRaw,
          facilityName: facility.name,
        })
      : {
          kind: "check_official",
          summaryText: "開館時間・利用可否は公式案内をご確認ください",
          holidayNote: null,
        });

  const flags = deriveScheduleFlags(schedule);
  const district =
    curation?.districtOverride ?? (facility?.district || "その他");
  const areaGroup = curation?.areaGroupOverride ?? inferAreaGroup(district);
  const category =
    curation?.categoryOverride ??
    (facility?.category || wifi.category || "公共施設");

  return {
    id: curation?.id ?? sanitizeFallbackSlug(wifi.id),
    sourceRecordId: wifi.id,
    facilityNumber: facility?.facilityNumber ?? null,
    name: curation?.displayName ?? wifi.name,
    facilityName: facility?.name ?? null,
    category,
    address: wifi.address || facility?.address || "松本市",
    district,
    areaGroup,
    lat: wifi.lat,
    lng: wifi.lng,
    phone: facility?.phone ?? null,
    ssid: wifi.ssid,
    ssidSystem: inferSsidSystem(wifi.ssid),
    apCount: wifi.apCount,
    indoorOutdoor: curation?.indoorOutdoor ?? "indoor",
    purposes: curation?.purposes ?? [],
    accessPolicy: curation?.accessPolicy ?? "check_official",
    powerAvailability: curation?.powerAvailability ?? "unknown",
    powerNote: curation?.powerNote ?? null,
    studyWorkNote: curation?.studyWorkNote ?? null,
    complexGroup: curation?.complexGroup ?? null,
    complexNote: curation?.complexNote ?? null,
    officialUrl: curation?.officialUrl ?? null,
    recommendedRank: curation?.recommendedRank ?? 50,
    schedule,
    openLate: flags.openLate,
    openMonday: flags.openMonday,
    openWeekend: flags.openWeekend,
    latestCloseMinutes: flags.latestCloseMinutes,
  };
}

export interface BuildFreeWifiDatasetInput {
  wifiRecords: RawWifiRecord[];
  facilities: RawFacilityRecord[];
  holidays: Map<string, string>;
  generatedAt: string;
}

/**
 * 取得済みの Wi-Fi CSV・公共施設 CSV・祝日 Map から検証済みデータセットを構築する。
 */
export function buildFreeWifiDataset(
  input: BuildFreeWifiDatasetInput,
): FreeWifiDataset {
  const facilitiesByNumber = new Map(
    input.facilities.map((f) => [f.facilityNumber, f]),
  );

  const spots: WifiSpot[] = input.wifiRecords.map((wifi) =>
    buildSpotFromRaw(wifi, facilitiesByNumber, input.facilities),
  );

  // 松本市図書館公式案内で全11館導入済みの「あがたの森図書館」が CSV に未掲載なら補完する
  const hasAgataNoMori = input.wifiRecords.some((w) =>
    w.name.includes("あがたの森図書館"),
  );
  if (!hasAgataNoMori) {
    const agataFacility = facilitiesByNumber.get("9");
    if (!agataFacility) {
      throw new Error(
        "Missing facilityNumber=9 (あがたの森図書館) in public facilities dataset",
      );
    }
    if (agataFacility.name !== "あがたの森図書館") {
      throw new Error(
        `Unexpected facilityNumber=9 name: ${agataFacility.name}`,
      );
    }
    if (agataFacility.lat === null || agataFacility.lng === null) {
      throw new Error("あがたの森図書館 is missing coordinates");
    }

    const supplementWifi: RawWifiRecord = {
      id: AGATA_NO_MORI_SUPPLEMENT_ID,
      name: "あがたの森図書館",
      address: agataFacility.address.startsWith("松本市")
        ? agataFacility.address
        : `松本市${agataFacility.address}`,
      ssid: "MLib-wifi",
      apCount: 1,
      lat: agataFacility.lat,
      lng: agataFacility.lng,
      category: "図書館",
    };
    spots.push(
      buildSpotFromRaw(supplementWifi, facilitiesByNumber, input.facilities),
    );
  }

  spots.sort((a, b) => {
    if (a.recommendedRank !== b.recommendedRank) {
      return a.recommendedRank - b.recommendedRank;
    }
    return a.name.localeCompare(b.name, "ja");
  });

  const holidaysRecord = Object.fromEntries(
    Array.from(input.holidays.entries()).sort(([a], [b]) => a.localeCompare(b)),
  );

  const dataset: FreeWifiDataset = {
    version: "1.0",
    generatedAt: input.generatedAt,
    site: "https://modata.raichonomichi.net",
    notice:
      "本ページの開館中・営業時間表示は、松本市オープンデータ（公衆無線LANアクセスポイント一覧・公共施設データ）および内閣府「国民の祝日」CSVをもとに自動判定した参考目安です。臨時休館・特別整理期間・貸館予約状況・電源席の空き状況・大規模改修に伴う休館（中央図書館は2027年7月〜2030年春予定）等の最新情報は、必ず各施設の公式案内をご確認ください。",
    holidays: holidaysRecord,
    ssidGuides: SSID_GUIDES,
    officialLinks: { ...OFFICIAL_WIFI_LINKS },
    sources: {
      wifi: {
        name: "松本市 公衆無線LANアクセスポイント一覧",
        sourceUrl:
          "https://www2.wagmap.jp/matsumoto/OpenDataDetail?lid=32&mids=23",
        license: "CC BY 4.0",
        attribution:
          "松本市 DX推進本部「公衆無線LANアクセスポイント」（松本デジタルまっぷ公開 / クリエイティブ・コモンズ・ライセンス 表示 4.0 国際）",
      },
      facilities: {
        name: "松本市 公共施設データ（松本デジタルまっぷ）",
        sourceUrl: "https://www2.wagmap.jp/matsumoto/OpenData",
        license: "CC BY 4.0",
        attribution:
          "松本市 DX推進本部「公共施設データ」（松本デジタルまっぷ公開 / クリエイティブ・コモンズ・ライセンス 表示 4.0 国際）",
      },
      holidays: {
        name: "国民の祝日（内閣府 CSV）",
        sourceUrl: "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv",
        license: "政府標準利用規約2.0",
        attribution: "内閣府「国民の祝日について（syukujitsu.csv）」",
      },
    },
    count: spots.length,
    spots,
  };

  return freeWifiDatasetSchema.parse(dataset);
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.arrayBuffer();
}

export async function runFreeWifiPipeline(): Promise<void> {
  console.log(
    "Fetching Matsumoto Public Wi-Fi CSV, 6 Facility layers, and CAO Holidays...",
  );
  const [wifiBuffer, holidaysBuffer, ...facilityBuffers] = await Promise.all([
    fetchBuffer(WIFI_CSV_URL),
    fetchBuffer(CAO_HOLIDAYS_CSV_URL),
    ...FACILITY_LAYER_IDS.map((lid) => fetchBuffer(facilityLayerUrl(lid))),
  ]);

  const wifiRecords = parseWifiCsv(wifiBuffer);
  const facilities = facilityBuffers.flatMap((buf) =>
    parsePublicFacilitiesCsv(buf),
  );
  const holidays = parseCaoHolidaysCsv(holidaysBuffer, 2026, 2027);
  const generatedAt = new Date().toISOString().slice(0, 10);

  const dataset = buildFreeWifiDataset({
    wifiRecords,
    facilities,
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
    `Generated ${path.relative(process.cwd(), OUTPUT_PATH)} (${dataset.count} spots)`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
  await runFreeWifiPipeline();
}
