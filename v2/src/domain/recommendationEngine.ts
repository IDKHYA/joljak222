// v2 골든 패스에서 겹치지 않는 코디 추천을 생성하는 순수 도메인 엔진이다.
import type { ClothingCategory, ClothingItem, OutfitRecommendation, PersonalColorResult, WeatherBand, WeatherInput } from './types';

interface RecommendationRequest {
  items: ClothingItem[];
  personalColor: PersonalColorResult;
  weather: WeatherInput;
  count?: number;
}

interface RecommendationResult {
  recommendations: OutfitRecommendation[];
  issues: string[];
}

type OutfitCandidate = {
  items: ClothingItem[];
  scoreBreakdown: OutfitRecommendation['scoreBreakdown'];
  totalScore: number;
};

const SCORE_WEIGHTS = {
  personalColor: 0.38,
  weather: 0.22,
  harmony: 0.28,
  stability: 0.12,
} as const;

const WARMTH_BY_WEATHER: Record<WeatherBand, WarmthLevelPreference> = {
  freezing: { ideal: ['heavy'], acceptable: ['warm'] },
  cold: { ideal: ['heavy', 'warm'], acceptable: ['mid'] },
  chilly: { ideal: ['warm', 'mid'], acceptable: ['heavy', 'light'] },
  cool: { ideal: ['mid', 'warm'], acceptable: ['light'] },
  mild: { ideal: ['mid', 'light'], acceptable: ['warm'] },
  warm: { ideal: ['light', 'very-light'], acceptable: ['mid'] },
  hot: { ideal: ['very-light', 'light'], acceptable: ['mid'] },
  'very-hot': { ideal: ['very-light'], acceptable: ['light'] },
};

type WarmthLevelPreference = {
  ideal: ClothingItem['warmthLevel'][];
  acceptable: ClothingItem['warmthLevel'][];
};

export function buildDistinctOutfitRecommendations(request: RecommendationRequest): RecommendationResult {
  const targetCount = request.count ?? 3;
  const candidates = buildCandidates(request.items, request.personalColor, request.weather);
  const selected: OutfitRecommendation[] = [];
  const usedItemIds = new Set<string>();

  for (const candidate of candidates) {
    if (candidate.items.some((item) => usedItemIds.has(item.id))) continue;

    const recommendation = toRecommendation(candidate, selected.length + 1, request.weather);
    selected.push(recommendation);
    candidate.items.forEach((item) => usedItemIds.add(item.id));

    if (selected.length === targetCount) break;
  }

  const issues =
    selected.length < targetCount ? [`겹치지 않는 추천 ${targetCount}개를 만들 의류가 부족합니다.`] : [];

  return { recommendations: selected, issues };
}

function buildCandidates(
  items: ClothingItem[],
  personalColor: PersonalColorResult,
  weather: WeatherInput,
): OutfitCandidate[] {
  const available = items.filter((item) => item.availability !== 'excluded');
  const uppers = byCategory(available, 'upper');
  const lowers = byCategory(available, 'lower');
  const shoes = byCategory(available, 'shoes');
  const candidates: OutfitCandidate[] = [];

  for (const upper of uppers) {
    for (const lower of lowers) {
      for (const shoe of shoes.length > 0 ? shoes : [undefined]) {
        const outfitItems = [upper, lower, shoe].filter(Boolean) as ClothingItem[];
        const scoreBreakdown = scoreOutfit(outfitItems, personalColor, weather);
        candidates.push({
          items: outfitItems,
          scoreBreakdown,
          totalScore: weightedScore(scoreBreakdown),
        });
      }
    }
  }

  return candidates.sort((a, b) => b.totalScore - a.totalScore);
}

function byCategory(items: ClothingItem[], category: ClothingCategory): ClothingItem[] {
  return items.filter((item) => item.category === category);
}

function scoreOutfit(
  items: ClothingItem[],
  personalColor: PersonalColorResult,
  weather: WeatherInput,
): OutfitRecommendation['scoreBreakdown'] {
  return {
    personalColor: average(items.map((item) => scorePersonalColor(item, personalColor))),
    weather: average(items.map((item) => scoreWeather(item, weather.band))),
    harmony: scoreHarmony(items),
    stability: average(items.map(scoreStability)),
  };
}

function weightedScore(scoreBreakdown: OutfitRecommendation['scoreBreakdown']): number {
  return roundScore(
    scoreBreakdown.personalColor * SCORE_WEIGHTS.personalColor
      + scoreBreakdown.weather * SCORE_WEIGHTS.weather
      + scoreBreakdown.harmony * SCORE_WEIGHTS.harmony
      + scoreBreakdown.stability * SCORE_WEIGHTS.stability,
  );
}

function scorePersonalColor(item: ClothingItem, personalColor: PersonalColorResult): number {
  const itemRgb = hexToRgb(item.colors.representative.hex);
  const bestDistance = Math.min(...personalColor.paletteHexes.map((hex) => rgbDistance(itemRgb, hexToRgb(hex))));
  return clampScore(100 - (bestDistance / 441.68) * 100);
}

function scoreWeather(item: ClothingItem, band: WeatherBand): number {
  const preference = WARMTH_BY_WEATHER[band];
  if (preference.ideal.includes(item.warmthLevel)) return 96;
  if (preference.acceptable.includes(item.warmthLevel)) return 78;
  return 48;
}

function scoreHarmony(items: ClothingItem): number;
function scoreHarmony(items: ClothingItem[]): number;
function scoreHarmony(items: ClothingItem | ClothingItem[]): number {
  const outfitItems = Array.isArray(items) ? items : [items];
  if (outfitItems.length < 2) return 82;

  const hues = outfitItems.map((item) => rgbToHsl(hexToRgb(item.colors.representative.hex)).h);
  const maxGap = Math.max(...hues.map((hue) => Math.min(...hues.filter((other) => other !== hue).map((other) => hueDistance(hue, other)))));

  if (maxGap <= 24) return 84;
  if (maxGap <= 70) return 88;
  if (maxGap >= 150) return 90;
  return 76;
}

function scoreStability(item: ClothingItem): number {
  if (item.availability === 'owned') return 100;
  if (item.availability === 'stored') return 82;
  if (item.availability === 'laundry') return 40;
  return 0;
}

function toRecommendation(candidate: OutfitCandidate, index: number, weather: WeatherInput): OutfitRecommendation {
  return {
    id: `recommendation-${index}`,
    title: `겹치지 않는 데일리 코디 ${index}`,
    items: candidate.items,
    totalScore: candidate.totalScore,
    scoreBreakdown: candidate.scoreBreakdown,
    reasons: [
      `퍼스널컬러 적합도 ${Math.round(candidate.scoreBreakdown.personalColor)}점을 기준으로 색을 골랐습니다.`,
      `날씨 ${weather.temperatureCelsius ?? ''}도 조건에서 보온 균형을 확인했습니다.`.replace('  ', ' '),
      `색 조화 점수 ${Math.round(candidate.scoreBreakdown.harmony)}점으로 함께 입었을 때의 균형을 계산했습니다.`,
    ],
    weatherContext: {
      temperatureCelsius: weather.temperatureCelsius,
      band: weather.source === 'manual' ? 'manual' : weather.band,
      isManualOverride: weather.source === 'manual',
    },
    reusedItemIds: [],
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function rgbToHsl([r, g, b]: [number, number, number]): { h: number; s: number; l: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l: lightness };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (max === red) hue = 60 * (((green - blue) / delta) % 6);
  if (max === green) hue = 60 * ((blue - red) / delta + 2);
  if (max === blue) hue = 60 * ((red - green) / delta + 4);

  return { h: hue < 0 ? hue + 360 : hue, s: saturation, l: lightness };
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}
