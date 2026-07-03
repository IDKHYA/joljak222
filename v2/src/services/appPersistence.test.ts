// 앱 저장소 어댑터가 브라우저 저장 구현을 한 곳에 모으는지 검증합니다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinalResult } from '../types';
import type { ClothingItem, PersonalColorRecord, SavedOutfit, Wardrobe } from '../wardrobeTypes';

function installLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  });
}

describe('removeJson', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installLocalStorage();
  });

  it('저장된 JSON 값을 삭제하고 다음 조회에서 fallback을 돌려준다', async () => {
    const storage = await import('./storage');

    expect(storage.removeJson).toBeTypeOf('function');

    storage.saveJson('sample-key', { value: 1 });
    expect(storage.loadJson('sample-key', null)).toEqual({ value: 1 });

    storage.removeJson('sample-key');

    expect(storage.loadJson('sample-key', 'fallback')).toBe('fallback');
  });
});

describe('localAppPersistence', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installLocalStorage();
  });

  it('퍼컬 결과와 이력을 저장소 어댑터로 저장, 조회, 삭제한다', async () => {
    const imported = await import('./appPersistence').catch(() => null);

    expect(imported).not.toBeNull();

    const { localAppPersistence } = imported as {
      localAppPersistence: {
        personalColor: {
          loadResult: () => FinalResult | null;
          saveResult: (result: FinalResult) => void;
          loadHistory: () => PersonalColorRecord[];
          saveHistory: (history: PersonalColorRecord[]) => void;
          clear: () => void;
        };
      };
    };
    const result = { seasonTop1Id: 'soft-summer', seasonTop1: '소프트 서머' } as FinalResult;
    const history = [{ id: 'pc-1', measuredAt: '2026-07-03T00:00:00.000Z', result }];

    localAppPersistence.personalColor.saveResult(result);
    localAppPersistence.personalColor.saveHistory(history);

    expect(localAppPersistence.personalColor.loadResult()?.seasonTop1Id).toBe('soft-summer');
    expect(localAppPersistence.personalColor.loadHistory()).toEqual(history);

    localAppPersistence.personalColor.clear();

    expect(localAppPersistence.personalColor.loadResult()).toBeNull();
    expect(localAppPersistence.personalColor.loadHistory()).toEqual([]);
  });

  it('옷장과 의류 목록을 저장소 어댑터로 저장하고 조회한다', async () => {
    const imported = await import('./appPersistence').catch(() => null);

    expect(imported).not.toBeNull();

    const { localAppPersistence } = imported as {
      localAppPersistence: {
        wardrobe: {
          loadWardrobes: (fallback: Wardrobe[]) => Wardrobe[];
          saveWardrobes: (wardrobes: Wardrobe[]) => void;
          loadClothing: (fallback: ClothingItem[]) => ClothingItem[];
          saveClothing: (items: ClothingItem[]) => void;
        };
      };
    };
    const wardrobe = { id: 'w-1', name: '테스트 옷장', createdAt: '2026-07-03T00:00:00.000Z' };
    const item = { id: 'item-1', wardrobeId: 'w-1', imageUrl: '/catalog/item.png', sourceType: 'catalog' } as ClothingItem;

    localAppPersistence.wardrobe.saveWardrobes([wardrobe]);
    localAppPersistence.wardrobe.saveClothing([item]);

    expect(localAppPersistence.wardrobe.loadWardrobes([])).toEqual([wardrobe]);
    expect(localAppPersistence.wardrobe.loadClothing([])).toEqual([item]);
  });

  it('저장 코디를 저장소 어댑터로 저장, 조회, 초기화한다', async () => {
    const imported = await import('./appPersistence').catch(() => null);

    expect(imported).not.toBeNull();

    const { localAppPersistence } = imported as {
      localAppPersistence: {
        savedOutfit: {
          loadAll: () => SavedOutfit[];
          saveAll: (outfits: SavedOutfit[]) => void;
          clear: () => void;
        };
      };
    };
    const outfit = {
      id: 'saved-1',
      title: '테스트 코디',
      itemIds: ['item-1'],
      colorHexes: ['#AABBCC'],
      savedAt: '2026-07-03T00:00:00.000Z',
    } as SavedOutfit;

    localAppPersistence.savedOutfit.saveAll([outfit]);

    expect(localAppPersistence.savedOutfit.loadAll()).toEqual([outfit]);

    localAppPersistence.savedOutfit.clear();

    expect(localAppPersistence.savedOutfit.loadAll()).toEqual([]);
  });
});
