import type { MonthlyWeather } from "../../src/lib/matsumoto-castle-schema";

export interface RawEventRecord {
  id: string;
  name: string;
  kana: string;
  category: string;
  periodText: string;
  periodNote: string;
  venue: string;
  address: string;
  description: string;
  contactName: string;
  contactPhone: string;
  url: string;
  remarks: string;
}

export interface ParsedLinkDataEvents {
  metadata: {
    attributionName: string;
    licenseUrl: string;
    downloadFrom: string;
  };
  records: RawEventRecord[];
}

export interface ParsedWeatherMonth {
  month: number;
  weather: MonthlyWeather;
}

const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

/**
 * Excel 1900日付システムのシリアル値（例: 46145 -> 2026-05-03）を UTC 基準で YYYY-MM-DD に変換する。
 */
export function excelSerialToYmd(serial: number): string {
  if (!Number.isFinite(serial) || serial < 1) {
    throw new Error(`Invalid Excel serial date: ${serial}`);
  }
  const dt = new Date(EXCEL_EPOCH_UTC_MS + Math.trunc(serial) * MS_PER_DAY);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * LinkData 等に含まれる全角文字・コロン抜け・相対パス・スキーム欠落URLを安全な http/https URL へ正規化する。
 */
export function normalizeEventUrl(raw: string): string | null {
  const nfkc = raw.normalize("NFKC").replace(/\s+/g, "").replace(/。$/, "");
  if (!nfkc) return null;

  if (/^(javascript|data|vbscript):/i.test(nfkc)) {
    return null;
  }

  let candidate = nfkc
    .replace(/^https\/\//i, "https://")
    .replace(/^http\/\//i, "http://");

  if (candidate.startsWith("/")) {
    candidate = `https://www.city.matsumoto.nagano.jp${candidate}`;
  } else if (!/^https?:\/\//i.test(candidate)) {
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(candidate)) {
      return null;
    }
    if (candidate === "matsumoto-castle.jp") {
      candidate = "https://www.matsumoto-castle.jp/";
    } else {
      candidate = `https://${candidate}`;
    }
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!parsed.hostname.includes(".")) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export function parseLinkDataEventsTsv(tsvText: string): ParsedLinkDataEvents {
  const lines = tsvText.replace(/^\uFEFF/, "").split(/\r?\n/);
  const metadata = {
    attributionName: "松本市　DX推進本部",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/deed.ja",
    downloadFrom: "http://linkdata.org/work/rdf1s9164i",
  };
  const records: RawEventRecord[] = [];

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
    const id = (cols[0] ?? "").trim();
    if (!/^\d+$/.test(id)) continue;

    records.push({
      id,
      name: (cols[1] ?? "").trim(),
      kana: (cols[2] ?? "").trim(),
      category: (cols[3] ?? "").trim(),
      periodText: (cols[4] ?? "").trim(),
      periodNote: (cols[5] ?? "").trim(),
      venue: (cols[6] ?? "").trim(),
      address: (cols[7] ?? "").trim(),
      description: (cols[8] ?? "").trim(),
      contactName: (cols[9] ?? "").trim(),
      contactPhone: (cols[10] ?? "").trim(),
      url: (cols[11] ?? "").trim(),
      remarks: (cols[12] ?? "").trim(),
    });
  }

  return { metadata, records };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * LinkData「松本市 気象実況（rdf1s8695i）」から指定期間の月別平均値を算出する。
 */
export function parseLinkDataWeatherTsv(
  tsvText: string,
  startYear = 2014,
  endYear = 2023,
): ParsedWeatherMonth[] {
  const lines = tsvText.replace(/^\uFEFF/, "").split(/\r?\n/);
  const buckets = new Map<
    number,
    {
      meanTemp: number[];
      maxTemp: number[];
      minTemp: number[];
      precip: number[];
      sunshine: number[];
    }
  >();

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("\t");
    if (cols.length < 12) continue;
    const timeCode = (cols[1] ?? "").trim();
    if (!/^\d{10}$/.test(timeCode)) continue;

    const year = Number.parseInt(timeCode.slice(0, 4), 10);
    const month = Number.parseInt(timeCode.slice(8, 10), 10);
    if (year < startYear || year > endYear || month < 1 || month > 12) {
      continue;
    }

    const meanTemp = Number.parseFloat(cols[2]);
    const maxTemp = Number.parseFloat(cols[3]);
    const minTemp = Number.parseFloat(cols[4]);
    const precip = Number.parseFloat(cols[5]);
    const sunshine = Number.parseFloat(cols[11]);

    if (
      [meanTemp, maxTemp, minTemp, precip, sunshine].some((v) =>
        Number.isNaN(v),
      )
    ) {
      continue;
    }

    let bucket = buckets.get(month);
    if (!bucket) {
      bucket = {
        meanTemp: [],
        maxTemp: [],
        minTemp: [],
        precip: [],
        sunshine: [],
      };
      buckets.set(month, bucket);
    }
    bucket.meanTemp.push(meanTemp);
    bucket.maxTemp.push(maxTemp);
    bucket.minTemp.push(minTemp);
    bucket.precip.push(precip);
    bucket.sunshine.push(sunshine);
  }

  const avg = (arr: number[]): number =>
    round1(arr.reduce((sum, v) => sum + v, 0) / arr.length);

  const result: ParsedWeatherMonth[] = [];
  for (let month = 1; month <= 12; month++) {
    const bucket = buckets.get(month);
    if (!bucket || bucket.meanTemp.length === 0) {
      throw new Error(
        `Missing weather observations for month ${month} (${startYear}-${endYear})`,
      );
    }
    result.push({
      month,
      weather: {
        meanTempC: avg(bucket.meanTemp),
        maxTempC: avg(bucket.maxTemp),
        minTempC: avg(bucket.minTemp),
        precipitationMm: avg(bucket.precip),
        sunshineHours: avg(bucket.sunshine),
      },
    });
  }

  return result;
}

/**
 * 内閣府「国民の祝日 CSV（Shift_JIS）」をパースし、対象年範囲の Map<YYYY-MM-DD, 祝日名> を返す。
 */
export function parseCaoHolidaysCsv(
  input: string | ArrayBuffer | Uint8Array,
  startYear = 2026,
  endYear = 2027,
): Map<string, string> {
  const text =
    typeof input === "string"
      ? input
      : new TextDecoder("shift_jis").decode(input);

  const holidays = new Map<string, string>();
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const commaIdx = line.indexOf(",");
    if (commaIdx === -1) continue;

    const datePart = line.slice(0, commaIdx).trim();
    const namePart = line.slice(commaIdx + 1).trim();
    const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(datePart);
    if (!match || !namePart) continue;

    const year = Number.parseInt(match[1], 10);
    if (year < startYear || year > endYear) continue;

    const month = match[2].padStart(2, "0");
    const day = match[3].padStart(2, "0");
    holidays.set(`${year}-${month}-${day}`, namePart);
  }

  return holidays;
}
