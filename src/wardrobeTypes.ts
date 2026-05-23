// 의류·옷장·추천·가상착용 도메인의 공용 타입 정의 모음
/*
 * wardrobeTypes.ts
 *
 * 의류, 옷장, 코디 추천, 저장 코디, 가상착용(데일리룩) 도메인에서 공용으로 쓰는 타입을 모아둡니다.
 * 퍼스널컬러 진단 도메인의 types.ts와 책임이 명확히 다르며,
 * App.tsx, recommendationEngine.ts, 화면 컴포넌트가 모두 이 파일에서 타입을 import합니다.
 *
 * 큰 분류는 다음과 같습니다.
 * 1. 라우팅 상태 (Page, AnalysisStep, WardrobeView, AppRouteState)
 * 2. 의류 도메인 유니온 타입 (ClothingCategory, FitGrade, PatternType, MaterialType, DenimWash 등)
 * 3. 옷장/의류 데이터 (Wardrobe, ClothingItem, ClothingSegmentationMeta, BackgroundRemoveResult)
 * 4. 추천 결과 (ScoredClothingItem, OutfitRecommendation, SavedOutfit)
 * 5. 데일리룩 캔버스 (DailyLookLayer, DailyLookTextLayer, DailyLookState)
 * 6. 퍼스널컬러 측정 이력 (PersonalColorRecord)
 */
import type { WeatherBand } from './lib/weather';
import type { FinalResult } from './types';

export type Page = 'home' | 'personal' | 'wardrobe' | 'recommend' | 'saved' | 'tryon' | 'settings';
export type AnalysisStep = 'photo' | 'questionnaire' | 'result';
export type WardrobeView = 'list' | 'detail' | 'catalog' | 'preview' | 'manual';
export type RecommendationWeatherBand = WeatherBand | '상관없음';

export interface AppRouteState {
  page: Page;
  analysisStep: AnalysisStep;
  wardrobeView: WardrobeView;
  selectedWardrobeId: string;
}

export type ClothingCategory = '상의' | '하의' | '아우터' | '신발' | '액세서리';
export type DailyLookSlot = 'outer' | 'upper' | 'lower' | 'shoes' | 'hat' | 'bag' | 'accessory';
export type AvailabilityStatus = '보유중' | '세탁중' | '보관중' | '추천제외';
export type FitGrade = 'BEST' | 'GOOD' | 'OK' | 'CHECK';
export type RecommendationMode = '데일리' | '출근' | '데이트' | '발표';
export type PatternType = 'solid' | 'stripe' | 'plaid' | 'graphic';
export type MaterialType = 'cotton' | 'denim' | 'knit' | 'leather' | 'nylon' | 'wool' | 'unknown';
export type DenimWash = 'light' | 'mid' | 'dark' | 'black';
// 의류가 적합한 계절 구간. 퍼스널컬러 시즌(12계절)과 다른 축이며, 날씨 기반 추천 필터에 사용됩니다.
export type SeasonTag = '봄/가을' | '여름' | '겨울' | '사계절';

export interface Wardrobe {
  id: string;
  name: string;
  createdAt: string;
}

export interface ClothingAnalysisMeta {
  part?: string;
  part_ko?: string;
  fine_labels?: string[];
  colors?: ClothingColorAnalysis[];
}

export interface ClothingColorAnalysis {
  hex?: string;
  ratio?: number;
  rgb?: number[];
}

export interface ClothingItem {
  id: string;
  wardrobeId: string;
  imageUrl: string;
  originalImageUrl?: string;
  cutoutImageUrl?: string;
  segmentation?: ClothingSegmentationMeta;
  category: ClothingCategory;
  type: string;
  color: string;
  size: string;
  brand: string;
  createdAt: string;
  representativeColor: string;
  representativeHex: string;
  dominantColors: ClothingColorAnalysis[];
  seasonTag: SeasonTag;
  patternType: PatternType;
  material: MaterialType;
  availabilityStatus: AvailabilityStatus;
  isNeutral: boolean;
  isDenim: boolean;
  denimWash?: DenimWash;
  sourceType: 'catalog' | 'upload';
  catalogItemId?: string;
}

export interface ClothingSegmentationMeta {
  width: number;
  height: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  model: string;
  version?: string;
  processedAt: string;
  colors?: ClothingColorAnalysis[];
}

export interface BackgroundRemoveResult {
  imageDataUrl: string;
  width: number;
  height: number;
  bbox: ClothingSegmentationMeta['bbox'];
  colors?: ClothingColorAnalysis[];
  model: string;
  version?: string;
  processedAt: string;
  predictedSeason?: string;
  seasonConfidence?: number;
  seasonProbabilities?: Record<string, number>;
  predictedMaterial?: string;
  detectedCategory?: string;
  fineLabels?: string[];
}

export interface ScoredClothingItem extends ClothingItem {
  personalFitScore: number | null;
  fitGrade: FitGrade | null;
  fitReason: string;
  avoidRisk: boolean;
}

export interface OutfitRecommendation {
  id: string;
  title: string;
  harmonyType: string;
  score: number;
  personalScore: number;
  harmonyScore: number;
  weatherScore: number;
  stabilityScore: number;
  items: ScoredClothingItem[];
  reason: string;
  weatherBand: RecommendationWeatherBand;
  mode: RecommendationMode;
}

export interface SavedOutfit {
  id: string;
  title: string;
  score: number;
  itemIds: string[];
  colorHexes: string[];
  weatherBand: RecommendationWeatherBand;
  mode: RecommendationMode;
  savedAt: string;
  dailyLookState?: DailyLookState;
}

export interface DailyLookLayer {
  itemId: string;
  category: ClothingCategory;
  slot: DailyLookSlot;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
  visible: boolean;
}

export interface DailyLookTextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  rotation: number;
  zIndex: number;
  visible: boolean;
}

export interface DailyLookState {
  canvas: {
    width: number;
    height: number;
  };
  layers: DailyLookLayer[];
  textLayers?: DailyLookTextLayer[];
  isConfirmed: boolean;
  confirmedImage?: string;
  confirmedAt?: string;
}

export interface PersonalColorRecord {
  id: string;
  measuredAt: string;
  result: FinalResult;
}
