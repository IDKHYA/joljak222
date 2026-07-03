// 저장 코디 데일리룩 업데이트가 선택 인자를 안전하게 처리하는지 검증합니다.
import { describe, expect, it } from 'vitest';
import type { DailyLookState, SavedOutfit, ScoredClothingItem } from '../wardrobeTypes';

describe('applySavedOutfitDailyLookUpdate', () => {
  it('itemIds를 생략하면 기존 코디 아이템을 유지한다', async () => {
    const imported = await import('./useSavedOutfits');
    const applySavedOutfitDailyLookUpdate = (imported as {
      applySavedOutfitDailyLookUpdate?: (
        savedOutfits: SavedOutfit[],
        dailyLookSourceItems: ScoredClothingItem[],
        id: string,
        dailyLookState: DailyLookState,
        itemIds?: string[],
      ) => SavedOutfit[];
    }).applySavedOutfitDailyLookUpdate;

    expect(applySavedOutfitDailyLookUpdate).toBeTypeOf('function');

    const outfit = {
      id: 'saved-1',
      title: '테스트 코디',
      itemIds: ['top-1', 'bottom-1'],
      colorHexes: ['#111111', '#222222'],
    } as SavedOutfit;
    const dailyLookState = { canvas: { width: 1080, height: 1440 }, layers: [], isConfirmed: true };

    const next = applySavedOutfitDailyLookUpdate!([outfit], [], 'saved-1', dailyLookState);

    expect(next[0].itemIds).toEqual(['top-1', 'bottom-1']);
    expect(next[0].colorHexes).toEqual(['#111111', '#222222']);
    expect(next[0].dailyLookState).toBe(dailyLookState);
  });

  it('itemIds가 들어오면 중복을 제거하고 source item 색상으로 colorHexes를 갱신한다', async () => {
    const imported = await import('./useSavedOutfits');
    const applySavedOutfitDailyLookUpdate = imported.applySavedOutfitDailyLookUpdate!;
    const outfit = {
      id: 'saved-1',
      title: '테스트 코디',
      itemIds: ['old-1'],
      colorHexes: ['#000000'],
    } as SavedOutfit;
    const sourceItems = [
      { id: 'top-1', representativeHex: '#AAAAAA' },
      { id: 'bottom-1', representativeHex: '#BBBBBB' },
    ] as ScoredClothingItem[];
    const dailyLookState = { canvas: { width: 1080, height: 1440 }, layers: [], isConfirmed: false };

    const next = applySavedOutfitDailyLookUpdate([outfit], sourceItems, 'saved-1', dailyLookState, ['top-1', 'top-1', 'bottom-1']);

    expect(next[0].itemIds).toEqual(['top-1', 'bottom-1']);
    expect(next[0].colorHexes).toEqual(['#AAAAAA', '#BBBBBB']);
    expect(next[0].dailyLookState).toBe(dailyLookState);
  });
});
