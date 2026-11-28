import type {
  FacilitySchedule,
  NthWeekdayClosed,
  SeasonalHoursOverride,
  StructuredSchedule,
  TimeRange,
} from "../../src/lib/free-wifi-schema";

const WEEKDAY_CHAR_TO_NUM: Record<string, number> = {
  日: 0,
  月: 1,
  火: 2,
  水: 3,
  木: 4,
  金: 5,
  土: 6,
};

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export interface ScheduleInput {
  openDaysRaw: string;
  startRaw: string;
  endRaw: string;
  noteRaw: string;
  facilityName?: string;
}

function parseTimeToMinutes(raw: string): number | null {
  const norm = raw.normalize("NFKC").trim();
  const m = /(\d{1,2}):(\d{2})/.exec(norm);
  if (!m) return null;
  const h = Number.parseInt(m[1], 10);
  const min = Number.parseInt(m[2], 10);
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function parseOpenDays(raw: string): number[] {
  const norm = raw.normalize("NFKC").trim();
  if (!norm) return [];
  if (norm.includes("通年")) return [...ALL_WEEKDAYS];

  const days = new Set<number>();
  for (const ch of norm) {
    const num = WEEKDAY_CHAR_TO_NUM[ch];
    if (num !== undefined) {
      days.add(num);
    }
  }
  return Array.from(days).sort((a, b) => a - b);
}

function parseYearEndClosed(
  noteNorm: string,
): { startMmdd: string; endMmdd: string } | null {
  if (
    /12月?28日?[～〜\-〜~から]+1月?3日?/.test(noteNorm) ||
    /12\/28[～〜\-〜~から]+(?:翌年)?1\/3/.test(noteNorm)
  ) {
    return { startMmdd: "12-28", endMmdd: "01-03" };
  }
  if (
    /12\/29[～〜\-〜~から]+(?:翌年)?1\/3/.test(noteNorm) ||
    /12月?29日?[～〜\-〜~から]+(?:翌年)?1月?3日?/.test(noteNorm)
  ) {
    return { startMmdd: "12-29", endMmdd: "01-03" };
  }
  if (/12月?31日?[～〜\-〜~から]+(?:翌年)?1月?3日?/.test(noteNorm)) {
    return { startMmdd: "12-31", endMmdd: "01-03" };
  }
  if (noteNorm.includes("年末年始")) {
    return { startMmdd: "12-29", endMmdd: "01-03" };
  }
  return null;
}

function parseNthWeekdaysClosed(noteNorm: string): NthWeekdayClosed[] {
  const rules: NthWeekdayClosed[] = [];

  // e.g., 毎月第2・4水曜日 / 第2･4水曜日
  const multiMatch = /第([1-5])[・･,]([1-5])([日月火水木金土])曜/.exec(
    noteNorm,
  );
  if (multiMatch) {
    const n1 = Number.parseInt(multiMatch[1], 10);
    const n2 = Number.parseInt(multiMatch[2], 10);
    const wd = WEEKDAY_CHAR_TO_NUM[multiMatch[3]];
    if (wd !== undefined) {
      rules.push({ nth: n1, weekday: wd, shiftIfHoliday: "none" });
      rules.push({ nth: n2, weekday: wd, shiftIfHoliday: "none" });
    }
  }

  // e.g., 毎月第4金曜日
  const singleRegex = /第([1-5])([日月火水木金土])曜/g;
  for (const m of noteNorm.matchAll(singleRegex)) {
    const nth = Number.parseInt(m[1], 10);
    const wd = WEEKDAY_CHAR_TO_NUM[m[2]];
    if (wd === undefined) continue;
    if (rules.some((r) => r.nth === nth && r.weekday === wd)) continue;

    let shiftIfHoliday: NthWeekdayClosed["shiftIfHoliday"] = "none";
    if (wd === 5 && nth === 4) {
      if (noteNorm.includes("前日と当日が休館")) {
        shiftIfHoliday = "both_prev_and_day";
      } else if (
        noteNorm.includes("前日が休館") ||
        noteNorm.includes("当該日の前日")
      ) {
        shiftIfHoliday = "prev_day";
      }
    }
    rules.push({ nth, weekday: wd, shiftIfHoliday });
  }

  return rules;
}

function cleanClosingNote(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/[~〜]/g, "～")
    .replace(/\s+/g, " ")
    .trim();
}

function formatOpenDaysSummary(
  openDays: number[],
  holidayNote: string | null,
): string {
  if (openDays.length === 7) return "毎日";
  if (openDays.length === 5 && openDays.join(",") === "1,2,3,4,5") {
    return "月〜金（平日）";
  }
  if (openDays.length === 6 && !openDays.includes(1)) {
    return "火〜日";
  }
  if (openDays.length === 6 && !openDays.includes(2)) {
    return "月・水〜日（火曜休）";
  }
  if (holidayNote?.includes("第1・3日曜")) {
    return "毎日（第1・3日曜休館）";
  }
  return openDays
    .map((d) => ["日", "月", "火", "水", "木", "金", "土"][d])
    .join("・");
}

function formatMinutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * 松本デジタルまっぷ「公共施設データ」の開館曜日・開始/終了時間・特記事項から
 * 構造化スケジュールを生成する。
 */
export function parseFacilitySchedule(input: ScheduleInput): FacilitySchedule {
  const openDaysRaw = input.openDaysRaw.trim();
  const startRaw = input.startRaw.trim();
  const endRaw = input.endRaw.trim();
  const noteNorm = cleanClosingNote(input.noteRaw);

  if (
    !openDaysRaw ||
    !startRaw ||
    !endRaw ||
    openDaysRaw === "未定" ||
    startRaw === "未定" ||
    endRaw === "未定" ||
    /令和[56]年秋頃まで休館中/.test(noteNorm)
  ) {
    return {
      kind: "check_official",
      summaryText: "開館時間・休館日は公式案内をご確認ください",
      holidayNote:
        noteNorm && !/令和[56]年秋頃まで休館中/.test(noteNorm)
          ? noteNorm
          : null,
    };
  }

  let openDays = parseOpenDays(openDaysRaw);
  const openMinutes = parseTimeToMinutes(startRaw);
  if (openDays.length === 0 || openMinutes === null) {
    return {
      kind: "check_official",
      summaryText: "開館時間・休館日は公式案内をご確認ください",
      holidayNote: noteNorm || null,
    };
  }

  const endNorm = cleanClosingNote(endRaw);
  const yearEndClosed = parseYearEndClosed(noteNorm);
  const nthWeekdaysClosed = parseNthWeekdaysClosed(noteNorm);

  let defaultHours: TimeRange = { openMinutes, closeMinutes: 17 * 60 };
  const dayHours: Record<string, TimeRange> = {};
  const seasonalOverrides: SeasonalHoursOverride[] = [];
  let variableClosingNote: string | null = null;

  // 1) 単純 HH:MM のみ
  if (/^\d{1,2}:\d{2}$/.test(endNorm)) {
    const closeMinutes = parseTimeToMinutes(endNorm);
    if (closeMinutes === null) {
      return {
        kind: "check_official",
        summaryText: "開館時間・休館日は公式案内をご確認ください",
        holidayNote: noteNorm || null,
      };
    }
    defaultHours = { openMinutes, closeMinutes };
  } else if (endNorm.includes("4月～11月") && endNorm.includes("12月～3月")) {
    // 波田図書館 or 波田文化センター
    const mApr = /4月[～〜]11月\s*(\d{1,2}:\d{2})/.exec(endNorm);
    const mDec = /12月[～〜]3月\s*(\d{1,2}:\d{2})/.exec(endNorm);
    const aprClose = mApr ? parseTimeToMinutes(mApr[1]) : 19 * 60;
    const decClose = mDec ? parseTimeToMinutes(mDec[1]) : 17 * 60;
    const weekendMatch = /土[;；・]日[;；・]休日\s*(\d{1,2}:\d{2})/.exec(
      endNorm,
    );

    if (weekendMatch) {
      const weClose = parseTimeToMinutes(weekendMatch[1]) ?? 17 * 60;
      defaultHours = { openMinutes, closeMinutes: aprClose ?? 19 * 60 };
      seasonalOverrides.push({
        months: [4, 5, 6, 7, 8, 9, 10, 11],
        weekday: { openMinutes, closeMinutes: aprClose ?? 19 * 60 },
        saturday: { openMinutes, closeMinutes: weClose },
        sunday: { openMinutes, closeMinutes: weClose },
        holiday: { openMinutes, closeMinutes: weClose },
      });
      seasonalOverrides.push({
        months: [12, 1, 2, 3],
        weekday: { openMinutes, closeMinutes: decClose ?? 17 * 60 },
        saturday: { openMinutes, closeMinutes: weClose },
        sunday: { openMinutes, closeMinutes: weClose },
        holiday: { openMinutes, closeMinutes: weClose },
      });
    } else {
      defaultHours = { openMinutes, closeMinutes: aprClose ?? 22 * 60 };
      seasonalOverrides.push({
        months: [4, 5, 6, 7, 8, 9, 10, 11],
        weekday: { openMinutes, closeMinutes: aprClose ?? 22 * 60 },
        saturday: { openMinutes, closeMinutes: aprClose ?? 22 * 60 },
        sunday: { openMinutes, closeMinutes: aprClose ?? 22 * 60 },
        holiday: { openMinutes, closeMinutes: aprClose ?? 22 * 60 },
      });
      seasonalOverrides.push({
        months: [12, 1, 2, 3],
        weekday: { openMinutes, closeMinutes: decClose ?? 17 * 60 },
        saturday: { openMinutes, closeMinutes: decClose ?? 17 * 60 },
        sunday: { openMinutes, closeMinutes: decClose ?? 17 * 60 },
        holiday: { openMinutes, closeMinutes: decClose ?? 17 * 60 },
      });
    }

    const parenNote = /\(([^)]+)\)/.exec(endNorm);
    if (parenNote) {
      variableClosingNote = parenNote[1];
    }
  } else if (endNorm.includes("夜間利用のない日は")) {
    const maxClose = parseTimeToMinutes(endNorm) ?? 22 * 60;
    defaultHours = { openMinutes, closeMinutes: maxClose };
    const parenNote = /[（(](夜間利用のない日は[^)）]+)[)）]/.exec(endNorm);
    if (parenNote) {
      variableClosingNote = parenNote[1];
    }
  } else if (endNorm.includes("日曜日・休日は17:00")) {
    // 波田公民館: 月;火;水;木;金;土 + 日曜(第1・3休館)・休日は17:00
    const mainClose = parseTimeToMinutes(endNorm) ?? 22 * 60;
    defaultHours = { openMinutes, closeMinutes: mainClose };
    dayHours["0"] = { openMinutes, closeMinutes: 17 * 60 };
    dayHours.holiday = { openMinutes, closeMinutes: 17 * 60 };
    if (!openDays.includes(0)) {
      openDays = [0, ...openDays].sort((a, b) => a - b);
    }
  } else if (endNorm.includes("日曜日のみ17:00")) {
    // 松南地区公民館（なんなんひろば）
    const mainClose = parseTimeToMinutes(endNorm) ?? 22 * 60;
    defaultHours = { openMinutes, closeMinutes: mainClose };
    dayHours["0"] = { openMinutes, closeMinutes: 17 * 60 };
  } else if (endNorm.includes("火～金") && /土[;；]日/.test(endNorm)) {
    const weekdayMatch = /火～金\s*(\d{1,2}:\d{2})/.exec(endNorm);
    const weekendMatch = /土[;；]日(?:[;；]休日)?\s*(\d{1,2}:\d{2})/.exec(
      endNorm,
    );
    const wdClose =
      (weekdayMatch ? parseTimeToMinutes(weekdayMatch[1]) : null) ?? 19 * 60;
    const weClose =
      (weekendMatch ? parseTimeToMinutes(weekendMatch[1]) : null) ?? 17 * 60;
    defaultHours = { openMinutes, closeMinutes: wdClose };
    dayHours["0"] = { openMinutes, closeMinutes: weClose };
    dayHours["6"] = { openMinutes, closeMinutes: weClose };
    if (endNorm.includes("休日")) {
      dayHours.holiday = { openMinutes, closeMinutes: weClose };
    }
  } else if (endNorm.includes("月・水～土") && endNorm.includes("日")) {
    // 南部図書館
    const mainMatch = /月・水～土\s*(\d{1,2}:\d{2})/.exec(endNorm);
    const sunMatch = /日\s*(\d{1,2}:\d{2})/.exec(endNorm);
    const mainClose =
      (mainMatch ? parseTimeToMinutes(mainMatch[1]) : null) ?? 22 * 60;
    const sunClose =
      (sunMatch ? parseTimeToMinutes(sunMatch[1]) : null) ?? 17 * 60;
    defaultHours = { openMinutes, closeMinutes: mainClose };
    dayHours["0"] = { openMinutes, closeMinutes: sunClose };
  } else {
    const fallbackClose = parseTimeToMinutes(endNorm);
    if (fallbackClose === null) {
      return {
        kind: "check_official",
        summaryText: "開館時間・休館日は公式案内をご確認ください",
        holidayNote: noteNorm || null,
      };
    }
    defaultHours = { openMinutes, closeMinutes: fallbackClose };
  }

  // 教育文化センター: 日曜日及び祝日は17:00閉館
  if (noteNorm.includes("日曜日及び祝日は17:00閉館")) {
    dayHours["0"] = { openMinutes, closeMinutes: 17 * 60 };
    dayHours.holiday = { openMinutes, closeMinutes: 17 * 60 };
  }

  // 祝日・振替ルール
  let closedOnHolidays: StructuredSchedule["closedOnHolidays"] = "never";
  if (noteNorm.includes("休日は日曜日を除いて休館")) {
    closedOnHolidays = "except_sunday";
  } else if (
    noteNorm.includes("祝日・年末年始は閉庁") ||
    noteNorm.includes("土日祝日及び12/29～1/3を除く") ||
    /^休日[、,]/.test(noteNorm)
  ) {
    closedOnHolidays = "always";
  }

  let mondayHolidayRule: StructuredSchedule["mondayHolidayRule"] = "none";
  if (noteNorm.includes("翌日も休日の場合は振替休館なし")) {
    mondayHolidayRule = "open_and_close_next_day_if_not_holiday";
  } else if (
    noteNorm.includes("月曜日が祝日の場合は開館し、翌日が休館日") ||
    noteNorm.includes("月曜日が祝日の場合は翌平日が休館日") ||
    noteNorm.includes("月曜日(祝日にあたる時は翌平日)")
  ) {
    mondayHolidayRule = "open_and_close_next_weekday";
  } else if (
    noteNorm.includes(
      "月曜日については当日が休日にあたるときは、当日と翌日が休館",
    )
  ) {
    mondayHolidayRule = "close_monday_and_next_day";
  }

  const dayAfterHolidayClosed =
    noteNorm.includes("休日の翌日は休館") ||
    noteNorm.includes("祝日の翌日(祝日にあたる時は翌平日)");

  // 毎週火曜日休館（総合体育館の 通年 + 毎週火曜日 表記）
  if (noteNorm.includes("毎週火曜日")) {
    openDays = openDays.filter((d) => d !== 2);
  }

  const holidayNote = noteNorm || null;
  const daysLabel = formatOpenDaysSummary(openDays, holidayNote);
  let hoursLabel = `${formatMinutesLabel(defaultHours.openMinutes)}〜${formatMinutesLabel(defaultHours.closeMinutes)}`;
  if (seasonalOverrides.length === 2) {
    hoursLabel = `${formatMinutesLabel(openMinutes)}〜（4〜11月 ${formatMinutesLabel(seasonalOverrides[0].weekday?.closeMinutes ?? defaultHours.closeMinutes)} / 12〜3月 ${formatMinutesLabel(seasonalOverrides[1].weekday?.closeMinutes ?? defaultHours.closeMinutes)}）`;
  } else if (
    dayHours["0"] &&
    dayHours["0"].closeMinutes !== defaultHours.closeMinutes
  ) {
    hoursLabel = `${formatMinutesLabel(defaultHours.openMinutes)}〜${formatMinutesLabel(defaultHours.closeMinutes)}（日曜${dayHours.holiday ? "・祝" : ""}〜${formatMinutesLabel(dayHours["0"].closeMinutes)}）`;
  } else if (
    dayHours["6"] &&
    dayHours["6"].closeMinutes !== defaultHours.closeMinutes
  ) {
    hoursLabel = `${formatMinutesLabel(defaultHours.openMinutes)}〜${formatMinutesLabel(defaultHours.closeMinutes)}（土日${dayHours.holiday ? "・祝" : ""}〜${formatMinutesLabel(dayHours["6"].closeMinutes)}）`;
  }

  return {
    kind: "structured",
    openDays,
    defaultHours,
    ...(Object.keys(dayHours).length > 0 ? { dayHours } : {}),
    seasonalOverrides,
    closedOnHolidays,
    mondayHolidayRule,
    dayAfterHolidayClosed,
    nthWeekdaysClosed,
    yearEndClosed,
    summaryText: `${daysLabel} ${hoursLabel}`,
    holidayNote,
    variableClosingNote,
  };
}

/**
 * 構造化スケジュールからクイック絞り込み・並び替え用の静的フラグを算出する。
 */
export function deriveScheduleFlags(schedule: FacilitySchedule): {
  openLate: boolean;
  openMonday: boolean;
  openWeekend: boolean;
  latestCloseMinutes: number | null;
} {
  if (schedule.kind === "outdoor_24h") {
    return {
      openLate: true,
      openMonday: true,
      openWeekend: true,
      latestCloseMinutes: 1440,
    };
  }

  if (schedule.kind === "check_official") {
    return {
      openLate: false,
      openMonday: false,
      openWeekend: false,
      latestCloseMinutes: null,
    };
  }

  const closeCandidates: number[] = [schedule.defaultHours.closeMinutes];
  if (schedule.dayHours) {
    for (const range of Object.values(schedule.dayHours)) {
      closeCandidates.push(range.closeMinutes);
    }
  }
  for (const seasonal of schedule.seasonalOverrides) {
    if (seasonal.weekday) closeCandidates.push(seasonal.weekday.closeMinutes);
    if (seasonal.saturday) closeCandidates.push(seasonal.saturday.closeMinutes);
    if (seasonal.sunday) closeCandidates.push(seasonal.sunday.closeMinutes);
  }

  const latestCloseMinutes = Math.max(...closeCandidates);
  const openMonday = schedule.openDays.includes(1);
  const openWeekend =
    schedule.openDays.includes(0) || schedule.openDays.includes(6);

  return {
    openLate: latestCloseMinutes >= 19 * 60,
    openMonday,
    openWeekend,
    latestCloseMinutes,
  };
}
