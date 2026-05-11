/*
 * seasonContent.ts
 *
 * 12시즌 퍼스널컬러 결과를 사용자에게 설명하기 위한 콘텐츠 파일입니다.
 * 시즌별 한글 라벨, 별칭, 추천 색상 설명, 피해야 할 색상, 인접 시즌 정보를 제공합니다.
 *
 * 이 파일은 계산 엔진의 기준 팔레트와 별개로, 결과 화면과 추천 엔진의 설명 가능성을 보강합니다.
 * 특히 App.tsx의 의류 적합도 계산은 SEASON_DETAILS의 worstColors를 사용해
 * 피해야 할 색상과 의류 대표색의 Delta E 거리가 가까울 때 감점을 적용합니다.
 */
import { SeasonFamily, SeasonId } from './types';

export const FAMILY_LABELS: Record<SeasonFamily, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
};

export const FAMILY_GUIDES: Record<
  SeasonFamily,
  {
    title: string;
    summary: string;
    seasons: string;
  }
> = {
  spring: {
    title: '따뜻하고 밝으며 생기 있는 웜톤',
    summary: '봄 계열은 따뜻한 기운과 맑은 생기가 중심입니다. 무겁고 탁한 색보다 밝고 깨끗한 컬러에서 얼굴이 살아나는 경우가 많습니다.',
    seasons: '라이트 스프링, 트루 스프링, 브라이트 스프링',
  },
  summer: {
    title: '차갑고 부드러운 저채도 쿨톤',
    summary: '여름 계열은 차가운 기조 위에 부드럽고 은은한 분위기가 중심입니다. 강한 대비보다 차분한 중명도, 저채도 컬러에서 조화가 좋습니다.',
    seasons: '라이트 서머, 트루 서머, 소프트 서머',
  },
  autumn: {
    title: '따뜻하고 깊으며 안정적인 웜톤',
    summary: '가을 계열은 흙빛, 나무빛처럼 따뜻하고 깊은 색에서 강점이 보입니다. 선명한 원색보다 숙성된 듯한 색이 얼굴을 안정적으로 받쳐 줍니다.',
    seasons: '소프트 오텀, 트루 오텀, 다크 오텀',
  },
  winter: {
    title: '차갑고 선명하며 대비가 강한 쿨톤',
    summary: '겨울 계열은 차갑고 선명한 색, 그리고 높은 대비에서 존재감이 살아납니다. 블랙, 화이트, 비비드 블루처럼 경계가 또렷한 색이 잘 맞습니다.',
    seasons: '다크 윈터, 트루 윈터, 브라이트 윈터',
  },
};

export const PERSONAL_COLOR_WORST_COLORS = {
  '봄 라이트': ['#2B2B2B', '#4B3621', '#8B0000', '#013220', '#6A0D91'],
  '봄 웜': ['#85AAFF', '#AE77FF', '#9B7EC9', '#1560BD', '#C0C0C0'],
  '봄 브라이트': ['#9E9E9E', '#7393B3', '#9F8170', '#B76E79', '#C2B280'],
  '여름 라이트': ['#CC5500', '#8B0000', '#013220', '#4B3621', '#9B870C'],
  '여름 쿨': ['#E1AD01', '#C19A6B', '#B5651D', '#505436', '#E1C699'],
  '여름 뮤트': ['#FF0000', '#FFFF00', '#FF4500', '#BFFF00', '#FF1493'],
  '가을 뮤트': ['#5EBCEE', '#43C6AC', '#AE77FF', '#FFC2F5', '#85AAFF'],
  '가을 웜': ['#9B7EC9', '#B9D9EB', '#43C6AC', '#FFB6C1', '#C0C0C0'],
  '가을 딥': ['#FFFFB8', '#A8F2ED', '#FFC2F5', '#FFB6C1', '#B9D9EB'],
  '겨울 딥': ['#FFFFB8', '#FCE883', '#F9CCC9', '#E3D9C6', '#E1C699'],
  '겨울 쿨': ['#E1AD01', '#C19A6B', '#B5651D', '#9B870C', '#505436'],
  '겨울 브라이트': ['#9F8170', '#C2B280', '#B76E79', '#7393B3', '#E3D9C6'],
} as const;

const detail = (
  title: string,
  family: SeasonFamily,
  englishNames: string[],
  commonAlias: keyof typeof PERSONAL_COLOR_WORST_COLORS,
  summary: string,
  styling: string,
  whyItFits: string,
  bestColorDescription: string,
  worstColorsDescription: string,
  adjacent: SeasonId[],
) => ({
  title,
  family,
  englishNames,
  commonAlias,
  commonAliasSentence: `보통 '${commonAlias}' 타입으로도 부릅니다.`,
  summary,
  styling,
  whyItFits,
  bestColorDescription,
  worstColors: [...PERSONAL_COLOR_WORST_COLORS[commonAlias]],
  worstColorsDescription,
  adjacent,
});

export const SEASON_DETAILS: Record<
  SeasonId,
  {
    title: string;
    family: SeasonFamily;
    englishNames: string[];
    commonAlias: keyof typeof PERSONAL_COLOR_WORST_COLORS;
    commonAliasSentence: string;
    summary: string;
    styling: string;
    whyItFits: string;
    bestColorDescription: string;
    worstColors: string[];
    worstColorsDescription: string;
    adjacent: SeasonId[];
  }
> = {
  'light-spring': detail(
    '라이트 스프링',
    'spring',
    ['Light Spring'],
    '봄 라이트',
    '봄 계열 중에서도 가장 밝고 가벼운 축입니다. 크림, 피치, 라이트 코랄처럼 부드럽고 화사한 컬러가 잘 어울립니다.',
    '무겁고 강한 색보다 공기가 느껴지는 밝은 톤이 얼굴을 맑고 부드럽게 보이게 합니다.',
    '따뜻함은 유지하되 대비가 과하지 않을 때 가장 자연스럽습니다.',
    '밝은 피치, 라이트 코랄, 맑은 민트, 연한 옐로 계열이 강점입니다.',
    '너무 검거나 무거운 색, 깊은 와인과 다크 그린은 얼굴의 가벼운 생기를 눌러 보이게 할 수 있습니다.',
    ['true-spring', 'light-summer'],
  ),
  'true-spring': detail(
    '트루 스프링',
    'spring',
    ['True Spring', 'Warm Spring'],
    '봄 웜',
    '전형적인 봄 웜의 중심축입니다. 오렌지, 허니 옐로, 맑은 그린처럼 따뜻하고 생기 있는 색이 잘 맞습니다.',
    '따뜻함과 생기감이 모두 살아야 하므로 지나치게 차갑거나 탁한 색은 피하는 편이 좋습니다.',
    '온도감이 분명하게 따뜻하고 채도도 어느 정도 있을 때 얼굴이 건강하고 밝아 보입니다.',
    '코랄, 오렌지, 골든 옐로, 싱그러운 그린 계열이 중심입니다.',
    '차가운 블루, 메탈릭 실버, 회보라 계열은 얼굴을 차갑고 분리되어 보이게 할 수 있습니다.',
    ['light-spring', 'bright-spring'],
  ),
  'bright-spring': detail(
    '브라이트 스프링',
    'spring',
    ['Bright Spring', 'Clear Spring'],
    '봄 브라이트',
    '봄 계열 중 채도와 선명도가 높은 축입니다. 밝은 기반 위에 또렷한 색이 살아나는 타입입니다.',
    '맑고 반짝이는 색에서 얼굴 존재감이 커지며, 저명도 탁색은 다소 무겁게 느껴질 수 있습니다.',
    '밝기보다 선명도가 충분할수록 인상이 또렷해집니다.',
    '선명한 코랄, 비비드 핑크, 맑은 옐로, 청량한 그린이 좋습니다.',
    '회색기가 많거나 탁한 로즈브라운 계열은 원래의 선명함을 줄여 보이게 할 수 있습니다.',
    ['true-spring', 'bright-winter'],
  ),
  'light-summer': detail(
    '라이트 서머',
    'summer',
    ['Light Summer'],
    '여름 라이트',
    '여름 계열 중 밝기 축에 가까운 타입입니다. 쿨 핑크, 라벤더, 파우더 블루처럼 옅고 부드러운 쿨톤이 잘 맞습니다.',
    '차가운 기조를 유지하되 강한 대비보다 밝고 가벼운 톤에서 조화가 좋아집니다.',
    '밝고 부드러운 쿨 컬러가 얼굴을 깨끗하고 투명하게 보이게 합니다.',
    '쿨 핑크, 라일락, 파우더 블루, 소프트 민트가 잘 어울립니다.',
    '강한 오렌지, 깊은 브라운, 카키처럼 무겁고 따뜻한 색은 답답해 보일 수 있습니다.',
    ['light-spring', 'true-summer'],
  ),
  'true-summer': detail(
    '트루 서머',
    'summer',
    ['True Summer', 'Cool Summer'],
    '여름 쿨',
    '전형적인 여름 쿨의 중심축입니다. 로즈, 모브, 그레이시 블루처럼 차갑고 부드러운 중명도 컬러가 안정적입니다.',
    '선명함이 과하지 않으면서 차가운 기운이 살아 있을 때 얼굴선이 정돈됩니다.',
    '쿨톤은 맞지만 겨울처럼 극단적인 대비가 필요하지 않습니다.',
    '로즈, 모브, 페일 블루, 쿨 그레이 계열이 안정적입니다.',
    '강한 골드, 카멜, 올리브 계열은 피부를 누렇게 보이게 할 수 있습니다.',
    ['light-summer', 'soft-summer'],
  ),
  'soft-summer': detail(
    '소프트 서머',
    'summer',
    ['Soft Summer'],
    '여름 뮤트',
    '저채도와 뮤트 성향이 강한 여름 타입입니다. 회색 한 방울이 섞인 듯한 부드러운 쿨 컬러가 잘 받습니다.',
    '강한 원색보다 덜어낸 로즈, 그레이시 블루, 소프트 모브가 자연스럽습니다.',
    '채도가 낮고 부드러울수록 얼굴이 편안하고 고급스럽게 보입니다.',
    '더스티 로즈, 그레이시 블루, 소프트 모브, 토프 계열이 강점입니다.',
    '매우 선명한 원색과 형광에 가까운 색은 얼굴보다 색이 먼저 보일 수 있습니다.',
    ['true-summer', 'soft-autumn'],
  ),
  'soft-autumn': detail(
    '소프트 오텀',
    'autumn',
    ['Soft Autumn'],
    '가을 뮤트',
    '가을 계열 중 가장 부드럽고 온도가 낮은 축입니다. 베이지, 더스티 코랄, 세이지, 말린 장미 계열이 잘 맞습니다.',
    '따뜻하지만 강한 주황보다 누그러진 자연색에서 안정감이 살아납니다.',
    '따뜻함과 낮은 채도가 함께 맞을 때 가장 자연스럽습니다.',
    '베이지, 더스티 코랄, 세이지, 소프트 카키가 좋습니다.',
    '차갑고 맑은 파스텔이나 네온에 가까운 컬러는 분위기를 분리해 보이게 할 수 있습니다.',
    ['soft-summer', 'true-autumn'],
  ),
  'true-autumn': detail(
    '트루 오텀',
    'autumn',
    ['True Autumn', 'Warm Autumn'],
    '가을 웜',
    '전형적인 가을 웜의 중심축입니다. 머스터드, 브라운, 올리브, 테라코타처럼 따뜻하고 깊은 색이 잘 맞습니다.',
    '건조한 흙빛과 나무빛 계열이 얼굴에 안정감과 성숙함을 더합니다.',
    '따뜻한 온도감과 적당한 깊이가 함께 있을 때 매력적으로 보입니다.',
    '머스터드, 올리브, 테라코타, 브라운 계열이 중심입니다.',
    '차갑고 가벼운 실버, 라벤더, 파스텔 블루는 얼굴을 창백하게 보이게 할 수 있습니다.',
    ['soft-autumn', 'dark-autumn'],
  ),
  'dark-autumn': detail(
    '다크 오텀',
    'autumn',
    ['Dark Autumn', 'Deep Autumn'],
    '가을 딥',
    '가을 계열 중 명도가 낮고 깊이가 강한 축입니다. 다크 카키, 딥 브라운, 번트 오렌지처럼 무게감 있는 색이 잘 맞습니다.',
    '무게 있는 색을 써도 얼굴이 묻히기보다 입체감이 살아나는 타입입니다.',
    '따뜻함 안에서도 밝기보다 깊이감이 중요합니다.',
    '딥 브라운, 다크 카키, 번트 오렌지, 와인 브라운이 좋습니다.',
    '지나치게 밝고 차가운 파스텔은 얼굴의 깊이를 받쳐 주지 못할 수 있습니다.',
    ['true-autumn', 'dark-winter'],
  ),
  'dark-winter': detail(
    '다크 윈터',
    'winter',
    ['Dark Winter', 'Deep Winter'],
    '겨울 딥',
    '겨울 계열 중 저명도와 고대비 축입니다. 블랙, 다크 버건디, 네이비처럼 차갑고 깊은 색이 강점입니다.',
    '어두운 색을 입어도 답답하기보다 인상이 또렷해지고 분위기가 살아납니다.',
    '차가운 기조와 깊은 컬러를 함께 소화할 수 있습니다.',
    '블랙, 다크 버건디, 딥 퍼플, 네이비 계열이 잘 맞습니다.',
    '흐릿하고 따뜻한 파스텔은 깊이감과 대비감을 약하게 만들 수 있습니다.',
    ['dark-autumn', 'true-winter'],
  ),
  'true-winter': detail(
    '트루 윈터',
    'winter',
    ['True Winter', 'Cool Winter'],
    '겨울 쿨',
    '전형적인 겨울 쿨의 중심축입니다. 순백, 블랙, 코발트 블루, 푸시아처럼 차갑고 선명한 색이 잘 맞습니다.',
    '분명한 흑백 대비와 깨끗한 쿨톤이 얼굴을 또렷하게 살립니다.',
    '온도감이 차갑고 색의 경계가 분명할수록 인상이 선명해집니다.',
    '블랙, 화이트, 코발트 블루, 푸시아, 아이스 핑크가 좋습니다.',
    '카멜, 골드, 올리브처럼 따뜻한 색은 얼굴을 무겁거나 누렇게 보이게 할 수 있습니다.',
    ['dark-winter', 'bright-winter'],
  ),
  'bright-winter': detail(
    '브라이트 윈터',
    'winter',
    ['Bright Winter', 'Clear Winter'],
    '겨울 브라이트',
    '겨울 계열 중 채도와 대비가 가장 높은 축입니다. 매우 선명하고 차가운 색을 버틸 수 있는 타입입니다.',
    '강한 핑크, 비비드 블루, 네온에 가까운 그린도 인상을 죽이지 않고 또렷하게 살립니다.',
    '차가운 기조 위에서 채도와 대비가 높을수록 강점이 드러납니다.',
    '비비드 핑크, 선명한 블루, 쿨 그린, 퓨어 화이트가 잘 맞습니다.',
    '탁한 로즈브라운, 베이지, 흐린 블루그레이는 선명도를 약하게 만들 수 있습니다.',
    ['true-winter', 'bright-spring'],
  ),
};

export const PERSONAL_COLOR_MODEL_NOTE = {
  overview:
    '퍼스널 컬러는 4계절 대분류 안에 12계절 세부 분류가 들어가는 구조로 이해하면 자연스럽습니다. 실제 추천에서는 밝기, 채도, 명도, 선명도와 부드러움의 차이를 반영해 세부 계절을 나눕니다.',
  adjacency:
    '12계절은 완전히 닫힌 박스가 아니라 연속 스펙트럼입니다. 라이트 스프링과 라이트 서머, 브라이트 스프링과 브라이트 윈터, 소프트 서머와 소프트 오텀처럼 인접 시즌의 일부 색을 함께 활용할 수 있습니다.',
  hsv:
    '색을 해석할 때는 색상(H), 채도(S), 명도(V)를 나누어 보는 관점이 유용합니다. 어떤 색이 따뜻한지, 얼마나 선명한지, 얼마나 밝거나 깊은지를 분리해 보면 결과를 더 직관적으로 이해할 수 있습니다.',
};
