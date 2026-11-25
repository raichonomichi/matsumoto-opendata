import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import {
  buildYamagoyaDataset,
  type ParsedGtfsFeed,
  parseGtfsFeed,
  parseLinkDataHotelTsv,
} from "./yamagoya/parsers";

const HOTEL_REGISTRY_URL =
  "http://linkdata.org/download/rdf1s8757i/link/matsumoto_hotel.txt";

const GTFS_FEED_URLS = {
  guruttomatsumotobus1:
    "https://api.gtfs-data.jp/v2/organizations/matsumotocity/feeds/guruttomatsumotobus1/files/feed.zip?rid=current",
  guruttomatsumotobus2:
    "https://api.gtfs-data.jp/v2/organizations/matsumotocity/feeds/guruttomatsumotobus2/files/feed.zip?rid=current",
} as const;

const OUTPUT_PATH = path.resolve("public/api/v1/yamagoya.json");

/**
 * Minimal ZIP reader using Node's built-in zlib (supports stored & deflate entries).
 */
export function extractZipTextEntries(buffer: Buffer): Map<string, string> {
  const entries = new Map<string, string>();
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;

  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (buffer.readUInt32LE(i) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error("Invalid ZIP archive: EOCD signature not found");
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid ZIP archive: central directory header mismatch");
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLen)
      .toString("utf-8");

    offset += 46 + fileNameLen + extraLen + commentLen;

    if (fileName.endsWith("/")) continue;

    const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

    let content: Buffer;
    if (compressionMethod === 0) {
      content = compressed;
    } else if (compressionMethod === 8) {
      content = inflateRawSync(compressed);
    } else {
      throw new Error(
        `Unsupported ZIP compression method ${compressionMethod} for ${fileName}`,
      );
    }
    entries.set(path.basename(fileName), content.toString("utf-8"));
  }

  return entries;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

async function fetchGtfsFeed(
  feedId: keyof typeof GTFS_FEED_URLS,
): Promise<ParsedGtfsFeed> {
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

  return parseGtfsFeed({
    feedId,
    feedInfoCsv: required("feed_info.txt"),
    routesCsv: required("routes.txt"),
    tripsCsv: required("trips.txt"),
    calendarCsv: required("calendar.txt"),
    stopTimesCsv: required("stop_times.txt"),
  });
}

export async function buildYamagoya(): Promise<void> {
  console.log("Fetching Matsumoto hotel registry & GTFS-JP feeds...");
  const [hotelTsv, feed1, feed2] = await Promise.all([
    fetchText(HOTEL_REGISTRY_URL),
    fetchGtfsFeed("guruttomatsumotobus1"),
    fetchGtfsFeed("guruttomatsumotobus2"),
  ]);

  const hotelData = parseLinkDataHotelTsv(hotelTsv);
  const generatedAt = new Date().toISOString().slice(0, 10);

  const dataset = buildYamagoyaDataset({
    hotelData,
    gtfsFeeds: {
      guruttomatsumotobus1: feed1,
      guruttomatsumotobus2: feed2,
    },
    generatedAt,
  });

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(dataset, null, 2)}\n`,
    "utf-8",
  );
  console.log(
    `Generated ${path.relative(process.cwd(), OUTPUT_PATH)} (${dataset.count} huts)`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
  await buildYamagoya();
}
