// 저장한 코디와 데일리룩 편집 상태를 관리하는 훅입니다.
import { useState } from 'react';
import { buildDailyLookState } from '../services/dailyLook';
import type { DailyLookState, OutfitRecommendation, SavedOutfit, ScoredClothingItem } from '../wardrobeTypes';
import { localAppPersistence } from '../services/appPersistence';

const savedOutfitPersistence = localAppPersistence.savedOutfit;

export function applySavedOutfitDailyLookUpdate(
  savedOutfits: SavedOutfit[],
  dailyLookSourceItems: ScoredClothingItem[],
  id: string,
  dailyLookState: DailyLookState,
  itemIds?: string[],
) {
  const sourceMap = new Map<string, ScoredClothingItem>(dailyLookSourceItems.map((item) => [item.id, item]));
  return savedOutfits.map((outfit) => {
    if (outfit.id !== id) return outfit;
    if (!itemIds) return { ...outfit, dailyLookState };

    const nextItemIds = Array.from(new Set(itemIds));
    return {
      ...outfit,
      itemIds: nextItemIds,
      colorHexes: nextItemIds.map((itemId) => sourceMap.get(itemId)?.representativeHex).filter(Boolean) as string[],
      dailyLookState,
    };
  });
}

export function useSavedOutfits(dailyLookSourceItems: ScoredClothingItem[]) {
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>(() => savedOutfitPersistence.loadAll());
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
    savedOutfitPersistence.saveAll(next);
  };

  const deleteSavedOutfit = (id: string) => {
    const next = savedOutfits.filter((outfit) => outfit.id !== id);
    setSavedOutfits(next);
    savedOutfitPersistence.saveAll(next);
  };

  const updateSavedOutfitDailyLook = (id: string, dailyLookState: DailyLookState, itemIds?: string[]) => {
    const next = applySavedOutfitDailyLookUpdate(savedOutfits, dailyLookSourceItems, id, dailyLookState, itemIds);
    setSavedOutfits(next);
    savedOutfitPersistence.saveAll(next);
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
    savedOutfitPersistence.saveAll(next);
    setActiveTryOnOutfitId(outfit.id);
    return outfit.id;
  };

  const openDailyLookMaker = (id: string) => {
    setActiveTryOnOutfitId(id);
  };

  const resetSavedOutfits = () => {
    setSavedOutfits([]);
    savedOutfitPersistence.clear();
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
