// WarmthLevel 파생 규칙과 금지 신호 원칙(G11)을 검증한다.
import { describe, expect, it } from 'vitest';
import { deriveWarmthLevel } from './warmthDerivation';

describe('deriveWarmthLevel', () => {
  it('사용자 확정값이 있으면 다른 모든 신호를 무시한다', () => {
    const result = deriveWarmthLevel({
      userConfirmed: 'very-light',
      typeLabel: '패딩',
      material: '울',
    });
    expect(result.level).toBe('very-light');
  });

  it('종류 키워드에서 1차 후보를 만든다', () => {
    expect(deriveWarmthLevel({ typeLabel: '반팔 티셔츠' }).level).toBe('light');
    expect(deriveWarmthLevel({ typeLabel: '긴팔티' }).level).toBe('mid');
    expect(deriveWarmthLevel({ typeLabel: '니트' }).level).toBe('warm');
    expect(deriveWarmthLevel({ typeLabel: '트렌치 코트' }).level).toBe('warm');
    expect(deriveWarmthLevel({ typeLabel: '울 코트' }).level).toBe('heavy');
    expect(deriveWarmthLevel({ typeLabel: '민소매' }).level).toBe('very-light');
  });

  it('소재가 보온을 한 단계 보정한다', () => {
    expect(deriveWarmthLevel({ typeLabel: '셔츠', material: '린넨' }).level).toBe('light');
    expect(deriveWarmthLevel({ typeLabel: '셔츠', material: '울' }).level).toBe('warm');
    expect(deriveWarmthLevel({ typeLabel: '셔츠', material: '면' }).level).toBe('mid');
  });

  it('구조 관측이 보온을 보정한다', () => {
    expect(deriveWarmthLevel({ typeLabel: '긴팔티', observations: ['기모'] }).level).toBe('warm');
  });

  it('색과 노출은 보온에 영향을 줄 수 없다 (G11)', () => {
    // 파생 함수는 색·노출을 입력으로 받지 않는다. 흰 패딩도 heavy, 검은 린넨 셔츠도 light다.
    const whitePadding = deriveWarmthLevel({ typeLabel: '화이트 패딩' });
    expect(whitePadding.level).toBe('heavy');

    const blackLinenShirt = deriveWarmthLevel({ typeLabel: '블랙 셔츠', material: '린넨' });
    expect(blackLinenShirt.level).toBe('light');
  });

  it('종류 신호가 없으면 SeasonTag 폴백을 낮은 신뢰도 경고와 함께 쓴다', () => {
    const result = deriveWarmthLevel({ typeLabel: '기타', seasonTag: '여름' });
    expect(result.level).toBe('light');
    expect(result.notes.join(' ')).toContain('신뢰도 낮음');
  });

  it('아무 신호도 없으면 mid와 사용자 확인 요청을 반환한다', () => {
    const result = deriveWarmthLevel({ typeLabel: '기타' });
    expect(result.level).toBe('mid');
    expect(result.notes.join(' ')).toContain('사용자 확인');
  });
});
