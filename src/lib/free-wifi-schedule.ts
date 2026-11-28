import type {
  FacilitySchedule,
  StructuredSchedule,
  TimeRange,
} from "./free-wifi-schema";

import { getJstDateParts, type JstDateParts } from "./jst-date";

export { getJstDateParts, type JstDateParts } from "./jst-date";

export interface OpenEvaluation {
  status: "open" | "closed" | "outdoor" | "unknown";
  label: string;
  reason: string | null;
  todayHoursText: string | null;
}

const WEEKDAY_NAMES_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

function parseYmdToUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((v) => Number.parseInt(v, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUtcDateParts(dt: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  ymd: string;
  mmdd: string;
  nthOfWeekday: number;
} {
  const year = dt.getUTCFullYear();
  const month = dt.getUTCMonth() + 1;
  const day = dt.getUTCDate();
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return {
    year,
    month,
    day,
    weekday: dt.getUTCDay(),
    ymd: `${year}-${mm}-${dd}`,
    mmdd: `${mm}-${dd}`,
    nthOfWeekday: Math.floor((day - 1) / 7) + 1,
  };
}

function shiftYmd(ymd: string, deltaDays: number) {
  const dt = parseYmdToUtc(ymd);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return formatUtcDateParts(dt);
}

function isInYearEnd(
  mmdd: string,
  startMmdd: string,
  endMmdd: string,
): boolean {
  if (startMmdd > endMmdd) {
    return mmdd >= startMmdd || mmdd <= endMmdd;
  }
  return mmdd >= startMmdd && mmdd <= endMmdd;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function resolveTodayTimeRange(
  schedule: StructuredSchedule,
  month: number,
  weekday: number,
  isHoliday: boolean,
): TimeRange {
  const seasonal = schedule.seasonalOverrides.find((s) =>
    s.months.includes(month),
  );
  if (seasonal) {
    if (isHoliday && seasonal.holiday) return seasonal.holiday;
    if (weekday === 0 && seasonal.sunday) return seasonal.sunday;
    if (weekday === 6 && seasonal.saturday) return seasonal.saturday;
    if (weekday >= 1 && weekday <= 5 && seasonal.weekday)
      return seasonal.weekday;
  }

  if (schedule.dayHours) {
    if (isHoliday && schedule.dayHours.holiday) {
      return schedule.dayHours.holiday;
    }
    const daySpecific = schedule.dayHours[String(weekday)];
    if (daySpecific) {
      return daySpecific;
    }
  }

  return schedule.defaultHours;
}

function closedResult(reason: string): OpenEvaluation {
  return {
    status: "closed",
    label: "現在閉館中（目安）",
    reason,
    todayHoursText: null,
  };
}

function checkNthWeekdaysClosure(
  schedule: StructuredSchedule,
  jst: JstDateParts,
  holidays: Record<string, string>,
): string | null {
  const isTodayHoliday = Boolean(holidays[jst.ymd]);
  const tomorrow = shiftYmd(jst.ymd, 1);
  const isTomorrowHoliday = Boolean(holidays[tomorrow.ymd]);

  for (const rule of schedule.nthWeekdaysClosed) {
    const matchesTomorrowMonth =
      !rule.months || rule.months.includes(tomorrow.month);
    if (
      matchesTomorrowMonth &&
      tomorrow.nthOfWeekday === rule.nth &&
      tomorrow.weekday === rule.weekday &&
      isTomorrowHoliday &&
      (rule.shiftIfHoliday === "prev_day" ||
        rule.shiftIfHoliday === "both_prev_and_day")
    ) {
      return `第${rule.nth}${WEEKDAY_NAMES_JA[rule.weekday]}曜祝日に伴う前日休館`;
    }

    const matchesTodayMonth = !rule.months || rule.months.includes(jst.month);
    if (
      matchesTodayMonth &&
      jst.nthOfWeekday === rule.nth &&
      jst.weekday === rule.weekday
    ) {
      if (!isTodayHoliday) {
        return `定期休館日（第${rule.nth}${WEEKDAY_NAMES_JA[rule.weekday]}曜）`;
      }
      if (
        rule.shiftIfHoliday === "none" ||
        rule.shiftIfHoliday === "both_prev_and_day"
      ) {
        return `第${rule.nth}${WEEKDAY_NAMES_JA[rule.weekday]}曜休館（祝日振替対象）`;
      }
    }
  }
  return null;
}

function checkMondayHolidayClosure(
  schedule: StructuredSchedule,
  jst: JstDateParts,
  holidays: Record<string, string>,
): { closedReason: string | null; mondayHolidayOpenOverride: boolean } {
  const isTodayHoliday = Boolean(holidays[jst.ymd]);

  if (schedule.mondayHolidayRule === "close_monday_and_next_day") {
    if (jst.weekday === 2) {
      const yesterday = shiftYmd(jst.ymd, -1);
      if (holidays[yesterday.ymd]) {
        return {
          closedReason: `月曜祝日（${holidays[yesterday.ymd]}）の翌日休館`,
          mondayHolidayOpenOverride: false,
        };
      }
    }
    return { closedReason: null, mondayHolidayOpenOverride: false };
  }

  if (schedule.mondayHolidayRule === "open_and_close_next_day_if_not_holiday") {
    if (jst.weekday === 1 && isTodayHoliday) {
      return { closedReason: null, mondayHolidayOpenOverride: true };
    }
    if (jst.weekday === 2 && !isTodayHoliday) {
      const yesterday = shiftYmd(jst.ymd, -1);
      if (holidays[yesterday.ymd]) {
        return {
          closedReason: `月曜祝日（${holidays[yesterday.ymd]}）の振替休館`,
          mondayHolidayOpenOverride: false,
        };
      }
    }
    return { closedReason: null, mondayHolidayOpenOverride: false };
  }

  if (schedule.mondayHolidayRule === "open_and_close_next_weekday") {
    if (jst.weekday === 1 && isTodayHoliday) {
      return { closedReason: null, mondayHolidayOpenOverride: true };
    }
    if (jst.weekday >= 2 && jst.weekday <= 5 && !isTodayHoliday) {
      // If yesterday back through Monday was an unbroken chain of holidays including Monday,
      // today is the next weekday ("翌平日") after the Monday holiday.
      let cursor = shiftYmd(jst.ymd, -1);
      while (holidays[cursor.ymd] && cursor.weekday >= 1) {
        if (cursor.weekday === 1) {
          return {
            closedReason: `月曜祝日（${holidays[cursor.ymd]}）の翌平日振替休館`,
            mondayHolidayOpenOverride: false,
          };
        }
        cursor = shiftYmd(cursor.ymd, -1);
      }
    }
  }

  return { closedReason: null, mondayHolidayOpenOverride: false };
}

function checkDayAfterHolidayClosure(
  schedule: StructuredSchedule,
  jst: JstDateParts,
  holidays: Record<string, string>,
): string | null {
  if (!schedule.dayAfterHolidayClosed) return null;

  for (let offset = 1; offset <= 6; offset++) {
    const past = shiftYmd(jst.ymd, -offset);
    const holidayName = holidays[past.ymd];
    if (!holidayName) continue;

    let candidate = shiftYmd(past.ymd, 1);
    for (let step = 0; step < 10; step++) {
      const isWeekend = candidate.weekday === 0 || candidate.weekday === 6;
      const isCandHoliday = Boolean(holidays[candidate.ymd]);
      const isRegularClosed = !schedule.openDays.includes(candidate.weekday);
      if (!isWeekend && !isCandHoliday && !isRegularClosed) {
        break;
      }
      candidate = shiftYmd(candidate.ymd, 1);
    }

    if (candidate.ymd === jst.ymd) {
      return `祝日（${holidayName}）の振替休館`;
    }
  }

  return null;
}

/**
 * 構造化スケジュールと祝日辞書に基づき、指定時刻（JST評価）の開館・利用状況を判定する。
 */
export function evaluateOpenStatus(
  schedule: FacilitySchedule,
  now: Date,
  holidays: Record<string, string>,
): OpenEvaluation {
  if (schedule.kind === "outdoor_24h") {
    return {
      status: "outdoor",
      label: "屋外・終日目安",
      reason: null,
      todayHoursText: null,
    };
  }

  if (schedule.kind === "check_official") {
    return {
      status: "unknown",
      label: "開館時間要確認",
      reason: null,
      todayHoursText: null,
    };
  }

  const jst = getJstDateParts(now);

  if (
    schedule.yearEndClosed &&
    isInYearEnd(
      jst.mmdd,
      schedule.yearEndClosed.startMmdd,
      schedule.yearEndClosed.endMmdd,
    )
  ) {
    return closedResult("年末年始休館");
  }

  const nthClosedReason = checkNthWeekdaysClosure(schedule, jst, holidays);
  if (nthClosedReason) {
    return closedResult(nthClosedReason);
  }

  const dayAfterReason = checkDayAfterHolidayClosure(schedule, jst, holidays);
  if (dayAfterReason) {
    return closedResult(dayAfterReason);
  }

  const mondayHoliday = checkMondayHolidayClosure(schedule, jst, holidays);
  if (mondayHoliday.closedReason) {
    return closedResult(mondayHoliday.closedReason);
  }

  const holidayName = holidays[jst.ymd];
  const isTodayHoliday = Boolean(holidayName);
  if (
    isTodayHoliday &&
    (schedule.closedOnHolidays === "always" ||
      (schedule.closedOnHolidays === "except_sunday" && jst.weekday !== 0))
  ) {
    return closedResult(`祝日休館（${holidayName}）`);
  }

  if (
    !mondayHoliday.mondayHolidayOpenOverride &&
    !schedule.openDays.includes(jst.weekday)
  ) {
    return closedResult(`休館曜日（${WEEKDAY_NAMES_JA[jst.weekday]}曜）`);
  }

  const hours = resolveTodayTimeRange(
    schedule,
    jst.month,
    jst.weekday,
    isTodayHoliday,
  );
  const todayHoursText = `${formatMinutes(hours.openMinutes)}〜${formatMinutes(hours.closeMinutes)}`;

  if (
    jst.minutesOfDay >= hours.openMinutes &&
    jst.minutesOfDay < hours.closeMinutes
  ) {
    return {
      status: "open",
      label: "今開館中（目安）",
      reason: null,
      todayHoursText,
    };
  }

  return {
    status: "closed",
    label: "現在閉館中（目安）",
    reason:
      jst.minutesOfDay < hours.openMinutes
        ? `本日の開館前（${todayHoursText}）`
        : `本日の閉館後（${todayHoursText}）`,
    todayHoursText,
  };
}

/**
 * 2点間の測地線近似距離（Haversine公式, km）を返す。
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}
