import { z } from "zod";

export const crowdLevels = [
  "low",
  "moderate",
  "busy",
  "very_busy",
  "closed",
] as const;
export const crowdLevelSchema = z.enum(crowdLevels);
export type CrowdLevel = z.infer<typeof crowdLevelSchema>;

export const eventScopes = ["castle", "downtown", "nearby_exhibition"] as const;
export const eventScopeSchema = z.enum(eventScopes);
export type EventScope = z.infer<typeof eventScopeSchema>;

export const datePrecisions = ["exact", "estimated", "tentative"] as const;
export const datePrecisionSchema = z.enum(datePrecisions);
export type DatePrecision = z.infer<typeof datePrecisionSchema>;

export const dataCoverages = [
  "events_included",
  "stats_and_holidays_only",
] as const;
export const dataCoverageSchema = z.enum(dataCoverages);
export type DataCoverage = z.infer<typeof dataCoverageSchema>;

export const hoursTypes = [
  "regular",
  "gw_extended",
  "summer_extended",
  "new_year",
  "closed",
] as const;
export const hoursTypeSchema = z.enum(hoursTypes);
export type HoursType = z.infer<typeof hoursTypeSchema>;

export const crowdFactorKinds = [
  "monthly_baseline",
  "weekday_holiday",
  "peak_season",
  "event",
] as const;
export const crowdFactorKindSchema = z.enum(crowdFactorKinds);
export type CrowdFactorKind = z.infer<typeof crowdFactorKindSchema>;

export const dateYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be formatted as YYYY-MM-DD");

export const castleEventSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/, "id must be lowercase alphanumeric with hyphens"),
    sourceRecordId: z.string().min(1),
    name: z.string().min(1),
    scope: eventScopeSchema,
    category: z.string(),
    startDate: dateYmdSchema,
    endDate: dateYmdSchema,
    datePrecision: datePrecisionSchema,
    dateNote: z.string().min(1),
    venue: z.string().min(1),
    address: z.string().nullable(),
    summary: z.string().nullable(),
    impactPoints: z.number().int().min(0).max(30),
    isNightEvent: z.boolean(),
    trafficNote: z.string().nullable(),
    officialUrl: z.url().nullable(),
    contact: z.string().nullable(),
  })
  .refine((ev) => ev.startDate <= ev.endDate, {
    message: "startDate must be on or before endDate",
  })
  .refine((ev) => ev.scope !== "nearby_exhibition" || ev.impactPoints === 0, {
    message: "nearby_exhibition events must have impactPoints === 0",
  });
export type CastleEvent = z.infer<typeof castleEventSchema>;

export const monthlyWeatherSchema = z.object({
  meanTempC: z.number(),
  maxTempC: z.number(),
  minTempC: z.number(),
  precipitationMm: z.number().nonnegative(),
  sunshineHours: z.number().nonnegative(),
});
export type MonthlyWeather = z.infer<typeof monthlyWeatherSchema>;

export const monthlyStatSchema = z.object({
  month: z.number().int().min(1).max(12),
  avgVisitors: z.number().int().positive(),
  avgDailyVisitors: z.number().int().positive(),
  yearlyVisitors: z.object({
    y2023: z.number().int().positive(),
    y2024: z.number().int().positive(),
    y2025: z.number().int().positive(),
  }),
  baselineScore: z.number().int().min(0).max(35),
  weather: monthlyWeatherSchema,
  seasonTag: z.string().min(1),
  seasonTip: z.string().min(1),
});
export type MonthlyStat = z.infer<typeof monthlyStatSchema>;

export const crowdFactorSchema = z.object({
  kind: crowdFactorKindSchema,
  label: z.string().min(1),
  points: z.number().int(),
});
export type CrowdFactor = z.infer<typeof crowdFactorSchema>;

export const calendarDaySchema = z.object({
  date: dateYmdSchema,
  dayOfWeek: z.number().int().min(0).max(6),
  isWeekend: z.boolean(),
  holidayName: z.string().nullable(),
  isLongWeekend: z.boolean(),
  dataCoverage: dataCoverageSchema,
  crowdLevel: crowdLevelSchema,
  crowdScore: z.number().int().min(0).max(100).nullable(),
  factors: z.array(crowdFactorSchema),
  hoursType: hoursTypeSchema,
  hoursLabel: z.string().min(1),
  lastEntryLabel: z.string().nullable(),
  eventIds: z.array(z.string().min(1)),
  advice: z.array(z.string().min(1)),
});
export type CalendarDay = z.infer<typeof calendarDaySchema>;

export const matsumotoCastleDatasetSchema = z.object({
  version: z.literal("1.0"),
  generatedAt: dateYmdSchema,
  site: z.url(),
  range: z.object({
    startDate: dateYmdSchema,
    endDate: dateYmdSchema,
    eventsCoveredUntil: dateYmdSchema,
  }),
  annualAvgVisitors: z.number().int().positive(),
  notice: z.string().min(1),
  officialLinks: z.object({
    home: z.url(),
    info: z.url(),
    eventCalendar: z.url(),
    eTicket: z.url(),
  }),
  sources: z.object({
    events: z.object({
      name: z.string().min(1),
      sourceUrl: z.url(),
      license: z.string().min(1),
      attribution: z.string().min(1),
    }),
    tourismMonthly: z.object({
      name: z.string().min(1),
      sourceUrl: z.url(),
      license: z.string().min(1),
      attribution: z.string().min(1),
    }),
    weather: z.object({
      name: z.string().min(1),
      sourceUrl: z.url(),
      license: z.string().min(1),
      attribution: z.string().min(1),
    }),
    holidays: z.object({
      name: z.string().min(1),
      sourceUrl: z.url(),
      license: z.string().min(1),
      attribution: z.string().min(1),
    }),
  }),
  monthlyStats: z.array(monthlyStatSchema).length(12),
  events: z.array(castleEventSchema).min(1),
  days: z.array(calendarDaySchema).min(1),
});
export type MatsumotoCastleDataset = z.infer<
  typeof matsumotoCastleDatasetSchema
>;
