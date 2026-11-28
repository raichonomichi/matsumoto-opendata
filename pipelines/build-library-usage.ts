import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type AnnualRecord,
  type BranchId,
  type BranchYearMetrics,
  branchIds,
  type LibraryUsageDataset,
  libraryUsageDatasetSchema,
  type ServicePointYearMetrics,
} from "../src/lib/library-usage-schema";
import {
  AGE_GROUP_SNAPSHOTS,
  ANNUAL_ERA_LABELS,
  BRANCH_EXPANSION_HISTORY,
  BRANCH_PROFILES,
  DECADE_MILESTONES,
  DIGITAL_LIBRARY_HISTORY,
  FY2024_SERVICE_POINT_DETAILS,
} from "./library-usage/historical-and-age-data";
import {
  type LinkDataBranchRow,
  type NaganoLoanBranchRow,
  type NaganoMaterialBranchRow,
  type ParsedMatsumotoStatsSheet,
  parseLinkDataLibraryTsv,
  parseMatsumotoStatsLibrarySheet,
  parseNaganoSurveyLoanSheet,
  parseNaganoSurveyMaterialSheet,
  parseNaganoSurveyPopulationSheet,
} from "./library-usage/parsers";
import { readXlsxSheets } from "./library-usage/xlsx-reader";

const OUTPUT_PATH = path.resolve("src/data/library-usage.json");

const LINKDATA_URLS: Array<{ fiscalYear: number; url: string }> = [
  {
    fiscalYear: 2013,
    url: "http://linkdata.org/download/rdf1s7819i/link/H25_tosyokan_riyoujoukyou.txt",
  },
  {
    fiscalYear: 2014,
    url: "http://linkdata.org/download/rdf1s7819i/link/H26_tosyokan_riyoujoukyou.txt",
  },
  {
    fiscalYear: 2015,
    url: "http://linkdata.org/download/rdf1s7819i/link/H27_tosyokan_riyoujoukyou.txt",
  },
  {
    fiscalYear: 2016,
    url: "http://linkdata.org/download/rdf1s7819i/link/H28_tosyokan_riyoujoukyou.txt",
  },
  {
    fiscalYear: 2017,
    url: "http://linkdata.org/download/rdf1s7819i/link/H29_tosyokan_riyoujoukyou.txt",
  },
  {
    fiscalYear: 2018,
    url: "http://linkdata.org/download/rdf1s7819i/link/H30_tosyokan_riyoujoukyou.txt",
  },
];

// 古い版→新しい版の順に適用し、数値改訂（例: H30島内図書館蔵書数）があれば最新版を正とする
const MATSUMOTO_STATS_URLS: Array<{ edition: string; url: string }> = [
  {
    edition: "R3版",
    url: "https://www.city.matsumoto.nagano.jp/uploaded/attachment/68139.xlsx",
  },
  {
    edition: "R4版",
    url: "https://www.city.matsumoto.nagano.jp/uploaded/attachment/68143.xlsx",
  },
  {
    edition: "R5版",
    url: "https://www.city.matsumoto.nagano.jp/uploaded/attachment/81017.xlsx",
  },
  {
    edition: "R6版",
    url: "https://www.city.matsumoto.nagano.jp/uploaded/attachment/100190.xlsx",
  },
  {
    edition: "R7版",
    url: "https://www.city.matsumoto.nagano.jp/uploaded/attachment/122475.xlsx",
  },
];

const NAGANO_SURVEY_URLS: Array<{
  fiscalYear: number;
  materialsUrl: string;
  loansUrl: string;
}> = [
  {
    fiscalYear: 2013,
    materialsUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/426/h26-5.xlsx",
    loansUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/426/h26-8.xlsx",
  },
  {
    fiscalYear: 2014,
    materialsUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/426/h27gaikyo5.xlsx",
    loansUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/426/h27gaikyo8.xlsx",
  },
  {
    fiscalYear: 2015,
    materialsUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/426/h28gaikyo5.xlsx",
    loansUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/426/h28gaikyo8.xlsx",
  },
  {
    fiscalYear: 2016,
    materialsUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/426/h29gaikyo5a.xlsx",
    loansUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/426/h29gaikyo8.xlsx",
  },
  {
    fiscalYear: 2017,
    materialsUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/426/h30gaikyo5.xlsx",
    loansUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/426/h30gaikyo8.xlsx",
  },
  {
    fiscalYear: 2018,
    materialsUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/50/r1gaikyou_5.xlsx",
    loansUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/50/r1gaikyou_8.xlsx",
  },
  {
    fiscalYear: 2019,
    materialsUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/50/r2gaikyou_5.xlsx",
    loansUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/50/r2gaikyou_8.xlsx",
  },
  {
    fiscalYear: 2020,
    materialsUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/50/r3gaikyou_5.xlsx",
    loansUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/50/r3gaikyou_8.xlsx",
  },
  {
    fiscalYear: 2021,
    materialsUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/50/r4gaikyou_5.xlsx",
    loansUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/50/r4gaikyou_8.xlsx",
  },
  {
    fiscalYear: 2022,
    materialsUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/50/r5gaikyou_5.xlsm",
    loansUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/50/r5gaikyou_8.xlsm",
  },
  {
    fiscalYear: 2023,
    materialsUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/50/r6gaikyo_5.xlsx",
    loansUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/50/r6gaikyo_8_ver2.xlsx",
  },
  {
    fiscalYear: 2024,
    materialsUrl: "https://www.knowledge.pref.nagano.lg.jp/documents/50/5.xlsx",
    loansUrl: "https://www.knowledge.pref.nagano.lg.jp/documents/50/8.xlsx",
  },
  {
    fiscalYear: 2025,
    materialsUrl:
      "https://www.knowledge.pref.nagano.lg.jp/documents/50/r8_5.xlsx",
    loansUrl: "https://www.knowledge.pref.nagano.lg.jp/documents/50/r8_8.xlsx",
  },
];

const NAGANO_R8_POPULATION_URL =
  "https://www.knowledge.pref.nagano.lg.jp/documents/50/r8_3.xlsx";

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

function sumNullable(values: Array<number | null>): number | null {
  let sum = 0;
  for (const v of values) {
    if (v === null) return null;
    sum += v;
  }
  return sum;
}

export interface BuildLibraryUsageInput {
  linkDataByYear: Map<number, LinkDataBranchRow[]>;
  matsumotoStatsEditions: ParsedMatsumotoStatsSheet[];
  naganoByYear: Map<
    number,
    {
      materials: NaganoMaterialBranchRow[];
      loans: NaganoLoanBranchRow[];
      populationOverride?: number;
    }
  >;
  generatedAt: string;
}

/**
 * 一次取得した全ソース（LinkData・松本市の統計・長野県概況・図書館概要）を突合・検証し、
 * 年代別グラフ用データセットを構築する。
 */
export function buildLibraryUsageDataset(
  input: BuildLibraryUsageInput,
): LibraryUsageDataset {
  const cityBranchesByYear = new Map<
    number,
    Map<
      BranchId,
      {
        openDays: number | null;
        holdingsTotal: number;
        registeredTotal: number;
        loansTotal: number;
        referenceCount: number;
        reservationsTotal: number;
      }
    >
  >();
  const cityTotalsByYear = new Map<
    number,
    {
      holdingsTotal: number;
      registeredTotal: number;
      loansTotal: number;
      referenceCount: number;
      reservationsTotal: number;
    }
  >();
  const cityGroupLoansByYear = new Map<number, number>();
  const citySpByYear = new Map<number, ServicePointYearMetrics[]>();

  for (const edition of input.matsumotoStatsEditions) {
    for (const b of edition.branches) {
      let map = cityBranchesByYear.get(b.fiscalYear);
      if (!map) {
        map = new Map();
        cityBranchesByYear.set(b.fiscalYear, map);
      }
      map.set(b.branchId, {
        openDays: b.openDays,
        holdingsTotal: b.holdingsTotal,
        registeredTotal: b.registeredTotal,
        loansTotal: b.loansTotal,
        referenceCount: b.referenceCount,
        reservationsTotal: b.reservationsTotal,
      });
    }

    for (const t of edition.totals) {
      cityTotalsByYear.set(t.fiscalYear, {
        holdingsTotal: t.holdingsTotal,
        registeredTotal: t.registeredTotal,
        loansTotal: t.loansTotal,
        referenceCount: t.referenceCount,
        reservationsTotal: t.reservationsTotal,
      });
    }

    for (const [fy, groupLoans] of edition.groupLoansByYear.entries()) {
      cityGroupLoansByYear.set(fy, groupLoans);
    }

    for (const sp of edition.servicePoints) {
      const list = citySpByYear.get(sp.fiscalYear) ?? [];
      const details =
        sp.id === "murai-sp"
          ? FY2024_SERVICE_POINT_DETAILS["murai-sp"]
          : FY2024_SERVICE_POINT_DETAILS["shiga-sp"];
      const filtered = list.filter((item) => item.id !== sp.id);
      filtered.push({
        id: sp.id,
        name: sp.name,
        openedAt: details.openedAt,
        openDays: sp.openDays,
        loansTotal: sp.loansTotal,
        loansChildren: details.loansChildren,
        reservationsTotal: sp.reservationsTotal,
        visitors: details.visitors,
      });
      citySpByYear.set(sp.fiscalYear, filtered);
    }
  }

  const annualRecords: AnnualRecord[] = [];

  for (let fy = 2013; fy <= 2025; fy++) {
    const nagano = input.naganoByYear.get(fy);
    if (!nagano) {
      throw new Error(`Missing Nagano survey data for FY${fy}`);
    }
    const naganoMatMap = new Map(nagano.materials.map((m) => [m.branchId, m]));
    const naganoLoanMap = new Map(nagano.loans.map((l) => [l.branchId, l]));

    const chuoLoan = naganoLoanMap.get("chuo");
    const population =
      nagano.populationOverride ?? chuoLoan?.population ?? null;
    if (!population) {
      throw new Error(`Missing population for FY${fy}`);
    }

    const linkRows = input.linkDataByYear.get(fy);
    const linkMap = linkRows
      ? new Map(linkRows.map((r) => [r.branchId, r]))
      : null;
    const cityBranchMap = cityBranchesByYear.get(fy) ?? null;
    const cityTotal = cityTotalsByYear.get(fy) ?? null;
    const servicePoints = citySpByYear.get(fy) ?? [];

    // 1. 館別指標の構築（データ整合性ルール厳守）
    const branches: BranchYearMetrics[] = branchIds.map((branchId) => {
      const matRow = naganoMatMap.get(branchId);
      const loanRow = naganoLoanMap.get(branchId);
      const linkRow = linkMap?.get(branchId);
      const cityRow = cityBranchMap?.get(branchId);

      if (!matRow || !loanRow) {
        throw new Error(`Missing Nagano branch ${branchId} for FY${fy}`);
      }

      // 2016年度以降は全年度共通の「図書のみ」系列として連続保持
      const includeBooksOnly = fy >= 2016;
      const holdingsBooks = includeBooksOnly ? matRow.holdingsBooks : null;
      const holdingsBooksChildren = includeBooksOnly
        ? matRow.holdingsBooksChildren
        : null;

      if (fy <= 2017) {
        if (!linkRow) {
          throw new Error(`Missing LinkData row ${branchId} for FY${fy}`);
        }
        return {
          branchId,
          openDays: linkRow.openDays,
          holdingsTotal: linkRow.holdingsTotal,
          holdingsBooks,
          holdingsBooksChildren,
          registeredTotal: linkRow.registeredTotal,
          registeredChildren: linkRow.registeredChildren,
          loansTotal: linkRow.loansTotal,
          loansChildren: linkRow.loansChildren,
          reservationsTotal: linkRow.reservationsTotal,
          referenceCount: linkRow.referenceCount,
          visitors: null,
        };
      }

      if (fy <= 2024) {
        if (!cityRow) {
          throw new Error(
            `Missing Matsumoto stats row ${branchId} for FY${fy}`,
          );
        }
        // FY2018 児童登録者は LinkData H30 が正、児童貸出は 長野県概況 R1（634,213）が正
        const registeredChildren =
          fy === 2018
            ? (linkRow?.registeredChildren ?? null)
            : loanRow.registeredChildren;

        // FY2024 中央図書館の長野県概況貸出には2SP分が合算されているため、11館分は松本市の統計を正とする
        let loansChildren = loanRow.loansChildren;
        if (fy === 2024 && branchId === "chuo" && loansChildren !== null) {
          const spChildren = servicePoints.reduce(
            (sum, sp) => sum + sp.loansChildren,
            0,
          );
          loansChildren -= spChildren;
        }

        return {
          branchId,
          openDays: cityRow.openDays,
          holdingsTotal: cityRow.holdingsTotal,
          holdingsBooks,
          holdingsBooksChildren,
          registeredTotal: cityRow.registeredTotal,
          registeredChildren,
          loansTotal: cityRow.loansTotal,
          loansChildren,
          reservationsTotal: cityRow.reservationsTotal,
          referenceCount: cityRow.referenceCount,
          visitors: loanRow.visitors,
        };
      }

      // FY2025: 長野県概況 R8速報ベース（全資料蔵書数は未公表のため null）
      return {
        branchId,
        openDays: null,
        holdingsTotal: null,
        holdingsBooks,
        holdingsBooksChildren,
        registeredTotal: loanRow.registeredTotal,
        registeredChildren: loanRow.registeredChildren,
        loansTotal: loanRow.loansTotal,
        loansChildren: loanRow.loansChildren,
        reservationsTotal: null,
        referenceCount: null,
        visitors: loanRow.visitors,
      };
    });

    // 2. 全市集計・突合チェック
    const sumHoldingsTotal = sumNullable(branches.map((b) => b.holdingsTotal));
    const sumHoldingsBooks = sumNullable(branches.map((b) => b.holdingsBooks));
    const sumHoldingsBooksChildren = sumNullable(
      branches.map((b) => b.holdingsBooksChildren),
    );
    const sumRegistered = branches.reduce((s, b) => s + b.registeredTotal, 0);
    const sumRegisteredChildren = sumNullable(
      branches.map((b) => b.registeredChildren),
    );
    const sumLoansBranches = branches.reduce((s, b) => s + b.loansTotal, 0);
    const sumLoansSp = servicePoints.reduce((s, sp) => s + sp.loansTotal, 0);
    const loansTotal = sumLoansBranches + sumLoansSp;

    const sumLoansChildrenBranches = sumNullable(
      branches.map((b) => b.loansChildren),
    );
    const sumLoansChildrenSp = servicePoints.reduce(
      (s, sp) => s + sp.loansChildren,
      0,
    );
    if (sumRegisteredChildren === null || sumLoansChildrenBranches === null) {
      throw new Error(`Missing children aggregate in FY${fy}`);
    }
    const loansChildren = sumLoansChildrenBranches + sumLoansChildrenSp;

    if (cityTotal) {
      if (sumHoldingsTotal !== cityTotal.holdingsTotal) {
        throw new Error(
          `Holdings mismatch in FY${fy}: ${sumHoldingsTotal} vs ${cityTotal.holdingsTotal}`,
        );
      }
      if (sumRegistered !== cityTotal.registeredTotal) {
        throw new Error(
          `Registered mismatch in FY${fy}: ${sumRegistered} vs ${cityTotal.registeredTotal}`,
        );
      }
      if (loansTotal !== cityTotal.loansTotal) {
        throw new Error(
          `Loans mismatch in FY${fy}: ${loansTotal} vs ${cityTotal.loansTotal}`,
        );
      }
    }

    const reservationsBranches = sumNullable(
      branches.map((b) => b.reservationsTotal),
    );
    const reservationsSp = servicePoints.reduce(
      (s, sp) => s + sp.reservationsTotal,
      0,
    );
    const reservationsTotal =
      cityTotal?.reservationsTotal ??
      (reservationsBranches !== null
        ? reservationsBranches + reservationsSp
        : null);

    const referenceCount =
      cityTotal?.referenceCount ??
      sumNullable(branches.map((b) => b.referenceCount));

    const groupLoansTotal =
      fy <= 2017
        ? (linkMap?.get("chuo")?.groupLoansTotal ?? 0)
        : fy <= 2024
          ? (cityGroupLoansByYear.get(fy) ?? 0)
          : (chuoLoan?.groupLoansTotal ?? 0);

    const meta = ANNUAL_ERA_LABELS[fy];
    const dataSourceNote =
      fy <= 2017
        ? "松本市図書館利用状況（LinkData CC BY 3.0）＋ 長野県公共図書館概況（人口・図書蔵書）"
        : fy === 2018
          ? "松本市の統計（0343）＋ LinkData H30（児童登録者）＋ 長野県公共図書館概況 R1（児童貸出・人口）"
          : fy <= 2024
            ? "松本市の統計（0344）＋ 長野県公共図書館概況（児童内訳・人口・来館者）＋ 図書館概要"
            : "長野県公共図書館概況（令和8年度版：R7年度実績、中央に2SP分含む）";

    annualRecords.push({
      fiscalYear: fy,
      eraLabel: meta.eraLabel,
      shortEraLabel: meta.shortEraLabel,
      population,
      holdingsTotal: sumHoldingsTotal,
      holdingsBooks: sumHoldingsBooks,
      holdingsBooksChildren: sumHoldingsBooksChildren,
      registeredTotal: sumRegistered,
      registeredChildren: sumRegisteredChildren,
      loansTotal,
      loansChildren,
      groupLoansTotal,
      reservationsTotal,
      referenceCount,
      registrationPolicyChange: fy === 2020,
      dataSourceNote,
      eventNotes: meta.notes,
      branches,
      servicePoints,
    });
  }

  // 年齢別スナップショットと年次登録者数の整合性チェック
  const annualByYear = new Map(annualRecords.map((r) => [r.fiscalYear, r]));
  for (const snap of AGE_GROUP_SNAPSHOTS) {
    const rec = annualByYear.get(snap.fiscalYear);
    if (!rec || rec.registeredTotal !== snap.totals.registeredTotal) {
      throw new Error(
        `Age snapshot registeredTotal mismatch for FY${snap.fiscalYear}`,
      );
    }
  }

  const dataset: LibraryUsageDataset = {
    version: "1.0",
    generatedAt: input.generatedAt,
    site: "https://modata.raichonomichi.net",
    notice:
      "本ページは松本市オープンデータ（LinkData H25〜H30）、松本市の統計「C 教育・文化」、松本市図書館「図書館概要」、および県立長野図書館「長野県公共図書館概況」（CC BY-SA 4.0）をもとに作成しています。令和2年度（2020年度）は登録者データの削除基準見直し（有効期限切れ10年以上→2年以上未更新）により見かけ上の登録者数が段差になっています。令和7年度（2025年度）の蔵書数は全資料統計が公表前のため、長野県概況の図書蔵書数（参考系列）を表示しています。また、中央図書館は2027年7月〜2030年春にかけて長寿命化改修に伴う長期休館が予定されています。",
    officialLinks: {
      libraryTop: "https://www.lib.city.matsumoto.lg.jp/",
      libraryOverview: "https://www.lib.city.matsumoto.lg.jp/0000000089.html",
      cityStats: "https://www.city.matsumoto.nagano.jp/soshiki/5/5977.html",
      chuoRenovation: "https://www.lib.city.matsumoto.lg.jp/0000000956.html",
    },
    sources: {
      linkData: {
        name: "松本市 図書館利用状況（H25〜H30）",
        sourceUrl: "http://linkdata.org/work/rdf1s7819i",
        license: "CC BY 3.0",
        attribution:
          "松本市 情報政策課「松本市 図書館利用状況」（クリエイティブ・コモンズ・ライセンス 表示 3.0 非移植）",
      },
      cityStats: {
        name: "松本市の統計「C 教育・文化」（市立図書館利用状況）",
        sourceUrl: "https://www.city.matsumoto.nagano.jp/soshiki/5/5977.html",
        license: "その他",
        attribution:
          "松本市「松本市の統計（C 教育・文化／市立図書館利用状況）」",
      },
      libraryOverview: {
        name: "松本市図書館「図書館概要」（令和6年度・令和7年度版）",
        sourceUrl: "https://www.lib.city.matsumoto.lg.jp/0000000089.html",
        license: "その他",
        attribution:
          "松本市中央図書館「令和6年度 図書館概要」「令和7年度 図書館概要」",
      },
      naganoSurvey: {
        name: "長野県公共図書館概況（H26〜R8年度版）",
        sourceUrl:
          "https://www.knowledge.pref.nagano.lg.jp/alliance/lib/general.html",
        license: "CC BY-SA 4.0",
        attribution:
          "県立長野図書館・長野県図書館協会「長野県公共図書館概況」（クリエイティブ・コモンズ 表示 - 継承 4.0 国際 ライセンス）をもとに松本市分を抽出・集計",
      },
    },
    branchProfiles: BRANCH_PROFILES,
    decadeMilestones: DECADE_MILESTONES,
    branchExpansionHistory: BRANCH_EXPANSION_HISTORY,
    annualRecords,
    ageGroupSnapshots: AGE_GROUP_SNAPSHOTS,
    digitalLibrary: DIGITAL_LIBRARY_HISTORY,
  };

  return libraryUsageDatasetSchema.parse(dataset);
}

export async function runLibraryUsagePipeline(): Promise<void> {
  console.log(
    "Fetching Matsumoto LinkData (6 TSV), City Stats (5 XLSX), and Nagano Library Surveys (27 XLSX/XLSM)...",
  );

  const [linkTexts, statsBuffers, naganoBuffers, r8PopBuffer] =
    await Promise.all([
      Promise.all(
        LINKDATA_URLS.map(async ({ fiscalYear, url }) => ({
          fiscalYear,
          text: await fetchText(url),
        })),
      ),
      Promise.all(
        MATSUMOTO_STATS_URLS.map(async ({ edition, url }) => ({
          edition,
          buffer: await fetchBuffer(url),
        })),
      ),
      Promise.all(
        NAGANO_SURVEY_URLS.map(
          async ({ fiscalYear, materialsUrl, loansUrl }) => {
            const [matBuf, loanBuf] = await Promise.all([
              fetchBuffer(materialsUrl),
              fetchBuffer(loansUrl),
            ]);
            return { fiscalYear, matBuf, loanBuf };
          },
        ),
      ),
      fetchBuffer(NAGANO_R8_POPULATION_URL),
    ]);

  const linkDataByYear = new Map<number, LinkDataBranchRow[]>();
  for (const item of linkTexts) {
    linkDataByYear.set(item.fiscalYear, parseLinkDataLibraryTsv(item.text));
  }

  const matsumotoStatsEditions = statsBuffers.map(({ edition, buffer }) => {
    const sheets = readXlsxSheets(buffer);
    const libSheet = sheets.find((s) => {
      const top = s.rows
        .slice(0, 3)
        .map((r) => Object.values(r).join(" "))
        .join(" ");
      return top.includes("市立図書館利用状況");
    });
    if (!libSheet) {
      throw new Error(`Library sheet not found in Matsumoto stats ${edition}`);
    }
    return parseMatsumotoStatsLibrarySheet(libSheet.rows);
  });

  const r8PopSheets = readXlsxSheets(r8PopBuffer);
  const r8Population = parseNaganoSurveyPopulationSheet(r8PopSheets[0].rows);

  const naganoByYear = new Map<
    number,
    {
      materials: NaganoMaterialBranchRow[];
      loans: NaganoLoanBranchRow[];
      populationOverride?: number;
    }
  >();

  for (const item of naganoBuffers) {
    const matSheets = readXlsxSheets(item.matBuf);
    const loanSheets = readXlsxSheets(item.loanBuf);
    naganoByYear.set(item.fiscalYear, {
      materials: parseNaganoSurveyMaterialSheet(matSheets[0].rows),
      loans: parseNaganoSurveyLoanSheet(loanSheets[0].rows),
      populationOverride: item.fiscalYear === 2025 ? r8Population : undefined,
    });
  }

  const generatedAt = new Date().toISOString().slice(0, 10);
  const dataset = buildLibraryUsageDataset({
    linkDataByYear,
    matsumotoStatsEditions,
    naganoByYear,
    generatedAt,
  });

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(dataset, null, 2)}\n`,
    "utf-8",
  );
  console.log(
    `Generated ${path.relative(process.cwd(), OUTPUT_PATH)} (${dataset.annualRecords.length} annual records, ${dataset.branchProfiles.length} branches, ${dataset.branchExpansionHistory.length} expansion points, ${dataset.ageGroupSnapshots.length} age snapshots)`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
  await runLibraryUsagePipeline();
}
