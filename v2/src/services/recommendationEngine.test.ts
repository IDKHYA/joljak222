// 추천 엔진의 핵심 점수 함수에 대한 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  buildAnchoredRecommendations,
  buildRecommendations,
  calculateHarmonyScore,
  calculatePatternPenalty,
  classifyHarmonyType,
  getWeatherScore,
  groupByColorCombo,
  gradeFromScore,
  hueAngleDiff,
  scorePaletteDistance,
  scoreItemForPersonalColor,
} from './recommendationEngine';
import type { ClothingItem, OutfitRecommendation, ScoredClothingItem } from '../wardrobeTypes';
import type { FinalResult } from '../types';

// fitReason/reason 합성 테스트에서 쓰는 최소 측정 결과입니다. 트루 윈터 팔레트만 채워 둡니다.
const mockResult = {
  seasonTop1Id: 'true-winter',
  seasonTop1: '트루 윈터',
  palette: ['#22334D', '#171717', '#F7F7F4'],
} as unknown as FinalResult;

// 필드가 많은 ScoredClothingItem을 테스트마다 다시 쓰지 않도록 기본값 + 일부 덮어쓰기로 생성합니다.
function mockItem(overrides: Partial<ScoredClothingItem> = {}): ScoredClothingItem {
  // dedupe 기준이 catalogItemId ?? imageUrl 이므로, 실제 아이템처럼 imageUrl을 고유하게 둡니다.
  const id = Math.random().toString(36).slice(2);
  return {
    id,
    wardrobeId: 'w1',
    imageUrl: `https://example.com/${id}.png`,
    category: '상의',
    type: '반팔티',
    color: '화이트',
    size: 'M',
    brand: '',
    createdAt: '',
    representativeColor: '화이트',
    representativeHex: '#FFFFFF',
    dominantColors: [],
    seasonTag: '사계절',
    patternType: 'solid',
    material: 'cotton',
    availabilityStatus: '보유중',
    isNeutral: false,
    isDenim: false,
    sourceType: 'upload',
    personalFitScore: 70,
    fitGrade: 'GOOD',
    fitReason: '',
    avoidRisk: false,
    ...overrides,
  };
}

describe('gradeFromScore', () => {
  it('점수 경계값에서 BEST/GOOD/OK/CHECK 등급을 정확히 가른다', () => {
    expect(gradeFromScore(88)).toBe('BEST');
    expect(gradeFromScore(87)).toBe('GOOD');
    expect(gradeFromScore(74)).toBe('GOOD');
    expect(gradeFromScore(73)).toBe('OK');
    expect(gradeFromScore(58)).toBe('OK');
    expect(gradeFromScore(57)).toBe('CHECK');
  });
});

describe('scorePaletteDistance', () => {
  it('Delta E 거리 구간을 기준으로 점수를 완만하게 낮춘다', () => {
    expect(scorePaletteDistance(0)).toBe(100);
    expect(Math.round(scorePaletteDistance(5))).toBe(96);
    expect(Math.round(scorePaletteDistance(12))).toBe(86);
    expect(Math.round(scorePaletteDistance(22))).toBe(70);
    expect(Math.round(scorePaletteDistance(35))).toBe(45);
  });
});

describe('classifyHarmonyType', () => {
  it('Itten 색상환 각도 구간을 조화 유형으로 분류한다', () => {
    expect(classifyHarmonyType(0)).toBe('monochromatic');
    expect(classifyHarmonyType(15)).toBe('monochromatic');
    expect(classifyHarmonyType(16)).toBe('analogous');
    expect(classifyHarmonyType(45)).toBe('analogous');
    expect(classifyHarmonyType(46)).toBe('tension');
    expect(classifyHarmonyType(90)).toBe('tension');
    expect(classifyHarmonyType(135)).toBe('triadic');
    expect(classifyHarmonyType(180)).toBe('complementary');
  });
});

describe('hueAngleDiff', () => {
  it('보색(빨강↔시안)은 180도, 같은 색은 0도를 반환한다', () => {
    expect(Math.round(hueAngleDiff('#FF0000', '#00FFFF'))).toBe(180);
    expect(hueAngleDiff('#FF0000', '#FF0000')).toBe(0);
  });
});

describe('calculatePatternPenalty', () => {
  it('무지가 섞여 패턴이 1개 이하면 감점이 없다', () => {
    expect(calculatePatternPenalty([mockItem({ patternType: 'solid' }), mockItem({ patternType: 'solid' })])).toBe(0);
    expect(calculatePatternPenalty([mockItem({ patternType: 'stripe' }), mockItem({ patternType: 'solid' })])).toBe(0);
  });
  it('그래픽이 다른 패턴과 겹치면 22점, 같은 패턴 중복은 14점 감점한다', () => {
    expect(calculatePatternPenalty([mockItem({ patternType: 'graphic' }), mockItem({ patternType: 'stripe' })])).toBe(22);
    expect(calculatePatternPenalty([mockItem({ patternType: 'stripe' }), mockItem({ patternType: 'stripe' })])).toBe(14);
    expect(calculatePatternPenalty([mockItem({ patternType: 'stripe' }), mockItem({ patternType: 'plaid' })])).toBe(8);
  });
});

describe('calculateHarmonyScore', () => {
  it('색상 각도만 같아도 명도 대비가 너무 낮으면 조화 점수를 낮춘다', () => {
    const lowContrast = calculateHarmonyScore([
      mockItem({ category: '상의', representativeHex: '#4B5563' }),
      mockItem({ category: '하의', representativeHex: '#52525B' }),
    ], null);
    const balancedContrast = calculateHarmonyScore([
      mockItem({ category: '상의', representativeHex: '#FCA5A5' }),
      mockItem({ category: '하의', representativeHex: '#7F1D1D' }),
    ], null);

    expect(balancedContrast).toBeGreaterThan(lowContrast);
  });

  it('고채도 포인트 색이 둘 다 강하면 조화 점수를 보수적으로 조정한다', () => {
    const doublePoint = calculateHarmonyScore([
      mockItem({ category: '상의', representativeHex: '#FF0000' }),
      mockItem({ category: '하의', representativeHex: '#0000FF' }),
    ], null);
    const stabilized = calculateHarmonyScore([
      mockItem({ category: '상의', representativeHex: '#FF0000' }),
      mockItem({ category: '하의', representativeHex: '#111827', isNeutral: true }),
    ], null);

    expect(stabilized).toBeGreaterThan(doublePoint);
  });

  it('아우터가 있으면 안쪽 상하의뿐 아니라 바깥 레이어 조화도 반영한다', () => {
    const baseItems = [
      mockItem({ category: '상의', representativeHex: '#F5F5DC' }),
      mockItem({ category: '하의', representativeHex: '#1F2937', isNeutral: true }),
    ];
    const balancedOuter = calculateHarmonyScore([
      ...baseItems,
      mockItem({ category: '아우터', representativeHex: '#6B7280', isNeutral: true }),
    ], null);
    const clashingOuter = calculateHarmonyScore([
      ...baseItems,
      mockItem({ category: '아우터', representativeHex: '#00FF00' }),
    ], null);

    expect(balancedOuter).toBeGreaterThan(clashingOuter);
  });
});

describe('calculateHarmonyScore 절대 점수 회귀', () => {
  // 상수 근거화 리팩토링이 조화 점수를 바꾸지 않았음을 보장하는 절대값 스냅샷입니다.
  it('대표 색 조합의 절대 조화 점수를 고정한다', () => {
    const navyRed = calculateHarmonyScore([
      mockItem({ category: '상의', representativeHex: '#22334D' }),
      mockItem({ category: '하의', representativeHex: '#C7474C' }),
    ], null);
    const whiteDenim = calculateHarmonyScore([
      mockItem({ category: '상의', representativeHex: '#F7F7F4', isNeutral: true }),
      mockItem({ category: '하의', representativeHex: '#5C7898', isDenim: true }),
    ], null);
    const monoGray = calculateHarmonyScore([
      mockItem({ category: '상의', representativeHex: '#8B8F97' }),
      mockItem({ category: '하의', representativeHex: '#34363A' }),
    ], null);
    expect(Math.round(navyRed)).toMatchInlineSnapshot(`89`);
    expect(Math.round(whiteDenim)).toMatchInlineSnapshot(`85`);
    expect(Math.round(monoGray)).toMatchInlineSnapshot(`84`);
  });
});

describe('scoreItemForPersonalColor', () => {
  it('측정 결과가 없으면 점수 없이 안내 문구를 반환한다', () => {
    const item = { representativeHex: '#FF0000', dominantColors: [] } as unknown as ClothingItem;
    const scored = scoreItemForPersonalColor(item, null);
    expect(scored.personalFitScore).toBeNull();
    expect(scored.fitGrade).toBeNull();
    expect(scored.fitReason).toBe('측정 후 계산됨');
  });

  it('측정 결과가 있으면 시즌·색계열·적합 점수를 담은 사유를 만든다', () => {
    const scored = scoreItemForPersonalColor(mockItem({ representativeHex: '#22334D', dominantColors: [] }), mockResult);
    expect(scored.personalFitScore).not.toBeNull();
    expect(scored.fitReason).toContain('트루 윈터');
    expect(scored.fitReason).toContain('적합');
  });
});

describe('buildRecommendations', () => {
  it('후보가 없으면 빈 배열을 반환한다', () => {
    expect(buildRecommendations([], '상관없음', '데일리', null)).toEqual([]);
  });
  it('상의+하의 1쌍이면 점수가 매겨진 코디 1개를 만든다', () => {
    const items = [
      mockItem({ category: '상의', type: '반팔티' }),
      mockItem({ category: '하의', type: '슬랙스' }),
    ];
    const result = buildRecommendations(items, '상관없음', '데일리', null);
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(2);
    expect(result[0].score).toBeGreaterThan(0);
    expect(result[0].baseScore).toEqual(expect.any(Number));
    expect(result[0].qualityAdjustment).toBe(result[0].score - result[0].baseScore);
    expect(result[0].scoreBreakdown).toEqual({
      personal: expect.any(Number),
      weather: expect.any(Number),
      harmony: expect.any(Number),
      stability: expect.any(Number),
    });
    expect(result[0].explanationBullets).toHaveLength(3);
  });
  it('측정 결과가 있으면 reason 헤드라인에 시즌 이름을 넣고 고정 템플릿을 쓰지 않는다', () => {
    const items = [
      mockItem({ category: '상의', representativeHex: '#22334D' }),
      mockItem({ category: '하의', representativeHex: '#5C7898' }),
    ];
    const recs = buildRecommendations(items, '상관없음', '데일리', mockResult);
    expect(recs[0].reason).toContain('트루 윈터');
    expect(recs[0].reason).not.toContain('우선 반영');
  });
  it('추천제외/세탁중 상태의 의류는 후보에서 빠진다', () => {
    const items = [
      mockItem({ category: '상의', availabilityStatus: '추천제외' }),
      mockItem({ category: '하의' }),
    ];
    expect(buildRecommendations(items, '상관없음', '데일리', null)).toEqual([]);
  });
});

describe('buildAnchoredRecommendations', () => {
  it('기준 옷을 모든 결과 코디에 반드시 포함한다', () => {
    const anchor = mockItem({ id: 'anchor-top', category: '상의', representativeHex: '#22334D' });
    const pool = [
      mockItem({ id: 'b1', category: '하의', representativeHex: '#5C7898' }),
      mockItem({ id: 'b2', category: '하의', representativeHex: '#34363A' }),
      mockItem({ id: 'o1', category: '아우터', representativeHex: '#8B8F97' }),
    ];
    const recs = buildAnchoredRecommendations(anchor, pool, null);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((outfit) => outfit.items.some((item) => item.id === 'anchor-top'))).toBe(true);
  });

  it('기준 옷이 자기 자신과 묶이지 않는다', () => {
    const anchor = mockItem({ id: 'anchor-top', category: '상의' });
    const pool = [anchor, mockItem({ id: 'b1', category: '하의' })];
    const recs = buildAnchoredRecommendations(anchor, pool, null);
    expect(recs.every((outfit) => outfit.items.filter((item) => item.id === 'anchor-top').length === 1)).toBe(true);
  });

  it('상대 후보가 없으면 빈 배열을 반환한다', () => {
    const anchor = mockItem({ id: 'anchor-top', category: '상의' });
    expect(buildAnchoredRecommendations(anchor, [], null)).toEqual([]);
  });

  it('기준 옷이 모든 코디에 들어가도 결과가 3개로 잘리지 않고 상대 옷만큼 다양하게 나온다', () => {
    const anchor = mockItem({ id: 'anchor-top', category: '상의', representativeHex: '#22334D' });
    // 하의 12개(서로 다른 색). 표준 diversify라면 기준 옷이 3회 한도에 걸려 3개로 잘린다.
    const pool = Array.from({ length: 12 }, (_, index) =>
      mockItem({ id: `b${index}`, category: '하의', representativeHex: `#${(index * 111111).toString(16).padStart(6, '0').slice(0, 6)}` }),
    );
    const recs = buildAnchoredRecommendations(anchor, pool, null);
    expect(recs.length).toBe(12);
    expect(new Set(recs.flatMap((outfit) => outfit.items.map((item) => item.id).filter((id) => id !== 'anchor-top'))).size).toBe(12);
  });

  it('v1에서 신발·액세서리 기준은 빈 배열을 반환한다', () => {
    const anchor = mockItem({ id: 'shoes', category: '신발' });
    const pool = [mockItem({ category: '상의' }), mockItem({ category: '하의' })];
    expect(buildAnchoredRecommendations(anchor, pool, null)).toEqual([]);
  });

  it('기준 아우터는 상의와 하의를 함께 채운 코디를 만든다', () => {
    const anchor = mockItem({ id: 'anchor-outer', category: '아우터', representativeHex: '#34363A' });
    const pool = [
      mockItem({ id: 't1', category: '상의', representativeHex: '#F7F7F4' }),
      mockItem({ id: 'b1', category: '하의', representativeHex: '#5C7898' }),
    ];
    const recs = buildAnchoredRecommendations(anchor, pool, null);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].items).toHaveLength(3);
    expect(recs[0].items.some((item) => item.id === 'anchor-outer')).toBe(true);
  });
});

describe('groupByColorCombo', () => {
  it('대표색 버킷이 달라도 Lab 거리상 가까우면 같은 조합으로 묶는다', () => {
    const top = mockItem({ category: '상의', representativeHex: '#6F6F5E' });
    const bottom = mockItem({ category: '하의', representativeHex: '#1D4ED8' });
    const closeTop = mockItem({ id: 'close-top', category: '상의', representativeHex: '#747465' });
    const closeBottom = mockItem({ id: 'close-bottom', category: '하의', representativeHex: '#1E40AF' });
    const farTop = mockItem({ id: 'far-top', category: '상의', representativeHex: '#F97316' });
    const farBottom = mockItem({ id: 'far-bottom', category: '하의', representativeHex: '#FDE68A' });
    const baseOutfit: OutfitRecommendation = {
      id: 'outfit-1',
      title: '테스트 코디',
      harmonyType: 'neutral',
      score: 80,
      baseScore: 78,
      qualityAdjustment: 2,
      personalScore: 70,
      harmonyScore: 85,
      weatherScore: 72,
      stabilityScore: 92,
      items: [top, bottom],
      reason: '',
      scoreBreakdown: { personal: 27, weather: 16, harmony: 24, stability: 11 },
      explanationBullets: [],
      weatherBand: '상관없음',
      mode: '데일리',
    };
    const groups = groupByColorCombo([
      { ...baseOutfit, items: [top, bottom] },
      { ...baseOutfit, id: 'outfit-2', items: [closeTop, closeBottom] },
      { ...baseOutfit, id: 'outfit-3', score: 60, items: [farTop, farBottom] },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('비슷한 색 조합 1');
    expect(groups[0].outfits).toHaveLength(2);
    expect(groups[0].topHex).toBe('#6F6F5E');
    expect(groups[0].bottomHex).toBe('#1D4ED8');
  });
});

// A. Top1+Top2 신뢰도 융합 — 진단이 불확실하면 2순위 시즌 팔레트도 반영한다.
describe('scoreItemForPersonalColor — Top1+Top2 신뢰도 융합', () => {
  // Top1=트루윈터(쿨/딥), Top2=트루스프링(웜/브라이트). 웜 오렌지는 윈터엔 멀고 스프링엔 가깝다.
  const baseResult = {
    seasonTop1Id: 'true-winter',
    seasonTop1: '트루 윈터',
    seasonTop2Id: 'true-spring',
    seasonTop2: '트루 스프링',
    palette: ['#22334D', '#171717', '#F7F7F4'],
  };

  it('신뢰도가 낮으면 Top2(웜)에 맞는 색의 적합 점수가 올라간다', () => {
    const warmItem = mockItem({ representativeHex: '#F96822', dominantColors: [] });
    const lowConf = scoreItemForPersonalColor(warmItem, { ...baseResult, confidence: 0.5 } as unknown as FinalResult);
    const highConf = scoreItemForPersonalColor(warmItem, { ...baseResult, confidence: 0.95 } as unknown as FinalResult);
    expect(lowConf.personalFitScore!).toBeGreaterThan(highConf.personalFitScore!);
  });

  it('신뢰도(confidence)가 없으면 Top1만 보던 기존 동작과 동일하다', () => {
    const warmItem = mockItem({ representativeHex: '#F96822', dominantColors: [] });
    const withTop2NoConf = scoreItemForPersonalColor(warmItem, baseResult as unknown as FinalResult);
    const top1OnlyResult = scoreItemForPersonalColor(warmItem, {
      seasonTop1Id: 'true-winter', seasonTop1: '트루 윈터', palette: baseResult.palette,
    } as unknown as FinalResult);
    expect(withTop2NoConf.personalFitScore).toBe(top1OnlyResult.personalFitScore);
  });
});

// B. 신뢰도 기반 4축 가중 동적화 — 불확실하면 색 조화 비중이 커진다.
describe('buildRecommendations — 신뢰도 기반 가중 동적화', () => {
  it('퍼스널컬러 적합도가 낮고 조화가 높은 코디는, 신뢰도가 낮을 때 총점이 더 높다', () => {
    // personalFitScore를 낮게(30) 고정 → personal 축은 낮고 harmony 축은 높은 상황.
    const items = [
      mockItem({ category: '상의', representativeHex: '#FCA5A5', personalFitScore: 30 }),
      mockItem({ category: '하의', representativeHex: '#7F1D1D', personalFitScore: 30 }),
    ];
    const lowConf = buildRecommendations(items, '상관없음', '데일리', { seasonTop1Id: 'true-winter', seasonTop1: '트루 윈터', confidence: 0.5 } as unknown as FinalResult);
    const highConf = buildRecommendations(items, '상관없음', '데일리', { seasonTop1Id: 'true-winter', seasonTop1: '트루 윈터', confidence: 0.95 } as unknown as FinalResult);
    expect(lowConf[0].score).toBeGreaterThan(highConf[0].score);
  });

  it('신뢰도가 없으면 38/22/28/12 기준 가중으로 계산한다(기존 동작)', () => {
    const items = [mockItem({ category: '상의' }), mockItem({ category: '하의' })];
    const withResult = buildRecommendations(items, '상관없음', '데일리', { seasonTop1Id: 'true-winter', seasonTop1: '트루 윈터' } as unknown as FinalResult);
    expect(withResult[0].scoreBreakdown.personal).toBe(Math.round(withResult[0].personalScore * 0.38));
    expect(withResult[0].scoreBreakdown.harmony).toBe(Math.round(withResult[0].harmonyScore * 0.28));
  });
});

// C. 날씨 점수 — 밴드 인덱스 기반 판정 + '봄/가을' 간절기 가산.
describe('getWeatherScore — 밴드 인덱스 견고화', () => {
  it('겨울 옷은 한여름(28도 이상)에, 여름 옷은 한겨울(4도 이하)에 감점된다', () => {
    const winter = mockItem({ seasonTag: '겨울', type: '코트' });
    const summer = mockItem({ seasonTag: '여름', type: '반팔티' });
    expect(getWeatherScore(winter, '28도 이상')).toBeLessThan(getWeatherScore(winter, '4도 이하'));
    expect(getWeatherScore(summer, '4도 이하')).toBeLessThan(getWeatherScore(summer, '28도 이상'));
  });

  it("'봄/가을' 옷은 간절기(12~16도)에 가산되고 한여름엔 가산되지 않는다", () => {
    // 날씨 키워드와 무관한 type을 써서 봄/가을 간절기 가산(+6)만 비교한다.
    const springAutumn = mockItem({ seasonTag: '봄/가을', type: '기본' });
    expect(getWeatherScore(springAutumn, '12~16도')).toBeGreaterThan(getWeatherScore(springAutumn, '28도 이상'));
  });
});
