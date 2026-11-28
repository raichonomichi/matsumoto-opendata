import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { WeatherHistory } from "../src/lib/matsumoto-weather-history";
import {
  mergeWeatherHistory,
  parseMatsumotoWeatherCsv,
} from "./matsumoto-weather-history-csv";

const outputPath = fileURLToPath(
  new URL("../src/data/matsumoto-weather-history.json", import.meta.url),
);

async function importWeatherHistory(paths: string[]) {
  if (paths.length === 0) {
    throw new Error(
      "使い方: pnpm pipeline:matsumoto-weather-history <CSVファイル> [...]",
    );
  }

  const csvData = await Promise.all(paths.map((path) => readFile(path)));
  const imports = csvData.map(parseMatsumotoWeatherCsv);
  let existing: WeatherHistory = {};
  try {
    existing = JSON.parse(await readFile(outputPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const history = mergeWeatherHistory(existing, imports);
  const rows = Object.entries(history).map(
    ([date, temperatures]) =>
      `  ${JSON.stringify(date)}: ${JSON.stringify(temperatures)}`,
  );

  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, `{\n${rows.join(",\n")}\n}\n`);
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
  console.log(`松本の日別気温を更新しました（${rows.length}日分）。`);
}

await importWeatherHistory(process.argv.slice(2));
