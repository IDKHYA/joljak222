import { QUESTIONS } from '@/src/constants';
import { SEASON_PROFILES, SEASON_ORDER, WORKBOOK_SOURCE } from '@/src/personalColorWorkbook';
import { SEASON_DETAILS } from '@/src/seasonContent';
import {
  ExtractedColors,
  FinalResult,
  MeasurementDetails,
  PhotoAnalysisResult,
  QuestionnaireScores,
  SeasonId,
} from '@/src/types';
import {
  clamp,
  colorTemperatureIndex,
  deltaE,
  hexToRgb,
  luminance,
  normalize,
  parseRgbString,
  rgbToHsl,
  rgbToLab,
} from '@/src/services/colorUtils';

interface AnalyzePhotoColorsInput {
  extractedColors: ExtractedColors;
  photoQuality: number;
  measurementDetails: MeasurementDetails;
}

const PHOTO_TRAIT_WEIGHTS = {
  temperature: 0.38,
  lightness: 0.18,
  clarity: 0.24,
  contrast: 0.2,
} as const;

const QUESTION_TRAIT_WEIGHTS = {
  temperature: 0.38,
  lightness: 0.2,
  clarity: 0.25,
  contrast: 0.17,
} as const;

function round4(value: number) {
  return Number(value.toFixed(4));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function closeness(value: number, target: number) {
  return clamp(1 - Math.abs(value - target) / 2, 0, 1);
}

function normalizeSeasonScores(scores: Record<SeasonId, number>) {
  const entries = SEASON_ORDER.map((id) => [id, scores[id]] as const);
  const total = entries.reduce((sum, [, score]) => sum + score, 0) || 1;
  return Object.fromEntries(entries.map(([id, score]) => [id, score / total])) as Record<SeasonId, number>;
}

function rankSeasonScores(scores: Record<SeasonId, number>) {
  return [...SEASON_ORDER]
    .map((seasonId) => ({ seasonId, score: scores[seasonId] }))
    .sort((a, b) => b.score - a.score);
}

function measureColorFeatures(extractedColors: ExtractedColors) {
  const skin = parseRgbString(extractedColors.skin);
  const hair = parseRgbString(extractedColors.hair);
  const eyes = parseRgbString(extractedColors.eyes);
  const lips = parseRgbString(extractedColors.lips);

  const hsl = {
    skin: rgbToHsl(skin),
    hair: rgbToHsl(hair),
    eyes: rgbToHsl(eyes),
    lips: rgbToHsl(lips),
  };

  const luminances = {
    skin: luminance(skin),
    hair: luminance(hair),
    eyes: luminance(eyes),
    lips: luminance(lips),
  };

  const temperature = clamp(
    colorTemperatureIndex(skin) * 0.45 +
      colorTemperatureIndex(lips) * 0.25 +
      colorTemperatureIndex(hair) * 0.15 +
      colorTemperatureIndex(eyes) * 0.15,
    -1,
    1,
  );

  const lightness = clamp(
    (luminances.skin * 0.45 + luminances.lips * 0.2 + luminances.eyes * 0.15 + luminances.hair * 0.2) * 2 - 1,
    -1,
    1,
  );

  const averageSaturation = average([hsl.skin.s * 0.4, hsl.lips.s * 0.25, hsl.eyes.s * 0.2, hsl.hair.s * 0.15]);
  const clarity = clamp(averageSaturation * 2 - 1, -1, 1);
  const mutedScore = clamp(1 - averageSaturation, 0, 1);

  const contrastRaw = Math.max(...Object.values(luminances)) - Math.min(...Object.values(luminances));
  const contrast = clamp(contrastRaw * 2 - 0.15, -1, 1);

  return {
    colors: { skin, hair, eyes, lips },
    normalizedFeatures: {
      temperature: round4(temperature),
      lightness: round4(lightness),
      clarity: round4(clarity),
      contrast: round4(contrast),
      mutedScore: round4(mutedScore),
    },
  };
}

function scorePaletteMatch(colorCss: string, palette: string[]) {
  const sampleLab = rgbToLab(parseRgbString(colorCss));
  const distances = palette.map((hex) => deltaE(sampleLab, rgbToLab(hexToRgb(hex))));
  const bestDistance = Math.min(...distances);
  return clamp(1 - bestDistance / 65, 0, 1);
}

function scoreSeasonTraits(features: QuestionnaireScores, seasonId: SeasonId, weights: typeof PHOTO_TRAIT_WEIGHTS | typeof QUESTION_TRAIT_WEIGHTS) {
  const traits = SEASON_PROFILES[seasonId].traits;
  return clamp(
    closeness(features.temperature, traits.temperature) * weights.temperature +
      closeness(features.lightness, traits.lightness) * weights.lightness +
      closeness(features.clarity, traits.clarity) * weights.clarity +
      closeness(features.contrast, traits.contrast) * weights.contrast,
    0,
    1,
  );
}

function boundaryNote(topSeasonId: SeasonId, secondSeasonId: SeasonId, gap: number) {
  const top = SEASON_DETAILS[topSeasonId];
  const second = SEASON_DETAILS[secondSeasonId];
  if (gap < 0.06) {
    return `${top.title}와 ${second.title} 경계에 가까운 결과입니다. 상황에 따라 두 시즌의 색을 함께 참고하면 좋습니다.`;
  }
  if (top.adjacent.includes(secondSeasonId)) {
    return `${top.title}이 우세하지만 인접 시즌인 ${second.title}의 일부 톤도 자연스럽게 활용할 수 있습니다.`;
  }
  return `${top.title} 축이 비교적 분명하게 우세한 결과입니다.`;
}

function temperatureLabel(value: number) {
  if (value > 0.18) return 'warm';
  if (value < -0.18) return 'cool';
  return value >= 0 ? 'warm' : 'cool';
}

export function calculateQuestionnaireScores(rawResponses: Record<string, string>): QuestionnaireScores {
  const totals: QuestionnaireScores = {
    temperature: 0,
    lightness: 0,
    clarity: 0,
    contrast: 0,
  };
  const maximums: QuestionnaireScores = {
    temperature: 0,
    lightness: 0,
    clarity: 0,
    contrast: 0,
  };

  QUESTIONS.forEach((question) => {
    question.options.forEach((option) => {
      maximums.temperature += Math.max(0, Math.abs(option.weights.temperature ?? 0));
      maximums.lightness += Math.max(0, Math.abs(option.weights.lightness ?? 0));
      maximums.clarity += Math.max(0, Math.abs(option.weights.clarity ?? 0));
      maximums.contrast += Math.max(0, Math.abs(option.weights.contrast ?? 0));
    });

    const selected = question.options.find((option) => option.value === rawResponses[question.id]);
    if (!selected) return;

    totals.temperature += selected.weights.temperature ?? 0;
    totals.lightness += selected.weights.lightness ?? 0;
    totals.clarity += selected.weights.clarity ?? 0;
    totals.contrast += selected.weights.contrast ?? 0;
  });

  return {
    temperature: round4(normalize(totals.temperature, maximums.temperature / 3)),
    lightness: round4(normalize(totals.lightness, maximums.lightness / 3)),
    clarity: round4(normalize(totals.clarity, maximums.clarity / 3)),
    contrast: round4(normalize(totals.contrast, maximums.contrast / 3)),
  };
}

export function analyzePhotoColors(input: AnalyzePhotoColorsInput): PhotoAnalysisResult {
  const featureBundle = measureColorFeatures(input.extractedColors);
  const features = featureBundle.normalizedFeatures;

  const rawSeasonScores = Object.fromEntries(
    SEASON_ORDER.map((seasonId) => {
      const palette = SEASON_PROFILES[seasonId].palette;
      const paletteScore =
        scorePaletteMatch(input.extractedColors.skin, palette) * 0.45 +
        scorePaletteMatch(input.extractedColors.hair, palette) * 0.2 +
        scorePaletteMatch(input.extractedColors.eyes, palette) * 0.15 +
        scorePaletteMatch(input.extractedColors.lips, palette) * 0.2;
      const traitScore = scoreSeasonTraits(features, seasonId, PHOTO_TRAIT_WEIGHTS);
      return [seasonId, round4(paletteScore * 0.68 + traitScore * 0.32)];
    }),
  ) as Record<SeasonId, number>;

  const seasonScores = normalizeSeasonScores(rawSeasonScores);
  const ranked = rankSeasonScores(seasonScores);
  const topSeasonScores = ranked.slice(0, 4).map((item) => ({
    seasonId: item.seasonId,
    seasonName: SEASON_PROFILES[item.seasonId].name,
    score: Number((item.score * 100).toFixed(2)),
  }));

  return {
    temperature: temperatureLabel(features.temperature),
    temperatureConfidence: round4(clamp(Math.abs(features.temperature) * 0.7 + input.photoQuality * 0.3, 0, 1)),
    seasonScores,
    mutedScore: features.mutedScore,
    photoQuality: round4(input.photoQuality),
    extractedColors: input.extractedColors,
    measurementDetails: {
      ...input.measurementDetails,
      normalizedFeatures: features,
      topSeasonScores,
    },
  };
}

export function fuseResults(
  photoData: PhotoAnalysisResult,
  questionnaireScores: QuestionnaireScores,
  rawResponses: Record<string, string>,
): FinalResult {
  const questionnaireRawScores = Object.fromEntries(
    SEASON_ORDER.map((seasonId) => [seasonId, scoreSeasonTraits(questionnaireScores, seasonId, QUESTION_TRAIT_WEIGHTS)]),
  ) as Record<SeasonId, number>;
  const questionnaireScoresNormalized = normalizeSeasonScores(questionnaireRawScores);

  const photoWeight = round4(clamp(0.18 + photoData.photoQuality * 0.1, 0.18, 0.28));
  const questionnaireWeight = round4(1 - photoWeight);

  const fusedRaw = Object.fromEntries(
    SEASON_ORDER.map((seasonId) => {
      const photoScore = photoData.seasonScores[seasonId] ?? 0;
      const questionScore = questionnaireScoresNormalized[seasonId] ?? 0;
      return [seasonId, photoScore * photoWeight + questionScore * questionnaireWeight];
    }),
  ) as Record<SeasonId, number>;

  const fusedScores = normalizeSeasonScores(fusedRaw);
  const ranked = rankSeasonScores(fusedScores);
  const [first, second] = ranked;
  const topSeason = SEASON_PROFILES[first.seasonId];
  const secondSeason = SEASON_PROFILES[second.seasonId];
  const photoRanked = rankSeasonScores(photoData.seasonScores);
  const questionRanked = rankSeasonScores(questionnaireScoresNormalized);
  const photoTop = photoRanked[0];
  const questionTop = questionRanked[0];
  const gap = first.score - second.score;
  const consistency =
    photoTop.seasonId === questionTop.seasonId
      ? 'high'
      : SEASON_PROFILES[photoTop.seasonId].family === SEASON_PROFILES[questionTop.seasonId].family
        ? 'medium'
        : 'low';

  const confidenceBoost = consistency === 'high' ? 0.08 : consistency === 'medium' ? 0.03 : 0;
  const confidence = clamp(0.42 + first.score * 0.28 + gap * 1.35 + photoData.photoQuality * 0.12 + confidenceBoost, 0, 0.99);

  const explanation = `${topSeason.name} 결과가 가장 높게 나온 이유는 사진에서 읽힌 ${photoData.temperature === 'warm' ? '따뜻한' : '차가운'} 기조와 설문에서 드러난 ${questionnaireScores.clarity >= 0 ? '선명도' : '부드러운 뮤트 성향'}가 ${topSeason.name}의 특성과 가장 가깝게 맞았기 때문입니다. ${SEASON_DETAILS[first.seasonId].commonAliasSentence}`;

  return {
    temperature: topSeason.traits.temperature >= 0 ? 'warm' : 'cool',
    seasonTop1Id: first.seasonId,
    seasonTop1: topSeason.name,
    seasonTop2Id: second.seasonId,
    seasonTop2: secondSeason.name,
    confidence: round4(confidence),
    decisionType: 'hybrid',
    evidence: {
      photoSignal: {
        dominantSeasonId: photoTop.seasonId,
        temperature: photoData.temperature === 'warm' ? '웜 경향' : '쿨 경향',
        confidence: round4(photoTop.score),
        dominantSeason: SEASON_PROFILES[photoTop.seasonId].name,
      },
      questionSignal: {
        temperature: questionnaireScores.temperature >= 0 ? '웜 응답 우세' : '쿨 응답 우세',
        clarity: questionnaireScores.clarity >= 0 ? '선명도 선호' : '뮤트 선호',
        confidence: round4(questionTop.score),
      },
      consistency,
      workbookBasis: `${WORKBOOK_SOURCE} / 응답 ${Object.keys(rawResponses).length}개 반영`,
      fusionWeights: {
        photo: photoWeight,
        questionnaire: questionnaireWeight,
      },
      boundary: {
        isBoundary: gap < 0.06,
        gap: round4(gap),
        note: boundaryNote(first.seasonId, second.seasonId, gap),
      },
    },
    recommendationFeatures: {
      preferredTemperature: topSeason.traits.temperature >= 0 ? '따뜻한 웜톤' : '차갑고 맑은 쿨톤',
      preferredClarity: topSeason.traits.clarity >= 0.35 ? '선명하고 또렷한 컬러' : topSeason.traits.clarity <= -0.35 ? '회색 한 방울 섞인 뮤트 컬러' : '과하지 않게 정돈된 컬러',
      preferredLightness: topSeason.traits.lightness >= 0.45 ? '밝고 가벼운 톤' : topSeason.traits.lightness <= -0.45 ? '깊고 짙은 톤' : '중간 명도의 균형 잡힌 톤',
      contrastLevel: topSeason.traits.contrast >= 0.45 ? '대비가 큰 스타일' : topSeason.traits.contrast <= -0.2 ? '부드럽고 대비가 적은 스타일' : '중간 대비 스타일',
    },
    palette: topSeason.palette,
    extractedColors: photoData.extractedColors,
    explanation,
  };
}
