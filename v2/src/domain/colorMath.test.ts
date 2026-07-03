// 색 수학 모듈의 변환 정확도와 CIEDE2000 표준 검증 쌍을 확인한다. (게이트 G1 기반, G2 전제)
import { describe, expect, it } from 'vitest';
import {
  deltaE2000,
  hexToLab,
  hexToLch,
  hueAngleDistance,
  trapezoidMembership,
} from './colorMath';

describe('rgbToLab', () => {
  it('흰색과 검은색을 표준 CIELAB 값으로 변환한다', () => {
    const white = hexToLab('#FFFFFF');
    expect(white.L).toBeCloseTo(100, 0);
    expect(Math.abs(white.a)).toBeLessThan(0.5);
    expect(Math.abs(white.b)).toBeLessThan(0.5);

    const black = hexToLab('#000000');
    expect(black.L).toBeCloseTo(0, 0);
  });

  it('순수 빨강을 알려진 CIELAB 값으로 변환한다', () => {
    const red = hexToLab('#FF0000');
    expect(red.L).toBeCloseTo(53.24, 1);
    expect(red.a).toBeCloseTo(80.09, 1);
    expect(red.b).toBeCloseTo(67.2, 1);
  });
});

describe('labToLch', () => {
  it('무채색의 채도를 0 근처로 계산한다', () => {
    const gray = hexToLch('#808080');
    expect(gray.C).toBeLessThan(3);
  });

  it('유채색의 채도와 색상각을 계산한다', () => {
    const red = hexToLch('#FF0000');
    expect(red.C).toBeGreaterThan(100);
    expect(red.h).toBeGreaterThan(30);
    expect(red.h).toBeLessThan(50);
  });
});

describe('deltaE2000', () => {
  it('같은 색의 거리는 0이다', () => {
    const lab = hexToLab('#6E8FBE');
    expect(deltaE2000(lab, lab)).toBe(0);
  });

  it('대칭이다', () => {
    const a = hexToLab('#6E8FBE');
    const b = hexToLab('#F96822');
    expect(deltaE2000(a, b)).toBeCloseTo(deltaE2000(b, a), 6);
  });

  // Sharma(2005) CIEDE2000 표준 검증 데이터.
  it('표준 검증 쌍 1 — 파랑 계열 미세 차이', () => {
    const d = deltaE2000({ L: 50, a: 2.6772, b: -79.7751 }, { L: 50, a: 0, b: -82.7485 });
    expect(d).toBeCloseTo(2.0425, 3);
  });

  it('표준 검증 쌍 2 — 파랑 계열 중간 차이', () => {
    const d = deltaE2000({ L: 50, a: 3.1571, b: -77.2803 }, { L: 50, a: 0, b: -82.7485 });
    expect(d).toBeCloseTo(2.8615, 3);
  });

  it('표준 검증 쌍 3 — 명도·채도가 크게 다른 쌍', () => {
    const d = deltaE2000({ L: 50, a: 2.5, b: 0 }, { L: 73, a: 25, b: -18 });
    expect(d).toBeCloseTo(27.1492, 3);
  });
});

describe('hueAngleDistance', () => {
  it('360도 순환을 고려한 최단 거리를 계산한다', () => {
    expect(hueAngleDistance(350, 10)).toBe(20);
    expect(hueAngleDistance(10, 350)).toBe(20);
    expect(hueAngleDistance(0, 180)).toBe(180);
  });
});

describe('trapezoidMembership', () => {
  it('범위 안에서 1, 경사 밖에서 0, 경사 구간에서 선형이다', () => {
    expect(trapezoidMembership(50, 40, 60, 8)).toBe(1);
    expect(trapezoidMembership(40, 40, 60, 8)).toBe(1);
    expect(trapezoidMembership(36, 40, 60, 8)).toBeCloseTo(0.5, 6);
    expect(trapezoidMembership(30, 40, 60, 8)).toBe(0);
    expect(trapezoidMembership(64, 40, 60, 8)).toBeCloseTo(0.5, 6);
  });
});
