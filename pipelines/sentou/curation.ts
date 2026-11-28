import type {
  BathAccessCategory,
  BathAreaGroup,
  BathFacilityType,
  BathSchedule,
  BathTimeWindow,
  BathWaterType,
} from "../../src/lib/sentou-schema";

export interface CuratedBathSpec {
  id: string;
  expectedRegistryName: string;
  displayName?: string;
  accessCategory: BathAccessCategory;
  accessNote: string | null;
  facilityType: BathFacilityType;
  waterType: BathWaterType;
  hasSauna: boolean;
  hasRotenburo: boolean;
  feeSummary: string | null;
  phone: string | null;
  officialUrl: string | null;
  lat: number | null;
  lng: number | null;
  recommendedRank: number;
  schedule: BathSchedule;
  areaGroupOverride?: BathAreaGroup;
  subAreaOverride?: string;
}

export const OFFICIAL_BATH_LINKS = {
  shinshuSento: "https://shinshu1010.com/",
  visitMatsumotoOnsen: "https://visitmatsumoto.com/onsen/",
  asamaOnsen: "https://asamaonsen.com/",
  utsukushigaharaOnsen: "https://utsukushigahara-onsen.com/",
  norikura: "https://norikura.gr.jp/",
  shirahone: "https://www.shirahone.org/onsen/",
} as const;

export const ACCESS_CATEGORY_LABELS: Record<BathAccessCategory, string> = {
  public_drop_in: "一般日帰りOK",
  day_use_inn: "日帰り入浴あり（宿）",
  reservation_required: "予約制・貸切中心",
  local_only: "地元・組合員専用",
  eligible_only: "対象者限定（市内60歳以上）",
  members_only: "会員・施設利用者専用",
  guests_only: "宿泊者専用",
  check_lodging_or_status: "宿泊施設・日帰り要確認",
};

function win(
  openHour: number,
  openMin: number,
  lastHour: number,
  lastMin: number,
  closeHour: number,
  closeMin: number,
): BathTimeWindow {
  return {
    openMinutes: openHour * 60 + openMin,
    lastEntryMinutes: lastHour * 60 + lastMin,
    closeMinutes: closeHour * 60 + closeMin,
  };
}

export function inferAreaFromAddress(
  address: string,
  postalCode: string | null,
): { areaGroup: BathAreaGroup; subArea: string } {
  if (address.includes("浅間温泉")) {
    return { areaGroup: "asama_utsukushigahara", subArea: "浅間温泉" };
  }
  if (address.includes("里山辺")) {
    return {
      areaGroup: "asama_utsukushigahara",
      subArea: "美ヶ原温泉・里山辺",
    };
  }
  if (address.includes("入山辺")) {
    return { areaGroup: "asama_utsukushigahara", subArea: "扉温泉・入山辺" };
  }
  if (address.includes("安曇")) {
    if (
      address.includes("上高地") ||
      postalCode === "390-1516" ||
      address.includes("4468") ||
      address.includes("4469") ||
      address.includes("4470")
    ) {
      return { areaGroup: "norikura_shirahone", subArea: "上高地" };
    }
    if (postalCode === "390-1515") {
      return { areaGroup: "norikura_shirahone", subArea: "白骨温泉" };
    }
    if (postalCode === "390-1514") {
      return { areaGroup: "norikura_shirahone", subArea: "沢渡・中の湯" };
    }
    if (
      postalCode === "390-1511" ||
      postalCode === "390-1512" ||
      postalCode === "390-1513"
    ) {
      return { areaGroup: "norikura_shirahone", subArea: "乗鞍高原" };
    }
    return {
      areaGroup: "norikura_shirahone",
      subArea: "安曇・乗鞍・白骨エリア",
    };
  }
  if (address.includes("奈川")) {
    return { areaGroup: "norikura_shirahone", subArea: "奈川" };
  }
  if (address.includes("波田")) {
    return { areaGroup: "suburbs", subArea: "波田" };
  }
  if (address.includes("梓川")) {
    return { areaGroup: "suburbs", subArea: "梓川" };
  }
  if (
    address.includes("穴沢") ||
    address.includes("会田") ||
    address.includes("四賀")
  ) {
    return { areaGroup: "suburbs", subArea: "四賀" };
  }
  if (address.includes("洞")) {
    return { areaGroup: "suburbs", subArea: "岡田・洞" };
  }
  if (address.includes("三才山")) {
    return { areaGroup: "suburbs", subArea: "三才山" };
  }
  if (address.includes("内田")) {
    return { areaGroup: "suburbs", subArea: "内田" };
  }
  if (address.includes("島内")) {
    return { areaGroup: "central", subArea: "島内" };
  }
  if (address.includes("大手")) {
    return { areaGroup: "central", subArea: "大手・松本城周辺" };
  }
  if (address.includes("中央")) {
    return { areaGroup: "central", subArea: "中央・松本駅周辺" };
  }
  if (address.includes("深志")) {
    return { areaGroup: "central", subArea: "深志・松本駅周辺" };
  }
  if (address.includes("本庄")) {
    return { areaGroup: "central", subArea: "本庄" };
  }
  if (address.includes("北深志")) {
    return { areaGroup: "central", subArea: "北深志" };
  }
  if (address.includes("女鳥羽")) {
    return { areaGroup: "central", subArea: "女鳥羽" };
  }
  if (address.includes("城西")) {
    return { areaGroup: "central", subArea: "城西" };
  }
  if (address.includes("渚")) {
    return { areaGroup: "central", subArea: "渚" };
  }
  if (address.includes("南松本")) {
    return { areaGroup: "central", subArea: "南松本" };
  }
  if (address.includes("双葉")) {
    return { areaGroup: "central", subArea: "双葉・南松本" };
  }
  if (address.includes("出川")) {
    return { areaGroup: "central", subArea: "出川・庄内" };
  }
  if (address.includes("庄内")) {
    return { areaGroup: "central", subArea: "庄内" };
  }
  if (address.includes("石芝")) {
    return { areaGroup: "central", subArea: "石芝" };
  }
  if (address.includes("寿北")) {
    return { areaGroup: "central", subArea: "寿北" };
  }
  if (address.includes("松原")) {
    return { areaGroup: "central", subArea: "松原" };
  }
  if (address.includes("村井")) {
    return { areaGroup: "central", subArea: "村井" };
  }
  if (address.includes("水汲")) {
    return { areaGroup: "central", subArea: "水汲" };
  }
  return { areaGroup: "central", subArea: "松本市街地" };
}

const LOCAL_ONLY_SCHEDULE: BathSchedule = {
  kind: "not_public",
  summaryText: "地元住民・組合員（湯仲間）専用（一般外来不可）",
  lastEntryText: null,
  holidayNote: "組合管理のため一般の方の立ち入り・入浴はできません",
  irregularNote:
    "浅間温泉の日帰り入浴はホットプラザ浅間・湯々庵 枇杷の湯・仙気の湯をご利用ください。",
};

const ASAMA_LOCAL_ONLY_NOTE =
  "浅間温泉の地域住民（湯仲間・組合員）が維持・管理する地元専用の共同浴場です。一般の方の立ち入り・日帰り入浴・無断駐車はできません。";

function makeLocalOnlySpec(
  id: string,
  expectedRegistryName: string,
  lat: number,
  lng: number,
  rank: number,
  extraNote?: string,
): CuratedBathSpec {
  return {
    id,
    expectedRegistryName,
    accessCategory: "local_only",
    accessNote: extraNote
      ? `${ASAMA_LOCAL_ONLY_NOTE} ${extraNote}`
      : ASAMA_LOCAL_ONLY_NOTE,
    facilityType: "communal_bath",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "組合員専用（一般入浴不可）",
    phone: null,
    officialUrl: OFFICIAL_BATH_LINKS.asamaOnsen,
    lat,
    lng,
    recommendedRank: rank,
    schedule: LOCAL_ONLY_SCHEDULE,
  };
}

function makeMembersOnlySpec(
  id: string,
  expectedRegistryName: string,
  note: string,
  rank: number,
  hasSauna = false,
): CuratedBathSpec {
  return {
    id,
    expectedRegistryName,
    accessCategory: "members_only",
    accessNote: note,
    facilityType: "fitness_golf",
    waterType: "non_onsen",
    hasSauna,
    hasRotenburo: false,
    feeSummary: "会員・施設利用者限定",
    phone: null,
    officialUrl: null,
    lat: null,
    lng: null,
    recommendedRank: rank,
    schedule: {
      kind: "not_public",
      summaryText: "会員・施設利用者専用（一般の立ち寄り入浴不可）",
      lastEntryText: null,
      holidayNote: "利用条件・営業時間は各施設の会員向け案内をご確認ください",
      irregularNote: null,
    },
  };
}

function makeGuestsOnlySpec(
  id: string,
  expectedRegistryName: string,
  displayName: string | undefined,
  note: string,
  waterType: BathWaterType,
  hasSauna: boolean,
  lat: number | null,
  lng: number | null,
  rank: number,
): CuratedBathSpec {
  return {
    id,
    expectedRegistryName,
    displayName,
    accessCategory: "guests_only",
    accessNote: note,
    facilityType: "lodging_other",
    waterType,
    hasSauna,
    hasRotenburo: false,
    feeSummary: "宿泊者専用（一般日帰り入浴なし）",
    phone: null,
    officialUrl: null,
    lat,
    lng,
    recommendedRank: rank,
    schedule: {
      kind: "not_public",
      summaryText: "宿泊者専用（一般の日帰り入浴受付なし）",
      lastEntryText: null,
      holidayNote: "宿泊者向けの入浴時間は各宿泊施設へご確認ください",
      irregularNote: null,
    },
  };
}

export const BATH_CURATIONS: Record<string, CuratedBathSpec> = {
  // === A. 一般日帰りOK（public_drop_in: 25件） ===
  "59": {
    id: "zuisho-matsumoto",
    expectedRegistryName: "湯の華銭湯瑞祥松本",
    displayName: "湯の華銭湯 瑞祥 松本館",
    accessCategory: "public_drop_in",
    accessNote:
      "松本IC近く（なぎさライフサイト内）の大型スーパー銭湯。天然温泉・露天風呂・各種サウナを備え、深夜24時まで営業しています。",
    facilityType: "super_sentou",
    waterType: "onsen",
    hasSauna: true,
    hasRotenburo: true,
    feeSummary: "大人 通常800円（繁忙期900円）/ 小学生350円 / 幼児100円",
    phone: "0263-29-2686",
    officialUrl: "https://zuisho-matsumoto.com/",
    lat: 36.231766,
    lng: 137.9561,
    recommendedRank: 1,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(9, 30, 23, 20, 24, 0)],
      daySessions: {
        "0": [win(6, 0, 23, 20, 24, 0)],
        "6": [win(6, 0, 23, 20, 24, 0)],
        holiday: [win(6, 0, 23, 20, 24, 0)],
      },
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [{ nth: 3, weekday: 2, shiftIfHoliday: "none" }],
      yearEndClosed: null,
      summaryText: "平日 9:30〜24:00 / 土日祝 6:00〜24:00",
      lastEntryText: "23:20",
      holidayNote: "毎月第3火曜日（原則）",
      irregularNote: "時期により朝風呂営業時間等が変更される場合があります。",
    },
  },
  "52": {
    id: "obu-matsumoto",
    expectedRegistryName: "林檎の湯屋おぶ～",
    displayName: "林檎の湯屋 おぶ〜",
    accessCategory: "public_drop_in",
    accessNote:
      "ナノ水や高濃度炭酸泉・天然鉱石温泉系の湯船・多彩なサウナを備えた大型温浴施設。原則年中無休で立ち寄りやすい人気スポットです。",
    facilityType: "super_sentou",
    waterType: "non_onsen",
    hasSauna: true,
    hasRotenburo: true,
    feeSummary:
      "中学生以上 平日1,000円・土日祝1,100円（繁忙期1,300円）/ 子供200円",
    phone: "0263-29-1126",
    officialUrl: "https://www.orchard.co.jp/obu/",
    lat: 36.203854,
    lng: 137.947723,
    recommendedRank: 2,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(9, 0, 22, 30, 23, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "毎日 9:00〜23:00",
      lastEntryText: "22:30",
      holidayNote: "無休（年3回ほど機械設備メンテナンスによる臨時休館あり）",
      irregularNote: "岩盤温浴・レストラン等は終了時間が異なります。",
    },
  },
  "81": {
    id: "hot-plaza-asama",
    expectedRegistryName: "浅間温泉会館",
    displayName: "ホットプラザ浅間（浅間温泉会館）",
    accessCategory: "public_drop_in",
    accessNote:
      "浅間温泉の中心地にある代表的な日帰り温泉施設。大浴場・露天風呂・サウナに加え、無料の足湯も併設し24時まで利用できます。",
    facilityType: "day_onsen",
    waterType: "onsen",
    hasSauna: true,
    hasRotenburo: true,
    feeSummary: "公式サイトで最新料金をご確認ください",
    phone: "0263-46-3330",
    officialUrl: "https://hotplaza.jp/",
    lat: 36.262989,
    lng: 137.9888,
    recommendedRank: 3,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 3, 4, 5, 6],
      defaultSessions: [win(10, 0, 23, 0, 24, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "open_closed_weekday_shift_next_day",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "水〜月 10:00〜24:00",
      lastEntryText: "23:00（入館・足湯）",
      holidayNote:
        "毎週火曜日（祝日の場合は営業し翌日休館・年末年始/GW/お盆は無休）",
      irregularNote: null,
    },
  },
  "36": {
    id: "biwa-no-yu",
    expectedRegistryName: "湯々庵枇杷の湯",
    displayName: "湯々庵 枇杷の湯",
    accessCategory: "public_drop_in",
    accessNote:
      "松本藩主の御殿湯にルーツを持つ浅間温泉の日帰り温泉施設。檜の露天風呂や野天風呂が楽しめます。",
    facilityType: "day_onsen",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "公式サイトで最新料金をご確認ください",
    phone: "0263-46-1637",
    officialUrl: "http://www.biwanoyu.com/",
    lat: 36.265877,
    lng: 137.991547,
    recommendedRank: 4,
    schedule: {
      kind: "structured",
      openDays: [0, 2, 3, 4, 5, 6],
      defaultSessions: [win(9, 0, 20, 0, 21, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "open_closed_weekday_shift_next_day",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "火〜日 9:00〜21:00",
      lastEntryText: "20:00",
      holidayNote: "毎週月曜日（祝日の場合は営業し翌日休館）",
      irregularNote: null,
    },
  },
  "5": {
    id: "fuji-no-yu",
    expectedRegistryName: "富士の湯",
    accessCategory: "public_drop_in",
    accessNote:
      "昭和元年創業の一般公衆浴場（街の銭湯）。2026年5月に大幅リニューアルされ、男湯サウナ・水風呂を新設し24時まで営業しています。",
    facilityType: "sentou",
    waterType: "non_onsen",
    hasSauna: true,
    hasRotenburo: false,
    feeSummary: "大人500円 / 小学生170円（サウナ利用は別途追加料金）",
    phone: null,
    officialUrl: OFFICIAL_BATH_LINKS.shinshuSento,
    lat: 36.227951,
    lng: 137.974731,
    recommendedRank: 5,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 5, 6],
      defaultSessions: [win(15, 0, 23, 30, 24, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "金〜水 15:00〜24:00",
      lastEntryText: "23:30目安（サウナは23:00まで）",
      holidayNote: "毎週木曜日",
      irregularNote:
        "2026年5月リニューアル。最新の休業日はSNS等もご確認ください。",
    },
  },
  "37": {
    id: "kiku-no-yu",
    expectedRegistryName: "菊の湯",
    accessCategory: "public_drop_in",
    accessNote:
      "中心市街地・中央3丁目のレトロ銭湯。向かいのブックカフェ「栞日」が運営を継承し、日曜は朝7時から朝風呂営業を行っています。",
    facilityType: "sentou",
    waterType: "non_onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "大人500円 / 小学生170円",
    phone: null,
    officialUrl: OFFICIAL_BATH_LINKS.shinshuSento,
    lat: 36.231277,
    lng: 137.973862,
    recommendedRank: 6,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 4, 5, 6],
      defaultSessions: [win(15, 0, 22, 30, 23, 0)],
      daySessions: {
        "0": [win(7, 0, 22, 30, 23, 0)],
      },
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "月・火・木〜土 15:00〜23:00 / 日曜 7:00〜23:00",
      lastEntryText: "22:30頃目安",
      holidayNote: "毎週水曜日",
      irregularNote: null,
    },
  },
  "3": {
    id: "shioi-no-yu",
    expectedRegistryName: "塩井乃湯",
    accessCategory: "public_drop_in",
    accessNote:
      "松本城のすぐ近く（大手3丁目）にある大正15年築の一般公衆浴場。レトロな建築意匠が残る街の銭湯です。",
    facilityType: "sentou",
    waterType: "non_onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "大人500円 / 小学生170円",
    phone: null,
    officialUrl: OFFICIAL_BATH_LINKS.shinshuSento,
    lat: 36.236435,
    lng: 137.967865,
    recommendedRank: 7,
    schedule: {
      kind: "structured",
      openDays: [0, 2, 3, 4, 5, 6],
      defaultSessions: [win(15, 0, 21, 30, 22, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "火〜日 15:00〜22:00",
      lastEntryText: "21:30頃目安",
      holidayNote: "毎週月曜日",
      irregularNote: null,
    },
  },
  "54": {
    id: "shiraito-no-yu",
    expectedRegistryName: "ふれあい山辺館 白糸の湯",
    displayName: "白糸の湯（ふれあい山辺館）",
    accessCategory: "public_drop_in",
    accessNote:
      "美ヶ原温泉にある早朝から夜まで利用できる日帰り温泉施設。地元の常連客や登山・観光帰りにも親しまれています。",
    facilityType: "day_onsen",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "公式サイトで最新料金をご確認ください",
    phone: "0263-31-8011",
    officialUrl: OFFICIAL_BATH_LINKS.utsukushigaharaOnsen,
    lat: 36.246006,
    lng: 137.998819,
    recommendedRank: 8,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(7, 0, 21, 30, 22, 0)],
      seasonalOverrides: [
        {
          months: [4, 5, 6, 7, 8, 9],
          weekday: [win(6, 30, 21, 30, 22, 0)],
          saturday: [win(6, 30, 21, 30, 22, 0)],
          sunday: [win(6, 30, 21, 30, 22, 0)],
          holiday: [win(6, 30, 21, 30, 22, 0)],
          note: "4〜9月は朝6:30開館",
        },
        {
          months: [10, 11, 12, 1, 2, 3],
          weekday: [win(7, 0, 21, 30, 22, 0)],
          saturday: [win(7, 0, 21, 30, 22, 0)],
          sunday: [win(7, 0, 21, 30, 22, 0)],
          holiday: [win(7, 0, 21, 30, 22, 0)],
          note: "10〜3月は朝7:00開館",
        },
      ],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [
        { nth: 1, weekday: 2, shiftIfHoliday: "check_official" },
        { nth: 3, weekday: 2, shiftIfHoliday: "check_official" },
      ],
      yearEndClosed: null,
      summaryText: "4〜9月 6:30〜22:00 / 10〜3月 7:00〜22:00",
      lastEntryText: "21:30",
      holidayNote:
        "毎月第1・第3火曜日（祝日の場合は原則営業し、別の火曜に振替休館となる場合あり）",
      irregularNote: null,
    },
  },
  "111": {
    id: "lala-matsumoto",
    expectedRegistryName: "ラーラ松本",
    displayName: "ラーラ松本（展望風呂・温水プール）",
    accessCategory: "public_drop_in",
    accessNote:
      "島内にある市営の余熱利用施設。展望風呂・サウナや温水プールが利用でき、17時以降のナイター券もあります。",
    facilityType: "public_facility",
    waterType: "non_onsen",
    hasSauna: true,
    hasRotenburo: false,
    feeSummary:
      "大人830円（ナイター17時〜520円）/ プール+入浴セット 大人1,040円",
    phone: "0263-48-1110",
    officialUrl: "https://www.lala-matsumoto.jp/",
    lat: 36.275177,
    lng: 137.943405,
    recommendedRank: 9,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 3, 4, 5, 6],
      defaultSessions: [win(10, 0, 20, 30, 21, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "open_closed_weekday_shift_next_weekday",
      nthWeekdaysClosed: [],
      yearEndClosed: { startMmdd: "12-29", endMmdd: "01-01" },
      summaryText: "水〜月 10:00〜21:00",
      lastEntryText: "20:30",
      holidayNote:
        "毎週火曜日（祝日の場合は翌平日）・12/29〜1/1（夏休み期間は無休、施設点検休館あり）",
      irregularNote: "プール遊泳は20:45まで。",
    },
  },
  "17": {
    id: "senki-no-yu",
    expectedRegistryName: "仙気の湯",
    displayName: "浅間温泉 仙気の湯",
    accessCategory: "public_drop_in",
    accessNote:
      "地元専用の多い浅間温泉街で、一般の観光客も外来入浴できる数少ない共同浴場です。早朝から営業しています。",
    facilityType: "communal_bath",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "現地券売機等で最新料金をご確認ください",
    phone: null,
    officialUrl: OFFICIAL_BATH_LINKS.asamaOnsen,
    lat: 36.262306,
    lng: 137.990738,
    recommendedRank: 10,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(6, 30, 19, 30, 19, 45)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [
        { nth: 2, weekday: 3, shiftIfHoliday: "none" },
        { nth: 4, weekday: 3, shiftIfHoliday: "none" },
      ],
      yearEndClosed: null,
      summaryText: "毎日 6:30〜19:45（目安）",
      lastEntryText: "19:30頃目安",
      holidayNote: "毎月第2・第4水曜日",
      irregularNote: "時期により6:00〜20:00など前後する場合があります。",
    },
  },
  "91": {
    id: "ryushima-seseragi",
    expectedRegistryName: "松本市波田竜島温泉入浴施設（竜島温泉せせらぎの湯）",
    displayName: "竜島温泉 せせらぎの湯",
    accessCategory: "public_drop_in",
    accessNote:
      "松本市波田・梓川沿いにある市営の日帰り温泉施設。上高地・乗鞍方面のドライブや登山帰りの立ち寄り湯としても便利です。",
    facilityType: "day_onsen",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "公式サイトで最新料金をご確認ください",
    phone: "0263-94-1126",
    officialUrl: "https://ryushima-onsen.jp/",
    lat: 36.183151,
    lng: 137.789517,
    recommendedRank: 11,
    schedule: {
      kind: "structured",
      openDays: [0, 2, 3, 4, 5, 6],
      defaultSessions: [win(10, 0, 21, 0, 22, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "open_closed_weekday_shift_next_weekday",
      nthWeekdaysClosed: [],
      yearEndClosed: { startMmdd: "12-31", endMmdd: "01-01" },
      summaryText: "火〜日 10:00〜22:00",
      lastEntryText: "21:00",
      holidayNote: "毎週月曜日（祝日の場合は営業し翌平日休館）・12/31〜1/1",
      irregularNote: null,
    },
  },
  "87": {
    id: "shisuien",
    expectedRegistryName: "松本市梓川地域休養施設",
    displayName: "梓水苑（松本市梓川地域休養施設）",
    accessCategory: "public_drop_in",
    accessNote:
      "北アルプスの地下天然水（沸かし湯）を楽しめる松本市梓川の公共入浴・休養施設。火曜日は14時から日帰り入浴を受け付けています。",
    facilityType: "public_facility",
    waterType: "non_onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "大人500円 / 小人（4歳以上）250円",
    phone: "0263-78-5550",
    officialUrl: "https://www.shisuien.jp/",
    lat: 36.220871,
    lng: 137.884277,
    recommendedRank: 12,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(10, 0, 20, 0, 21, 0)],
      daySessions: {
        "2": [win(14, 0, 20, 0, 21, 0)],
      },
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "水〜月 10:00〜21:00 / 火曜 14:00〜21:00",
      lastEntryText: "20:00",
      holidayNote: "不定休（施設点検等により臨時休館・受付制限の場合あり）",
      irregularNote: null,
    },
  },
  "20": {
    id: "sakura-no-yu",
    expectedRegistryName: "桜の湯",
    accessCategory: "public_drop_in",
    accessNote:
      "女鳥羽1丁目の住宅街にある大正13年創業の一般公衆浴場（街の銭湯）。",
    facilityType: "sentou",
    waterType: "non_onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "大人500円 / 小学生170円",
    phone: null,
    officialUrl: OFFICIAL_BATH_LINKS.shinshuSento,
    lat: 36.238243,
    lng: 137.978378,
    recommendedRank: 13,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 6],
      defaultSessions: [win(15, 0, 21, 30, 22, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "土〜木 15:00〜22:00",
      lastEntryText: "21:30頃目安",
      holidayNote: "毎週金曜日",
      irregularNote: null,
    },
  },
  "4": {
    id: "matsu-no-yu",
    expectedRegistryName: "松の湯",
    accessCategory: "public_drop_in",
    accessNote:
      "北深志1丁目にある昔ながらの一般公衆浴場（街の銭湯）。14時から営業しています。",
    facilityType: "sentou",
    waterType: "non_onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "大人500円 / 小学生170円",
    phone: null,
    officialUrl: OFFICIAL_BATH_LINKS.shinshuSento,
    lat: 36.243423,
    lng: 137.97377,
    recommendedRank: 14,
    schedule: {
      kind: "structured",
      openDays: [2, 3, 4, 5, 6],
      defaultSessions: [win(14, 0, 21, 30, 22, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "火〜土 14:00〜22:00",
      lastEntryText: "21:30頃目安",
      holidayNote: "毎週日曜日・月曜日",
      irregularNote: null,
    },
  },
  "15": {
    id: "minoru-no-yu",
    expectedRegistryName: "みのるの湯",
    accessCategory: "public_drop_in",
    accessNote: "南松本1丁目にある地域密着型の一般公衆浴場（街の銭湯）。",
    facilityType: "sentou",
    waterType: "non_onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "大人500円 / 小学生170円",
    phone: null,
    officialUrl: OFFICIAL_BATH_LINKS.shinshuSento,
    lat: 36.213127,
    lng: 137.969467,
    recommendedRank: 15,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 6],
      defaultSessions: [win(14, 30, 21, 30, 22, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "土〜木 14:30〜22:00",
      lastEntryText: "21:30頃目安",
      holidayNote: "毎週金曜日",
      irregularNote: null,
    },
  },
  "2": {
    id: "kotobuki-no-yu",
    expectedRegistryName: "寿の湯",
    accessCategory: "public_drop_in",
    accessNote: "寿北7丁目にある地域密着型の一般公衆浴場（街の銭湯）。",
    facilityType: "sentou",
    waterType: "non_onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "大人500円 / 小学生170円",
    phone: null,
    officialUrl: OFFICIAL_BATH_LINKS.shinshuSento,
    lat: 36.192024,
    lng: 137.97142,
    recommendedRank: 16,
    schedule: {
      kind: "structured",
      openDays: [0, 2, 3, 4, 5, 6],
      defaultSessions: [win(14, 0, 21, 30, 22, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "火〜日 14:00〜22:00",
      lastEntryText: "21:30頃目安",
      holidayNote: "毎週月曜日",
      irregularNote: null,
    },
  },
  "51": {
    id: "tobira-hinoki-no-yu",
    expectedRegistryName: "山辺地区農業生活改善センター（桧の湯）",
    displayName: "扉温泉 桧の湯",
    accessCategory: "public_drop_in",
    accessNote:
      "入山辺の渓谷沿い・扉温泉にある市営（地域運営）の日帰り温泉施設。露天風呂を備え、良心的な料金で楽しめます。",
    facilityType: "day_onsen",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "1回券 大人400円・小学生200円 / 1日券 大人700円",
    phone: "0263-31-2201",
    officialUrl: OFFICIAL_BATH_LINKS.visitMatsumotoOnsen,
    lat: 36.187072,
    lng: 138.08011,
    recommendedRank: 17,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(10, 0, 18, 30, 19, 0)],
      seasonalOverrides: [
        {
          months: [3, 4, 5, 6, 7, 8, 9, 10, 11],
          weekday: [win(10, 0, 18, 30, 19, 0)],
          saturday: [win(10, 0, 18, 30, 19, 0)],
          sunday: [win(10, 0, 18, 30, 19, 0)],
          holiday: [win(10, 0, 18, 30, 19, 0)],
          note: "3〜11月は19:00閉館",
        },
        {
          months: [12, 1, 2],
          weekday: [win(10, 0, 18, 0, 18, 30)],
          saturday: [win(10, 0, 18, 0, 18, 30)],
          sunday: [win(10, 0, 18, 0, 18, 30)],
          holiday: [win(10, 0, 18, 0, 18, 30)],
          note: "12〜2月は18:30閉館（最終受付18:00）",
        },
      ],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "3〜11月 10:00〜19:00 / 12〜2月 10:00〜18:30",
      lastEntryText: "通常18:30 / 12〜2月 18:00",
      holidayNote: "原則無休（4月・12月に各1回点検休館あり）",
      irregularNote: null,
    },
  },
  "62": {
    id: "anazawa-matsutake-sansou",
    expectedRegistryName: "信州 穴沢温泉松茸山荘 別館",
    displayName: "信州 穴沢温泉 松茸山荘 別館",
    accessCategory: "public_drop_in",
    accessNote:
      "四賀地区の山あいにある日帰り入浴可能な温泉施設。松茸シーズン（秋）等は日帰り受付時間が変更される場合があります。",
    facilityType: "day_onsen",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "公式サイトで最新料金をご確認ください",
    phone: "0263-64-2102",
    officialUrl: "https://matsutake-sansou.jp/",
    lat: 36.332244,
    lng: 138.002098,
    recommendedRank: 18,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(10, 0, 19, 30, 20, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "10:00〜20:00（通常期目安）",
      lastEntryText: "19:30目安（季節により変更あり）",
      holidayNote: "不定休（月1回程度・秋期等は受付短縮の場合あり要確認）",
      irregularNote: null,
    },
  },
  "84": {
    id: "norikura-yukemurikan",
    expectedRegistryName: "乗鞍高原 湯けむり館",
    displayName: "乗鞍高原 湯けむり館",
    accessCategory: "public_drop_in",
    accessNote:
      "乗鞍高原の中心にある通年営業の日帰り温泉。白濁した天然硫黄泉を冬季も雪見露天風呂で楽しめます。",
    facilityType: "day_onsen",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "大人（中学生以上）800円 / 小人（3歳以上）400円",
    phone: "0263-93-2589",
    officialUrl: "https://yukemurikan-norikura.com/",
    lat: 36.121269,
    lng: 137.626487,
    recommendedRank: 19,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(9, 30, 20, 0, 21, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [{ nth: 3, weekday: 2, shiftIfHoliday: "none" }],
      yearEndClosed: null,
      summaryText: "9:30〜21:00（冬季も通常営業）",
      lastEntryText: "20:00",
      holidayNote:
        "火曜休館あり（原則第3火曜目安・季節により変則のため要確認）",
      irregularNote: null,
    },
  },
  "106": {
    id: "woody-mock",
    expectedRegistryName: "ウッディ・もっく",
    displayName: "渋沢温泉 ウッディ・もっく（もっくの湯）",
    accessCategory: "public_drop_in",
    accessNote:
      "奈川高原のキャンプ場併設の日帰り天然温泉。木造の落ち着いた浴室が特徴で、松本市民割引もあります。",
    facilityType: "day_onsen",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "大人（中学生以上）550円 / 子ども（3歳以上）350円",
    phone: "0263-79-2216",
    officialUrl: "https://mock.furusatonagawa.com/",
    lat: 36.042502,
    lng: 137.701223,
    recommendedRank: 20,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 4, 5, 6],
      defaultSessions: [win(13, 0, 18, 0, 18, 30)],
      daySessions: {
        "0": [win(11, 0, 18, 30, 19, 0)],
        "6": [win(11, 0, 18, 30, 19, 0)],
        holiday: [win(11, 0, 18, 30, 19, 0)],
      },
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "平日 13:00〜18:30 / 土日祝 11:00〜19:00",
      lastEntryText: "平日 18:00 / 土日祝 18:30",
      holidayNote: "毎週水曜日（時期により火曜休みや時間変更あり）",
      irregularNote: null,
    },
  },
  "39": {
    id: "sawando-azusa-kohan",
    expectedRegistryName: "梓湖畔の湯",
    displayName: "さわんど温泉 梓湖畔の湯",
    accessCategory: "public_drop_in",
    accessNote:
      "上高地マイカー規制の玄関口・沢渡（さわんど）にある日帰り温泉。冬期（11月中旬〜4月中旬）は原則土日祝・年末年始のみの営業となります。",
    facilityType: "day_onsen",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "現地・観光案内で最新料金をご確認ください",
    phone: "0263-93-2539",
    officialUrl: OFFICIAL_BATH_LINKS.visitMatsumotoOnsen,
    lat: 36.163937,
    lng: 137.660794,
    recommendedRank: 21,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(10, 0, 18, 0, 18, 30)],
      seasonalOverrides: [
        {
          startMmdd: "04-15",
          endMmdd: "11-15",
          weekday: [win(10, 0, 18, 0, 18, 30)],
          saturday: [win(10, 0, 18, 0, 18, 30)],
          sunday: [win(10, 0, 18, 0, 18, 30)],
          holiday: [win(10, 0, 18, 0, 18, 30)],
          note: "グリーンシーズン営業",
        },
        {
          startMmdd: "11-16",
          endMmdd: "04-14",
          openDaysOverride: [0, 6],
          openOnHolidaysOverride: true,
          weekday: [win(11, 0, 17, 30, 18, 0)],
          saturday: [win(11, 0, 17, 30, 18, 0)],
          sunday: [win(11, 0, 17, 30, 18, 0)],
          holiday: [win(11, 0, 17, 30, 18, 0)],
          note: "11月中旬〜4月中旬は土日祝・年末年始のみ営業（平日休館）",
        },
      ],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "4月中旬〜11月中旬 10:00〜18:30 / 冬期土日祝 11:00〜18:00",
      lastEntryText: "閉館30分前目安",
      holidayNote:
        "4月中旬〜11月中旬は不定休 / 11月中旬〜4月中旬は平日休館（土日祝・年末年始のみ営業）",
      irregularNote: null,
    },
  },
  "113": {
    id: "shirahone-notenburo",
    expectedRegistryName: "白骨温泉公共野天風呂",
    displayName: "白骨温泉 公共野天風呂",
    accessCategory: "public_drop_in",
    accessNote:
      "湯川渓谷沿いに設けられた白骨温泉の共同露天風呂。例年11月下旬〜4月下旬は冬季閉鎖となります。",
    facilityType: "day_onsen",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "大人700円 / 小学生以下400円",
    phone: "0263-93-2119",
    officialUrl: OFFICIAL_BATH_LINKS.shirahone,
    lat: 36.152228,
    lng: 137.627419,
    recommendedRank: 22,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 5, 6],
      defaultSessions: [win(10, 0, 15, 30, 16, 0)],
      daySessions: {
        "0": [win(9, 0, 16, 30, 17, 0)],
        "6": [win(9, 0, 16, 30, 17, 0)],
        holiday: [win(9, 0, 16, 30, 17, 0)],
      },
      seasonalOverrides: [],
      seasonalClosure: {
        startMmdd: "11-25",
        endMmdd: "04-25",
        label: "例年11月下旬〜4月下旬頃は冬季閉鎖",
      },
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "平日 10:00〜16:00 / 土日祝 9:00〜17:00",
      lastEntryText: "閉館30分前目安",
      holidayNote: "毎週木曜日・冬季閉鎖（11月下旬〜4月下旬頃）",
      irregularNote: null,
    },
  },
  "29": {
    id: "shirahone-baikoan",
    expectedRegistryName: "煤香庵",
    displayName: "白骨温泉 煤香庵（湯元齋藤旅館 野天風呂）",
    accessCategory: "public_drop_in",
    accessNote:
      "白骨温泉「湯元齋藤旅館」敷地内の日帰り野天風呂。冬季（11月下旬〜4月末頃）は休止となります。",
    facilityType: "day_onsen",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "大人800円 / 小人400円",
    phone: "0263-93-2311",
    officialUrl: "https://www.shirahone.net/",
    lat: 36.152539,
    lng: 137.626814,
    recommendedRank: 23,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 4, 5, 6],
      defaultSessions: [win(10, 0, 17, 30, 18, 0)],
      seasonalOverrides: [],
      seasonalClosure: {
        startMmdd: "11-25",
        endMmdd: "04-25",
        label: "例年11月下旬〜4月末頃は冬季休業",
      },
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "10:00〜18:00",
      lastEntryText: "17:30",
      holidayNote: "毎週水曜日（不定休あり）・冬季休業（11月下旬〜4月末頃）",
      irregularNote: null,
    },
  },
  "38": {
    id: "norikura-seseragi",
    expectedRegistryName: "乗鞍高原せせらぎの湯",
    displayName: "乗鞍高原 せせらぎの湯",
    accessCategory: "public_drop_in",
    accessNote:
      "乗鞍高原の木立の中にある無料（寸志）の共同野天風呂。例年11月中旬〜4月末頃は冬季完全閉鎖となります。",
    facilityType: "communal_bath",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "無料（清掃協力の寸志箱あり）",
    phone: "0263-93-2147",
    officialUrl: OFFICIAL_BATH_LINKS.norikura,
    lat: 36.121592,
    lng: 137.627411,
    recommendedRank: 24,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(9, 0, 16, 30, 17, 0)],
      seasonalOverrides: [
        {
          months: [11],
          weekday: [win(9, 0, 16, 0, 16, 30)],
          saturday: [win(9, 0, 16, 0, 16, 30)],
          sunday: [win(9, 0, 16, 0, 16, 30)],
          holiday: [win(9, 0, 16, 0, 16, 30)],
          note: "11月は16:30閉鎖",
        },
      ],
      seasonalClosure: {
        startMmdd: "11-16",
        endMmdd: "04-28",
        label: "例年11月中旬〜4月末頃は冬季閉鎖",
      },
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "4月末〜11月中旬 9:00〜17:00（11月は〜16:30）",
      lastEntryText: "閉鎖30分前目安",
      holidayNote: "開山期間中無休・冬季閉鎖（11月中旬〜4月末頃）",
      irregularNote: null,
    },
  },
  "82": {
    id: "kamikochi-konashi-no-yu",
    expectedRegistryName: "上高地 小梨の湯",
    displayName: "上高地 小梨の湯（小梨平キャンプ場）",
    accessCategory: "public_drop_in",
    accessNote:
      "河童橋から徒歩約5分の小梨平キャンプ場内浴場。外来日帰り利用は14:00〜16:00の短時間枠で、上高地閉山期（冬季）は閉鎖します。",
    facilityType: "public_facility",
    waterType: "non_onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "現地受付で最新料金をご確認ください",
    phone: "0263-95-2321",
    officialUrl: "https://www.nihonalpskankou.com/",
    lat: 36.250582,
    lng: 137.640381,
    recommendedRank: 25,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(14, 0, 15, 30, 16, 0)],
      seasonalOverrides: [],
      seasonalClosure: {
        startMmdd: "11-16",
        endMmdd: "04-26",
        label: "上高地閉山期間（11月中旬〜4月下旬）は冬季閉鎖",
      },
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "4月下旬〜11月中旬 日帰り 14:00〜16:00",
      lastEntryText: "15:30頃目安",
      holidayNote: "営業期間中無休・冬季閉鎖（11月中旬〜4月下旬）",
      irregularNote: "宿泊者・キャンプ利用者は別の利用時間帯があります。",
    },
  },

  // === B. 日帰り入浴ありの温泉宿（day_use_inn: 6件） ===
  "30": {
    id: "shirahone-awanoyu",
    expectedRegistryName: "泡の湯旅館",
    displayName: "白骨温泉 泡の湯旅館",
    accessCategory: "day_use_inn",
    accessNote:
      "混浴大野天風呂で知られる白骨温泉の老舗旅館。日帰り入浴は10:30〜14:00（受付13:30）で、悪天候・燃料事情等で休業となる場合があるため当日の電話確認が必須です。",
    facilityType: "onsen_inn",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "公式サイトで最新料金をご確認ください",
    phone: "0263-93-2101",
    officialUrl: "https://www.awanoyu-ryokan.com/",
    lat: 36.146288,
    lng: 137.623925,
    recommendedRank: 31,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 5, 6],
      defaultSessions: [win(10, 30, 13, 30, 14, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "日帰り 10:30〜14:00",
      lastEntryText: "13:30",
      holidayNote: "水・木曜日を中心に不定休あり（訪問当日の電話確認必須）",
      irregularNote: "冬季も日帰り実施日がありますが、営業カレンダーを要確認。",
    },
  },
  "58": {
    id: "qkamura-norikura",
    expectedRegistryName: "休暇村乗鞍高原安曇乗鞍温泉館",
    displayName: "休暇村乗鞍高原（天峰の湯）",
    accessCategory: "day_use_inn",
    accessNote:
      "乗鞍高原の宿に併設された天然温泉。12:00〜16:00（最終受付15:00）の時間帯で日帰り入浴を受け付けています。",
    facilityType: "onsen_inn",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "大人800円 / 4歳以上400円（2027年4月〜改定予定）",
    phone: "0263-93-2304",
    officialUrl: "https://www.qkamura.or.jp/norikura/",
    lat: 36.113927,
    lng: 137.613246,
    recommendedRank: 32,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(12, 0, 15, 0, 16, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "日帰り 12:00〜16:00",
      lastEntryText: "15:00",
      holidayNote: "不定休（メンテナンスや貸切等で休止の場合あり）",
      irregularNote: null,
    },
  },
  "35": {
    id: "nakanoyu-onsen",
    expectedRegistryName: "中の湯温泉旅館",
    accessCategory: "day_use_inn",
    accessNote:
      "安房峠・上高地入口（釜トンネル手前）にある通年営業の秘湯の宿。登山・ドライブ帰りの日帰り入浴を受け入れています。",
    facilityType: "onsen_inn",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "大人1,000円 / 小人500円（プラン等により変動あり）",
    phone: "0263-95-2407",
    officialUrl: "https://nakanoyu-onsen.jp/",
    lat: 36.205237,
    lng: 137.600554,
    recommendedRank: 33,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(12, 0, 16, 30, 17, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "日帰り 12:00〜17:00（混雑時は〜15:00）",
      lastEntryText: "16:30目安（混雑時制限あり）",
      holidayNote: "通年営業（清掃・混雑状況により日帰り制限あり）",
      irregularNote: null,
    },
  },
  "74": {
    id: "sakamaki-onsen",
    expectedRegistryName: "坂巻温泉旅館",
    accessCategory: "day_use_inn",
    accessNote:
      "国道158号沿いの渓谷に佇む一軒宿。9時から露天風呂、11時から内湯の日帰り入浴が可能です。",
    facilityType: "onsen_inn",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "大人600円 / 小学生以下300円",
    phone: "0263-95-2453",
    officialUrl: "http://sakamaki.yumori.jp/",
    lat: 36.197882,
    lng: 137.614368,
    recommendedRank: 34,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(9, 0, 15, 30, 16, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "日帰り 9:00〜16:00（内湯は11:00〜）",
      lastEntryText: "15:30目安",
      holidayNote: "不定休（事前確認推奨）",
      irregularNote: null,
    },
  },
  "31": {
    id: "kamikochi-onsen-hotel",
    expectedRegistryName: "（株）上高地温泉ホテル",
    displayName: "上高地温泉ホテル",
    accessCategory: "day_use_inn",
    accessNote:
      "上高地・梓川沿いの天然温泉。午前・午後の2部制で日帰り入浴を実施しています（冬季は上高地閉山に伴い休業）。",
    facilityType: "onsen_inn",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "大人（中学生以上）1,000円 / 3歳〜小学生500円",
    phone: "0263-95-2311",
    officialUrl: "http://www.kamikouchi-onsen-spa.com/",
    lat: 36.246145,
    lng: 137.624975,
    recommendedRank: 35,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 3, 4, 5, 6],
      defaultSessions: [win(7, 0, 9, 0, 9, 30), win(12, 0, 15, 0, 15, 30)],
      seasonalOverrides: [],
      seasonalClosure: {
        startMmdd: "11-16",
        endMmdd: "04-26",
        label: "上高地閉山期間（11月中旬〜4月下旬）は冬季休業",
      },
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "4月下旬〜11月中旬 7:00〜9:30 / 12:00〜15:30",
      lastEntryText: "午前9:00 / 午後15:00",
      holidayNote: "不定休・冬季休業（11月中旬〜4月下旬）",
      irregularNote: "時期により午後の開始が12:30となる場合があります。",
    },
  },
  "42": {
    id: "nagawa-fuki-no-yu",
    expectedRegistryName: "奈川温泉富喜の湯",
    displayName: "奈川温泉 富喜の湯",
    accessCategory: "day_use_inn",
    accessNote:
      "奈川の黒川沿いにある一軒宿。日帰り入浴は休止または宿泊者専用となる時期があるため、訪問前の事前確認が必須です。",
    facilityType: "onsen_inn",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "要事前確認",
    phone: "0263-79-2031",
    officialUrl: "https://furusatonagawa.com/",
    lat: 36.083138,
    lng: 137.660739,
    recommendedRank: 36,
    schedule: {
      kind: "check_official",
      summaryText: "日帰り入浴は流動的（11:00〜15:00頃・休止期あり要事前確認）",
      lastEntryText: null,
      holidayNote:
        "不定休（宿泊専用期間があるため訪問前に電話等でご確認ください）",
      irregularNote: null,
    },
  },

  // === C. 予約制サウナ・貸切温泉・陶板浴等（reservation_required: 5件） ===
  "117": {
    id: "sauna-satoyama",
    expectedRegistryName: "サウナ里山",
    displayName: "サウナ里山（アウトドアフィールド松本）",
    accessCategory: "reservation_required",
    accessNote:
      "まつもと里山キャンプ場内にある薪ストーブサウナ施設（貸切・相部屋）。90分枠の予約制です。",
    facilityType: "sauna_retreat",
    waterType: "sauna_specialty",
    hasSauna: true,
    hasRotenburo: false,
    feeSummary: "予約プランにより異なります（公式サイト要確認）",
    phone: "090-4412-4173",
    officialUrl: "https://outdoorfield-matsumoto.jp/",
    lat: 36.198887,
    lng: 137.985504,
    recommendedRank: 41,
    schedule: {
      kind: "check_official",
      summaryText: "予約制 90分枠（10:00〜17:00台）",
      lastEntryText: null,
      holidayNote: "事前予約制（前日・当日はサウナ専用電話へ要問合せ）",
      irregularNote: null,
    },
  },
  "118": {
    id: "cafe-retreat-pure",
    expectedRegistryName: "Cafe ＆ Retreat ぴゅあ",
    displayName: "Cafe & Retreat ぴゅあ（椿の湯）",
    accessCategory: "reservation_required",
    accessNote:
      "浅間温泉の旧旅館をリノベーションしたカフェ＆リトリート施設。源泉掛け流しの貸切温泉や岩盤浴（事前予約推奨）を楽しめます。",
    facilityType: "sauna_retreat",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "貸切プラン・岩盤浴等は公式サイトをご確認ください",
    phone: "0263-74-9366",
    officialUrl: "https://eutopia.spa/",
    lat: 36.262661,
    lng: 137.992218,
    recommendedRank: 42,
    schedule: {
      kind: "structured",
      openDays: [0, 1, 2, 5, 6],
      defaultSessions: [win(10, 0, 16, 0, 17, 0)],
      seasonalOverrides: [],
      seasonalClosure: null,
      holidayRule: "none",
      nthWeekdaysClosed: [],
      yearEndClosed: null,
      summaryText: "金〜火 10:00〜17:00（カフェは11:00〜16:00）",
      lastEntryText: "16:00目安（貸切枠は事前予約推奨）",
      holidayNote: "毎週水曜日・木曜日",
      irregularNote:
        "貸切温泉・岩盤浴は事前に予約サイトや電話でご確認ください。",
    },
  },
  "123": {
    id: "sennen-no-yu-katakuri",
    expectedRegistryName: "千年の湯 かたくりの花",
    displayName: "千年の湯 かたくりの花（あさま茶房）",
    accessCategory: "reservation_required",
    accessNote:
      "浅間温泉の完全1棟貸切の天然温泉施設。金・土・日のみ営業で完全電話予約制です。",
    facilityType: "sauna_retreat",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "貸切料金は公式サイトをご確認ください",
    phone: "090-4543-7716",
    officialUrl: "https://asama-sabou.jp/",
    lat: 36.264523,
    lng: 137.99176,
    recommendedRank: 43,
    schedule: {
      kind: "check_official",
      summaryText: "金・土・日 10:00〜17:00（完全電話予約制）",
      lastEntryText: null,
      holidayNote: "月〜木曜および毎月第4週定休・電話予約のみ",
      irregularNote: null,
    },
  },
  "116": {
    id: "tanpopo-no-watage",
    expectedRegistryName: "抗酸化陶板浴たんぽぽのわたげ",
    displayName: "抗酸化陶板浴 たんぽぽのわたげ",
    accessCategory: "reservation_required",
    accessNote:
      "浅間温泉エリアにある陶板浴（温浴リラクゼーション）施設。利用時間・予約要否は事前に施設へご確認ください。",
    facilityType: "sauna_retreat",
    waterType: "sauna_specialty",
    hasSauna: true,
    hasRotenburo: false,
    feeSummary: "利用条件・料金は施設へご確認ください",
    phone: null,
    officialUrl: null,
    lat: 36.264618,
    lng: 137.988358,
    recommendedRank: 44,
    schedule: {
      kind: "check_official",
      summaryText: "営業時間・予約要否は施設へ直接ご確認ください",
      lastEntryText: null,
      holidayNote: null,
      irregularNote: null,
    },
  },
  "115": {
    id: "iyashidokoro-kikyo",
    expectedRegistryName: "癒し処 桔梗",
    displayName: "癒し処 桔梗",
    accessCategory: "reservation_required",
    accessNote:
      "庄内1丁目にある温浴・リラクゼーション関連許可施設。営業状況・利用条件は事前にご確認ください。",
    facilityType: "sauna_retreat",
    waterType: "sauna_specialty",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "利用条件・料金は施設へご確認ください",
    phone: null,
    officialUrl: null,
    lat: 36.225273,
    lng: 137.969879,
    recommendedRank: 45,
    schedule: {
      kind: "check_official",
      summaryText: "営業時間・予約要否は施設へ直接ご確認ください",
      lastEntryText: null,
      holidayNote: null,
      irregularNote: null,
    },
  },

  // === D. 地元・組合員専用 共同浴場（local_only: 12件） ===
  "1": makeLocalOnlySpec(
    "asama-mutsumi-no-yu",
    "睦の湯",
    36.263172,
    137.989868,
    51,
  ),
  "7": makeLocalOnlySpec(
    "asama-misato-no-yu",
    "美郷の湯",
    36.258778,
    137.987381,
    52,
  ),
  "8": makeLocalOnlySpec(
    "asama-yanagi-no-yu",
    "旧松下藩士共有柳の湯",
    36.258778,
    137.987381,
    53,
  ),
  "9": makeLocalOnlySpec(
    "asama-yakushi-no-yu",
    "薬師の湯",
    36.258778,
    137.987381,
    54,
  ),
  "10": makeLocalOnlySpec(
    "asama-kiri-no-yu",
    "桐の湯",
    36.263649,
    137.992493,
    55,
  ),
  "11": makeLocalOnlySpec(
    "asama-tomimoto-no-yu",
    "冨本の湯",
    36.264725,
    137.991745,
    56,
  ),
  "12": makeLocalOnlySpec(
    "asama-taki-no-yu",
    "滝の湯",
    36.265297,
    137.992233,
    57,
  ),
  "13": makeLocalOnlySpec(
    "asama-hori-no-yu",
    "堀の湯",
    36.258778,
    137.987381,
    58,
  ),
  "14": makeLocalOnlySpec(
    "asama-yokote-goza-no-yu",
    "横手御座の湯",
    36.265629,
    137.990372,
    59,
  ),
  "22": makeLocalOnlySpec(
    "asama-tazuru-no-yu",
    "田鶴の湯",
    36.261219,
    137.985733,
    60,
  ),
  "89": makeLocalOnlySpec(
    "asama-kita-senki-no-yu",
    "北せんきの湯",
    36.263721,
    137.991806,
    61,
    "過去には外来開放されていた時期もありましたが、現在は組合員・地元専用です。",
  ),
  "125": makeLocalOnlySpec(
    "asama-masago-no-yu",
    "まさごの湯",
    36.262676,
    137.992294,
    62,
    "地域住民・湯仲間の共同浴場ですが、松本十帖等の提携宿泊プランで利用案内される場合があります。",
  ),

  // === E. 対象者限定（eligible_only: 1件） ===
  "110": {
    id: "nanbu-fukushi-buro",
    expectedRegistryName: "松本市南部老人福祉センター福祉風呂",
    displayName: "松本市南部老人福祉センター 福祉風呂（プラチナセンター）",
    accessCategory: "eligible_only",
    accessNote:
      "松本市内在住の60歳以上の方が無料で利用できる福祉浴場です（一般観光客や対象外の方の入浴はできません）。入浴時間は毎週月・木曜 12:00〜16:00です。",
    facilityType: "welfare_bath",
    waterType: "non_onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "無料（※松本市内在住60歳以上限定）",
    phone: "0263-25-3133",
    officialUrl: "https://www.syakyo-matsumoto.or.jp/",
    lat: 36.207317,
    lng: 137.967438,
    recommendedRank: 63,
    schedule: {
      kind: "not_public",
      summaryText:
        "対象者限定（松本市内在住60歳以上）：毎週月・木 12:00〜16:00",
      lastEntryText: null,
      holidayNote: "土日祝・12/29〜1/3休館（施設開館は月〜金 9:00〜17:00）",
      irregularNote: null,
    },
  },

  // === F. 会員制・施設利用者限定（members_only: 12件） ===
  "18": makeMembersOnlySpec(
    "central-fitness-matsumoto",
    "セントラルフィットネスクラブ松本",
    "会員制スポーツクラブ内の浴場・サウナです（会員・ビジター規約対象者向け）。",
    65,
    true,
  ),
  "47": makeMembersOnlySpec(
    "sam-matsumoto",
    "スポ－ツネットワ－ク・サム松本",
    "会員制フィットネスクラブ内の浴場施設です。",
    66,
    true,
  ),
  "60": makeMembersOnlySpec(
    "sam-ishishiba",
    "スポーツネットワークＳＡＭ石芝",
    "会員制フィットネスクラブ内の浴場施設です。",
    67,
    true,
  ),
  "61": makeMembersOnlySpec(
    "renaissance-matsumoto",
    "スポーツクラブルネサンス 松本",
    "会員制スポーツクラブ内の浴場・サウナ施設です。",
    68,
    true,
  ),
  "65": makeMembersOnlySpec(
    "holiday-sports-matsumoto",
    "ホリデイスポーツクラブ松本",
    "会員制スポーツクラブ内の浴場・サウナ施設です。",
    69,
    true,
  ),
  "95": makeMembersOnlySpec(
    "joyfit-matsumoto-shonai",
    "ＪＯＹＦＩＴ 松本庄内",
    "会員制フィットネスクラブ内のシャワー・浴場関連設備です。",
    70,
    false,
  ),
  "16": makeMembersOnlySpec(
    "matsumoto-asama-country",
    "松本浅間カントリー",
    "ゴルフ場内のクラブハウス浴場です（プレー利用者向け）。",
    71,
    false,
  ),
  "21": makeMembersOnlySpec(
    "matsumoto-country-bath",
    "松本カントリー浴場",
    "ゴルフ場内のクラブハウス浴場です（プレー利用者向け）。",
    72,
    false,
  ),
  "112": makeMembersOnlySpec(
    "misuzuko-morinokuni-camp",
    "松本市美鈴湖もりの国オートキャンプ場",
    "オートキャンプ場内の施設利用者向けシャワー・浴場設備です。",
    73,
    false,
  ),
  "88": makeMembersOnlySpec(
    "pleata-matsumoto",
    "プリータ松本",
    "フィットネス・スタジオ等の施設利用者向け温浴許可施設です。",
    74,
    false,
  ),
  "90": makeMembersOnlySpec(
    "hot-studio-en",
    "HOTスタジオえん",
    "ホットスタジオ・会員制レッスン施設内の許可設備です。",
    75,
    false,
  ),
  "97": makeMembersOnlySpec(
    "naturauni",
    "naturauni",
    "サロン・会員制施設等の利用者向け許可設備です。",
    76,
    false,
  ),

  // === G. 宿泊者専用ホテル等（guests_only: 6件） ===
  "73": makeGuestsOnlySpec(
    "dormy-inn-matsumoto",
    "天然温泉 梓の湯 ドーミーイン松本",
    "天然温泉 梓の湯 ドーミーイン松本",
    "松本駅近くのビジネスホテル大浴場。原則宿泊者専用で、一般の日帰り入浴は受け付けていません。",
    "onsen",
    true,
    36.231033,
    137.968689,
    78,
  ),
  "105": makeGuestsOnlySpec(
    "tabino-hotel-lit-matsumoto",
    "たびのホテルlit松本",
    undefined,
    "松本駅前の宿泊施設内大浴場（原則宿泊者専用）。",
    "non_onsen",
    false,
    36.229298,
    137.967133,
    79,
  ),
  "107": makeGuestsOnlySpec(
    "onyado-nono-matsumoto",
    "天然温泉 あづみの湯 御宿 野乃松本",
    "天然温泉 あづみの湯 御宿 野乃松本",
    "松本駅近くの和風ビジネスホテル天然温泉大浴場。原則宿泊者専用で、一般の日帰り入浴は受け付けていません。",
    "onsen",
    true,
    36.227718,
    137.966797,
    80,
  ),
  "102": makeGuestsOnlySpec(
    "tabi-shiro",
    "tabi-shiro",
    undefined,
    "松本市城西のゲストハウス施設内浴場（宿泊者向け）。",
    "non_onsen",
    false,
    null,
    null,
    81,
  ),
  "108": makeGuestsOnlySpec(
    "guesthouse-shimashima",
    "ゲストハウスしましま",
    undefined,
    "波田のゲストハウス施設内浴場（宿泊者向け）。",
    "non_onsen",
    false,
    null,
    null,
    82,
  ),
  "119": makeGuestsOnlySpec(
    "miyamaso-asama",
    "公立学校共済組合浅間温泉保養所みやま荘",
    undefined,
    "浅間温泉の共済組合保養所。宿泊・組合員利用が中心のため、一般外来可否は施設へご確認ください。",
    "onsen",
    false,
    null,
    null,
    83,
  ),

  // === H. 個別補足が必要な宿泊施設・営業状況要確認施設 ===
  "122": {
    id: "sawando-komorebi-no-yu",
    expectedRegistryName: "こもれびの湯",
    displayName: "こもれびの湯（安曇・沢渡）",
    accessCategory: "check_lodging_or_status",
    accessNote:
      "松本市安曇（沢渡エリア）の許可台帳に掲載されていますが、閉館情報があるため訪問前に最新の営業状況をご確認ください（近隣では「梓湖畔の湯」が日帰り営業しています）。",
    facilityType: "lodging_other",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: false,
    feeSummary: "営業状況要確認",
    phone: null,
    officialUrl: null,
    lat: null,
    lng: null,
    recommendedRank: 95,
    schedule: {
      kind: "check_official",
      summaryText: "閉館情報あり・最新の営業状況を要確認",
      lastEntryText: null,
      holidayNote: "営業終了・休業の可能性があるため事前にご確認ください",
      irregularNote: null,
    },
  },
  "23": {
    id: "matsumoto-jujo",
    expectedRegistryName: "松本十帖",
    accessCategory: "check_lodging_or_status",
    accessNote:
      "浅間温泉の老舗「小柳」を再生した複合宿泊施設。宿泊者向け「小柳之湯」などがあり、日帰りプラン実施有無は公式サイトをご確認ください。",
    facilityType: "lodging_other",
    waterType: "onsen",
    hasSauna: false,
    hasRotenburo: true,
    feeSummary: "宿泊者向け（日帰りプラン有無は公式要確認）",
    phone: null,
    officialUrl: "https://matsumotojujo.com/",
    lat: 36.263218,
    lng: 137.991302,
    recommendedRank: 85,
    schedule: {
      kind: "check_official",
      summaryText: "宿泊施設（日帰り利用条件は公式サイトをご確認ください）",
      lastEntryText: null,
      holidayNote: null,
      irregularNote: null,
    },
  },
};
