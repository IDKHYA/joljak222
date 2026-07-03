// 색상 도메인 정적 HTML이 계산 모델과 테스트 데이터 안내를 담는지 검증합니다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const htmlPath = join(process.cwd(), '..', 'v2_md', '도메인개념_시각화.html');

describe('도메인 개념 시각화 HTML', () => {
  it('HEX에서 CIELAB/LCh와 CIEDE2000으로 이어지는 계산 흐름을 설명한다', () => {
    const html = readFileSync(htmlPath, 'utf8');

    expect(html).toContain('HEX -> RGB -> CIELAB -> LCh');
    expect(html).toContain('CIEDE2000');
    expect(html).toContain('Sharma');
    expect(html).toContain('Delta E');
    expect(html).toContain('scoreColorForSeason');
  });

  it('시즌별 LCh 영역과 새 스펙트럼 오버레이를 확인할 수 있다', () => {
    const html = readFileSync(htmlPath, 'utf8');

    expect(html).toContain('seasonRegionGrid');
    expect(html).toContain('lRange');
    expect(html).toContain('cRange');
    expect(html).toContain('chromaticHues');
    expect(html).toContain('spectrum-track');
  });

  it('사진 없이 테스트하는 여름뮤트 데모 데이터와 저장 구조를 안내한다', () => {
    const html = readFileSync(htmlPath, 'utf8');

    expect(html).toContain('여름뮤트');
    expect(html).toContain('soft-summer');
    expect(html).toContain('localStorage');
    expect(html).toContain('integrated_clothing_items');
  });
});
