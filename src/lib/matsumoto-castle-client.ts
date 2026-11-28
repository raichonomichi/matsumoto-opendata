import type { CalendarDay, CastleEvent } from "./matsumoto-castle-schema";

export const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export type CastleGoalMode = "avoid_crowd" | "with_event";
export type CastleDowFilter = "all" | "weekday" | "weekend_holiday";
export type CastleWindowFilter = "next_30" | "current_month" | "next_90";

export interface DatasetDateRange {
  startDate: string;
  endDate: string;
}

/**
 * YYYY-MM-DD をデータセット収録期間内にクランプする。
 */
export function clampDateToRange(ymd: string, range: DatasetDateRange): string {
  if (ymd < range.startDate) return range.startDate;
  if (ymd > range.endDate) return range.endDate;
  return ymd;
}

/**
 * YYYY-MM-DD に対して UTC 日付計算で指定日数を加減算する。
 */
export function addDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * 日付を短縮日本語形式（例: 5月3日(日)）へ整形する。
 */
export function formatShortDateJa(
  ymd: string,
  dayOfWeek: number | undefined,
): string {
  const m = Number.parseInt(ymd.slice(5, 7), 10);
  const d = Number.parseInt(ymd.slice(8, 10), 10);
  const dow = dayOfWeek !== undefined ? (DOW_LABELS[dayOfWeek] ?? "") : "";
  return `${m}月${d}日(${dow})`;
}

/**
 * 日付を年月日＋曜日形式（例: 2026年5月3日（日））へ整形する。
 */
export function formatFullDateJa(
  day: Pick<CalendarDay, "date" | "dayOfWeek">,
): string {
  const y = day.date.slice(0, 4);
  const m = Number.parseInt(day.date.slice(5, 7), 10);
  const d = Number.parseInt(day.date.slice(8, 10), 10);
  return `${y}年${m}月${d}日（${DOW_LABELS[day.dayOfWeek]}）`;
}

/**
 * おすすめ日検索の起点日を算出する（収録終端超過時は表示月の1日へフォールバック）。
 */
export function getAnchorDate(
  todayYmd: string,
  currentMonth: string,
  range: DatasetDateRange,
): string {
  if (todayYmd <= range.endDate) {
    return clampDateToRange(todayYmd, range);
  }
  return `${currentMonth}-01`;
}

/**
 * 選択された検索期間プリセットに応じた開始日・終了日・見出しラベルを解決する。
 */
export function resolveRecommendationWindow(params: {
  anchor: string;
  currentMonth: string;
  windowFilter: CastleWindowFilter;
  days: readonly CalendarDay[];
  range: DatasetDateRange;
  dayByDate: ReadonlyMap<string, CalendarDay>;
}): { rangeStart: string; rangeEnd: string; windowText: string } {
  const { anchor, currentMonth, windowFilter, days, range, dayByDate } = params;
  let rangeStart = anchor;
  let rangeEnd = clampDateToRange(addDaysYmd(anchor, 29), range);
  let windowText = `${formatShortDateJa(rangeStart, dayByDate.get(rangeStart)?.dayOfWeek)}〜${formatShortDateJa(rangeEnd, dayByDate.get(rangeEnd)?.dayOfWeek)}`;

  if (windowFilter === "next_90") {
    rangeEnd = clampDateToRange(addDaysYmd(anchor, 89), range);
    windowText = `${formatShortDateJa(rangeStart, dayByDate.get(rangeStart)?.dayOfWeek)}〜${formatShortDateJa(rangeEnd, dayByDate.get(rangeEnd)?.dayOfWeek)}`;
  } else if (windowFilter === "current_month") {
    const monthDays = days.filter((d) => d.date.startsWith(currentMonth));
    if (monthDays.length > 0) {
      rangeStart = monthDays[0].date;
      rangeEnd = monthDays[monthDays.length - 1].date;
      const y = currentMonth.slice(0, 4);
      const m = Number.parseInt(currentMonth.slice(5, 7), 10);
      windowText = `${y}年${m}月`;
    }
  }

  return { rangeStart, rangeEnd, windowText };
}

/**
 * 指定期間・目的・曜日条件に合致するおすすめ訪問日（最大 limit 件）を抽出・並び替えする。
 */
export function pickRecommendedDays(params: {
  days: readonly CalendarDay[];
  rangeStart: string;
  rangeEnd: string;
  goalMode: CastleGoalMode;
  dowFilter: CastleDowFilter;
  eventById: ReadonlyMap<string, Pick<CastleEvent, "scope">>;
  limit?: number;
}): CalendarDay[] {
  const {
    days,
    rangeStart,
    rangeEnd,
    goalMode,
    dowFilter,
    eventById,
    limit = 6,
  } = params;

  const candidates = days.filter((day) => {
    if (day.date < rangeStart || day.date > rangeEnd) return false;
    if (day.crowdLevel === "closed" || day.crowdScore === null) {
      return false;
    }
    const isOff = day.isWeekend || day.holidayName !== null;
    if (dowFilter === "weekday" && isOff) return false;
    if (dowFilter === "weekend_holiday" && !isOff) return false;
    if (goalMode === "with_event" && day.eventIds.length === 0) {
      return false;
    }
    return true;
  });

  const sorted = [...candidates].sort((a, b) => {
    if (goalMode === "avoid_crowd") {
      const diff = (a.crowdScore ?? 100) - (b.crowdScore ?? 100);
      return diff !== 0 ? diff : a.date.localeCompare(b.date);
    }
    const aHasCastle = a.eventIds.some(
      (id) => eventById.get(id)?.scope === "castle",
    );
    const bHasCastle = b.eventIds.some(
      (id) => eventById.get(id)?.scope === "castle",
    );
    if (aHasCastle !== bHasCastle) return aHasCastle ? -1 : 1;
    return a.date.localeCompare(b.date);
  });

  return sorted.slice(0, limit);
}

/**
 * 指定月（YYYY-MM）と会期が1日でも重なる周辺文化施設イベントを抽出する。
 */
export function getActiveNearbyExhibitions(
  exhibitions: readonly CastleEvent[],
  currentMonth: string,
): CastleEvent[] {
  const year = Number.parseInt(currentMonth.slice(0, 4), 10);
  const month = Number.parseInt(currentMonth.slice(5, 7), 10);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = `${currentMonth}-01`;
  const monthEnd = `${currentMonth}-${String(lastDay).padStart(2, "0")}`;

  return exhibitions.filter(
    (ev) => ev.startDate <= monthEnd && ev.endDate >= monthStart,
  );
}

/**
 * 季節ショートカット月ボタン押下時の遷移先年月と初期選択日を解決する。
 */
export function resolveJumpMonthTarget(
  monthNum: number,
  availableMonths: readonly string[],
  initialDate: string,
): { targetMonth: string; targetDate: string } | null {
  if (monthNum < 1 || monthNum > 12) return null;
  const mm = String(monthNum).padStart(2, "0");
  const anchorMonth = initialDate.slice(0, 7);
  const matchingMonths = availableMonths.filter((m) => m.endsWith(`-${mm}`));
  const chosen =
    matchingMonths.find((m) => m >= anchorMonth) ?? matchingMonths[0];
  if (!chosen) return null;
  const targetDate =
    chosen === initialDate.slice(0, 7) ? initialDate : `${chosen}-01`;
  return { targetMonth: chosen, targetDate };
}
