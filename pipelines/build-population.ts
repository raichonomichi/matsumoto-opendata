import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  POPULATION_MAX_AGE,
  type PopulationDataset,
  type PopulationSnapshot,
  type PopulationWorkSource,
  populationDatasetSchema,
} from "../src/lib/population-schema";
import {
  type DiscoveredWorkMonthFile,
  extractWorkMonthFiles,
  POPULATION_WORK_SOURCES,
  parsePopulationTsv,
} from "./population/parsers";

const OUTPUT_PATH = path.resolve("src/data/population.json");
const FETCH_CONCURRENCY = 6;

function nextYm(ym: string): string {
  const [yStr, mStr] = ym.split("-");
  const year = Number.parseInt(yStr ?? "", 10);
  const month = Number.parseInt(mStr ?? "", 10);
  if (month === 12) {
    return `${year + 1}-01`;
  }
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export interface BuildPopulationDatasetInput {
  snapshots: PopulationSnapshot[];
  sources: PopulationWorkSource[];
  generatedAt: string;
}

/**
 * 取得・パース済みの月次スナップショット群を連続性検証付きで統合データセットへ構築する。
 */
export function buildPopulationDataset(
  input: BuildPopulationDatasetInput,
): PopulationDataset {
  if (input.snapshots.length === 0) {
    throw new Error("snapshots must not be empty");
  }

  const sortedSnapshots = [...input.snapshots].sort((a, b) =>
    a.ym.localeCompare(b.ym),
  );

  for (let i = 1; i < sortedSnapshots.length; i++) {
    const prev = sortedSnapshots[i - 1];
    const curr = sortedSnapshots[i];
    if (!prev || !curr) continue;
    if (prev.ym === curr.ym) {
      throw new Error(`Duplicate population snapshot ym: ${curr.ym}`);
    }
    const expected = nextYm(prev.ym);
    if (curr.ym !== expected) {
      throw new Error(
        `Missing month between ${prev.ym} and ${curr.ym} (expected ${expected})`,
      );
    }
  }

  const sortedSources = [...input.sources].sort((a, b) => a.year - b.year);
  const startYm = sortedSnapshots[0].ym;
  const endYm = sortedSnapshots[sortedSnapshots.length - 1].ym;
  const latestSource = sortedSources[sortedSources.length - 1];

  const dataset: PopulationDataset = {
    version: "1.0",
    generatedAt: input.generatedAt,
    site: "https://modata.raichonomichi.net",
    maxAge: POPULATION_MAX_AGE,
    range: {
      startYm,
      endYm,
      snapshotCount: sortedSnapshots.length,
      years: sortedSources.map((s) => s.year),
    },
    notice:
      "本ページのデータは、松本市オープンデータ（LinkData.org 公開「年齢別男女別人口」平成29年〜令和8年）の住民基本台帳に基づく各月1日現在の年齢別（0歳〜109歳）・男女別人口を集計したものです（外国人住民を含む）。国勢調査人口とは調査時点・集計対象が異なります。",
    officialLinks: {
      portal: "https://www.city.matsumoto.nagano.jp/soshiki/5/4172.html",
      latestWork: latestSource
        ? latestSource.url
        : "http://linkdata.org/work/rdf1s10410i",
    },
    sources: sortedSources,
    snapshots: sortedSnapshots,
  };

  return populationDatasetSchema.parse(dataset);
}

/**
 * 読みやすいメタ情報と1行1スナップショット配列で JSON 文字列へシリアライズする。
 */
export function formatPopulationDatasetJson(
  dataset: PopulationDataset,
): string {
  const headerObj = {
    version: dataset.version,
    generatedAt: dataset.generatedAt,
    site: dataset.site,
    maxAge: dataset.maxAge,
    range: dataset.range,
    notice: dataset.notice,
    officialLinks: dataset.officialLinks,
    sources: dataset.sources,
  };
  const headerLines = JSON.stringify(headerObj, null, 2).split("\n");
  const bodyLines = headerLines.slice(0, -1);
  const lastBodyIdx = bodyLines.length - 1;
  if (lastBodyIdx >= 0) {
    bodyLines[lastBodyIdx] = `${bodyLines[lastBodyIdx]},`;
  }
  const snapshotLines = dataset.snapshots.map((snapshot, idx) => {
    const suffix = idx < dataset.snapshots.length - 1 ? "," : "";
    return `    ${JSON.stringify(snapshot)}${suffix}`;
  });

  return `${[...bodyLines, '  "snapshots": [', ...snapshotLines, "  ]", "}"].join("\n")}\n`;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = items[currentIndex];
      if (item !== undefined) {
        results[currentIndex] = await worker(item);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker(),
  );
  await Promise.all(workers);
  return results;
}

export async function runPopulationPipeline(): Promise<void> {
  console.log(
    `Fetching ${POPULATION_WORK_SOURCES.length} LinkData population work pages...`,
  );

  const workResults = await mapWithConcurrency(
    POPULATION_WORK_SOURCES,
    FETCH_CONCURRENCY,
    async (spec) => {
      const workUrl = `http://linkdata.org/work/${spec.workId}`;
      const html = await fetchText(workUrl);
      const files = extractWorkMonthFiles(html, spec.workId, spec.year);
      const source: PopulationWorkSource = {
        year: spec.year,
        eraLabel: spec.eraLabel,
        workId: spec.workId,
        url: workUrl,
        license: "CC BY 3.0",
        monthCount: files.length,
      };
      return { source, files };
    },
  );

  const sources = workResults.map((r) => r.source);
  const allFiles: DiscoveredWorkMonthFile[] = workResults.flatMap(
    (r) => r.files,
  );

  console.log(`Fetching and parsing ${allFiles.length} monthly TSV files...`);
  const snapshots = await mapWithConcurrency(
    allFiles,
    FETCH_CONCURRENCY,
    async (file) => {
      const tsv = await fetchText(file.url);
      return parsePopulationTsv(tsv, file.ym);
    },
  );

  const generatedAt = new Date().toISOString().slice(0, 10);
  const dataset = buildPopulationDataset({
    snapshots,
    sources,
    generatedAt,
  });

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, formatPopulationDatasetJson(dataset), "utf-8");

  console.log(
    `Generated ${path.relative(process.cwd(), OUTPUT_PATH)} (${dataset.range.snapshotCount} months: ${dataset.range.startYm}..${dataset.range.endYm})`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
  await runPopulationPipeline();
}
