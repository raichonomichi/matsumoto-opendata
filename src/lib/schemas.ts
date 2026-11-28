import { z } from "zod";

export const licenseTypes = [
  "CC BY 4.0",
  "CC BY 3.0",
  "政府標準利用規約2.0",
  "公共データ利用規約（第1.0版）",
  "その他",
] as const;

export const datasetSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "id must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1),
  provider: z.string().min(1),
  description: z.string().min(1),
  sourceUrl: z.url(),
  license: z.enum(licenseTypes),
  licenseUrl: z.url(),
  attribution: z.string().min(1),
  format: z.array(z.string().min(1)).min(1),
  updateFrequency: z.string().min(1),
  updatedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "updatedAt must be YYYY-MM-DD"),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "validUntil must be YYYY-MM-DD")
    .optional(),
  notes: z.string().optional(),
});

export type DatasetMeta = z.infer<typeof datasetSchema>;

export const serviceStatusTypes = ["published", "beta", "draft"] as const;

export const serviceSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "id must be lowercase alphanumeric with hyphens"),
  title: z.string().min(1),
  summary: z.string().min(1),
  status: z.enum(serviceStatusTypes),
  path: z.string().regex(/^\/[a-z0-9-/]+\/$/, "path must start and end with /"),
  datasets: z.array(z.string().min(1)),
  tags: z.array(z.string().min(1)),
  publishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "publishedAt must be YYYY-MM-DD")
    .optional(),
  issueUrl: z.url().optional(),
});

export type ServiceMeta = z.infer<typeof serviceSchema>;
