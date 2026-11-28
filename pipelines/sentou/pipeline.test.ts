import { describe, expect, it } from "vitest";
import { buildSentouDataset } from "../build-sentou";
import { BATH_CURATIONS, inferAreaFromAddress } from "./curation";
import { parseLinkDataBathTsv, type RawBathRecord } from "./parsers";

function buildAllCuratedRawRecords(): RawBathRecord[] {
  return Object.entries(BATH_CURATIONS).map(([id, spec]) => ({
    id,
    name: spec.expectedRegistryName,
    registryName: spec.expectedRegistryName,
    postalCode: "390-0811",
    address: "松本市中央1-1",
    operator: "テスト事業者",
    permitCategory:
      spec.facilityType === "sentou" ? "一般公衆浴場" : "その他の公衆浴場",
    permittedAt: "2020-01-01",
    permitNumber: `第${id}号`,
  }));
}

describe("parseLinkDataBathTsv edge cases", () => {
  it("normalizes addresses/dates, skips blank/incomplete rows, and falls back invalid dates to null", () => {
    const tsv = [
      "\uFEFF#LINK",
      "#attribution_name\t松本市　保健所",
      "#license\thttp://creativecommons.org/licenses/by/4.0/",
      "#download_from\thttp://linkdata.org/work/rdf1s8757i",
      "1\tテスト　温泉\t３９０－０００１\t松本市浅間温泉１－２－３\t\tその他の公衆浴場\t20210405\t",
      "2\t日付不正湯\t\t松本市大手１－１\t運営\t一般公衆浴場\tnot-a-date\t第2号",
      "\t名前のみ\t\t住所\t\t一般公衆浴場\t\t",
      "3\t住所なし\t\t\t\t一般公衆浴場\t\t",
    ].join("\r\n");

    const parsed = parseLinkDataBathTsv(tsv);
    expect(parsed.metadata).toEqual({
      attributionName: "松本市　保健所",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      downloadFrom: "http://linkdata.org/work/rdf1s8757i",
    });
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]).toMatchObject({
      id: "1",
      registryName: "テスト 温泉",
      postalCode: "390-0001",
      address: "松本市浅間温泉1-2-3",
      permittedAt: "2021-04-05",
      permitNumber: null,
    });
    expect(parsed.records[1]).toMatchObject({
      id: "2",
      postalCode: null,
      permittedAt: null,
    });
  });
});

describe("inferAreaFromAddress & buildSentouDataset", () => {
  it("infers hot spring, suburban, and central sub-areas accurately", () => {
    expect(inferAreaFromAddress("松本市浅間温泉1-1", "390-0303")).toEqual({
      areaGroup: "asama_utsukushigahara",
      subArea: "浅間温泉",
    });
    expect(inferAreaFromAddress("松本市安曇4469", null)).toEqual({
      areaGroup: "norikura_shirahone",
      subArea: "上高地",
    });
    expect(inferAreaFromAddress("松本市安曇白骨", "390-1515")).toEqual({
      areaGroup: "norikura_shirahone",
      subArea: "白骨温泉",
    });
    expect(inferAreaFromAddress("松本市波田100", null)).toEqual({
      areaGroup: "suburbs",
      subArea: "波田",
    });
    expect(inferAreaFromAddress("松本市不明町1", null)).toEqual({
      areaGroup: "central",
      subArea: "松本市街地",
    });
  });

  it("builds dataset with fallback facilities, schedule flags, and accurate counts", () => {
    const curatedRaw = buildAllCuratedRawRecords();
    const fallbackAsama: RawBathRecord = {
      id: "9001",
      name: "テスト浅間宿",
      registryName: "テスト浅間宿",
      postalCode: "390-0303",
      address: "松本市浅間温泉3-1-1",
      operator: null,
      permitCategory: "その他の公衆浴場",
      permittedAt: "2022-05-01",
      permitNumber: "第9001号",
    };
    const fallbackCentral: RawBathRecord = {
      id: "9002",
      name: "テスト駅前ホテル",
      registryName: "テスト駅前ホテル",
      postalCode: "390-0811",
      address: "松本市中央1-2-3",
      operator: null,
      permitCategory: "その他の公衆浴場",
      permittedAt: null,
      permitNumber: null,
    };

    const dataset = buildSentouDataset({
      bathRecords: [...curatedRaw, fallbackCentral, fallbackAsama],
      holidays: new Map([
        ["2026-11-23", "勤労感謝の日"],
        ["2026-01-01", "元日"],
      ]),
      generatedAt: "2026-11-28",
    });

    expect(dataset.count).toBe(curatedRaw.length + 2);
    expect(Object.keys(dataset.holidays)).toEqual(["2026-01-01", "2026-11-23"]);

    const asamaFb = dataset.facilities.find((f) => f.id === "bath-9001");
    expect(asamaFb?.accessCategory).toBe("check_lodging_or_status");
    expect(asamaFb?.waterType).toBe("onsen");
    expect(asamaFb?.schedule.kind).toBe("check_official");

    const centralFb = dataset.facilities.find((f) => f.id === "bath-9002");
    expect(centralFb?.waterType).toBe("unknown");

    // 瑞祥 (59): weekday 9:30〜24:00, weekend/holiday 6:00〜24:00 -> hasMorningBath=true, openLateNight=true
    const zuisho = dataset.facilities.find((f) => f.sourceRecordId === "59");
    expect(zuisho).toMatchObject({
      hasMorningBath: true,
      openLateNight: true,
      latestLastEntryMinutes: 23 * 60 + 20,
    });

    // 塩井乃湯 (3): opens afternoon -> hasMorningBath=false
    const shioi = dataset.facilities.find((f) => f.sourceRecordId === "3");
    expect(shioi?.hasMorningBath).toBe(false);

    // 白糸の湯 (54): seasonal override opens at 6:30 -> hasMorningBath=true
    const shiraito = dataset.facilities.find((f) => f.sourceRecordId === "54");
    expect(shiraito?.hasMorningBath).toBe(true);
  });

  it("throws when a curated bath record is missing or registryName mismatches", () => {
    const all = buildAllCuratedRawRecords();
    expect(() =>
      buildSentouDataset({
        bathRecords: all.slice(1),
        holidays: new Map(),
        generatedAt: "2026-11-28",
      }),
    ).toThrow(/not found in matsumoto_bath\.txt/);

    const mismatched = all.map((r, idx) =>
      idx === 0 ? { ...r, registryName: "違う施設名" } : r,
    );
    expect(() =>
      buildSentouDataset({
        bathRecords: mismatched,
        holidays: new Map(),
        generatedAt: "2026-11-28",
      }),
    ).toThrow(/Registry name mismatch/);
  });
});
