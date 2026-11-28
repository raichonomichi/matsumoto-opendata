import { z } from "zod";

export const gtfsFeedIds = [
  "guruttomatsumotobus1",
  "guruttomatsumotobus2",
] as const;
export const gtfsFeedIdSchema = z.enum(gtfsFeedIds);
export type GtfsFeedId = z.infer<typeof gtfsFeedIdSchema>;

const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const hexColorSchema = z
  .string()
  .regex(/^[0-9A-Fa-f]{6}$/, "Color must be 6-digit hex without #");

export const gtfsFeedMetaSchema = z.object({
  feedId: gtfsFeedIdSchema,
  feedName: z.string().min(1),
  version: z.string().min(1),
  validFrom: ymdSchema,
  validUntil: ymdSchema,
  calendarDatesUntil: ymdSchema.nullable(),
  routeCount: z.number().int().positive(),
  stopCount: z.number().int().positive(),
  tripCount: z.number().int().positive(),
  stopTimeCount: z.number().int().positive(),
});
export type GtfsFeedMeta = z.infer<typeof gtfsFeedMetaSchema>;

export const lastBusStopSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lat: z.number().min(35.5).max(37.0),
  lng: z.number().min(137.0).max(139.0),
  routeCount: z.number().int().min(1),
});
export type LastBusStop = z.infer<typeof lastBusStopSchema>;

export const lastBusRouteSchema = z.object({
  key: z.string().min(1),
  feedId: gtfsFeedIdSchema,
  feedLabel: z.string().min(1),
  routeId: z.string().min(1),
  name: z.string().min(1),
  color: hexColorSchema,
  textColor: hexColorSchema,
  isCircular: z.boolean(),
  hasStationOrigin: z.boolean(),
  originStopIndices: z.array(z.number().int().min(0)).min(1),
  stopIndices: z.array(z.number().int().min(0)).min(1),
});
export type LastBusRoute = z.infer<typeof lastBusRouteSchema>;

export const lastBusServiceSchema = z.object({
  key: z.string().min(1),
  feedId: gtfsFeedIdSchema,
  serviceId: z.string().min(1),
  daysLabel: z.string().min(1),
  weekdayMask: z.number().int().min(0).max(127),
  startDate: ymdSchema,
  endDate: ymdSchema,
  addedDates: z.array(ymdSchema),
  removedDates: z.array(ymdSchema),
});
export type LastBusService = z.infer<typeof lastBusServiceSchema>;

export const presetCategories = [
  "station",
  "sightseeing",
  "campus_hospital",
  "suburb_hub",
] as const;
export const presetCategorySchema = z.enum(presetCategories);
export type PresetCategory = z.infer<typeof presetCategorySchema>;

export const lastBusPresetSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "id must be lowercase alphanumeric with hyphens"),
  label: z.string().min(1),
  shortLabel: z.string().min(1),
  category: presetCategorySchema,
  description: z.string().min(1),
  stopIndices: z.array(z.number().int().min(0)).min(1),
  originOnly: z.boolean(),
});
export type LastBusPreset = z.infer<typeof lastBusPresetSchema>;

/**
 * [stopIdx, routeIdx, serviceIdx, headsignIdx, platformCode, flags, departureMinutes[]]
 * flags: bit0 (1) = isOrigin, bit1 (2) = isNearTerminal (1 stop before terminal)
 */
export const scheduleTupleSchema = z.tuple([
  z.number().int().min(0),
  z.number().int().min(0),
  z.number().int().min(0),
  z.number().int().min(0),
  z.string(),
  z.number().int().min(0).max(3),
  z.array(z.number().int().min(0).max(2000)).min(1),
]);
export type ScheduleTuple = z.infer<typeof scheduleTupleSchema>;

export const lastBusDatasetSchema = z.object({
  version: z.literal("1.0"),
  generatedAt: ymdSchema,
  site: z.url(),
  notice: z.string().min(1),
  officialLinks: z.object({
    matsumotoBusInfo: z.url(),
    matsumotoGtfsPage: z.url(),
    gtfsRepository: z.url(),
    alpicoLocalMatsumoto: z.url(),
    alpicoKamikochi: z.url(),
    alpicoRail: z.url(),
  }),
  sources: z.object({
    gtfs: z.object({
      name: z.string().min(1),
      sourceUrl: z.url(),
      license: z.string().min(1),
      attribution: z.string().min(1),
      feeds: z.array(gtfsFeedMetaSchema).min(2),
    }),
  }),
  stats: z.object({
    routeCount: z.number().int().positive(),
    stopCount: z.number().int().positive(),
    tripCount: z.number().int().positive(),
    stopTimeCount: z.number().int().positive(),
    stationOriginRouteCount: z.number().int().positive(),
    scheduleGroupCount: z.number().int().positive(),
  }),
  presets: z.array(lastBusPresetSchema).min(1),
  stops: z.array(lastBusStopSchema).min(1),
  routes: z.array(lastBusRouteSchema).min(1),
  services: z.array(lastBusServiceSchema).min(1),
  headsigns: z.array(z.string().min(1)).min(1),
  schedules: z.array(scheduleTupleSchema).min(1),
});
export type LastBusDataset = z.infer<typeof lastBusDatasetSchema>;
