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
