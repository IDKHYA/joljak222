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

describe('계산 모델 게이트 (도메인개념_고도화_v2.md §8)', () => {
  const singleOutfit = (upperHex: string): ClothingItem[] => [
    makeItem('upper-1', 'upper', upperHex),
    makeItem('lower-1', 'lower', '#3E4E73'),
    makeItem('shoes-1', 'shoes', '#F7F4F2'),
  ];

  it('G1 — 시즌 팔레트에 가까운 색이 먼 색보다 높은 퍼컬 점수를 받는다', () => {
    const paletteBlue = buildDistinctOutfitRecommendations({
      items: singleOutfit('#6E8FBE'),
      personalColor,
      weather,
      count: 1,
    });
    const warmOrange = buildDistinctOutfitRecommendations({
      items: singleOutfit('#F96822'),
      personalColor,
      weather,
      count: 1,
    });

    expect(paletteBlue.recommendations[0].scoreBreakdown.personalColor).toBeGreaterThan(
      warmOrange.recommendations[0].scoreBreakdown.personalColor,
    );
  });

  it('G3 — 진단 신뢰도가 낮으면 Top2 팔레트가 점수에 섞인다', () => {
    // 아이템 색은 true-summer 팔레트 색. top1은 true-autumn이라 낮은 점수가 나온다.
    const mixedPersonalColor = {
      ...personalColor,
      top1: 'true-autumn' as const,
      top2: 'true-summer' as const,
    };

    const highConfidence = buildDistinctOutfitRecommendations({
      items: singleOutfit('#6E8FBE'),
      personalColor: { ...mixedPersonalColor, confidence: 0.9 },
      weather,
      count: 1,
    });
    const lowConfidence = buildDistinctOutfitRecommendations({
      items: singleOutfit('#6E8FBE'),
      personalColor: { ...mixedPersonalColor, confidence: 0.45 },
      weather,
      count: 1,
    });
    const lowConfidenceSameTop2 = buildDistinctOutfitRecommendations({
      items: singleOutfit('#6E8FBE'),
      personalColor: { ...mixedPersonalColor, top2: 'true-autumn' as const, confidence: 0.45 },
      weather,
      count: 1,
    });

    expect(lowConfidence.recommendations[0].scoreBreakdown.personalColor).toBeGreaterThan(
      highConfidence.recommendations[0].scoreBreakdown.personalColor,
    );
    // top2가 top1과 같으면 혼합이 일어나지 않는다.
    expect(lowConfidenceSameTop2.recommendations[0].scoreBreakdown.personalColor).toBe(
      highConfidence.recommendations[0].scoreBreakdown.personalColor,
    );
  });

  it('G7 — 강한 패턴 2개가 있는 코디는 조화 감점을 받는다', () => {
    const solid = buildDistinctOutfitRecommendations({
      items: singleOutfit('#6E8FBE'),
      personalColor,
      weather,
      count: 1,
    });

    const patternedItems = singleOutfit('#6E8FBE').map((item) =>
      item.category === 'shoes' ? item : { ...item, pattern: 'graphic' as const },
    );
    const patterned = buildDistinctOutfitRecommendations({
      items: patternedItems,
      personalColor,
      weather,
      count: 1,
    });

    expect(
      solid.recommendations[0].scoreBreakdown.harmony
        - patterned.recommendations[0].scoreBreakdown.harmony,
    ).toBeCloseTo(8, 1);
  });

  it('G8 — 같은 보색 배색이 고대비 시즌에서 더 높은 조화 점수를 받는다', () => {
    // 빨강(#D7263D)과 시안(#00B7EB)은 hue 각도 차 약 159도의 보색 관계다.
    const complementaryOutfit: ClothingItem[] = [
      makeItem('upper-1', 'upper', '#D7263D'),
      makeItem('lower-1', 'lower', '#00B7EB'),
      makeItem('shoes-1', 'shoes', '#F7F4F2'),
    ];

    const brightWinter = buildDistinctOutfitRecommendations({
      items: complementaryOutfit,
      personalColor: { ...personalColor, top1: 'bright-winter' as const, top2: 'true-winter' as const },
      weather,
      count: 1,
    });
    const softSummer = buildDistinctOutfitRecommendations({
      items: complementaryOutfit,
      personalColor: { ...personalColor, top1: 'soft-summer' as const, top2: 'true-summer' as const },
      weather,
      count: 1,
    });

    expect(brightWinter.recommendations[0].scoreBreakdown.harmony).toBeGreaterThan(
      softSummer.recommendations[0].scoreBreakdown.harmony,
    );
  });

  it('G9 — 날씨 점수가 이상 > 보조 허용 > 그 외 순서로 연속 감소하고 바닥이 있다', () => {
    const outfitWithWarmth = (warmthLevel: ClothingItem['warmthLevel']): ClothingItem[] => [
      makeItem('upper-1', 'upper', '#6E8FBE', warmthLevel),
      makeItem('lower-1', 'lower', '#3E4E73', warmthLevel),
      makeItem('shoes-1', 'shoes', '#F7F4F2', warmthLevel),
    ];
    const weatherScoreFor = (warmthLevel: ClothingItem['warmthLevel']): number =>
      buildDistinctOutfitRecommendations({
        items: outfitWithWarmth(warmthLevel),
        personalColor,
        weather: { band: 'mild', temperatureCelsius: 18, source: 'manual' },
        count: 1,
      }).recommendations[0].scoreBreakdown.weather;

    // mild 밴드 — 계약 §4.2: ideal(mid, light) > acceptable(warm) > 그 외(very-light).
    const mid = weatherScoreFor('mid');
    const light = weatherScoreFor('light');
    const warm = weatherScoreFor('warm');
    const veryLight = weatherScoreFor('very-light');

    expect(mid).toBeGreaterThan(light);
    expect(light).toBeGreaterThan(warm);
    expect(warm).toBeGreaterThan(veryLight);
    expect(veryLight).toBeGreaterThanOrEqual(30);
  });

  it('G10 — 한겨울에는 아우터 있는 코디가 선택되고, 없으면 날씨 점수가 깎인다', () => {
    const coldWardrobe: ClothingItem[] = [
      makeItem('upper-1', 'upper', '#6E8FBE', 'warm'),
      makeItem('lower-1', 'lower', '#3E4E73', 'warm'),
      makeItem('shoes-1', 'shoes', '#434A54', 'warm'),
    ];
    const freezingWeather: WeatherInput = { band: 'freezing', temperatureCelsius: 0, source: 'manual' };

    const withOuter = buildDistinctOutfitRecommendations({
      items: [...coldWardrobe, makeItem('outer-1', 'outer', '#434A54', 'heavy')],
      personalColor,
      weather: freezingWeather,
      count: 1,
    });
    const withoutOuter = buildDistinctOutfitRecommendations({
      items: coldWardrobe,
      personalColor,
      weather: freezingWeather,
      count: 1,
    });

    expect(withOuter.recommendations[0].items.some((item) => item.category === 'outer')).toBe(true);
    expect(withOuter.recommendations[0].scoreBreakdown.weather).toBeGreaterThan(
      withoutOuter.recommendations[0].scoreBreakdown.weather,
    );
  });

  it('G10 — 더운 날에는 heavy 아우터가 선택되지 않는다', () => {
    const hotWardrobe: ClothingItem[] = [
      makeItem('upper-1', 'upper', '#6E8FBE', 'light'),
      makeItem('lower-1', 'lower', '#3E4E73', 'light'),
      makeItem('shoes-1', 'shoes', '#F7F4F2', 'light'),
      makeItem('outer-1', 'outer', '#434A54', 'heavy'),
    ];

    const result = buildDistinctOutfitRecommendations({
      items: hotWardrobe,
      personalColor,
      weather: { band: 'hot', temperatureCelsius: 26, source: 'manual' },
      count: 1,
    });

    expect(result.recommendations[0].items.some((item) => item.category === 'outer')).toBe(false);
  });

  it('G12 — 신발이 하나뿐이면 재사용을 허용하고 reusedItemIds에 기록한다', () => {
    const items: ClothingItem[] = [
      makeItem('upper-1', 'upper', '#6E8FBE'),
      makeItem('upper-2', 'upper', '#C68FA4'),
      makeItem('upper-3', 'upper', '#F7F4F2'),
      makeItem('lower-1', 'lower', '#3E4E73'),
      makeItem('lower-2', 'lower', '#9E8F88'),
      makeItem('lower-3', 'lower', '#557A8C'),
      makeItem('shoes-1', 'shoes', '#F7F4F2'),
    ];

    const result = buildDistinctOutfitRecommendations({
      items,
      personalColor,
      weather,
      count: 3,
    });

    expect(result.issues).toEqual([]);
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[1].reusedItemIds).toContain('shoes-1');
    expect(result.recommendations[2].reusedItemIds).toContain('shoes-1');

    // 상의는 끝까지 재사용되지 않는다.
    const upperIds = result.recommendations.map(
      (recommendation) => recommendation.items.find((item) => item.category === 'upper')?.id,
    );
    expect(new Set(upperIds).size).toBe(3);
  });
});
