// 저장한 코디와 데일리룩 편집 대상 상태를 관리하는 훅입니다.
import { useState } from 'react';
import { buildDailyLookState } from '../services/dailyLook';
import type { DailyLookState, OutfitRecommendation, SavedOutfit, ScoredClothingItem } from '../wardrobeTypes';
import { STORAGE_KEYS } from '../wardrobeConstants';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`localStorage 저장 실패: ${key}`, error);
  }
}

export function useSavedOutfits(dailyLookSourceItems: ScoredClothingItem[]) {
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>(() => loadJson(STORAGE_KEYS.saved, []));
  const [activeTryOnOutfitId, setActiveTryOnOutfitId] = useState<string | null>(null);

  const saveOutfit = (outfit: OutfitRecommendation) => {
    const key = outfit.items.map((item) => item.id).join(',');
    if (savedOutfits.some((saved) => saved.itemIds.join(',') === key)) return;
    const next = [{
      id: `saved-${Date.now()}`,
      title: outfit.title,
      score: outfit.score,
      itemIds: outfit.items.map((item) => item.id),
      colorHexes: outfit.items.map((item) => item.representativeHex),
      weatherBand: outfit.weatherBand,
      mode: outfit.mode,
      savedAt: new Date().toISOString(),
      explanationBullets: outfit.explanationBullets,
      dailyLookState: buildDailyLookState(outfit.items),
    }, ...savedOutfits];
    setSavedOutfits(next);
    saveJson(STORAGE_KEYS.saved, next);
  };

  const deleteSavedOutfit = (id: string) => {
    const next = savedOutfits.filter((outfit) => outfit.id !== id);
    setSavedOutfits(next);
    saveJson(STORAGE_KEYS.saved, next);
  };

  const updateSavedOutfitDailyLook = (id: string, dailyLookState: DailyLookState, itemIds?: string[]) => {
    const sourceMap = new Map<string, ScoredClothingItem>(dailyLookSourceItems.map((item) => [item.id, item]));
    const uniqueItemIds = Array.from(new Set(itemIds));
    const next = savedOutfits.map((outfit) => {
      if (outfit.id !== id) return outfit;
      const nextItemIds = itemIds ? uniqueItemIds : outfit.itemIds;
      return {
        ...outfit,
        itemIds: nextItemIds,
        colorHexes: nextItemIds.map((itemId) => sourceMap.get(itemId)?.representativeHex).filter(Boolean) as string[],
        dailyLookState,
      };
    });
    setSavedOutfits(next);
    saveJson(STORAGE_KEYS.saved, next);
  };

  const createBlankDailyLook = () => {
    const outfit: SavedOutfit = {
      id: `saved-${Date.now()}`,
      title: '새 데일리룩',
      score: 0,
      itemIds: [],
      colorHexes: [],
      weatherBand: '상관없음',
      mode: '데일리',
      savedAt: new Date().toISOString(),
      dailyLookState: buildDailyLookState([]),
    };
    const next = [outfit, ...savedOutfits];
    setSavedOutfits(next);
    saveJson(STORAGE_KEYS.saved, next);
    setActiveTryOnOutfitId(outfit.id);
    return outfit.id;
  };

  const openDailyLookMaker = (id: string) => {
    setActiveTryOnOutfitId(id);
  };

  const resetSavedOutfits = () => {
    setSavedOutfits([]);
    saveJson(STORAGE_KEYS.saved, []);
    setActiveTryOnOutfitId(null);
  };

  return {
    savedOutfits,
    activeTryOnOutfitId,
    saveOutfit,
    deleteSavedOutfit,
    updateSavedOutfitDailyLook,
    createBlankDailyLook,
    openDailyLookMaker,
    resetSavedOutfits,
  };
}
