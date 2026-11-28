import { getJstDateParts, type JstDateParts } from "./jst-date";
import type {
  BathSchedule,
  BathSeasonalOverride,
  BathStructuredSchedule,
  BathTimeWindow,
} from "./sentou-schema";

export { getJstDateParts, type JstDateParts } from "./jst-date";

export type TimePreset = "now" | "today_17" | "today_20" | "tomorrow_08";

export interface BathAvailability {
  status:
    | "open_now"
    | "opening_later_today"
    | "closed_today"
    | "check_official"
    | "not_public";
  canEnterToday: boolean;
  label: string;
  detailText: string | null;
  todayHoursText: string | null;
  minutesUntilLastEntry: number | null;
  minutesUntilOpen: number | null;
}

const WEEKDAY_NAMES_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function formatBathMinutes(minutes: number): string {
  if (minutes >= 1440) return "24:00";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function formatDurationJa(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}

export function buildTargetDateForPreset(now: Date, preset: TimePreset): Date {
  if (preset === "now") return now;
  const jst = getJstDateParts(now);
  if (preset === "today_17") {
    return new Date(Date.UTC(jst.year, jst.month - 1, jst.day, 17 - 9, 0, 0));
  }
  if (preset === "today_20") {
    return new Date(Date.UTC(jst.year, jst.month - 1, jst.day, 20 - 9, 0, 0));
  }
  return new Date(Date.UTC(jst.year, jst.month - 1, jst.day + 1, 8 - 9, 0, 0));
}

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

function isInMmddRange(
  mmdd: string,
  startMmdd: string,
  endMmdd: string,
): boolean {
  if (startMmdd > endMmdd) {
    return mmdd >= startMmdd || mmdd <= endMmdd;
  }
  return mmdd >= startMmdd && mmdd <= endMmdd;
}

function findMatchingSeasonalOverride(
  schedule: BathStructuredSchedule,
  jst: JstDateParts,
): BathSeasonalOverride | undefined {
  return schedule.seasonalOverrides.find((ov) => {
    if (ov.months && !ov.months.includes(jst.month)) {
      return false;
    }
    if (
      ov.startMmdd &&
      ov.endMmdd &&
      !isInMmddRange(jst.mmdd, ov.startMmdd, ov.endMmdd)
    ) {
      return false;
    }
    return Boolean(ov.months || (ov.startMmdd && ov.endMmdd));
  });
}

function resolveTodaySessions(
  schedule: BathStructuredSchedule,
  seasonal: BathSeasonalOverride | undefined,
  weekday: number,
  isHoliday: boolean,
): BathTimeWindow[] {
  if (seasonal) {
    if (isHoliday && seasonal.holiday) return seasonal.holiday;
    if (weekday === 0 && seasonal.sunday) return seasonal.sunday;
    if (weekday === 6 && seasonal.saturday) return seasonal.saturday;
    if (weekday >= 1 && weekday <= 5 && seasonal.weekday) {
      return seasonal.weekday;
    }
  }

  if (schedule.daySessions) {
    if (isHoliday && schedule.daySessions.holiday) {
      return schedule.daySessions.holiday;
    }
    const byDay = schedule.daySessions[String(weekday)];
    if (byDay) return byDay;
  }

  return schedule.defaultSessions;
}

function formatTodayHoursText(sessions: BathTimeWindow[]): string {
  if (sessions.length === 1) {
    const s = sessions[0];
    const range = `${formatBathMinutes(s.openMinutes)}〜${formatBathMinutes(s.closeMinutes)}`;
    return s.lastEntryMinutes < s.closeMinutes
      ? `${range}（最終受付 ${formatBathMinutes(s.lastEntryMinutes)}）`
      : range;
  }
  return sessions
    .map(
      (s) =>
        `${formatBathMinutes(s.openMinutes)}〜${formatBathMinutes(s.closeMinutes)}(受付${formatBathMinutes(s.lastEntryMinutes)})`,
    )
    .join(" / ");
}

function closedTodayResult(
  label: string,
  detailText: string,
  todayHoursText: string | null = null,
): BathAvailability {
  return {
    status: "closed_today",
    canEnterToday: false,
    label,
    detailText,
    todayHoursText,
    minutesUntilLastEntry: null,
    minutesUntilOpen: null,
  };
}

function checkHolidayRule(
  rule: BathStructuredSchedule["holidayRule"],
  effectiveOpenDays: number[],
  jst: JstDateParts,
  holidays: Record<string, string>,
): { closedDetail: string | null; holidayOpenOverride: boolean } {
  const todayHolidayName = holidays[jst.ymd];
  const isTodayHoliday = Boolean(todayHolidayName);

  if (rule === "closed_on_holidays") {
    if (isTodayHoliday) {
      return {
        closedDetail: `祝日休館（${todayHolidayName}）`,
        holidayOpenOverride: false,
      };
    }
    return { closedDetail: null, holidayOpenOverride: false };
  }

  if (rule === "open_closed_weekday_shift_next_day") {
    const yesterday = shiftYmd(jst.ymd, -1);
    const yHolName = holidays[yesterday.ymd];
    if (yHolName && !effectiveOpenDays.includes(yesterday.weekday)) {
      return {
        closedDetail: `${WEEKDAY_NAMES_JA[yesterday.weekday]}曜祝日（${yHolName}）の翌日振替休館`,
        holidayOpenOverride: false,
      };
    }
    if (!effectiveOpenDays.includes(jst.weekday) && isTodayHoliday) {
      return { closedDetail: null, holidayOpenOverride: true };
    }
    return { closedDetail: null, holidayOpenOverride: false };
  }

  if (rule === "open_closed_weekday_shift_next_weekday") {
    if (!effectiveOpenDays.includes(jst.weekday) && isTodayHoliday) {
      return { closedDetail: null, holidayOpenOverride: true };
    }
    if (
      jst.weekday >= 1 &&
      jst.weekday <= 5 &&
      !isTodayHoliday &&
      effectiveOpenDays.includes(jst.weekday)
    ) {
      let cursor = shiftYmd(jst.ymd, -1);
      for (let step = 0; step < 14; step++) {
        const cHoliday = holidays[cursor.ymd];
        const isWeekend = cursor.weekday === 0 || cursor.weekday === 6;
        if (!cHoliday && !isWeekend) {
          break;
        }
        if (cHoliday && !effectiveOpenDays.includes(cursor.weekday)) {
          return {
            closedDetail: `${WEEKDAY_NAMES_JA[cursor.weekday]}曜祝日（${cHoliday}）の翌平日振替休館`,
            holidayOpenOverride: false,
          };
        }
        cursor = shiftYmd(cursor.ymd, -1);
      }
    }
  }

  return { closedDetail: null, holidayOpenOverride: false };
}

/**
 * 温浴施設の構造化スケジュールと祝日辞書から、指定日時（JST基準）に入浴できるかを判定する。
 */
export function evaluateBathAvailability(
  schedule: BathSchedule,
  targetDate: Date,
  holidays: Record<string, string>,
): BathAvailability {
  if (schedule.kind === "not_public") {
    return {
      status: "not_public",
      canEnterToday: false,
      label: "一般外来不可",
      detailText: schedule.summaryText,
      todayHoursText: null,
      minutesUntilLastEntry: null,
      minutesUntilOpen: null,
    };
  }

  if (schedule.kind === "check_official") {
    return {
      status: "check_official",
      canEnterToday: false,
      label: "利用条件・営業時間要確認",
      detailText: schedule.summaryText,
      todayHoursText: null,
      minutesUntilLastEntry: null,
      minutesUntilOpen: null,
    };
  }

  const jst = getJstDateParts(targetDate);
  const holidayName = holidays[jst.ymd];
  const isTodayHoliday = Boolean(holidayName);

  if (
    schedule.seasonalClosure &&
    isInMmddRange(
      jst.mmdd,
      schedule.seasonalClosure.startMmdd,
      schedule.seasonalClosure.endMmdd,
    )
  ) {
    return closedTodayResult(
      "冬季休業中（目安）",
      schedule.seasonalClosure.label,
    );
  }

  if (
    schedule.yearEndClosed &&
    isInMmddRange(
      jst.mmdd,
      schedule.yearEndClosed.startMmdd,
      schedule.yearEndClosed.endMmdd,
    )
  ) {
    return closedTodayResult("年末年始休業（目安）", "年末年始休業期間");
  }

  for (const rule of schedule.nthWeekdaysClosed) {
    if (jst.nthOfWeekday === rule.nth && jst.weekday === rule.weekday) {
      if (isTodayHoliday) {
        if (rule.shiftIfHoliday === "open_holiday") {
          continue;
        }
        if (rule.shiftIfHoliday === "check_official") {
          return {
            status: "check_official",
            canEnterToday: false,
            label: "祝日振替要確認",
            detailText: `第${rule.nth}${WEEKDAY_NAMES_JA[rule.weekday]}曜が祝日のため振替休館日を公式案内でご確認ください`,
            todayHoursText: null,
            minutesUntilLastEntry: null,
            minutesUntilOpen: null,
          };
        }
      }
      return closedTodayResult(
        "本日定休日（目安）",
        `定期休館日（第${rule.nth}${WEEKDAY_NAMES_JA[rule.weekday]}曜）`,
      );
    }
  }

  const seasonal = findMatchingSeasonalOverride(schedule, jst);
  const effectiveOpenDays = seasonal?.openDaysOverride ?? schedule.openDays;

  const holidayCheck = checkHolidayRule(
    schedule.holidayRule,
    effectiveOpenDays,
    jst,
    holidays,
  );
  if (holidayCheck.closedDetail) {
    return closedTodayResult("本日定休日（目安）", holidayCheck.closedDetail);
  }

  const seasonalHolidayOpen =
    Boolean(seasonal?.openOnHolidaysOverride) && isTodayHoliday;
  if (
    !holidayCheck.holidayOpenOverride &&
    !seasonalHolidayOpen &&
    !effectiveOpenDays.includes(jst.weekday)
  ) {
    const reason = seasonal?.note
      ? `定休曜日（${WEEKDAY_NAMES_JA[jst.weekday]}曜・${seasonal.note}）`
      : `定休曜日（${WEEKDAY_NAMES_JA[jst.weekday]}曜）`;
    return closedTodayResult("本日定休日（目安）", reason);
  }

  const sessions = resolveTodaySessions(
    schedule,
    seasonal,
    jst.weekday,
    isTodayHoliday,
  );
  const todayHoursText = formatTodayHoursText(sessions);
  const nowMinutes = jst.minutesOfDay;

  for (const session of sessions) {
    if (
      nowMinutes >= session.openMinutes &&
      nowMinutes < session.lastEntryMinutes
    ) {
      const remaining = session.lastEntryMinutes - nowMinutes;
      return {
        status: "open_now",
        canEnterToday: true,
        label: "今すぐ入れる（受付中）",
        detailText: `最終受付 ${formatBathMinutes(session.lastEntryMinutes)}まで（あと${formatDurationJa(remaining)}）`,
        todayHoursText,
        minutesUntilLastEntry: remaining,
        minutesUntilOpen: 0,
      };
    }
  }

  const nextSession = sessions.find((s) => nowMinutes < s.openMinutes);
  if (nextSession) {
    const untilOpen = nextSession.openMinutes - nowMinutes;
    return {
      status: "opening_later_today",
      canEnterToday: true,
      label: "今日これから入れる",
      detailText: `本日 ${formatBathMinutes(nextSession.openMinutes)}から営業（最終受付 ${formatBathMinutes(nextSession.lastEntryMinutes)}・開店まであと${formatDurationJa(untilOpen)}）`,
      todayHoursText,
      minutesUntilLastEntry: nextSession.lastEntryMinutes - nowMinutes,
      minutesUntilOpen: untilOpen,
    };
  }

  const lastSession = sessions[sessions.length - 1];
  const afterLastEntryDetail =
    nowMinutes < lastSession.closeMinutes
      ? `本日の最終受付（${formatBathMinutes(lastSession.lastEntryMinutes)}）終了（閉館 ${formatBathMinutes(lastSession.closeMinutes)}）`
      : `本日の受付終了（最終受付 ${formatBathMinutes(lastSession.lastEntryMinutes)}）`;

  return closedTodayResult(
    "本日の受付終了",
    afterLastEntryDetail,
    todayHoursText,
  );
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
