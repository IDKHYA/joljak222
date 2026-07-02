# v2 스키마 계약 초안

작성일: 2026-07-02.

이 문서는 구현 전에 고정할 데이터 계약을 정의한다. v2에서는 인식기가 무엇을 뽑을지부터 정하지 않고, 추천 엔진이 실제로 소비하는 필드부터 정한다.

## 1. 명명 원칙

- 퍼스널컬러 시즌은 `PersonalSeasonId`로 부른다.
- 옷의 착용 적합성은 계절명이 아니라 `WarmthLevel`로 부른다.
- 색 이름과 HEX는 분리한다.
- 자동 분석 결과는 `Draft`이고, 사용자가 확인한 결과는 `Confirmed`다.

## 2. 퍼스널컬러 타입

```ts
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

export interface PersonalSeasonProfile {
  id: PersonalSeasonId;
  koreanName: string;
  englishName: string;
  family: 'spring' | 'summer' | 'autumn' | 'winter';
  traits: {
    temperature: number;
    lightness: number;
    clarity: number;
    contrast: number;
  };
  paletteHexes: string[];
}

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
```

## 3. 의류 타입

```ts
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
```

## 4. 자동 분석 초안

```ts
export interface ClothingAnalysisDraft {
  sourceType: ClothingSourceType;
  imageUrl: string;
  productTitle?: string;
  suggestedCategory: ClothingCategory;
  suggestedTypeLabel: string;
  suggestedColors: {
    representative: ColorSwatch;
    dominant: ColorSwatch[];
  };
  suggestedPattern: PatternType;
  suggestedWarmthLevel: WarmthLevel;
  observations: string[];
  warnings: string[];
}
```

규칙.

- 초안은 저장된 의류가 아니다.
- 사용자가 확인해야 `ClothingItem.analysis.status = 'confirmed'`가 된다.
- 초안의 누락값은 사용자가 수동 입력한다.
- 초안이 기존 사용자 확정값을 덮어쓰지 않는다.

## 5. 추천 타입

```ts
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
```

v2 추천 규칙.

- 기본 추천은 겹치지 않는 3개 조합을 반환한다.
- 같은 `ClothingItem.id`는 기본 3개 조합 안에서 재사용하지 않는다.
- 추천이 불가능하면 원인을 반환한다.
- 프리셋 옷장에서는 추천 불가능 상태가 테스트 실패다.

## 6. 날씨 타입

```ts
export type WeatherBand =
  | 'freezing'
  | 'cold'
  | 'chilly'
  | 'cool'
  | 'mild'
  | 'warm'
  | 'hot'
  | 'very-hot';

export interface WeatherInput {
  temperatureCelsius?: number;
  band: WeatherBand;
  source: 'manual' | 'geolocation' | 'fallback';
}
```

v1 라벨과 v2 내부값의 대응은 별도 상수로 둔다.

| v1 라벨 | v2 내부값 |
| --- | --- |
| 4도 이하 | `freezing` |
| 5~8도 | `cold` |
| 9~11도 | `chilly` |
| 12~16도 | `cool` |
| 17~19도 | `mild` |
| 20~22도 | `warm` |
| 23~27도 | `hot` |
| 28도 이상 | `very-hot` |

## 7. 카탈로그 프리셋 계약

```ts
export interface WardrobePreset {
  id: string;
  name: string;
  description: string;
  targetStyles: string[];
  itemIds: string[];
  validation: {
    minimumDistinctOutfits: number;
    supportedWeatherBands: WeatherBand[];
    checkedAt: string;
  };
}
```

규칙.

- 프리셋은 시연 골든 패스의 주 입력이다.
- 각 프리셋은 최소 3개 이상의 겹치지 않는 추천 조합을 보장해야 한다.
- 프리셋 검증 스크립트가 실패하면 배포하지 않는다.
