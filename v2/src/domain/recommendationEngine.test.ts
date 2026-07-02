// v2 추천 엔진의 골든 패스 성립 조건을 검증하는 테스트
import { describe, expect, it } from 'vitest';
import { buildDistinctOutfitRecommendations } from './recommendationEngine';
import type { ClothingItem, PersonalColorResult, WeatherInput } from './types';

const personalColor: PersonalColorResult = {
  top1: 'true-summer',
  top2: 'light-summer',
  confidence: 0.82,
  decisionType: 'photo-questionnaire',
  fusionWeights: { photo: 0.3, questionnaire: 0.7 },
  paletteHexes: ['#6E8FBE', '#C68FA4', '#F7F4F2', '#3E4E73'],
  evidence: ['테스트용 쿨 서머 결과'],
};

const weather: WeatherInput = {
  band: 'mild',
  temperatureCelsius: 18,
  source: 'manual',
};

const makeItem = (
  id: string,
  category: ClothingItem['category'],
  hex: string,
  warmthLevel: ClothingItem['warmthLevel'] = 'mid',
): ClothingItem => ({
  id,
  wardrobeId: 'preset-casual',
  sourceType: 'catalog',
  image: { storedUrl: `/catalog/${id}.png` },
  category,
  typeLabel: category === 'upper' ? '셔츠' : category === 'lower' ? '슬랙스' : '스니커즈',
  displayName: `${id} 아이템`,
  colors: {
    representative: { name: '테스트색', hex, isNeutral: false },
    dominant: [{ name: '테스트색', hex, ratio: 1, isNeutral: false }],
  },
  pattern: 'solid',
  warmthLevel,
  availability: 'owned',
  analysis: { status: 'confirmed', modelRefs: [], confidenceNotes: [] },
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
});

describe('buildDistinctOutfitRecommendations', () => {
  it('프리셋 옷장에서 겹치지 않는 추천 3개를 만든다', () => {
    const items: ClothingItem[] = [
      makeItem('upper-1', 'upper', '#6E8FBE'),
      makeItem('upper-2', 'upper', '#C68FA4'),
      makeItem('upper-3', 'upper', '#F7F4F2'),
      makeItem('lower-1', 'lower', '#3E4E73'),
      makeItem('lower-2', 'lower', '#9E8F88'),
      makeItem('lower-3', 'lower', '#557A8C'),
      makeItem('shoes-1', 'shoes', '#F7F4F2'),
      makeItem('shoes-2', 'shoes', '#C9CED6'),
      makeItem('shoes-3', 'shoes', '#434A54'),
    ];

    const result = buildDistinctOutfitRecommendations({
      items,
      personalColor,
      weather,
      count: 3,
    });

    expect(result.issues).toEqual([]);
    expect(result.recommendations).toHaveLength(3);

    const usedItemIds = result.recommendations.flatMap((recommendation) =>
      recommendation.items.map((item) => item.id),
    );
    expect(new Set(usedItemIds).size).toBe(usedItemIds.length);
  });

  it('추천마다 4축 점수와 한국어 근거를 제공한다', () => {
    const items: ClothingItem[] = [
      makeItem('upper-1', 'upper', '#6E8FBE'),
      makeItem('lower-1', 'lower', '#3E4E73'),
      makeItem('shoes-1', 'shoes', '#F7F4F2'),
    ];

    const result = buildDistinctOutfitRecommendations({
      items,
      personalColor,
      weather,
      count: 1,
    });

    const recommendation = result.recommendations[0];
    expect(recommendation.scoreBreakdown).toEqual({
      personalColor: expect.any(Number),
      weather: expect.any(Number),
      harmony: expect.any(Number),
      stability: expect.any(Number),
    });
    expect(recommendation.reasons.join(' ')).toContain('퍼스널컬러');
    expect(recommendation.reasons.join(' ')).toContain('날씨');
  });

  it('겹치지 않는 조합을 만들 수 없으면 이유를 반환한다', () => {
    const items: ClothingItem[] = [
      makeItem('upper-1', 'upper', '#6E8FBE'),
      makeItem('lower-1', 'lower', '#3E4E73'),
      makeItem('shoes-1', 'shoes', '#F7F4F2'),
    ];

    const result = buildDistinctOutfitRecommendations({
      items,
      personalColor,
      weather,
      count: 3,
    });

    expect(result.recommendations).toHaveLength(1);
    expect(result.issues).toContain('겹치지 않는 추천 3개를 만들 의류가 부족합니다.');
  });
});
