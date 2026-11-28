import type { BathAvailability } from "./sentou-schedule";
import type {
  BathAccessCategory,
  BathAreaGroup,
  BathSchedule,
  BathWaterType,
} from "./sentou-schema";

export type SentouTabKey =
  | "public_drop_in"
  | "day_use_or_reserved"
  | "restricted"
  | "all";

export interface SentouFilterableFacility {
  id: string;
  tabGroup: string;
  accessCategory: BathAccessCategory;
  permitCategory: "一般公衆浴場" | "その他の公衆浴場";
  permittedAt: string;
  areaGroup: BathAreaGroup;
  waterType: BathWaterType;
  hasSauna: boolean;
  hasRotenburo: boolean;
  hasMorningBath: boolean;
  openLateNight: boolean;
  latestLastEntryMinutes: number | null;
  lat: number | null;
  lng: number | null;
  recommendedRank: number;
  schedule: BathSchedule;
  searchText: string;
}

export interface SentouFilterCriteria {
  selectedArea: "all" | BathAreaGroup;
  keyword: string;
  activeQuickFilters: ReadonlySet<string>;
}

export const STATUS_SORT_WEIGHT: Record<BathAvailability["status"], number> = {
  open_now: 0,
  opening_later_today: 1,
  check_official: 2,
  closed_today: 3,
  not_public: 4,
};

/**
 * タブ以外の絞り込み条件（エリア・キーワード・各種クイックフィルタ）の一致を判定する。
 */
export function matchesSentouFiltersWithoutTab(
  f: SentouFilterableFacility,
  criteria: SentouFilterCriteria,
  availabilities: ReadonlyMap<string, BathAvailability>,
): boolean {
  const keyword = criteria.keyword.trim().toLowerCase();
  if (
    criteria.selectedArea !== "all" &&
    f.areaGroup !== criteria.selectedArea
  ) {
    return false;
  }
  if (keyword !== "" && !f.searchText.includes(keyword)) return false;

  if (criteria.activeQuickFilters.has("can-enter-today")) {
    const av = availabilities.get(f.id);
    if (!av?.canEnterToday) return false;
  }
  if (criteria.activeQuickFilters.has("open-now")) {
    const av = availabilities.get(f.id);
    if (av?.status !== "open_now") return false;
  }
  if (criteria.activeQuickFilters.has("onsen") && f.waterType !== "onsen") {
    return false;
  }
  if (
    criteria.activeQuickFilters.has("sentou") &&
    f.permitCategory !== "一般公衆浴場"
  ) {
    return false;
  }
  if (criteria.activeQuickFilters.has("sauna") && !f.hasSauna) return false;
  if (criteria.activeQuickFilters.has("rotenburo") && !f.hasRotenburo) {
    return false;
  }
  if (criteria.activeQuickFilters.has("morning-bath") && !f.hasMorningBath) {
    return false;
  }
  if (criteria.activeQuickFilters.has("late-night") && !f.openLateNight) {
    return false;
  }
  return true;
}

/**
 * 指定された並び順キーで温浴施設2件を比較する。
 */
export function compareSentouFacilities(
  fA: SentouFilterableFacility,
  fB: SentouFilterableFacility,
  sortBy: string,
  context: {
    availabilities: ReadonlyMap<string, BathAvailability>;
    distanceMap: ReadonlyMap<string, number>;
    hasUserLocation: boolean;
  },
): number {
  if (sortBy === "available_first") {
    const avA = context.availabilities.get(fA.id);
    const avB = context.availabilities.get(fB.id);
    const wA = avA ? STATUS_SORT_WEIGHT[avA.status] : 9;
    const wB = avB ? STATUS_SORT_WEIGHT[avB.status] : 9;
    if (wA !== wB) return wA - wB;
  } else if (sortBy === "distance" && context.hasUserLocation) {
    const dA = context.distanceMap.get(fA.id) ?? Number.MAX_SAFE_INTEGER;
    const dB = context.distanceMap.get(fB.id) ?? Number.MAX_SAFE_INTEGER;
    if (dA !== dB) return dA - dB;
  } else if (sortBy === "last_entry_desc") {
    const lA = fA.latestLastEntryMinutes ?? -1;
    const lB = fB.latestLastEntryMinutes ?? -1;
    if (lB !== lA) return lB - lA;
  } else if (sortBy === "permitted_desc") {
    const cmp = fB.permittedAt.localeCompare(fA.permittedAt);
    if (cmp !== 0) return cmp;
  }

  if (fA.recommendedRank !== fB.recommendedRank) {
    return fA.recommendedRank - fB.recommendedRank;
  }
  return fA.id.localeCompare(fB.id);
}

/**
 * 現在地からの距離バッジ文字列を整形する。
 */
export function formatBathDistanceBadge(km: number): string {
  return km < 1
    ? `現在地から 約${Math.round(km * 1000)}m`
    : `現在地から 約${km.toFixed(1)}km`;
}
