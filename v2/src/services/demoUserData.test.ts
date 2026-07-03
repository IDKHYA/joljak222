// 사진 없이 앱을 시험할 수 있는 기본 퍼스널컬러 데이터를 검증합니다.
import { describe, expect, it } from 'vitest';
import type { FinalResult } from '../types';

describe('여름뮤트 데모 사용자 데이터', () => {
  it('저장된 퍼컬 결과가 없으면 soft-summer 기본 결과를 제공한다', async () => {
    const imported = await import('./demoUserData').catch(() => null);

    expect(imported).not.toBeNull();

    const module = imported as {
      SOFT_SUMMER_DEMO_RESULT: FinalResult;
      getInitialPersonalColorState: (
        storedResult: FinalResult | null,
        storedHistory: Array<{ id: string; measuredAt: string; result: FinalResult }>,
      ) => {
        result: FinalResult | null;
        history: Array<{ id: string; measuredAt: string; result: FinalResult }>;
      };
    };
    const state = module.getInitialPersonalColorState(null, []);

    expect(module.SOFT_SUMMER_DEMO_RESULT.seasonTop1Id).toBe('soft-summer');
    expect(module.SOFT_SUMMER_DEMO_RESULT.seasonTop1).toBe('소프트 서머');
    expect(state.result?.seasonTop1Id).toBe('soft-summer');
    expect(state.history[0].result.seasonTop1Id).toBe('soft-summer');
  });

  it('기존 저장 결과와 이력이 있으면 여름뮤트 기본값으로 덮어쓰지 않는다', async () => {
    const imported = await import('./demoUserData');
    const existing: FinalResult = {
      ...imported.SOFT_SUMMER_DEMO_RESULT,
      seasonTop1Id: 'true-winter',
      seasonTop1: '트루 윈터',
    };
    const history = [{ id: 'pc-existing', measuredAt: '2026-07-03T00:00:00.000Z', result: existing }];
    const state = imported.getInitialPersonalColorState(existing, history);

    expect(state.result?.seasonTop1Id).toBe('true-winter');
    expect(state.history).toBe(history);
  });
});
