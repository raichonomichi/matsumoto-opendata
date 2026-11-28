import { z } from "zod";

export const wifiPurposes = [
  "study_work",
  "sightseeing",
  "meeting_rental",
] as const;
export const wifiPurposeSchema = z.enum(wifiPurposes);
export type WifiPurpose = z.infer<typeof wifiPurposeSchema>;

export const wifiAreaGroups = [
  "central",
  "suburbs",
  "onsen",
  "mountains",
] as const;
export const wifiAreaGroupSchema = z.enum(wifiAreaGroups);
export type WifiAreaGroup = z.infer<typeof wifiAreaGroupSchema>;

export const ssidSystems = [
  "community",
  "library",
  "city",
  "city_hall",
  "facility_other",
] as const;
export const ssidSystemSchema = z.enum(ssidSystems);
export type SsidSystem = z.infer<typeof ssidSystemSchema>;

export const accessPolicies = [
  "drop_in",
  "outdoor_open",
  "facility_visitor",
  "reservation_required",
  "check_official",
] as const;
export const accessPolicySchema = z.enum(accessPolicies);
export type AccessPolicy = z.infer<typeof accessPolicySchema>;

export const powerAvailabilityValues = [
  "available",
  "limited_seats",
  "none",
  "unknown",
] as const;
export const powerAvailabilitySchema = z.enum(powerAvailabilityValues);
export type PowerAvailability = z.infer<typeof powerAvailabilitySchema>;

export const indoorOutdoorValues = ["indoor", "outdoor", "both"] as const;
export const indoorOutdoorSchema = z.enum(indoorOutdoorValues);
export type IndoorOutdoor = z.infer<typeof indoorOutdoorSchema>;

export const timeRangeSchema = z.object({
  openMinutes: z.number().int().min(0).max(1440),
  closeMinutes: z.number().int().min(0).max(1440),
});
export type TimeRange = z.infer<typeof timeRangeSchema>;

export const nthWeekdayClosedSchema = z.object({
  nth: z.number().int().min(1).max(5),
  weekday: z.number().int().min(0).max(6),
  months: z.array(z.number().int().min(1).max(12)).optional(),
  shiftIfHoliday: z
    .enum(["none", "prev_day", "next_weekday", "both_prev_and_day"])
    .default("none"),
});
export type NthWeekdayClosed = z.infer<typeof nthWeekdayClosedSchema>;

export const seasonalHoursOverrideSchema = z.object({
  months: z.array(z.number().int().min(1).max(12)).min(1),
  weekday: timeRangeSchema.optional(),
  saturday: timeRangeSchema.optional(),
  sunday: timeRangeSchema.optional(),
  holiday: timeRangeSchema.optional(),
});
export type SeasonalHoursOverride = z.infer<typeof seasonalHoursOverrideSchema>;

export const structuredScheduleSchema = z.object({
  kind: z.literal("structured"),
  openDays: z.array(z.number().int().min(0).max(6)).min(1),
  defaultHours: timeRangeSchema,
  dayHours: z.record(z.string(), timeRangeSchema).optional(),
  seasonalOverrides: z.array(seasonalHoursOverrideSchema).default([]),
  closedOnHolidays: z
    .enum(["never", "always", "except_sunday"])
    .default("never"),
  mondayHolidayRule: z
    .enum([
      "none",
      "open_and_close_next_weekday",
      "open_and_close_next_day_if_not_holiday",
      "close_monday_and_next_day",
    ])
    .default("none"),
  dayAfterHolidayClosed: z.boolean().default(false),
  nthWeekdaysClosed: z.array(nthWeekdayClosedSchema).default([]),
  yearEndClosed: z
    .object({
      startMmdd: z.string().regex(/^\d{2}-\d{2}$/),
      endMmdd: z.string().regex(/^\d{2}-\d{2}$/),
    })
    .nullable()
    .default(null),
  summaryText: z.string().min(1),
  holidayNote: z.string().nullable(),
  variableClosingNote: z.string().nullable().default(null),
});
export type StructuredSchedule = z.infer<typeof structuredScheduleSchema>;

export const facilityScheduleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("outdoor_24h"),
    summaryText: z.string().min(1),
    holidayNote: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("check_official"),
    summaryText: z.string().min(1),
    holidayNote: z.string().nullable(),
  }),
  structuredScheduleSchema,
]);
export type FacilitySchedule = z.infer<typeof facilityScheduleSchema>;

export const wifiSpotSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "id must be lowercase alphanumeric with hyphens"),
  sourceRecordId: z.string().min(1),
  facilityNumber: z.string().nullable(),
  name: z.string().min(1),
  facilityName: z.string().nullable(),
  category: z.string().min(1),
  address: z.string().min(1),
  district: z.string().min(1),
  areaGroup: wifiAreaGroupSchema,
  lat: z.number().min(35).max(37),
  lng: z.number().min(137).max(139),
  phone: z.string().nullable(),
  ssid: z.string().min(1).nullable(),
  ssidSystem: ssidSystemSchema,
  apCount: z.number().int().min(1),
  indoorOutdoor: indoorOutdoorSchema,
  purposes: z.array(wifiPurposeSchema),
  accessPolicy: accessPolicySchema,
  powerAvailability: powerAvailabilitySchema,
  powerNote: z.string().nullable(),
  studyWorkNote: z.string().nullable(),
  complexGroup: z.string().nullable(),
  complexNote: z.string().nullable(),
  officialUrl: z.url().nullable(),
  recommendedRank: z.number().int().min(1).max(100),
  schedule: facilityScheduleSchema,
  openLate: z.boolean(),
  openMonday: z.boolean(),
  openWeekend: z.boolean(),
  latestCloseMinutes: z.number().int().min(0).max(1440).nullable(),
});
export type WifiSpot = z.infer<typeof wifiSpotSchema>;

export const ssidGuideSchema = z.object({
  system: ssidSystemSchema,
  title: z.string().min(1),
  ssidLabel: z.string().min(1),
  authMethod: z.string().min(1),
  timeLimit: z.string().min(1),
  targetSummary: z.string().min(1),
  notes: z.string().min(1),
  officialUrl: z.url(),
});
export type SsidGuide = z.infer<typeof ssidGuideSchema>;

export const freeWifiDatasetSchema = z.object({
  version: z.literal("1.0"),
  generatedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "generatedAt must be YYYY-MM-DD"),
  site: z.url(),
  notice: z.string().min(1),
  holidays: z.record(z.string(), z.string()),
  ssidGuides: z.array(ssidGuideSchema).min(1),
  officialLinks: z.object({
    portalWifi: z.url(),
    communityWifi: z.url(),
    cityWifi: z.url(),
    visitMatsumotoWifi: z.url(),
    libraryTop: z.url(),
    chuoLibraryRenovation: z.url(),
    disasterWifi: z.url(),
  }),
  sources: z.object({
    wifi: z.object({
      name: z.string().min(1),
      sourceUrl: z.url(),
      license: z.string().min(1),
      attribution: z.string().min(1),
    }),
    facilities: z.object({
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
  count: z.number().int().positive(),
  spots: z.array(wifiSpotSchema).min(1),
});
export type FreeWifiDataset = z.infer<typeof freeWifiDatasetSchema>;
