import { z } from "zod";

export const bathAreaGroups = [
  "central",
  "asama_utsukushigahara",
  "suburbs",
  "norikura_shirahone",
] as const;
export const bathAreaGroupSchema = z.enum(bathAreaGroups);
export type BathAreaGroup = z.infer<typeof bathAreaGroupSchema>;

export const bathAccessCategories = [
  "public_drop_in",
  "day_use_inn",
  "reservation_required",
  "local_only",
  "eligible_only",
  "members_only",
  "guests_only",
  "check_lodging_or_status",
] as const;
export const bathAccessCategorySchema = z.enum(bathAccessCategories);
export type BathAccessCategory = z.infer<typeof bathAccessCategorySchema>;

export const bathFacilityTypes = [
  "sentou",
  "super_sentou",
  "day_onsen",
  "communal_bath",
  "public_facility",
  "onsen_inn",
  "sauna_retreat",
  "welfare_bath",
  "fitness_golf",
  "lodging_other",
] as const;
export const bathFacilityTypeSchema = z.enum(bathFacilityTypes);
export type BathFacilityType = z.infer<typeof bathFacilityTypeSchema>;

export const bathWaterTypes = [
  "onsen",
  "non_onsen",
  "sauna_specialty",
  "unknown",
] as const;
export const bathWaterTypeSchema = z.enum(bathWaterTypes);
export type BathWaterType = z.infer<typeof bathWaterTypeSchema>;

export const bathTimeWindowSchema = z
  .object({
    openMinutes: z.number().int().min(0).max(1440),
    lastEntryMinutes: z.number().int().min(0).max(1440),
    closeMinutes: z.number().int().min(0).max(1440),
  })
  .refine(
    (w) =>
      w.openMinutes < w.lastEntryMinutes &&
      w.lastEntryMinutes <= w.closeMinutes,
    {
      message: "Time window must satisfy open < lastEntry <= close",
    },
  );
export type BathTimeWindow = z.infer<typeof bathTimeWindowSchema>;

export const bathNthWeekdayClosedSchema = z.object({
  nth: z.number().int().min(1).max(5),
  weekday: z.number().int().min(0).max(6),
  shiftIfHoliday: z
    .enum(["none", "open_holiday", "check_official"])
    .default("none"),
});
export type BathNthWeekdayClosed = z.infer<typeof bathNthWeekdayClosedSchema>;

export const bathSeasonalOverrideSchema = z.object({
  months: z.array(z.number().int().min(1).max(12)).min(1).optional(),
  startMmdd: z
    .string()
    .regex(/^\d{2}-\d{2}$/)
    .optional(),
  endMmdd: z
    .string()
    .regex(/^\d{2}-\d{2}$/)
    .optional(),
  openDaysOverride: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  openOnHolidaysOverride: z.boolean().optional(),
  weekday: z.array(bathTimeWindowSchema).min(1).optional(),
  saturday: z.array(bathTimeWindowSchema).min(1).optional(),
  sunday: z.array(bathTimeWindowSchema).min(1).optional(),
  holiday: z.array(bathTimeWindowSchema).min(1).optional(),
  note: z.string().nullable().optional(),
});
export type BathSeasonalOverride = z.infer<typeof bathSeasonalOverrideSchema>;

export const bathSeasonalClosureSchema = z.object({
  startMmdd: z.string().regex(/^\d{2}-\d{2}$/),
  endMmdd: z.string().regex(/^\d{2}-\d{2}$/),
  label: z.string().min(1),
});
export type BathSeasonalClosure = z.infer<typeof bathSeasonalClosureSchema>;

export const bathStructuredScheduleSchema = z.object({
  kind: z.literal("structured"),
  openDays: z.array(z.number().int().min(0).max(6)).min(1),
  defaultSessions: z.array(bathTimeWindowSchema).min(1),
  daySessions: z
    .record(z.string(), z.array(bathTimeWindowSchema).min(1))
    .optional(),
  seasonalOverrides: z.array(bathSeasonalOverrideSchema).default([]),
  seasonalClosure: bathSeasonalClosureSchema.nullable().default(null),
  holidayRule: z
    .enum([
      "none",
      "closed_on_holidays",
      "open_closed_weekday_shift_next_day",
      "open_closed_weekday_shift_next_weekday",
    ])
    .default("none"),
  nthWeekdaysClosed: z.array(bathNthWeekdayClosedSchema).default([]),
  yearEndClosed: z
    .object({
      startMmdd: z.string().regex(/^\d{2}-\d{2}$/),
      endMmdd: z.string().regex(/^\d{2}-\d{2}$/),
    })
    .nullable()
    .default(null),
  summaryText: z.string().min(1),
  lastEntryText: z.string().nullable(),
  holidayNote: z.string().nullable(),
  irregularNote: z.string().nullable().default(null),
});
export type BathStructuredSchedule = z.infer<
  typeof bathStructuredScheduleSchema
>;

export const bathScheduleSchema = z.discriminatedUnion("kind", [
  bathStructuredScheduleSchema,
  z.object({
    kind: z.literal("check_official"),
    summaryText: z.string().min(1),
    lastEntryText: z.string().nullable(),
    holidayNote: z.string().nullable(),
    irregularNote: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("not_public"),
    summaryText: z.string().min(1),
    lastEntryText: z.string().nullable(),
    holidayNote: z.string().nullable(),
    irregularNote: z.string().nullable(),
  }),
]);
export type BathSchedule = z.infer<typeof bathScheduleSchema>;

export const bathFacilitySchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "id must be lowercase alphanumeric with hyphens"),
  sourceRecordId: z.string().min(1),
  name: z.string().min(1),
  registryName: z.string().min(1),
  permitCategory: z.enum(["一般公衆浴場", "その他の公衆浴場"]),
  permittedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  permitNumber: z.string().nullable(),
  operator: z.string().nullable(),
  postalCode: z.string().nullable(),
  address: z.string().min(1),
  subArea: z.string().min(1),
  areaGroup: bathAreaGroupSchema,
  accessCategory: bathAccessCategorySchema,
  accessLabel: z.string().min(1),
  accessNote: z.string().nullable(),
  facilityType: bathFacilityTypeSchema,
  waterType: bathWaterTypeSchema,
  hasSauna: z.boolean(),
  hasRotenburo: z.boolean(),
  feeSummary: z.string().nullable(),
  phone: z.string().nullable(),
  officialUrl: z.url().nullable(),
  mapQuery: z.string().min(1),
  lat: z.number().min(35).max(37).nullable(),
  lng: z.number().min(137).max(139).nullable(),
  recommendedRank: z.number().int().min(1).max(100),
  schedule: bathScheduleSchema,
  hasMorningBath: z.boolean(),
  openLateNight: z.boolean(),
  latestLastEntryMinutes: z.number().int().min(0).max(1440).nullable(),
});
export type BathFacility = z.infer<typeof bathFacilitySchema>;

export const sentouDatasetSchema = z.object({
  version: z.literal("1.0"),
  generatedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "generatedAt must be YYYY-MM-DD"),
  site: z.url(),
  notice: z.string().min(1),
  holidays: z.record(z.string(), z.string()),
  officialLinks: z.object({
    shinshuSento: z.url(),
    visitMatsumotoOnsen: z.url(),
    asamaOnsen: z.url(),
    utsukushigaharaOnsen: z.url(),
    norikura: z.url(),
    shirahone: z.url(),
  }),
  sources: z.object({
    baths: z.object({
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
  counts: z.object({
    total: z.number().int().positive(),
    publicDropIn: z.number().int().nonnegative(),
    dayUseOrReserved: z.number().int().nonnegative(),
    restricted: z.number().int().nonnegative(),
    ippanSentou: z.number().int().nonnegative(),
    localOnly: z.number().int().nonnegative(),
  }),
  count: z.number().int().positive(),
  facilities: z.array(bathFacilitySchema).min(1),
});
export type SentouDataset = z.infer<typeof sentouDatasetSchema>;
