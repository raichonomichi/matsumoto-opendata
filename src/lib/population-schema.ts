import { z } from "zod";

export const POPULATION_MAX_AGE = 109;
export const POPULATION_AGE_COUNT = POPULATION_MAX_AGE + 1;

export const ymSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "ym must be formatted as YYYY-MM");

export const dateYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be formatted as YYYY-MM-DD");

export const populationWorkSourceSchema = z.object({
  year: z.number().int().min(2017).max(2100),
  eraLabel: z.string().min(1),
  workId: z.string().regex(/^rdf1s\d+i$/, "workId must match rdf1s<n>i"),
  url: z.url(),
  license: z.literal("CC BY 3.0"),
  monthCount: z.number().int().min(1).max(12),
});
export type PopulationWorkSource = z.infer<typeof populationWorkSourceSchema>;

export const populationSnapshotSchema = z
  .object({
    ym: ymSchema,
    year: z.number().int().min(2017).max(2100),
    month: z.number().int().min(1).max(12),
    total: z.number().int().nonnegative(),
    male: z.number().int().nonnegative(),
    female: z.number().int().nonnegative(),
    maleByAge: z
      .array(z.number().int().nonnegative())
      .length(POPULATION_AGE_COUNT),
    femaleByAge: z
      .array(z.number().int().nonnegative())
      .length(POPULATION_AGE_COUNT),
  })
  .refine((s) => s.total === s.male + s.female, {
    message: "snapshot total must equal male + female",
  })
  .refine(
    (s) => s.male === s.maleByAge.reduce((sum, count) => sum + count, 0),
    {
      message: "snapshot male must equal sum of maleByAge",
    },
  )
  .refine(
    (s) => s.female === s.femaleByAge.reduce((sum, count) => sum + count, 0),
    {
      message: "snapshot female must equal sum of femaleByAge",
    },
  );
export type PopulationSnapshot = z.infer<typeof populationSnapshotSchema>;

export const populationDatasetSchema = z.object({
  version: z.literal("1.0"),
  generatedAt: dateYmdSchema,
  site: z.url(),
  maxAge: z.literal(POPULATION_MAX_AGE),
  range: z.object({
    startYm: ymSchema,
    endYm: ymSchema,
    snapshotCount: z.number().int().positive(),
    years: z.array(z.number().int().min(2017).max(2100)).min(1),
  }),
  notice: z.string().min(1),
  officialLinks: z.object({
    portal: z.url(),
    latestWork: z.url(),
  }),
  sources: z.array(populationWorkSourceSchema).min(1),
  snapshots: z.array(populationSnapshotSchema).min(1),
});
export type PopulationDataset = z.infer<typeof populationDatasetSchema>;
