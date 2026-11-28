import {
  POPULATION_MAX_AGE,
  type PopulationSnapshot,
} from "./population-schema";

export type AgeGranularity = "decade" | "five_year" | "single";
export type TrendCategoryMode = "decade" | "three_tier";
export type TrendCadence = "annual_same_month" | "monthly";
export type CompareMode =
  | "none"
  | "start_2017"
  | "five_years_ago"
  | "prev_year";

export interface AgeBandRow {
  id: string;
  label: string;
  shortLabel: string;
  minAge: number;
  maxAge: number;
  male: number;
  female: number;
  total: number;
  sharePct: number;
  maleSharePct: number;
}

export interface TrendGroupSpec {
  id: string;
  label: string;
  shortLabel: string;
  minAge: number;
  maxAge: number;
  description: string;
}

export interface SnapshotMetrics {
  total: number;
  male: number;
  female: number;
  malePct: number;
  femalePct: number;
  youthCount: number;
  youthPct: number;
  workingCount: number;
  workingPct: number;
  elderlyCount: number;
  elderlyPct: number;
  lateElderlyCount: number;
  lateElderlyPct: number;
  medianAge: number;
  averageAge: number;
  peakAge: {
    age: number;
    total: number;
    male: number;
    female: number;
  };
}

export interface TrendPoint {
  ym: string;
  year: number;
  month: number;
  label: string;
  total: number;
  male: number;
  female: number;
  sharePct: number;
  diffFromStart: number;
  pctFromStart: number;
}

export const DECADE_TREND_GROUPS: readonly TrendGroupSpec[] = [
  {
    id: "all",
    label: "全年齢",
    shortLabel: "全年齢",
    minAge: 0,
    maxAge: POPULATION_MAX_AGE,
    description: "0歳〜109歳の住民基本台帳人口の総計",
  },
  {
    id: "0-9",
    label: "0〜9歳",
    shortLabel: "0〜9歳",
    minAge: 0,
    maxAge: 9,
    description: "乳幼児・小学校低学年〜中学年の世代",
  },
  {
    id: "10-19",
    label: "10代",
    shortLabel: "10代",
    minAge: 10,
    maxAge: 19,
    description: "10〜19歳（小中高・大学初期・若年層）",
  },
  {
    id: "20-29",
    label: "20代",
    shortLabel: "20代",
    minAge: 20,
    maxAge: 29,
    description: "20〜29歳（進学・就職・新社会人世代）",
  },
  {
    id: "30-39",
    label: "30代",
    shortLabel: "30代",
    minAge: 30,
    maxAge: 39,
    description: "30〜39歳（子育て・働き盛り世代）",
  },
  {
    id: "40-49",
    label: "40代",
    shortLabel: "40代",
    minAge: 40,
    maxAge: 49,
    description: "40〜49歳（氷河期・中堅世代）",
  },
  {
    id: "50-59",
    label: "50代",
    shortLabel: "50代",
    minAge: 50,
    maxAge: 59,
    description: "50〜59歳（第2次ベビーブーム前後世代）",
  },
  {
    id: "60-69",
    label: "60代",
    shortLabel: "60代",
    minAge: 60,
    maxAge: 69,
    description: "60〜69歳（定年・シニア移行世代）",
  },
  {
    id: "70-79",
    label: "70代",
    shortLabel: "70代",
    minAge: 70,
    maxAge: 79,
    description: "70〜79歳（団塊世代中心）",
  },
  {
    id: "80-89",
    label: "80代",
    shortLabel: "80代",
    minAge: 80,
    maxAge: 89,
    description: "80〜89歳",
  },
  {
    id: "90+",
    label: "90歳以上",
    shortLabel: "90歳〜",
    minAge: 90,
    maxAge: POPULATION_MAX_AGE,
    description: "90〜109歳",
  },
] as const;

export const THREE_TIER_TREND_GROUPS: readonly TrendGroupSpec[] = [
  {
    id: "all",
    label: "全年齢",
    shortLabel: "全年齢",
    minAge: 0,
    maxAge: POPULATION_MAX_AGE,
    description: "0歳〜109歳の全人口",
  },
  {
    id: "youth",
    label: "年少人口（0〜14歳）",
    shortLabel: "0〜14歳",
    minAge: 0,
    maxAge: 14,
    description: "義務教育年齢までの子ども世代",
  },
  {
    id: "working",
    label: "生産年齢（15〜64歳）",
    shortLabel: "15〜64歳",
    minAge: 15,
    maxAge: 64,
    description: "労働力の中核となる世代",
  },
  {
    id: "elderly",
    label: "老年人口（65歳以上）",
    shortLabel: "65歳〜",
    minAge: 65,
    maxAge: POPULATION_MAX_AGE,
    description: "高齢化率の分子となる65歳以上の人口",
  },
  {
    id: "late_elderly",
    label: "後期高齢者（75歳以上）",
    shortLabel: "75歳〜",
    minAge: 75,
    maxAge: POPULATION_MAX_AGE,
    description: "75歳以上の人口",
  },
] as const;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function sumAgeRange(
  snapshot: PopulationSnapshot,
  minAge: number,
  maxAge: number,
): { male: number; female: number; total: number } {
  let male = 0;
  let female = 0;
  const clampedMin = Math.max(0, minAge);
  const clampedMax = Math.min(POPULATION_MAX_AGE, maxAge);
  for (let age = clampedMin; age <= clampedMax; age++) {
    male += snapshot.maleByAge[age] ?? 0;
    female += snapshot.femaleByAge[age] ?? 0;
  }
  return { male, female, total: male + female };
}

/**
 * 西暦年月に対応する和暦年表記を返す（2019年4月までは平成31年、5月以降は令和元年）。
 */
export function getJapaneseEraLabel(year: number, month: number): string {
  if (year < 2019) {
    return `平成${year - 1988}年`;
  }
  if (year === 2019) {
    return month <= 4 ? "平成31年" : "令和元年";
  }
  return `令和${year - 2018}年`;
}

/**
 * YYYY-MM を日本語年月表記（任意で和暦付き）へ整形する。
 */
export function formatYmJa(ym: string, withEra = true): string {
  const [yearStr, monthStr] = ym.split("-");
  const year = Number.parseInt(yearStr ?? "", 10);
  const month = Number.parseInt(monthStr ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return ym;
  }
  const base = `${year}年${month}月`;
  return withEra ? `${base}（${getJapaneseEraLabel(year, month)}）` : base;
}

/**
 * スナップショットを指定粒度（10歳階級・5歳階級・1歳刻み）へ集計する。
 * 返却順は若年層から高齢層への昇順（ピラミッドでは下から上へ描画）。
 */
export function aggregateBands(
  snapshot: PopulationSnapshot,
  granularity: AgeGranularity,
): AgeBandRow[] {
  const specs: Array<{
    id: string;
    label: string;
    shortLabel: string;
    minAge: number;
    maxAge: number;
  }> = [];

  if (granularity === "decade") {
    for (let start = 0; start <= 90; start += 10) {
      const end = start + 9;
      specs.push({
        id: `${start}-${end}`,
        label: start === 0 ? "0〜9歳" : `${start}代（${start}〜${end}歳）`,
        shortLabel: start === 0 ? "0〜9歳" : `${start}代`,
        minAge: start,
        maxAge: end,
      });
    }
    specs.push({
      id: `100-${POPULATION_MAX_AGE}`,
      label: "100歳以上",
      shortLabel: "100歳〜",
      minAge: 100,
      maxAge: POPULATION_MAX_AGE,
    });
  } else if (granularity === "five_year") {
    for (let start = 0; start <= 95; start += 5) {
      const end = start + 4;
      specs.push({
        id: `${start}-${end}`,
        label: `${start}〜${end}歳`,
        shortLabel: `${start}〜${end}`,
        minAge: start,
        maxAge: end,
      });
    }
    specs.push({
      id: `100-${POPULATION_MAX_AGE}`,
      label: "100歳以上",
      shortLabel: "100歳〜",
      minAge: 100,
      maxAge: POPULATION_MAX_AGE,
    });
  } else {
    for (let age = 0; age <= 99; age++) {
      specs.push({
        id: String(age),
        label: `${age}歳`,
        shortLabel: `${age}歳`,
        minAge: age,
        maxAge: age,
      });
    }
    specs.push({
      id: `100-${POPULATION_MAX_AGE}`,
      label: "100歳以上",
      shortLabel: "100歳〜",
      minAge: 100,
      maxAge: POPULATION_MAX_AGE,
    });
  }

  return specs.map((spec) => {
    const { male, female, total } = sumAgeRange(
      snapshot,
      spec.minAge,
      spec.maxAge,
    );
    return {
      ...spec,
      male,
      female,
      total,
      sharePct: snapshot.total > 0 ? round1((total / snapshot.total) * 100) : 0,
      maleSharePct: total > 0 ? round1((male / total) * 100) : 0,
    };
  });
}

/**
 * 1時点スナップショットから3区分・高齢化率・中央値年齢・平均年齢・最多年齢を算出する。
 */
export function computeSnapshotMetrics(
  snapshot: PopulationSnapshot,
): SnapshotMetrics {
  const youth = sumAgeRange(snapshot, 0, 14);
  const working = sumAgeRange(snapshot, 15, 64);
  const elderly = sumAgeRange(snapshot, 65, POPULATION_MAX_AGE);
  const lateElderly = sumAgeRange(snapshot, 75, POPULATION_MAX_AGE);

  let weightedAgeSum = 0;
  let cumulative = 0;
  const medianThreshold = Math.ceil(snapshot.total / 2);
  let medianAge = 0;
  let medianFound = false;

  let peakAge = {
    age: 0,
    total: 0,
    male: 0,
    female: 0,
  };

  for (let age = 0; age <= POPULATION_MAX_AGE; age++) {
    const male = snapshot.maleByAge[age] ?? 0;
    const female = snapshot.femaleByAge[age] ?? 0;
    const total = male + female;

    weightedAgeSum += (age + 0.5) * total;
    cumulative += total;
    if (!medianFound && snapshot.total > 0 && cumulative >= medianThreshold) {
      medianAge = age;
      medianFound = true;
    }

    if (total > peakAge.total) {
      peakAge = { age, total, male, female };
    }
  }

  const denom = snapshot.total > 0 ? snapshot.total : 1;

  return {
    total: snapshot.total,
    male: snapshot.male,
    female: snapshot.female,
    malePct: snapshot.total > 0 ? round1((snapshot.male / denom) * 100) : 0,
    femalePct: snapshot.total > 0 ? round1((snapshot.female / denom) * 100) : 0,
    youthCount: youth.total,
    youthPct: snapshot.total > 0 ? round1((youth.total / denom) * 100) : 0,
    workingCount: working.total,
    workingPct: snapshot.total > 0 ? round1((working.total / denom) * 100) : 0,
    elderlyCount: elderly.total,
    elderlyPct: snapshot.total > 0 ? round1((elderly.total / denom) * 100) : 0,
    lateElderlyCount: lateElderly.total,
    lateElderlyPct:
      snapshot.total > 0 ? round1((lateElderly.total / denom) * 100) : 0,
    medianAge,
    averageAge: snapshot.total > 0 ? round1(weightedAgeSum / denom) : 0,
    peakAge,
  };
}

/**
 * 指定年月に一致するスナップショットを返し、未収録月の場合は同年内の最も近い月へクランプする。
 */
export function resolveSnapshotForYearMonth(
  snapshots: PopulationSnapshot[],
  year: number,
  month: number,
): PopulationSnapshot {
  if (snapshots.length === 0) {
    throw new Error("snapshots must not be empty");
  }
  const exact = snapshots.find((s) => s.year === year && s.month === month);
  if (exact) return exact;

  const sameYear = snapshots.filter((s) => s.year === year);
  if (sameYear.length > 0) {
    return sameYear.reduce((best, cur) =>
      Math.abs(cur.month - month) < Math.abs(best.month - month) ? cur : best,
    );
  }

  const targetYmIndex = year * 12 + month;
  return snapshots.reduce((best, cur) => {
    const curDiff = Math.abs(cur.year * 12 + cur.month - targetYmIndex);
    const bestDiff = Math.abs(best.year * 12 + best.month - targetYmIndex);
    return curDiff < bestDiff ? cur : best;
  });
}

/**
 * 比較モードに応じた過去スナップショットを解決する。存在しない場合や同時点になる場合は null。
 */
export function resolveComparisonSnapshot(
  snapshots: PopulationSnapshot[],
  current: PopulationSnapshot,
  mode: CompareMode,
): PopulationSnapshot | null {
  if (mode === "none") return null;

  let targetYear: number;
  if (mode === "start_2017") {
    targetYear = 2017;
  } else if (mode === "five_years_ago") {
    targetYear = current.year - 5;
  } else {
    targetYear = current.year - 1;
  }

  if (targetYear === current.year) return null;

  return (
    snapshots.find((s) => s.year === targetYear && s.month === current.month) ??
    null
  );
}

/**
 * 指定粒度の全期間を通じた男女片側最大人数を算出する（X軸固定モード用）。
 */
export function computeGlobalMaxBandSide(
  snapshots: PopulationSnapshot[],
  granularity: AgeGranularity,
): number {
  let maxSide = 0;
  for (const snapshot of snapshots) {
    const bands = aggregateBands(snapshot, granularity);
    for (const band of bands) {
      if (band.male > maxSide) maxSide = band.male;
      if (band.female > maxSide) maxSide = band.female;
    }
  }
  return maxSide;
}

/**
 * 指定年齢範囲の推移系列（年次同月または全月次）を生成する。
 */
export function buildTrendSeries(
  snapshots: PopulationSnapshot[],
  minAge: number,
  maxAge: number,
  cadence: TrendCadence,
  anchorMonth: number,
): TrendPoint[] {
  const filtered =
    cadence === "annual_same_month"
      ? snapshots.filter((s) => s.month === anchorMonth)
      : snapshots;

  if (filtered.length === 0) return [];

  const points = filtered.map((snapshot) => {
    const { male, female, total } = sumAgeRange(snapshot, minAge, maxAge);
    return {
      ym: snapshot.ym,
      year: snapshot.year,
      month: snapshot.month,
      label:
        cadence === "annual_same_month"
          ? `${snapshot.year}年${snapshot.month}月`
          : `${snapshot.year}/${String(snapshot.month).padStart(2, "0")}`,
      total,
      male,
      female,
      sharePct: snapshot.total > 0 ? round1((total / snapshot.total) * 100) : 0,
    };
  });

  const startTotal = points[0]?.total ?? 0;

  return points.map((pt) => {
    const diffFromStart = pt.total - startTotal;
    const pctFromStart =
      startTotal > 0 ? round1((diffFromStart / startTotal) * 100) : 0;
    return {
      ...pt,
      diffFromStart,
      pctFromStart,
    };
  });
}

/**
 * ピラミッドの年代行に対応する10歳年代推移グループIDを返す。
 */
export function findDecadeTrendGroupForBand(band: AgeBandRow): string {
  if (band.minAge >= 90) {
    return "90+";
  }
  const decadeStart = Math.floor(band.minAge / 10) * 10;
  return `${decadeStart}-${decadeStart + 9}`;
}
