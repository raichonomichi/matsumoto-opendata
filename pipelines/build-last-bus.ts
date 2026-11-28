import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GtfsFeedId } from "../src/lib/last-bus-schema";
import { extractZipTextEntries } from "./build-yamagoya";
import {
  buildLastBusDataset,
  type ParsedRawGtfsFeed,
  parseRawGtfsFeed,
} from "./last-bus/parsers";

const GTFS_FEED_URLS: Record<GtfsFeedId, string> = {
  guruttomatsumotobus1:
    "https://api.gtfs-data.jp/v2/organizations/matsumotocity/feeds/guruttomatsumotobus1/files/feed.zip?rid=current",
  guruttomatsumotobus2:
    "https://api.gtfs-data.jp/v2/organizations/matsumotocity/feeds/guruttomatsumotobus2/files/feed.zip?rid=current",
};

const OUTPUT_PATH = path.resolve("src/data/last-bus.json");

async function fetchRawGtfsFeed(
  feedId: GtfsFeedId,
): Promise<ParsedRawGtfsFeed> {
  const url = GTFS_FEED_URLS[feedId];
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const entries = extractZipTextEntries(buffer);

  const required = (name: string): string => {
    const content = entries.get(name);
    if (!content) {
      throw new Error(`GTFS feed ${feedId} is missing ${name}`);
    }
    return content;
  };

  return parseRawGtfsFeed({
    feedId,
    feedInfoCsv: required("feed_info.txt"),
    routesCsv: required("routes.txt"),
    stopsCsv: required("stops.txt"),
    tripsCsv: required("trips.txt"),
    calendarCsv: required("calendar.txt"),
    calendarDatesCsv: entries.get("calendar_dates.txt"),
    stopTimesCsv: required("stop_times.txt"),
  });
}

export async function runLastBusPipeline(): Promise<void> {
  console.log("Fetching Matsumoto GTFS-JP feeds (bus1 & bus2)...");
  const [feed1, feed2] = await Promise.all([
    fetchRawGtfsFeed("guruttomatsumotobus1"),
    fetchRawGtfsFeed("guruttomatsumotobus2"),
  ]);

  const generatedAt = new Date().toISOString().slice(0, 10);
  const dataset = buildLastBusDataset({
    feeds: [feed1, feed2],
    generatedAt,
  });

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(dataset)}\n`, "utf-8");

  console.log(
    `Generated ${path.relative(process.cwd(), OUTPUT_PATH)} (${dataset.stats.routeCount} routes, ${dataset.stats.stopCount} stops, ${dataset.stats.scheduleGroupCount} schedule groups)`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
  await runLastBusPipeline();
}
