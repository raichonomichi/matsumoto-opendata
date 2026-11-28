import type { GtfsFeedId, PresetCategory } from "../../src/lib/last-bus-schema";

export const MATSUMOTO_STATION_STOP_NAMES = [
  "松本バスターミナル",
  "松本駅お城口",
  "松本駅アルプス口",
  "バスターミナル北",
] as const;

export const FEED_LABELS: Record<GtfsFeedId, string> = {
  guruttomatsumotobus1: "松本駅・BT発着",
  guruttomatsumotobus2: "地域連携バス",
};

export const FEED_FULL_NAMES: Record<GtfsFeedId, string> = {
  guruttomatsumotobus1: "松本駅・バスターミナル発着バス",
  guruttomatsumotobus2: "地域連携バス",
};

export interface PresetSpec {
  id: string;
  label: string;
  shortLabel: string;
  category: PresetCategory;
  description: string;
  stopNames: readonly string[];
  originOnly: boolean;
}

export const PRESET_SPECS: PresetSpec[] = [
  {
    id: "matsumoto-station-area",
    label: "松本駅エリア（全26路線）",
    shortLabel: "松本駅エリア",
    category: "station",
    description:
      "松本バスターミナル・松本駅お城口・アルプス口・バスターミナル北から始発出発する全路線を表示します。",
    stopNames: MATSUMOTO_STATION_STOP_NAMES,
    originOnly: true,
  },
  {
    id: "matsumoto-castle",
    label: "松本城・市役所前",
    shortLabel: "松本城・市役所前",
    category: "sightseeing",
    description:
      "松本城周辺・市役所前から各方面（浅間温泉・美ヶ原温泉・松本駅方面など）への最終バスを確認できます。",
    stopNames: ["松本城・市役所前"],
    originOnly: false,
  },
  {
    id: "shinshu-univ",
    label: "信州大学前",
    shortLabel: "信州大学前",
    category: "campus_hospital",
    description:
      "信州大学松本キャンパス周辺から松本駅・浅間温泉・岡田方面への終バスをまとめて確認できます。",
    stopNames: ["信州大学前"],
    originOnly: false,
  },
  {
    id: "shindai-hospital",
    label: "信大病院玄関前",
    shortLabel: "信大病院玄関前",
    category: "campus_hospital",
    description:
      "信州大学医学部附属病院から松本駅方面などへの最終バスを確認できます。",
    stopNames: ["信大病院玄関前"],
    originOnly: false,
  },
  {
    id: "asama-onsen",
    label: "浅間温泉",
    shortLabel: "浅間温泉",
    category: "sightseeing",
    description: "浅間温泉街から松本駅方面への最終バスを確認できます。",
    stopNames: ["浅間温泉"],
    originOnly: false,
  },
  {
    id: "utsukushigahara-onsen",
    label: "美ヶ原温泉",
    shortLabel: "美ヶ原温泉",
    category: "sightseeing",
    description: "美ヶ原温泉から松本駅方面への最終バスを確認できます。",
    stopNames: ["美ヶ原温泉"],
    originOnly: false,
  },
  {
    id: "matsumoto-airport",
    label: "信州まつもと空港",
    shortLabel: "信州まつもと空港",
    category: "sightseeing",
    description: "信州まつもと空港から松本駅方面への最終バスを確認できます。",
    stopNames: ["信州まつもと空港"],
    originOnly: false,
  },
  {
    id: "minami-matsumoto",
    label: "南松本駅",
    shortLabel: "南松本駅",
    category: "suburb_hub",
    description: "JR南松本駅から山形・南部循環方面への最終バスを確認できます。",
    stopNames: ["南松本駅"],
    originOnly: false,
  },
  {
    id: "murai-station",
    label: "村井駅",
    shortLabel: "村井駅",
    category: "suburb_hub",
    description:
      "JR村井駅から松本駅・山形・寿台方面への最終バスを確認できます。",
    stopNames: ["村井駅"],
    originOnly: false,
  },
  {
    id: "hata-station",
    label: "波田駅",
    shortLabel: "波田駅",
    category: "suburb_hub",
    description:
      "上高地線 波田駅から梓川・朝日・波田循環方面への最終バスを確認できます。",
    stopNames: ["波田駅"],
    originOnly: false,
  },
  {
    id: "icity21",
    label: "アイシティ２１",
    shortLabel: "アイシティ２１",
    category: "suburb_hub",
    description:
      "山形村アイシティ２１から村井駅・朝日・波田方面への最終バスを確認できます。",
    stopNames: ["アイシティ２１"],
    originOnly: false,
  },
  {
    id: "shiga-branch",
    label: "四賀支所",
    shortLabel: "四賀支所",
    category: "suburb_hub",
    description:
      "四賀支所から松本駅・明科駅・四賀地区各地への最終バスを確認できます。",
    stopNames: ["四賀支所"],
    originOnly: false,
  },
  {
    id: "shinshimashima",
    label: "新島々",
    shortLabel: "新島々",
    category: "suburb_hub",
    description:
      "新島々から奈川・安曇方面への地域連携バス最終便を確認できます。",
    stopNames: ["新島々"],
    originOnly: false,
  },
];

export const OFFICIAL_BUS_LINKS = {
  matsumotoBusInfo:
    "https://www.city.matsumoto.nagano.jp/soshiki/222/3237.html",
  matsumotoGtfsPage:
    "https://www.city.matsumoto.nagano.jp/soshiki/222/88191.html",
  gtfsRepository: "https://gtfs-data.jp/",
  alpicoLocalMatsumoto: "https://www.alpico.co.jp/traffic/local/matsumoto/",
  alpicoKamikochi: "https://www.alpico.co.jp/traffic/local/kamikochi/",
  alpicoRail: "https://www.alpico.co.jp/traffic/rail/",
} as const;
