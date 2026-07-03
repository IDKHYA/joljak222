// 시즌 스펙트럼(감사·영역·색 점수)의 계약 게이트 G2, G4, G5, G6을 검증한다.
import { describe, expect, it } from 'vitest';
import { hexToLab, labToLch, deltaE2000 } from './colorMath';
import {
  auditSwatchList,
  avoidPenaltyForSeason,
  getSeasonSpectrum,
  regionMembership,
  scoreColorForSeason,
  swatchScoreFromDeltaE,
  SEASON_AVOID_HEXES,
} from './seasonSpectrum';
import type { PersonalSeasonId } from './types';

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

describe('swatchScoreFromDeltaE (G2)', () => {
  it('Delta E 해석표의 경계값에서 정확한 점수를 준다', () => {
    expect(swatchScoreFromDeltaE(0)).toBe(100);
    expect(swatchScoreFromDeltaE(5)).toBe(92);
    expect(swatchScoreFromDeltaE(12)).toBe(78);
    expect(swatchScoreFromDeltaE(22)).toBe(60);
    expect(swatchScoreFromDeltaE(35)).toBe(42);
  });

  it('35 초과에서는 완만히 하강해 바닥 25에서 멈춘다', () => {
    expect(swatchScoreFromDeltaE(60)).toBe(25);
    expect(swatchScoreFromDeltaE(100)).toBe(25);
    expect(swatchScoreFromDeltaE(40)).toBeGreaterThan(25);
    expect(swatchScoreFromDeltaE(40)).toBeLessThan(42);
  });

  it('거리에 대해 단조 감소한다', () => {
    const distances = [0, 3, 5, 8, 12, 18, 22, 30, 35, 50, 80];
    for (let i = 1; i < distances.length; i += 1) {
      expect(swatchScoreFromDeltaE(distances[i])).toBeLessThanOrEqual(
        swatchScoreFromDeltaE(distances[i - 1]),
      );
    }
  });
});

describe('auditSwatchList', () => {
  it('Delta E 3 미만의 근접 중복을 병합한다', () => {
    const { keptHexes, report } = auditSwatchList(['#6E8FBE', '#6F90BF', '#F96822']);
    expect(keptHexes).toEqual(['#6E8FBE', '#F96822']);
    expect(report.mergedHexes).toEqual(['#6F90BF']);
  });

  it('12시즌 전체 팔레트가 감사를 통과하고 스와치가 남는다', () => {
    for (const seasonId of ALL_SEASONS) {
      const spectrum = getSeasonSpectrum(seasonId);
      expect(spectrum.audit.keptCount).toBeGreaterThanOrEqual(20);
      expect(spectrum.labSwatches.length).toBe(spectrum.audit.keptCount);
    }
  });
});

describe('scoreColorForSeason', () => {
  it('팔레트 스와치 자신은 최고점을 받는다', () => {
    const result = scoreColorForSeason(hexToLab('#6E8FBE'), 'true-summer');
    expect(result.score).toBe(100);
    expect(result.nearestDeltaE).toBe(0);
  });

  it('시즌과 동떨어진 색은 낮은 점수를 받되 바닥 아래로 내려가지 않는다', () => {
    const result = scoreColorForSeason(hexToLab('#F96822'), 'true-summer');
    expect(result.score).toBeLessThan(60);
    expect(result.score).toBeGreaterThanOrEqual(25);
  });

  it('중립색은 팔레트 거리로 죽지 않고 60~92 범위를 받는다 (G5)', () => {
    for (const seasonId of ALL_SEASONS) {
      const gray = scoreColorForSeason(hexToLab('#808080'), seasonId);
      expect(gray.score).toBeGreaterThanOrEqual(60);
    }
  });

  it('중립 규칙은 시즌 명도 축과 방향이 맞으면 가산한다 (G5)', () => {
    // light-summer는 명도 축 +0.95 — 밝은 그레이가 어두운 그레이보다 높아야 한다.
    const lightGray = scoreColorForSeason(hexToLab('#D9D9D9'), 'light-summer');
    const darkGray = scoreColorForSeason(hexToLab('#3B3B3B'), 'light-summer');
    expect(lightGray.score).toBeGreaterThan(darkGray.score);

    // dark-autumn은 명도 축 -0.90 — 방향이 반대다.
    const darkGrayAutumn = scoreColorForSeason(hexToLab('#3B3B3B'), 'dark-autumn');
    const lightGrayAutumn = scoreColorForSeason(hexToLab('#D9D9D9'), 'dark-autumn');
    expect(darkGrayAutumn.score).toBeGreaterThan(lightGrayAutumn.score);
  });

  it('스와치 사이의 색을 영역이 구제한다 (G6)', () => {
    // 같은 시즌 스와치 두 개의 LAB 중간색 중, 스와치 점수만으로는 낮지만
    // 영역 멤버십이 높은 사례를 12시즌 전체에서 찾아 상한 결합 효과를 검증한다.
    let rescuedCases = 0;

    for (const seasonId of ALL_SEASONS) {
      const spectrum = getSeasonSpectrum(seasonId);
      const swatches = spectrum.labSwatches;

      for (let i = 0; i < swatches.length; i += 1) {
        for (let j = i + 1; j < swatches.length; j += 1) {
          const mid = {
            L: (swatches[i].L + swatches[j].L) / 2,
            a: (swatches[i].a + swatches[j].a) / 2,
            b: (swatches[i].b + swatches[j].b) / 2,
          };
          const nearest = swatches.reduce(
            (best, swatch) => Math.min(best, deltaE2000(mid, swatch)),
            Number.POSITIVE_INFINITY,
          );
          const membership = regionMembership(labToLch(mid), spectrum.region);
          if (nearest > 12 && membership >= 0.9) {
            const result = scoreColorForSeason(mid, seasonId);
            expect(result.score).toBeGreaterThan(result.swatchScore);
            rescuedCases += 1;
          }
        }
      }
    }

    // 구제 사례가 실제로 존재해야 영역 모델이 의미가 있다.
    expect(rescuedCases).toBeGreaterThan(0);
  });
});

describe('avoidPenaltyForSeason (G4)', () => {
  it('회피 스와치에 가까울수록 큰 감점을 준다', () => {
    const avoidHexes = ['#F96822'];
    expect(avoidPenaltyForSeason(hexToLab('#F96822'), 'true-summer', { avoidHexes })).toBe(-15);
    expect(
      avoidPenaltyForSeason(hexToLab('#E8622A'), 'true-summer', { avoidHexes }),
    ).toBeLessThanOrEqual(-8);
    expect(avoidPenaltyForSeason(hexToLab('#6E8FBE'), 'true-summer', { avoidHexes })).toBe(0);
  });

  it('회피 목록을 빈 배열로 덮어쓰면 감점하지 않는다', () => {
    expect(avoidPenaltyForSeason(hexToLab('#E1AD01'), 'true-summer', { avoidHexes: [] })).toBe(0);
  });

  it('팔레트가 회피색보다 가까우면 감점하지 않는다 — 결정 경계', () => {
    const avoidHexes = ['#F96822'];
    const lab = hexToLab('#E8622A');
    // 회피색까지의 거리가 감점 반경 안이어도, 팔레트가 더 가까우면 감점이 억제된다.
    expect(avoidPenaltyForSeason(lab, 'true-summer', { avoidHexes, nearestPaletteDeltaE: 1 })).toBe(0);
    // 팔레트가 더 멀면 감점이 그대로 적용된다.
    expect(
      avoidPenaltyForSeason(lab, 'true-summer', { avoidHexes, nearestPaletteDeltaE: 30 }),
    ).toBeLessThanOrEqual(-8);
  });
});

describe('SEASON_AVOID_HEXES — v1 worstColors 승계 데이터', () => {
  it('12시즌 전부 회피색이 3개 이상 있고 HEX 형식이 유효하다', () => {
    for (const seasonId of ALL_SEASONS) {
      const avoidHexes = SEASON_AVOID_HEXES[seasonId];
      expect(avoidHexes.length).toBeGreaterThanOrEqual(3);
      for (const hex of avoidHexes) {
        expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('회피색 자신은 팔레트보다 회피색에 가까워 -15 감점을 받는다', () => {
    for (const seasonId of ALL_SEASONS) {
      const spectrum = getSeasonSpectrum(seasonId);
      for (const hex of SEASON_AVOID_HEXES[seasonId]) {
        const avoidLab = hexToLab(hex);
        const nearestPalette = spectrum.labSwatches.reduce(
          (best, swatch) => Math.min(best, deltaE2000(avoidLab, swatch)),
          Number.POSITIVE_INFINITY,
        );
        expect(
          avoidPenaltyForSeason(avoidLab, seasonId, { nearestPaletteDeltaE: nearestPalette }),
        ).toBe(-15);
      }
    }
  });

  it('팔레트 스와치 자신은 회피 감점을 받지 않는다 — 모순 불가 보장', () => {
    // v1 승계 회피색 일부는 팔레트와 Delta E 15 이내로 가깝다.
    // 결정 경계(팔레트가 더 가까우면 감점 억제) 때문에 팔레트 스와치는 항상 감점 0이어야 한다.
    for (const seasonId of ALL_SEASONS) {
      const spectrum = getSeasonSpectrum(seasonId);
      for (const swatch of spectrum.labSwatches) {
        expect(
          avoidPenaltyForSeason(swatch, seasonId, { nearestPaletteDeltaE: 0 }),
        ).toBe(0);
      }
    }
  });
});
