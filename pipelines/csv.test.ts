import { describe, expect, it } from "vitest";
import { decodeCsvBuffer, parseCsvMatrix, parseCsvRows } from "./csv";

describe("decodeCsvBuffer", () => {
  it("decodes UTF-8 Japanese text from both Uint8Array and ArrayBuffer", () => {
    const encoded = new TextEncoder().encode("松本市,オープンデータ\n1,テスト");
    expect(decodeCsvBuffer(encoded)).toBe("松本市,オープンデータ\n1,テスト");
    expect(decodeCsvBuffer(encoded.buffer.slice(0))).toBe(
      "松本市,オープンデータ\n1,テスト",
    );
  });

  it("falls back to Shift_JIS when invalid UTF-8 bytes are provided", () => {
    // "松本" in Shift_JIS: 0x8f 0xbc 0x96 0x7b (invalid UTF-8)
    const sjisBytes = Uint8Array.from([0x8f, 0xbc, 0x96, 0x7b, 0x2c, 0x31]);
    expect(decodeCsvBuffer(sjisBytes)).toBe("松本,1");
    expect(decodeCsvBuffer(sjisBytes.buffer.slice(0))).toBe("松本,1");
  });
});

describe("parseCsvMatrix", () => {
  it("strips UTF-8 BOM and handles CRLF, LF, and standalone CR line endings", () => {
    const csv = "\uFEFFa,b\r\n1,2\n3,4\r5,6\r\n";
    expect(parseCsvMatrix(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });

  it("handles quoted commas, embedded newlines, and escaped quotes", () => {
    const csv = [
      "name,note,quote",
      '"松本, 長野","line1\nline2","say ""hello"""',
      'plain,simple,""',
    ].join("\n");
    expect(parseCsvMatrix(csv)).toEqual([
      ["name", "note", "quote"],
      ["松本, 長野", "line1\nline2", 'say "hello"'],
      ["plain", "simple", ""],
    ]);
  });

  it("filters blank rows and returns [] for empty input", () => {
    expect(parseCsvMatrix("")).toEqual([]);
    expect(parseCsvMatrix("   \n,\n\r\n")).toEqual([]);
    expect(parseCsvMatrix("a,b\n , \n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCsvRows", () => {
  it("returns [] for empty or header-only CSV", () => {
    expect(parseCsvRows("")).toEqual([]);
    expect(parseCsvRows("col1,col2\n")).toEqual([]);
  });

  it("trims headers/values, ignores empty header columns, and pads short rows", () => {
    const csv = " name , , count \n  松本城 , ignored , 10 \n  駅前  ";
    expect(parseCsvRows(csv)).toEqual([
      { name: "松本城", count: "10" },
      { name: "駅前", count: "" },
    ]);
  });
});
