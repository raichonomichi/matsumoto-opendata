import { type BranchId, branchIds } from "../../src/lib/library-usage-schema";

export interface LinkDataBranchRow {
  branchId: BranchId;
  openDays: number;
  holdingsTotal: number;
  registeredTotal: number;
  registeredChildren: number;
  loansTotal: number;
  loansChildren: number;
  referenceCount: number;
  reservationsTotal: number;
  groupLoansTotal: number | null;
}

export interface MatsumotoStatsBranchYear {
  branchId: BranchId;
  fiscalYear: number;
  openDays: number | null;
  holdingsTotal: number;
  registeredTotal: number;
  loansTotal: number;
  referenceCount: number;
  reservationsTotal: number;
}

export interface MatsumotoStatsServicePointYear {
  id: "murai-sp" | "shiga-sp";
  name: string;
  fiscalYear: number;
  openDays: number;
  loansTotal: number;
  reservationsTotal: number;
}

export interface MatsumotoStatsTotalYear {
  fiscalYear: number;
  holdingsTotal: number;
  registeredTotal: number;
  loansTotal: number;
  referenceCount: number;
  reservationsTotal: number;
}

export interface MatsumotoStatsClosure {
  fiscalYears: number[];
  branchLabel: string;
  period: string;
  reason: string;
}

export interface ParsedMatsumotoStatsSheet {
  branches: MatsumotoStatsBranchYear[];
  servicePoints: MatsumotoStatsServicePointYear[];
  totals: MatsumotoStatsTotalYear[];
  groupLoansByYear: Map<number, number>;
  closures: MatsumotoStatsClosure[];
}

export interface NaganoMaterialBranchRow {
  branchId: BranchId;
  holdingsBooks: number;
  holdingsBooksChildren: number;
}

export interface NaganoLoanBranchRow {
  branchId: BranchId;
  registeredTotal: number;
  registeredChildren: number | null;
  loansTotal: number;
  loansChildren: number | null;
  groupLoansTotal: number | null;
  visitors: number | null;
  population: number | null;
}

const BRANCH_ALIAS_MAP: ReadonlyArray<[string, BranchId]> = [
  ["中央", "chuo"],
  ["南部", "nanbu"],
  ["あがたの森", "agata"],
  ["あがた", "agata"],
  ["鎌田", "kamata"],
  ["西部", "kamata"],
  ["寿台", "kotobukidai"],
  ["本郷", "hongo"],
  ["中山", "nakayama"],
  ["島内", "shimauchi"],
  ["空港", "kuko"],
  ["梓川", "azusagawa"],
  ["波田", "hata"],
];

/**
 * 統計表の館名表記ゆれ（全角・分館表記・旧西部図書館等）を正規の BranchId へ変換する。
 */
export function normalizeBranchId(rawName: string): BranchId | null {
  const cleaned = rawName
    .normalize("NFKC")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, "")
    .replace(/^松本市/, "")
    .replace(/(市立)?図書館$/, "")
    .replace(/文庫$/, "")
    .trim();

  if (!cleaned) return null;

  for (const [alias, id] of BRANCH_ALIAS_MAP) {
    if (cleaned === alias || cleaned.startsWith(alias)) {
      return id;
    }
  }
  return null;
}

export function parseIntCell(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw
    .normalize("NFKC")
    .replace(/[,、\s]/g, "")
    .trim();
  if (
    !cleaned ||
    cleaned === "-" ||
    cleaned === "…" ||
    cleaned === "..." ||
    cleaned === "－"
  ) {
    return null;
  }
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

/**
 * 「松本市の統計」和暦年度セル（30, 元, 2〜7 等）を西暦年度へ変換する。
 */
export function parseMatsumotoStatsFiscalYear(raw: string): number | null {
  const norm = raw.normalize("NFKC").replace(/年度$/, "").trim();
  if (norm === "元") return 2019;
  if (!/^\d+$/.test(norm)) return null;
  const n = Number.parseInt(norm, 10);
  if (n >= 25 && n <= 31) return 1988 + n; // H25..H31
  if (n >= 2 && n <= 20) return 2018 + n; // R2..R20
  return null;
}

/**
 * LinkData「松本市 図書館利用状況（H25〜H30）」TSV をパースする。
 */
export function parseLinkDataLibraryTsv(tsvText: string): LinkDataBranchRow[] {
  const lines = tsvText.replace(/^\uFEFF/, "").split(/\r?\n/);
  const rows: LinkDataBranchRow[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("\t");
    if (!/^\d+$/.test((cols[0] ?? "").trim())) continue;

    const branchId = normalizeBranchId(cols[1] ?? "");
    if (!branchId) {
      throw new Error(`Unknown branch in LinkData TSV: ${cols[1]}`);
    }

    rows.push({
      branchId,
      openDays: parseIntCell(cols[2]) ?? 0,
      holdingsTotal: parseIntCell(cols[3]) ?? 0,
      registeredTotal: parseIntCell(cols[4]) ?? 0,
      registeredChildren: parseIntCell(cols[5]) ?? 0,
      loansTotal: parseIntCell(cols[6]) ?? 0,
      loansChildren: parseIntCell(cols[7]) ?? 0,
      referenceCount: parseIntCell(cols[8]) ?? 0,
      reservationsTotal: parseIntCell(cols[9]) ?? 0,
      groupLoansTotal: parseIntCell(cols[10]),
    });
  }

  return rows;
}

/**
 * 松本市の統計「0343/0344 市立図書館利用状況」シートをパースする。
 */
export function parseMatsumotoStatsLibrarySheet(
  rows: Array<Record<string, string>>,
): ParsedMatsumotoStatsSheet {
  const branches: MatsumotoStatsBranchYear[] = [];
  const servicePoints: MatsumotoStatsServicePointYear[] = [];
  const totals: MatsumotoStatsTotalYear[] = [];
  const groupLoansByYear = new Map<number, number>();
  const closures: MatsumotoStatsClosure[] = [];

  type SectionMode =
    | "none"
    | "branch"
    | "sp_murai"
    | "sp_shiga"
    | "total"
    | "group"
    | "closures";

  let mode: SectionMode = "none";
  let currentBranchId: BranchId | null = null;
  let groupYearCols: Array<{ fiscalYear: number; countCol: string }> = [];

  for (const row of rows) {
    const aRaw = (row.A ?? "").trim();
    const aNorm = aRaw.normalize("NFKC").replace(/\s+/g, "");

    if (/^[（(]\d+[）)]/.test(aNorm)) {
      if (aNorm.includes("合計")) {
        mode = "total";
        currentBranchId = null;
      } else if (aNorm.includes("団体貸出")) {
        mode = "group";
        currentBranchId = null;
        groupYearCols = [];
      } else if (aNorm.includes("臨時閉館")) {
        mode = "closures";
        currentBranchId = null;
      } else if (aNorm.includes("村井駅")) {
        mode = "sp_murai";
        currentBranchId = null;
      } else if (aNorm.includes("四賀")) {
        mode = "sp_shiga";
        currentBranchId = null;
      } else {
        const branchId = normalizeBranchId(aRaw.replace(/^[（(]\d+[）)]/, ""));
        if (!branchId) {
          throw new Error(`Unknown branch section header: ${aRaw}`);
        }
        mode = "branch";
        currentBranchId = branchId;
      }
      continue;
    }

    if (mode === "group") {
      if (aNorm === "団体名") {
        groupYearCols = [];
        const pairs: Array<[string, string]> = [
          ["B", "C"],
          ["D", "E"],
          ["F", "G"],
        ];
        for (const [labelCol, countCol] of pairs) {
          const fy = parseMatsumotoStatsFiscalYear(row[labelCol] ?? "");
          if (fy !== null) {
            groupYearCols.push({ fiscalYear: fy, countCol });
          }
        }
      } else if (aNorm === "計") {
        for (const { fiscalYear, countCol } of groupYearCols) {
          const val = parseIntCell(row[countCol]);
          if (val !== null) {
            groupLoansByYear.set(fiscalYear, val);
          }
        }
      }
      continue;
    }

    if (mode === "closures") {
      if (!aNorm || aNorm === "年度") continue;
      const years = aNorm
        .split(/[、,]/)
        .map((token) => parseMatsumotoStatsFiscalYear(token))
        .filter((y): y is number => y !== null);
      if (years.length > 0 && row.B) {
        closures.push({
          fiscalYears: years,
          branchLabel: row.B,
          period: row.D ?? "",
          reason: row.F ?? "",
        });
      }
      continue;
    }

    const fiscalYear = parseMatsumotoStatsFiscalYear(aRaw);
    if (fiscalYear === null) continue;

    if (mode === "branch" && currentBranchId) {
      branches.push({
        branchId: currentBranchId,
        fiscalYear,
        openDays: parseIntCell(row.B),
        holdingsTotal: parseIntCell(row.C) ?? 0,
        registeredTotal: parseIntCell(row.D) ?? 0,
        loansTotal: parseIntCell(row.E) ?? 0,
        referenceCount: parseIntCell(row.F) ?? 0,
        reservationsTotal: parseIntCell(row.G) ?? 0,
      });
    } else if (mode === "sp_murai" || mode === "sp_shiga") {
      servicePoints.push({
        id: mode === "sp_murai" ? "murai-sp" : "shiga-sp",
        name:
          mode === "sp_murai"
            ? "村井駅サービスポイント"
            : "四賀公民館図書室サービスポイント",
        fiscalYear,
        openDays: parseIntCell(row.B) ?? 0,
        loansTotal: parseIntCell(row.E) ?? 0,
        reservationsTotal: parseIntCell(row.G) ?? 0,
      });
    } else if (mode === "total") {
      totals.push({
        fiscalYear,
        holdingsTotal: parseIntCell(row.C) ?? 0,
        registeredTotal: parseIntCell(row.D) ?? 0,
        loansTotal: parseIntCell(row.E) ?? 0,
        referenceCount: parseIntCell(row.F) ?? 0,
        reservationsTotal: parseIntCell(row.G) ?? 0,
      });
    }
  }

  return {
    branches,
    servicePoints,
    totals,
    groupLoansByYear,
    closures,
  };
}

function extractMatsumotoRowsFromNaganoSheet(
  rows: Array<Record<string, string>>,
): Array<{ branchId: BranchId; row: Record<string, string> }> {
  const result: Array<{ branchId: BranchId; row: Record<string, string> }> = [];
  let collecting = false;

  for (const row of rows) {
    const colA = (row.A ?? "").trim();
    const colB = (row.B ?? "").trim();

    if (colA.includes("松本市中央")) {
      collecting = true;
    } else if (collecting && colA && !colA.includes("松本")) {
      break;
    }

    if (!collecting) continue;

    const rawName = colA || colB;
    const branchId = normalizeBranchId(rawName);
    if (!branchId) {
      throw new Error(
        `Unexpected Matsumoto branch row in Nagano sheet: ${rawName}`,
      );
    }
    result.push({ branchId, row });
  }

  if (result.length !== branchIds.length) {
    throw new Error(
      `Expected ${branchIds.length} Matsumoto rows in Nagano sheet, found ${result.length}`,
    );
  }
  return result;
}

/**
 * 長野県公共図書館概況「5.資料」シートから松本市11館の図書蔵書数を抽出する。
 */
export function parseNaganoSurveyMaterialSheet(
  rows: Array<Record<string, string>>,
): NaganoMaterialBranchRow[] {
  return extractMatsumotoRowsFromNaganoSheet(rows).map(({ branchId, row }) => ({
    branchId,
    holdingsBooks: parseIntCell(row.C) ?? 0,
    holdingsBooksChildren: parseIntCell(row.D) ?? 0,
  }));
}

/**
 * 長野県公共図書館概況「8.貸出」シートから松本市11館の登録・貸出・来館・奉仕対象人口を抽出する。
 */
export function parseNaganoSurveyLoanSheet(
  rows: Array<Record<string, string>>,
): NaganoLoanBranchRow[] {
  return extractMatsumotoRowsFromNaganoSheet(rows).map(({ branchId, row }) => {
    let population: number | null = null;
    for (const col of ["T", "V", "W"]) {
      const candidate = parseIntCell(row[col]);
      if (candidate !== null && candidate >= 100_000) {
        population = candidate;
        break;
      }
    }

    return {
      branchId,
      registeredTotal: parseIntCell(row.C) ?? 0,
      registeredChildren: parseIntCell(row.E),
      loansTotal: parseIntCell(row.I) ?? 0,
      loansChildren: parseIntCell(row.K),
      groupLoansTotal: parseIntCell(row.Q),
      visitors: parseIntCell(row.S),
      population,
    };
  });
}

/**
 * 長野県公共図書館概況「3.奉仕対象人口・施設」（令和8年度版）から松本市の奉仕対象人口を抽出する。
 */
export function parseNaganoSurveyPopulationSheet(
  rows: Array<Record<string, string>>,
): number {
  for (const row of rows) {
    if ((row.A ?? "").includes("松本市中央")) {
      const pop = parseIntCell(row.C);
      if (pop !== null && pop >= 100_000) {
        return pop;
      }
    }
  }
  throw new Error("Matsumoto population not found in Nagano sheet 3");
}
