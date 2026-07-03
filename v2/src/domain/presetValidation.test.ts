// v2 기본 옷장 프리셋이 골든 패스 추천 조건을 만족하는지 검증한다. (게이트 G13 — 추천 성립 보장)
import { describe, expect, it } from 'vitest';
import { defaultPersonalColor, defaultWeather, defaultWardrobePresetItems, validatePresetReadiness } from './presetData';
import type { PersonalSeasonId, WeatherBand } from './types';

const ALL_SEASONS: PersonalSeasonId[] = [
  'light-spring',
  'true-spring',
  'bright-spring',
  'light-summer',
  'true-summer',
  'soft-summer',
  'soft-autumn',
  'true-autumn',
  'dark-autumn',
  'dark-winter',
  'true-winter',
  'bright-winter',
];

const ALL_BANDS: WeatherBand[] = ['freezing', 'cold', 'chilly', 'cool', 'mild', 'warm', 'hot', 'very-hot'];

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

  it('기본 프리셋은 12시즌 × 8밴드 전부에서 추천 3개가 성립한다 (G13)', () => {
    const failures: string[] = [];

    for (const seasonId of ALL_SEASONS) {
      for (const band of ALL_BANDS) {
        const result = validatePresetReadiness({
          items: defaultWardrobePresetItems,
          personalColor: { ...defaultPersonalColor, top1: seasonId, top2: seasonId },
          weather: { band, source: 'manual' },
          minimumDistinctOutfits: 3,
        });
        if (!result.ok) {
          failures.push(`${seasonId} × ${band}: ${result.issues.join(', ')}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
