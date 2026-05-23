// 의류 적합도 점수와 코디 추천 조합을 계산하는 핵심 추천 엔진
/*
 * recommendationEngine.ts
 *
 * 의류 아이템에 퍼스널컬러 적합도, 날씨 적합도, 색상 조화, 착용 안정성을 계산해 코디 추천을 만듭니다.
 *
 * 점수 산출 축은 네 가지입니다.
 * 1. 퍼스널컬러 적합도 (scoreItemForPersonalColor): 의류 대표/주요 색상과 사용자 팔레트의 CIELAB Delta E 거리 기반.
 * 2. 색상 조화도 (calculateHarmonyScore): Itten 색상환의 hue 각도로 monochromatic/analogous/triadic/complementary를 분류하고
 *    시즌 대비 선호도로 가중을 조정하며, 패턴 충돌은 calculatePatternPenalty로 감점합니다.
 * 3. 날씨 적합도 (getWeatherScore): seasonTag, 의류 type 키워드, availabilityStatus를 종합합니다.
 * 4. 착용 안정성: 모든 아이템이 보유중일 때 가산점.
 *
 * 최종 점수는 buildRecommendations()에서 퍼스널컬러 38%, 날씨 22%, 색상 조화 28%, 안정성 12%로 합산합니다.
 * 가상착용 캔버스에 의류를 올리는 dailyLook 도메인 함수들은 App.tsx에 남아 있으며,
 * 이 모듈은 추천 점수 계산과 조합 생성에만 집중합니다.
 */
import { SEASON_PROFILES } from '../personalColorWorkbook';
import { SEASON_DETAILS } from '../seasonContent';
import type { FinalResult } from '../types';
import type { WeatherBand } from '../lib/weather';
import type {
  ClothingItem,
  FitGrade,
  OutfitRecommendation,
  RecommendationMode,
  RecommendationWeatherBand,
  ScoredClothingItem,
} from '../wardrobeTypes';
import { SEASON_LABELS, WEATHER_BAND_ORDER, WEATHER_RULES } from '../wardrobeConstants';
import { clamp, deltaE2000, hexToRgb, rgbToHsl, rgbToLab } from './colorUtils';
import type { LabColor } from './colorUtils';

// 선택된 기온 구간에 맞는 의류 키워드를 가져옵니다.
// 바로 아래 구간의 키워드도 함께 포함해 날씨 경계값에서 추천이 너무 급격히 바뀌지 않게 합니다.
export function getAllowedWeatherKeywords(band: RecommendationWeatherBand) {
  if (band === '상관없음') return [];
  const bandIndex = WEATHER_BAND_ORDER.indexOf(band);
  const lowerBand = bandIndex > 0 ? WEATHER_BAND_ORDER[bandIndex - 1] : null;
  return Array.from(new Set([...(WEATHER_RULES[band] ?? []), ...(lowerBand ? WEATHER_RULES[lowerBand] ?? [] : [])]));
}

// seasonTag 기반으로 현재 기온 구간에 맞지 않는 옷을 제외합니다.
// 겨울 옷은 더운 날, 여름 옷은 추운 날 추천에서 하드 컷합니다.
// 점수 조정은 getWeatherScore()가 담당하고, 이 함수는 명백히 맞지 않는 경우만 제외합니다.
export function isWeatherEligible(item: ScoredClothingItem, band: RecommendationWeatherBand): boolean {
  if (band === '상관없음') return true;
  const bandIndex = WEATHER_BAND_ORDER.indexOf(band as WeatherBand);
  if (item.seasonTag === '여름' && bandIndex <= 2) return false;
  if (item.seasonTag === '겨울' && bandIndex >= 5) return false;
  return true;
}

// 숫자 적합도 점수를 UI용 등급 라벨로 변환합니다.
export function gradeFromScore(score: number): FitGrade {
  if (score >= 88) return 'BEST';
  if (score >= 74) return 'GOOD';
  if (score >= 58) return 'OK';
  return 'CHECK';
}

export function scorePaletteDistance(distance: number): number {
  if (distance <= 5) return 100 - distance * 0.8;
  if (distance <= 12) return 96 - (distance - 5) * (10 / 7);
  if (distance <= 22) return 86 - (distance - 12) * 1.6;
  if (distance <= 35) return 70 - (distance - 22) * (25 / 13);
  return Math.max(0, 45 - (distance - 35) * 1.3);
}

// 단일 HEX에 대해 팔레트 점수와 회피 페널티를 계산합니다.
export function scoreSingleHex(
  hex: string,
  paletteLabs: LabColor[],
  avoidLabs: LabColor[],
): { paletteScore: number; avoidPenalty: number } {
  const lab = rgbToLab(hexToRgb(hex));
  const paletteDistance = Math.min(...paletteLabs.map((p) => deltaE2000(lab, p)));
  const avoidDistance = avoidLabs.length ? Math.min(...avoidLabs.map((a) => deltaE2000(lab, a))) : 100;
  return {
    paletteScore: scorePaletteDistance(paletteDistance),
    avoidPenalty: avoidDistance < 10 ? 22 : avoidDistance < 16 ? 10 : 0,
  };
}

// 의류 대표색과 사용자의 퍼스널컬러 팔레트를 비교해 의류 적합도를 계산합니다.
// dominantColors 배열이 있으면 최대 3색을 비율 가중 평균으로 매칭해 체크/스트라이프 의류 정확도를 높입니다.
export function scoreItemForPersonalColor(item: ClothingItem, result: FinalResult | null): ScoredClothingItem {
  if (!result) {
    return {
      ...item,
      personalFitScore: null,
      fitGrade: null,
      fitReason: '측정 후 계산됨',
      avoidRisk: false,
    };
  }

  const worstColors = SEASON_DETAILS[result.seasonTop1Id]?.worstColors ?? [];
  const paletteLabs = result.palette.map((hex) => rgbToLab(hexToRgb(hex)));
  const avoidLabs = worstColors.map((hex) => rgbToLab(hexToRgb(hex)));

  // dominantColors가 있으면 상위 3색 비율 가중 평균, 없으면 대표색 단일값 사용
  const colorSamples: { hex: string; ratio: number }[] =
    item.dominantColors && item.dominantColors.length > 0
      ? item.dominantColors.slice(0, 3).map((c) => ({ hex: c.hex ?? item.representativeHex, ratio: c.ratio ?? 1 }))
      : [{ hex: item.representativeHex, ratio: 1 }];

  const totalRatio = colorSamples.reduce((sum, c) => sum + c.ratio, 0) || 1;
  let weightedPaletteScore = 0;
  let weightedAvoidPenalty = 0;
  for (const { hex, ratio } of colorSamples) {
    const w = ratio / totalRatio;
    const { paletteScore, avoidPenalty } = scoreSingleHex(hex, paletteLabs, avoidLabs);
    weightedPaletteScore += paletteScore * w;
    weightedAvoidPenalty += avoidPenalty * w;
  }

  const utilityBonus = item.isNeutral || item.isDenim ? 3 : 0;
  const score = Math.max(0, Math.min(100, Math.round(weightedPaletteScore + utilityBonus - weightedAvoidPenalty)));

  return {
    ...item,
    personalFitScore: score,
    fitGrade: gradeFromScore(score),
    fitReason: `${SEASON_LABELS[result.seasonTop1Id]} 팔레트 기준 ${score}점`,
    avoidRisk: weightedAvoidPenalty > 5,
  };
}

// 의류 하나가 현재 날씨 구간에 얼마나 맞는지 점수화합니다.
// 상태값(세탁중/보관중/추천제외)도 함께 반영해 실제 착용 가능성을 점수에 넣습니다.
export function getWeatherScore(item: ScoredClothingItem, band: RecommendationWeatherBand) {
  if (band === '상관없음') {
    if (item.availabilityStatus === '추천제외') return 0;
    if (item.availabilityStatus === '세탁중') return 35;
    if (item.availabilityStatus === '보관중') return 55;
    return item.isNeutral || item.isDenim ? 82 : 72;
  }
  const keywords = getAllowedWeatherKeywords(band);
  if (item.availabilityStatus === '추천제외') return 0;
  if (item.availabilityStatus === '세탁중') return 20;
  if (item.availabilityStatus === '보관중') return 45;
  let score = 60;
  if (keywords.some((keyword) => item.type.includes(keyword))) score += 28;
  if (item.seasonTag === '사계절') score += 8;
  if (band.includes('28') && item.seasonTag === '겨울') score -= 30;
  if ((band.includes('4') || band.includes('5~8')) && item.seasonTag === '여름') score -= 25;
  return Math.max(0, Math.min(100, score));
}

// 같은 카탈로그 상품이 여러 번 추천 후보에 들어오는 것을 막기 위한 중복 기준 키입니다.
export function itemUniqueKey(item: ScoredClothingItem) {
  return item.catalogItemId ?? item.imageUrl;
}

// 추천 후보 배열에서 같은 상품을 한 번만 남깁니다.
export function dedupeRecommendationItems(items: ScoredClothingItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = itemUniqueKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 코디 조합 중복을 막기 위해 아이템 키를 정렬해 조합 키로 만듭니다.
export function outfitUniqueKey(items: ScoredClothingItem[]) {
  return items.map(itemUniqueKey).sort().join('|');
}

// HSL 색상환에서 두 HEX 색상의 hue 각도 차이를 0~180° 범위로 반환합니다.
export function hueAngleDiff(hex1: string, hex2: string): number {
  const h1 = rgbToHsl(hexToRgb(hex1)).h * 360;
  const h2 = rgbToHsl(hexToRgb(hex2)).h * 360;
  const diff = Math.abs(h1 - h2);
  return diff > 180 ? 360 - diff : diff;
}

// Itten 색상 이론에 따른 조화 유형과 기본 점수입니다.
export const HARMONY_BASE_SCORES: Record<string, number> = {
  monochromatic: 80,  // 0~15°: 같은 색 명도/채도 변주
  analogous: 82,      // 16~45°: 인접색, 차분하고 통일감 있음
  tension: 55,        // 46~90°: 어색한 충돌 구간
  triadic: 76,        // 91~135°: 균형 잡힌 3색 조화
  complementary: 88,  // 136~180°: 보색, 강하고 세련된 대비
};

export function classifyHarmonyType(angleDiff: number): string {
  if (angleDiff <= 15) return 'monochromatic';
  if (angleDiff <= 45) return 'analogous';
  if (angleDiff <= 90) return 'tension';
  if (angleDiff <= 135) return 'triadic';
  return 'complementary';
}

export const HARMONY_TITLE_KO: Record<string, string> = {
  monochromatic: '심플 모노톤',
  analogous: '자연스러운 유사색',
  tension: '포인트 배색',
  triadic: '다채로운 삼색',
  complementary: '선명한 대비',
  neutral: '차분한 무채색',
};

export const HARMONY_BADGE_KO: Record<string, string> = {
  monochromatic: '단색 조화',
  analogous: '유사색 조화',
  tension: '포인트 배색',
  triadic: '삼각 배색',
  complementary: '보색 대비',
  neutral: '무채색 조화',
};

export function getHarmonyType(items: ScoredClothingItem[]): string {
  const top = items.find((i) => i.category === '상의');
  const bottom = items.find((i) => i.category === '하의');
  if (!top || !bottom) return 'neutral';
  if (top.isNeutral || bottom.isNeutral) return 'neutral';
  return classifyHarmonyType(hueAngleDiff(top.representativeHex, bottom.representativeHex));
}

// 색상 버킷 레이블 (hue 각도 기반 8구간 + 무채색)
export const HUE_BUCKET_KO: Record<string, string> = {
  red: '빨강', orange: '주황', yellow: '노랑', green: '초록',
  cyan: '청록', blue: '파랑', purple: '보라', pink: '분홍', neutral: '무채색',
};

// hex 색상을 hue 버킷으로 분류합니다. 채도 0.15 미만은 무채색으로 처리합니다.
export function getHueBucket(hex: string): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  if (hsl.s < 0.08) return 'neutral';
  const h = hsl.h * 360;
  if (h < 20 || h >= 340) return 'red';
  if (h < 45) return 'orange';
  if (h < 75) return 'yellow';
  if (h < 155) return 'green';
  if (h < 195) return 'cyan';
  if (h < 255) return 'blue';
  if (h < 315) return 'purple';
  return 'pink';
}

export interface ColorGroup {
  key: string;
  label: string;
  topBucket: string;
  bottomBucket: string;
  topHex: string;
  bottomHex: string;
  outfits: OutfitRecommendation[];
}

const COLOR_GROUP_DELTA_E_THRESHOLD = 22;

function colorDistance(leftHex: string, rightHex: string): number {
  return deltaE2000(rgbToLab(hexToRgb(leftHex)), rgbToLab(hexToRgb(rightHex)));
}

function findSimilarColorGroup(groups: ColorGroup[], topHex: string, bottomHex: string): ColorGroup | undefined {
  return groups.find((group) =>
    colorDistance(group.topHex, topHex) <= COLOR_GROUP_DELTA_E_THRESHOLD &&
    colorDistance(group.bottomHex, bottomHex) <= COLOR_GROUP_DELTA_E_THRESHOLD,
  );
}

// 추천 결과를 고정 hue 버킷이 아니라 실제 Lab 거리상 가까운 상의×하의 조합으로 묶습니다.
export function groupByColorCombo(outfits: OutfitRecommendation[]): ColorGroup[] {
  const groups: ColorGroup[] = [];
  for (const outfit of outfits) {
    const top = outfit.items.find((i) => i.category === '상의');
    const bottom = outfit.items.find((i) => i.category === '하의');
    const topHex = top?.representativeHex ?? '#888888';
    const bottomHex = bottom?.representativeHex ?? '#888888';
    const tb = top ? getHueBucket(top.representativeHex) : 'neutral';
    const bb = bottom ? getHueBucket(bottom.representativeHex) : 'neutral';
    const existing = findSimilarColorGroup(groups, topHex, bottomHex);
    if (existing) {
      existing.outfits.push(outfit);
    } else {
      const index = groups.length + 1;
      groups.push({
        key: `lab-${index}`,
        label: `비슷한 색 조합 ${index}`,
        topBucket: tb,
        bottomBucket: bb,
        topHex,
        bottomHex,
        outfits: [],
      });
      groups[groups.length - 1].outfits.push(outfit);
    }
  }
  // 그룹 내 최고 점수 기준 내림차순 정렬
  return groups.sort((a, b) => b.outfits[0].score - a.outfits[0].score);
}

export function scoreGrade(score: number): string {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

const SCORE_WEIGHTS = {
  personal: 0.38,
  weather: 0.22,
  harmony: 0.28,
  stability: 0.12,
} as const;

const HARMONY_REASON_KO: Record<string, string> = {
  monochromatic: '상하의 색상 차이가 작아 차분한 톤온톤 조합입니다.',
  analogous: '상하의 색상이 가까운 범위에 있어 자연스럽게 이어지는 조합입니다.',
  tension: '상하의 색상 차이가 커서 포인트가 생기는 조합입니다.',
  triadic: '색상 차이가 뚜렷하지만 직접적인 보색 충돌은 피한 조합입니다.',
  complementary: '상하의 색상 차이가 커서 대비가 분명한 조합입니다.',
  neutral: '중립색이 포함되어 다른 색을 받쳐 주는 안정적인 조합입니다.',
};

function describePersonalFit(items: ScoredClothingItem[], personalScore: number, result: FinalResult | null): string {
  const scoredItems = items.filter((item) => item.personalFitScore !== null);
  if (!result || scoredItems.length === 0) {
    return '퍼스널컬러 진단 결과가 없어 기본 적합도 기준으로 계산했습니다.';
  }

  const bestItem = scoredItems.reduce((best, item) =>
    (item.personalFitScore ?? 0) > (best.personalFitScore ?? 0) ? item : best,
  );
  const avoidCount = scoredItems.filter((item) => item.avoidRisk).length;
  const seasonName = result.seasonTop1 || SEASON_LABELS[result.seasonTop1Id];
  const avoidText = avoidCount > 0 ? ` 회피색에 가까운 색이 ${avoidCount}개 있어 감점이 반영됐습니다.` : ' 회피색 근접 감점은 없습니다.';
  return `${seasonName} 기준 평균 ${personalScore}점입니다. ${bestItem.type}의 색상 적합도가 가장 높습니다.${avoidText}`;
}

function describeWeatherFit(items: ScoredClothingItem[], weatherScore: number, band: RecommendationWeatherBand): string {
  const unavailableCount = items.filter((item) => item.availabilityStatus !== '보유중').length;
  const bandText = band === '상관없음' ? '날씨 조건을 고정하지 않고' : `${band} 날씨 조건에서`;
  const stateText = unavailableCount > 0 ? ` 착용 상태가 낮은 항목 ${unavailableCount}개가 있어 점수가 조정됐습니다.` : ' 모두 바로 입을 수 있는 상태입니다.';
  return `${bandText} 날씨 적합도는 ${weatherScore}점입니다.${stateText}`;
}

function describeHarmonyFit(items: ScoredClothingItem[], harmonyType: string, harmonyScore: number): string {
  const top = items.find((item) => item.category === '상의');
  const bottom = items.find((item) => item.category === '하의');
  const roundedScore = Math.round(harmonyScore);
  const angleText = top && bottom && !top.isNeutral && !bottom.isNeutral
    ? ` 색상 각도 차이는 약 ${Math.round(hueAngleDiff(top.representativeHex, bottom.representativeHex))}도입니다.`
    : '';
  return `${HARMONY_REASON_KO[harmonyType] ?? '색상 조합을 기준으로 계산했습니다.'} 조화 점수는 ${roundedScore}점입니다.${angleText}`;
}

function buildExplanationBullets(
  items: ScoredClothingItem[],
  personalScore: number,
  weatherScore: number,
  harmonyScore: number,
  harmonyType: string,
  band: RecommendationWeatherBand,
  result: FinalResult | null,
): string[] {
  return [
    describePersonalFit(items, personalScore, result),
    describeHarmonyFit(items, harmonyType, harmonyScore),
    describeWeatherFit(items, weatherScore, band),
  ];
}

// 코디 내 패턴 조합 페널티를 계산합니다. 그래픽+솔리드, 같은 패턴 중복은 감점됩니다.
export function calculatePatternPenalty(items: ScoredClothingItem[]): number {
  const patterns = items.map((i) => i.patternType).filter((p) => p !== 'solid');
  if (patterns.length <= 1) return 0;
  if (patterns.includes('graphic') && patterns.length > 1) return 22;
  if (patterns[0] === patterns[1]) return 14;
  return 8;
}

function colorHarmonyFeatures(hex: string) {
  const hsl = rgbToHsl(hexToRgb(hex));
  return {
    lightness: hsl.l,
    saturation: hsl.s,
  };
}

function calculateLightnessBalanceScore(firstHex: string, secondHex: string): number {
  const first = colorHarmonyFeatures(firstHex);
  const second = colorHarmonyFeatures(secondHex);
  const diff = Math.abs(first.lightness - second.lightness);
  const base = 100 - Math.abs(diff - 0.22) * 120;
  const lowContrastPenalty = diff < 0.08 ? 28 : 0;
  const highContrastPenalty = diff > 0.55 ? 10 : 0;
  return clamp(base - lowContrastPenalty - highContrastPenalty, 45, 100);
}

function calculateSaturationBalanceScore(firstHex: string, secondHex: string): number {
  const first = colorHarmonyFeatures(firstHex);
  const second = colorHarmonyFeatures(secondHex);
  const diff = Math.abs(first.saturation - second.saturation);
  const doublePointPenalty = first.saturation > 0.65 && second.saturation > 0.65 ? 12 : 0;
  const flatPenalty = first.saturation < 0.12 && second.saturation < 0.12 ? 6 : 0;
  return clamp(100 - diff * 45 - doublePointPenalty - flatPenalty, 45, 100);
}

function calculateUtilityStabilityBonus(items: ScoredClothingItem[]): number {
  const hasNeutral = items.some((item) => item.isNeutral);
  const hasDenim = items.some((item) => item.isDenim);
  const hasColorPoint = items.some((item) => colorHarmonyFeatures(item.representativeHex).saturation > 0.45);
  if (hasColorPoint && (hasNeutral || hasDenim)) return 6;
  if (hasNeutral || hasDenim) return 3;
  return 0;
}

function calculatePairHarmonyScore(first: ScoredClothingItem, second: ScoredClothingItem, result: FinalResult | null): number {
  const angleDiff = hueAngleDiff(first.representativeHex, second.representativeHex);
  const harmonyType = first.isNeutral || second.isNeutral ? 'neutral' : classifyHarmonyType(angleDiff);
  const hueScore = HARMONY_BASE_SCORES[harmonyType] ?? 85;
  const lightnessScore = calculateLightnessBalanceScore(first.representativeHex, second.representativeHex);
  const saturationScore = calculateSaturationBalanceScore(first.representativeHex, second.representativeHex);
  let score = hueScore * 0.5 + lightnessScore * 0.3 + saturationScore * 0.2;

  const preferredContrast = result ? SEASON_PROFILES[result.seasonTop1Id].traits.contrast : 0;
  if (harmonyType === 'complementary') score += preferredContrast > 0.5 ? 6 : preferredContrast < -0.2 ? -10 : 0;
  if (harmonyType === 'analogous') score += preferredContrast < -0.2 ? 6 : 0;

  return score;
}

// Itten 색상 이론 기반 hue 각도에 명도와 채도를 더하고, 아우터가 있으면 바깥 레이어까지 함께 평가합니다.
export function calculateHarmonyScore(items: ScoredClothingItem[], result: FinalResult | null): number {
  const top = items.find((i) => i.category === '상의');
  const bottom = items.find((i) => i.category === '하의');
  if (!top || !bottom) return 75;

  const patternPenalty = calculatePatternPenalty(items);
  const outer = items.find((i) => i.category === '아우터');

  let score = calculatePairHarmonyScore(top, bottom, result);
  if (outer) {
    score = score * 0.5
      + calculatePairHarmonyScore(outer, top, result) * 0.3
      + calculatePairHarmonyScore(outer, bottom, result) * 0.2;
  }
  score += calculateUtilityStabilityBonus(items);

  return Math.min(100, Math.max(0, score - patternPenalty));
}

function calculateBaseScore(personalScore: number, weatherScore: number, outfitItems: ScoredClothingItem[]): number {
  const harmonyType = getHarmonyType(outfitItems);
  const legacyHarmonyScore = HARMONY_BASE_SCORES[harmonyType] ?? 75;
  const stabilityScore = outfitItems.every((item) => item.availabilityStatus === '보유중') ? 92 : 68;
  return Math.round(
    personalScore * SCORE_WEIGHTS.personal +
    weatherScore * SCORE_WEIGHTS.weather +
    legacyHarmonyScore * SCORE_WEIGHTS.harmony +
    stabilityScore * SCORE_WEIGHTS.stability,
  );
}

// 동일 아이템이 결과 목록에 과도하게 반복되지 않도록 아이템당 최대 등장 횟수를 제한합니다.
export function diversifyRecommendations(outfits: OutfitRecommendation[], maxPerItem = 3): OutfitRecommendation[] {
  const appearances = new Map<string, number>();
  return outfits.filter((outfit) => {
    if (outfit.items.some((item) => (appearances.get(item.id) ?? 0) >= maxPerItem)) return false;
    outfit.items.forEach((item) => appearances.set(item.id, (appearances.get(item.id) ?? 0) + 1));
    return true;
  });
}

// 상의/하의/아우터/신발 후보를 조합해 코디 추천 리스트를 만듭니다.
// 최종 점수는 퍼스널컬러 38%, 날씨 22%, 색상 조화 28%, 착용 안정성 12%로 계산합니다.
export function buildRecommendations(items: ScoredClothingItem[], band: RecommendationWeatherBand, mode: RecommendationMode, result: FinalResult | null): OutfitRecommendation[] {
  const available = dedupeRecommendationItems(items.filter((item) => item.availabilityStatus !== '추천제외' && item.availabilityStatus !== '세탁중'));
  const weatherFiltered = band === '상관없음' ? available : available.filter((item) => isWeatherEligible(item, band));
  const tops = weatherFiltered.filter((item) => item.category === '상의');
  const bottoms = weatherFiltered.filter((item) => item.category === '하의');
  const outerwear = weatherFiltered.filter((item) => item.category === '아우터');
  const outfits: OutfitRecommendation[] = [];
  const seenOutfits = new Set<string>();
  const outerOptions = [undefined, ...outerwear.sort((a, b) => getWeatherScore(b, band) - getWeatherScore(a, band))];

  tops.forEach((top) => {
    bottoms.forEach((bottom) => {
      outerOptions.forEach((outer) => {
        const outfitItems = dedupeRecommendationItems([outer, top, bottom].filter(Boolean) as ScoredClothingItem[]);
        if (outfitItems.length < 2) return;
        const key = outfitUniqueKey(outfitItems);
        if (seenOutfits.has(key)) return;
        seenOutfits.add(key);
        const personalScore = Math.round(outfitItems.reduce((sum, item) => sum + (item.personalFitScore ?? 55), 0) / outfitItems.length);
        const weatherScore = Math.round(outfitItems.reduce((sum, item) => sum + getWeatherScore(item, band), 0) / outfitItems.length);
        const harmonyScore = calculateHarmonyScore(outfitItems, result);
        const stabilityScore = outfitItems.every((item) => item.availabilityStatus === '보유중') ? 92 : 68;
        const scoreBreakdown = {
          personal: Math.round(personalScore * SCORE_WEIGHTS.personal),
          weather: Math.round(weatherScore * SCORE_WEIGHTS.weather),
          harmony: Math.round(harmonyScore * SCORE_WEIGHTS.harmony),
          stability: Math.round(stabilityScore * SCORE_WEIGHTS.stability),
        };
        const score = scoreBreakdown.personal + scoreBreakdown.weather + scoreBreakdown.harmony + scoreBreakdown.stability;
        const baseScore = calculateBaseScore(personalScore, weatherScore, outfitItems);
        const harmonyType = getHarmonyType(outfitItems);
        outfits.push({
          id: `${top.id}-${bottom.id}-${outer?.id ?? 'noouter'}`,
          title: `${HARMONY_TITLE_KO[harmonyType] ?? ''} ${mode} 코디`,
          harmonyType,
          score,
          baseScore,
          qualityAdjustment: score - baseScore,
          personalScore,
          harmonyScore,
          weatherScore,
          stabilityScore,
          items: outfitItems,
          reason: band === '상관없음' ? '퍼스널 컬러 적합도와 코디 안정성을 우선 반영했습니다.' : `퍼스널 컬러 적합도와 ${band} 날씨 조건을 함께 반영했습니다.`,
          scoreBreakdown,
          explanationBullets: buildExplanationBullets(outfitItems, personalScore, weatherScore, harmonyScore, harmonyType, band, result),
          weatherBand: band,
          mode,
        });
      });
    });
  });

  return diversifyRecommendations(outfits.sort((a, b) => b.score - a.score).slice(0, 60));
}
