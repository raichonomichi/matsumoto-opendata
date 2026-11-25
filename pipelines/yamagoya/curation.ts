import type { YamagoyaArea } from "../../src/lib/yamagoya-schema";

export type BusAccessSpec =
  | {
      kind: "gtfs";
      feedId: "guruttomatsumotobus1" | "guruttomatsumotobus2";
      routeId: string;
      stopIds: string[];
      stopName: string;
      operator: string;
      accessNote: string;
    }
  | {
      kind: "external_timetable";
      stopName: string;
      routeName: string;
      operator: string;
      timetableUrl: string;
      accessNote: string;
    };

export interface CuratedHutSpec {
  id: string;
  sourceRecordId: string;
  expectedRegistryName: string;
  name: string;
  area: YamagoyaArea;
  subArea: string;
  elevationM: number;
  summary: string;
  gradingRouteNumbers: number[];
  busAccess: BusAccessSpec[];
}

const ALPICO_KAMIKOCHI_URL =
  "https://www.alpico.co.jp/traffic/local/kamikochi/";
const ALPICO_KAMIKOCHI_ACCESS: BusAccessSpec = {
  kind: "external_timetable",
  stopName: "上高地バスターミナル",
  routeName: "松本・新島々〜上高地線（アルピコ交通）",
  operator: "アルピコ交通",
  timetableUrl: ALPICO_KAMIKOCHI_URL,
  accessNote:
    "松本駅（上高地線電車）または松本バスターミナルから新島々経由で上高地バスターミナル下車。季節運行のため公式時刻表をご確認ください。",
};

const ALPICO_NORIKURA_SHUTTLE_ACCESS: BusAccessSpec = {
  kind: "external_timetable",
  stopName: "乗鞍山頂（畳平）・位ヶ原山荘・冷泉小屋",
  routeName: "乗鞍高原〜乗鞍山頂（畳平）シャトルバス（アルピコ交通）",
  operator: "アルピコ交通",
  timetableUrl: ALPICO_KAMIKOCHI_URL,
  accessNote:
    "新島々から乗鞍高原観光センター経由で乗鞍エコーライン方面シャトルバスを利用。夏季・秋季の季節運行のため公式時刻表をご確認ください。",
};

const GTFS_SHIMASHIMA_TOKUGO: BusAccessSpec = {
  kind: "gtfs",
  feedId: "guruttomatsumotobus2",
  routeId: "23",
  stopIds: ["227_01", "227_02"],
  stopName: "島々徳本峠入口",
  operator: "松本市（ぐるっとまつもとバス）",
  accessNote:
    "クラシックルート（島々谷）からの徳本峠登山口最寄りバス停。松本市公式 GTFS-JP（地域連携バス・奈川・安曇線）の時刻データを結合しています。",
};

const GTFS_YAMATOAI_IRIYAMABE: BusAccessSpec = {
  kind: "gtfs",
  feedId: "guruttomatsumotobus2",
  routeId: "27",
  stopIds: ["380_01"],
  stopName: "大和合",
  operator: "松本市（ぐるっとまつもとバス）",
  accessNote:
    "入山辺・三城牧場方面への路線バス終点。三城牧場・美ヶ原登山口方面へのアクセス拠点として松本市公式 GTFS-JP（入山辺線）の時刻データを結合しています。",
};

const GTFS_UTSUKUSHIGAHARA_ONSEN: BusAccessSpec = {
  kind: "gtfs",
  feedId: "guruttomatsumotobus1",
  routeId: "14",
  stopIds: ["300_01"],
  stopName: "美ヶ原温泉",
  operator: "松本市（ぐるっとまつもとバス）",
  accessNote:
    "松本バスターミナルから美ヶ原方面の山麓拠点。松本市公式 GTFS-JP（美ヶ原温泉線）の時刻データを結合しています。",
};

/**
 * 松本市「生活衛生施設データ（旅館業）」から、主要山岳エリア（北アルプス・乗鞍・美ヶ原）の
 * 山小屋・登山拠点山荘をノイズなく確定するためのキュレーション辞書。
 */
export const CURATED_HUTS: CuratedHutSpec[] = [
  {
    id: "kitahotaka-goya",
    sourceRecordId: "26",
    expectedRegistryName: "北穂高小屋",
    name: "北穂高小屋",
    area: "北アルプス",
    subArea: "穂高連峰",
    elevationM: 3100,
    summary:
      "北穂高岳山頂直下（標高3,100m）に建つ日本最高所の山小屋。大キレットや涸沢岳方面への縦走拠点。",
    gradingRouteNumbers: [17, 40],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "hutte-oyari",
    sourceRecordId: "17",
    expectedRegistryName: "ヒュッテ　大槍",
    name: "ヒュッテ大槍",
    area: "北アルプス",
    subArea: "槍ヶ岳",
    elevationM: 2884,
    summary:
      "東鎌尾根上の槍ヶ岳を間近に望む山小屋。表銀座縦走や槍ヶ岳登頂の拠点として利用されます。",
    gradingRouteNumbers: [44, 5],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "sessho-hutte",
    sourceRecordId: "175",
    expectedRegistryName: "殺生小屋",
    name: "殺生ヒュッテ（殺生小屋）",
    area: "北アルプス",
    subArea: "槍ヶ岳",
    elevationM: 2870,
    summary:
      "槍沢から槍ヶ岳の肩へ登り上げる手前に位置する山小屋。台帳表記は「殺生小屋」。",
    gradingRouteNumbers: [44],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "kata-no-koya-norikura",
    sourceRecordId: "1",
    expectedRegistryName: "肩の小屋",
    name: "乗鞍岳 肩の小屋",
    area: "乗鞍",
    subArea: "乗鞍岳",
    elevationM: 2766,
    summary:
      "乗鞍岳主峰・剣ヶ峰への登山道直下に位置する歴史ある山小屋（松本市台帳ID 1・1947年許可）。",
    gradingRouteNumbers: [34],
    busAccess: [ALPICO_NORIKURA_SHUTTLE_ACCESS],
  },
  {
    id: "hutte-nishidake",
    sourceRecordId: "24",
    expectedRegistryName: "ヒュッテ西岳",
    name: "ヒュッテ西岳",
    area: "北アルプス",
    subArea: "槍ヶ岳・表銀座",
    elevationM: 2670,
    summary:
      "表銀座縦走路の西岳直下に位置し、槍・穂高連峰の大展望を望む山小屋。水俣乗越を経て東鎌尾根へ接続。",
    gradingRouteNumbers: [5],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "daitensho-hutte",
    sourceRecordId: "31",
    expectedRegistryName: "大天井ヒュッテ",
    name: "大天井ヒュッテ",
    area: "北アルプス",
    subArea: "槍ヶ岳・表銀座",
    elevationM: 2650,
    summary:
      "表銀座縦走路・牛首展望台付近に位置する山小屋。大天井岳のトラバースルート上に建ちます。",
    gradingRouteNumbers: [5],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "otaki-sanso",
    sourceRecordId: "152",
    expectedRegistryName: "大滝山荘",
    name: "大滝山荘",
    area: "北アルプス",
    subArea: "常念山脈",
    elevationM: 2616,
    summary: "蝶ヶ岳と鍋冠山を結ぶ静かな稜線・大滝山直下に建つ山小屋。",
    gradingRouteNumbers: [27],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "jonen-goya",
    sourceRecordId: "197",
    expectedRegistryName: "常念小屋",
    name: "常念小屋",
    area: "北アルプス",
    subArea: "常念山脈",
    elevationM: 2450,
    summary:
      "常念乗越に建ち、正面に槍ヶ岳・穂高連峰を一望できる常念山脈の拠点山小屋。",
    gradingRouteNumbers: [21, 27],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "karasawa-goya",
    sourceRecordId: "95",
    expectedRegistryName: "涸沢小屋",
    name: "涸沢小屋",
    area: "北アルプス",
    subArea: "涸沢・穂高連峰",
    elevationM: 2350,
    summary:
      "涸沢カールの高台に建つ山小屋。北穂高岳・奥穂高岳への登山拠点として親しまれています。",
    gradingRouteNumbers: [13, 17],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "kuraigahara-sanso",
    sourceRecordId: "28",
    expectedRegistryName: "位ヶ原山荘",
    name: "位ヶ原山荘",
    area: "乗鞍",
    subArea: "乗鞍岳",
    elevationM: 2350,
    summary:
      "乗鞍エコーライン沿い、標高2,350mの位ヶ原に位置する山小屋。乗鞍岳登山や春山スキーの拠点。",
    gradingRouteNumbers: [34],
    busAccess: [ALPICO_NORIKURA_SHUTTLE_ACCESS],
  },
  {
    id: "karasawa-hutte",
    sourceRecordId: "22",
    expectedRegistryName: "涸沢ヒュッテ",
    name: "涸沢ヒュッテ",
    area: "北アルプス",
    subArea: "涸沢・穂高連峰",
    elevationM: 2310,
    summary:
      "涸沢カールのモレーン上に建つ大型山小屋。紅葉シーズンをはじめ穂高連峰登山の中心拠点。",
    gradingRouteNumbers: [13, 4],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "dakesawa-goya",
    sourceRecordId: "227",
    expectedRegistryName: "岳沢小屋",
    name: "岳沢小屋",
    area: "北アルプス",
    subArea: "穂高連峰",
    elevationM: 2170,
    summary:
      "上高地から重太郎新道を経て前穂高岳・奥穂高岳を目指す登山者の拠点となる山小屋。",
    gradingRouteNumbers: [41],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "reisen-goya",
    sourceRecordId: "286",
    expectedRegistryName: "冷泉小屋",
    name: "冷泉小屋",
    area: "乗鞍",
    subArea: "乗鞍岳",
    elevationM: 2160,
    summary:
      "乗鞍エコーライン沿い・冷泉沢付近に位置する山岳宿。乗鞍岳の登山・自然散策の拠点。",
    gradingRouteNumbers: [34],
    busAccess: [ALPICO_NORIKURA_SHUTTLE_ACCESS],
  },
  {
    id: "tokugotoge-goya",
    sourceRecordId: "202",
    expectedRegistryName: "徳本峠小屋",
    name: "徳本峠小屋",
    area: "北アルプス",
    subArea: "上高地・霞沢岳",
    elevationM: 2135,
    summary:
      "島々谷と上高地を結ぶクラシックルート・徳本峠に建つ歴史的な山小屋。霞沢岳登山の拠点。",
    gradingRouteNumbers: [12],
    busAccess: [GTFS_SHIMASHIMA_TOKUGO, ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "ogatou-hotel",
    sourceRecordId: "69",
    expectedRegistryName: "王ケ頭ホテル",
    name: "王ケ頭ホテル",
    area: "美ヶ原",
    subArea: "美ヶ原高原",
    elevationM: 2034,
    summary:
      "美ヶ原の最高峰・王ヶ頭（標高2,034m）山頂に建つ雲上の山岳宿。北アルプスから富士山まで360度の展望。",
    gradingRouteNumbers: [99],
    busAccess: [GTFS_YAMATOAI_IRIYAMABE, GTFS_UTSUKUSHIGAHARA_ONSEN],
  },
  {
    id: "yarisawa-lodge",
    sourceRecordId: "25",
    expectedRegistryName: "槍沢ロッヂ",
    name: "槍沢ロッヂ",
    area: "北アルプス",
    subArea: "槍ヶ岳",
    elevationM: 1820,
    summary:
      "横尾から槍沢を詰める途中（標高1,820m）に位置する山小屋。槍ヶ岳登山の前泊・中継拠点。",
    gradingRouteNumbers: [44],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "yokoo-sanso",
    sourceRecordId: "150",
    expectedRegistryName: "横尾山荘",
    name: "横尾山荘",
    area: "北アルプス",
    subArea: "上高地・横尾",
    elevationM: 1620,
    summary:
      "槍ヶ岳・涸沢・蝶ヶ岳への分岐点となる横尾に建つ大型山荘。本格的な登山の玄関口。",
    gradingRouteNumbers: [13, 44],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "tokusawa-lodge",
    sourceRecordId: "55",
    expectedRegistryName: "松本市営　徳沢ロッヂ",
    name: "松本市営 徳沢ロッヂ",
    area: "北アルプス",
    subArea: "上高地・徳沢",
    elevationM: 1562,
    summary:
      "上高地・徳沢に位置する松本市営の山小屋（旅館業許可）。蝶ヶ岳・涸沢・槍ヶ岳方面の拠点。",
    gradingRouteNumbers: [13, 27],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "tokusawaen",
    sourceRecordId: "139",
    expectedRegistryName: "徳澤園",
    name: "氷壁の宿 徳澤園",
    area: "北アルプス",
    subArea: "上高地・徳沢",
    elevationM: 1562,
    summary:
      "上高地から徒歩約2時間の徳沢に佇む山岳宿。蝶ヶ岳長塀尾根や涸沢・槍ヶ岳方面への前泊拠点。",
    gradingRouteNumbers: [13, 27],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "myojinkan-kamikochi",
    sourceRecordId: "157",
    expectedRegistryName: "明神館",
    name: "明神館（上高地）",
    area: "北アルプス",
    subArea: "上高地・明神",
    elevationM: 1530,
    summary:
      "明神岳を仰ぐ上高地・明神地区に建つ山岳宿。徳本峠・霞沢岳や徳沢・涸沢方面への拠点。",
    gradingRouteNumbers: [13, 12],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "kamonji-goya",
    sourceRecordId: "72",
    expectedRegistryName: "嘉門次小屋",
    name: "嘉門次小屋",
    area: "北アルプス",
    subArea: "上高地・明神",
    elevationM: 1530,
    summary:
      "明神池のほとりに建つ上條嘉門次ゆかりの歴史的な山小屋。囲炉裏の岩魚焼きでも知られます。",
    gradingRouteNumbers: [13],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
  {
    id: "kamikochi-alps-sanso",
    sourceRecordId: "212",
    expectedRegistryName: "上高地アルプス山荘",
    name: "上高地アルプス山荘",
    area: "北アルプス",
    subArea: "上高地",
    elevationM: 1505,
    summary:
      "日本山岳ガイド協会が運営する上高地の登山拠点山荘。穂高・槍・西穂方面への前泊に利用されます。",
    gradingRouteNumbers: [13, 41],
    busAccess: [ALPICO_KAMIKOCHI_ACCESS],
  },
];
