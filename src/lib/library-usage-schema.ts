import { z } from "zod";

export const branchIds = [
  "chuo",
  "nanbu",
  "agata",
  "kamata",
  "kotobukidai",
  "hongo",
  "nakayama",
  "shimauchi",
  "kuko",
  "azusagawa",
  "hata",
] as const;

export const branchIdSchema = z.enum(branchIds);
export type BranchId = z.infer<typeof branchIdSchema>;

export const dateYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be formatted as YYYY-MM-DD");

export const branchProfileSchema = z.object({
  id: branchIdSchema,
  name: z.string().min(1),
  shortName: z.string().min(1),
  formerName: z.string().nullable(),
  openedAt: z.string().min(1),
  areaSqm: z.number().positive(),
  facilityType: z.enum(["independent", "complex"]),
  highlight: z.string().min(1),
});
export type BranchProfile = z.infer<typeof branchProfileSchema>;

export const branchYearMetricsSchema = z.object({
  branchId: branchIdSchema,
  openDays: z.number().int().nonnegative().nullable(),
  holdingsTotal: z.number().int().nonnegative().nullable(),
  holdingsBooks: z.number().int().nonnegative().nullable(),
  holdingsBooksChildren: z.number().int().nonnegative().nullable(),
  registeredTotal: z.number().int().nonnegative(),
  registeredChildren: z.number().int().nonnegative().nullable(),
  loansTotal: z.number().int().nonnegative(),
  loansChildren: z.number().int().nonnegative().nullable(),
  reservationsTotal: z.number().int().nonnegative().nullable(),
  referenceCount: z.number().int().nonnegative().nullable(),
  visitors: z.number().int().nonnegative().nullable(),
});
export type BranchYearMetrics = z.infer<typeof branchYearMetricsSchema>;

export const servicePointYearMetricsSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  openedAt: z.string().min(1),
  openDays: z.number().int().nonnegative(),
  loansTotal: z.number().int().nonnegative(),
  loansChildren: z.number().int().nonnegative(),
  reservationsTotal: z.number().int().nonnegative(),
  visitors: z.number().int().nonnegative().nullable(),
});
export type ServicePointYearMetrics = z.infer<
  typeof servicePointYearMetricsSchema
>;

export const annualRecordSchema = z.object({
  fiscalYear: z.number().int().min(2013).max(2025),
  eraLabel: z.string().min(1),
  shortEraLabel: z.string().min(1),
  population: z.number().int().positive(),
  holdingsTotal: z.number().int().nonnegative().nullable(),
  holdingsBooks: z.number().int().nonnegative().nullable(),
  holdingsBooksChildren: z.number().int().nonnegative().nullable(),
  registeredTotal: z.number().int().nonnegative(),
  registeredChildren: z.number().int().nonnegative(),
  loansTotal: z.number().int().nonnegative(),
  loansChildren: z.number().int().nonnegative(),
  groupLoansTotal: z.number().int().nonnegative(),
  reservationsTotal: z.number().int().nonnegative().nullable(),
  referenceCount: z.number().int().nonnegative().nullable(),
  registrationPolicyChange: z.boolean(),
  dataSourceNote: z.string().min(1),
  eventNotes: z.array(z.string().min(1)),
  branches: z.array(branchYearMetricsSchema).length(11),
  servicePoints: z.array(servicePointYearMetricsSchema),
});
export type AnnualRecord = z.infer<typeof annualRecordSchema>;

export const decadeMilestoneSchema = z.object({
  fiscalYear: z.number().int(),
  eraLabel: z.string().min(1),
  shortEraLabel: z.string().min(1),
  holdingsTotal: z.number().int().nonnegative(),
  holdingsChildren: z.number().int().nonnegative(),
  registeredTotal: z.number().int().nonnegative(),
  registeredChildren: z.number().int().nonnegative().nullable(),
  loansTotal: z.number().int().nonnegative(),
  loansChildren: z.number().int().nonnegative().nullable(),
  groupLoansTotal: z.number().int().nonnegative(),
  referenceCount: z.number().int().nonnegative(),
  reservationsTotal: z.number().int().nonnegative().nullable(),
  note: z.string().min(1),
});
export type DecadeMilestone = z.infer<typeof decadeMilestoneSchema>;

export const branchExpansionPointSchema = z.object({
  fiscalYear: z.number().int(),
  eraLabel: z.string().min(1),
  shortEraLabel: z.string().min(1),
  librariesCount: z.number().int().positive(),
  servicePointsCount: z.number().int().nonnegative(),
  holdingsTotal: z.number().int().nonnegative(),
  loansTotal: z.number().int().nonnegative(),
  note: z.string().min(1),
});
export type BranchExpansionPoint = z.infer<typeof branchExpansionPointSchema>;

export const ageGroupBracketSchema = z.object({
  bracketId: z.string().min(1),
  label: z.string().min(1),
  registeredCity: z.number().int().nonnegative(),
  registeredOutside: z.number().int().nonnegative(),
  registeredTotal: z.number().int().nonnegative(),
  population: z.number().int().positive(),
  registrationRatePct: z.number().nonnegative(),
  activeUsers: z.number().int().nonnegative(),
  activeRateVsRegisteredPct: z.number().nonnegative(),
  activeRateVsPopulationPct: z.number().nonnegative(),
});
export type AgeGroupBracket = z.infer<typeof ageGroupBracketSchema>;

export const ageGroupTotalsSchema = z.object({
  registeredCity: z.number().int().nonnegative(),
  registeredOutside: z.number().int().nonnegative(),
  registeredTotal: z.number().int().nonnegative(),
  population: z.number().int().positive(),
  registrationRatePct: z.number().nonnegative(),
  activeUsers: z.number().int().nonnegative(),
  activeRateVsRegisteredPct: z.number().nonnegative(),
  activeRateVsPopulationPct: z.number().nonnegative(),
});

export const ageGroupSnapshotSchema = z.object({
  fiscalYear: z.number().int(),
  eraLabel: z.string().min(1),
  asOf: z.string().min(1),
  totals: ageGroupTotalsSchema,
  brackets: z.array(ageGroupBracketSchema).length(11),
  branchBreakdowns: z
    .record(branchIdSchema, z.array(z.number().int().nonnegative()).length(11))
    .optional(),
});
export type AgeGroupSnapshot = z.infer<typeof ageGroupSnapshotSchema>;

export const digitalLibraryYearSchema = z.object({
  fiscalYear: z.number().int(),
  eraLabel: z.string().min(1),
  registeredUsers: z.number().int().nonnegative(),
  holdingsItems: z.number().int().nonnegative(),
  loansCount: z.number().int().nonnegative(),
});
export type DigitalLibraryYear = z.infer<typeof digitalLibraryYearSchema>;

export const sourceMetaSchema = z.object({
  name: z.string().min(1),
  sourceUrl: z.url(),
  license: z.string().min(1),
  attribution: z.string().min(1),
});

export const libraryUsageDatasetSchema = z.object({
  version: z.literal("1.0"),
  generatedAt: dateYmdSchema,
  site: z.url(),
  notice: z.string().min(1),
  officialLinks: z.object({
    libraryTop: z.url(),
    libraryOverview: z.url(),
    cityStats: z.url(),
    chuoRenovation: z.url(),
  }),
  sources: z.object({
    linkData: sourceMetaSchema,
    cityStats: sourceMetaSchema,
    libraryOverview: sourceMetaSchema,
    naganoSurvey: sourceMetaSchema,
  }),
  branchProfiles: z.array(branchProfileSchema).length(11),
  decadeMilestones: z.array(decadeMilestoneSchema).length(3),
  branchExpansionHistory: z.array(branchExpansionPointSchema).length(14),
  annualRecords: z.array(annualRecordSchema).length(13),
  ageGroupSnapshots: z.array(ageGroupSnapshotSchema).length(2),
  digitalLibrary: z.array(digitalLibraryYearSchema).length(3),
});

export type LibraryUsageDataset = z.infer<typeof libraryUsageDatasetSchema>;
