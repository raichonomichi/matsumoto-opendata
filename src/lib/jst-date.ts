export interface JstDateParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  minutesOfDay: number;
  ymd: string;
  mmdd: string;
  nthOfWeekday: number;
}

const jstFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * 任意の Date を日本標準時（Asia/Tokyo）基準の日時パーツへ変換する。
 */
export function getJstDateParts(date: Date): JstDateParts {
  const parts = jstFormatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  const year = Number.parseInt(map.year ?? "1970", 10);
  const month = Number.parseInt(map.month ?? "1", 10);
  const day = Number.parseInt(map.day ?? "1", 10);
  const hour = Number.parseInt(map.hour ?? "0", 10) % 24;
  const minute = Number.parseInt(map.minute ?? "0", 10);

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return {
    year,
    month,
    day,
    weekday,
    minutesOfDay: hour * 60 + minute,
    ymd: `${year}-${mm}-${dd}`,
    mmdd: `${mm}-${dd}`,
    nthOfWeekday: Math.floor((day - 1) / 7) + 1,
  };
}
