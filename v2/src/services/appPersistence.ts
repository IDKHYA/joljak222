// 앱의 브라우저 저장소 접근을 도메인별 어댑터로 모읍니다.
import type { FinalResult } from '../types';
import { STORAGE_KEYS } from '../wardrobeConstants';
import type { ClothingItem, PersonalColorRecord, SavedOutfit, Wardrobe } from '../wardrobeTypes';
import { loadJson, removeJson, saveJson } from './storage';

export interface PersonalColorPersistence {
  loadResult: () => FinalResult | null;
  saveResult: (result: FinalResult) => void;
  loadHistory: () => PersonalColorRecord[];
  saveHistory: (history: PersonalColorRecord[]) => void;
  clear: () => void;
}

export interface WardrobePersistence {
  loadWardrobes: (fallback: Wardrobe[]) => Wardrobe[];
  saveWardrobes: (wardrobes: Wardrobe[]) => void;
  loadClothing: (fallback: ClothingItem[]) => ClothingItem[];
  saveClothing: (items: ClothingItem[]) => void;
}

export interface SavedOutfitPersistence {
  loadAll: () => SavedOutfit[];
  saveAll: (outfits: SavedOutfit[]) => void;
  clear: () => void;
}

export interface AppPersistence {
  personalColor: PersonalColorPersistence;
  wardrobe: WardrobePersistence;
  savedOutfit: SavedOutfitPersistence;
}

export const localAppPersistence: AppPersistence = {
  personalColor: {
    loadResult: () => loadJson<FinalResult | null>(STORAGE_KEYS.personalColor, null),
    saveResult: (result) => saveJson(STORAGE_KEYS.personalColor, result),
    loadHistory: () => loadJson<PersonalColorRecord[]>(STORAGE_KEYS.personalHistory, []),
    saveHistory: (history) => saveJson(STORAGE_KEYS.personalHistory, history),
    clear: () => {
      removeJson(STORAGE_KEYS.personalColor);
      removeJson(STORAGE_KEYS.personalHistory);
    },
  },
  wardrobe: {
    loadWardrobes: (fallback) => loadJson(STORAGE_KEYS.wardrobes, fallback),
    saveWardrobes: (wardrobes) => saveJson(STORAGE_KEYS.wardrobes, wardrobes),
    loadClothing: (fallback) => loadJson(STORAGE_KEYS.clothing, fallback),
    saveClothing: (items) => saveJson(STORAGE_KEYS.clothing, items),
  },
  savedOutfit: {
    loadAll: () => loadJson<SavedOutfit[]>(STORAGE_KEYS.saved, []),
    saveAll: (outfits) => saveJson(STORAGE_KEYS.saved, outfits),
    clear: () => saveJson<SavedOutfit[]>(STORAGE_KEYS.saved, []),
  },
};
