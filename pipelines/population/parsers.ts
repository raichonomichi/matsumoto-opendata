import {
  POPULATION_AGE_COUNT,
  POPULATION_MAX_AGE,
  type PopulationSnapshot,
  populationSnapshotSchema,
} from "../../src/lib/population-schema";

export const POPULATION_WORK_SOURCES = [
  { year: 2017, eraLabel: "平成29年", workId: "rdf1s7430i" },
  { year: 2018, eraLabel: "平成30年", workId: "rdf1s7431i" },
  { year: 2019, eraLabel: "平成31年・令和元年", workId: "rdf1s7655i" },
  { year: 2020, eraLabel: "令和2年", workId: "rdf1s8186i" },
  { year: 2021, eraLabel: "令和3年", workId: "rdf1s8617i" },
  { year: 2022, eraLabel: "令和4年", workId: "rdf1s9071i" },
  { year: 2023, eraLabel: "令和5年", workId: "rdf1s9819i" },
  { year: 2024, eraLabel: "令和6年", workId: "rdf1s10137i" },
  { year: 2025, eraLabel: "令和7年", workId: "rdf1s10322i" },
  { year: 2026, eraLabel: "令和8年", workId: "rdf1s10410i" },
] as const;

export interface DiscoveredWorkMonthFile {
  ym: string;
  year: number;
  month: number;
  url: string;
}

/**
 * LinkData ワークページの HTML から、指定年の月別 TSV ダウンロード URL を抽出して年月昇順で返す。
 */
export function extractWorkMonthFiles(
  html: string,
  workId: string,
  expectedYear: number,
): DiscoveredWorkMonthFile[] {
  const pattern = new RegExp(
    `(?:https?:\\/\\/(?:[a-z0-9-]+\\.)?linkdata\\.org)?\\/download\\/${workId}\\/link\\/nenreibetsu_danjobetsu_(\\d{4})(\\d{2})\\.txt`,
    "gi",
  );

  const byYm = new Map<string, DiscoveredWorkMonthFile>();

  for (const match of html.matchAll(pattern)) {
    const rawUrl = match[0];
    const year = Number.parseInt(match[1] ?? "", 10);
    const month = Number.parseInt(match[2] ?? "", 10);
    if (year !== expectedYear) {
      throw new Error(
        `Unexpected year ${year} in ${workId} file URL ${rawUrl} (expected ${expectedYear})`,
      );
    }
    if (month < 1 || month > 12) {
      throw new Error(`Invalid month ${month} in ${workId} file URL ${rawUrl}`);
    }

    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const normalizedUrl = rawUrl.startsWith("/")
      ? `http://linkdata.org${rawUrl}`
      : rawUrl;

    if (!byYm.has(ym)) {
      byYm.set(ym, { ym, year, month, url: normalizedUrl });
    }
  }

  const results = Array.from(byYm.values()).sort((a, b) =>
    a.ym.localeCompare(b.ym),
  );

  if (results.length === 0) {
    throw new Error(
      `No monthly TSV download URLs found on LinkData work ${workId}`,
    );
  }

  return results;
}

function parseNonNegativeInt(raw: string, fieldName: string): number {
  const normalized = raw.normalize("NFKC").replace(/,/g, "").trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`Invalid integer for ${fieldName}: ${JSON.stringify(raw)}`);
  }
  return Number.parseInt(normalized, 10);
}

/**
 * LinkData の「年齢別男女別人口」月次 TSV をパース・整合性検証してスナップショットを返す。
 */
export function parsePopulationTsv(
  tsvText: string,
  expectedYm?: string,
): PopulationSnapshot {
  const lines = tsvText.replace(/^\uFEFF/, "").split(/\r?\n/);

  let ymFromMeta: string | null = null;
  let propertyHeader: string[] | null = null;

  const maleByAge = new Array<number>(POPULATION_AGE_COUNT).fill(-1);
  const femaleByAge = new Array<number>(POPULATION_AGE_COUNT).fill(-1);
  let rowCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    if (line.startsWith("#")) {
      const parts = line.split("\t").map((p) => p.trim());
      if (parts[0] === "#file_name" && parts[1]) {
        const fileMatch = /nenreibetsu_danjobetsu_(\d{4})(\d{2})/i.exec(
          parts[1],
        );
        if (fileMatch) {
          ymFromMeta = `${fileMatch[1]}-${fileMatch[2]}`;
        }
      } else if (parts[0] === "#property") {
        propertyHeader = parts.slice(1);
      }
      continue;
    }

    const cols = line.split("\t");
    if (cols.length < 5) {
      throw new Error(`Expected at least 5 TSV columns, got: ${line}`);
    }

    const ageStr = (cols[1] ?? "").normalize("NFKC").trim();
    const ageMatch = /^(\d+)歳$/.exec(ageStr);
    if (!ageMatch) {
      throw new Error(`Unexpected age label: ${JSON.stringify(cols[1])}`);
    }
    const age = Number.parseInt(ageMatch[1] ?? "", 10);
    if (age < 0 || age > POPULATION_MAX_AGE) {
      throw new Error(
        `Age out of supported range 0..${POPULATION_MAX_AGE}: ${age}`,
      );
    }
    if (maleByAge[age] !== -1) {
      throw new Error(`Duplicate age row for ${age}歳`);
    }

    const totalVal = parseNonNegativeInt(cols[2] ?? "", `${age}歳 総数`);
    const maleVal = parseNonNegativeInt(cols[3] ?? "", `${age}歳 男`);
    const femaleVal = parseNonNegativeInt(cols[4] ?? "", `${age}歳 女`);

    if (totalVal !== maleVal + femaleVal) {
      throw new Error(
        `Gender sum mismatch at ${age}歳: total=${totalVal}, male=${maleVal}, female=${femaleVal}`,
      );
    }

    maleByAge[age] = maleVal;
    femaleByAge[age] = femaleVal;
    rowCount += 1;
  }

  if (propertyHeader) {
    const [hAge, hTotal, hMale, hFemale] = propertyHeader;
    if (
      hAge !== "年齢" ||
      hTotal !== "総数" ||
      hMale !== "男" ||
      hFemale !== "女"
    ) {
      throw new Error(
        `Unexpected #property header: ${JSON.stringify(propertyHeader)}`,
      );
    }
  }

  const resolvedYm = expectedYm ?? ymFromMeta;
  if (!resolvedYm) {
    throw new Error("Unable to determine YYYY-MM from TSV #file_name");
  }
  if (expectedYm && ymFromMeta && expectedYm !== ymFromMeta) {
    throw new Error(
      `TSV #file_name ym mismatch: expected ${expectedYm}, got ${ymFromMeta}`,
    );
  }

  if (rowCount !== POPULATION_AGE_COUNT) {
    throw new Error(
      `Expected ${POPULATION_AGE_COUNT} age rows (0..${POPULATION_MAX_AGE}), got ${rowCount} (${resolvedYm})`,
    );
  }

  for (let age = 0; age <= POPULATION_MAX_AGE; age++) {
    if (maleByAge[age] < 0 || femaleByAge[age] < 0) {
      throw new Error(`Missing age ${age} in ${resolvedYm}`);
    }
  }

  const [yearStr, monthStr] = resolvedYm.split("-");
  const year = Number.parseInt(yearStr ?? "", 10);
  const month = Number.parseInt(monthStr ?? "", 10);
  const male = maleByAge.reduce((sum, count) => sum + count, 0);
  const female = femaleByAge.reduce((sum, count) => sum + count, 0);

  return populationSnapshotSchema.parse({
    ym: resolvedYm,
    year,
    month,
    total: male + female,
    male,
    female,
    maleByAge,
    femaleByAge,
  });
}
