import type {
  CalendarDay,
  CastleEvent,
  CrowdFactor,
  CrowdLevel,
  HoursType,
  MonthlyStat,
} from "../../src/lib/matsumoto-castle-schema";

const MS_PER_DAY = 86_400_000;

function parseYmdUtc(ymd: string): number {
  const [y, m, d] = ymd.split("-").map((n) => Number.parseInt(n, 10));
  return Date.UTC(y, m - 1, d);
}

function formatUtcYmd(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function enumerateDates(startDate: string, endDate: string): string[] {
  const startMs = parseYmdUtc(startDate);
  const endMs = parseYmdUtc(endDate);
  const dates: string[] = [];
  for (let ms = startMs; ms <= endMs; ms += MS_PER_DAY) {
    dates.push(formatUtcYmd(ms));
  }
  return dates;
}

export function getCastleOpeningHours(date: string): {
  hoursType: HoursType;
  hoursLabel: string;
  lastEntryLabel: string | null;
} {
  const mmdd = date.slice(5);
  if (mmdd >= "12-29" && mmdd <= "12-31") {
    return {
      hoursType: "closed",
      hoursLabel: "年末休城（入場不可）",
      lastEntryLabel: null,
    };
  }
  if (mmdd >= "01-01" && mmdd <= "01-03") {
    return {
      hoursType: "new_year",
      hoursLabel: "10:00〜15:30（正月三が日）",
      lastEntryLabel: "15:00",
    };
  }
  if (
    (date >= "2026-04-25" && date <= "2026-05-06") ||
    (date >= "2027-04-29" && date <= "2027-05-05")
  ) {
    return {
      hoursType: "gw_extended",
      hoursLabel: "8:00〜18:00（GW延長）",
      lastEntryLabel: "17:30",
    };
  }
  if (
    (date >= "2026-08-08" && date <= "2026-08-16") ||
    (date >= "2027-08-07" && date <= "2027-08-15")
  ) {
    return {
      hoursType: "summer_extended",
      hoursLabel: "8:00〜18:00（夏季延長・和服無料）",
      lastEntryLabel: "17:30",
    };
  }
  return {
    hoursType: "regular",
    hoursLabel: "8:30〜17:00",
    lastEntryLabel: "16:30",
  };
}

function getPeakSeasonBoost(
  date: string,
  hasGwOrHolidaySignal: boolean,
): { label: string; points: number } | null {
  const mmdd = date.slice(5);
  if (mmdd >= "05-03" && mmdd <= "05-05") {
    return { label: "ゴールデンウィーク最繁忙期（5/3〜5/5）", points: 35 };
  }
  if (mmdd >= "04-29" && mmdd <= "05-06") {
    return { label: "ゴールデンウィーク期間", points: 28 };
  }
  if (mmdd >= "08-11" && mmdd <= "08-16") {
    return { label: "お盆繁忙期", points: 25 };
  }
  if (mmdd >= "04-05" && mmdd <= "04-18") {
    return { label: "桜の見頃目安シーズン", points: 18 };
  }
  if (mmdd >= "01-01" && mmdd <= "01-03") {
    return { label: "正月三が日", points: 15 };
  }
  if (mmdd >= "10-20" && mmdd <= "11-10") {
    return { label: "紅葉の見頃目安シーズン", points: 10 };
  }
  if (
    (mmdd >= "03-20" && mmdd <= "04-04") ||
    (mmdd >= "07-21" && mmdd <= "08-10") ||
    (mmdd >= "08-17" && mmdd <= "08-25")
  ) {
    return {
      label: hasGwOrHolidaySignal
        ? "春休み・夏休みシーズン"
        : "春休み・夏休み期間",
      points: 8,
    };
  }
  return null;
}

export function classifyCrowdLevel(score: number): CrowdLevel {
  if (score <= 24) return "low";
  if (score <= 49) return "moderate";
  if (score <= 74) return "busy";
  return "very_busy";
}

interface LongWeekendInfo {
  isLongWeekend: boolean;
  isMiddleDay: boolean;
}

function computeLongWeekendMap(
  dates: string[],
  holidays: Map<string, string>,
): Map<string, LongWeekendInfo> {
  const isOffDay = dates.map((date) => {
    const dow = new Date(parseYmdUtc(date)).getUTCDay();
    return dow === 0 || dow === 6 || holidays.has(date);
  });

  const infoMap = new Map<string, LongWeekendInfo>();
  let idx = 0;
  while (idx < dates.length) {
    if (!isOffDay[idx]) {
      infoMap.set(dates[idx], { isLongWeekend: false, isMiddleDay: false });
      idx++;
      continue;
    }
    let end = idx;
    while (end + 1 < dates.length && isOffDay[end + 1]) {
      end++;
    }
    const blockLen = end - idx + 1;
    const isLong = blockLen >= 3;
    for (let k = idx; k <= end; k++) {
      infoMap.set(dates[k], {
        isLongWeekend: isLong,
        isMiddleDay: isLong && k > idx && k < end,
      });
    }
    idx = end + 1;
  }

  return infoMap;
}

export interface BuildCalendarDaysOptions {
  startDate: string;
  endDate: string;
  eventsCoveredUntil: string;
  holidays: Map<string, string>;
  monthlyStats: MonthlyStat[];
  events: CastleEvent[];
}

export function buildCalendarDays(
  options: BuildCalendarDaysOptions,
): CalendarDay[] {
  const {
    startDate,
    endDate,
    eventsCoveredUntil,
    holidays,
    monthlyStats,
    events,
  } = options;

  const dates = enumerateDates(startDate, endDate);
  const longWeekendMap = computeLongWeekendMap(dates, holidays);
  const statsByMonth = new Map(monthlyStats.map((s) => [s.month, s]));
  const scoringEvents = events.filter(
    (ev) => ev.scope === "castle" || ev.scope === "downtown",
  );

  return dates.map((date) => {
    const dow = new Date(parseYmdUtc(date)).getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const holidayName = holidays.get(date) ?? null;
    const lwInfo = longWeekendMap.get(date) ?? {
      isLongWeekend: false,
      isMiddleDay: false,
    };
    const dataCoverage =
      date <= eventsCoveredUntil
        ? "events_included"
        : "stats_and_holidays_only";
    const hours = getCastleOpeningHours(date);
    const month = Number.parseInt(date.slice(5, 7), 10);
    const monthStat = statsByMonth.get(month);
    if (!monthStat) {
      throw new Error(`Missing monthly stat for month ${month}`);
    }

    const activeEvents =
      dataCoverage === "events_included"
        ? scoringEvents.filter(
            (ev) => date >= ev.startDate && date <= ev.endDate,
          )
        : [];
    const eventIds = activeEvents.map((ev) => ev.id);

    if (hours.hoursType === "closed") {
      return {
        date,
        dayOfWeek: dow,
        isWeekend,
        holidayName,
        isLongWeekend: lwInfo.isLongWeekend,
        dataCoverage,
        crowdLevel: "closed",
        crowdScore: null,
        factors: [],
        hoursType: hours.hoursType,
        hoursLabel: hours.hoursLabel,
        lastEntryLabel: hours.lastEntryLabel,
        eventIds: [],
        advice: [
          "12月29日〜31日は年末休城のため天守・本丸庭園へ入場できません。",
        ],
      };
    }

    const factors: CrowdFactor[] = [
      {
        kind: "monthly_baseline",
        label: `${month}月の実測観覧傾向（平均約${monthStat.avgDailyVisitors.toLocaleString("ja-JP")}人/日）`,
        points: monthStat.baselineScore,
      },
    ];

    const isOff = isWeekend || holidayName !== null;
    if (lwInfo.isLongWeekend) {
      factors.push({
        kind: "weekday_holiday",
        label: lwInfo.isMiddleDay ? "3連休以上の中日" : "3連休以上の連休",
        points: lwInfo.isMiddleDay ? 32 : 30,
      });
    } else if (isOff) {
      factors.push({
        kind: "weekday_holiday",
        label: holidayName ? `祝日（${holidayName}）` : "土日",
        points: 22,
      });
    } else if (dow === 1 || dow === 5) {
      factors.push({
        kind: "weekday_holiday",
        label: dow === 1 ? "月曜日（週末前後）" : "金曜日（週末前後）",
        points: 5,
      });
    } else {
      factors.push({
        kind: "weekday_holiday",
        label: "火〜木曜日の平日（比較的空きやすい曜日）",
        points: 0,
      });
    }

    const peakBoost = getPeakSeasonBoost(date, isOff);
    if (peakBoost) {
      factors.push({
        kind: "peak_season",
        label: peakBoost.label,
        points: peakBoost.points,
      });
    }

    if (activeEvents.length > 0) {
      const sorted = [...activeEvents].sort(
        (a, b) => b.impactPoints - a.impactPoints,
      );
      const maxPoints = sorted[0].impactPoints;
      const overlapBonus = activeEvents.length > 1 ? 5 : 0;
      const eventPoints = Math.min(30, maxPoints + overlapBonus);
      const label =
        activeEvents.length > 1
          ? `${sorted[0].name} ほか${activeEvents.length - 1}件`
          : sorted[0].name;
      factors.push({
        kind: "event",
        label,
        points: eventPoints,
      });
    }

    const rawScore = factors.reduce((sum, f) => sum + f.points, 0);
    const crowdScore = Math.max(0, Math.min(100, rawScore));
    const crowdLevel = classifyCrowdLevel(crowdScore);

    const advice: string[] = [];
    if (crowdLevel === "very_busy" || crowdLevel === "busy") {
      advice.push(
        "混雑が予想されるため、日時指定の電子チケット事前購入と開場直後の入場がおすすめです。",
      );
    } else if (crowdLevel === "low") {
      advice.push("比較的ゆとりを持って天守や本丸庭園を巡れる狙い目の日です。");
    }

    if (hours.hoursType === "summer_extended") {
      advice.push(
        "夏季延長期間のため8:00から開場しています（和服での来場者は本丸庭園・天守入場無料）。",
      );
    } else if (hours.hoursType === "gw_extended") {
      advice.push("GW延長期間のため8:00〜18:00で開場しています。");
    }

    if (month === 12 || month === 1 || month === 2) {
      advice.push(
        "天守内は土足禁止で木製の床や急階段が冷え込むため、厚手の靴下と防寒具をご用意ください。",
      );
    }

    const trafficEvents = activeEvents.filter((ev) => ev.trafficNote !== null);
    if (trafficEvents.length > 0 && trafficEvents[0].trafficNote) {
      advice.push(trafficEvents[0].trafficNote);
    }

    if (
      activeEvents.some((ev) => ev.isNightEvent) &&
      activeEvents.every((ev) => ev.isNightEvent)
    ) {
      advice.push(
        "夜間中心のイベントのため、日中の天守観覧と夜のライトアップ・催しを組み合わせて楽しめます。",
      );
    }

    return {
      date,
      dayOfWeek: dow,
      isWeekend,
      holidayName,
      isLongWeekend: lwInfo.isLongWeekend,
      dataCoverage,
      crowdLevel,
      crowdScore,
      factors,
      hoursType: hours.hoursType,
      hoursLabel: hours.hoursLabel,
      lastEntryLabel: hours.lastEntryLabel,
      eventIds,
      advice: advice.slice(0, 3),
    };
  });
}
