// 의류·옷장·추천·가상착용 도메인의 공용 상수 모음
/*
 * wardrobeConstants.ts
 *
 * 의류/옷장/추천/가상착용 도메인에서 화면과 로직이 함께 사용하는 라벨, 옵션, 룰, 색상 메타, 날씨 매핑을 모아둡니다.
 * 퍼스널컬러 진단 설문 도메인의 constants.ts와 책임이 다르며,
 * App.tsx, recommendationEngine.ts, 화면 컴포넌트가 이 파일을 공통으로 import합니다.
 */
import type { WeatherBand } from './lib/weather';
import type { SeasonId } from './types';
import type {
  AvailabilityStatus,
  ClothingCategory,
  DailyLookSlot,
  DenimWash,
  MaterialType,
  PatternType,
  RecommendationMode,
} from './wardrobeTypes';

export const STORAGE_KEYS = {
  personalColor: 'integrated_personal_color_result',
  personalHistory: 'integrated_personal_color_history',
  wardrobes: 'integrated_wardrobes',
  clothing: 'integrated_clothing_items',
  saved: 'integrated_saved_outfits',
} as const;

export const CATEGORY_OPTIONS: ClothingCategory[] = ['상의', '하의', '아우터', '신발', '액세서리'];
export const CATALOG_TABS: Array<'전체' | ClothingCategory> = ['전체', '아우터', '상의', '하의', '신발', '액세서리'];
export const RECOMMENDATION_MODES: RecommendationMode[] = ['데일리', '출근', '데이트', '발표'];
export const AVAILABILITY_OPTIONS: AvailabilityStatus[] = ['보유중', '세탁중', '보관중', '추천제외'];
export const SEASON_TAGS = ['봄/가을', '여름', '겨울', '사계절'];
export const DAILY_LOOK_CANVAS = { width: 1080, height: 1440 };
export const CUTOUT_VERSION = 'hard-alpha-v3';

export const DENIM_WASH_LABELS: Record<DenimWash, string> = {
  light: '연청',
  mid: '중청',
  dark: '진청',
  black: '흑청',
};

export const PATTERN_LABELS: Record<PatternType, string> = {
  solid: '무지',
  stripe: '스트라이프',
  plaid: '체크',
  graphic: '그래픽',
};

export const MATERIAL_LABELS: Record<MaterialType, string> = {
  cotton: '면',
  denim: '데님',
  knit: '니트',
  leather: '레더',
  nylon: '나일론',
  wool: '울',
  unknown: '미분류',
};

export const DAILY_LOOK_SLOT_BY_CATEGORY: Record<ClothingCategory, DailyLookSlot> = {
  아우터: 'outer',
  상의: 'upper',
  하의: 'lower',
  신발: 'shoes',
  액세서리: 'accessory',
};

export const PRECISION_TARGET_BY_CATEGORY: Record<ClothingCategory, string> = {
  상의: 'upper',
  하의: 'lower',
  아우터: 'outer',
  신발: 'shoes',
  액세서리: 'accessory',
};

export const CATEGORY_UI_META: Record<ClothingCategory, { label: string; hint: string; slot: DailyLookSlot }> = {
  상의: { label: '상의', hint: '티셔츠·니트·셔츠', slot: 'upper' },
  하의: { label: '하의', hint: '팬츠·스커트', slot: 'lower' },
  아우터: { label: '아우터', hint: '재킷·코트', slot: 'outer' },
  신발: { label: '신발', hint: '스니커즈·부츠', slot: 'shoes' },
  액세서리: { label: '액세서리', hint: '가방·모자', slot: 'accessory' },
};

// 추후 아이템이 늘어도 slot 프리셋만 추가/조정하면 자동 배치 흐름을 확장할 수 있습니다.
export const DAILY_LOOK_SLOT_PRESETS: Record<DailyLookSlot, { x: number; y: number; scale: number; rotation: number; zIndex: number }> = {
  outer: { x: 235, y: 365, scale: 0.86, rotation: -2, zIndex: 0 },
  upper: { x: 545, y: 350, scale: 0.8, rotation: 1, zIndex: 2 },
  lower: { x: 545, y: 700, scale: 0.9, rotation: 0, zIndex: 1 },
  shoes: { x: 760, y: 1120, scale: 0.48, rotation: -4, zIndex: 3 },
  hat: { x: 785, y: 190, scale: 0.38, rotation: 5, zIndex: 4 },
  bag: { x: 240, y: 1010, scale: 0.46, rotation: 0, zIndex: 5 },
  accessory: { x: 830, y: 610, scale: 0.35, rotation: 4, zIndex: 6 },
};

export const SEASON_LABELS: Record<SeasonId, string> = {
  'light-spring': '라이트 스프링',
  'true-spring': '트루 스프링',
  'bright-spring': '브라이트 스프링',
  'light-summer': '라이트 서머',
  'true-summer': '트루 서머',
  'soft-summer': '소프트 서머',
  'soft-autumn': '소프트 어텀',
  'true-autumn': '트루 어텀',
  'dark-autumn': '다크 어텀',
  'dark-winter': '다크 윈터',
  'true-winter': '트루 윈터',
  'bright-winter': '브라이트 윈터',
};

export const TYPES: Record<ClothingCategory, string[]> = {
  상의: ['반팔티', '긴팔티', '니트', '셔츠', '가디건', '맨투맨'],
  하의: ['청바지', '슬랙스', '스커트', '반바지', '조거팬츠'],
  아우터: ['재킷', '코트', '패딩', '트렌치코트', '블레이저'],
  신발: ['스니커즈', '로퍼', '부츠', '샌들'],
  액세서리: ['가방', '모자', '스카프', '벨트'],
};

export const SIZES = {
  tops: ['XS', 'S', 'M', 'L', 'XL'],
  bottoms: ['24', '25', '26', '27', '28', '29', '30', '31', '32'],
  shoes: ['220', '230', '240', '250', '260', '270', '280'],
};

export const COLOR_META: Record<string, { representative: string; hex: string; neutral?: boolean; denim?: boolean }> = {
  화이트: { representative: '화이트', hex: '#F7F7F4', neutral: true },
  아이보리: { representative: '아이보리', hex: '#F1E8D7', neutral: true },
  블랙: { representative: '블랙', hex: '#171717', neutral: true },
  차콜: { representative: '차콜', hex: '#34363A', neutral: true },
  그레이: { representative: '그레이', hex: '#8B8F97', neutral: true },
  멜란지: { representative: '멜란지', hex: '#B8B8B2', neutral: true },
  네이비: { representative: '네이비', hex: '#22334D', neutral: true },
  블루: { representative: '블루', hex: '#6F95C9' },
  스카이블루: { representative: '스카이블루', hex: '#A9CBE8' },
  데님: { representative: '데님', hex: '#5C7898', denim: true },
  베이지: { representative: '베이지', hex: '#D7C2A1', neutral: true },
  샌드: { representative: '샌드', hex: '#CDBB9E', neutral: true },
  스톤: { representative: '스톤', hex: '#B8B2A8', neutral: true },
  브라운: { representative: '브라운', hex: '#795342' },
  모카: { representative: '모카', hex: '#6F5548' },
  레드: { representative: '레드', hex: '#C7474C' },
  옐로우: { representative: '옐로우', hex: '#E7C84A' },
  핑크: { representative: '핑크', hex: '#D8A8B5' },
  민트: { representative: '민트', hex: '#A8D8C2' },
  그린: { representative: '그린', hex: '#88A97E' },
  포레스트: { representative: '포레스트', hex: '#31523C' },
  올리브: { representative: '올리브', hex: '#7D8051' },
  라임: { representative: '라임', hex: '#C8DD8B' },
  카키: { representative: '카키', hex: '#737A57' },
  퍼플: { representative: '퍼플', hex: '#8B79C9' },
  라벤더: { representative: '라벤더', hex: '#B8A8D4' },
};

// SegFormer fine label(영문)을 앱 내부 의류 종류(한국어)로 변환합니다.
export const FINE_LABEL_TO_TYPE: Record<string, string> = {
  'shirt, blouse': '셔츠',
  'top, t-shirt, sweatshirt': '반팔티',
  'sweater': '니트',
  'cardigan': '가디건',
  'jacket': '재킷',
  'vest': '조끼',
  'pants': '슬랙스',
  'shorts': '반바지',
  'skirt': '스커트',
  'coat': '코트',
  'dress': '원피스',
  'jumpsuit': '점프수트',
};

export const COLOR_NAME_PATTERNS: Array<[RegExp, keyof typeof COLOR_META]> = [
  [/(off[-\s]?black|washed[-\s]?black|pure[-\s]?black|black|블랙|흑청)/i, '블랙'],
  [/(charcoal|차콜)/i, '차콜'],
  [/(heather[-\s]?grey|heather[-\s]?gray|melange[-\s]?gray|멜란지[-\s]?그레이|멜란지)/i, '멜란지'],
  [/(grey|gray|그레이|회색)/i, '그레이'],
  [/(navy|네이비)/i, '네이비'],
  [/(royal[-\s]?blue|purple[-\s]?blue|dusty[-\s]?blue|soft[-\s]?blue|pale[-\s]?blue|sky[-\s]?blue|blue|블루|파랑|스카이)/i, '블루'],
  [/(ivory|아이보리)/i, '아이보리'],
  [/(white|화이트|흰색)/i, '화이트'],
  [/(sand|샌드)/i, '샌드'],
  [/(stone|스톤)/i, '스톤'],
  [/(beige|베이지)/i, '베이지'],
  [/(dark[-\s]?mocha|mocha|모카)/i, '모카'],
  [/(brown|브라운|갈색)/i, '브라운'],
  [/(dusty[-\s]?pink|pink|핑크)/i, '핑크'],
  [/(yellow|옐로우|노랑)/i, '옐로우'],
  [/(pale[-\s]?mint|mint|민트)/i, '민트'],
  [/(forest|포레스트)/i, '포레스트'],
  [/(moss|olive|올리브|모스)/i, '올리브'],
  [/(pale[-\s]?lime|lime|라임)/i, '라임'],
  [/(green|그린|초록)/i, '그린'],
  [/(khaki|카키)/i, '카키'],
  [/(purple|퍼플|보라)/i, '퍼플'],
  [/(lavender|라벤더)/i, '라벤더'],
];

export const WEATHER_RULES: Record<WeatherBand, string[]> = {
  '4도 이하': ['패딩', '코트', '니트', '가디건'],
  '5~8도': ['코트', '재킷', '니트', '맨투맨'],
  '9~11도': ['블레이저', '재킷', '니트', '긴팔티', '셔츠'],
  '12~16도': ['블레이저', '셔츠', '긴팔티', '니트', '맨투맨'],
  '17~19도': ['셔츠', '가디건', '긴팔티', '맨투맨'],
  '20~22도': ['반팔티', '셔츠', '블라우스'],
  '23~27도': ['반팔티', '긴바지', '반바지', '블라우스', '스커트'],
  '28도 이상': ['반팔티', '반바지', '샌들', '스커트'],
};

export const WEATHER_BAND_ORDER: WeatherBand[] = ['4도 이하', '5~8도', '9~11도', '12~16도', '17~19도', '20~22도', '23~27도', '28도 이상'];
