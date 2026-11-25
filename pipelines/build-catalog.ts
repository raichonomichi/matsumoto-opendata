import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { type DatasetMeta, datasetSchema } from "../src/lib/schemas";

const DATASETS_DIR = path.resolve("src/content/datasets");
const OUTPUT_PATH = path.resolve("public/api/v1/catalog.json");

export async function loadDatasets(dir = DATASETS_DIR): Promise<DatasetMeta[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  const datasets: DatasetMeta[] = [];
  const seenIds = new Set<string>();

  for (const file of jsonFiles) {
    const raw = await readFile(path.join(dir, file), "utf-8");
    const parsed = datasetSchema.parse(JSON.parse(raw));
    if (seenIds.has(parsed.id)) {
      throw new Error(`Duplicate dataset id detected: ${parsed.id}`);
    }
    seenIds.add(parsed.id);
    datasets.push(parsed);
  }

  return datasets;
}

export async function buildCatalog(): Promise<void> {
  const datasets = await loadDatasets();
  const payload = {
    version: "1.0",
    site: "https://modata.raichonomichi.net",
    count: datasets.length,
    datasets,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf-8",
  );
  console.log(
    `Generated ${path.relative(process.cwd(), OUTPUT_PATH)} (${datasets.length} datasets)`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
  await buildCatalog();
}
