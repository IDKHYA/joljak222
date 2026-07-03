// v2 골든 패스를 바로 시연할 수 있는 기본 퍼컬·날씨·옷장 프리셋 데이터를 제공한다.
import { buildDistinctOutfitRecommendations } from './recommendationEngine';
import type { ClothingItem, PersonalColorResult, WeatherInput } from './types';

interface PresetReadinessRequest {
  items: ClothingItem[];
  personalColor: PersonalColorResult;
  weather: WeatherInput;
  minimumDistinctOutfits: number;
}

interface PresetReadinessResult {
  ok: boolean;
  distinctOutfitCount: number;
  issues: string[];
}

const NOW = '2026-07-02T00:00:00.000Z';

export const defaultPersonalColor: PersonalColorResult = {
  top1: 'true-summer',
  top2: 'light-summer',
  confidence: 0.82,
  decisionType: 'photo-questionnaire',
  fusionWeights: { photo: 0.3, questionnaire: 0.7 },
  paletteHexes: ['#F7F4F2', '#D8A2B3', '#6E8FBE', '#557A8C', '#3E4E73', '#A3A9AE'],
  evidence: ['쿨하고 부드러운 팔레트가 안정적으로 어울리는 기본 시연 결과입니다.'],
};

export const defaultWeather: WeatherInput = {
  band: 'mild',
  temperatureCelsius: 18,
  source: 'manual',
};

export const defaultWardrobePresetItems: ClothingItem[] = [
  makeCatalogItem('upper-blue-shirt', 'upper', '소프트 블루 셔츠', '셔츠', '#6E8FBE', '/catalog/upper_shirt_001.png'),
  makeCatalogItem('upper-rose-knit', 'upper', '더스티 로즈 니트', '니트', '#C68FA4', '/catalog/upper_sweater_001.png'),
  makeCatalogItem('upper-ivory-top', 'upper', '쿨 아이보리 탑', '긴팔티', '#F7F4F2', '/catalog/upper_top_001.png'),
  makeCatalogItem('lower-navy-slacks', 'lower', '차분한 네이비 슬랙스', '슬랙스', '#3E4E73', '/catalog/v2_lower_pants_001.png'),
  makeCatalogItem('lower-gray-pants', 'lower', '라이트 그레이 팬츠', '슬랙스', '#A3A9AE', '/catalog/v2_lower_pants_002.png'),
  makeCatalogItem('lower-denim-pants', 'lower', '뮤트 블루 데님', '청바지', '#557A8C', '/catalog/v2_lower_pants_003.png', {
    isDenim: true,
  }),
  makeCatalogItem('shoes-cream-sneakers', 'shoes', '크림 스니커즈', '스니커즈', '#F7F4F2', '/catalog/v2_shoe_shoe_001.png'),
  makeCatalogItem('shoes-silver-loafers', 'shoes', '실버 그레이 로퍼', '로퍼', '#C9CED6', '/catalog/v2_shoe_shoe_002.png'),
  makeCatalogItem('shoes-charcoal-sneakers', 'shoes', '차콜 스니커즈', '스니커즈', '#434A54', '/catalog/v2_shoe_shoe_003.png'),
  // 추운 밴드(freezing~cool) 시연에서 아우터 없는 코디가 감점되지 않도록 큐레이션한 아우터. (도메인개념_고도화_v2.md §5.3)
  makeCatalogItem('outer-charcoal-coat', 'outer', '차콜 울 코트', '울 코트', '#434A54', '/catalog/v2_outer_coat_001.png', {
    warmthLevel: 'heavy',
  }),
  makeCatalogItem('outer-gray-trench', 'outer', '그레이 트렌치 코트', '트렌치 코트', '#A3A9AE', '/catalog/v2_outer_jacket_001.png', {
    warmthLevel: 'warm',
  }),
];

export function validatePresetReadiness(request: PresetReadinessRequest): PresetReadinessResult {
  const result = buildDistinctOutfitRecommendations({
    items: request.items,
    personalColor: request.personalColor,
    weather: request.weather,
    count: request.minimumDistinctOutfits,
  });

  return {
    ok: result.recommendations.length >= request.minimumDistinctOutfits && result.issues.length === 0,
    distinctOutfitCount: result.recommendations.length,
    issues: result.issues,
  };
}

function makeCatalogItem(
  id: string,
  category: ClothingItem['category'],
  displayName: string,
  typeLabel: string,
  hex: string,
  storedUrl: string,
  options?: { warmthLevel?: ClothingItem['warmthLevel']; isDenim?: boolean },
): ClothingItem {
  return {
    id,
    wardrobeId: 'preset-soft-summer-casual',
    sourceType: 'catalog',
    image: { storedUrl },
    category,
    typeLabel,
    displayName,
    colors: {
      representative: { name: displayName.split(' ')[0] ?? '대표색', hex, isNeutral: isNeutralHex(hex) },
      dominant: [{ name: displayName.split(' ')[0] ?? '대표색', hex, ratio: 1, isNeutral: isNeutralHex(hex) }],
    },
    pattern: 'solid',
    warmthLevel: options?.warmthLevel ?? (category === 'shoes' ? 'mid' : 'light'),
    isDenim: options?.isDenim,
    availability: 'owned',
    analysis: {
      status: 'confirmed',
      modelRefs: ['manual-curated-v2-preset'],
      confidenceNotes: ['시연 골든 패스를 위해 사람이 검수한 프리셋 항목입니다.'],
      confirmedAt: NOW,
    },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function isNeutralHex(hex: string): boolean {
  return ['#F7F4F2', '#A3A9AE', '#C9CED6', '#434A54'].includes(hex.toUpperCase());
}
