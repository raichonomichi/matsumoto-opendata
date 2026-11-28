import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { branchIds } from "../../src/lib/library-usage-schema";
import {
  type BuildLibraryUsageInput,
  buildLibraryUsageDataset,
} from "../build-library-usage";
import {
  type LinkDataBranchRow,
  type NaganoLoanBranchRow,
  type NaganoMaterialBranchRow,
  normalizeBranchId,
  type ParsedMatsumotoStatsSheet,
  parseIntCell,
  parseLinkDataLibraryTsv,
  parseMatsumotoStatsFiscalYear,
  parseMatsumotoStatsLibrarySheet,
  parseNaganoSurveyLoanSheet,
  parseNaganoSurveyMaterialSheet,
  parseNaganoSurveyPopulationSheet,
} from "./parsers";
import { decodeXmlEntities, readXlsxSheets } from "./xlsx-reader";

function buildXlsxZip(
  entries: Array<{ name: string; content: string; method?: number }>,
): Buffer {
  const localParts: Buffer[] = [];
  const cdParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const method = entry.method ?? 8;
    const nameBuf = Buffer.from(entry.name, "utf-8");
    const rawBuf = Buffer.from(entry.content, "utf-8");
    const compBuf = method === 8 ? deflateRawSync(rawBuf) : rawBuf;

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt32LE(compBuf.length, 18);
    lfh.writeUInt32LE(rawBuf.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    localParts.push(lfh, nameBuf, compBuf);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt32LE(compBuf.length, 20);
    cdh.writeUInt32LE(rawBuf.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt32LE(offset, 42);
    cdParts.push(cdh, nameBuf);
    offset += lfh.length + nameBuf.length + compBuf.length;
  }

  const cdBuf = Buffer.concat(cdParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, cdBuf, eocd]);
}

function makeFullBuildInput(): BuildLibraryUsageInput {
  const linkDataByYear = new Map<number, LinkDataBranchRow[]>();
  const naganoByYear = new Map<
    number,
    {
      materials: NaganoMaterialBranchRow[];
      loans: NaganoLoanBranchRow[];
      populationOverride?: number;
    }
  >();
  const statsBranches: ParsedMatsumotoStatsSheet["branches"] = [];

  for (let fy = 2013; fy <= 2025; fy++) {
    const materials: NaganoMaterialBranchRow[] = branchIds.map((branchId) => ({
      branchId,
      holdingsBooks: 1000,
      holdingsBooksChildren: 300,
    }));
    const targetTotalReg = fy === 2023 ? 56915 : fy === 2024 ? 49725 : 1100;
    const perBranchReg = 100;
    const chuoReg = targetTotalReg - perBranchReg * (branchIds.length - 1);

    const loans: NaganoLoanBranchRow[] = branchIds.map((branchId, idx) => ({
      branchId,
      registeredTotal: idx === 0 ? chuoReg : perBranchReg,
      registeredChildren: 20,
      loansTotal: 500,
      loansChildren: 200,
      groupLoansTotal: 50,
      visitors: 300,
      population: idx === 0 ? 235000 : null,
    }));

    naganoByYear.set(fy, { materials, loans });

    if (fy <= 2018) {
      linkDataByYear.set(
        fy,
        branchIds.map((branchId) => ({
          branchId,
          openDays: 280,
          holdingsTotal: 2000,
          registeredTotal: 100,
          registeredChildren: 20,
          loansTotal: 500,
          loansChildren: 200,
          referenceCount: 10,
          reservationsTotal: 30,
          groupLoansTotal: 40,
        })),
      );
    }

    if (fy >= 2018 && fy <= 2024) {
      for (let i = 0; i < branchIds.length; i++) {
        statsBranches.push({
          branchId: branchIds[i],
          fiscalYear: fy,
          openDays: 280,
          holdingsTotal: 2000,
          registeredTotal: i === 0 ? chuoReg : perBranchReg,
          loansTotal: 500,
          referenceCount: 10,
          reservationsTotal: 30,
        });
      }
    }
  }

  return {
    linkDataByYear,
    matsumotoStatsEditions: [
      {
        branches: statsBranches,
        servicePoints: [],
        totals: [],
        groupLoansByYear: new Map(),
        closures: [],
      },
    ],
    naganoByYear,
    generatedAt: "2026-11-28",
  };
}

describe("xlsx-reader entities, inlineStr, AA+ columns, and error handling", () => {
  it("decodes numeric decimal, hex, _x000A_, and standard XML entities", () => {
    expect(
      decodeXmlEntities(
        "A &amp; B &lt;tag&gt; &quot;q&quot; &apos;s&#39; &#x3042; &#12356;_x0020_end",
      ),
    ).toBe(`A & B <tag> "q" 's' あ い end`);
  });

  it("reads inlineStr without sharedStrings.xml and auto-assigns columns past Z (AA, AB)", () => {
    const cells27 = Array.from({ length: 28 }, (_, idx) => {
      return `<c t="inlineStr"><is><t>c${idx}</t><rPh sb="0" eb="1"><t>x</t></rPh></is></c>`;
    }).join("");

    const zip = buildXlsxZip([
      {
        name: "xl/workbook.xml",
        content: `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        content: `<Relationships><Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml"/></Relationships>`,
      },
      {
        name: "xl/worksheets/sheet1.xml",
        content: `<worksheet><sheetData><row r="1">${cells27}</row></sheetData></worksheet>`,
      },
    ]);

    const sheets = readXlsxSheets(new Uint8Array(zip));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].rows[0].AA).toBe("c26");
    expect(sheets[0].rows[0].AB).toBe("c27");
  });

  it("throws on invalid ZIP, missing workbook, or unsupported compression method", () => {
    expect(() => readXlsxSheets(Buffer.from("invalid"))).toThrow(
      /EOCD signature not found/,
    );

    const missingWorkbook = buildXlsxZip([
      { name: "xl/sharedStrings.xml", content: "<sst/>" },
    ]);
    expect(() => readXlsxSheets(missingWorkbook)).toThrow(
      /Missing workbook\.xml/,
    );

    const badCompression = buildXlsxZip([
      { name: "xl/workbook.xml", content: "<workbook/>", method: 99 },
    ]);
    expect(() => readXlsxSheets(badCompression)).toThrow(
      /Unsupported ZIP compression method 99/,
    );
  });
});

describe("library-usage parsers edge cases & validation", () => {
  it("normalizes branch variants and parses cell integers and era fiscal years", () => {
    expect(normalizeBranchId("")).toBeNull();
    expect(normalizeBranchId("図書館")).toBeNull();
    expect(normalizeBranchId("松本市梓川図書館")).toBe("azusagawa");
    expect(normalizeBranchId("波田図書館")).toBe("hata");
    expect(normalizeBranchId("寿台")).toBe("kotobukidai");
    expect(normalizeBranchId("本郷")).toBe("hongo");
    expect(normalizeBranchId("島内")).toBe("shimauchi");
    expect(normalizeBranchId("空港")).toBe("kuko");

    expect(parseIntCell(undefined)).toBeNull();
    expect(parseIntCell("-")).toBeNull();
    expect(parseIntCell("…")).toBeNull();
    expect(parseIntCell("...")).toBeNull();
    expect(parseIntCell("－")).toBeNull();
    expect(parseIntCell("abc")).toBeNull();
    expect(parseIntCell("１，２３４")).toBe(1234);

    expect(parseMatsumotoStatsFiscalYear("25")).toBe(2013);
    expect(parseMatsumotoStatsFiscalYear("31")).toBe(2019);
    expect(parseMatsumotoStatsFiscalYear("7年度")).toBe(2025);
    expect(parseMatsumotoStatsFiscalYear("1")).toBeNull();
    expect(parseMatsumotoStatsFiscalYear("21")).toBeNull();
    expect(parseMatsumotoStatsFiscalYear("abc")).toBeNull();
  });

  it("throws on unknown branch in LinkData TSV or Matsumoto stats header, and parses closures/population", () => {
    expect(() =>
      parseLinkDataLibraryTsv("1\t未知図書館\t10\t10\t10\t1\t10\t1\t1\t1"),
    ).toThrow(/Unknown branch in LinkData TSV/);

    expect(() =>
      parseMatsumotoStatsLibrarySheet([{ A: "（99）存在しない館" }]),
    ).toThrow(/Unknown branch section header/);

    const parsedClosures = parseMatsumotoStatsLibrarySheet([
      { A: "（16）臨時閉館等" },
      { A: "年度", B: "図書館名" },
      { A: "元、2", B: "全館", D: "3/4〜", F: "感染症対策" },
      { A: "（13）四賀サービスポイント" },
      { A: "6", B: "100", E: "400", G: "20" },
    ]);
    expect(parsedClosures.closures).toEqual([
      {
        fiscalYears: [2019, 2020],
        branchLabel: "全館",
        period: "3/4〜",
        reason: "感染症対策",
      },
    ]);
    expect(parsedClosures.servicePoints[0]?.id).toBe("shiga-sp");

    expect(
      parseNaganoSurveyPopulationSheet([
        { A: "長野市", C: "370000" },
        { A: "松本市中央", C: "233,940" },
      ]),
    ).toBe(233940);
    expect(() =>
      parseNaganoSurveyPopulationSheet([{ A: "松本市中央", C: "50" }]),
    ).toThrow(/Matsumoto population not found/);
  });

  it("rejects Nagano survey sheets with unexpected branch name or wrong row count", () => {
    expect(() =>
      parseNaganoSurveyMaterialSheet([
        { A: "松本市中央", C: "10", D: "2" },
        { B: "不明館", C: "10", D: "2" },
      ]),
    ).toThrow(/Unexpected Matsumoto branch row/);

    expect(() =>
      parseNaganoSurveyLoanSheet([{ A: "松本市中央", C: "10", I: "20" }]),
    ).toThrow(/Expected 11 Matsumoto rows/);
  });
});

describe("buildLibraryUsageDataset validation & error guards", () => {
  it("builds a full validated dataset from synthetic 13-year inputs", () => {
    const dataset = buildLibraryUsageDataset(makeFullBuildInput());
    expect(dataset.annualRecords).toHaveLength(13);
    expect(dataset.annualRecords[12]?.fiscalYear).toBe(2025);
    expect(dataset.annualRecords[12]?.holdingsTotal).toBeNull();
  });

  it("throws on missing Nagano year, missing population, missing LinkData/Stats rows, total mismatches, and age snapshot mismatch", () => {
    const missingYear = makeFullBuildInput();
    missingYear.naganoByYear.delete(2020);
    expect(() => buildLibraryUsageDataset(missingYear)).toThrow(
      /Missing Nagano survey data for FY2020/,
    );

    const missingPop = makeFullBuildInput();
    const fy2025 = missingPop.naganoByYear.get(2025);
    if (fy2025) fy2025.loans[0].population = null;
    expect(() => buildLibraryUsageDataset(missingPop)).toThrow(
      /Missing population for FY2025/,
    );

    const missingLink = makeFullBuildInput();
    missingLink.linkDataByYear.delete(2015);
    expect(() => buildLibraryUsageDataset(missingLink)).toThrow(
      /Missing LinkData row chuo for FY2015/,
    );

    const missingStats = makeFullBuildInput();
    missingStats.matsumotoStatsEditions[0].branches =
      missingStats.matsumotoStatsEditions[0].branches.filter(
        (b) => !(b.fiscalYear === 2021 && b.branchId === "nanbu"),
      );
    expect(() => buildLibraryUsageDataset(missingStats)).toThrow(
      /Missing Matsumoto stats row nanbu for FY2021/,
    );

    const holdingsMismatch = makeFullBuildInput();
    holdingsMismatch.matsumotoStatsEditions[0].totals.push({
      fiscalYear: 2022,
      holdingsTotal: 999999,
      registeredTotal: 1100,
      loansTotal: 5500,
      referenceCount: 110,
      reservationsTotal: 330,
    });
    expect(() => buildLibraryUsageDataset(holdingsMismatch)).toThrow(
      /Holdings mismatch in FY2022/,
    );

    const ageMismatch = makeFullBuildInput();
    const b2024 = ageMismatch.matsumotoStatsEditions[0].branches.find(
      (b) => b.fiscalYear === 2024 && b.branchId === "chuo",
    );
    if (b2024) b2024.registeredTotal += 1;
    expect(() => buildLibraryUsageDataset(ageMismatch)).toThrow(
      /Age snapshot registeredTotal mismatch for FY2024/,
    );
  });
});
