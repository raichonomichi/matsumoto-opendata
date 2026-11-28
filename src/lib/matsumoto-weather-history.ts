import { getJstDateParts } from "./jst-date";

export const comparisonYears = [1, 5, 10] as const;

export interface DailyTemperatures {
  minC: number;
  maxC: number;
  provisional?: boolean;
}

export type WeatherHistory = Readonly<
  Record<string, DailyTemperatures | null | undefined>
>;

export interface WeatherObservation {
  date: string;
  temperatures: DailyTemperatures;
}

function findObservation(
  history: WeatherHistory,
  year: number,
  month: number,
  day: number,
): WeatherObservation | null {
  const date = new Date(Date.UTC(year, month - 1, day))
    .toISOString()
    .slice(0, 10);
  const temperatures = history[date];
  return temperatures ? { date, temperatures } : null;
}

function findNearestObservation(
  history: WeatherHistory,
  year: number,
  month: number,
  day: number,
): WeatherObservation | null {
  const exact = findObservation(history, year, month, day);
  if (exact) return exact;

  for (let days = 1; days <= 7; days++) {
    const match =
      findObservation(history, year, month, day - days) ??
      findObservation(history, year, month, day + days);
    if (match) return match;
  }
  return null;
}

export function getWeatherComparisons(history: WeatherHistory, now: Date) {
  const { year, month, day, ymd, mmdd } = getJstDateParts(now);
  const comparisons = comparisonYears.map((yearsAgo) => {
    const targetYear = year - yearsAgo;
    const lastDayOfMonth = new Date(
      Date.UTC(targetYear, month, 0),
    ).getUTCDate();
    const requestedOn = `${targetYear}-${mmdd}`;
    const observation = findNearestObservation(
      history,
      targetYear,
      month,
      Math.min(day, lastDayOfMonth),
    );
    return { yearsAgo, requestedOn, observation };
  });
  return { today: ymd, comparisons };
}
