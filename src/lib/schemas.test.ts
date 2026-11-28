import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { wifiSpotSchema } from "./free-wifi-schema";
import { lastBusRouteSchema } from "./last-bus-schema";
import { branchYearMetricsSchema } from "./library-usage-schema";
import { castleEventSchema } from "./matsumoto-castle-schema";
import { populationSnapshotSchema } from "./population-schema";
import { datasetSchema, serviceSchema } from "./schemas";
import { bathTimeWindowSchema } from "./sentou-schema";
import { yamagoyaRecordSchema } from "./yamagoya-schema";

async function collectAstroFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectAstroFiles(full)));
    } else if (entry.name.endsWith(".astro")) {
      files.push(full);
    }
  }
  return files;
}

describe("datasetSchema", () => {
  it("validates all dataset manifests in src/content/datasets", async () => {
    const dir = path.resolve("src/content/datasets");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);

    const ids = new Set<string>();
    for (const file of files) {
      const raw = await readFile(path.join(dir, file), "utf-8");
      const parsed = datasetSchema.parse(JSON.parse(raw));
      expect(ids.has(parsed.id)).toBe(false);
      ids.add(parsed.id);
    }
  });

  it("rejects invalid dataset id or date format", () => {
    const result = datasetSchema.safeParse({
      id: "Invalid_ID",
      name: "Test",
      provider: "松本市",
      description: "desc",
      sourceUrl: "https://example.com",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      attribution: "松本市",
      format: ["CSV"],
      updateFrequency: "随時",
      updatedAt: "2026/11/25",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URLs, unknown licenses, empty format, and invalid validUntil", () => {
    const base = {
      id: "valid-id",
      name: "Test",
      provider: "松本市",
      description: "desc",
      sourceUrl: "https://example.com",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      attribution: "松本市",
      format: ["CSV"],
      updateFrequency: "随時",
      updatedAt: "2026-11-25",
    };

    expect(
      datasetSchema.safeParse({ ...base, sourceUrl: "not-a-url" }).success,
    ).toBe(false);
    expect(
      datasetSchema.safeParse({ ...base, licenseUrl: "invalid" }).success,
    ).toBe(false);
    expect(datasetSchema.safeParse({ ...base, license: "MIT" }).success).toBe(
      false,
    );
    expect(datasetSchema.safeParse({ ...base, format: [] }).success).toBe(
      false,
    );
    expect(
      datasetSchema.safeParse({ ...base, validUntil: "2026-13" }).success,
    ).toBe(false);
  });
});

describe("serviceSchema", () => {
  it("validates all service manifests in src/content/services and checks dataset references", async () => {
    const datasetDir = path.resolve("src/content/datasets");
    const datasetFiles = (await readdir(datasetDir)).filter((f) =>
      f.endsWith(".json"),
    );
    const datasetIds = new Set<string>();
    for (const file of datasetFiles) {
      const raw = await readFile(path.join(datasetDir, file), "utf-8");
      datasetIds.add(datasetSchema.parse(JSON.parse(raw)).id);
    }

    const serviceDir = path.resolve("src/content/services");
    const serviceFiles = (await readdir(serviceDir)).filter((f) =>
      f.endsWith(".json"),
    );
    expect(serviceFiles.length).toBeGreaterThan(0);

    for (const file of serviceFiles) {
      const raw = await readFile(path.join(serviceDir, file), "utf-8");
      const parsed = serviceSchema.parse(JSON.parse(raw));
      for (const dsId of parsed.datasets) {
        expect(datasetIds.has(dsId)).toBe(true);
      }

      // Corresponding Astro page must exist for every registered service path
      const pagePath = path.resolve(
        "src/pages",
        parsed.path.replace(/^\/|\/$/g, ""),
        "index.astro",
      );
      await expect(access(pagePath)).resolves.toBeUndefined();
    }
  });

  it("verifies all datasetIds referenced in src/pages/**/*.astro exist in src/content/datasets", async () => {
    const datasetDir = path.resolve("src/content/datasets");
    const datasetFiles = (await readdir(datasetDir)).filter((f) =>
      f.endsWith(".json"),
    );
    const datasetIds = new Set<string>();
    for (const file of datasetFiles) {
      const raw = await readFile(path.join(datasetDir, file), "utf-8");
      datasetIds.add(datasetSchema.parse(JSON.parse(raw)).id);
    }

    const pages = await collectAstroFiles(path.resolve("src/pages"));
    let pagesWithDatasetIds = 0;

    for (const pageFile of pages) {
      const source = await readFile(pageFile, "utf-8");
      const matches = [
        ...source.matchAll(/const\s+datasetIds\s*=\s*\[([\s\S]*?)\]/g),
        ...source.matchAll(/datasetIds=\{\[([\s\S]*?)\]\}/g),
      ];
      if (matches.length === 0) continue;
      pagesWithDatasetIds++;
      for (const m of matches) {
        const body = m[1] ?? "";
        const ids = [...body.matchAll(/["']([a-z0-9-]+)["']/g)].map(
          (idMatch) => idMatch[1],
        );
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) {
          expect(datasetIds.has(id)).toBe(true);
        }
      }
    }

    expect(pagesWithDatasetIds).toBeGreaterThanOrEqual(8);
  });

  it("validates a service manifest and rejects invalid fields", () => {
    const valid = serviceSchema.safeParse({
      id: "yamagoya-registry",
      title: "ヤマゴヤ・レジストリ",
      summary: "北アルプス・松本周辺の山小屋データベース",
      status: "published",
      path: "/yamagoya/",
      datasets: ["matsumoto-opendata-portal"],
      tags: ["山小屋", "北アルプス"],
      publishedAt: "2026-12-01",
    });
    expect(valid.success).toBe(true);

    const invalid = serviceSchema.safeParse({
      id: "yamagoya",
      title: "test",
      summary: "test",
      status: "published",
      path: "yamagoya",
      datasets: [],
      tags: [],
    });
    expect(invalid.success).toBe(false);

    expect(
      serviceSchema.safeParse({
        id: "ok-id",
        title: "test",
        summary: "test",
        status: "archived",
        path: "/ok/",
        datasets: [],
        tags: [],
      }).success,
    ).toBe(false);

    expect(
      serviceSchema.safeParse({
        id: "ok-id",
        title: "test",
        summary: "test",
        status: "beta",
        path: "/ok",
        datasets: [],
        tags: [],
        publishedAt: "2026/11/28",
        issueUrl: "not-url",
      }).success,
    ).toBe(false);
  });
});

describe("domain schema invariants", () => {
  it("enforces castleEventSchema date order and nearby_exhibition zero impact", () => {
    const baseEvent = {
      id: "test-ev",
      sourceRecordId: "1",
      name: "テスト",
      scope: "castle",
      category: "文化",
      startDate: "2026-10-10",
      endDate: "2026-10-12",
      datePrecision: "exact",
      dateNote: "10月",
      venue: "松本城",
      address: null,
      summary: null,
      impactPoints: 10,
      isNightEvent: false,
      trafficNote: null,
      officialUrl: null,
      contact: null,
    };

    expect(castleEventSchema.safeParse(baseEvent).success).toBe(true);
    expect(
      castleEventSchema.safeParse({
        ...baseEvent,
        startDate: "2026-10-15",
        endDate: "2026-10-10",
      }).success,
    ).toBe(false);
    expect(
      castleEventSchema.safeParse({
        ...baseEvent,
        scope: "nearby_exhibition",
        impactPoints: 5,
      }).success,
    ).toBe(false);
  });

  it("enforces yamagoya, free-wifi, sentou, population, library-usage, and last-bus bounds", () => {
    expect(yamagoyaRecordSchema.shape.elevationM.safeParse(999).success).toBe(
      false,
    );
    expect(yamagoyaRecordSchema.shape.elevationM.safeParse(3201).success).toBe(
      false,
    );
    expect(wifiSpotSchema.shape.lat.safeParse(34.9).success).toBe(false);
    expect(wifiSpotSchema.shape.lng.safeParse(139.5).success).toBe(false);

    expect(
      bathTimeWindowSchema.safeParse({
        openMinutes: 600,
        lastEntryMinutes: 600,
        closeMinutes: 700,
      }).success,
    ).toBe(false);
    expect(
      bathTimeWindowSchema.safeParse({
        openMinutes: 600,
        lastEntryMinutes: 750,
        closeMinutes: 700,
      }).success,
    ).toBe(false);

    const zeros = Array.from({ length: 110 }, () => 0);
    expect(
      populationSnapshotSchema.safeParse({
        ym: "2026-11",
        year: 2026,
        month: 11,
        total: 10,
        male: 5,
        female: 4,
        maleByAge: zeros,
        femaleByAge: zeros,
      }).success,
    ).toBe(false);

    expect(
      branchYearMetricsSchema.shape.branchId.safeParse("unknown").success,
    ).toBe(false);
    expect(lastBusRouteSchema.shape.color.safeParse("#123456").success).toBe(
      false,
    );
  });
});
