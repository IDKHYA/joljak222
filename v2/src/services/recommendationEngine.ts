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

// 진단 신뢰도가 낮을수록 2순위 시즌(Top2) 팔레트를 더 반영하는 가중치(0~TOP2_MAX_SHARE)를 계산합니다.
// 진단은 본질적으로 확률적(FinalResult가 Top1·Top2·confidence를 모두 가짐)인데, 추천이 1순위만 보면
// 경계선 진단(예: 트루윈터/쿨썸머 근접)에서 색 적합도가 brittle해진다. 그래서 신뢰도로 Top1↔Top2를 섞는다.
// 신뢰도 정보가 없으면(측정 전 mock 등) 0을 돌려 1순위만 본다 → 기존 동작 보존.
const TOP2_CONFIDENCE_FULL = 0.9; // 이 이상 신뢰도면 1순위만 신뢰(Top2 비중 0)
const TOP2_CONFIDENCE_FLOOR = 0.5; // 이 이하 신뢰도면 Top2를 최대로 반영
const TOP2_MAX_SHARE = 0.35; // Top2가 가질 수 있는 최대 비중
function computeTop2Share(confidence: number | undefined): number {
  if (typeof confidence !== 'number') return 0;
  const t = (TOP2_CONFIDENCE_FULL - confidence) / (TOP2_CONFIDENCE_FULL - TOP2_CONFIDENCE_FLOOR);
  return clamp(t, 0, 1) * TOP2_MAX_SHARE;
}

// 의류 대표색과 사용자의 퍼스널컬러 팔레트를 비교해 의류 적합도를 계산합니다.
// dominantColors 배열이 있으면 최대 3색을 비율 가중 평균으로 매칭해 체크/스트라이프 의류 정확도를 높입니다.
// 진단 신뢰도가 낮으면 Top1뿐 아니라 Top2 시즌 팔레트/회피색까지 신뢰도 가중으로 함께 평가합니다.
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

  // 1순위 시즌 팔레트/회피색
  const top1PaletteLabs = result.palette.map((hex) => rgbToLab(hexToRgb(hex)));
  const top1AvoidLabs = (SEASON_DETAILS[result.seasonTop1Id]?.worstColors ?? []).map((hex) => rgbToLab(hexToRgb(hex)));
  // 2순위 시즌 팔레트/회피색 — 신뢰도가 낮을 때만 비중을 갖는다. 프로필이 없으면 비중 0.
  const top2Profile = result.seasonTop2Id ? SEASON_PROFILES[result.seasonTop2Id] : undefined;
  const top2Share = top2Profile ? computeTop2Share(result.confidence) : 0;
  const top2PaletteLabs = top2Profile ? top2Profile.palette.map((hex) => rgbToLab(hexToRgb(hex))) : [];
  const top2AvoidLabs = (top2Share > 0 && result.seasonTop2Id ? SEASON_DETAILS[result.seasonTop2Id]?.worstColors ?? [] : []).map((hex) => rgbToLab(hexToRgb(hex)));

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
    const t1 = scoreSingleHex(hex, top1PaletteLabs, top1AvoidLabs);
    let paletteScore = t1.paletteScore;
    let avoidPenalty = t1.avoidPenalty;
    if (top2Share > 0) {
      // 신뢰도 가중으로 Top1·Top2 점수를 섞는다. 한 시즌에서만 어울리는 색도 경계선 진단에선 인정받는다.
      const t2 = scoreSingleHex(hex, top2PaletteLabs, top2AvoidLabs);
      paletteScore = paletteScore * (1 - top2Share) + t2.paletteScore * top2Share;
      avoidPenalty = avoidPenalty * (1 - top2Share) + t2.avoidPenalty * top2Share;
    }
    weightedPaletteScore += paletteScore * w;
    weightedAvoidPenalty += avoidPenalty * w;
  }

  const utilityBonus = item.isNeutral || item.isDenim ? 3 : 0;
  const score = Math.max(0, Math.min(100, Math.round(weightedPaletteScore + utilityBonus - weightedAvoidPenalty)));
  const avoidRisk = weightedAvoidPenalty > 5;

  return {
    ...item,
    personalFitScore: score,
    fitGrade: gradeFromScore(score),
    fitReason: buildFitReason(item, colorSamples, score, avoidRisk, result),
    avoidRisk,
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
  // 밴드 라벨 문자열(band.includes('28') 등)에 의존하면 라벨이 바뀔 때 깨진다. 구간 순서 인덱스로 판정한다.
  const bandIndex = WEATHER_BAND_ORDER.indexOf(band as WeatherBand);
  let score = 60;
  if (keywords.some((keyword) => item.type.includes(keyword))) score += 28;
  if (item.seasonTag === '사계절') score += 8;
  // '봄/가을' 옷은 간절기(9~22도, 인덱스 2~5)에 가장 적합 → 소폭 가산. 한여름·한겨울엔 가산 없음.
  if (item.seasonTag === '봄/가을' && bandIndex >= 2 && bandIndex <= 5) score += 6;
  if (bandIndex >= 7 && item.seasonTag === '겨울') score -= 30; // 28도 이상에 겨울옷
  if (bandIndex >= 0 && bandIndex <= 1 && item.seasonTag === '여름') score -= 25; // 8도 이하에 여름옷
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

// Itten 색상 이론의 배색 선호 서열을 0~100 척도에 배치한 hue 관계 기본 점수입니다.
// 50을 "겨우 쓸 만함" 기준선으로 두고, 고전적으로 안정적인 배색일수록 높게 줍니다.
// 보색(대비)·유사색(통일)이 가장 안정적이고, 색상환에서 어중간하게 떨어진 충돌 구간(tension)이 가장 약합니다.
// 각 구간의 각도 경계는 classifyHarmonyType()이 정의하며, 여기 점수와 1:1로 대응합니다.
export const HARMONY_BASE_SCORES: Record<string, number> = {
  monochromatic: 80,  // 0~15°: 톤온톤. 안전하지만 다소 밋밋해 보색·유사색보다 낮음
  analogous: 82,      // 16~45°: 인접색. 통일감 있고 자연스러워 높게 평가
  tension: 55,        // 46~90°: Itten이 부조화로 본 어중간한 거리. 가장 낮은 기준선
  triadic: 76,        // 91~135°: 삼각 배색. 균형은 잡히나 다소 번잡해 중상위
  complementary: 88,  // 136~180°: 보색. 가장 강하고 세련된 고전적 대비라 최고점
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

// 아이템별 적합 사유를 '시즌 팔레트 + 매칭된 색계열 + 적합 점수'로 합성합니다.
// 기존엔 "트루 윈터 팔레트 기준 87점"으로 시즌과 점수만 노출했는데,
// 어떤 색계열이 왜 맞는지(혹은 회피색에 가까운지)를 함께 보여 줍니다.
function buildFitReason(
  item: ClothingItem,
  colorSamples: { hex: string; ratio: number }[],
  score: number,
  avoidRisk: boolean,
  result: FinalResult,
): string {
  const seasonName = result.seasonTop1 || SEASON_LABELS[result.seasonTop1Id];
  const primaryHex = colorSamples[0]?.hex ?? item.representativeHex;
  const bucketKo = HUE_BUCKET_KO[getHueBucket(primaryHex)] ?? '대표색';
  if (avoidRisk) {
    return `${seasonName} 팔레트에서 ${bucketKo} 계열은 회피색에 가까워 감점 (적합 ${score})`;
  }
  const matchPhrase = score >= 74 ? '잘 맞음' : score >= 58 ? '무난함' : '거리가 있음';
  return `${seasonName} 팔레트의 ${bucketKo} 계열과 ${matchPhrase} (적합 ${score})`;
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

type ScoreWeights = { personal: number; weather: number; harmony: number; stability: number };

// 진단 신뢰도가 낮으면 퍼스널컬러 축(주관·진단 의존)을 덜 신뢰하고 그만큼 색 조화(객관 지표)로 비중을 옮긴다.
// 논문 §4-1-4의 "사진 품질이 낮으면 보조 신호 비중↑" 동적 융합 사상을 추천 가중치에 적용한 것이다.
// 신뢰도 정보가 없으면(null/측정 전) 기준 가중치(38/22/28/12)를 그대로 쓴다 → 기존 동작·회귀 보존.
const MAX_PERSONAL_TO_HARMONY_SHIFT = 0.12; // personal에서 harmony로 옮길 수 있는 최대 비중
const WEIGHT_CONFIDENCE_FULL = 0.9;
const WEIGHT_CONFIDENCE_FLOOR = 0.5;
function resolveScoreWeights(result: FinalResult | null): ScoreWeights {
  const confidence = result?.confidence;
  if (typeof confidence !== 'number') return { ...SCORE_WEIGHTS };
  const t = clamp((WEIGHT_CONFIDENCE_FULL - confidence) / (WEIGHT_CONFIDENCE_FULL - WEIGHT_CONFIDENCE_FLOOR), 0, 1);
  const shift = t * MAX_PERSONAL_TO_HARMONY_SHIFT;
  return {
    personal: SCORE_WEIGHTS.personal - shift,
    weather: SCORE_WEIGHTS.weather,
    harmony: SCORE_WEIGHTS.harmony + shift,
    stability: SCORE_WEIGHTS.stability,
  };
}

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

// 코디 카드 상단 한 줄 요약을 시즌 + 조화 유형 한글 라벨 + 적합 점수로 합성합니다.
// 기존엔 "퍼스널 컬러 적합도와 OO 날씨 조건을 함께 반영했습니다."라는 고정 문장이었는데,
// 측정 결과가 있으면 어떤 시즌에 어떤 배색이 맞는지를 점수와 함께 말해 줍니다.
function buildHeadlineReason(
  harmonyType: string,
  personalScore: number,
  band: RecommendationWeatherBand,
  result: FinalResult | null,
): string {
  const harmonyKo = HARMONY_TITLE_KO[harmonyType] ?? '코디';
  if (!result) {
    return band === '상관없음' ? `${harmonyKo} 코디` : `${band} 날씨에 맞춘 ${harmonyKo} 코디`;
  }
  const seasonName = result.seasonTop1 || SEASON_LABELS[result.seasonTop1Id];
  const weatherText = band === '상관없음' ? '' : ` · ${band}`;
  return `${seasonName}에 어울리는 ${harmonyKo} (적합 ${personalScore})${weatherText}`;
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

// === 색상 조화 점수 계수 (색 이론·색채 지각 경험칙에 근거, 값은 기존과 동일) ===
// 발표에서 "이 숫자 왜 이 값이냐"를 추적할 수 있도록 매직 넘버를 이름과 근거로 분리합니다.

// 한쪽이 무채색이면 hue 각도가 의미를 잃으므로 적용하는 중립 기준 점수입니다.
const NEUTRAL_PAIR_HUE_SCORE = 85;

// 코디 조화 점수 = 색상 관계 50% + 명도 균형 30% + 채도 균형 20%.
// hue 관계가 조화의 1차 결정 요인이라 비중이 가장 크고(Itten 색상환 기반),
// 명도 대비는 상하의 분리감(가독성), 채도 균형은 과한 충돌 억제용 미세 조정이라 그다음 순서입니다.
const HARMONY_COMPONENT_WEIGHTS = { hue: 0.5, lightness: 0.3, saturation: 0.2 } as const;

// 상하의 명도(L, 0~1) 차이의 이상값. 약 0.22(=22%p) 차이가 상하의를 구분하면서도 과하지 않은 대비를 만듭니다.
const IDEAL_LIGHTNESS_GAP = 0.22;
// 이상값에서 멀어질수록 점수를 깎는 기울기. 0.22에서 명도차가 1.0 벗어나면 약 120점 깎이는 강도(=급격)입니다.
const LIGHTNESS_GAP_PENALTY_SLOPE = 120;
// 명도 차이가 8%p 미만이면 상하의가 한 덩어리로 뭉개져 보여 강하게 감점합니다.
const LOW_LIGHTNESS_CONTRAST = { maxGap: 0.08, penalty: 28 } as const;
// 명도 차이가 55%p를 넘으면 위아래가 지나치게 갈라져 보여 약하게 감점합니다.
const HIGH_LIGHTNESS_CONTRAST = { minGap: 0.55, penalty: 10 } as const;

// 채도(S, 0~1) 차이가 클수록 통일감이 떨어진다고 보고 선형 감점합니다(차이 1.0당 45점).
const SATURATION_DIFF_SLOPE = 45;
// 상하의가 둘 다 고채도(>0.65)면 포인트가 두 개라 과하게 충돌하므로 감점합니다.
const DOUBLE_POINT_SATURATION = { minSaturation: 0.65, penalty: 12 } as const;
// 상하의가 둘 다 거의 무채(<0.12)면 코디가 밋밋해 소폭 감점합니다.
const FLAT_SATURATION = { maxSaturation: 0.12, penalty: 6 } as const;

// 명도·채도 균형 점수의 하한. 색이 안 맞아도 다른 축이 살릴 수 있어 0이 아니라 45를 바닥으로 둡니다.
const BALANCE_SCORE_FLOOR = 45;

// 시즌의 대비 선호 임계. contrast 특질이 0.5↑면 고대비 선호(겨울 계열), -0.2↓면 저대비 선호(여름 계열)로 봅니다.
const SEASON_CONTRAST = { highPreference: 0.5, lowPreference: -0.2 } as const;
// 시즌 대비 선호와 배색을 연결: 고대비 시즌은 보색 가산, 저대비 시즌은 보색 감점·유사색 가산.
const COMPLEMENTARY_BONUS_FOR_HIGH_CONTRAST = 6;
const COMPLEMENTARY_PENALTY_FOR_LOW_CONTRAST = 10;
const ANALOGOUS_BONUS_FOR_LOW_CONTRAST = 6;

// 코디 안정성 가산: 무채색·데님이 강한 포인트 색(채도 0.45↑)을 받쳐 줄 때 가장 안정적이라 봅니다.
const POINT_COLOR_SATURATION = 0.45;
const STABILITY_BONUS_WITH_POINT = 6;  // 포인트 색 + 받침색(무채/데님) 공존 시
const STABILITY_BONUS_BASE = 3;        // 받침색만 있을 시

function calculateLightnessBalanceScore(firstHex: string, secondHex: string): number {
  const first = colorHarmonyFeatures(firstHex);
  const second = colorHarmonyFeatures(secondHex);
  const diff = Math.abs(first.lightness - second.lightness);
  const base = 100 - Math.abs(diff - IDEAL_LIGHTNESS_GAP) * LIGHTNESS_GAP_PENALTY_SLOPE;
  const lowContrastPenalty = diff < LOW_LIGHTNESS_CONTRAST.maxGap ? LOW_LIGHTNESS_CONTRAST.penalty : 0;
  const highContrastPenalty = diff > HIGH_LIGHTNESS_CONTRAST.minGap ? HIGH_LIGHTNESS_CONTRAST.penalty : 0;
  return clamp(base - lowContrastPenalty - highContrastPenalty, BALANCE_SCORE_FLOOR, 100);
}

function calculateSaturationBalanceScore(firstHex: string, secondHex: string): number {
  const first = colorHarmonyFeatures(firstHex);
  const second = colorHarmonyFeatures(secondHex);
  const diff = Math.abs(first.saturation - second.saturation);
  const doublePointPenalty = first.saturation > DOUBLE_POINT_SATURATION.minSaturation && second.saturation > DOUBLE_POINT_SATURATION.minSaturation ? DOUBLE_POINT_SATURATION.penalty : 0;
  const flatPenalty = first.saturation < FLAT_SATURATION.maxSaturation && second.saturation < FLAT_SATURATION.maxSaturation ? FLAT_SATURATION.penalty : 0;
  return clamp(100 - diff * SATURATION_DIFF_SLOPE - doublePointPenalty - flatPenalty, BALANCE_SCORE_FLOOR, 100);
}

function calculateUtilityStabilityBonus(items: ScoredClothingItem[]): number {
  const hasNeutral = items.some((item) => item.isNeutral);
  const hasDenim = items.some((item) => item.isDenim);
  const hasColorPoint = items.some((item) => colorHarmonyFeatures(item.representativeHex).saturation > POINT_COLOR_SATURATION);
  if (hasColorPoint && (hasNeutral || hasDenim)) return STABILITY_BONUS_WITH_POINT;
  if (hasNeutral || hasDenim) return STABILITY_BONUS_BASE;
  return 0;
}

function calculatePairHarmonyScore(first: ScoredClothingItem, second: ScoredClothingItem, result: FinalResult | null): number {
  const angleDiff = hueAngleDiff(first.representativeHex, second.representativeHex);
  const harmonyType = first.isNeutral || second.isNeutral ? 'neutral' : classifyHarmonyType(angleDiff);
  const hueScore = HARMONY_BASE_SCORES[harmonyType] ?? NEUTRAL_PAIR_HUE_SCORE;
  const lightnessScore = calculateLightnessBalanceScore(first.representativeHex, second.representativeHex);
  const saturationScore = calculateSaturationBalanceScore(first.representativeHex, second.representativeHex);
  let score = hueScore * HARMONY_COMPONENT_WEIGHTS.hue
    + lightnessScore * HARMONY_COMPONENT_WEIGHTS.lightness
    + saturationScore * HARMONY_COMPONENT_WEIGHTS.saturation;

  // 시즌의 대비 선호와 코디 배색을 연결합니다. 고대비 선호 시즌엔 보색을 가산, 저대비 선호 시즌엔 보색을 감점·유사색을 가산.
  const preferredContrast = result ? SEASON_PROFILES[result.seasonTop1Id].traits.contrast : 0;
  if (harmonyType === 'complementary') {
    score += preferredContrast > SEASON_CONTRAST.highPreference ? COMPLEMENTARY_BONUS_FOR_HIGH_CONTRAST
      : preferredContrast < SEASON_CONTRAST.lowPreference ? -COMPLEMENTARY_PENALTY_FOR_LOW_CONTRAST : 0;
  }
  if (harmonyType === 'analogous') {
    score += preferredContrast < SEASON_CONTRAST.lowPreference ? ANALOGOUS_BONUS_FOR_LOW_CONTRAST : 0;
  }

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

function calculateBaseScore(personalScore: number, weatherScore: number, outfitItems: ScoredClothingItem[], weights: ScoreWeights): number {
  const harmonyType = getHarmonyType(outfitItems);
  const legacyHarmonyScore = HARMONY_BASE_SCORES[harmonyType] ?? 75;
  const stabilityScore = outfitItems.every((item) => item.availabilityStatus === '보유중') ? 92 : 68;
  return Math.round(
    personalScore * weights.personal +
    weatherScore * weights.weather +
    legacyHarmonyScore * weights.harmony +
    stabilityScore * weights.stability,
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

// 구성된 코디 아이템 배열 하나를 받아 4축 점수와 설명을 합성한 추천 객체로 만듭니다.
// buildRecommendations(전수 조합)와 buildAnchoredRecommendations(기준 옷 고정)가 점수 산식을 공유합니다.
function scoreOutfit(outfitItems: ScoredClothingItem[], band: RecommendationWeatherBand, mode: RecommendationMode, result: FinalResult | null): OutfitRecommendation {
  const personalScore = Math.round(outfitItems.reduce((sum, item) => sum + (item.personalFitScore ?? 55), 0) / outfitItems.length);
  const weatherScore = Math.round(outfitItems.reduce((sum, item) => sum + getWeatherScore(item, band), 0) / outfitItems.length);
  const harmonyScore = calculateHarmonyScore(outfitItems, result);
  const stabilityScore = outfitItems.every((item) => item.availabilityStatus === '보유중') ? 92 : 68;
  const weights = resolveScoreWeights(result);
  const scoreBreakdown = {
    personal: Math.round(personalScore * weights.personal),
    weather: Math.round(weatherScore * weights.weather),
    harmony: Math.round(harmonyScore * weights.harmony),
    stability: Math.round(stabilityScore * weights.stability),
  };
  const score = scoreBreakdown.personal + scoreBreakdown.weather + scoreBreakdown.harmony + scoreBreakdown.stability;
  const baseScore = calculateBaseScore(personalScore, weatherScore, outfitItems, weights);
  const harmonyType = getHarmonyType(outfitItems);
  return {
    id: outfitItems.map((item) => item.id).join('-'),
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
    reason: buildHeadlineReason(harmonyType, personalScore, band, result),
    scoreBreakdown,
    explanationBullets: buildExplanationBullets(outfitItems, personalScore, weatherScore, harmonyScore, harmonyType, band, result),
    weatherBand: band,
    mode,
  };
}

// 후보 상한. 카탈로그(수백 벌)를 전수 조합하면 상의×하의(×아우터)가 수만 건이 되어 렌더 스레드가 멈춘다.
// 그래서 후보를 퍼스널컬러 적합도 상위로 미리 잘라 조합 수를 묶는다(속도와 추천 품질이 함께 올라감).
// 전수 추천(buildRecommendations)과 기준 옷 추천(buildAnchoredRecommendations)이 함께 쓴다.
const MAX_PRIMARY_CANDIDATES = 60; // 상의·하의 후보 상한
const MAX_OUTER_CANDIDATES = 20; // 아우터(선택 레이어) 후보 상한

// 퍼스널컬러 적합도 내림차순 비교자. 점수가 없으면(측정 전) 0으로 보아 입력 순서를 유지한다.
const byFitDesc = (a: ScoredClothingItem, b: ScoredClothingItem) => (b.personalFitScore ?? 0) - (a.personalFitScore ?? 0);

// 상의/하의/아우터/신발 후보를 조합해 코디 추천 리스트를 만듭니다.
// 최종 점수는 퍼스널컬러 38%, 날씨 22%, 색상 조화 28%, 착용 안정성 12%로 계산합니다.
export function buildRecommendations(items: ScoredClothingItem[], band: RecommendationWeatherBand, mode: RecommendationMode, result: FinalResult | null): OutfitRecommendation[] {
  const available = dedupeRecommendationItems(items.filter((item) => item.availabilityStatus !== '추천제외' && item.availabilityStatus !== '세탁중'));
  const weatherFiltered = band === '상관없음' ? available : available.filter((item) => isWeatherEligible(item, band));
  // 후보가 상한을 넘을 때만 적합도 상위로 잘라 조합 폭증을 막는다(상한 이하 옷장은 기존 동작 그대로).
  const capPrimary = (list: ScoredClothingItem[]) =>
    list.length > MAX_PRIMARY_CANDIDATES ? [...list].sort(byFitDesc).slice(0, MAX_PRIMARY_CANDIDATES) : list;
  const tops = capPrimary(weatherFiltered.filter((item) => item.category === '상의'));
  const bottoms = capPrimary(weatherFiltered.filter((item) => item.category === '하의'));
  const outerwear = weatherFiltered.filter((item) => item.category === '아우터');
  const outfits: OutfitRecommendation[] = [];
  const seenOutfits = new Set<string>();
  const sortedOuter = outerwear.sort((a, b) => getWeatherScore(b, band) - getWeatherScore(a, band));
  const outerOptions = [undefined, ...(sortedOuter.length > MAX_OUTER_CANDIDATES ? sortedOuter.slice(0, MAX_OUTER_CANDIDATES) : sortedOuter)];

  tops.forEach((top) => {
    bottoms.forEach((bottom) => {
      outerOptions.forEach((outer) => {
        const outfitItems = dedupeRecommendationItems([outer, top, bottom].filter(Boolean) as ScoredClothingItem[]);
        if (outfitItems.length < 2) return;
        const key = outfitUniqueKey(outfitItems);
        if (seenOutfits.has(key)) return;
        seenOutfits.add(key);
        outfits.push(scoreOutfit(outfitItems, band, mode, result));
      });
    });
  });

  return diversifyRecommendations(outfits.sort((a, b) => b.score - a.score).slice(0, 60));
}

// 기준 옷 코디 다양성 계수. 같은 상대 옷(하의·아우터)이 최대 2개 코디까지만 등장하게 해 변별력을 높이고,
// 최종 노출은 24개로 제한해 점수순 상위의 다양한 조합만 보여 줍니다.
const MAX_APPEARANCE_PER_COUNTERPART = 2;
const ANCHORED_RESULT_LIMIT = 24;

// 기준 옷(anchor) 한 벌을 반드시 포함하는 코디만 만듭니다.
// 날씨 축은 '상관없음'으로 고정해 퍼스널컬러와 색상 조화에 집중합니다(이 기능의 질문은 "이 옷에 색이 어울리는 옷").
// 기준이 상의면 풀의 하의와, 하의면 상의와, 아우터면 상의×하의와 묶고, 상하의 기준일 때는 아우터를 한 겹 더 얹습니다.
// 신발·액세서리 기준은 v1에서 지원하지 않아 빈 배열을 반환합니다.
export function buildAnchoredRecommendations(
  anchor: ScoredClothingItem,
  pool: ScoredClothingItem[],
  result: FinalResult | null,
  mode: RecommendationMode = '데일리',
): OutfitRecommendation[] {
  const band: RecommendationWeatherBand = '상관없음';
  const anchorKey = itemUniqueKey(anchor);
  const usable = dedupeRecommendationItems(
    pool.filter(
      (item) =>
        item.availabilityStatus !== '추천제외' &&
        item.availabilityStatus !== '세탁중' &&
        itemUniqueKey(item) !== anchorKey,
    ),
  );
  // 퍼스널컬러 적합도 내림차순으로 잘라 조합 수를 제한한다(byFitDesc는 상단 공용 정의). 점수가 없으면 입력 순서를 따른다.
  const tops = usable.filter((item) => item.category === '상의').sort(byFitDesc).slice(0, MAX_PRIMARY_CANDIDATES);
  const bottoms = usable.filter((item) => item.category === '하의').sort(byFitDesc).slice(0, MAX_PRIMARY_CANDIDATES);
  const outerOptions = [undefined, ...usable.filter((item) => item.category === '아우터').sort(byFitDesc).slice(0, MAX_OUTER_CANDIDATES)];

  const outfits: OutfitRecommendation[] = [];
  const seenOutfits = new Set<string>();
  const pushOutfit = (candidates: (ScoredClothingItem | undefined)[]) => {
    const outfitItems = dedupeRecommendationItems(candidates.filter(Boolean) as ScoredClothingItem[]);
    if (outfitItems.length < 2) return;
    const key = outfitUniqueKey(outfitItems);
    if (seenOutfits.has(key)) return;
    seenOutfits.add(key);
    outfits.push(scoreOutfit(outfitItems, band, mode, result));
  };

  if (anchor.category === '상의') {
    bottoms.forEach((bottom) => outerOptions.forEach((outer) => pushOutfit([outer, anchor, bottom])));
  } else if (anchor.category === '하의') {
    tops.forEach((top) => outerOptions.forEach((outer) => pushOutfit([outer, top, anchor])));
  } else if (anchor.category === '아우터') {
    tops.forEach((top) => bottoms.forEach((bottom) => pushOutfit([anchor, top, bottom])));
  }

  // 기준 옷은 모든 코디에 들어가므로 표준 diversifyRecommendations(아이템당 3회 제한)를 그대로 쓰면
  // 기준 옷이 먼저 한도에 걸려 결과가 3개로 잘린다. 그래서 기준 옷을 뺀 '상대 옷' 등장 횟수만 제한해
  // 같은 하의·아우터가 반복되지 않게 하면서 다양한 조합이 골고루 나오도록 한다.
  const counterpartCount = new Map<string, number>();
  return outfits
    .sort((a, b) => b.score - a.score)
    .filter((outfit) => {
      const counterparts = outfit.items.filter((item) => itemUniqueKey(item) !== anchorKey);
      if (counterparts.some((item) => (counterpartCount.get(itemUniqueKey(item)) ?? 0) >= MAX_APPEARANCE_PER_COUNTERPART)) return false;
      counterparts.forEach((item) => counterpartCount.set(itemUniqueKey(item), (counterpartCount.get(itemUniqueKey(item)) ?? 0) + 1));
      return true;
    })
    .slice(0, ANCHORED_RESULT_LIMIT);
}
