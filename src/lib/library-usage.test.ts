import { readFile } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  normalizeBranchId,
  parseLinkDataLibraryTsv,
  parseMatsumotoStatsFiscalYear,
  parseMatsumotoStatsLibrarySheet,
  parseNaganoSurveyLoanSheet,
  parseNaganoSurveyMaterialSheet,
} from "../../pipelines/library-usage/parsers";
import { readXlsxSheets } from "../../pipelines/library-usage/xlsx-reader";
import {
  calcGrowthMultiple,
  calcPerCapita,
  calcSharePercent,
  calcYoYPercent,
  formatAxisValue,
  formatJaCount,
  formatSignedDelta,
  getBranchMetricValue,
  getCombinedTimelinePoints,
  getScopeYearValues,
  niceMax,
} from "./library-usage-metrics";
import {
  type AnnualRecord,
  type BranchYearMetrics,
  libraryUsageDatasetSchema,
} from "./library-usage-schema";

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createMinimalZip(
  entries: Array<{ name: string; content: string }>,
): Buffer {
  const localParts: Buffer[] = [];
  const cdParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf-8");
    const rawBuf = Buffer.from(entry.content, "utf-8");
    const compBuf = deflateRawSync(rawBuf);
    const crc = crc32(rawBuf);

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(8, 8);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compBuf.length, 18);
    lfh.writeUInt32LE(rawBuf.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);

    localParts.push(lfh, nameBuf, compBuf);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(8, 10);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(compBuf.length, 20);
    cdh.writeUInt32LE(rawBuf.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
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

describe("xlsx-reader", () => {
  it("reads XLSX sheets, strips phonetic <rPh> ruby tags, and decodes XML entities", () => {
    const zip = createMinimalZip([
      {
        name: "xl/workbook.xml",
        content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="5資料" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        content: `<?xml version="1.0" encoding="UTF-8"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
      },
      {
        name: "xl/sharedStrings.xml",
        content: `<?xml version="1.0" encoding="UTF-8"?><sst><si><t>あがたの森</t><rPh sb="3" eb="4"><t>モリ</t></rPh></si><si><t>松本 &amp; 図書館</t></si></sst>`,
      },
      {
        name: "xl/worksheets/sheet1.xml",
        content: `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1"><v>24831</v></c></row></sheetData></worksheet>`,
      },
    ]);

    const sheets = readXlsxSheets(zip);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe("5資料");
    expect(sheets[0].rows[0]).toEqual({
      A: "あがたの森",
      B: "松本 & 図書館",
      C: "24831",
    });
  });
});

describe("library-usage parsers", () => {
  it("normalizes branch names including legacy Seibu -> kamata and era years", () => {
    expect(normalizeBranchId("松本市中央図書館")).toBe("chuo");
    expect(normalizeBranchId("西部図書館")).toBe("kamata");
    expect(normalizeBranchId("鎌田図書館(分館)")).toBe("kamata");
    expect(normalizeBranchId("あがたの森")).toBe("agata");
    expect(normalizeBranchId("中山文庫")).toBe("nakayama");
    expect(normalizeBranchId("不明館")).toBeNull();

    expect(parseMatsumotoStatsFiscalYear("30")).toBe(2018);
    expect(parseMatsumotoStatsFiscalYear("元")).toBe(2019);
    expect(parseMatsumotoStatsFiscalYear("2")).toBe(2020);
    expect(parseMatsumotoStatsFiscalYear("6")).toBe(2024);
  });

  it("parses LinkData TSV and Matsumoto Stats sheet with service points and group loans", () => {
    const tsv = [
      "#LINK",
      "1\t松本市中央図書館\t283\t608893\t58669\t3256\t551454\t166585\t3028\t38194\t31356",
      "4\t西部図書館\t279\t33789\t5411\t627\t84604\t35015\t1691\t13352\t",
    ].join("\n");
    const linkRows = parseLinkDataLibraryTsv(tsv);
    expect(linkRows).toHaveLength(2);
    expect(linkRows[0].branchId).toBe("chuo");
    expect(linkRows[1].branchId).toBe("kamata");
    expect(linkRows[1].groupLoansTotal).toBeNull();

    const parsedStats = parseMatsumotoStatsLibrarySheet([
      { A: "（1）　中央図書館" },
      {
        A: "6",
        B: "284",
        C: "706179",
        D: "20994",
        E: "597605",
        F: "4083",
        G: "55540",
      },
      { A: "（12）村井駅サービスポイント" },
      { A: "6", B: "118", C: "0", D: "0", E: "3378", F: "…", G: "3590" },
      { A: "（14）　合　　計" },
      {
        A: "6",
        B: "0",
        C: "1330838",
        D: "49725",
        E: "1516078",
        F: "11610",
        G: "249581",
      },
      { A: "（15）　団体貸出等" },
      { A: "団体名", B: "4年度", D: "5年度", F: "6年度" },
      {
        A: "計",
        B: "52",
        C: "29131",
        D: "51",
        E: "25914",
        F: "51",
        G: "25914",
      },
    ]);
    expect(parsedStats.branches[0]).toMatchObject({
      branchId: "chuo",
      fiscalYear: 2024,
      holdingsTotal: 706179,
    });
    expect(parsedStats.servicePoints[0]).toMatchObject({
      id: "murai-sp",
      loansTotal: 3378,
    });
    expect(parsedStats.groupLoansByYear.get(2024)).toBe(25914);
  });

  it("extracts exactly 11 Matsumoto rows from Nagano survey material and loan sheets", () => {
    const names = [
      "松本市中央",
      "あがたの森",
      "鎌田",
      "南部",
      "寿台",
      "本郷",
      "中山",
      "島内",
      "空港",
      "波田",
      "梓川",
    ];
    const matRows: Array<Record<string, string>> = [
      { A: "長野市立南部", C: "404233", D: "116305" },
      ...names.map(
        (n, idx): Record<string, string> =>
          idx === 0
            ? { A: n, C: "645354", D: "129340" }
            : { B: n, C: "10000", D: "3000" },
      ),
      { A: "上田市立上田", C: "200000", D: "50000" },
    ];
    const parsedMat = parseNaganoSurveyMaterialSheet(matRows);
    expect(parsedMat).toHaveLength(11);
    expect(parsedMat[0]).toEqual({
      branchId: "chuo",
      holdingsBooks: 645354,
      holdingsBooksChildren: 129340,
    });

    const loanRows: Array<Record<string, string>> = names.map(
      (n, idx): Record<string, string> =>
        idx === 0
          ? {
              A: n,
              C: "20812",
              E: "2060",
              I: "601042",
              K: "194886",
              Q: "29971",
              S: "257022",
            }
          : { B: n, C: "2000", E: "300", I: "80000", K: "30000", S: "20000" },
    );
    const parsedLoan = parseNaganoSurveyLoanSheet(loanRows);
    expect(parsedLoan).toHaveLength(11);
    expect(parsedLoan[0].visitors).toBe(257022);
  });
});

describe("library-usage-metrics", () => {
  it("formats counts and computes YoY, shares, per-capita, and multiples accurately", () => {
    expect(formatJaCount(1532796, "冊")).toBe("153.3万冊");
    expect(formatJaCount(6282, "人")).toBe("6,282人");
    expect(formatAxisValue(1500000, "冊")).toBe("150万");
    expect(formatAxisValue(12000, "件")).toBe("1.2万");
    expect(formatAxisValue(600, "件")).toBe("600");
    expect(calcYoYPercent(1532796, 1516078)).toBe(1.1);
    expect(calcSharePercent(624623, 1532796)).toBe(40.8);
    expect(calcPerCapita(1532796, 233940)).toBe(6.55);
    expect(calcGrowthMultiple(1532796, 117078)).toBe(13.1);
    expect(
      getBranchMetricValue(
        {
          branchId: "chuo",
          openDays: 284,
          holdingsTotal: 706179,
          holdingsBooks: 667436,
          holdingsBooksChildren: 147103,
          registeredTotal: 20994,
          registeredChildren: 2146,
          loansTotal: 597605,
          loansChildren: 197178,
          reservationsTotal: 55540,
          referenceCount: 4083,
          visitors: 255963,
        },
        "turnoverRate",
      ),
    ).toBe(0.9);
  });

  it("handles all branch metrics, scope extraction, signed deltas, and niceMax boundaries", () => {
    const branch: BranchYearMetrics = {
      branchId: "nanbu",
      openDays: 280,
      holdingsTotal: null,
      holdingsBooks: 50000,
      holdingsBooksChildren: 20000,
      registeredTotal: 4000,
      registeredChildren: 1000,
      loansTotal: 100000,
      loansChildren: 45000,
      reservationsTotal: 8000,
      referenceCount: 500,
      visitors: 60000,
    };

    expect(getBranchMetricValue(branch, "loansTotal")).toBe(100000);
    expect(getBranchMetricValue(branch, "holdingsDisplay")).toBe(50000);
    expect(getBranchMetricValue(branch, "registeredTotal")).toBe(4000);
    expect(getBranchMetricValue(branch, "childrenLoanShare")).toBe(45);
    expect(
      getBranchMetricValue(
        { ...branch, holdingsTotal: 0, holdingsBooks: null },
        "turnoverRate",
      ),
    ).toBeNull();

    const sampleRecord: AnnualRecord = {
      fiscalYear: 2025,
      eraLabel: "令和7年度",
      shortEraLabel: "R7",
      population: 230000,
      holdingsTotal: null,
      holdingsBooks: 50000,
      holdingsBooksChildren: 20000,
      registeredTotal: 4000,
      registeredChildren: 1000,
      loansTotal: 100000,
      loansChildren: 45000,
      groupLoansTotal: 0,
      reservationsTotal: null,
      referenceCount: null,
      registrationPolicyChange: false,
      dataSourceNote: "test",
      eventNotes: [],
      branches: [
        branch,
        { ...branch, branchId: "chuo", visitors: null },
        { ...branch, branchId: "agata", visitors: 10000 },
        { ...branch, branchId: "kamata", visitors: null },
        { ...branch, branchId: "kotobukidai", visitors: null },
        { ...branch, branchId: "hongo", visitors: null },
        { ...branch, branchId: "nakayama", visitors: null },
        { ...branch, branchId: "shimauchi", visitors: null },
        { ...branch, branchId: "kuko", visitors: null },
        { ...branch, branchId: "azusagawa", visitors: null },
        { ...branch, branchId: "hata", visitors: null },
      ],
      servicePoints: [],
    };

    expect(getScopeYearValues(sampleRecord, "all").visitors).toBe(70000);
    expect(getScopeYearValues(sampleRecord, "nanbu").loansTotal).toBe(100000);
    expect(
      getScopeYearValues(
        {
          ...sampleRecord,
          branches: sampleRecord.branches.map((b) => ({
            ...b,
            visitors: null,
          })),
        },
        "all",
      ).visitors,
    ).toBeNull();
    expect(() =>
      getScopeYearValues({ ...sampleRecord, branches: [] }, "chuo"),
    ).toThrow(/Branch chuo missing/);

    expect(formatAxisValue(0, "冊")).toBe("0");
    expect(formatAxisValue(25, "%")).toBe("25%");
    expect(formatAxisValue(10000, "冊")).toBe("1万");
    expect(formatAxisValue(1234, "unknown")).toBe("1,234");

    expect(formatSignedDelta(null)).toBe("-");
    expect(formatSignedDelta(3.45)).toBe("+3.5%");
    expect(formatSignedDelta(-2.1)).toBe("-2.1%");
    expect(formatSignedDelta(0)).toBe("0.0%");

    expect(niceMax(0, 50)).toBe(50);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(115)).toBe(120);
    expect(niceMax(230)).toBe(250);
    expect(niceMax(750)).toBe(800);
    expect(niceMax(950)).toBe(1000);
  });
});

describe("src/data/library-usage.json integrity", () => {
  it("validates schema, fixes known upstream anomalies, and aligns all sums", async () => {
    const raw = await readFile(
      path.resolve("src/data/library-usage.json"),
      "utf-8",
    );
    const dataset = libraryUsageDatasetSchema.parse(JSON.parse(raw));

    expect(dataset.annualRecords.map((r) => r.fiscalYear)).toEqual([
      2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024,
      2025,
    ]);

    // Policy change flag only on 2020
    expect(
      dataset.annualRecords
        .filter((r) => r.registrationPolicyChange)
        .map((r) => r.fiscalYear),
    ).toEqual([2020]);

    // Known anomaly guards
    const fy2014 = dataset.annualRecords.find((r) => r.fiscalYear === 2014);
    expect(fy2014?.registeredChildren).toBe(10625);

    const fy2018 = dataset.annualRecords.find((r) => r.fiscalYear === 2018);
    expect(fy2018?.loansChildren).toBe(634213);
    expect(fy2018?.holdingsTotal).toBe(1249146);

    const fy2025 = dataset.annualRecords.find((r) => r.fiscalYear === 2025);
    expect(fy2025?.holdingsTotal).toBeNull();
    expect(fy2025?.holdingsBooks).toBe(1242757);
    expect(fy2025?.loansTotal).toBe(1532796);

    // Every year branch + SP totals match annual totals
    for (const rec of dataset.annualRecords) {
      const branchLoans = rec.branches.reduce((s, b) => s + b.loansTotal, 0);
      const spLoans = rec.servicePoints.reduce((s, sp) => s + sp.loansTotal, 0);
      expect(branchLoans + spLoans).toBe(rec.loansTotal);

      const branchReg = rec.branches.reduce((s, b) => s + b.registeredTotal, 0);
      expect(branchReg).toBe(rec.registeredTotal);

      if (rec.fiscalYear <= 2024) {
        expect(rec.holdingsTotal).not.toBeNull();
      }
    }

    // Age group snapshots reconcile with annual registeredTotal
    for (const snap of dataset.ageGroupSnapshots) {
      const rec = dataset.annualRecords.find(
        (r) => r.fiscalYear === snap.fiscalYear,
      );
      expect(snap.totals.registeredTotal).toBe(rec?.registeredTotal);
      const sumBrackets = snap.brackets.reduce(
        (s, b) => s + b.registeredTotal,
        0,
      );
      expect(sumBrackets).toBe(snap.totals.registeredTotal);
      const sumPop = snap.brackets.reduce((s, b) => s + b.population, 0);
      expect(sumPop).toBe(snap.totals.population);
    }

    // Combined timeline produces expected 9 chronological milestones
    const combined = getCombinedTimelinePoints(dataset);
    expect(combined.map((p) => p.fiscalYear)).toEqual([
      1980, 1990, 2000, 2013, 2015, 2019, 2020, 2024, 2025,
    ]);
  });
});
