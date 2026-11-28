import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPopulationDataset,
  formatPopulationDatasetJson,
} from "../../pipelines/build-population";
import {
  extractWorkMonthFiles,
  POPULATION_WORK_SOURCES,
  parsePopulationTsv,
} from "../../pipelines/population/parsers";
import {
  aggregateBands,
  buildTrendSeries,
  computeGlobalMaxBandSide,
  computeSnapshotMetrics,
  findDecadeTrendGroupForBand,
  formatYmJa,
  getJapaneseEraLabel,
  resolveComparisonSnapshot,
  resolveSnapshotForYearMonth,
} from "./population-analytics";
import {
  POPULATION_AGE_COUNT,
  POPULATION_MAX_AGE,
  type PopulationSnapshot,
  populationDatasetSchema,
} from "./population-schema";

function makeSyntheticTsv(
  ym: string,
  maleValueAtAge: (age: number) => number,
  femaleValueAtAge: (age: number) => number,
): string {
  const ymCompact = ym.replace("-", "");
  const lines = [
    "#LINK",
    "#lang\tja",
    "#attribution_name\t松本市DX推進本部",
    "#license\thttp://creativecommons.org/licenses/by/3.0/deed.ja",
    `#file_name\tnenreibetsu_danjobetsu_${ymCompact}`,
    "#download_from\thttp://linkdata.org/work/rdf1s10410i",
    "#property\t年齢\t総数\t男\t女",
    "#object_type_xsd\tstring:ja\tstring:ja\tstring:ja\tstring:ja",
    "#property_context\tAssertion\tAssertion\tAssertion\tAssertion",
  ];
  for (let age = 0; age <= POPULATION_MAX_AGE; age++) {
    const m = maleValueAtAge(age);
    const f = femaleValueAtAge(age);
    lines.push(`${age + 1}\t${age}歳\t${m + f}\t${m}\t${f}`);
  }
  return lines.join("\n");
}

function makeSnapshot(
  ym: string,
  maleAtAge: (age: number) => number,
  femaleAtAge: (age: number) => number,
): PopulationSnapshot {
  const [yStr, mStr] = ym.split("-");
  const maleByAge = Array.from({ length: POPULATION_AGE_COUNT }, (_, age) =>
    maleAtAge(age),
  );
  const femaleByAge = Array.from({ length: POPULATION_AGE_COUNT }, (_, age) =>
    femaleAtAge(age),
  );
  const male = maleByAge.reduce((s, v) => s + v, 0);
  const female = femaleByAge.reduce((s, v) => s + v, 0);
  return {
    ym,
    year: Number.parseInt(yStr ?? "2026", 10),
    month: Number.parseInt(mStr ?? "1", 10),
    total: male + female,
    male,
    female,
    maleByAge,
    femaleByAge,
  };
}

describe("population LinkData parsers", () => {
  it("extracts deduplicated, ascending monthly TSV URLs from LinkData HTML", () => {
    const html = `
      <a href="/download/rdf1s10410i/link/nenreibetsu_danjobetsu_202603.txt">3月</a>
      <a href="http://linkdata.org/download/rdf1s10410i/link/nenreibetsu_danjobetsu_202601.txt">1月</a>
      <a href="https://ja.linkdata.org/download/rdf1s10410i/link/nenreibetsu_danjobetsu_202602.txt">2月</a>
      <a href="http://linkdata.org/download/rdf1s10410i/link/nenreibetsu_danjobetsu_202601.txt">1月重複</a>
    `;

    const files = extractWorkMonthFiles(html, "rdf1s10410i", 2026);
    expect(files).toHaveLength(3);
    expect(files.map((f) => f.ym)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(files[0]?.url).toBe(
      "http://linkdata.org/download/rdf1s10410i/link/nenreibetsu_danjobetsu_202601.txt",
    );
  });

  it("rejects LinkData HTML with no files or mismatched year", () => {
    expect(() =>
      extractWorkMonthFiles("<html></html>", "rdf1s10410i", 2026),
    ).toThrow();
    expect(() =>
      extractWorkMonthFiles(
        '<a href="/download/rdf1s10410i/link/nenreibetsu_danjobetsu_202501.txt">x</a>',
        "rdf1s10410i",
        2026,
      ),
    ).toThrow();
  });

  it("parses valid 110-row population TSV including BOM and fullwidth digits", () => {
    const baseTsv = makeSyntheticTsv(
      "2026-11",
      (age) => (age <= 10 ? 500 : 100),
      (age) => (age <= 10 ? 480 : 120),
    ).replace("1\t0歳\t980\t500\t480", "1\t０歳\t980\t500\t480");

    const parsed = parsePopulationTsv(`\uFEFF${baseTsv}`, "2026-11");
    expect(parsed.ym).toBe("2026-11");
    expect(parsed.year).toBe(2026);
    expect(parsed.month).toBe(11);
    expect(parsed.maleByAge[0]).toBe(500);
    expect(parsed.femaleByAge[0]).toBe(480);
    expect(parsed.total).toBe(parsed.male + parsed.female);
  });

  it("rejects TSV with gender sum mismatch, duplicate age, or missing age row", () => {
    const valid = makeSyntheticTsv(
      "2026-11",
      () => 10,
      () => 12,
    );

    const mismatch = valid.replace("1\t0歳\t22\t10\t12", "1\t0歳\t25\t10\t12");
    expect(() => parsePopulationTsv(mismatch, "2026-11")).toThrow();

    const missing = valid
      .split("\n")
      .filter((line) => !line.startsWith("110\t109歳"))
      .join("\n");
    expect(() => parsePopulationTsv(missing, "2026-11")).toThrow();

    const duplicate = `${valid}\n111\t0歳\t22\t10\t12`;
    expect(() => parsePopulationTsv(duplicate, "2026-11")).toThrow();
  });
});

describe("population analytics helpers", () => {
  it("formats Japanese era labels accurately across Heisei/Reiwa boundary", () => {
    expect(getJapaneseEraLabel(2017, 1)).toBe("平成29年");
    expect(getJapaneseEraLabel(2019, 4)).toBe("平成31年");
    expect(getJapaneseEraLabel(2019, 5)).toBe("令和元年");
    expect(getJapaneseEraLabel(2026, 11)).toBe("令和8年");
    expect(formatYmJa("2026-11")).toBe("2026年11月（令和8年）");
  });

  it("preserves exact population totals across decade, five-year, and single-year bands", () => {
    const snap = makeSnapshot(
      "2026-11",
      (age) => (age < 100 ? age + 10 : 1),
      (age) => (age < 100 ? age + 15 : 2),
    );

    const decadeBands = aggregateBands(snap, "decade");
    const fiveBands = aggregateBands(snap, "five_year");
    const singleBands = aggregateBands(snap, "single");

    expect(decadeBands).toHaveLength(11);
    expect(fiveBands).toHaveLength(21);
    expect(singleBands).toHaveLength(101);

    for (const bands of [decadeBands, fiveBands, singleBands]) {
      expect(bands.reduce((s, b) => s + b.male, 0)).toBe(snap.male);
      expect(bands.reduce((s, b) => s + b.female, 0)).toBe(snap.female);
      expect(bands.reduce((s, b) => s + b.total, 0)).toBe(snap.total);
    }

    expect(
      findDecadeTrendGroupForBand(fiveBands[5] as (typeof fiveBands)[number]),
    ).toBe("20-29");
    expect(
      findDecadeTrendGroupForBand(
        decadeBands[decadeBands.length - 1] as (typeof decadeBands)[number],
      ),
    ).toBe("90+");
  });

  it("computes three-tier metrics, median age, average age, and peak age correctly", () => {
    const snap = makeSnapshot(
      "2026-01",
      (age) => (age === 50 ? 100 : age < 70 ? 10 : 0),
      (age) => (age === 50 ? 120 : age < 70 ? 10 : 0),
    );

    const metrics = computeSnapshotMetrics(snap);
    expect(
      metrics.youthCount + metrics.workingCount + metrics.elderlyCount,
    ).toBe(snap.total);
    expect(metrics.peakAge).toEqual({
      age: 50,
      total: 220,
      male: 100,
      female: 120,
    });
    expect(metrics.medianAge).toBe(39);
    expect(metrics.averageAge).toBeGreaterThan(35);
    expect(metrics.averageAge).toBeLessThan(45);
  });

  it("resolves year/month with safe fallback and comparison targets", () => {
    const s2017 = makeSnapshot(
      "2017-11",
      () => 10,
      () => 10,
    );
    const s2021 = makeSnapshot(
      "2021-11",
      () => 11,
      () => 11,
    );
    const s2025 = makeSnapshot(
      "2025-11",
      () => 12,
      () => 12,
    );
    const s2026Oct = makeSnapshot(
      "2026-10",
      () => 13,
      () => 13,
    );
    const s2026Nov = makeSnapshot(
      "2026-11",
      () => 14,
      () => 14,
    );
    const snapshots = [s2017, s2021, s2025, s2026Oct, s2026Nov];

    // 2026-12 does not exist -> clamps to 2026-11
    expect(resolveSnapshotForYearMonth(snapshots, 2026, 12).ym).toBe("2026-11");

    expect(
      resolveComparisonSnapshot(snapshots, s2026Nov, "start_2017")?.ym,
    ).toBe("2017-11");
    expect(
      resolveComparisonSnapshot(snapshots, s2026Nov, "five_years_ago")?.ym,
    ).toBe("2021-11");
    expect(
      resolveComparisonSnapshot(snapshots, s2026Nov, "prev_year")?.ym,
    ).toBe("2025-11");
    expect(
      resolveComparisonSnapshot(snapshots, s2017, "start_2017"),
    ).toBeNull();
    expect(resolveComparisonSnapshot(snapshots, s2026Nov, "none")).toBeNull();

    const maxSide = computeGlobalMaxBandSide(snapshots, "decade");
    expect(maxSide).toBe(140);

    const trend = buildTrendSeries(snapshots, 20, 29, "annual_same_month", 11);
    expect(trend).toHaveLength(4);
    expect(trend[0]?.diffFromStart).toBe(0);
    expect(trend[3]?.diffFromStart).toBe(80);
  });

  it("rejects gaps in months when building dataset and serializes round-trip JSON", () => {
    const s1 = makeSnapshot(
      "2026-01",
      () => 1,
      () => 1,
    );
    const s3 = makeSnapshot(
      "2026-03",
      () => 1,
      () => 1,
    );
    const src = [
      {
        year: 2026,
        eraLabel: "令和8年",
        workId: "rdf1s10410i",
        url: "http://linkdata.org/work/rdf1s10410i",
        license: "CC BY 3.0" as const,
        monthCount: 2,
      },
    ];

    expect(() =>
      buildPopulationDataset({
        snapshots: [s1, s3],
        sources: src,
        generatedAt: "2026-11-28",
      }),
    ).toThrow(/Missing month/);

    const s2 = makeSnapshot(
      "2026-02",
      () => 2,
      () => 2,
    );
    const valid = buildPopulationDataset({
      snapshots: [s2, s1],
      sources: src,
      generatedAt: "2026-11-28",
    });
    const roundTripped = populationDatasetSchema.parse(
      JSON.parse(formatPopulationDatasetJson(valid)),
    );
    expect(roundTripped.snapshots.map((s) => s.ym)).toEqual([
      "2026-01",
      "2026-02",
    ]);
  });
});

describe("generated src/data/population.json integrity", () => {
  it("validates schema, contiguous monthly archive from 2017-01, and realistic Matsumoto totals", async () => {
    const raw = await readFile(
      path.resolve("src/data/population.json"),
      "utf-8",
    );
    const dataset = populationDatasetSchema.parse(JSON.parse(raw));

    expect(dataset.sources).toHaveLength(POPULATION_WORK_SOURCES.length);
    expect(dataset.range.years).toEqual(
      POPULATION_WORK_SOURCES.map((s) => s.year),
    );
    expect(dataset.range.startYm).toBe("2017-01");
    expect(dataset.snapshots.length).toBeGreaterThanOrEqual(119);
    expect(dataset.range.snapshotCount).toBe(dataset.snapshots.length);

    for (let i = 0; i < dataset.snapshots.length; i++) {
      const snap = dataset.snapshots[i];
      if (!snap) continue;
      expect(snap.total).toBeGreaterThan(200_000);
      expect(snap.total).toBeLessThan(260_000);
      expect(snap.maleByAge).toHaveLength(POPULATION_AGE_COUNT);
      expect(snap.femaleByAge).toHaveLength(POPULATION_AGE_COUNT);
      if (i > 0) {
        const prev = dataset.snapshots[i - 1];
        if (prev) {
          expect(snap.ym > prev.ym).toBe(true);
        }
      }
    }
  });
});
