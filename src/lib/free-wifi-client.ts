import type { OpenEvaluation } from "./free-wifi-schedule";
import type {
  AccessPolicy,
  FacilitySchedule,
  PowerAvailability,
  WifiAreaGroup,
  WifiPurpose,
  WifiSpot,
} from "./free-wifi-schema";

export type WifiTabKey = WifiPurpose | "all";

export interface WifiFilterableSpot {
  id: string;
  purposes: WifiPurpose[];
  areaGroup: WifiAreaGroup;
  district: string;
  ssid: string | null;
  accessPolicy: AccessPolicy;
  powerAvailability: PowerAvailability;
  openLate: boolean;
  openMonday: boolean;
  openWeekend: boolean;
  apCount: number;
  recommendedRank: number;
  latestCloseMinutes: number | null;
  lat: number;
  lng: number;
  schedule: FacilitySchedule;
  searchText: string;
}

export interface WifiFilterCriteria {
  activeTab: WifiTabKey;
  selectedArea: "all" | WifiAreaGroup;
  district: string;
  ssid: string;
  keyword: string;
  activeQuickFilters: ReadonlySet<string>;
}

/**
 * Wi-Fiスポットのフリーワード検索用テキストを組み立てる。
 */
export function buildWifiSearchText(spot: WifiSpot, areaLabel: string): string {
  return [
    spot.name,
    spot.facilityName,
    spot.category,
    spot.address,
    spot.district,
    areaLabel,
    spot.ssid ?? "",
    spot.studyWorkNote ?? "",
    spot.powerNote ?? "",
    spot.complexNote ?? "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * SSR時の初期ステータスバッジ表示文言・クラスを返す。
 */
export function getSsrInitialStatusLabel(spot: Pick<WifiSpot, "schedule">): {
  label: string;
  badgeClass: string;
} {
  if (spot.schedule.kind === "outdoor_24h") {
    return {
      label: "屋外・終日目安",
      badgeClass: "bg-sky-50 text-sky-800 ring-sky-200",
    };
  }
  if (spot.schedule.kind === "check_official") {
    return {
      label: "開館時間要確認",
      badgeClass: "bg-amber-50 text-amber-800 ring-amber-200",
    };
  }
  return {
    label: "開館目安あり",
    badgeClass: "bg-slate-100 text-slate-700 ring-slate-200",
  };
}

/**
 * クイック絞り込みチップ（開館中・予約不要・深夜・月曜・土日・電源）の判定。
 */
export function matchesWifiQuickFilters(
  spot: WifiFilterableSpot,
  activeQuickFilters: ReadonlySet<string>,
  openEvaluations: ReadonlyMap<string, OpenEvaluation>,
): boolean {
  if (activeQuickFilters.has("open-now")) {
    const ev = openEvaluations.get(spot.id);
    if (!ev || (ev.status !== "open" && ev.status !== "outdoor")) {
      return false;
    }
  }
  if (
    activeQuickFilters.has("drop-in") &&
    spot.accessPolicy !== "drop_in" &&
    spot.accessPolicy !== "outdoor_open"
  ) {
    return false;
  }
  if (activeQuickFilters.has("open-late") && !spot.openLate) {
    return false;
  }
  if (activeQuickFilters.has("open-monday") && !spot.openMonday) {
    return false;
  }
  if (activeQuickFilters.has("open-weekend") && !spot.openWeekend) {
    return false;
  }
  if (
    activeQuickFilters.has("has-power") &&
    spot.powerAvailability !== "available" &&
    spot.powerAvailability !== "limited_seats"
  ) {
    return false;
  }
  return true;
}

/**
 * タブ・エリア・地区・SSID・検索語・クイックフィルタの複合一致を判定する。
 */
export function matchesWifiSpotFilter(
  spot: WifiFilterableSpot,
  criteria: WifiFilterCriteria,
  openEvaluations: ReadonlyMap<string, OpenEvaluation>,
): boolean {
  const keyword = criteria.keyword.trim().toLowerCase();
  const tabOk =
    criteria.activeTab === "all" || spot.purposes.includes(criteria.activeTab);
  const areaOk =
    criteria.selectedArea === "all" || spot.areaGroup === criteria.selectedArea;
  const districtOk =
    criteria.district === "all" || spot.district === criteria.district;
  const ssidOk =
    criteria.ssid === "all" ||
    (criteria.ssid === "none"
      ? spot.ssid === null
      : spot.ssid === criteria.ssid);
  const keywordOk = keyword === "" || spot.searchText.includes(keyword);
  const quickOk = matchesWifiQuickFilters(
    spot,
    criteria.activeQuickFilters,
    openEvaluations,
  );

  return tabOk && areaOk && districtOk && ssidOk && keywordOk && quickOk;
}

/**
 * 並び順（距離順・AP数順・閉館遅い順・おすすめ順）でスポット2件を比較する。
 */
export function compareWifiSpots(
  spotA: WifiFilterableSpot,
  spotB: WifiFilterableSpot,
  sortBy: string,
  distanceMap: ReadonlyMap<string, number>,
  hasUserLocation: boolean,
): number {
  if (sortBy === "distance" && hasUserLocation) {
    const dA = distanceMap.get(spotA.id) ?? Number.MAX_SAFE_INTEGER;
    const dB = distanceMap.get(spotB.id) ?? Number.MAX_SAFE_INTEGER;
    if (dA !== dB) return dA - dB;
  } else if (sortBy === "ap-desc") {
    if (spotB.apCount !== spotA.apCount) {
      return spotB.apCount - spotA.apCount;
    }
  } else if (sortBy === "close-desc") {
    const cA = spotA.latestCloseMinutes ?? -1;
    const cB = spotB.latestCloseMinutes ?? -1;
    if (cB !== cA) return cB - cA;
  }

  if (spotA.recommendedRank !== spotB.recommendedRank) {
    return spotA.recommendedRank - spotB.recommendedRank;
  }
  return spotA.id.localeCompare(spotB.id);
}

/**
 * 現在地からの距離バッジ文字列（1km未満は m、以上は km 小数1桁）を整形する。
 */
export function formatDistanceBadge(km: number): string {
  return km < 1
    ? `現在地から 約${Math.round(km * 1000)}m`
    : `現在地から 約${km.toFixed(1)}km`;
}
