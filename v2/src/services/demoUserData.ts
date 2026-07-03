// 촬영 없이 골든 패스를 시험할 수 있는 기본 사용자 데이터를 제공합니다.
import { SEASON_PROFILES, WORKBOOK_SOURCE } from '../personalColorWorkbook';
import type { FinalResult } from '../types';
import type { PersonalColorRecord } from '../wardrobeTypes';

const SOFT_SUMMER = SEASON_PROFILES['soft-summer'];
const TRUE_SUMMER = SEASON_PROFILES['true-summer'];

export const SOFT_SUMMER_DEMO_RESULT: FinalResult = {
  temperature: 'cool',
  seasonTop1Id: 'soft-summer',
  seasonTop1: SOFT_SUMMER.name,
  seasonTop2Id: 'true-summer',
  seasonTop2: TRUE_SUMMER.name,
  confidence: 0.82,
  decisionType: 'questionnaire',
  evidence: {
    photoSignal: {
      dominantSeasonId: 'soft-summer',
      temperature: '촬영 없음',
      confidence: 0,
      dominantSeason: '테스트 데이터',
    },
    questionSignal: {
      temperature: 'cool',
      clarity: 'muted',
      confidence: 0.82,
    },
    consistency: 'medium',
    workbookBasis: `${WORKBOOK_SOURCE} 기반의 촬영 생략용 여름뮤트 데모`,
    fusionWeights: {
      photo: 0,
      questionnaire: 1,
    },
    boundary: {
      isBoundary: true,
      gap: 0.08,
      note: '소프트 서머를 1순위로 두고 트루 서머를 인접 후보로 둔 테스트 결과입니다.',
    },
  },
  recommendationFeatures: {
    preferredTemperature: 'cool',
    preferredClarity: 'muted',
    preferredLightness: 'medium-light',
    contrastLevel: 'low',
  },
  palette: SOFT_SUMMER.palette,
  extractedColors: {
    skin: '#D9CDC6',
    hair: '#4E5A72',
    eyes: '#6B7077',
    lips: '#B88C93',
  },
  explanation:
    '촬영 없이 옷장과 추천 흐름을 확인하기 위한 가상의 여름뮤트 결과입니다. 저채도, 부드러운 대비, 차분한 쿨톤 팔레트를 기준으로 추천이 계산됩니다.',
  debug: {
    questionnaireScores: {
      temperature: SOFT_SUMMER.traits.temperature,
      lightness: SOFT_SUMMER.traits.lightness,
      clarity: SOFT_SUMMER.traits.clarity,
      contrast: SOFT_SUMMER.traits.contrast,
    },
    questionnaireSeasonScores: [
      { seasonId: 'soft-summer', seasonName: SOFT_SUMMER.name, rawScore: 96, normalizedScore: 100 },
      { seasonId: 'true-summer', seasonName: TRUE_SUMMER.name, rawScore: 88, normalizedScore: 92 },
    ],
    fusedSeasonScores: [
      {
        seasonId: 'soft-summer',
        seasonName: SOFT_SUMMER.name,
        photoScore: 0,
        questionnaireScore: 100,
        fusedRawScore: 100,
        fusedNormalizedScore: 100,
      },
      {
        seasonId: 'true-summer',
        seasonName: TRUE_SUMMER.name,
        photoScore: 0,
        questionnaireScore: 92,
        fusedRawScore: 92,
        fusedNormalizedScore: 92,
      },
    ],
    rawResponses: {
      demo: 'soft-summer',
    },
  },
};

export const SOFT_SUMMER_DEMO_RECORD: PersonalColorRecord = {
  id: 'pc-demo-soft-summer',
  measuredAt: '2026-07-03T00:00:00.000Z',
  result: SOFT_SUMMER_DEMO_RESULT,
};

export function getInitialPersonalColorState(
  storedResult: FinalResult | null,
  storedHistory: PersonalColorRecord[],
): { result: FinalResult | null; history: PersonalColorRecord[] } {
  if (storedResult) {
    return {
      result: storedResult,
      history: storedHistory.length > 0 ? storedHistory : [{
        ...SOFT_SUMMER_DEMO_RECORD,
        id: `pc-migrated-${Date.now()}`,
        measuredAt: new Date().toISOString(),
        result: storedResult,
      }],
    };
  }

  return {
    result: SOFT_SUMMER_DEMO_RESULT,
    history: storedHistory.length > 0 ? storedHistory : [SOFT_SUMMER_DEMO_RECORD],
  };
}
