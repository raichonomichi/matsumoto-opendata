export interface RawBathRecord {
  id: string;
  name: string;
  registryName: string;
  postalCode: string | null;
  address: string;
  operator: string | null;
  permitCategory: "一般公衆浴場" | "その他の公衆浴場";
  permittedAt: string | null;
  permitNumber: string | null;
}

export interface ParsedLinkDataBath {
  metadata: {
    attributionName: string;
    licenseUrl: string;
    downloadFrom: string;
  };
  records: RawBathRecord[];
}

function normalizeDate(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  return null;
}

function normalizeRegistryName(value: string): string {
  return value
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAddress(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * LinkData「松本市の生活衛生施設データ（matsumoto_bath.txt）」の TSV をパースする。
 */
export function parseLinkDataBathTsv(tsvText: string): ParsedLinkDataBath {
  const lines = tsvText.replace(/^\uFEFF/, "").split(/\r?\n/);
  const metadata = {
    attributionName: "松本市　DX推進本部",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/deed.ja",
    downloadFrom: "http://linkdata.org/work/rdf1s8757i",
  };
  const records: RawBathRecord[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    if (line.startsWith("#")) {
      const parts = line.split("\t");
      const key = parts[0]?.trim();
      const val = parts[1]?.trim();
      if (key === "#attribution_name" && val) metadata.attributionName = val;
      if (key === "#license" && val) {
        metadata.licenseUrl = val.replace(/^http:\/\//, "https://");
      }
      if (key === "#download_from" && val) metadata.downloadFrom = val;
      continue;
    }

    const cols = line.split("\t");
    const id = (cols[0] ?? "").trim();
    const rawName = (cols[1] ?? "").trim();
    const postalCode = (cols[2] ?? "").normalize("NFKC").trim() || null;
    const address = normalizeAddress(cols[3] ?? "");
    const operator =
      (cols[4] ?? "")
        .replace(/\u3000/g, " ")
        .replace(/\s+/g, " ")
        .trim() || null;
    const rawCategory = (cols[5] ?? "").trim();
    const permittedAt = normalizeDate(cols[6]);
    const permitNumber = (cols[7] ?? "").trim() || null;

    if (!id || !rawName || !address) continue;
    if (rawCategory !== "一般公衆浴場" && rawCategory !== "その他の公衆浴場") {
      throw new Error(
        `Unexpected permitCategory "${rawCategory}" for record #${id} (${rawName})`,
      );
    }

    records.push({
      id,
      name: rawName,
      registryName: normalizeRegistryName(rawName),
      postalCode,
      address,
      operator,
      permitCategory: rawCategory,
      permittedAt,
      permitNumber,
    });
  }

  return { metadata, records };
}
