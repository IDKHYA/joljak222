// v2 기본 옷장 프리셋이 골든 패스 추천 조건을 만족하는지 검증한다.
import { describe, expect, it } from 'vitest';
import { defaultPersonalColor, defaultWeather, defaultWardrobePresetItems, validatePresetReadiness } from './presetData';

describe('validatePresetReadiness', () => {
  it('기본 프리셋은 겹치지 않는 추천 3개를 만들 수 있다', () => {
    const result = validatePresetReadiness({
      items: defaultWardrobePresetItems,
      personalColor: defaultPersonalColor,
      weather: defaultWeather,
      minimumDistinctOutfits: 3,
    });

    expect(result.ok).toBe(true);
    expect(result.distinctOutfitCount).toBe(3);
    expect(result.issues).toEqual([]);
  });
});
