import { inflateRawSync } from "node:zlib";

export interface XlsxSheetData {
  name: string;
  rows: Array<Record<string, string>>;
}

interface ZipEntryMeta {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

function findEocdOffset(buf: Buffer): number {
  const minOffset = Math.max(0, buf.length - 65_557);
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      return i;
    }
  }
  throw new Error("Invalid ZIP/XLSX buffer: EOCD signature not found");
}

function parseZipEntries(buf: Buffer): Map<string, ZipEntryMeta> {
  const eocdOffset = findEocdOffset(buf);
  const entryCount = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  const entries = new Map<string, ZipEntryMeta>();
  let pos = cdOffset;
  for (let i = 0; i < entryCount; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== CD_SIG) {
      throw new Error("Invalid ZIP Central Directory header");
    }
    const compressionMethod = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);
    const fileName = buf.toString("utf-8", pos + 46, pos + 46 + nameLen);

    entries.set(fileName, {
      fileName,
      compressionMethod,
      compressedSize,
      localHeaderOffset,
    });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readZipEntryText(
  buf: Buffer,
  entries: Map<string, ZipEntryMeta>,
  fileName: string,
): string | null {
  const meta = entries.get(fileName);
  if (!meta) return null;

  const off = meta.localHeaderOffset;
  if (off + 30 > buf.length || buf.readUInt32LE(off) !== LFH_SIG) {
    throw new Error(`Invalid ZIP Local File Header for ${fileName}`);
  }
  const lNameLen = buf.readUInt16LE(off + 26);
  const lExtraLen = buf.readUInt16LE(off + 28);
  const dataStart = off + 30 + lNameLen + lExtraLen;
  const compressedSlice = buf.subarray(
    dataStart,
    dataStart + meta.compressedSize,
  );

  if (meta.compressionMethod === 0) {
    return compressedSlice.toString("utf-8");
  }
  if (meta.compressionMethod === 8) {
    return inflateRawSync(compressedSlice).toString("utf-8");
  }
  throw new Error(
    `Unsupported ZIP compression method ${meta.compressionMethod} for ${fileName}`,
  );
}

export function decodeXmlEntities(text: string): string {
  return text
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function parseXmlAttributes(attrText: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([A-Za-z0-9_:-]+)\s*=\s*"([^"]*)"/g;
  for (const m of attrText.matchAll(attrRegex)) {
    attrs[m[1]] = decodeXmlEntities(m[2]);
  }
  return attrs;
}

/**
 * SharedStrings の <si> や inlineStr の <is> から、ふりがな(<rPh>)を除外した本文を抽出する。
 */
function extractRichTextWithoutPhonetic(xmlFragment: string): string {
  const withoutRph = xmlFragment
    .replace(/<rPh\b[^>]*\/>/g, "")
    .replace(/<rPh\b[^>]*>[\s\S]*?<\/rPh>/g, "");
  let combined = "";
  const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  for (const m of withoutRph.matchAll(tRegex)) {
    combined += decodeXmlEntities(m[1]);
  }
  return combined;
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  for (const m of xml.matchAll(siRegex)) {
    strings.push(extractRichTextWithoutPhonetic(m[1]));
  }
  return strings;
}

function parseRelationships(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const relRegex = /<Relationship\b([^>]*?)\/?>/g;
  for (const m of xml.matchAll(relRegex)) {
    const attrs = parseXmlAttributes(m[1]);
    if (attrs.Id && attrs.Target) {
      map.set(attrs.Id, attrs.Target);
    }
  }
  return map;
}

function normalizeWorksheetTarget(target: string): string {
  const cleaned = target.replace(/^\/+/, "");
  if (cleaned.startsWith("xl/")) return cleaned;
  return `xl/${cleaned}`;
}

function indexToColumnLetters(zeroBasedIndex: number): string {
  let n = zeroBasedIndex + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function parseWorksheetRows(
  xml: string,
  sharedStrings: string[],
): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;

  for (const rowMatch of xml.matchAll(rowRegex)) {
    const rowBody = rowMatch[1];
    const rowValues: Record<string, string> = {};
    const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let fallbackColIdx = 0;

    for (const cellMatch of rowBody.matchAll(cellRegex)) {
      const attrs = parseXmlAttributes(cellMatch[1]);
      const cellBody = cellMatch[2] ?? "";
      const ref = attrs.r ?? "";
      const colMatch = /^([A-Za-z]+)\d+$/.exec(ref);
      const col = colMatch
        ? colMatch[1].toUpperCase()
        : indexToColumnLetters(fallbackColIdx);
      fallbackColIdx += 1;

      const cellType = attrs.t ?? "";
      let value = "";

      if (cellType === "inlineStr") {
        const isMatch = /<is\b[^>]*>([\s\S]*?)<\/is>/.exec(cellBody);
        if (isMatch) {
          value = extractRichTextWithoutPhonetic(isMatch[1]);
        }
      } else {
        const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cellBody);
        if (vMatch) {
          const rawVal = decodeXmlEntities(vMatch[1]);
          if (cellType === "s") {
            const idx = Number.parseInt(rawVal, 10);
            value = sharedStrings[idx] ?? "";
          } else {
            value = rawVal;
          }
        }
      }

      const normalized = value.replace(/\r?\n/g, " ").trim();
      if (normalized !== "") {
        rowValues[col] = normalized;
      }
    }

    if (Object.keys(rowValues).length > 0) {
      rows.push(rowValues);
    }
  }

  return rows;
}

/**
 * XLSX / XLSM バッファを依存なしでパースし、全シートの行データを返す。
 */
export function readXlsxSheets(
  input: ArrayBuffer | Uint8Array | Buffer,
): XlsxSheetData[] {
  const buf = Buffer.isBuffer(input)
    ? input
    : input instanceof ArrayBuffer
      ? Buffer.from(input)
      : Buffer.from(input.buffer, input.byteOffset, input.byteLength);

  const entries = parseZipEntries(buf);
  const sharedStrings = parseSharedStrings(
    readZipEntryText(buf, entries, "xl/sharedStrings.xml"),
  );
  const workbookXml = readZipEntryText(buf, entries, "xl/workbook.xml");
  const relsXml = readZipEntryText(buf, entries, "xl/_rels/workbook.xml.rels");
  if (!workbookXml || !relsXml) {
    throw new Error("Missing workbook.xml or workbook.xml.rels in XLSX");
  }

  const relMap = parseRelationships(relsXml);
  const sheets: XlsxSheetData[] = [];
  const sheetRegex = /<sheet\b([^>]*?)\/?>/g;

  for (const m of workbookXml.matchAll(sheetRegex)) {
    const attrs = parseXmlAttributes(m[1]);
    const name = attrs.name;
    const rid = attrs["r:id"];
    if (!name || !rid) continue;
    const target = relMap.get(rid);
    if (!target) continue;
    const sheetXml = readZipEntryText(
      buf,
      entries,
      normalizeWorksheetTarget(target),
    );
    if (!sheetXml) continue;
    sheets.push({
      name,
      rows: parseWorksheetRows(sheetXml, sharedStrings),
    });
  }

  return sheets;
}
