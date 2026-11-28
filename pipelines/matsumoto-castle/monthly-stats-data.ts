export interface MonthlyVisitorBaseline {
  month: number;
  yearlyVisitors: {
    y2023: number;
    y2024: number;
    y2025: number;
  };
  openDays: number;
  baselineScore: number;
  seasonTag: string;
  seasonTip: string;
}

/**
 * 松本市「観光統計」公表Excel（松本市観光地延利用者数 月別 H25〜R7 / 133151.xls）
 * R5~R6 および R6~R7 シートにおける「松本城」の実測月別延利用者数（単位：人）。
 * 出典: https://www.city.matsumoto.nagano.jp/soshiki/76/70854.html
 */
export const MATSUMOTO_TOURISM_MONTHLY_SOURCE = {
  name: "松本市観光地延利用者数（月別 H25〜R7）",
  sourceUrl: "https://www.city.matsumoto.nagano.jp/soshiki/76/70854.html",
  license: "その他（出典明記）",
  attribution:
    "松本市 文化観光部 観光ブランド課「松本市観光地延利用者数（月別 H25〜R7）」",
} as const;

export const MATSUMOTO_CASTLE_MONTHLY_BASELINES: MonthlyVisitorBaseline[] = [
  {
    month: 1,
    yearlyVisitors: { y2023: 36155, y2024: 41557, y2025: 43423 },
    openDays: 31,
    baselineScore: 6,
    seasonTag: "冬の穴場",
    seasonTip:
      "三が日・あめ市・氷彫フェスを除けば年間でも有数の穴場。天守内は土足禁止で非常に冷えるため厚手の靴下と防寒具が必須です。",
  },
  {
    month: 2,
    yearlyVisitors: { y2023: 28306, y2024: 40704, y2025: 41128 },
    openDays: 28,
    baselineScore: 6,
    seasonTag: "冬の穴場",
    seasonTip:
      "年間で2番目に観覧者が少なく、雪景色の北アルプスと松本城をゆっくり楽しめます。足元の防寒対策を万全に。",
  },
  {
    month: 3,
    yearlyVisitors: { y2023: 75380, y2024: 69976, y2025: 65903 },
    openDays: 31,
    baselineScore: 15,
    seasonTag: "春休み増加期",
    seasonTip:
      "上旬は比較的落ち着いていますが、春分の日以降の春休みシーズンから観覧者が増え始めます。",
  },
  {
    month: 4,
    yearlyVisitors: { y2023: 103537, y2024: 148761, y2025: 126642 },
    openDays: 30,
    baselineScore: 32,
    seasonTag: "桜ピーク（年間最多）",
    seasonTip:
      "桜の見頃と重なり年間で最も混雑する月です。天守入場は日時指定の電子チケット事前購入と開場直後の訪問がおすすめです。",
  },
  {
    month: 5,
    yearlyVisitors: { y2023: 87296, y2024: 97623, y2025: 89238 },
    openDays: 31,
    baselineScore: 22,
    seasonTag: "GW集中・中旬は狙い目",
    seasonTip:
      "GWは大混雑しますが、連休明けの平日は新緑の爽やかな気候の中で比較的ゆったり観覧できます。月末はクラフトフェアで市内が混雑します。",
  },
  {
    month: 6,
    yearlyVisitors: { y2023: 58090, y2024: 71341, y2025: 61935 },
    openDays: 30,
    baselineScore: 13,
    seasonTag: "梅雨の穴場",
    seasonTip:
      "春〜秋の暖かい時期で最も観覧者が少ない穴場の月。雨具を用意すれば、混雑を避けて快適に巡れます。",
  },
  {
    month: 7,
    yearlyVisitors: { y2023: 76018, y2024: 82003, y2025: 75421 },
    openDays: 31,
    baselineScore: 18,
    seasonTag: "夏休み前〜増加期",
    seasonTip:
      "梅雨明け前の平日は比較的落ち着いています。海の日連休・夏休み入り以降は週末中心に混み合います。",
  },
  {
    month: 8,
    yearlyVisitors: { y2023: 110719, y2024: 112697, y2025: 106977 },
    openDays: 31,
    baselineScore: 28,
    seasonTag: "夏休み・お盆ピーク",
    seasonTip:
      "年間2番目の繁忙月。松本ぼんぼんやお盆期間は大変混雑し日中は暑くなるため、8:00延長開場の朝一番が狙い目です。",
  },
  {
    month: 9,
    yearlyVisitors: { y2023: 78587, y2024: 87935, y2025: 80294 },
    openDays: 30,
    baselineScore: 20,
    seasonTag: "連休中心・平日快適",
    seasonTip:
      "敬老の日・秋分の日の連休は混雑しますが、連休以外の平日は気候も落ち着き歩きやすい時期です。",
  },
  {
    month: 10,
    yearlyVisitors: { y2023: 108393, y2024: 107896, y2025: 98453 },
    openDays: 31,
    baselineScore: 26,
    seasonTag: "秋行楽・紅葉シーズン",
    seasonTip:
      "年間3番目の繁忙月。そば祭り連休や紅葉期は混雑するため、狙うなら10月中旬〜下旬の火〜木曜が比較的スムーズです。",
  },
  {
    month: 11,
    yearlyVisitors: { y2023: 88596, y2024: 90004, y2025: 88317 },
    openDays: 30,
    baselineScore: 22,
    seasonTag: "紅葉・松本城Week",
    seasonTip:
      "文化の日・市民祭・松本城Weekの前半は賑わいます。下旬にかけて徐々に落ち着き、澄んだ空気の北アルプスを望めます。",
  },
  {
    month: 12,
    yearlyVisitors: { y2023: 33951, y2024: 35728, y2025: 33356 },
    openDays: 28,
    baselineScore: 5,
    seasonTag: "年間最少の超穴場",
    seasonTip:
      "年間で最も空いている超穴場の月（12/29〜31は年末休城）。中旬以降は夜間のプロジェクションマッピングも楽しめます。",
  },
];
