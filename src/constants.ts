/*
 * constants.ts
 *
 * 퍼스널컬러 설문 도메인의 기준 질문 데이터를 정의합니다.
 * 사용자는 5개 문항에 답하고, 각 선택지는 temperature, lightness, clarity, contrast 축에 가중치를 더합니다.
 *
 * 이 파일의 질문 데이터는 Questionnaire.tsx에서 화면으로 렌더링되고,
 * 선택 결과는 설문 점수로 정규화된 뒤 geminiService.ts의 하이브리드 융합 로직에 전달됩니다.
 * 사진 분석이 조명과 카메라 편차에 흔들릴 수 있기 때문에,
 * 이 설문 축은 최종 결과를 안정화하는 중요한 보정 신호입니다.
 */
import { Question, QuestionnaireScores } from './types';

export const QUESTIONS: Question[] = [
  {
    id: 'vein_color',
    kind: 'signal',
    text: '손목 혈관이 더 가까워 보이는 색은 무엇인가요?',
    helperText: '자연광에서 손목 안쪽을 봤을 때 초록빛인지, 파랑빛인지 떠올려 주세요.',
    options: [
      {
        label: '올리브/초록 계열',
        value: 'green',
        weights: { temperature: 0.55 },
        description: '따뜻한 쪽으로 기울 가능성이 큽니다.',
        swatches: ['#7A8F47', '#90A955', '#A9C46C'],
        swatchCaption: '올리브 · 카키 · 세이지',
      },
      {
        label: '블루/보랏빛 계열',
        value: 'blue',
        weights: { temperature: -0.55 },
        description: '차가운 쪽으로 기울 가능성이 큽니다.',
        swatches: ['#6D7FD3', '#8BA6FF', '#A79BEF'],
        swatchCaption: '블루 · 라벤더 · 페리윙클',
      },
      {
        label: '둘 다 비슷하거나 잘 모르겠어요',
        value: 'mix',
        weights: { temperature: 0 },
        description: '중성에 가까운 경우입니다.',
        swatches: ['#B8C0CC', '#CED5DE', '#E2E8F0'],
        swatchCaption: '중성 회청색 계열',
      },
    ],
  },
  {
    id: 'jewelry_reaction',
    kind: 'signal',
    text: '얼굴이 더 살아 보이는 금속 액세서리는 무엇인가요?',
    helperText: '피부가 깨끗해 보이고 혈색이 좋아 보이는 쪽을 골라 주세요.',
    options: [
      {
        label: '골드',
        value: 'gold',
        weights: { temperature: 0.65, clarity: 0.05 },
        description: '따뜻한 웜톤일 가능성이 높습니다.',
        swatches: ['#D4AF37', '#E6C96B', '#F6E2A6'],
        swatchCaption: '골드 · 허니 골드 · 샴페인 골드',
      },
      {
        label: '실버/플래티넘',
        value: 'silver',
        weights: { temperature: -0.65, clarity: 0.05 },
        description: '차가운 쿨톤일 가능성이 높습니다.',
        swatches: ['#BFC7D5', '#DDE3EC', '#F4F7FB'],
        swatchCaption: '실버 · 아이스 실버 · 플래티넘',
      },
      {
        label: '둘 다 무난해요',
        value: 'both',
        weights: { temperature: 0, clarity: 0 },
        description: '중성 축일 수 있습니다.',
        swatches: ['#D8D1C0', '#D9DEE7', '#EEF1F5'],
        swatchCaption: '웜·쿨 모두 무난한 금속감',
      },
    ],
  },
  {
    id: 'vibrant_colors',
    kind: 'signal',
    text: '선명하고 채도 높은 컬러를 입었을 때 인상은 어떤가요?',
    helperText: '아래처럼 쨍하고 맑은 색입니다. 채도가 높고 회색기가 거의 없는 색을 떠올려 주세요.',
    options: [
      {
        label: '얼굴이 또렷해지고 생기 있어 보여요',
        value: 'glow',
        weights: { clarity: 0.7, contrast: 0.3 },
        description: '선명도를 소화하는 타입일 가능성이 큽니다.',
        swatches: ['#FF5A5F', '#00B8D9', '#FFD400', '#00C853'],
        swatchCaption: '비비드 핑크 · 코발트 · 선명한 옐로 · 쨍한 그린',
      },
      {
        label: '색이 너무 강해서 얼굴이 묻혀 보여요',
        value: 'overwhelmed',
        weights: { clarity: -0.7, contrast: -0.2 },
        description: '부드럽고 뮤트한 톤이 더 잘 맞을 수 있습니다.',
        swatches: ['#FF5A5F', '#00B8D9', '#FFD400', '#00C853'],
        swatchCaption: '강한 원색과 고채도 컬러 예시',
      },
      {
        label: '크게 차이를 못 느껴요',
        value: 'neutral',
        weights: { clarity: 0, contrast: 0 },
        description: '중간값으로 반영됩니다.',
        swatches: ['#FF8A8E', '#59CFE5', '#F1DC72', '#6FD38D'],
        swatchCaption: '중간 밝기의 선명한 컬러',
      },
    ],
  },
  {
    id: 'contrast_preference',
    kind: 'signal',
    text: '얼굴 대비감과 가장 잘 맞는 스타일은 무엇인가요?',
    helperText: '검정-흰색처럼 강한 대비가 어울리는지, 톤 차이가 적은 조합이 어울리는지 떠올려 주세요.',
    options: [
      {
        label: '검정과 흰색처럼 대비가 큰 스타일',
        value: 'high',
        weights: { contrast: 0.7, clarity: 0.15 },
        description: '고대비, 선명한 스타일이 잘 맞는 편입니다.',
        swatches: ['#111111', '#FFFFFF', '#111111', '#FFFFFF'],
        swatchCaption: '블랙 · 화이트처럼 대비가 큰 조합',
      },
      {
        label: '부드럽고 톤 차이가 적은 스타일',
        value: 'low',
        weights: { contrast: -0.7, clarity: -0.1 },
        description: '저대비, 소프트한 스타일이 더 편할 수 있습니다.',
        swatches: ['#DAD1C6', '#EFE8DF', '#CFC6BD', '#E3DBD2'],
        swatchCaption: '비슷한 명도의 베이지·에크루 조합',
      },
      {
        label: '중간 정도가 가장 자연스러워요',
        value: 'mid',
        weights: { contrast: 0 },
        description: '중간 대비로 반영됩니다.',
        swatches: ['#556070', '#D7DDE5', '#9CA8B4', '#F5F7FA'],
        swatchCaption: '네이비와 라이트 그레이 정도의 중간 대비',
      },
    ],
  },
  {
    id: 'depth_preference',
    kind: 'signal',
    text: '얼굴이 가장 안정적으로 보이는 색의 깊이는 어느 쪽인가요?',
    helperText: '밝은 파스텔, 중간 톤, 깊고 짙은 톤 중 어느 쪽에서 얼굴선이 가장 자연스럽게 살아나는지 골라 주세요.',
    options: [
      {
        label: '밝고 맑은 컬러',
        value: 'light',
        weights: { lightness: 0.7 },
        description: '라이트 축에 가까운 편입니다.',
        swatches: ['#FFF2D8', '#F8D7E8', '#DDEBFF', '#E5F5D8'],
        swatchCaption: '라이트 피치 · 베이비 핑크 · 스카이 · 민트',
      },
      {
        label: '중간 톤 컬러',
        value: 'medium',
        weights: { lightness: 0.1 },
        description: '중간 명도에서 균형이 맞는 편입니다.',
        swatches: ['#D7B48D', '#C88FA9', '#7D8EA9', '#8CA59A'],
        swatchCaption: '카멜 · 로즈 · 슬레이트 블루 · 딥 민트',
      },
      {
        label: '깊고 짙은 컬러',
        value: 'deep',
        weights: { lightness: -0.7 },
        description: '딥 축에 가까운 편입니다.',
        swatches: ['#5E3E2B', '#6D2240', '#1E2A5A', '#284131'],
        swatchCaption: '에스프레소 · 와인 · 네이비 · 포레스트',
      },
    ],
  },
];

export const QUESTIONNAIRE_AXES: (keyof QuestionnaireScores)[] = ['temperature', 'lightness', 'clarity', 'contrast'];
