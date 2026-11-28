export interface YamagoyaFilterItem {
  area: string;
  difficulty: string;
  physical: number;
  hasGtfs: boolean;
  search: string;
  capacity: number;
  elevation: number;
  permitted: string;
}

export interface YamagoyaFilterCriteria {
  selectedArea: string;
  difficulty: string;
  physicalRange: string;
  gtfsOnly: boolean;
  keyword: string;
  activePreset: string;
}

export interface YamagoyaPresetState {
  difficulty: string;
  physicalRange: string;
  sortBy: string;
}

/**
 * 体力レベルが選択された範囲文字列に一致するか判定する。
 */
export function matchesPhysicalLevel(level: number, range: string): boolean {
  if (range === "1-4") return level >= 1 && level <= 4;
  if (range === "1-5") return level >= 1 && level <= 5;
  if (range === "6-10") return level >= 6 && level <= 10;
  return true;
}

/**
 * プリセットボタン選択時に適用するセレクト状態（難易度・体力・並び順）を返す。
 */
export function getYamagoyaPresetState(
  presetId: string,
): YamagoyaPresetState | null {
  if (presetId === "beginner") {
    return { difficulty: "B", physicalRange: "1-4", sortBy: "physical-asc" };
  }
  if (presetId === "one-night") {
    return { difficulty: "B", physicalRange: "1-5", sortBy: "elevation-desc" };
  }
  if (presetId === "large" || presetId === "high-ridge") {
    return {
      difficulty: "all",
      physicalRange: "all",
      sortBy: presetId === "large" ? "capacity-desc" : "elevation-desc",
    };
  }
  return null;
}

/**
 * 大規模小屋・高所稜線プリセット固有の追加条件を判定する。
 */
export function matchesPresetExtra(
  item: Pick<YamagoyaFilterItem, "capacity" | "elevation">,
  activePreset: string,
): boolean {
  if (activePreset === "large") {
    return item.capacity >= 100;
  }
  if (activePreset === "high-ridge") {
    return item.elevation >= 2800;
  }
  return true;
}

/**
 * 山小屋1件が現在のすべての絞り込み条件に一致するか判定する。
 */
export function matchesYamagoyaFilter(
  item: YamagoyaFilterItem,
  criteria: YamagoyaFilterCriteria,
): boolean {
  const keyword = criteria.keyword.trim().toLowerCase();
  const areaOk =
    criteria.selectedArea === "all" || item.area === criteria.selectedArea;
  const diffOk =
    criteria.difficulty === "all" || item.difficulty === criteria.difficulty;
  const physOk = matchesPhysicalLevel(item.physical, criteria.physicalRange);
  const gtfsOk = !criteria.gtfsOnly || item.hasGtfs;
  const kwOk = keyword === "" || item.search.includes(keyword);
  const presetOk = matchesPresetExtra(item, criteria.activePreset);

  return areaOk && diffOk && physOk && gtfsOk && kwOk && presetOk;
}

/**
 * 指定された並び順キーで山小屋2件を比較する。
 */
export function compareYamagoyaItems(
  a: Pick<
    YamagoyaFilterItem,
    "elevation" | "physical" | "capacity" | "permitted"
  >,
  b: Pick<
    YamagoyaFilterItem,
    "elevation" | "physical" | "capacity" | "permitted"
  >,
  sortBy: string,
): number {
  if (sortBy === "elevation-asc") {
    return a.elevation - b.elevation;
  }
  if (sortBy === "physical-asc") {
    return a.physical - b.physical;
  }
  if (sortBy === "physical-desc") {
    return b.physical - a.physical;
  }
  if (sortBy === "capacity-desc") {
    return b.capacity - a.capacity;
  }
  if (sortBy === "permitted-asc") {
    return a.permitted.localeCompare(b.permitted);
  }
  return b.elevation - a.elevation;
}
