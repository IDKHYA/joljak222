// 퍼스널컬러 사진 분석과 설문 점수를 최종 진단 결과로 합산하는 엔진입니다.
/*
 * personalColorEngine.ts
 *
 * 브라우저 내부에서 동작하는 퍼스널컬러 룰 엔진입니다. 외부 AI API 호출 없이 순수 계산으로 동작합니다.
 * PhotoAnalysisResult와 QuestionnaireScores를 받아 12시즌별 사진 점수, 설문 점수, 최종 융합 점수, 신뢰도, 설명 문구를 계산합니다.
 *
 * 주요 로직은 다음과 같습니다.
 * 1. 사진에서 추출한 skin/hair/eyes/lips 색을 Lab으로 변환해 시즌 팔레트와 Delta E 거리 기반 paletteScore를 계산합니다.
 * 2. temperature, lightness, clarity, contrast, mutedScore 특징 벡터를 시즌 traits와 비교합니다.
 * 3. mutedScore가 높은 경우 겨울 과분류를 낮추고 soft 계열을 보정하는 도메인 규칙을 적용합니다.
 * 4. 설문 4축 점수와 사진 점수를 photoQuality 기반 동적 비율로 융합합니다.
 * 5. Top1/Top2 시즌, confidence, boundary, evidence, debug 데이터를 포함한 FinalResult를 생성합니다.
 *
 * 이 파일은 발표에서 "오픈소스를 그대로 복사한 결과"가 아니라
 * 얼굴 색상 신호와 사용자 착용 경험을 결합한 자체 판정 로직의 근거가 되는 부분입니다.
 */
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
  labTemperatureIndex,
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
  temperature: 0.3,
  lightness: 0.16,
  clarity: 0.34,
  contrast: 0.2,
} as const;

const QUESTION_TRAIT_WEIGHTS = {
  temperature: 0.38,
  lightness: 0.2,
  clarity: 0.25,
  contrast: 0.17,
} as const;

// 시즌 팔레트는 매번 HEX -> Lab 변환하면 비용이 크므로, 모듈 로딩 시 한 번만 Lab 좌표로 캐싱합니다.
const SEASON_PALETTE_LABS = Object.fromEntries(
  SEASON_ORDER.map((seasonId) => [seasonId, SEASON_PROFILES[seasonId].palette.map((hex) => rgbToLab(hexToRgb(hex)))]),
) as Record<SeasonId, ReturnType<typeof rgbToLab>[]>;

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

// 사진에서 추출한 피부/머리/눈/입술 색을 4축 특징으로 바꿉니다.
// 이 단계가 사진 분석 결과를 12시즌 traits와 비교 가능한 숫자 벡터로 만드는 핵심 전처리입니다.
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

  // 온도는 피부를 가장 크게 보고, 입술/머리/눈을 보조 신호로 사용합니다.
  // Lab b* 축 기반으로 계산해 조명 변화에 덜 민감하고 지각적으로 더 정확합니다.
  const temperature = clamp(
    labTemperatureIndex(skin) * 0.45 +
      labTemperatureIndex(lips) * 0.25 +
      labTemperatureIndex(hair) * 0.15 +
      labTemperatureIndex(eyes) * 0.15,
    -1,
    1,
  );

  // 명도는 얼굴 전체가 밝은 톤인지 깊은 톤인지 보기 위한 축입니다.
  // 피부 비중을 가장 크게 두되 머리카락의 어두움도 일부 반영합니다.
  const lightness = clamp(
    (luminances.skin * 0.45 + luminances.lips * 0.2 + luminances.eyes * 0.15 + luminances.hair * 0.2) * 2 - 1,
    -1,
    1,
  );

  // 채도 평균이 높으면 clear/bright 쪽, 낮으면 muted/soft 쪽으로 해석합니다.
  const averageSaturation = average([hsl.skin.s * 0.4, hsl.lips.s * 0.25, hsl.eyes.s * 0.2, hsl.hair.s * 0.15]);
  const clarity = clamp(averageSaturation * 2 - 1, -1, 1);
  const mutedScore = clamp(1 - averageSaturation, 0, 1);

  // 대비는 얼굴 내부 대비를 중심으로 계산합니다. 머리카락 대비만으로 겨울 타입이 과분류되는 것을 막기 위해 hairContrast 비중을 낮췄습니다.
  const facialLuminances = [luminances.skin, luminances.eyes, luminances.lips];
  const facialContrast = Math.max(...facialLuminances) - Math.min(...facialLuminances);
  const hairContrast = Math.abs(luminances.skin - luminances.hair);
  const contrastRaw = facialContrast * 0.78 + hairContrast * 0.22;
  const contrast = clamp(contrastRaw * 2 - 0.24, -1, 1);

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

// 추출 색상 하나가 특정 시즌 팔레트와 얼마나 가까운지 계산합니다.
// Delta E 최단 거리를 0~1 점수로 바꾸어 skin/hair/eyes/lips별 팔레트 점수에 사용합니다.
function scorePaletteMatch(colorCss: string, seasonId: SeasonId) {
  const sampleLab = rgbToLab(parseRgbString(colorCss));
  const distances = SEASON_PALETTE_LABS[seasonId].map((paletteLab) => deltaE(sampleLab, paletteLab));
  const bestDistance = Math.min(...distances);
  return clamp(1 - bestDistance / 65, 0, 1);
}

// 특정 시즌에 보정이 왜 들어갔는지 개발자 모드에서 설명하기 위한 문장을 만듭니다.
// 결과를 디버깅할 때 "왜 겨울이 낮아졌는지", "왜 소프트가 올라갔는지"를 추적할 수 있습니다.
function seasonDebugNotes(features: QuestionnaireScores & { mutedScore: number }, seasonId: SeasonId) {
  const traits = SEASON_PROFILES[seasonId].traits;
  const notes: string[] = [];
  const mutedAffinity = clamp((features.mutedScore - 0.42) / 0.45, 0, 1);

  if (SEASON_PROFILES[seasonId].family === 'winter' && mutedAffinity > 0) {
    notes.push(`뮤트 점수 ${round4(features.mutedScore)} 때문에 겨울 계열에 최대 0.16 페널티를 적용했습니다.`);
  }
  if (['soft-summer', 'soft-autumn'].includes(seasonId) && mutedAffinity > 0) {
    notes.push(`뮤트 점수 ${round4(features.mutedScore)} 때문에 소프트 시즌 보너스를 적용했습니다.`);
  }
  if (traits.contrast >= 0.75 && features.contrast < 0.35) {
    notes.push(`사진 대비 ${round4(features.contrast)}가 낮아 고대비 시즌 페널티를 적용했습니다.`);
  }
  if (traits.clarity >= 0.7 && features.clarity < 0) {
    notes.push(`사진 선명도 ${round4(features.clarity)}가 낮아 고선명 시즌 페널티를 적용했습니다.`);
  }
  if (notes.length === 0) {
    notes.push('추가 보정 없이 기본 특징 유사도와 팔레트 거리만 반영했습니다.');
  }

  return notes;
}

// features와 시즌 traits 사이의 유사도를 계산합니다.
// 사진 점수와 설문 점수는 중요도가 다르기 때문에 weights를 인자로 받아 같은 계산식을 재사용합니다.
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

// 사진 기반 시즌 점수에 도메인 보정 규칙을 더합니다.
// 저채도/저대비 얼굴이 high clarity 겨울로 과분류되는 문제를 줄이고, soft 계열은 적절히 보정합니다.
function scorePhotoSeasonTraits(features: QuestionnaireScores & { mutedScore: number }, seasonId: SeasonId) {
  const traits = SEASON_PROFILES[seasonId].traits;
  const baseScore = scoreSeasonTraits(features, seasonId, PHOTO_TRAIT_WEIGHTS);
  const mutedAffinity = clamp((features.mutedScore - 0.42) / 0.45, 0, 1);
  const winterPenalty = SEASON_PROFILES[seasonId].family === 'winter' ? mutedAffinity * 0.16 : 0;
  const softSeasonBonus = ['soft-summer', 'soft-autumn'].includes(seasonId) ? mutedAffinity * 0.1 : 0;
  const highContrastPenalty = traits.contrast >= 0.75 && features.contrast < 0.35 ? 0.12 : 0;
  const highClarityPenalty = traits.clarity >= 0.7 && features.clarity < 0 ? 0.14 : 0;

  return clamp(baseScore + softSeasonBonus - winterPenalty - highContrastPenalty - highClarityPenalty, 0, 1);
}

// Top1과 Top2가 가까울 때 결과 화면에 경계 시즌 안내를 표시합니다.
// 단일 라벨로 확정하기 어려운 경우 사용자가 인접 시즌도 참고할 수 있게 설명합니다.
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

// 내부 온도 점수를 사용자에게 보여줄 warm/cool 라벨로 단순화합니다.
function temperatureLabel(value: number) {
  if (value > 0.18) return 'warm';
  if (value < -0.18) return 'cool';
  return value >= 0 ? 'warm' : 'cool';
}

// 5문항 선택지를 temperature/lightness/clarity/contrast 4축 점수로 합산하고 -1~1로 정규화합니다.
// 사진 분석이 불안정할 때 착용 경험 기반 설문이 최종 판정을 보정하는 역할을 합니다.
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
    maximums.temperature += Math.max(...question.options.map((option) => Math.abs(option.weights.temperature ?? 0)), 0);
    maximums.lightness += Math.max(...question.options.map((option) => Math.abs(option.weights.lightness ?? 0)), 0);
    maximums.clarity += Math.max(...question.options.map((option) => Math.abs(option.weights.clarity ?? 0)), 0);
    maximums.contrast += Math.max(...question.options.map((option) => Math.abs(option.weights.contrast ?? 0)), 0);

    const selected = question.options.find((option) => option.value === rawResponses[question.id]);
    if (!selected) return;

    totals.temperature += selected.weights.temperature ?? 0;
    totals.lightness += selected.weights.lightness ?? 0;
    totals.clarity += selected.weights.clarity ?? 0;
    totals.contrast += selected.weights.contrast ?? 0;
  });

  return {
    temperature: round4(normalize(totals.temperature, maximums.temperature)),
    lightness: round4(normalize(totals.lightness, maximums.lightness)),
    clarity: round4(normalize(totals.clarity, maximums.clarity)),
    contrast: round4(normalize(totals.contrast, maximums.contrast)),
  };
}

// 얼굴 ROI에서 추출한 색상만으로 12시즌별 사진 점수를 계산합니다.
// 팔레트 거리와 4축 traits 유사도를 결합해 PhotoAnalysisResult를 만들고, 이후 설문과 융합됩니다.
export function analyzePhotoColors(input: AnalyzePhotoColorsInput): PhotoAnalysisResult {
  const featureBundle = measureColorFeatures(input.extractedColors);
  const features = featureBundle.normalizedFeatures;
  const photoSeasonBreakdown: NonNullable<PhotoAnalysisResult['debug']>['photoSeasonBreakdown'] = [];

  const rawSeasonScores = Object.fromEntries(
    SEASON_ORDER.map((seasonId) => {
      const paletteScore =
        scorePaletteMatch(input.extractedColors.skin, seasonId) * 0.45 +
        scorePaletteMatch(input.extractedColors.hair, seasonId) * 0.2 +
        scorePaletteMatch(input.extractedColors.eyes, seasonId) * 0.15 +
        scorePaletteMatch(input.extractedColors.lips, seasonId) * 0.2;
      const traitScore = scorePhotoSeasonTraits(features, seasonId);
      const rawScore = round4(paletteScore * 0.42 + traitScore * 0.58);
      photoSeasonBreakdown.push({
        seasonId,
        seasonName: SEASON_PROFILES[seasonId].name,
        paletteScore: round4(paletteScore),
        traitScore: round4(traitScore),
        rawScore,
        normalizedScore: 0,
        notes: seasonDebugNotes(features, seasonId),
      });
      return [seasonId, rawScore];
    }),
  ) as Record<SeasonId, number>;

  const seasonScores = normalizeSeasonScores(rawSeasonScores);
  photoSeasonBreakdown.forEach((item) => {
    item.normalizedScore = round4(seasonScores[item.seasonId]);
  });
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
    debug: {
      featureFormulaNotes: [
        'temperature = 피부 45% + 입술 25% + 머리 15% + 홍채 15%의 색온도 지수입니다.',
        'clarity = 피부/입술/홍채/머리 HSL 채도 평균을 -1~1로 정규화한 값입니다. 낮을수록 뮤트에 가깝습니다.',
        'contrast = 얼굴 내부 대비 78% + 피부-머리 대비 22%입니다. 검은 머리만으로 겨울 고대비가 되지 않도록 머리 비중을 낮췄습니다.',
        '사진 시즌 점수 = 팔레트 거리 42% + 특징 유사도 58%입니다. 저채도/저대비 사진은 겨울 고선명 시즌에 페널티가 들어갑니다.',
      ],
      photoSeasonBreakdown,
    },
  };
}

// 사진 신호와 설문 신호를 하나의 최종 결과로 합칩니다.
// photoQuality가 높을수록 사진 비중을 조금 올리고, 낮을수록 설문 비중을 유지해 조명/카메라 오류를 완화합니다.
export function fuseResults(
  photoData: PhotoAnalysisResult,
  questionnaireScores: QuestionnaireScores,
  rawResponses: Record<string, string>,
): FinalResult {
  const questionnaireRawScores = Object.fromEntries(
    SEASON_ORDER.map((seasonId) => [seasonId, scoreSeasonTraits(questionnaireScores, seasonId, QUESTION_TRAIT_WEIGHTS)]),
  ) as Record<SeasonId, number>;
  const questionnaireScoresNormalized = normalizeSeasonScores(questionnaireRawScores);

  const photoWeight = round4(clamp(0.22 + photoData.photoQuality * 0.14, 0.22, 0.36));
  const questionnaireWeight = round4(1 - photoWeight);

  const fusedRaw = Object.fromEntries(
    SEASON_ORDER.map((seasonId) => {
      const photoScore = photoData.seasonScores[seasonId] ?? 0;
      const questionScore = questionnaireScoresNormalized[seasonId] ?? 0;
      return [seasonId, photoScore * photoWeight + questionScore * questionnaireWeight];
    }),
  ) as Record<SeasonId, number>;

  const fusedScores = normalizeSeasonScores(fusedRaw);
  const questionnaireSeasonScores = SEASON_ORDER.map((seasonId) => ({
    seasonId,
    seasonName: SEASON_PROFILES[seasonId].name,
    rawScore: round4(questionnaireRawScores[seasonId]),
    normalizedScore: round4(questionnaireScoresNormalized[seasonId]),
  }));
  const fusedSeasonScores = SEASON_ORDER.map((seasonId) => ({
    seasonId,
    seasonName: SEASON_PROFILES[seasonId].name,
    photoScore: round4(photoData.seasonScores[seasonId] ?? 0),
    questionnaireScore: round4(questionnaireScoresNormalized[seasonId] ?? 0),
    fusedRawScore: round4(fusedRaw[seasonId]),
    fusedNormalizedScore: round4(fusedScores[seasonId]),
  }));
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
    debug: {
      questionnaireScores,
      questionnaireSeasonScores,
      fusedSeasonScores,
      rawResponses,
    },
  };
}
