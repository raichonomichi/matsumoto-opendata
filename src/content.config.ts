import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { datasetSchema, serviceSchema } from "./lib/schemas";

const datasets = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/datasets" }),
  schema: datasetSchema,
});

const services = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/services" }),
  schema: serviceSchema,
});

export const collections = {
  datasets,
  services,
};
