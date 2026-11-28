import type {
  AnnualRecord,
  BranchId,
  BranchYearMetrics,
  LibraryUsageDataset,
} from "./library-usage-schema";

export type BranchMetricKey =
  | "loansTotal"
  | "holdingsDisplay"
  | "registeredTotal"
  | "childrenLoanShare"
  | "turnoverRate";

export interface CombinedTimelinePoint {
  fiscalYear: number;
  eraLabel: string;
  shortEraLabel: string;
  isMilestone: boolean;
  holdingsTotal: number | null;
  holdingsBooks: number | null;
  registeredTotal: number;
  loansTotal: number;
  loansChildren: number | null;
  registrationPolicyChange: boolean;
  note: string;
}

/**
 * 数値を見やすい日本語表記（1万以上は万単位小数1桁、未満は3桁区切り）へ整形する。
 */
export function formatJaCount(value: number, unit = ""): string {
  if (!Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 10_000) {
    const man = (value / 10_000).toLocaleString("ja-JP", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${man}万${unit}`;
  }
  return `${Math.round(value).toLocaleString("ja-JP")}${unit}`;
}

/**
 * グラフY軸目盛用の短縮表記を返す。
 */
export function formatAxisValue(value: number, unit: string): string {
  if (value === 0) return "0";
  if (unit === "冊" || unit === "点" || unit === "人") {
    if (Math.abs(value) >= 1_000_000) {
      const man = Math.round(value / 10_000);
      return `${man.toLocaleString("ja-JP")}万`;
    }
    if (Math.abs(value) >= 10_000) {
      const man = value / 10_000;
      const formatted = Number.isInteger(man) ? String(man) : man.toFixed(1);
      return `${formatted}万`;
    }
    return value.toLocaleString("ja-JP");
  }
  if (unit === "%") {
    return `${value.toFixed(0)}%`;
  }
  return value.toLocaleString("ja-JP");
}

/**
 * 前年比増減率（%）を小数1桁で計算する。
 */
export function calcYoYPercent(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * 部分／全体の構成比（%）を小数1桁で計算する。
 */
export function calcSharePercent(
  part: number | null,
  total: number | null,
): number | null {
  if (part === null || total === null || total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

/**
 * 人口1人あたりの値（小数2桁）を計算する。
 */
export function calcPerCapita(
  value: number | null,
  population: number,
): number | null {
  if (value === null || population <= 0) return null;
  return Math.round((value / population) * 100) / 100;
}

/**
 * 基準年に対する倍率（小数1桁）を計算する。
 */
export function calcGrowthMultiple(
  latest: number | null,
  baseline: number | null,
): number | null {
  if (latest === null || baseline === null || baseline <= 0) return null;
  return Math.round((latest / baseline) * 10) / 10;
}

/**
 * 1980・1990・2000年の10年刻み実績と、2013〜2025年度の年次実績から年代別比較ポイントを生成する。
 */
export function getCombinedTimelinePoints(
  dataset: LibraryUsageDataset,
): CombinedTimelinePoint[] {
  const milestonePoints: CombinedTimelinePoint[] = dataset.decadeMilestones.map(
    (m) => ({
      fiscalYear: m.fiscalYear,
      eraLabel: m.eraLabel,
      shortEraLabel: m.shortEraLabel,
      isMilestone: true,
      holdingsTotal: m.holdingsTotal,
      holdingsBooks: null,
      registeredTotal: m.registeredTotal,
      loansTotal: m.loansTotal,
      loansChildren: m.loansChildren,
      registrationPolicyChange: false,
      note: m.note,
    }),
  );

  const selectedAnnualYears = new Set([2013, 2015, 2019, 2020, 2024, 2025]);
  const annualPoints: CombinedTimelinePoint[] = dataset.annualRecords
    .filter((r) => selectedAnnualYears.has(r.fiscalYear))
    .map((r) => ({
      fiscalYear: r.fiscalYear,
      eraLabel: r.eraLabel,
      shortEraLabel: r.shortEraLabel,
      isMilestone: false,
      holdingsTotal: r.holdingsTotal,
      holdingsBooks: r.holdingsBooks,
      registeredTotal: r.registeredTotal,
      loansTotal: r.loansTotal,
      loansChildren: r.loansChildren,
      registrationPolicyChange: r.registrationPolicyChange,
      note: r.eventNotes[0] ?? r.dataSourceNote,
    }));

  return [...milestonePoints, ...annualPoints].sort(
    (a, b) => a.fiscalYear - b.fiscalYear,
  );
}

/**
 * 館別データの指定指標値を取得する（比較・並び替え用）。
 */
export function getBranchMetricValue(
  branch: BranchYearMetrics,
  metricKey: BranchMetricKey,
): number | null {
  switch (metricKey) {
    case "loansTotal":
      return branch.loansTotal;
    case "holdingsDisplay":
      return branch.holdingsTotal ?? branch.holdingsBooks;
    case "registeredTotal":
      return branch.registeredTotal;
    case "childrenLoanShare":
      return calcSharePercent(branch.loansChildren, branch.loansTotal);
    case "turnoverRate": {
      const denom = branch.holdingsBooks ?? branch.holdingsTotal;
      if (!denom || denom <= 0) return null;
      return Math.round((branch.loansTotal / denom) * 100) / 100;
    }
  }
}

/**
 * 年次レコードから対象館（または全市合計）の数値を抽出する。
 */
export function getScopeYearValues(
  record: AnnualRecord,
  scope: "all" | BranchId,
): {
  holdingsTotal: number | null;
  holdingsBooks: number | null;
  holdingsBooksChildren: number | null;
  registeredTotal: number;
  registeredChildren: number | null;
  loansTotal: number;
  loansChildren: number | null;
  reservationsTotal: number | null;
  referenceCount: number | null;
  openDays: number | null;
  visitors: number | null;
} {
  if (scope === "all") {
    const visitorsSum = record.branches.reduce<number | null>((acc, b) => {
      if (b.visitors === null) return acc;
      return (acc ?? 0) + b.visitors;
    }, null);
    return {
      holdingsTotal: record.holdingsTotal,
      holdingsBooks: record.holdingsBooks,
      holdingsBooksChildren: record.holdingsBooksChildren,
      registeredTotal: record.registeredTotal,
      registeredChildren: record.registeredChildren,
      loansTotal: record.loansTotal,
      loansChildren: record.loansChildren,
      reservationsTotal: record.reservationsTotal,
      referenceCount: record.referenceCount,
      openDays: record.branches[0]?.openDays ?? null,
      visitors: visitorsSum,
    };
  }

  const branch = record.branches.find((b) => b.branchId === scope);
  if (!branch) {
    throw new Error(
      `Branch ${scope} missing in fiscalYear ${record.fiscalYear}`,
    );
  }
  return {
    holdingsTotal: branch.holdingsTotal,
    holdingsBooks: branch.holdingsBooks,
    holdingsBooksChildren: branch.holdingsBooksChildren,
    registeredTotal: branch.registeredTotal,
    registeredChildren: branch.registeredChildren,
    loansTotal: branch.loansTotal,
    loansChildren: branch.loansChildren,
    reservationsTotal: branch.reservationsTotal,
    referenceCount: branch.referenceCount,
    openDays: branch.openDays,
    visitors: branch.visitors,
  };
}
