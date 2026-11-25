import { z } from "zod";

export const yamagoyaAreas = ["北アルプス", "乗鞍", "美ヶ原"] as const;
export const yamagoyaAreaSchema = z.enum(yamagoyaAreas);
export type YamagoyaArea = z.infer<typeof yamagoyaAreaSchema>;

export const difficultyGrades = ["A", "B", "C", "D", "E"] as const;
export const difficultyGradeSchema = z.enum(difficultyGrades);
export type DifficultyGrade = z.infer<typeof difficultyGradeSchema>;

export const gradingRouteSchema = z.object({
  routeNumber: z.number().int().positive(),
  routeName: z.string().min(1),
  physicalLevel: z.number().int().min(1).max(10),
  difficultyGrade: difficultyGradeSchema,
  startPoint: z.string().min(1),
  startElevationM: z.number().int().nonnegative(),
  highestPoint: z.string().min(1),
  highestElevationM: z.number().int().nonnegative(),
  endPoint: z.string().min(1),
  endElevationM: z.number().int().nonnegative(),
  courseTimeHours: z.number().positive(),
  distanceKm: z.number().positive(),
  ascentKm: z.number().nonnegative(),
  descentKm: z.number().nonnegative(),
  routeConstant: z.number().positive(),
  isVolcano: z.boolean().optional(),
});
export type GradingRoute = z.infer<typeof gradingRouteSchema>;

export const timeHHMMSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Time must be formatted as HH:MM");

export const gtfsServiceSummarySchema = z.object({
  serviceId: z.string().min(1),
  serviceLabel: z.string().min(1),
  daysLabel: z.string().min(1),
  headsign: z.string().min(1),
  tripCount: z.number().int().positive(),
  firstDeparture: timeHHMMSchema,
  lastDeparture: timeHHMMSchema,
  departures: z.array(timeHHMMSchema).min(1),
});
export type GtfsServiceSummary = z.infer<typeof gtfsServiceSummarySchema>;

export const gtfsBusAccessSchema = z.object({
  kind: z.literal("gtfs"),
  stopName: z.string().min(1),
  stopIds: z.array(z.string().min(1)).min(1),
  routeId: z.string().min(1),
  routeName: z.string().min(1),
  feedId: z.string().min(1),
  operator: z.string().min(1),
  accessNote: z.string().min(1),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  schedules: z.array(gtfsServiceSummarySchema).min(1),
});

export const externalTimetableBusAccessSchema = z.object({
  kind: z.literal("external_timetable"),
  stopName: z.string().min(1),
  routeName: z.string().min(1),
  operator: z.string().min(1),
  timetableUrl: z.url(),
  accessNote: z.string().min(1),
});

export const busAccessSchema = z.discriminatedUnion("kind", [
  gtfsBusAccessSchema,
  externalTimetableBusAccessSchema,
]);
export type BusAccess = z.infer<typeof busAccessSchema>;

export const permitInfoSchema = z.object({
  category: z.string().min(1),
  rooms: z.number().int().nonnegative().nullable(),
  capacity: z.number().int().nonnegative().nullable(),
  permittedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "permittedAt must be YYYY-MM-DD")
    .nullable(),
  permitNumber: z.string().min(1),
  operator: z.string().nullable(),
  postalCode: z.string().nullable(),
  address: z.string().min(1),
});
export type PermitInfo = z.infer<typeof permitInfoSchema>;

export const yamagoyaRecordSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "id must be lowercase alphanumeric with hyphens"),
  sourceRecordId: z.string().min(1),
  name: z.string().min(1),
  registryName: z.string().min(1),
  area: yamagoyaAreaSchema,
  subArea: z.string().min(1),
  elevationM: z.number().int().min(1000).max(3200),
  summary: z.string().min(1),
  permit: permitInfoSchema,
  grading: z.array(gradingRouteSchema).min(1),
  primaryPhysicalLevel: z.number().int().min(1).max(10),
  primaryDifficultyGrade: difficultyGradeSchema,
  busAccess: z.array(busAccessSchema).min(1),
});
export type YamagoyaRecord = z.infer<typeof yamagoyaRecordSchema>;

export const yamagoyaDatasetSchema = z.object({
  version: z.literal("1.0"),
  generatedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "generatedAt must be YYYY-MM-DD"),
  site: z.url(),
  count: z.number().int().positive(),
  notice: z.string().min(1),
  sources: z.object({
    hotelRegistry: z.object({
      name: z.string().min(1),
      sourceUrl: z.url(),
      license: z.string().min(1),
      attribution: z.string().min(1),
    }),
    gtfs: z.object({
      name: z.string().min(1),
      sourceUrl: z.url(),
      license: z.string().min(1),
      feeds: z.array(
        z.object({
          feedId: z.string().min(1),
          version: z.string().min(1),
          validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
      ),
    }),
    mountainGrading: z.object({
      name: z.string().min(1),
      sourceUrl: z.url(),
      pdfUrl: z.url(),
      updatedLabel: z.string().min(1),
    }),
  }),
  huts: z.array(yamagoyaRecordSchema).min(1),
});
export type YamagoyaDataset = z.infer<typeof yamagoyaDatasetSchema>;
