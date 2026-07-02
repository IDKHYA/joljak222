// v2 퍼스널컬러·의류·날씨·추천 도메인의 데이터 계약을 정의한다.
export type PersonalSeasonId =
  | 'light-spring'
  | 'true-spring'
  | 'bright-spring'
  | 'light-summer'
  | 'true-summer'
  | 'soft-summer'
  | 'soft-autumn'
  | 'true-autumn'
  | 'dark-autumn'
  | 'dark-winter'
  | 'true-winter'
  | 'bright-winter';

export interface PersonalColorResult {
  top1: PersonalSeasonId;
  top2: PersonalSeasonId;
  confidence: number;
  decisionType: 'photo-questionnaire' | 'photo-only' | 'questionnaire-only';
  fusionWeights: {
    photo: number;
    questionnaire: number;
  };
  paletteHexes: string[];
  evidence: string[];
}

export type ClothingCategory = 'upper' | 'lower' | 'outer' | 'shoes' | 'accessory';
export type ClothingSourceType = 'catalog' | 'url' | 'photo';
export type AvailabilityStatus = 'owned' | 'laundry' | 'stored' | 'excluded';
export type PatternType = 'solid' | 'stripe' | 'plaid' | 'graphic' | 'mixed' | 'unknown';
export type WarmthLevel = 'very-light' | 'light' | 'mid' | 'warm' | 'heavy';

export interface ColorSwatch {
  name: string;
  hex: string;
  ratio?: number;
  isNeutral: boolean;
}

export interface ClothingItem {
  id: string;
  wardrobeId: string;
  sourceType: ClothingSourceType;
  sourceRef?: string;
  image: {
    originalUrl?: string;
    storedUrl: string;
    cutoutUrl?: string;
  };
  category: ClothingCategory;
  typeLabel: string;
  displayName: string;
  colors: {
    representative: ColorSwatch;
    dominant: ColorSwatch[];
  };
  pattern: PatternType;
  warmthLevel: WarmthLevel;
  availability: AvailabilityStatus;
  analysis: {
    status: 'manual' | 'draft' | 'confirmed';
    modelRefs: string[];
    confidenceNotes: string[];
    confirmedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type WeatherBand = 'freezing' | 'cold' | 'chilly' | 'cool' | 'mild' | 'warm' | 'hot' | 'very-hot';

export interface WeatherInput {
  temperatureCelsius?: number;
  band: WeatherBand;
  source: 'manual' | 'geolocation' | 'fallback';
}

export interface OutfitRecommendation {
  id: string;
  title: string;
  items: ClothingItem[];
  totalScore: number;
  scoreBreakdown: {
    personalColor: number;
    weather: number;
    harmony: number;
    stability: number;
  };
  reasons: string[];
  weatherContext: {
    temperatureCelsius?: number;
    band: WeatherBand | 'manual';
    isManualOverride: boolean;
  };
  reusedItemIds: string[];
}
