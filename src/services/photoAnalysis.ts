/*
 * photoAnalysis.ts
 *
 * 퍼스널컬러 사진 분석의 핵심 도메인 서비스입니다.
 * MediaPipe 얼굴 랜드마크를 입력으로 받아, 퍼스널컬러 판단에 필요한 ROI를 만들고 각 ROI의 대표색과 사진 품질을 계산합니다.
 *
 * 주요 처리 흐름은 다음과 같습니다.
 * 1. 얼굴 bounds와 landmarks를 픽셀 좌표로 변환합니다.
 * 2. 볼, 이마, 코, 눈밑, 턱선, 홍채, 입술, 헤어라인, 눈썹 ROI를 생성합니다.
 * 3. ROI 내부 픽셀을 샘플링하되, 가장자리/알파/과노출/저노출 이상치를 제거합니다.
 * 4. 흰 종이 기준, 중립 배경, 모서리 fallback 순서로 조명 보정을 적용합니다.
 * 5. skin/hair/eyes/lips 대표색, RGB/HSL/Lab 측정값, 노출/대칭/구분도/얼굴 크기 기반 품질 점수를 생성합니다.
 *
 * 이 파일의 출력은 geminiService.ts의 로컬 융합 엔진으로 전달되어 12시즌 점수 계산에 사용됩니다.
 */
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { MeasurementDetails } from '@/src/types';
import { clamp, deltaE, rgbToCss, rgbToHsl, rgbToLab } from '@/src/services/colorUtils';

export type SampleRegionKey =
  | 'skinLeft'
  | 'skinRight'
  | 'forehead'
  | 'noseLeft'
  | 'noseRight'
  | 'underEyeLeft'
  | 'underEyeRight'
  | 'jawLeft'
  | 'jawRight'
  | 'eyesLeft'
  | 'eyesRight'
  | 'lips'
  | 'hair'
  | 'eyebrowLeft'
  | 'eyebrowRight';

export interface SampleRegion {
  key: SampleRegionKey;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CalibrationRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LiveDetectionState {
  landmarks: NormalizedLandmark[];
  faceBounds: { x: number; y: number; width: number; height: number };
  sampleRegions: SampleRegion[];
}

export interface PhotoAnalysisPayload {
  extractedColors: {
    skin: string;
    hair: string;
    eyes: string;
    lips: string;
  };
  photoQuality: number;
  measurementDetails: MeasurementDetails;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface SampleStatistics {
  average: Rgb;
  trimmed: Rgb;
  variability: number;
}

interface RobustSampleOptions {
  trimDarkRatio: number;
  trimLightRatio: number;
  minSaturation?: number;
  erosionPx?: number;
  preferLabMedian?: boolean;
}

interface BackgroundCalibration {
  gains: Rgb;
  brightness: number;
  neutrality: number;
  correctionStrength: number;
  source: 'white-reference' | 'neutral-background' | 'corner-fallback';
}

interface FaceBoundsPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

const LEFT_IRIS_INDICES = [468, 469, 470, 471, 472];
const RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477];
const LEFT_EYEBROW_INDICES = [70, 63, 105];
const RIGHT_EYEBROW_INDICES = [336, 296, 334];
const FOREHEAD_INDICES = [10, 9, 151];
const LEFT_NOSE_INDICES = [129, 98, 49];
const RIGHT_NOSE_INDICES = [358, 327, 279];
const LEFT_UNDER_EYE_INDICES = [117, 118, 119];
const RIGHT_UNDER_EYE_INDICES = [346, 347, 348];
const LEFT_JAW_INDICES = [172, 136, 150];
const RIGHT_JAW_INDICES = [397, 365, 379];

export const WHITE_REFERENCE_REGION_RATIO: CalibrationRegion = {
  x: 0.69,
  y: 0.58,
  width: 0.22,
  height: 0.16,
};

const PORTRAIT_WHITE_REFERENCE_REGION_RATIO: CalibrationRegion = {
  x: 0.34,
  y: 0.59,
  width: 0.32,
  height: 0.15,
};

const LANDSCAPE_WHITE_REFERENCE_REGION_RATIO: CalibrationRegion = {
  x: 0.42,
  y: 0.62,
  width: 0.16,
  height: 0.17,
};

// 화면 비율에 따라 흰 종이 기준 영역 위치를 다르게 잡습니다.
// 세로 촬영과 가로 촬영에서 같은 비율을 쓰면 손/종이 위치가 어긋나기 때문입니다.
const getDefaultCalibrationRegion = (width: number, height: number) => {
  if (!width || !height) return WHITE_REFERENCE_REGION_RATIO;
  return height >= width ? PORTRAIT_WHITE_REFERENCE_REGION_RATIO : LANDSCAPE_WHITE_REFERENCE_REGION_RATIO;
};

// 비율 기반 calibration 영역을 실제 canvas 픽셀 좌표로 변환합니다.
export const calibrationRegionToPixels = (width: number, height: number, region = getDefaultCalibrationRegion(width, height)): CalibrationRegion => ({
  x: region.x * width,
  y: region.y * height,
  width: region.width * width,
  height: region.height * height,
});

// MediaPipe normalized landmark(0~1)를 canvas 픽셀 좌표로 변환합니다.
const landmarkPoint = (landmarks: NormalizedLandmark[], index: number, width: number, height: number) => ({
  x: landmarks[index].x * width,
  y: landmarks[index].y * height,
});

// 여러 landmark의 평균점을 구합니다. 홍채/눈썹/이마처럼 단일 점보다 평균 위치가 안정적인 부위에 사용합니다.
const averagePoint = (landmarks: NormalizedLandmark[], indices: number[], width: number, height: number) => {
  const points = indices.map((index) => landmarkPoint(landmarks, index, width, height));
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
};

// 얼굴 랜드마크를 기준으로 피부, 홍채, 입술, 헤어라인 등 분석할 ROI 박스를 만듭니다.
// faceWidth/faceHeight 비율을 사용하므로 얼굴이 크거나 작아도 같은 상대 위치를 샘플링할 수 있습니다.
export function buildSampleRegions(landmarks: NormalizedLandmark[], width: number, height: number, faceWidth: number, faceHeight: number): SampleRegion[] {
  const leftCheek = landmarkPoint(landmarks, 205, width, height);
  const rightCheek = landmarkPoint(landmarks, 425, width, height);
  const leftIris = averagePoint(landmarks, LEFT_IRIS_INDICES, width, height);
  const rightIris = averagePoint(landmarks, RIGHT_IRIS_INDICES, width, height);
  const leftEyebrow = averagePoint(landmarks, LEFT_EYEBROW_INDICES, width, height);
  const rightEyebrow = averagePoint(landmarks, RIGHT_EYEBROW_INDICES, width, height);
  const foreheadCenter = averagePoint(landmarks, FOREHEAD_INDICES, width, height);
  const leftNose = averagePoint(landmarks, LEFT_NOSE_INDICES, width, height);
  const rightNose = averagePoint(landmarks, RIGHT_NOSE_INDICES, width, height);
  const leftUnderEye = averagePoint(landmarks, LEFT_UNDER_EYE_INDICES, width, height);
  const rightUnderEye = averagePoint(landmarks, RIGHT_UNDER_EYE_INDICES, width, height);
  const leftJaw = averagePoint(landmarks, LEFT_JAW_INDICES, width, height);
  const rightJaw = averagePoint(landmarks, RIGHT_JAW_INDICES, width, height);
  const lipsCenter = averagePoint(landmarks, [0, 13, 14, 17, 78, 308], width, height);
  const forehead = landmarkPoint(landmarks, 10, width, height);

  const region = (key: SampleRegionKey, label: string, centerX: number, centerY: number, regionWidth: number, regionHeight: number): SampleRegion => ({
    key,
    label,
    x: clamp(centerX - regionWidth / 2, 0, width - 1),
    y: clamp(centerY - regionHeight / 2, 0, height - 1),
    width: Math.max(1, Math.min(regionWidth, width)),
    height: Math.max(1, Math.min(regionHeight, height)),
  });

  return [
    region('underEyeLeft', '왼쪽 눈가', leftUnderEye.x, leftUnderEye.y, faceWidth * 0.11, faceHeight * 0.06),
    region('underEyeRight', '오른쪽 눈가', rightUnderEye.x, rightUnderEye.y, faceWidth * 0.11, faceHeight * 0.06),
    region('jawLeft', '왼쪽 턱선', leftJaw.x, leftJaw.y, faceWidth * 0.12, faceHeight * 0.07),
    region('jawRight', '오른쪽 턱선', rightJaw.x, rightJaw.y, faceWidth * 0.12, faceHeight * 0.07),
    region('skinLeft', '왼쪽 볼', leftCheek.x, leftCheek.y, faceWidth * 0.14, faceHeight * 0.1),
    region('skinRight', '오른쪽 볼', rightCheek.x, rightCheek.y, faceWidth * 0.14, faceHeight * 0.1),
    region('forehead', '이마 중심', foreheadCenter.x, foreheadCenter.y + faceHeight * 0.03, faceWidth * 0.12, faceHeight * 0.07),
    region('noseLeft', '코 왼쪽', leftNose.x, leftNose.y, faceWidth * 0.08, faceHeight * 0.08),
    region('noseRight', '코 오른쪽', rightNose.x, rightNose.y, faceWidth * 0.08, faceHeight * 0.08),
    region('eyesLeft', '왼쪽 홍채', leftIris.x, leftIris.y, faceWidth * 0.06, faceHeight * 0.05),
    region('eyesRight', '오른쪽 홍채', rightIris.x, rightIris.y, faceWidth * 0.06, faceHeight * 0.05),
    region('eyebrowLeft', '왼쪽 눈썹', leftEyebrow.x, leftEyebrow.y, faceWidth * 0.1, faceHeight * 0.05),
    region('eyebrowRight', '오른쪽 눈썹', rightEyebrow.x, rightEyebrow.y, faceWidth * 0.1, faceHeight * 0.05),
    region('lips', '입술 중심', lipsCenter.x, lipsCenter.y, faceWidth * 0.11, faceHeight * 0.04),
    region('hair', '헤어라인', forehead.x, clamp(forehead.y - faceHeight * 0.12, faceHeight * 0.04, height - 1), faceWidth * 0.18, faceHeight * 0.08),
  ];
}

// RGB의 상대 휘도입니다. 노출 판단, 배경 중립성, 대비 점수에 반복 사용됩니다.
const luminance = (color: Rgb) => (color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722) / 255;

// 픽셀 묶음의 단순 평균색을 구합니다.
const averageRgb = (pixels: Rgb[]): Rgb => {
  const total = pixels.reduce((sum, pixel) => ({ r: sum.r + pixel.r, g: sum.g + pixel.g, b: sum.b + pixel.b }), { r: 0, g: 0, b: 0 });
  return { r: total.r / pixels.length, g: total.g / pixels.length, b: total.b / pixels.length };
};

// 이상치에 흔들리지 않는 중앙값 계산입니다. Lab medoid 계산에서 목표 중심을 잡을 때 사용합니다.
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

// 지나치게 어둡거나 밝은 픽셀을 제거합니다. ROI 안의 그림자/하이라이트가 대표색을 왜곡하지 않게 합니다.
const trimByLuminance = (pixels: Rgb[], trimDarkRatio: number, trimLightRatio: number) => {
  const byLuminance = [...pixels].sort((left, right) => luminance(left) - luminance(right));
  const trimStart = Math.floor(byLuminance.length * trimDarkRatio);
  const trimEnd = Math.max(trimStart + 1, Math.ceil(byLuminance.length * (1 - trimLightRatio)));
  return byLuminance.slice(trimStart, trimEnd);
};

const trimmedRgb = (pixels: Rgb[], trimDarkRatio: number, trimLightRatio = trimDarkRatio): Rgb => averageRgb(trimByLuminance(pixels, trimDarkRatio, trimLightRatio));

// Lab 공간에서 중앙값에 가장 가까운 실제 픽셀을 대표색으로 선택합니다.
// 평균값이 실제 존재하지 않는 색으로 흐려지는 문제를 줄이기 위한 robust sampling입니다.
const labMedianMedoid = (pixels: Rgb[]): Rgb => {
  const labs = pixels.map((pixel) => ({ pixel, lab: rgbToLab(pixel) }));
  const target = {
    l: median(labs.map((item) => item.lab.l)),
    a: median(labs.map((item) => item.lab.a)),
    b: median(labs.map((item) => item.lab.b)),
  };
  return labs.reduce((best, current) => (deltaE(current.lab, target) < deltaE(best.lab, target) ? current : best)).pixel;
};

// ROI 내부 픽셀을 읽습니다. erosionPx로 가장자리를 깎아 머리카락/배경이 섞이는 것을 줄입니다.
const pixelsFromRegion = (context: CanvasRenderingContext2D, region: SampleRegion | CalibrationRegion, erosionPx = 0): Rgb[] => {
  const erosion = Math.max(0, Math.min(Math.floor(erosionPx), Math.floor(Math.min(region.width, region.height) / 3)));
  const x = Math.round(region.x + erosion);
  const y = Math.round(region.y + erosion);
  const w = Math.max(1, Math.round(region.width - erosion * 2));
  const h = Math.max(1, Math.round(region.height - erosion * 2));
  const data = context.getImageData(x, y, w, h).data;
  const pixels: Rgb[] = [];

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 180) continue;
    pixels.push({ r: data[index], g: data[index + 1], b: data[index + 2] });
  }

  return pixels;
};

// ROI 픽셀에서 평균색, trimmed 대표색, 픽셀 변동성을 계산합니다.
// variability는 사진 품질과 측정 안정성을 설명하는 지표로 쓰입니다.
const sampleFromPixels = (pixels: Rgb[], options: RobustSampleOptions): SampleStatistics => {
  if (pixels.length === 0) {
    return { average: { r: 0, g: 0, b: 0 }, trimmed: { r: 0, g: 0, b: 0 }, variability: 0 };
  }

  const saturationFiltered = options.minSaturation === undefined ? pixels : pixels.filter((pixel) => rgbToHsl(pixel).s >= options.minSaturation);
  const sourcePixels = saturationFiltered.length >= Math.max(12, pixels.length * 0.2) ? saturationFiltered : pixels;
  const average = averageRgb(sourcePixels);
  const trimmedPixels = trimByLuminance(sourcePixels, options.trimDarkRatio, options.trimLightRatio);
  const trimmed = options.preferLabMedian ? labMedianMedoid(trimmedPixels) : averageRgb(trimmedPixels);
  const variability = Math.sqrt(
    trimmedPixels.reduce((sum, pixel) => sum + ((pixel.r - trimmed.r) ** 2 + (pixel.g - trimmed.g) ** 2 + (pixel.b - trimmed.b) ** 2) / 3, 0) /
      trimmedPixels.length,
  );

  return { average, trimmed, variability };
};

// 일반 ROI 샘플링 기본값입니다. 밝은 이상치를 조금 더 제거해 피부 반사광 영향을 낮춥니다.
const sampleRegion = (context: CanvasRenderingContext2D, region: SampleRegion | CalibrationRegion): SampleStatistics =>
  sampleFromPixels(pixelsFromRegion(context, region, 1), { trimDarkRatio: 0.1, trimLightRatio: 0.05 });

// 피부 ROI는 미세한 잡색보다 안정된 피부색이 중요하므로 saturation 필터와 Lab medoid를 사용합니다.
const sampleSkinRegion = (context: CanvasRenderingContext2D, region: SampleRegion): SampleStatistics =>
  sampleFromPixels(pixelsFromRegion(context, region, 2), {
    trimDarkRatio: 0.1,
    trimLightRatio: 0.05,
    minSaturation: 0.04,
    preferLabMedian: true,
  });

// 입술 ROI는 피부와 섞이기 쉬워 붉은/분홍 계열 픽셀을 우선 선별합니다.
// 충분한 lip-like 픽셀이 없으면 전체 픽셀로 fallback해 분석이 끊기지 않게 합니다.
const sampleLipColor = (context: CanvasRenderingContext2D, region: SampleRegion): SampleStatistics => {
  const pixels = pixelsFromRegion(context, region, 3);
  const lipLikePixels = pixels.filter((pixel) => {
    const hsl = rgbToHsl(pixel);
    const isRedPinkHue = hsl.h <= 0.08 || hsl.h >= 0.88;
    const hasLipRedness = pixel.r >= pixel.g * 1.02 && pixel.r >= pixel.b * 0.92;
    return isRedPinkHue && hasLipRedness && hsl.l >= 0.16 && hsl.s >= 0.1;
  });
  const sourcePixels = lipLikePixels.length >= 24 ? lipLikePixels : pixels;
  return sampleFromPixels(sourcePixels, {
    trimDarkRatio: lipLikePixels.length >= 24 ? 0.18 : 0.14,
    trimLightRatio: 0.05,
    minSaturation: lipLikePixels.length >= 24 ? 0.1 : 0.06,
    preferLabMedian: true,
  });
};

// 입술색 보정에 필요한 HSL -> RGB 변환입니다.
const hslToRgb = (hue: number, saturation: number, lightness: number): Rgb => {
  if (saturation === 0) {
    const value = lightness * 255;
    return { r: value, g: value, b: value };
  }

  const h = ((hue % 1) + 1) % 1;
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = (offset: number) => {
    const t = (h + offset + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return {
    r: channel(1 / 3) * 255,
    g: channel(0) * 255,
    b: channel(-1 / 3) * 255,
  };
};

// 입술 샘플이 너무 갈색/어둡게 잡히는 경우 피부 밝기를 참고해 완만하게 보정합니다.
// 보정 강도를 제한해 실제 색을 과하게 바꾸지 않도록 했습니다.
const correctLipColor = (lip: Rgb, skin: Rgb): Rgb => {
  const lipHsl = rgbToHsl(lip);
  const skinHsl = rgbToHsl(skin);
  const looksBrown = lipHsl.h > 0.055 && lipHsl.h < 0.14 && lip.b < lip.g * 0.92;
  const tooDark = luminance(lip) < luminance(skin) * 0.52;
  const targetHue = looksBrown ? 0.975 : lipHsl.h;
  const targetSaturation = clamp(Math.max(lipHsl.s, 0.22), 0, 0.58);
  const targetLightness = tooDark ? clamp(Math.max(lipHsl.l, skinHsl.l * 0.58), 0.18, 0.58) : lipHsl.l;
  const corrected = hslToRgb(targetHue, targetSaturation, targetLightness);
  const strength = clamp((looksBrown ? 0.3 : 0) + (tooDark ? 0.24 : 0), 0, 0.46);

  return {
    r: lip.r * (1 - strength) + corrected.r * strength,
    g: lip.g * (1 - strength) + corrected.g * strength,
    b: lip.b * (1 - strength) + corrected.b * strength,
  };
};

// 사용자가 흰 종이를 들고 촬영한 경우 해당 영역을 기준으로 화이트 밸런스를 추정합니다.
// 밝기와 안정성이 낮으면 잘못된 기준으로 판단하지 않도록 null을 반환합니다.
const sampleWhiteReferenceCalibration = (context: CanvasRenderingContext2D, calibrationRegion?: CalibrationRegion): BackgroundCalibration | null => {
  if (!calibrationRegion) return null;

  const sample = sampleRegion(context, calibrationRegion);
  const color = sample.trimmed;
  const brightness = luminance(color);
  const channelSpread = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
  const neutrality = clamp(1 - channelSpread / 95, 0, 1);
  const stability = clamp(1 - sample.variability / 42, 0, 1);

  if (brightness < 0.42 || brightness > 0.98 || stability < 0.28) {
    return null;
  }

  const gray = (color.r + color.g + color.b) / 3;
  const correctionStrength = clamp((0.65 + stability * 0.3) * Math.max(0.45, neutrality), 0.45, 0.95);

  return {
    gains: {
      r: clamp(1 + ((gray / Math.max(1, color.r)) - 1) * correctionStrength, 0.82, 1.18),
      g: clamp(1 + ((gray / Math.max(1, color.g)) - 1) * correctionStrength, 0.82, 1.18),
      b: clamp(1 + ((gray / Math.max(1, color.b)) - 1) * correctionStrength, 0.82, 1.18),
    },
    brightness,
    neutrality,
    correctionStrength,
    source: 'white-reference',
  };
};

// 흰 종이 기준이 없을 때 배경의 중립 픽셀을 모아 조명 보정을 계산합니다.
// 중립 픽셀이 부족하면 화면 모서리 fallback으로 넘어갑니다.
const sampleBackgroundCalibration = (context: CanvasRenderingContext2D, width: number, height: number, faceBounds: FaceBoundsPixels): BackgroundCalibration => {
  const neutralPixels = collectNeutralBackgroundPixels(context, width, height, faceBounds);

  if (neutralPixels.length < 48) {
    return sampleCornerCalibration(context, width, height);
  }

  const average = trimmedRgb(neutralPixels, 0.1);
  const brightness = luminance(average);
  const channelSpread = Math.max(average.r, average.g, average.b) - Math.min(average.r, average.g, average.b);
  const neutrality = clamp(1 - channelSpread / 42, 0, 1);
  const sampleCoverage = clamp(neutralPixels.length / 900, 0, 1);
  const brightnessReliability = clamp(1 - Math.abs(brightness - 0.68) / 0.42, 0, 1);
  const correctionStrength = clamp((0.25 + sampleCoverage * 0.55) * neutrality * brightnessReliability, 0, 0.85);
  const gray = (average.r + average.g + average.b) / 3;

  return {
    gains: {
      r: clamp(1 + ((gray / Math.max(1, average.r)) - 1) * correctionStrength * 0.65, 0.88, 1.12),
      g: clamp(1 + ((gray / Math.max(1, average.g)) - 1) * correctionStrength * 0.65, 0.88, 1.12),
      b: clamp(1 + ((gray / Math.max(1, average.b)) - 1) * correctionStrength * 0.65, 0.88, 1.12),
    },
    brightness,
    neutrality,
    correctionStrength,
    source: 'neutral-background',
  };
};

// 얼굴 주변을 피하고 화면 가장자리/배경 영역에서 중립색에 가까운 픽셀만 수집합니다.
const collectNeutralBackgroundPixels = (context: CanvasRenderingContext2D, width: number, height: number, faceBounds: FaceBoundsPixels): Rgb[] => {
  const data = context.getImageData(0, 0, width, height).data;
  const step = Math.max(3, Math.round(Math.min(width, height) / 180));
  const marginX = Math.max(width * 0.06, 24);
  const marginY = Math.max(height * 0.06, 24);
  const expandedFace = {
    x: faceBounds.x - faceBounds.width * 0.22,
    y: faceBounds.y - faceBounds.height * 0.18,
    width: faceBounds.width * 1.44,
    height: faceBounds.height * 1.36,
  };
  const pixels: Rgb[] = [];

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const isEdgeArea = x < marginX || x > width - marginX || y < marginY || y > height - marginY;
      const isNearFace = x >= expandedFace.x && x <= expandedFace.x + expandedFace.width && y >= expandedFace.y && y <= expandedFace.y + expandedFace.height;
      if (!isEdgeArea && isNearFace) continue;

      const index = (Math.round(y) * width + Math.round(x)) * 4;
      if (data[index + 3] < 180) continue;

      const pixel = { r: data[index], g: data[index + 1], b: data[index + 2] };
      if (isNeutralBackgroundPixel(pixel)) {
        pixels.push(pixel);
      }
    }
  }

  return pixels;
};

// 조명 보정 기준으로 쓸 수 있는 회색/흰색 계열 배경 픽셀인지 판단합니다.
const isNeutralBackgroundPixel = (pixel: Rgb) => {
  const max = Math.max(pixel.r, pixel.g, pixel.b);
  const min = Math.min(pixel.r, pixel.g, pixel.b);
  const brightness = luminance(pixel);
  const spread = max - min;
  const saturationProxy = max === 0 ? 0 : spread / max;

  return brightness >= 0.35 && brightness <= 0.96 && spread <= 42 && saturationProxy <= 0.18;
};

// 배경 픽셀이 충분하지 않을 때 네 모서리 패치로 약한 보정값을 계산하는 fallback입니다.
const sampleCornerCalibration = (context: CanvasRenderingContext2D, width: number, height: number): BackgroundCalibration => {
  const patches = [
    { x: 0, y: 0, width: width * 0.12, height: height * 0.12 },
    { x: width * 0.88, y: 0, width: width * 0.12, height: height * 0.12 },
    { x: 0, y: height * 0.88, width: width * 0.12, height: height * 0.12 },
    { x: width * 0.88, y: height * 0.88, width: width * 0.12, height: height * 0.12 },
  ];
  const average = averageRgb(patches.map((patch) => sampleRegion(context, patch).trimmed));
  const brightness = luminance(average);
  const channelSpread = Math.max(average.r, average.g, average.b) - Math.min(average.r, average.g, average.b);
  const neutrality = clamp(1 - channelSpread / 70, 0, 1);
  const correctionStrength = clamp(((brightness - 0.55) / 0.35) * neutrality, 0, 0.45);
  const gray = (average.r + average.g + average.b) / 3;

  return {
    gains: {
      r: clamp(1 + ((gray / Math.max(1, average.r)) - 1) * correctionStrength * 0.65, 0.9, 1.1),
      g: clamp(1 + ((gray / Math.max(1, average.g)) - 1) * correctionStrength * 0.65, 0.9, 1.1),
      b: clamp(1 + ((gray / Math.max(1, average.b)) - 1) * correctionStrength * 0.65, 0.9, 1.1),
    },
    brightness,
    neutrality,
    correctionStrength,
    source: 'corner-fallback',
  };
};

// 추정된 RGB gain을 실제 샘플 색에 적용합니다.
const applyCalibration = (color: Rgb, calibration: BackgroundCalibration): Rgb => ({
  r: clamp(color.r * calibration.gains.r, 0, 255),
  g: clamp(color.g * calibration.gains.g, 0, 255),
  b: clamp(color.b * calibration.gains.b, 0, 255),
});

// 사진이 최종 판정에 얼마나 믿을 만한지 0~1로 평가합니다.
// 노출, 좌우 피부 대칭, 부위별 구분도, 얼굴 크기, 배경 보정 품질을 종합합니다.
const calculatePhotoQuality = (leftSkin: Rgb, rightSkin: Rgb, hair: Rgb, eyes: Rgb, lips: Rgb, faceWidth: number, frameWidth: number, background: BackgroundCalibration) => {
  const skinAverage = { r: (leftSkin.r + rightSkin.r) / 2, g: (leftSkin.g + rightSkin.g) / 2, b: (leftSkin.b + rightSkin.b) / 2 };
  const exposureScore = clamp(1 - Math.abs(luminance(skinAverage) - 0.62) / 0.42, 0, 1);
  const symmetryScore = clamp(1 - deltaE(rgbToLab(leftSkin), rgbToLab(rightSkin)) / 28, 0, 1);
  const distinctness = (deltaE(rgbToLab(skinAverage), rgbToLab(hair)) + deltaE(rgbToLab(skinAverage), rgbToLab(eyes)) + deltaE(rgbToLab(skinAverage), rgbToLab(lips))) / 3;
  const distinctnessScore = clamp(distinctness / 32, 0, 1);
  const sizeScore = clamp(faceWidth / (frameWidth * 0.42), 0, 1);
  const whiteReferenceBonus = background.source === 'white-reference' ? 0.08 : 0;
  const backgroundScore = clamp(background.brightness * 0.5 + background.neutrality * 0.42 + whiteReferenceBonus, 0, 1);

  return {
    overall: clamp(0.12 + exposureScore * 0.24 + symmetryScore * 0.18 + distinctnessScore * 0.18 + sizeScore * 0.12 + backgroundScore * 0.16, 0.35, 0.98),
    exposure: exposureScore,
    symmetry: symmetryScore,
    distinctness: distinctnessScore,
    faceSize: sizeScore,
    background: backgroundScore,
  };
};

// 결과 화면에서 ROI 색의 HSL 값을 보여주기 위한 변환입니다.
const hslDetails = (color: Rgb) => {
  const hsl = rgbToHsl(color);
  return { h: hsl.h * 360, s: hsl.s * 100, l: hsl.l * 100 };
};

const round4 = (value: number) => Number(value.toFixed(4));

// 얼굴 스냅샷 한 장에서 최종 사진 분석 payload를 생성합니다.
// ROI 생성 -> robust sampling -> 조명 보정 -> 대표색 계산 -> 품질 점수/측정 상세 생성 순서로 흐릅니다.
export function analyzeFaceSnapshotColors(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  bounds: { minX: number; minY: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  calibrationRegion?: CalibrationRegion,
): PhotoAnalysisPayload {
  const faceWidth = bounds.width * canvasWidth;
  const faceHeight = bounds.height * canvasHeight;
  const sampleRegions = buildSampleRegions(landmarks, canvasWidth, canvasHeight, faceWidth, faceHeight);
  const regionByKey = Object.fromEntries(sampleRegions.map((region) => [region.key, region])) as Record<SampleRegionKey, SampleRegion>;
  const backgroundCalibration =
    sampleWhiteReferenceCalibration(context, calibrationRegion) ??
    sampleBackgroundCalibration(context, canvasWidth, canvasHeight, {
      x: bounds.minX * canvasWidth,
      y: bounds.minY * canvasHeight,
      width: faceWidth,
      height: faceHeight,
    });
  const skinRegionKeys: SampleRegionKey[] = ['skinLeft', 'skinRight', 'forehead', 'noseLeft', 'noseRight', 'underEyeLeft', 'underEyeRight', 'jawLeft', 'jawRight'];
  const samples = Object.fromEntries(
    sampleRegions.map((region) => [
      region.key,
      region.key === 'lips' ? sampleLipColor(context, region) : skinRegionKeys.includes(region.key) ? sampleSkinRegion(context, region) : sampleRegion(context, region),
    ]),
  ) as Record<SampleRegionKey, SampleStatistics>;
  // 피부는 한 점만 쓰지 않고 볼/이마/코/눈밑/턱선을 가중 평균합니다.
  // 볼을 가장 크게 반영하되, 조명 편차를 줄이기 위해 여러 부위를 함께 봅니다.
  const skin = applyCalibration(
    {
      r:
        samples.skinLeft.trimmed.r * 0.2 +
        samples.skinRight.trimmed.r * 0.2 +
        samples.forehead.trimmed.r * 0.14 +
        samples.noseLeft.trimmed.r * 0.08 +
        samples.noseRight.trimmed.r * 0.08 +
        samples.underEyeLeft.trimmed.r * 0.1 +
        samples.underEyeRight.trimmed.r * 0.1 +
        samples.jawLeft.trimmed.r * 0.05 +
        samples.jawRight.trimmed.r * 0.05,
      g:
        samples.skinLeft.trimmed.g * 0.2 +
        samples.skinRight.trimmed.g * 0.2 +
        samples.forehead.trimmed.g * 0.14 +
        samples.noseLeft.trimmed.g * 0.08 +
        samples.noseRight.trimmed.g * 0.08 +
        samples.underEyeLeft.trimmed.g * 0.1 +
        samples.underEyeRight.trimmed.g * 0.1 +
        samples.jawLeft.trimmed.g * 0.05 +
        samples.jawRight.trimmed.g * 0.05,
      b:
        samples.skinLeft.trimmed.b * 0.2 +
        samples.skinRight.trimmed.b * 0.2 +
        samples.forehead.trimmed.b * 0.14 +
        samples.noseLeft.trimmed.b * 0.08 +
        samples.noseRight.trimmed.b * 0.08 +
        samples.underEyeLeft.trimmed.b * 0.1 +
        samples.underEyeRight.trimmed.b * 0.1 +
        samples.jawLeft.trimmed.b * 0.05 +
        samples.jawRight.trimmed.b * 0.05,
    },
    backgroundCalibration,
  );
  const eyes = applyCalibration(averageRgb([samples.eyesLeft.trimmed, samples.eyesRight.trimmed]), backgroundCalibration);
  const eyebrows = applyCalibration(averageRgb([samples.eyebrowLeft.trimmed, samples.eyebrowRight.trimmed]), backgroundCalibration);
  const calibratedHair = applyCalibration(samples.hair.trimmed, backgroundCalibration);
  const lips = correctLipColor(applyCalibration(samples.lips.trimmed, backgroundCalibration), skin);
  const forehead = applyCalibration(samples.forehead.trimmed, backgroundCalibration);
  // 헤어라인은 배경과 섞일 수 있으므로 눈썹색을 40% 섞어 실제 모발 계열을 안정화합니다.
  const hair = {
    r: calibratedHair.r * 0.6 + eyebrows.r * 0.4,
    g: calibratedHair.g * 0.6 + eyebrows.g * 0.4,
    b: calibratedHair.b * 0.6 + eyebrows.b * 0.4,
  };
  const variabilityBreakdown = {
    skin:
      (samples.skinLeft.variability +
        samples.skinRight.variability +
        samples.forehead.variability +
        samples.noseLeft.variability +
        samples.noseRight.variability +
        samples.underEyeLeft.variability +
        samples.underEyeRight.variability +
        samples.jawLeft.variability +
        samples.jawRight.variability) /
      9,
    eyes: (samples.eyesLeft.variability + samples.eyesRight.variability) / 2,
    hair: (samples.hair.variability + samples.eyebrowLeft.variability + samples.eyebrowRight.variability) / 3,
    lips: samples.lips.variability,
  };
  const quality = calculatePhotoQuality(
    applyCalibration(samples.skinLeft.trimmed, backgroundCalibration),
    applyCalibration(samples.skinRight.trimmed, backgroundCalibration),
    hair,
    eyes,
    lips,
    faceWidth,
    canvasWidth,
    backgroundCalibration,
  );

  return {
    extractedColors: {
      skin: rgbToCss(skin),
      hair: rgbToCss(hair),
      eyes: rgbToCss(eyes),
      lips: rgbToCss(lips),
    },
    photoQuality: quality.overall,
    measurementDetails: {
      faceBounds: {
        x: Math.round(bounds.minX * canvasWidth),
        y: Math.round(bounds.minY * canvasHeight),
        width: Math.round(faceWidth),
        height: Math.round(faceHeight),
      },
      normalizedFeatures: { temperature: 0, lightness: 0, clarity: 0, contrast: 0, mutedScore: 0 },
      qualityBreakdown: {
        overall: round4(quality.overall),
        exposure: round4(quality.exposure),
        symmetry: round4(quality.symmetry),
        distinctness: round4(quality.distinctness),
        faceSize: round4(quality.faceSize),
        background: round4(quality.background),
      },
      distributionBreakdown: {
        overall: round4((variabilityBreakdown.skin + variabilityBreakdown.eyes + variabilityBreakdown.hair + variabilityBreakdown.lips) / 4),
        skin: round4(variabilityBreakdown.skin),
        hair: round4(variabilityBreakdown.hair),
        eyes: round4(variabilityBreakdown.eyes),
        lips: round4(variabilityBreakdown.lips),
      },
      lightingCalibration: {
        backgroundBrightness: round4(backgroundCalibration.brightness),
        backgroundNeutrality: round4(backgroundCalibration.neutrality),
        correctionStrength: round4(backgroundCalibration.correctionStrength),
        calibrationSource: backgroundCalibration.source,
        whiteReferenceUsed: backgroundCalibration.source === 'white-reference',
        whiteBackdropRecommended: backgroundCalibration.source !== 'white-reference' || backgroundCalibration.correctionStrength < 0.45,
      },
      roiMeasurements: [
        roiMeasurement('피부', skin, regionByKey.skinLeft, regionByKey.skinRight),
        roiMeasurement('머리', hair, regionByKey.hair),
        roiMeasurement('홍채', eyes, regionByKey.eyesLeft, regionByKey.eyesRight),
        roiMeasurement('입술', lips, regionByKey.lips),
        roiMeasurement('이마', forehead, regionByKey.forehead),
        roiMeasurement('눈썹', eyebrows, regionByKey.eyebrowLeft, regionByKey.eyebrowRight),
      ],
      topSeasonScores: [],
    },
  };
}

// 결과 화면의 개발자/측정 패널에 표시할 ROI 측정 객체를 만듭니다.
const roiMeasurement = (label: string, color: Rgb, primary: SampleRegion, secondary?: SampleRegion) => ({
  label,
  color: rgbToCss(color),
  rgb: { r: Math.round(color.r), g: Math.round(color.g), b: Math.round(color.b) },
  lab: { ...rgbToLab(color) },
  hsl: hslDetails(color),
  region: secondary
    ? {
        x: Math.round((primary.x + secondary.x) / 2),
        y: Math.round((primary.y + secondary.y) / 2),
        width: Math.round((primary.width + secondary.width) / 2),
        height: Math.round((primary.height + secondary.height) / 2),
      }
    : {
        x: Math.round(primary.x),
        y: Math.round(primary.y),
        width: Math.round(primary.width),
        height: Math.round(primary.height),
      },
});
