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
    summary:
      '봄 계열은 따뜻한 기운을 바탕으로 밝고 생기 있는 인상이 특징입니다. 탁한 색보다 맑고 화사한 색에서 얼굴이 살아나는 경우가 많습니다.',
    seasons: '라이트 스프링, 트루 스프링, 브라이트 스프링',
  },
  summer: {
    title: '차갑고 부드럽고 은은한 저채도 쿨톤',
    summary:
      '여름 계열은 차가운 기조 위에 부드럽고 잔잔한 분위기가 중심입니다. 날카로운 대비보다 차분하고 맑은 파스텔, 중저채도 쿨톤에서 조화가 잘 납니다.',
    seasons: '라이트 서머, 트루 서머, 소프트 서머',
  },
  autumn: {
    title: '따뜻하고 깊고 안정적인 웜톤',
    summary:
      '가을 계열은 흙빛, 나무빛처럼 따뜻하고 깊은 색에서 강점을 보입니다. 선명한 원색보다는 톤다운된 풍부한 색이 얼굴을 안정적으로 받쳐줍니다.',
    seasons: '소프트 어텀, 트루 어텀, 다크 어텀',
  },
  winter: {
    title: '차갑고 선명하며 대비가 강한 쿨톤',
    summary:
      '겨울 계열은 차갑고 선명한 색, 그리고 높은 대비에서 존재감이 살아납니다. 순백, 블랙, 비비드 블루처럼 분명한 색에서 인상이 또렷해지는 편입니다.',
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
  '가을 스트롱': ['#FFC2F5', '#FFFFB8', '#A8F2ED', '#85AAFF', '#AE77FF'],
} as const;

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
  'light-spring': {
    title: '라이트 스프링',
    family: 'spring',
    englishNames: ['Light Spring'],
    commonAlias: '봄 라이트',
    commonAliasSentence: "보통 '봄 라이트'처럼 부르기도 해요.",
    summary:
      '봄 계열 중에서도 가장 밝고 가벼운 축입니다. 크림, 피치, 밝은 민트, 라이트 코랄처럼 부드럽고 화사한 웜 컬러가 잘 어울립니다.',
    styling:
      '무겁고 탁한 색보다 공기감 있는 밝은 웜톤이 얼굴을 정돈해 보이게 만드는 타입입니다.',
    whyItFits:
      '이 타입은 따뜻한 기운은 유지하면서도 명도가 높고 전체 대비가 과하지 않을 때 가장 자연스럽습니다. 그래서 크림빛이 도는 밝은 색, 가볍고 맑은 살구빛, 연한 코랄 계열이 얼굴을 환하게 정리해 줍니다.',
    bestColorDescription:
      '따뜻하고 밝은 크림, 피치, 라이트 코랄, 연한 그린처럼 가볍고 산뜻한 컬러가 잘 어울립니다.',
    worstColors: [...PERSONAL_COLOR_WORST_COLORS['봄 라이트']],
    worstColorsDescription:
      '너무 검거나 탁하고 무거운 색은 얼굴의 가벼운 생기를 눌러 보일 수 있습니다. 깊은 브라운, 짙은 와인, 아주 어두운 그린보다는 밝고 맑은 톤 쪽이 더 안정적입니다.',
    adjacent: ['true-spring', 'light-summer'],
  },
  'true-spring': {
    title: '트루 스프링',
    family: 'spring',
    englishNames: ['True Spring', 'Warm Spring'],
    commonAlias: '봄 웜',
    commonAliasSentence: "보통 '봄 웜'처럼 부르기도 해요.",
    summary:
      '가장 전형적인 봄 웜의 중심축입니다. 오렌지, 산호색, 맑은 옐로, 선명한 청록처럼 따뜻하고 활기 있는 색이 핵심입니다.',
    styling:
      '따뜻함과 생기감이 모두 살아야 하므로 너무 회색빛이 돌거나 지나치게 어두운 색은 매력을 덜어낼 수 있습니다.',
    whyItFits:
      '이 타입은 온도감이 분명히 따뜻하고, 선명도도 어느 정도 살아 있어야 얼굴이 건강하고 밝아 보입니다. 너무 차갑거나 탁한 컬러보다 햇살이 비친 듯한 웜톤이 인상을 가장 자연스럽게 살립니다.',
    bestColorDescription:
      '산호색, 오렌지, 맑은 옐로, 청록처럼 따뜻하고 생기 있는 컬러가 중심입니다.',
    worstColors: [...PERSONAL_COLOR_WORST_COLORS['봄 웜']],
    worstColorsDescription:
      '푸른 기운이 강한 라벤더, 쿨 블루, 메탈릭 실버 계열은 피부 온도감과 어긋나서 얼굴이 차갑고 분리돼 보일 수 있습니다.',
    adjacent: ['light-spring', 'bright-spring'],
  },
  'bright-spring': {
    title: '브라이트 스프링',
    family: 'spring',
    englishNames: ['Bright Spring', 'Clear Spring'],
    commonAlias: '봄 브라이트',
    commonAliasSentence: "보통 '봄 브라이트'처럼 부르기도 해요.",
    summary:
      '봄 계열 중 채도와 선명도가 특히 높은 축입니다. 밝은 기반 위에 또렷한 포인트가 살아나는 타입입니다.',
    styling:
      '탁한 색보다 맑고 반짝이는 색에서 얼굴 존재감이 커지며, 저명도 색은 다소 무겁게 느껴질 수 있습니다.',
    whyItFits:
      '이 타입은 밝기뿐 아니라 선명도도 충분히 확보되어야 인상이 또렷해집니다. 탁한 뉴트럴보다 깨끗하게 발색되는 색이 얼굴 윤곽과 눈빛을 살아나게 만드는 편입니다.',
    bestColorDescription:
      '밝고 쨍한 코랄, 선명한 옐로, 투명한 터키시처럼 맑고 화사한 컬러가 강점입니다.',
    worstColors: [...PERSONAL_COLOR_WORST_COLORS['봄 브라이트']],
    worstColorsDescription:
      '회색 기운이 많거나 탁한 블루그레이, 로즈브라운 계열은 원래 가진 선명함을 죽여서 얼굴이 덜 생기 있어 보일 수 있습니다.',
    adjacent: ['true-spring', 'bright-winter'],
  },
  'light-summer': {
    title: '라이트 서머',
    family: 'summer',
    englishNames: ['Light Summer'],
    commonAlias: '여름 라이트',
    commonAliasSentence: "보통 '여름 라이트'처럼 부르기도 해요.",
    summary:
      '여름 계열 중 밝기 축에 가까운 타입입니다. 쿨 핑크, 연보라, 파우더 블루 같은 옅고 부드러운 쿨톤이 잘 맞습니다.',
    styling:
      '차가운 기조는 유지하되 강한 대비보다 맑고 가벼운 파스텔에서 조화가 좋아지는 편입니다.',
    whyItFits:
      '이 타입은 차가운 결을 유지하면서도 전체 인상이 가볍고 부드러울 때 가장 안정적입니다. 너무 깊거나 노란 기운이 강한 색보다 밝고 옅은 쿨 파스텔에서 피부가 깨끗해 보이기 쉽습니다.',
    bestColorDescription:
      '쿨 핑크, 라일락, 파우더 블루, 소프트 민트처럼 옅고 맑은 쿨톤이 잘 어울립니다.',
    worstColors: [...PERSONAL_COLOR_WORST_COLORS['여름 라이트']],
    worstColorsDescription:
      '강한 오렌지, 짙은 브라운, 카키처럼 무겁고 따뜻한 색은 얼굴의 맑은 쿨톤을 눌러서 답답하게 보이게 만들 수 있습니다.',
    adjacent: ['light-spring', 'true-summer'],
  },
  'true-summer': {
    title: '트루 서머',
    family: 'summer',
    englishNames: ['True Summer', 'Cool Summer'],
    commonAlias: '여름 쿨',
    commonAliasSentence: "보통 '여름 쿨'처럼 부르기도 해요.",
    summary:
      '가장 전형적인 여름 쿨의 중심축입니다. 로즈, 블루, 모브, 세이지처럼 차갑고 부드러운 중명도 계열이 안정적입니다.',
    styling:
      '선명함이 너무 과하지 않으면서도 차가운 결이 살아 있을 때 얼굴선이 깨끗하게 보이기 쉽습니다.',
    whyItFits:
      '이 타입은 쿨톤의 맑음은 유지하되, 겨울처럼 극단적으로 대비가 높을 필요는 없습니다. 차갑고 부드러운 중명도 컬러에서 피부결과 이목구비가 가장 균형 있게 정리됩니다.',
    bestColorDescription:
      '로즈, 모브, 세이지, 블루처럼 차갑고 부드러운 중명도 컬러가 안정적으로 어울립니다.',
    worstColors: [...PERSONAL_COLOR_WORST_COLORS['여름 쿨']],
    worstColorsDescription:
      '노란 기운이 강한 골드, 카멜, 브라운 계열은 피부의 차가운 결과 부딪혀서 안색이 탁해 보일 수 있습니다.',
    adjacent: ['light-summer', 'soft-summer'],
  },
  'soft-summer': {
    title: '소프트 서머',
    family: 'summer',
    englishNames: ['Soft Summer'],
    commonAlias: '여름 뮤트',
    commonAliasSentence: "보통 '여름 뮤트'처럼 부르기도 해요.",
    summary:
      '저채도와 뮤트 성향이 더 강한 여름 타입입니다. 회색이 한 방울 섞인 듯한 부드러운 쿨 컬러가 안정적으로 받습니다.',
    styling:
      '강한 원색보다 흐린 로즈, 그레이시 블루, 소프트 모브처럼 힘을 뺀 색에서 자연스러움이 살아납니다.',
    whyItFits:
      '이 타입은 선명한 원색보다 채도가 한 톤 가라앉은 색에서 얼굴이 편안하고 고급스럽게 보입니다. 차가운 기조와 낮은 채도가 함께 맞아야 부드러운 조화가 살아납니다.',
    bestColorDescription:
      '더스티 로즈, 그레이시 블루, 소프트 모브, 토프처럼 차갑고 부드러운 뮤트 컬러가 강점입니다.',
    worstColors: [...PERSONAL_COLOR_WORST_COLORS['여름 뮤트']],
    worstColorsDescription:
      '아주 선명한 원색과 형광에 가까운 색은 얼굴보다 색이 먼저 보여서 인상이 부담스럽고 거칠게 느껴질 수 있습니다.',
    adjacent: ['true-summer', 'soft-autumn'],
  },
  'soft-autumn': {
    title: '소프트 어텀',
    family: 'autumn',
    englishNames: ['Soft Autumn'],
    commonAlias: '가을 뮤트',
    commonAliasSentence: "보통 '가을 뮤트'처럼 부르기도 해요.",
    summary:
      '가을 계열 중 가장 부드럽고 탁도가 있는 축입니다. 베이지, 더스티 코랄, 세이지, 톤다운 그린이 중심이 됩니다.',
    styling:
      '웜톤이지만 강하게 불타는 주황보다 누그러진 가을빛에서 분위기와 안정감이 살아나는 편입니다.',
    whyItFits:
      '이 타입은 따뜻함이 있으면서도 색이 너무 또렷하게 튀지 않을 때 가장 자연스럽습니다. 흙빛, 베이지, 말린 잎사귀 같은 부드러운 웜 뮤트가 얼굴을 편안하게 받쳐 줍니다.',
    bestColorDescription:
      '베이지, 더스티 코랄, 세이지, 톤다운 카키처럼 부드럽고 따뜻한 뮤트 컬러가 잘 맞습니다.',
    worstColors: [...PERSONAL_COLOR_WORST_COLORS['가을 뮤트']],
    worstColorsDescription:
      '맑은 하늘색, 아쿠아, 밝은 라벤더처럼 차갑고 맑은 파스텔은 원래 가진 온화한 분위기와 분리돼 보여 얼굴이 들떠 보일 수 있습니다.',
    adjacent: ['soft-summer', 'true-autumn'],
  },
  'true-autumn': {
    title: '트루 어텀',
    family: 'autumn',
    englishNames: ['True Autumn', 'Warm Autumn'],
    commonAlias: '가을 웜',
    commonAliasSentence: "보통 '가을 웜'처럼 부르기도 해요.",
    summary:
      '가장 전형적인 가을 웜의 중심축입니다. 머스타드, 브라운, 올리브, 테라코타, 딥 틸처럼 따뜻하고 풍부한 색이 잘 어울립니다.',
    styling:
      '건조한 흙빛, 나무빛, 향신료빛 같은 깊은 웜톤이 얼굴에 안정감과 성숙함을 더해주는 타입입니다.',
    whyItFits:
      '이 타입은 온도감이 분명하게 따뜻하고, 색에 적당한 깊이감이 있을 때 가장 매력적으로 보입니다. 노랗고 붉은 기운이 적절히 섞인 풍부한 가을색이 얼굴 톤과 자연스럽게 이어집니다.',
    bestColorDescription:
      '머스타드, 브라운, 올리브, 테라코타, 딥 틸처럼 따뜻하고 깊이 있는 웜톤이 잘 어울립니다.',
    worstColors: [...PERSONAL_COLOR_WORST_COLORS['가을 웜']],
    worstColorsDescription:
      '차갑고 가벼운 파스텔이나 실버 느낌이 강한 쿨톤은 본래의 따뜻한 깊이를 약하게 만들어 얼굴이 창백하거나 떠 보일 수 있습니다.',
    adjacent: ['soft-autumn', 'dark-autumn'],
  },
  'dark-autumn': {
    title: '다크 어텀',
    family: 'autumn',
    englishNames: ['Dark Autumn', 'Deep Autumn'],
    commonAlias: '가을 딥',
    commonAliasSentence: "보통 '가을 딥'처럼 부르기도 해요.",
    summary:
      '가을 계열 중 명도가 낮고 깊이감이 큰 축입니다. 짙은 브라운, 다크 카키, 딥 오렌지, 와인 브라운이 핵심입니다.',
    styling:
      '무게감 있는 웜톤을 소화할 수 있어 깊고 그윽한 색에서 얼굴 입체감이 살아나는 경우가 많습니다.',
    whyItFits:
      '이 타입은 따뜻한 색 안에서도 밝기보다 깊이감이 더 중요합니다. 진하고 농도 있는 웜 컬러가 얼굴선을 또렷하게 잡아 주고, 가벼운 파스텔은 상대적으로 힘이 빠져 보일 수 있습니다.',
    bestColorDescription:
      '짙은 브라운, 다크 카키, 딥 오렌지, 와인 브라운처럼 깊고 묵직한 웜톤이 강점입니다.',
    worstColors: [...PERSONAL_COLOR_WORST_COLORS['가을 딥']],
    worstColorsDescription:
      '지나치게 밝고 차가운 파스텔은 얼굴의 깊이를 버티지 못해서 피부와 색이 따로 노는 느낌을 줄 수 있습니다.',
    adjacent: ['true-autumn', 'dark-winter'],
  },
  'dark-winter': {
    title: '다크 윈터',
    family: 'winter',
    englishNames: ['Dark Winter', 'Deep Winter'],
    commonAlias: '겨울 딥',
    commonAliasSentence: "보통 '겨울 딥'처럼 부르기도 해요.",
    summary:
      '겨울 계열 중 저명도 고대비 축입니다. 블랙, 다크 버건디, 딥 퍼플, 네이비처럼 차갑고 깊은 색이 강점입니다.',
    styling:
      '어두운 색을 입어도 답답하기보다 인상이 또렷해지며, 깊이감과 차가움이 함께 살아야 매력이 커집니다.',
    whyItFits:
      '이 타입은 차가운 기조를 유지하면서도 깊고 진한 컬러를 소화할 수 있습니다. 대비감이 어느 정도 살아 있어야 얼굴의 선명함과 분위기가 같이 살아납니다.',
    bestColorDescription:
      '블랙, 다크 버건디, 딥 퍼플, 네이비처럼 깊고 차가운 컬러가 얼굴을 또렷하게 살립니다.',
    worstColors: [...PERSONAL_COLOR_WORST_COLORS['겨울 딥']],
    worstColorsDescription:
      '노르스름하고 크리미한 연한 컬러는 차가운 깊이감과 맞지 않아 얼굴이 흐릿하거나 힘없어 보일 수 있습니다.',
    adjacent: ['dark-autumn', 'true-winter'],
  },
  'true-winter': {
    title: '트루 윈터',
    family: 'winter',
    englishNames: ['True Winter', 'Cool Winter'],
    commonAlias: '겨울 쿨',
    commonAliasSentence: "보통 '겨울 쿨'처럼 부르기도 해요.",
    summary:
      '가장 전형적인 겨울 쿨의 중심축입니다. 순백, 블랙, 푸시아, 코발트 블루, 쿨 레드처럼 선명하고 차가운 색이 대표적입니다.',
    styling:
      '분명한 흑백 대비와 깨끗한 쿨톤이 얼굴을 선명하게 끌어올려 주는 타입입니다.',
    whyItFits:
      '이 타입은 온도감이 확실히 차갑고, 색의 경계가 분명할수록 얼굴이 더 또렷해집니다. 맑고 시원한 고대비 컬러가 피부를 깨끗하고 정돈돼 보이게 만드는 편입니다.',
    bestColorDescription:
      '순백, 블랙, 푸시아, 코발트 블루, 쿨 레드처럼 차갑고 선명한 컬러가 대표적입니다.',
    worstColors: [...PERSONAL_COLOR_WORST_COLORS['겨울 쿨']],
    worstColorsDescription:
      '노란 기운이 강한 골드, 카멜, 올리브 계열은 차가운 대비감을 흐려서 안색이 탁하고 무거워 보일 수 있습니다.',
    adjacent: ['dark-winter', 'bright-winter'],
  },
  'bright-winter': {
    title: '브라이트 윈터',
    family: 'winter',
    englishNames: ['Bright Winter', 'Clear Winter'],
    commonAlias: '겨울 브라이트',
    commonAliasSentence: "보통 '겨울 브라이트'처럼 부르기도 해요.",
    summary:
      '겨울 계열 중 채도와 대비가 가장 높은 축입니다. 매우 선명하고 시원한 색을 버틸 수 있는 타입입니다.',
    styling:
      '강한 핑크, 비비드 블루, 네온에 가까운 그린과 보라도 인상을 죽이지 않고 오히려 또렷하게 살릴 수 있습니다.',
    whyItFits:
      '이 타입은 차가운 기조 위에서 채도와 대비가 높을수록 강점이 드러납니다. 웅크린 뉴트럴보다 또렷하고 선명한 컬러에서 얼굴 윤곽과 눈빛이 훨씬 살아납니다.',
    bestColorDescription:
      '강한 핑크, 비비드 블루, 선명한 쿨 그린처럼 차갑고 아주 또렷한 컬러가 잘 받습니다.',
    worstColors: [...PERSONAL_COLOR_WORST_COLORS['겨울 브라이트']],
    worstColorsDescription:
      '톤다운된 로즈브라운, 베이지, 흐린 블루그레이는 본래의 선명한 대비감을 약하게 만들어 얼굴이 심심해 보일 수 있습니다.',
    adjacent: ['true-winter', 'bright-spring'],
  },
};

export const PERSONAL_COLOR_MODEL_NOTE = {
  overview:
    '퍼스널 컬러는 4계절 대분류 안에 12계절 세부 분류가 들어가는 구조로 이해하면 가장 자연스럽습니다. 큰 계열은 봄, 여름, 가을, 겨울이고, 실제 추천에서는 밝기, 채도, 명도, 선명도, 부드러움 차이를 반영해 12계절로 세분화합니다.',
  adjacency:
    '12계절은 완전히 끊긴 박스가 아니라 연속 스펙트럼입니다. 그래서 라이트 스프링과 라이트 서머, 브라이트 스프링과 브라이트 윈터, 소프트 서머와 소프트 어텀, 다크 어텀과 다크 윈터처럼 인접 시즌 개념이 중요합니다.',
  hsv:
    '색을 해석할 때는 색상(H), 채도(S), 명도(V)를 분리해서 보는 관점이 유용합니다. 이 관점은 어떤 색이 따뜻한지, 얼마나 선명한지, 얼마나 밝거나 깊은지를 직관적으로 이해하는 데 도움이 됩니다.',
};
