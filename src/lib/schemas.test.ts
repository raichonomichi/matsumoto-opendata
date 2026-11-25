import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { datasetSchema, serviceSchema } from "./schemas";

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
});

describe("serviceSchema", () => {
  it("validates a service manifest and rejects invalid paths", () => {
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
  });
});
