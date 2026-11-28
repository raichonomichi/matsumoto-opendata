import type {
  DailyTemperatures,
  WeatherHistory,
} from "../src/lib/matsumoto-weather-history";
import { decodeCsvBuffer, parseCsvMatrix } from "./csv";

type Quality = "0" | "1" | "2" | "4" | "5" | "8";
type ObservationRows = Record<string, DailyTemperatures | null>;

function readTemperature(value: string, quality: Quality, date: string) {
  if (quality !== "8" && quality !== "5") return null;
  if (!/^-?\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value))) {
    throw new Error(`${date}: 気温の数値が不正です。`);
  }
  return Number(value);
}

function readQuality(value: string | undefined, date: string): Quality {
  switch (value) {
    case "0":
    case "1":
    case "2":
    case "4":
    case "5":
    case "8":
      return value;
    default:
      throw new Error(
        `${date}: 気象庁CSVの品質情報がありません、または不正です。`,
      );
  }
}

function parseDate(value: string): string {
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(value);
  if (!match) throw new Error(`気象庁CSVの日付が不正です: ${value}`);
  const [, year, month, day] = match;
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const timestamp = Date.parse(date);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`気象庁CSVの日付が不正です: ${value}`);
  }
  return date;
}

export function parseMatsumotoWeatherCsv(
  input: Uint8Array | string,
): ObservationRows {
  const text = typeof input === "string" ? input : decodeCsvBuffer(input);
  const rows = parseCsvMatrix(text).map((row) =>
    row.map((cell) => cell.trim()),
  );
  const header = rows.findIndex((row) => row[0] === "年月日");
  const stations = rows[header - 1];
  const labels = rows[header];
  const quality = rows[header + 1];
  if (!stations || !labels || !quality || header < 1) {
    throw new Error("気象庁の日付リテラル形式の日別CSVを指定してください。");
  }
  const min = labels.findIndex((label) =>
    /^(?:日)?最低気温\(°C\)$/.test(label.normalize("NFKC")),
  );
  const max = labels.findIndex((label) =>
    /^(?:日)?最高気温\(°C\)$/.test(label.normalize("NFKC")),
  );
  if (
    min < 1 ||
    max < 1 ||
    stations.slice(1).some((station) => station !== "松本") ||
    stations[min] !== "松本" ||
    stations[max] !== "松本" ||
    quality[min + 1] !== "品質情報" ||
    quality[max + 1] !== "品質情報"
  ) {
    throw new Error(
      "松本の最低・最高気温と品質情報があるCSVを指定してください。",
    );
  }

  const observations: ObservationRows = {};
  for (const row of rows.slice(header + 2)) {
    const date = parseDate(row[0] ?? "");
    if (Object.hasOwn(observations, date)) {
      throw new Error(`${date}: 気象庁CSVで観測日が重複しています。`);
    }
    const minQuality = readQuality(row[min + 1], date);
    const maxQuality = readQuality(row[max + 1], date);
    const minC = readTemperature(row[min] ?? "", minQuality, date);
    const maxC = readTemperature(row[max] ?? "", maxQuality, date);
    if (minC === null || maxC === null) {
      observations[date] = null;
      continue;
    }
    if (minC > maxC) {
      throw new Error(`${date}: 最低気温が最高気温を超えています。`);
    }
    observations[date] =
      minQuality === "5" || maxQuality === "5"
        ? { minC, maxC, provisional: true }
        : { minC, maxC };
  }
  if (Object.keys(observations).length === 0) {
    throw new Error("気象庁CSVに観測日がありません。");
  }
  return observations;
}

export function mergeWeatherHistory(
  existing: WeatherHistory,
  imports: readonly ObservationRows[],
): ObservationRows {
  const merged = Object.assign({}, existing, ...imports);
  return Object.fromEntries(
    Object.keys(merged)
      .sort()
      .map((date) => [date, merged[date] ?? null]),
  );
}
