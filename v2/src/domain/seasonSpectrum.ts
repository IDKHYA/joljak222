// 12계절 팔레트를 점+영역 스펙트럼으로 재가공하고 색 하나의 퍼컬 적합 점수를 계산한다. (도메인개념_고도화_v2.md §2~§3)
import { SEASON_PROFILES } from '../personalColorWorkbook';
import { SEASON_DETAILS } from '../seasonContent';
import type { Lab, Lch } from './colorMath';
import { deltaE2000, hexToLab, labToLch, hueAngleDistance, trapezoidMembership } from './colorMath';
import type { PersonalSeasonId } from './types';

// 무채색 판정 채도 경계. C*가 이 값 미만이면 색상각이 무의미하다.
export const NEUTRAL_CHROMA_LIMIT = 12;

// 시즌별 회피색 목록 — v1에서 검증된 SEASON_DETAILS.worstColors를 승계한다.
// 새로 발명하지 않는 이유는, 이 값이 v1 결과 화면(피해야 하는 색상)과 v1 의류 적합도 감점에
// 이미 쓰이던 사용자 대면 데이터라 v2 설명 문구와도 일치해야 하기 때문이다.
export const SEASON_AVOID_HEXES: Record<PersonalSeasonId, string[]> = Object.fromEntries(
  (Object.keys(SEASON_DETAILS) as PersonalSeasonId[]).map((seasonId) => [
    seasonId,
    [...SEASON_DETAILS[seasonId].worstColors],
  ]),
) as Record<PersonalSeasonId, string[]>;

export interface SwatchAuditReport {
  keptCount: number;
  mergedHexes: string[];
  outlierHexes: string[];
}

export interface SeasonRegion {
  lRange: [number, number];
  cRange: [number, number];
  chromaticHues: number[];
}

interface SeasonSpectrum {
  labSwatches: Lab[];
  region: SeasonRegion;
  audit: SwatchAuditReport;
}

const REGION_MARGIN_L = 6;
const REGION_MARGIN_C = 5;
const HUE_WINDOW = 12;
const SLOPE_L = 8;
const SLOPE_C = 6;
const SLOPE_H = 10;
const REGION_TRUST = 0.92;
const DUPLICATE_DELTA_E = 3;

const spectrumCache = new Map<PersonalSeasonId, SeasonSpectrum>();

// 스와치 목록 감사 — 중복 병합, 이상치 표시. 이상치는 수동 확인 전까지 유지한다.
export function auditSwatchList(hexes: string[]): { keptHexes: string[]; report: SwatchAuditReport } {
  const keptHexes: string[] = [];
  const keptLabs: Lab[] = [];
  const mergedHexes: string[] = [];

  for (const hex of hexes) {
    const lab = hexToLab(hex);
    const isDuplicate = keptLabs.some((kept) => deltaE2000(kept, lab) < DUPLICATE_DELTA_E);
    if (isDuplicate) {
      mergedHexes.push(hex);
    } else {
      keptHexes.push(hex);
      keptLabs.push(lab);
    }
  }

  const outlierHexes: string[] = [];
  if (keptLabs.length >= 3) {
    const meanDistances = keptLabs.map((lab, index) => {
      const others = keptLabs.filter((_, otherIndex) => otherIndex !== index);
      return others.reduce((sum, other) => sum + deltaE2000(lab, other), 0) / others.length;
    });
    const overallMean = meanDistances.reduce((sum, value) => sum + value, 0) / meanDistances.length;
    const variance =
      meanDistances.reduce((sum, value) => sum + (value - overallMean) ** 2, 0) / meanDistances.length;
    const stdDev = Math.sqrt(variance);
    meanDistances.forEach((distance, index) => {
      if (distance > overallMean + 2 * stdDev) outlierHexes.push(keptHexes[index]);
    });
  }

  return {
    keptHexes,
    report: { keptCount: keptHexes.length, mergedHexes, outlierHexes },
  };
}

export function getSeasonSpectrum(seasonId: PersonalSeasonId): SeasonSpectrum {
  const cached = spectrumCache.get(seasonId);
  if (cached) return cached;

  const palette = SEASON_PROFILES[seasonId].palette;
  const { keptHexes, report } = auditSwatchList(palette);
  const labSwatches = keptHexes.map(hexToLab);
  const lchSwatches = labSwatches.map(labToLch);

  const lValues = lchSwatches.map((lch) => lch.L).sort((a, b) => a - b);
  const cValues = lchSwatches.map((lch) => lch.C).sort((a, b) => a - b);
  const chromaticHues = lchSwatches
    .filter((lch) => lch.C >= NEUTRAL_CHROMA_LIMIT)
    .map((lch) => lch.h);

  const spectrum: SeasonSpectrum = {
    labSwatches,
    region: {
      lRange: [percentile(lValues, 0.1) - REGION_MARGIN_L, percentile(lValues, 0.9) + REGION_MARGIN_L],
      cRange: [
        Math.max(0, percentile(cValues, 0.1) - REGION_MARGIN_C),
        percentile(cValues, 0.9) + REGION_MARGIN_C,
      ],
      chromaticHues,
    },
    audit: report,
  };

  spectrumCache.set(seasonId, spectrum);
  return spectrum;
}

// 영역 멤버십 — 세 축 중 가장 약한 축이 결정한다. 무채색은 색상각 축을 통과 처리한다.
export function regionMembership(lch: Lch, region: SeasonRegion): number {
  const memL = trapezoidMembership(lch.L, region.lRange[0], region.lRange[1], SLOPE_L);
  const memC = trapezoidMembership(lch.C, region.cRange[0], region.cRange[1], SLOPE_C);

  let memH = 1;
  if (lch.C >= NEUTRAL_CHROMA_LIMIT) {
    memH = region.chromaticHues.reduce((best, swatchHue) => {
      const distance = hueAngleDistance(lch.h, swatchHue);
      const membership =
        distance <= HUE_WINDOW ? 1 : Math.max(0, 1 - (distance - HUE_WINDOW) / SLOPE_H);
      return Math.max(best, membership);
    }, 0);
  }

  return Math.min(memL, memC, memH);
}

// Delta E → 점수 구간 선형 매핑. (§3.2, 게이트 G2)
export function swatchScoreFromDeltaE(distance: number): number {
  if (distance <= 5) return 100 - (distance / 5) * 8;
  if (distance <= 12) return 92 - ((distance - 5) / 7) * 14;
  if (distance <= 22) return 78 - ((distance - 12) / 10) * 18;
  if (distance <= 35) return 60 - ((distance - 22) / 13) * 18;
  return Math.max(25, 42 - (distance - 35) * (17 / 25));
}

export interface SeasonColorScore {
  score: number;
  swatchScore: number;
  regionScore: number;
  nearestDeltaE: number;
  usedNeutralRule: boolean;
}

// 색 하나의 시즌 적합 점수 — 스와치 최근접과 영역 멤버십의 상한 결합 + 중립 규칙. (§2.6, §3.4)
export function scoreColorForSeason(lab: Lab, seasonId: PersonalSeasonId): SeasonColorScore {
  const spectrum = getSeasonSpectrum(seasonId);
  const lch = labToLch(lab);

  const nearestDeltaE = spectrum.labSwatches.reduce(
    (best, swatch) => Math.min(best, deltaE2000(lab, swatch)),
    Number.POSITIVE_INFINITY,
  );
  const swatchScore = swatchScoreFromDeltaE(nearestDeltaE);
  const regionScore = 100 * regionMembership(lch, spectrum.region);
  const paletteScore = Math.max(swatchScore, REGION_TRUST * regionScore);

  if (lch.C < NEUTRAL_CHROMA_LIMIT) {
    const neutralScore = neutralScoreForSeason(lch, seasonId);
    if (neutralScore > paletteScore) {
      return { score: neutralScore, swatchScore, regionScore, nearestDeltaE, usedNeutralRule: true };
    }
  }

  return { score: paletteScore, swatchScore, regionScore, nearestDeltaE, usedNeutralRule: false };
}

// 무채색 전용 점수 — 팔레트 거리로 죽이지 않고 시즌 명도 축과의 정합만 소폭 반영한다.
function neutralScoreForSeason(lch: Lch, seasonId: PersonalSeasonId): number {
  const lightnessTrait = SEASON_PROFILES[seasonId].traits.lightness;
  let adjustment = 0;
  if ((lightnessTrait >= 0.2 && lch.L >= 65) || (lightnessTrait <= -0.2 && lch.L <= 40)) {
    adjustment = 10;
  } else if ((lightnessTrait >= 0.2 && lch.L <= 40) || (lightnessTrait <= -0.2 && lch.L >= 65)) {
    adjustment = -6;
  }
  return Math.max(60, Math.min(92, 78 + adjustment));
}

// 회피색 감점 — 회피 스와치 최근접 거리 기준. (§3.3, 게이트 G4)
// v1 승계 회피색 일부는 자기 팔레트와 Delta E 15 이내로 가깝다 (예: 다크 윈터의 페일 핑크 vs 팔레트 아이시 핑크).
// 그래서 감점은 회피색이 팔레트보다 "더 가까울 때만" 적용한다 — 팔레트 스와치 자신은 절대 감점받지 않는다.
export function avoidPenaltyForSeason(
  lab: Lab,
  seasonId: PersonalSeasonId,
  options?: { avoidHexes?: string[]; nearestPaletteDeltaE?: number },
): number {
  const avoidHexes = options?.avoidHexes ?? SEASON_AVOID_HEXES[seasonId] ?? [];
  if (avoidHexes.length === 0) return 0;

  const nearest = avoidHexes.reduce(
    (best, hex) => Math.min(best, deltaE2000(lab, hexToLab(hex))),
    Number.POSITIVE_INFINITY,
  );

  // 팔레트가 회피색보다 가깝거나 같으면 감점하지 않는다 (결정 경계, 동률은 팔레트 우선).
  if (options?.nearestPaletteDeltaE !== undefined && options.nearestPaletteDeltaE <= nearest) {
    return 0;
  }

  if (nearest < 8) return -15;
  if (nearest <= 15) return -8;
  return 0;
}

export function getSeasonTraits(seasonId: PersonalSeasonId): {
  temperature: number;
  lightness: number;
  clarity: number;
  contrast: number;
} {
  return SEASON_PROFILES[seasonId].traits;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}
