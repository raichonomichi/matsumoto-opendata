export interface RawWifiRecord {
  id: string;
  name: string;
  address: string;
  ssid: string | null;
  apCount: number;
  lng: number;
  lat: number;
  category: string;
}

export interface RawFacilityRecord {
  facilityNumber: string;
  name: string;
  address: string;
  district: string;
  department: string;
  section: string;
  category: string;
  phone: string | null;
  openDaysRaw: string;
  startRaw: string;
  endRaw: string;
  noteRaw: string;
  lng: number | null;
  lat: number | null;
}

/**
 * バイナリバッファを UTF-8（失敗時は Shift_JIS）としてデコードする。
 */
export function decodeCsvBuffer(buffer: ArrayBuffer | Uint8Array): string {
  const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(view);
  } catch {
    return new TextDecoder("shift_jis").decode(view);
  }
}

/**
 * RFC 4180 準拠の CSV パーサ（引用符内カンマ・エスケープ・BOM に対応）。
 */
export function parseCsvMatrix(csvText: string): string[][] {
  const clean = csvText.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      if (clean[i + 1] === "\n") {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * ヘッダー行付き CSV をオブジェクト配列へ変換する。
 */
export function parseCsvRows(csvText: string): Record<string, string>[] {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length === 0) return [];
  const headers = matrix[0].map((h) => h.trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    const obj: Record<string, string> = {};
    for (let col = 0; col < headers.length; col++) {
      const key = headers[col];
      if (!key) continue;
      obj[key] = (row[col] ?? "").trim();
    }
    records.push(obj);
  }

  return records;
}

function normalizePhone(raw: string): string | null {
  const clean = raw.normalize("NFKC").replace(/\s+/g, "").trim();
  if (!clean) return null;
  if (/^\d{2}-\d{4}$/.test(clean)) {
    return `0263-${clean}`;
  }
  return clean;
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 松本デジタルまっぷ「公衆無線LANアクセスポイント一覧（opendata_32.csv）」をパースする。
 */
export function parseWifiCsv(
  input: string | ArrayBuffer | Uint8Array,
): RawWifiRecord[] {
  const text = typeof input === "string" ? input : decodeCsvBuffer(input);
  const rows = parseCsvRows(text);

  return rows.map((row, idx) => {
    const id = (row.項番 ?? "").normalize("NFKC").trim() || String(idx + 1);
    const name = normalizeText(row.施設名称 ?? "");
    const address = normalizeText(row.住所 ?? "");
    const ssidRaw = (row.SSID ?? "").trim();
    const apRaw = (row.AP数 ?? "1").normalize("NFKC").trim();
    const apCount = Number.parseInt(apRaw, 10);
    const lng = Number.parseFloat((row.経度 ?? "").normalize("NFKC"));
    const lat = Number.parseFloat((row.緯度 ?? "").normalize("NFKC"));

    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error(`Invalid Wi-Fi CSV row at 項番=${id}: name=${name}`);
    }

    return {
      id,
      name,
      address,
      ssid: ssidRaw.length > 0 ? ssidRaw : null,
      apCount: Number.isFinite(apCount) && apCount > 0 ? apCount : 1,
      lng,
      lat,
      category: normalizeText(row.分類 ?? "公衆無線LANアクセスポイント"),
    };
  });
}

/**
 * 松本デジタルまっぷ「公共施設データ」各レイヤー CSV をパースする。
 */
export function parsePublicFacilitiesCsv(
  input: string | ArrayBuffer | Uint8Array,
): RawFacilityRecord[] {
  const text = typeof input === "string" ? input : decodeCsvBuffer(input);
  const rows = parseCsvRows(text);

  return rows
    .filter(
      (row) =>
        (row.施設番号 ?? "").trim() !== "" && (row.施設名 ?? "").trim() !== "",
    )
    .map((row) => {
      const lngVal = Number.parseFloat((row.経度 ?? "").normalize("NFKC"));
      const latVal = Number.parseFloat((row.緯度 ?? "").normalize("NFKC"));
      return {
        facilityNumber: (row.施設番号 ?? "").normalize("NFKC").trim(),
        name: normalizeText(row.施設名 ?? ""),
        address: normalizeText(row.所在地 ?? ""),
        district: normalizeText(row.地域区分 ?? ""),
        department: normalizeText(row.部局名 ?? ""),
        section: normalizeText(row.課名 ?? ""),
        category: normalizeText(row.区分 ?? ""),
        phone: normalizePhone(row.電話番号 ?? ""),
        openDaysRaw: (row.利用可能曜日 ?? "").trim(),
        startRaw: (row.開始時間 ?? "").trim(),
        endRaw: (row.終了時間 ?? "").trim(),
        noteRaw: normalizeText(row.利用可能時間特記事項 ?? ""),
        lng: Number.isFinite(lngVal) ? lngVal : null,
        lat: Number.isFinite(latVal) ? latVal : null,
      };
    });
}
