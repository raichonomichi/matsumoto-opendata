import { describe, expect, it } from "vitest";
import {
  mergeWeatherHistory,
  parseMatsumotoWeatherCsv,
} from "./matsumoto-weather-history-csv";

const header = [
  "ダウンロードした時刻：2026/11/28 14:49:15",
  "",
  ",松本,松本,松本,松本,松本,松本",
  "年月日,最高気温(℃),最高気温(℃),最高気温(℃),最低気温(℃),最低気温(℃),最低気温(℃)",
  ",,,,,,",
  ",,品質情報,均質番号,,品質情報,均質番号",
];

function csv(...lines: string[]) {
  return [...header, ...lines].join("\r\n");
}

describe("parseMatsumotoWeatherCsv", () => {
  it("imports valid pairs and treats an unavailable element as a missing day", () => {
    expect(
      parseMatsumotoWeatherCsv(
        csv(
          "2024/2/29,8.3,8,1,-4.0,8,1",
          "2024/3/1,5.2,8,1,0.0,5,1",
          "2024/3/2,10,8,1,,1,1",
          "2024/3/3,10,8,1,2.5,4,1",
          "2024/3/4,10,8,1,2.5,2,1",
        ),
      ),
    ).toEqual({
      "2024-02-29": { minC: -4, maxC: 8.3 },
      "2024-03-01": { minC: 0, maxC: 5.2, provisional: true },
      "2024-03-02": null,
      "2024-03-03": null,
      "2024-03-04": null,
    });
  });

  it("rejects a different station, incomplete downloads and invalid dates", () => {
    const valid = csv("2025/11/28,14,8,1,4.7,8,1");
    expect(() =>
      parseMatsumotoWeatherCsv(valid.replaceAll("松本", "松本今井")),
    ).toThrow("松本");
    expect(() => parseMatsumotoWeatherCsv(csv("2025/11/28,14,8,1,,,"))).toThrow(
      "品質情報",
    );
    expect(() =>
      parseMatsumotoWeatherCsv(csv("2025/2/29,14,8,1,4.7,8,1")),
    ).toThrow("日付");
  });

  it("updates corrected observations by date and is idempotent", () => {
    const first = parseMatsumotoWeatherCsv(csv("2025/11/28,14,8,1,4.7,8,1"));
    const correction = parseMatsumotoWeatherCsv(
      csv("2025/11/28,14.1,8,1,4.7,8,1", "2025/11/29,9.9,8,1,0.5,8,1"),
    );
    const merged = mergeWeatherHistory(first, [correction]);
    expect(Object.keys(merged)).toEqual(["2025-11-28", "2025-11-29"]);
    expect(merged["2025-11-28"]).toEqual({ minC: 4.7, maxC: 14.1 });
    expect(mergeWeatherHistory(merged, [correction])).toEqual(merged);
  });
});
