// v2 첫 화면이 사용할 골든 패스 뷰 모델을 검증한다.
import { describe, expect, it } from 'vitest';
import { createGoldenPathModel } from './goldenPathModel';

describe('createGoldenPathModel', () => {
  it('기본 시연 데이터로 추천 3개와 데일리룩 후보를 만든다', () => {
    const model = createGoldenPathModel();

    expect(model.personalColorLabel).toBe('트루 서머');
    expect(model.recommendations).toHaveLength(3);
    expect(model.dailyLookCandidate.itemNames).toHaveLength(3);
    expect(model.readiness.ok).toBe(true);
  });
});
