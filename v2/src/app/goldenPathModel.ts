// v2 첫 화면이 사용할 골든 패스 상태와 추천 결과를 조립한다.
import { buildDistinctOutfitRecommendations } from '../domain/recommendationEngine';
import { defaultPersonalColor, defaultWardrobePresetItems, defaultWeather, validatePresetReadiness } from '../domain/presetData';
import type { WeatherInput } from '../domain/types';

const SEASON_LABELS = {
  'light-spring': '라이트 스프링',
  'true-spring': '트루 스프링',
  'bright-spring': '브라이트 스프링',
  'light-summer': '라이트 서머',
  'true-summer': '트루 서머',
  'soft-summer': '소프트 서머',
  'soft-autumn': '소프트 오텀',
  'true-autumn': '트루 오텀',
  'dark-autumn': '다크 오텀',
  'dark-winter': '다크 윈터',
  'true-winter': '트루 윈터',
  'bright-winter': '브라이트 윈터',
} as const;

export function createGoldenPathModel(weather: WeatherInput = defaultWeather) {
  const recommendationResult = buildDistinctOutfitRecommendations({
    items: defaultWardrobePresetItems,
    personalColor: defaultPersonalColor,
    weather,
    count: 3,
  });
  const firstRecommendation = recommendationResult.recommendations[0];

  return {
    personalColor: defaultPersonalColor,
    personalColorLabel: SEASON_LABELS[defaultPersonalColor.top1],
    weather,
    wardrobeItems: defaultWardrobePresetItems,
    recommendations: recommendationResult.recommendations,
    issues: recommendationResult.issues,
    readiness: validatePresetReadiness({
      items: defaultWardrobePresetItems,
      personalColor: defaultPersonalColor,
      weather,
      minimumDistinctOutfits: 3,
    }),
    dailyLookCandidate: {
      title: firstRecommendation?.title ?? '데일리룩 후보',
      itemNames: firstRecommendation?.items.map((item) => item.displayName) ?? [],
      imageUrls: firstRecommendation?.items.map((item) => item.image.cutoutUrl ?? item.image.storedUrl) ?? [],
    },
  };
}
