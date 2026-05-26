// 의류 색상·패턴·소재·계절 메타데이터를 생성하고 정규화하는 유틸리티
import { hexToRgb } from './colorUtils';
import { isHexColor } from './clothingDisplay';
import type { CatalogItem } from '../data/trainingCatalog';
import type { ClothingAnalysisMeta, ClothingCategory, ClothingColorAnalysis, DenimWash, MaterialType, PatternType, SeasonTag } from '../wardrobeTypes';
import { COLOR_META, COLOR_NAME_PATTERNS, DENIM_WASH_LABELS, SEASON_TAGS } from '../wardrobeConstants';

export function categoryFromMeta(meta: ClothingAnalysisMeta | undefined, fallback: ClothingCategory): ClothingCategory {
  if (fallback !== '액세서리') return fallback;
  if (meta?.part === 'lower') return '하의';
  if (meta?.part === 'outer') return '아우터';
  if (meta?.part === 'footwear') return '신발';
  if (meta?.part === 'accessory') return '액세서리';
  if (meta?.part === 'upper') return '상의';
  return fallback;
}

export function colorMetaForInput(color: string) {
  if (isHexColor(color)) return { representative: color.toUpperCase(), hex: color.toUpperCase() };
  return COLOR_META[color] ?? COLOR_META.화이트;
}

// 분석 JSON의 색상 후보 중 비율이 가장 큰 색을 대표색으로 선택합니다.
export function dominantColorFromAnalysis(colors: ClothingColorAnalysis[] | undefined) {
  return [...(colors ?? [])].filter((color) => color.hex).sort((left, right) => (right.ratio ?? 0) - (left.ratio ?? 0))[0];
}

// K-means/누끼 API에서 넘어온 색상 후보를 추천 엔진이 쓰기 좋은 상위 3개 팔레트로 정리합니다.
function normalizeDominantColors(colors: ClothingColorAnalysis[] | undefined, fallbackHex: string) {
  const normalized = [...(colors ?? [])]
    .filter((color) => color.hex)
    .sort((left, right) => (right.ratio ?? 0) - (left.ratio ?? 0))
    .slice(0, 3)
    .map((color) => ({
      hex: color.hex,
      rgb: color.rgb,
      ratio: color.ratio ?? 0,
    }));
  return normalized.length > 0 ? normalized : [{ hex: fallbackHex, ratio: 1 }];
}

// 상품명에 포함된 색상 단어를 정규식으로 찾아 대표색 이름을 추정합니다.
// 이미지 분석보다 상품명이 더 명확한 경우를 보완하기 위한 규칙입니다.
function colorNameFromProductName(name: string) {
  return COLOR_NAME_PATTERNS.find(([pattern]) => pattern.test(name))?.[1];
}

export function normalizePatternType(value: string | undefined): PatternType {
  if (!value) return 'solid';
  if (/stripe|스트라이프|줄무늬/i.test(value)) return 'stripe';
  if (/plaid|check|체크|타탄|깅엄/i.test(value)) return 'plaid';
  if (/graphic|그래픽|로고|프린트|레터링|캐릭터/i.test(value)) return 'graphic';
  return 'solid';
}

function inferPatternType(text: string): PatternType {
  return normalizePatternType(text);
}

function inferDenimWash(text: string, hex: string | undefined): DenimWash | undefined {
  if (/흑청|black denim|washed black/i.test(text)) return 'black';
  if (/연청|light denim|light blue/i.test(text)) return 'light';
  if (/중청|mid denim|medium blue/i.test(text)) return 'mid';
  if (/진청|생지|raw denim|dark denim|indigo/i.test(text)) return 'dark';
  if (!hex) return undefined;

  const { r, g, b } = hexToRgb(hex);
  const brightness = (r * 0.299) + (g * 0.587) + (b * 0.114);
  const blueBias = b - Math.max(r, g);
  if (brightness < 58) return 'black';
  if (brightness > 150 && blueBias > 5) return 'light';
  if (brightness > 90) return 'mid';
  return 'dark';
}

function inferMaterial(category: ClothingCategory, type: string, color: string, sourceText = ''): MaterialType {
  const text = `${category} ${type} ${color} ${sourceText}`;
  if (/데님|청바지|청자켓|jean|denim/i.test(text)) return 'denim';
  if (/니트|가디건|스웨터|knit/i.test(text)) return 'knit';
  if (/레더|가죽|leather/i.test(text)) return 'leather';
  if (/나일론|윈드브레이커|바람막이|nylon|wind/i.test(text)) return 'nylon';
  if (/울|wool|코트/i.test(text)) return 'wool';
  if (/셔츠|티셔츠|맨투맨|반팔|긴팔|cotton/i.test(text)) return 'cotton';
  return 'unknown';
}

// 이미지 분석 메타데이터와 파일명/기본값을 합쳐 CatalogItem을 생성합니다.
// 상품명 색상은 라벨 용도로만 사용하고, 실제 대표 HEX는 분석 dominant HEX를 우선 보존합니다.
export function catalogFromAnalysis(
  id: string,
  name: string,
  category: ClothingCategory,
  subcategory: string,
  fallbackColor: string,
  size: string,
  brand: string,
  imageUrl: string,
  meta: ClothingAnalysisMeta | undefined,
): CatalogItem {
  const dominantColor = dominantColorFromAnalysis(meta?.colors);
  const color = colorNameFromProductName(name) ?? dominantColor?.hex ?? fallbackColor;
  const baseMeta = buildColorMeta(category, subcategory, color, meta?.colors, name);
  return {
    catalogItemId: id,
    name,
    category,
    subcategory,
    imageUrl,
    color,
    size,
    brand,
    ...baseMeta,
    representativeHex: dominantColor?.hex ?? baseMeta.representativeHex,
    sourceType: 'catalog',
  };
}

// 색상명과 의류 타입에서 추천 계산에 필요한 대표 HEX, 계절 태그, 패턴/재질/데님 워시를 파생합니다.
export function buildColorMeta(category: ClothingCategory, type: string, color: string, colors?: ClothingColorAnalysis[], sourceText = '') {
  const colorMeta = colorMetaForInput(color);
  const text = `${category} ${type} ${color} ${sourceText}`;
  const material = inferMaterial(category, type, color, sourceText);
  const isDenim = material === 'denim' || Boolean((COLOR_META[color]?.denim) || /청|데님|jean|denim/i.test(text));
  const dominantColors = normalizeDominantColors(colors, colorMeta.hex);
  const primaryHex = dominantColors[0]?.hex ?? colorMeta.hex;
  const denimWash = isDenim ? inferDenimWash(text, primaryHex) : undefined;
  const representativeColor = isDenim && denimWash ? DENIM_WASH_LABELS[denimWash] : colorMeta.representative;
  return {
    representativeColor,
    representativeHex: primaryHex,
    dominantColors,
    seasonTag: getSeasonTag(type, category),
    patternType: inferPatternType(text),
    material,
    isNeutral: Boolean(COLOR_META[color]?.neutral),
    isDenim,
    denimWash,
  };
}

// 의류 타입/카테고리로 착용 계절 태그를 추정합니다.
// 이 값은 날씨 추천에서 여름옷/겨울옷을 감점하거나 보너스 주는 기준으로 쓰입니다.
// 외부 데이터(카탈로그·AI 예측)의 계절 문자열을 4개 SeasonTag 중 하나로 정규화합니다. 미지의 값은 '사계절'로 처리합니다.
export function normalizeSeasonTag(value: string | undefined): SeasonTag {
  return value && (SEASON_TAGS as readonly string[]).includes(value) ? (value as SeasonTag) : '사계절';
}

function getSeasonTag(type: string, category: ClothingCategory): SeasonTag {
  if (type.includes('패딩') || type.includes('코트') || type.includes('니트')) return '겨울';
  if (type.includes('반팔') || type.includes('반바지') || type.includes('샌들')) return '여름';
  if (category === '아우터' || type.includes('셔츠') || type.includes('블레이저')) return '봄/가을';
  return '사계절';
}

