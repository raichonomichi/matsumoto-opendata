import type {
  AgeGroupSnapshot,
  BranchExpansionPoint,
  BranchId,
  BranchProfile,
  DecadeMilestone,
  DigitalLibraryYear,
} from "../../src/lib/library-usage-schema";

export const AGE_BRACKETS_META = [
  { id: "0-6", label: "0〜6歳" },
  { id: "7-12", label: "7〜12歳" },
  { id: "13-15", label: "13〜15歳" },
  { id: "16-18", label: "16〜18歳" },
  { id: "19-22", label: "19〜22歳" },
  { id: "23-30", label: "23〜30歳" },
  { id: "31-40", label: "31〜40歳" },
  { id: "41-50", label: "41〜50歳" },
  { id: "51-60", label: "51〜60歳" },
  { id: "61-70", label: "61〜70歳" },
  { id: "71-", label: "71歳以上" },
] as const;

/**
 * 松本市図書館 11館のプロフィール（出典：令和7年度 図書館概要「施設概要」）
 */
export const BRANCH_PROFILES: BranchProfile[] = [
  {
    id: "chuo",
    name: "中央図書館",
    shortName: "中央",
    formerName: null,
    openedAt: "1991年10月（現在地移転新築）",
    areaSqm: 4831.64,
    facilityType: "independent",
    highlight:
      "市内最大の蔵書（約70.6万冊）と2層書庫・郷土資料・レファレンス窓口を担う中核館。2027年7月〜2030年春に長寿命化改修予定。",
  },
  {
    id: "nanbu",
    name: "南部図書館",
    shortName: "南部",
    formerName: null,
    openedAt: "1990年5月（分館化）",
    areaSqm: 530.9,
    facilityType: "complex",
    highlight:
      "なんなんひろば1階。分館最大の貸出実績（年間約22〜25万冊）を誇り、月曜開館・平日・土曜22時まで開館。",
  },
  {
    id: "agata",
    name: "あがたの森図書館",
    shortName: "あがた",
    formerName: null,
    openedAt: "1979年10月",
    areaSqm: 198.31,
    facilityType: "complex",
    highlight:
      "最初の分館として開設。あがたの森文化会館1階に位置し、開架率97%超の児童書・絵本と公園隣接の環境が特徴。",
  },
  {
    id: "kamata",
    name: "鎌田図書館",
    shortName: "鎌田",
    formerName: "旧・西部図書館（〜2018年度）",
    openedAt: "1990年4月（分館化）",
    areaSqm: 245.68,
    facilityType: "complex",
    highlight:
      "鎌田地区公民館東隣。2019年4月に「西部図書館」から「鎌田図書館」へ名称変更。全館で開架率が最も高い99%超。",
  },
  {
    id: "kotobukidai",
    name: "寿台図書館",
    shortName: "寿台",
    formerName: null,
    openedAt: "1993年4月（分館化）",
    areaSqm: 216.0,
    facilityType: "complex",
    highlight:
      "寿台公民館1階。南部エリアの住宅街に密着し、児童書・絵本の貸出割合が高い地域図書館。",
  },
  {
    id: "hongo",
    name: "本郷図書館",
    shortName: "本郷",
    formerName: null,
    openedAt: "1999年4月（分館化）",
    areaSqm: 220.8,
    facilityType: "complex",
    highlight:
      "浅間温泉エリアの本郷公民館1階。分館の中でも児童貸出比率（約55〜58%）が特に高い。",
  },
  {
    id: "nakayama",
    name: "中山文庫",
    shortName: "中山",
    formerName: null,
    openedAt: "2001年4月",
    areaSqm: 669.88,
    facilityType: "independent",
    highlight:
      "個人寄贈蔵書（13万冊超）を基盤に開館し、分館最大の約17万冊を保有（うち閉架書庫約13.7万冊）。",
  },
  {
    id: "shimauchi",
    name: "島内図書館",
    shortName: "島内",
    formerName: null,
    openedAt: "2001年5月",
    areaSqm: 470.1,
    facilityType: "complex",
    highlight:
      "島内公民館北隣。島内農業文庫をルーツに持ち、近年は貸出冊数・登録者数ともに堅調な伸びを見せる。",
  },
  {
    id: "kuko",
    name: "空港図書館",
    shortName: "空港",
    formerName: null,
    openedAt: "2002年4月",
    areaSqm: 408.25,
    facilityType: "independent",
    highlight:
      "信州まつもと空港・今井市民プール東隣の独立平屋館。駐車場を備え広域からの利用が多い。",
  },
  {
    id: "azusagawa",
    name: "梓川図書館",
    shortName: "梓川",
    formerName: null,
    openedAt: "2012年5月",
    areaSqm: 595.35,
    facilityType: "independent",
    highlight:
      "アカデミア館北隣に開館した10番目の分館。一般・児童ともに高い開架冊数を備える。",
  },
  {
    id: "hata",
    name: "波田図書館",
    shortName: "波田",
    formerName: "旧・波田町立図書館（〜2009年度）",
    openedAt: "2010年3月（市町合併により分館化）",
    areaSqm: 1106.0,
    facilityType: "complex",
    highlight:
      "波田文化センター1階。延床1,106㎡・蔵書約10.2万冊と分館最大規模で、登録者数は中央・南部に次ぐ規模。",
  },
];

/**
 * 1980・1990・2000年の10年刻み公式実績（出典：令和7年度 図書館概要「利用実績の推移」）
 */
export const DECADE_MILESTONES: DecadeMilestone[] = [
  {
    fiscalYear: 1980,
    eraLabel: "昭和55年度",
    shortEraLabel: "S55",
    holdingsTotal: 159344,
    holdingsChildren: 29179,
    registeredTotal: 6282,
    registeredChildren: 2328,
    loansTotal: 117078,
    loansChildren: 40495,
    groupLoansTotal: 62071,
    referenceCount: 1579,
    reservationsTotal: null,
    note: "中央＋あがたの森の2館体制期。蔵書約15.9万冊、個人貸出約11.7万冊、登録者は6,282人。",
  },
  {
    fiscalYear: 1990,
    eraLabel: "平成2年度",
    shortEraLabel: "H2",
    holdingsTotal: 315254,
    holdingsChildren: 103343,
    registeredTotal: 16913,
    registeredChildren: null, // 注記：中央館分の児童数が不明のため未合算値（3,784）しかなく総計ではnull
    loansTotal: 304443,
    loansChildren: null, // 同上（中央館分の児童数が不明）
    groupLoansTotal: 151063,
    referenceCount: 7637,
    reservationsTotal: null,
    note: "西部（現・鎌田）・南部が開館し本館1＋分館3体制へ。個人貸出が10年前の2.6倍（30.4万冊）に拡大。",
  },
  {
    fiscalYear: 2000,
    eraLabel: "平成12年度",
    shortEraLabel: "H12",
    holdingsTotal: 707101,
    holdingsChildren: 168150,
    registeredTotal: 48680,
    registeredChildren: 9931,
    loansTotal: 985514,
    loansChildren: 321682,
    groupLoansTotal: 51197,
    referenceCount: 21459,
    reservationsTotal: 28257,
    note: "中央図書館現在地移転（H3）や寿台・本郷の分館化が進み、個人貸出は約98.6万冊（1980年の8.4倍）へ急増。",
  },
];

/**
 * 分館整備の推移 14時点（出典：令和7年度 図書館概要「分館整備の推移」）
 */
export const BRANCH_EXPANSION_HISTORY: BranchExpansionPoint[] = [
  {
    fiscalYear: 1967,
    eraLabel: "昭和42年度",
    shortEraLabel: "S42",
    librariesCount: 1,
    servicePointsCount: 0,
    holdingsTotal: 73025,
    loansTotal: 7822,
    note: "本館1館のみ。蔵書7.3万冊・貸出7,822冊からスタート。",
  },
  {
    fiscalYear: 1979,
    eraLabel: "昭和54年度",
    shortEraLabel: "S54",
    librariesCount: 2,
    servicePointsCount: 0,
    holdingsTotal: 146458,
    loansTotal: 93875,
    note: "1979年10月に最初の分館「あがたの森図書館」が開館（本館1・分館1）。",
  },
  {
    fiscalYear: 1990,
    eraLabel: "平成2年度",
    shortEraLabel: "H2",
    librariesCount: 4,
    servicePointsCount: 0,
    holdingsTotal: 315254,
    loansTotal: 304443,
    note: "西部（現・鎌田）と南部が分館化し本館1・分館3へ。貸出30万冊突破。",
  },
  {
    fiscalYear: 1993,
    eraLabel: "平成5年度",
    shortEraLabel: "H5",
    librariesCount: 5,
    servicePointsCount: 0,
    holdingsTotal: 426840,
    loansTotal: 571603,
    note: "中央図書館移転新築（H3.10）と寿台分館化（H5.4）で貸出57万冊へ倍増。",
  },
  {
    fiscalYear: 1999,
    eraLabel: "平成11年度",
    shortEraLabel: "H11",
    librariesCount: 6,
    servicePointsCount: 0,
    holdingsTotal: 618650,
    loansTotal: 993845,
    note: "本郷図書館の分館化（H11.4）により貸出約100万冊規模へ到達。",
  },
  {
    fiscalYear: 2001,
    eraLabel: "平成13年度",
    shortEraLabel: "H13",
    librariesCount: 8,
    servicePointsCount: 0,
    holdingsTotal: 770299,
    loansTotal: 1078158,
    note: "中山文庫・島内図書館が開設（本館1・分館7）し、個人貸出100万冊を突破。",
  },
  {
    fiscalYear: 2002,
    eraLabel: "平成14年度",
    shortEraLabel: "H14",
    librariesCount: 9,
    servicePointsCount: 0,
    holdingsTotal: 819239,
    loansTotal: 1188815,
    note: "空港図書館が開設（本館1・分館8）。蔵書81.9万冊、貸出118.9万冊。",
  },
  {
    fiscalYear: 2010,
    eraLabel: "平成22年度",
    shortEraLabel: "H22",
    librariesCount: 10,
    servicePointsCount: 0,
    holdingsTotal: 1089617,
    loansTotal: 1576160,
    note: "波田町合併に伴い波田図書館が分館化（本館1・分館9）。蔵書100万冊・貸出150万冊超へ。",
  },
  {
    fiscalYear: 2015,
    eraLabel: "平成27年度",
    shortEraLabel: "H27",
    librariesCount: 11,
    servicePointsCount: 0,
    holdingsTotal: 1215723,
    loansTotal: 1681546,
    note: "梓川図書館開設（H24.5）後の11館体制で、過去最高の個人貸出1,681,546冊を記録。",
  },
  {
    fiscalYear: 2020,
    eraLabel: "令和2年度",
    shortEraLabel: "R2",
    librariesCount: 11,
    servicePointsCount: 0,
    holdingsTotal: 1291469,
    loansTotal: 1380247,
    note: "新型コロナ対策で全館臨時閉館（4/1〜5/15）があり貸出138万冊へ減少する一方、予約は大幅増。",
  },
  {
    fiscalYear: 2021,
    eraLabel: "令和3年度",
    shortEraLabel: "R3",
    librariesCount: 11,
    servicePointsCount: 0,
    holdingsTotal: 1307599,
    loansTotal: 1563731,
    note: "蔵書130万冊を突破。コロナ禍の反動もあり貸出は156.4万冊へ回復。",
  },
  {
    fiscalYear: 2022,
    eraLabel: "令和4年度",
    shortEraLabel: "R4",
    librariesCount: 11,
    servicePointsCount: 0,
    holdingsTotal: 1324551,
    loansTotal: 1524000,
    note: "協働電子図書館「デジとしょ信州」へ参加開始（R4.8）。",
  },
  {
    fiscalYear: 2023,
    eraLabel: "令和5年度",
    shortEraLabel: "R5",
    librariesCount: 11,
    servicePointsCount: 0,
    holdingsTotal: 1338409,
    loansTotal: 1500738,
    note: "全資料蔵書数が過去最高の1,338,409冊に到達。",
  },
  {
    fiscalYear: 2024,
    eraLabel: "令和6年度",
    shortEraLabel: "R6",
    librariesCount: 11,
    servicePointsCount: 2,
    holdingsTotal: 1330838,
    loansTotal: 1516078,
    note: "村井駅SP（10月）・四賀公民館図書室SP（11月）を開設し、貸出151.6万冊（前年比+1.0%）。",
  },
];

function buildBrackets(input: {
  city: number[];
  outside: number[];
  total: number[];
  population: number[];
  regRate: number[];
  activeUsers: number[];
  activeVsReg: number[];
  activeVsPop: number[];
}) {
  return AGE_BRACKETS_META.map((meta, idx) => ({
    bracketId: meta.id,
    label: meta.label,
    registeredCity: input.city[idx],
    registeredOutside: input.outside[idx],
    registeredTotal: input.total[idx],
    population: input.population[idx],
    registrationRatePct: input.regRate[idx],
    activeUsers: input.activeUsers[idx],
    activeRateVsRegisteredPct: input.activeVsReg[idx],
    activeRateVsPopulationPct: input.activeVsPop[idx],
  }));
}

/**
 * 年齢別登録者数・登録率・実利用率（出典：令和6年度・令和7年度 図書館概要）
 */
export const AGE_GROUP_SNAPSHOTS: AgeGroupSnapshot[] = [
  {
    fiscalYear: 2023,
    eraLabel: "令和5年度",
    asOf: "令和6年3月31日現在",
    totals: {
      registeredCity: 52153,
      registeredOutside: 4762,
      registeredTotal: 56915,
      population: 234421,
      registrationRatePct: 22.2,
      activeUsers: 26497,
      activeRateVsRegisteredPct: 50.8,
      activeRateVsPopulationPct: 11.3,
    },
    brackets: buildBrackets({
      city: [2023, 5275, 2713, 2128, 2454, 4251, 6959, 8866, 6598, 4853, 6033],
      outside: [54, 170, 107, 183, 428, 536, 596, 865, 781, 568, 474],
      total: [2077, 5445, 2820, 2311, 2882, 4787, 7555, 9731, 7379, 5421, 6507],
      population: [
        11540, 12290, 6571, 6620, 8958, 18822, 24782, 33171, 33587, 26707,
        51373,
      ],
      regRate: [
        17.5, 42.9, 41.3, 32.1, 27.4, 22.6, 28.1, 26.7, 19.6, 18.2, 11.7,
      ],
      activeUsers: [
        1555, 3220, 890, 662, 717, 1403, 3692, 4682, 3557, 2910, 3209,
      ],
      activeVsReg: [
        76.9, 61.0, 32.8, 31.1, 29.2, 33.0, 53.1, 52.8, 53.9, 60.0, 53.2,
      ],
      activeVsPop: [
        13.5, 26.2, 13.5, 10.0, 8.0, 7.5, 14.9, 14.1, 10.6, 10.9, 6.2,
      ],
    }),
    branchBreakdowns: {
      chuo: [679, 1692, 875, 839, 1666, 2779, 3195, 4060, 3202, 2352, 2607],
      nanbu: [337, 944, 420, 310, 287, 675, 1445, 1730, 1248, 980, 1043],
      agata: [159, 333, 153, 135, 127, 214, 485, 587, 448, 300, 403],
      kamata: [110, 302, 139, 95, 69, 131, 299, 375, 308, 217, 277],
      kotobukidai: [109, 236, 141, 113, 87, 128, 248, 368, 308, 254, 331],
      hongo: [168, 378, 145, 100, 90, 130, 251, 299, 270, 218, 286],
      nakayama: [47, 111, 54, 40, 37, 55, 86, 144, 132, 87, 90],
      shimauchi: [116, 286, 161, 119, 79, 123, 266, 390, 292, 161, 254],
      kuko: [178, 445, 251, 161, 126, 194, 414, 701, 481, 307, 453],
      azusagawa: [67, 302, 182, 179, 124, 144, 349, 427, 205, 146, 236],
      hata: [107, 416, 299, 220, 190, 214, 517, 650, 485, 399, 527],
    } satisfies Record<BranchId, number[]>,
  },
  {
    fiscalYear: 2024,
    eraLabel: "令和6年度",
    asOf: "令和7年3月31日現在",
    totals: {
      registeredCity: 45588,
      registeredOutside: 4137,
      registeredTotal: 49725,
      population: 233020,
      registrationRatePct: 19.6,
      activeUsers: 28311,
      activeRateVsRegisteredPct: 62.1,
      activeRateVsPopulationPct: 12.1,
    },
    brackets: buildBrackets({
      city: [1977, 4849, 2190, 1564, 2062, 3637, 5959, 7560, 5938, 4484, 5368],
      outside: [62, 159, 81, 151, 361, 388, 506, 756, 722, 527, 424],
      total: [2039, 5008, 2271, 1715, 2423, 4025, 6465, 8316, 6660, 5011, 5792],
      population: [
        11125, 11893, 6470, 6656, 8906, 18836, 24356, 32164, 34421, 26829,
        51364,
      ],
      regRate: [
        17.8, 40.8, 33.8, 23.5, 23.2, 19.3, 24.5, 23.5, 17.3, 16.7, 10.5,
      ],
      activeUsers: [
        1571, 3300, 950, 627, 811, 1455, 3847, 4993, 3935, 3280, 3542,
      ],
      activeVsReg: [
        79.5, 68.1, 43.4, 40.1, 39.3, 40.0, 64.6, 66.0, 66.3, 73.1, 66.0,
      ],
      activeVsPop: [
        14.1, 27.7, 14.7, 9.4, 9.1, 7.7, 15.8, 15.5, 11.4, 12.2, 6.9,
      ],
    }),
    branchBreakdowns: {
      chuo: [633, 1513, 744, 662, 1437, 2338, 2732, 3508, 2952, 2162, 2313],
      nanbu: [327, 873, 347, 257, 245, 545, 1188, 1475, 1089, 919, 954],
      agata: [148, 301, 121, 100, 99, 169, 404, 500, 379, 285, 354],
      kamata: [103, 244, 127, 66, 52, 101, 284, 321, 263, 203, 243],
      kotobukidai: [121, 233, 99, 71, 63, 115, 219, 292, 280, 229, 301],
      hongo: [182, 408, 123, 70, 77, 107, 221, 281, 245, 190, 253],
      nakayama: [51, 101, 42, 25, 29, 50, 83, 112, 119, 79, 81],
      shimauchi: [124, 350, 120, 83, 74, 100, 235, 326, 250, 168, 214],
      kuko: [174, 370, 172, 114, 103, 163, 382, 569, 438, 270, 408],
      azusagawa: [63, 250, 149, 110, 109, 137, 293, 365, 217, 139, 197],
      hata: [113, 365, 227, 157, 135, 200, 424, 567, 428, 367, 474],
    } satisfies Record<BranchId, number[]>,
  },
];

/**
 * 令和6年度 サービスポイント別の児童貸出冊数・来館者数（出典：令和7年度 図書館概要）
 * ※長野県概況（8.xlsx）の中央分にはこれら2SP分が合算されているため、11館と2SPを正確に分離するために利用する。
 */
export const FY2024_SERVICE_POINT_DETAILS = {
  "murai-sp": {
    openedAt: "2024年10月",
    loansChildren: 715,
    visitors: 1356,
  },
  "shiga-sp": {
    openedAt: "2024年11月",
    loansChildren: 83,
    visitors: 125,
  },
} as const;

/**
 * 市町村と県による協働電子図書館「デジとしょ信州」実績（出典：令和7年度 図書館概要）
 */
export const DIGITAL_LIBRARY_HISTORY: DigitalLibraryYear[] = [
  {
    fiscalYear: 2022,
    eraLabel: "令和4年度",
    registeredUsers: 746,
    holdingsItems: 21195,
    loansCount: 4781,
  },
  {
    fiscalYear: 2023,
    eraLabel: "令和5年度",
    registeredUsers: 1084,
    holdingsItems: 27963,
    loansCount: 4913,
  },
  {
    fiscalYear: 2024,
    eraLabel: "令和6年度",
    registeredUsers: 1874,
    holdingsItems: 25050,
    loansCount: 7615,
  },
];

export const ANNUAL_ERA_LABELS: Record<
  number,
  { eraLabel: string; shortEraLabel: string; notes: string[] }
> = {
  2013: {
    eraLabel: "平成25年度",
    shortEraLabel: "H25",
    notes: ["11館体制（梓川図書館H24.5開館後）の初年度比較基点。"],
  },
  2014: {
    eraLabel: "平成26年度",
    shortEraLabel: "H26",
    notes: ["全資料蔵書数が120万冊を突破。"],
  },
  2015: {
    eraLabel: "平成27年度",
    shortEraLabel: "H27",
    notes: [
      "個人貸出冊数が過去最高の1,681,546冊（市民1人あたり約7.0冊）を記録。",
    ],
  },
  2016: {
    eraLabel: "平成28年度",
    shortEraLabel: "H28",
    notes: ["西部図書館（現・鎌田）等で設備更新や蔵書整理を実施。"],
  },
  2017: {
    eraLabel: "平成29年度",
    shortEraLabel: "H29",
    notes: ["やまびこ文庫の対象地域を奈川・安曇地区含め市内全域へ拡大。"],
  },
  2018: {
    eraLabel: "平成30年度",
    shortEraLabel: "H30",
    notes: [
      "台風21号による電気設備故障のためあがたの森図書館が9/4〜10/16臨時休館。中央図書館Web検索・本棚機能を整備。",
    ],
  },
  2019: {
    eraLabel: "令和元年度",
    shortEraLabel: "R1",
    notes: [
      "西部図書館を「鎌田図書館」へ名称変更（R1.4）。年度末（3/4〜3/31）に新型コロナウイルス感染拡大防止のため全館臨時閉館。",
    ],
  },
  2020: {
    eraLabel: "令和2年度",
    shortEraLabel: "R2",
    notes: [
      "【制度変更】登録者データの削除基準を「有効期限切れ後10年以上未更新」から「2年以上未更新」へ変更（見かけ上の登録者数が118,667人→56,164人へ減少）。",
      "新型コロナ対応で4/1〜5/15に全館臨時閉館。予約冊数は前年度比+30.8%（23.8万冊）へ急増。",
    ],
  },
  2021: {
    eraLabel: "令和3年度",
    shortEraLabel: "R3",
    notes: [
      "全資料蔵書数が130万冊を突破。個人貸出はコロナ禍前から回復し1,563,731冊（児童貸出67.3万冊）。",
    ],
  },
  2022: {
    eraLabel: "令和4年度",
    shortEraLabel: "R4",
    notes: [
      "8月に協働電子図書館「デジとしょ信州」へ参加開始。波田図書館がLED照明更新工事のため6/20〜6/24臨時閉館。",
    ],
  },
  2023: {
    eraLabel: "令和5年度",
    shortEraLabel: "R5",
    notes: [
      "全資料蔵書数が過去最高の1,338,409冊。サーバ更新（9月全館）・松南地区公民館改修（南部9〜10月）・耐震工事移転（あがた3月）で臨時閉館あり。",
    ],
  },
  2024: {
    eraLabel: "令和6年度",
    shortEraLabel: "R6",
    notes: [
      "村井駅（10月）・四賀公民館図書室（11月）にサービスポイントを開設。予約冊数が過去最高の24.96万冊。",
    ],
  },
  2025: {
    eraLabel: "令和7年度",
    shortEraLabel: "R7",
    notes: [
      "長野県公共図書館概況（令和8年度版）による最新実績。個人貸出1,532,796冊（前年比+1.1%）と堅調に増加。",
      "中央図書館の2027年長寿命化改修に向けた蔵書整理・除籍（中央のみで年間41,522冊除籍）により図書蔵書数は前年比-3.2%。※全資料蔵書数は「松本市の統計」公表前につき未収録。",
    ],
  },
};
