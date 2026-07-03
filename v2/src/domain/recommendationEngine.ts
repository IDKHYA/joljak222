// v2 골든 패스에서 겹치지 않는 코디 추천을 생성하는 순수 도메인 엔진이다. (계산 규칙은 도메인개념_고도화_v2.md §3~§7)
import type {
  ClothingCategory,
  ClothingItem,
  OutfitRecommendation,
  PersonalColorResult,
  WeatherBand,
  WeatherInput,
} from './types';
import { hexToHsl, hexToLab, hexToLch, hueAngleDistance } from './colorMath';
import { avoidPenaltyForSeason, getSeasonTraits, scoreColorForSeason, NEUTRAL_CHROMA_LIMIT } from './seasonSpectrum';

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

// 보온 등급과 날씨 밴드를 같은 수직선에 놓는 순서 좌표. (§5.1)
// 밴드 목표값은 계약 §4.2의 ideal/보조 허용 표와 순서가 정합하도록 비대칭으로 튜닝한 초기값이다.
const WARMTH_POSITION: Record<ClothingItem['warmthLevel'], number> = {
  'very-light': 0,
  light: 1,
  mid: 2,
  warm: 3,
  heavy: 4,
};

const BAND_TARGET: Record<WeatherBand, number> = {
  'very-hot': 0,
  hot: 0.5,
  warm: 0.75,
  mild: 1.75,
  cool: 2.4,
  chilly: 2.75,
  cold: 3.5,
  freezing: 4,
};

const WEATHER_SLOPE = 22;
const WEATHER_FLOOR = 30;

// 완화 사다리 — 상의는 끝까지 재사용하지 않는다. (§7.2)
const REUSE_STAGES: ClothingCategory[][] = [
  [],
  ['shoes'],
  ['shoes', 'outer'],
  ['shoes', 'outer', 'lower'],
];

const DIVERSITY_SCORE_WINDOW = 3;
const STRONG_PATTERNS = new Set(['stripe', 'plaid', 'graphic']);

type HueBucket = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'neutral';

export function buildDistinctOutfitRecommendations(request: RecommendationRequest): RecommendationResult {
  const targetCount = request.count ?? 3;
  const candidates = buildCandidates(request.items, request.personalColor, request.weather);
  const selected: OutfitRecommendation[] = [];
  const selectedBuckets: HueBucket[][] = [];
  const usedItemIds = new Set<string>();

  for (const reusableCategories of REUSE_STAGES) {
    while (selected.length < targetCount) {
      const eligible = candidates.filter((candidate) =>
        candidate.items.every(
          (item) =>
            !usedItemIds.has(item.id) || reusableCategories.includes(item.category),
        )
        // 상의까지 전부 재사용이면 사실상 같은 코디이므로, 새 아이템이 하나는 있어야 한다.
        && candidate.items.some((item) => !usedItemIds.has(item.id)),
      );
      if (eligible.length === 0) break;

      const picked = pickWithDiversity(eligible, selectedBuckets);
      const reusedItemIds = picked.items.filter((item) => usedItemIds.has(item.id)).map((item) => item.id);

      selected.push(toRecommendation(picked, selected.length + 1, request.weather, reusedItemIds));
      selectedBuckets.push(picked.items.map((item) => hueBucketOf(item)));
      picked.items.forEach((item) => usedItemIds.add(item.id));
    }
    if (selected.length >= targetCount) break;
  }

  const issues: string[] = [];
  if (selected.length < targetCount) {
    issues.push(`겹치지 않는 추천 ${targetCount}개를 만들 의류가 부족합니다.`);
    const upperCount = request.items.filter(
      (item) => item.category === 'upper' && item.availability !== 'excluded',
    ).length;
    if (upperCount < targetCount) {
      issues.push(`상의가 ${upperCount}개뿐이라 서로 다른 코디를 ${targetCount}개 만들 수 없습니다.`);
    }
  }

  return { recommendations: selected, issues };
}

// 점수 상위 후보들(3점 이내) 중 기선택 코디들과 hue 버킷 겹침이 가장 적은 것을 고른다. (§7.3)
function pickWithDiversity(eligible: OutfitCandidate[], selectedBuckets: HueBucket[][]): OutfitCandidate {
  const best = eligible[0];
  if (selectedBuckets.length === 0) return best;

  const pool = eligible.filter((candidate) => best.totalScore - candidate.totalScore <= DIVERSITY_SCORE_WINDOW);
  const seen = new Set(selectedBuckets.flat());

  let picked = best;
  let lowestOverlap = Number.POSITIVE_INFINITY;
  for (const candidate of pool) {
    const overlap = candidate.items.reduce(
      (count, item) => count + (seen.has(hueBucketOf(item)) ? 1 : 0),
      0,
    );
    if (overlap < lowestOverlap) {
      lowestOverlap = overlap;
      picked = candidate;
    }
  }
  return picked;
}

// 아이템·쌍 단위 점수는 조합과 무관하므로 조합 루프 밖에서 한 번만 계산한다.
interface ScoreCaches {
  personal: Map<string, number>;
  stability: Map<string, number>;
  pair: Map<string, number>;
  contrast: number;
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
  const outers = byCategory(available, 'outer');
  const candidates: OutfitCandidate[] = [];

  const caches: ScoreCaches = {
    personal: new Map(available.map((item) => [item.id, scorePersonalColor(item, personalColor)])),
    stability: new Map(available.map((item) => [item.id, scoreStability(item)])),
    pair: new Map(),
    contrast: getSeasonTraits(personalColor.top1).contrast,
  };

  const shoeOptions: Array<ClothingItem | undefined> = shoes.length > 0 ? shoes : [undefined];
  const outerOptions: Array<ClothingItem | undefined> = [undefined, ...outers];

  for (const upper of uppers) {
    for (const lower of lowers) {
      for (const shoe of shoeOptions) {
        for (const outer of outerOptions) {
          const outfitItems = [upper, lower, shoe, outer].filter(Boolean) as ClothingItem[];
          const scoreBreakdown = scoreOutfit(outfitItems, weather, caches);
          candidates.push({
            items: outfitItems,
            scoreBreakdown,
            totalScore: weightedScore(scoreBreakdown),
          });
        }
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
  weather: WeatherInput,
  caches: ScoreCaches,
): OutfitRecommendation['scoreBreakdown'] {
  return {
    personalColor: roundScore(average(items.map((item) => caches.personal.get(item.id) ?? 0))),
    weather: roundScore(scoreWeather(items, weather.band)),
    harmony: roundScore(scoreHarmony(items, caches)),
    stability: roundScore(average(items.map((item) => caches.stability.get(item.id) ?? 0))),
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

// 퍼컬 축 — dominant 가중, Top2 혼합, 회피 감점, 데님 유틸리티. (§3)
function scorePersonalColor(item: ClothingItem, personalColor: PersonalColorResult): number {
  const swatches =
    item.colors.dominant.length > 0 ? item.colors.dominant.slice(0, 3) : [item.colors.representative];

  const hasRatios = swatches.every((swatch) => typeof swatch.ratio === 'number' && swatch.ratio > 0);
  const defaultWeights = [0.6, 0.25, 0.15].slice(0, swatches.length);
  const rawWeights = hasRatios
    ? swatches.map((swatch) => swatch.ratio as number)
    : defaultWeights;
  const weightSum = rawWeights.reduce((sum, weight) => sum + weight, 0);
  const weights = rawWeights.map((weight) => weight / weightSum);

  const mixRatio = top2MixRatio(personalColor);

  let score = swatches.reduce((sum, swatch, index) => {
    const lab = hexToLab(swatch.hex);
    const top1Result = scoreColorForSeason(lab, personalColor.top1);
    const top2Score =
      mixRatio > 0 ? scoreColorForSeason(lab, personalColor.top2).score : top1Result.score;
    const mixed = (1 - mixRatio) * top1Result.score + mixRatio * top2Score;
    const penalty = avoidPenaltyForSeason(lab, personalColor.top1, {
      nearestPaletteDeltaE: top1Result.nearestDeltaE,
    });
    const penalized = clampScore(mixed + penalty, 15, 100);
    return sum + weights[index] * penalized;
  }, 0);

  if (item.category === 'lower' && item.isDenim) {
    score = Math.min(100, score + 4);
  }

  return score;
}

// Top2 혼합 비율 — 신뢰도 0.75 이상 0%, 0.40 이하 35%, 사이 선형. (§3.3, G3)
function top2MixRatio(personalColor: PersonalColorResult): number {
  if (!personalColor.top2 || personalColor.top2 === personalColor.top1) return 0;
  return Math.max(0, Math.min(0.35, 0.75 - personalColor.confidence));
}

// 날씨 축 — 순서 거리 기반 연속 감점 + 아우터 규칙. (§5, G9·G10)
function scoreWeather(items: ClothingItem[], band: WeatherBand): number {
  const target = BAND_TARGET[band];
  const outer = items.find((item) => item.category === 'outer');

  const itemScores = items.map((item) => {
    let position = WARMTH_POSITION[item.warmthLevel];
    // 레이어링 효과 — 아우터가 있으면 상의 보온을 한 단계 올려 평가한다.
    if (item.category === 'upper' && outer) {
      position = Math.min(4, position + 1);
    }
    return Math.max(WEATHER_FLOOR, Math.min(100, 100 - WEATHER_SLOPE * Math.abs(position - target)));
  });

  let score = average(itemScores);

  if (band === 'freezing' || band === 'cold') {
    if (!outer) score -= 25;
  } else if (band === 'chilly' || band === 'cool') {
    if (outer) score += 6;
  } else if (band === 'warm' || band === 'hot' || band === 'very-hot') {
    if (outer) score -= outer.warmthLevel === 'heavy' ? 25 : 15;
  }

  return clampScore(score, 0, 100);
}

// 조화 축 — 성분 분해(50/30/20) + 시즌 대비 선호 + 패턴 충돌 + 상의-하의 중심 집계. (§4, G7·G8)
function scoreHarmony(items: ClothingItem[], caches: ScoreCaches): number {
  if (items.length < 2) return 82;

  const upper = items.find((item) => item.category === 'upper');
  const lower = items.find((item) => item.category === 'lower');

  const pairs: Array<{ score: number; isCore: boolean }> = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const isCore =
        upper !== undefined
        && lower !== undefined
        && ((items[i] === upper && items[j] === lower) || (items[i] === lower && items[j] === upper));
      const cacheKey = `${items[i].id}|${items[j].id}`;
      let pairScore = caches.pair.get(cacheKey);
      if (pairScore === undefined) {
        pairScore = pairHarmonyScore(items[i], items[j], caches.contrast);
        caches.pair.set(cacheKey, pairScore);
      }
      pairs.push({ score: pairScore, isCore });
    }
  }

  const corePair = pairs.find((pair) => pair.isCore);
  const otherPairs = pairs.filter((pair) => !pair.isCore);

  let score: number;
  if (corePair && otherPairs.length > 0) {
    score = corePair.score * 0.6 + average(otherPairs.map((pair) => pair.score)) * 0.4;
  } else if (corePair) {
    score = corePair.score;
  } else {
    score = average(pairs.map((pair) => pair.score));
  }

  const strongPatternCount = items.filter((item) => STRONG_PATTERNS.has(item.pattern)).length;
  if (strongPatternCount >= 2) score -= 8;

  return clampScore(score, 0, 100);
}

function pairHarmonyScore(a: ClothingItem, b: ClothingItem, contrast: number): number {
  const lchA = hexToLch(a.colors.representative.hex);
  const lchB = hexToLch(b.colors.representative.hex);
  const neutralA = a.colors.representative.isNeutral || lchA.C < NEUTRAL_CHROMA_LIMIT;
  const neutralB = b.colors.representative.isNeutral || lchB.C < NEUTRAL_CHROMA_LIMIT;

  let hueComponent: number;
  let chromaComponent = clampScore(100 - Math.max(0, lchA.C + lchB.C - 120) * 0.5, 0, 100);

  if (neutralA && neutralB) {
    hueComponent = 88;
    chromaComponent = 100;
  } else if (neutralA || neutralB) {
    hueComponent = 85;
  } else {
    const hueDiff = hueAngleDistance(
      hexToHsl(a.colors.representative.hex).h,
      hexToHsl(b.colors.representative.hex).h,
    );
    hueComponent = harmonyTypeBaseScore(hueDiff, contrast);
  }

  const lightnessDeviation = Math.abs(lchA.L - lchB.L);
  const outsideBand = Math.max(0, 5 - lightnessDeviation, lightnessDeviation - 45);
  const lightnessComponent = clampScore(100 - outsideBand * 1.6, 40, 100);

  return hueComponent * 0.5 + lightnessComponent * 0.3 + chromaComponent * 0.2;
}

// 조화 타입 기본 점수(계약 §5.1) + 시즌 대비 선호 연속 보정(§4.2).
function harmonyTypeBaseScore(hueDiff: number, contrast: number): number {
  if (hueDiff <= 15) return 80 - 4 * contrast;
  if (hueDiff <= 45) return 82 - 4 * contrast;
  if (hueDiff <= 90) return 55 + 6 * contrast;
  if (hueDiff <= 135) return 76;
  return 88 + 6 * contrast;
}

function scoreStability(item: ClothingItem): number {
  if (item.availability === 'owned') return 100;
  if (item.availability === 'stored') return 82;
  if (item.availability === 'laundry') return 40;
  return 0;
}

function hueBucketOf(item: ClothingItem): HueBucket {
  const representative = item.colors.representative;
  const lch = hexToLch(representative.hex);
  if (representative.isNeutral || lch.C < NEUTRAL_CHROMA_LIMIT) return 'neutral';

  const hue = hexToHsl(representative.hex).h;
  if (hue >= 345 || hue < 15) return 'red';
  if (hue < 45) return 'orange';
  if (hue < 75) return 'yellow';
  if (hue < 165) return 'green';
  if (hue < 200) return 'cyan';
  if (hue < 255) return 'blue';
  if (hue < 290) return 'purple';
  return 'pink';
}

function toRecommendation(
  candidate: OutfitCandidate,
  index: number,
  weather: WeatherInput,
  reusedItemIds: string[],
): OutfitRecommendation {
  const reasons = [
    `퍼스널컬러 적합도 ${Math.round(candidate.scoreBreakdown.personalColor)}점을 기준으로 색을 골랐습니다.`,
    `날씨 ${weather.temperatureCelsius ?? ''}도 조건에서 보온 균형을 확인했습니다.`.replace('  ', ' '),
    `색 조화 점수 ${Math.round(candidate.scoreBreakdown.harmony)}점으로 함께 입었을 때의 균형을 계산했습니다.`,
  ];
  if (reusedItemIds.length > 0) {
    reasons.push('일부 아이템은 앞 코디와 같은 것을 다시 활용했습니다.');
  }

  return {
    id: `recommendation-${index}`,
    title: `겹치지 않는 데일리 코디 ${index}`,
    items: candidate.items,
    totalScore: candidate.totalScore,
    scoreBreakdown: candidate.scoreBreakdown,
    reasons,
    weatherContext: {
      temperatureCelsius: weather.temperatureCelsius,
      band: weather.source === 'manual' ? 'manual' : weather.band,
      isManualOverride: weather.source === 'manual',
    },
    reusedItemIds,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampScore(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}
