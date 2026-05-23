// 추천 엔진의 핵심 점수 함수에 대한 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  buildRecommendations,
  calculateHarmonyScore,
  calculatePatternPenalty,
  classifyHarmonyType,
  groupByColorCombo,
  gradeFromScore,
  hueAngleDiff,
  scorePaletteDistance,
  scoreItemForPersonalColor,
} from './recommendationEngine';
import type { ClothingItem, ScoredClothingItem } from '../wardrobeTypes';

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
});

describe('scoreItemForPersonalColor', () => {
  it('측정 결과가 없으면 점수 없이 안내 문구를 반환한다', () => {
    const item = { representativeHex: '#FF0000', dominantColors: [] } as unknown as ClothingItem;
    const scored = scoreItemForPersonalColor(item, null);
    expect(scored.personalFitScore).toBeNull();
    expect(scored.fitGrade).toBeNull();
    expect(scored.fitReason).toBe('측정 후 계산됨');
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
    expect(result[0].scoreBreakdown).toEqual({
      personal: expect.any(Number),
      weather: expect.any(Number),
      harmony: expect.any(Number),
      stability: expect.any(Number),
    });
    expect(result[0].explanationBullets).toHaveLength(3);
  });
  it('추천제외/세탁중 상태의 의류는 후보에서 빠진다', () => {
    const items = [
      mockItem({ category: '상의', availabilityStatus: '추천제외' }),
      mockItem({ category: '하의' }),
    ];
    expect(buildRecommendations(items, '상관없음', '데일리', null)).toEqual([]);
  });
});

describe('groupByColorCombo', () => {
  it('저채도 카키색은 무채색이 아니라 hue 기준 색상군으로 분류한다', () => {
    const top = mockItem({ category: '상의', representativeHex: '#6F6F5E' });
    const bottom = mockItem({ category: '하의', representativeHex: '#1D4ED8' });
    const groups = groupByColorCombo([{
      id: 'outfit-1',
      title: '테스트 코디',
      harmonyType: 'neutral',
      score: 80,
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
    }]);

    expect(groups[0].topBucket).toBe('yellow');
    expect(groups[0].bottomBucket).toBe('blue');
    expect(groups[0].topHex).toBe('#6F6F5E');
    expect(groups[0].bottomHex).toBe('#1D4ED8');
  });
});
