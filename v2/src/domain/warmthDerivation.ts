// 의류 관측 신호(종류·소재·구조)에서 WarmthLevel을 파생한다. 색·노출은 입력조차 받지 않는다. (도메인개념_고도화_v2.md §6)
import type { WarmthLevel } from './types';

export interface WarmthDerivationInput {
  userConfirmed?: WarmthLevel;
  typeLabel: string;
  material?: string;
  observations?: string[];
  seasonTag?: '봄/가을' | '여름' | '겨울' | '사계절';
}

export interface WarmthDerivationResult {
  level: WarmthLevel;
  notes: string[];
}

const WARMTH_ORDER: WarmthLevel[] = ['very-light', 'light', 'mid', 'warm', 'heavy'];

// 종류 키워드 → 1차 후보. 위에서부터 먼저 매칭되는 규칙이 이긴다 (구체적인 것 먼저).
const TYPE_RULES: Array<{ keywords: string[]; level: WarmthLevel }> = [
  { keywords: ['패딩', '무스탕', '머플러', '목도리'], level: 'heavy' },
  { keywords: ['트렌치'], level: 'warm' },
  { keywords: ['코트'], level: 'heavy' },
  { keywords: ['니트', '스웨터', '가디건', '재킷', '자켓', '점퍼', '후드', '부츠'], level: 'warm' },
  { keywords: ['민소매', '나시', '슬리브리스', '반바지', '샌들'], level: 'very-light' },
  { keywords: ['긴팔'], level: 'mid' },
  { keywords: ['반팔'], level: 'light' },
  {
    keywords: ['셔츠', '블라우스', '슬랙스', '청바지', '데님', '팬츠', '스니커즈', '로퍼', '구두'],
    level: 'mid',
  },
  { keywords: ['티셔츠', '탑', '스커트', '치마', '원피스'], level: 'light' },
];

// 소재 보정 — 한 단계까지만 움직인다.
const MATERIAL_ADJUSTMENTS: Array<{ keywords: string[]; delta: 1 | -1 }> = [
  { keywords: ['린넨', 'linen', '메시', 'mesh'], delta: -1 },
  { keywords: ['울', 'wool', '플리스', 'fleece', '캐시미어'], delta: 1 },
];

// 구조 관측 보정 — 관측이 있을 때만 적용한다.
const OBSERVATION_ADJUSTMENTS: Array<{ keywords: string[]; delta: 1 | -1 }> = [
  { keywords: ['민소매', '크롭'], delta: -1 },
  { keywords: ['기모', '퀼팅', '패딩충전'], delta: 1 },
];

const SEASON_TAG_FALLBACK: Record<NonNullable<WarmthDerivationInput['seasonTag']>, WarmthLevel> = {
  여름: 'light',
  '봄/가을': 'mid',
  겨울: 'warm',
  사계절: 'mid',
};

export function deriveWarmthLevel(input: WarmthDerivationInput): WarmthDerivationResult {
  const notes: string[] = [];

  // 1순위 — 사용자 확정값. 이후 신호를 전부 무시한다.
  if (input.userConfirmed) {
    return { level: input.userConfirmed, notes: ['사용자 확정 보온 등급을 사용했습니다.'] };
  }

  // 2순위 — 종류 키워드 기본표.
  const typeRule = TYPE_RULES.find((rule) =>
    rule.keywords.some((keyword) => input.typeLabel.toLowerCase().includes(keyword.toLowerCase())),
  );

  if (!typeRule) {
    // 5순위 — SeasonTag 폴백. 낮은 신뢰도 경고를 남긴다.
    if (input.seasonTag) {
      notes.push(`종류 신호가 없어 v1 SeasonTag(${input.seasonTag}) 폴백을 사용했습니다. 신뢰도 낮음.`);
      return { level: SEASON_TAG_FALLBACK[input.seasonTag], notes };
    }
    notes.push('종류·소재·구조 신호가 없어 기본값 mid를 사용했습니다. 사용자 확인이 필요합니다.');
    return { level: 'mid', notes };
  }

  const baseIndex = WARMTH_ORDER.indexOf(typeRule.level);

  // 3~4순위 — 소재·구조 보정. 합산 후 종류 기준 ±1로 clamp한다 (종류 우선 원칙).
  const materialDelta = findAdjustment(MATERIAL_ADJUSTMENTS, input.material ?? '');
  const observationDelta = (input.observations ?? []).reduce(
    (sum, observation) => sum + findAdjustment(OBSERVATION_ADJUSTMENTS, observation),
    0,
  );

  const rawDelta = materialDelta + observationDelta;
  const clampedDelta = Math.max(-1, Math.min(1, rawDelta));
  if (rawDelta !== clampedDelta) {
    notes.push('소재·구조 신호가 종류 기준과 충돌해 한 단계 보정으로 제한했습니다.');
  }

  const finalIndex = Math.max(0, Math.min(WARMTH_ORDER.length - 1, baseIndex + clampedDelta));
  return { level: WARMTH_ORDER[finalIndex], notes };
}

function findAdjustment(rules: Array<{ keywords: string[]; delta: 1 | -1 }>, text: string): number {
  if (!text) return 0;
  const lowered = text.toLowerCase();
  const rule = rules.find((candidate) =>
    candidate.keywords.some((keyword) => lowered.includes(keyword.toLowerCase())),
  );
  return rule?.delta ?? 0;
}
