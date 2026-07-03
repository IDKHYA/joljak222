// HEX→RGB→CIELAB/LCh 변환과 CIEDE2000 거리 등 v2 도메인 공용 색 수학을 제공한다.

export type Rgb = [number, number, number];

export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface Lch {
  L: number;
  C: number;
  h: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

// sRGB(D65) 기준 CIELAB 변환.
export function rgbToLab([r, g, b]: Rgb): Lab {
  const linear = (channel: number): number => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const rl = linear(r);
  const gl = linear(g);
  const bl = linear(b);

  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041;

  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;

  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function labToLch(lab: Lab): Lch {
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L: lab.L, C, h };
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex));
}

export function hexToLch(hex: string): Lch {
  return labToLch(hexToLab(hex));
}

export function rgbToHsl([r, g, b]: Rgb): Hsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l: lightness };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (max === red) hue = 60 * (((green - blue) / delta) % 6);
  if (max === green) hue = 60 * ((blue - red) / delta + 2);
  if (max === blue) hue = 60 * ((red - green) / delta + 4);

  return { h: hue < 0 ? hue + 360 : hue, s: saturation, l: lightness };
}

export function hexToHsl(hex: string): Hsl {
  return rgbToHsl(hexToRgb(hex));
}

// 색상각(도) 사이의 최단 각도 거리.
export function hueAngleDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

// [lo, hi] 안에서 1, 밖에서는 slope 폭에 걸쳐 0으로 선형 하강하는 사다리꼴 멤버십.
export function trapezoidMembership(value: number, lo: number, hi: number, slope: number): number {
  if (value >= lo && value <= hi) return 1;
  const distance = value < lo ? lo - value : value - hi;
  if (distance >= slope) return 0;
  return 1 - distance / slope;
}

// CIEDE2000 색차. Sharma(2005) 표준 절차를 따른다.
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const deg2rad = (deg: number): number => (deg * Math.PI) / 180;
  const rad2deg = (rad: number): number => (rad * 180) / Math.PI;

  const C1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
  const C2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
  const meanC = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(meanC ** 7 / (meanC ** 7 + 25 ** 7)));

  const a1p = (1 + G) * lab1.a;
  const a2p = (1 + G) * lab2.a;
  const C1p = Math.sqrt(a1p * a1p + lab1.b * lab1.b);
  const C2p = Math.sqrt(a2p * a2p + lab2.b * lab2.b);

  const hp = (ap: number, b: number): number => {
    if (ap === 0 && b === 0) return 0;
    let h = rad2deg(Math.atan2(b, ap));
    if (h < 0) h += 360;
    return h;
  };
  const h1p = hp(a1p, lab1.b);
  const h2p = hp(a2p, lab2.b);

  const dLp = lab2.L - lab1.L;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(dhp) / 2);

  const meanLp = (lab1.L + lab2.L) / 2;
  const meanCp = (C1p + C2p) / 2;

  let meanHp = h1p + h2p;
  if (C1p * C2p !== 0) {
    const diff = Math.abs(h1p - h2p);
    if (diff <= 180) meanHp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) meanHp = (h1p + h2p + 360) / 2;
    else meanHp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(deg2rad(meanHp - 30)) +
    0.24 * Math.cos(deg2rad(2 * meanHp)) +
    0.32 * Math.cos(deg2rad(3 * meanHp + 6)) -
    0.2 * Math.cos(deg2rad(4 * meanHp - 63));

  const dTheta = 30 * Math.exp(-(((meanHp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(meanCp ** 7 / (meanCp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (meanLp - 50) ** 2) / Math.sqrt(20 + (meanLp - 50) ** 2);
  const Sc = 1 + 0.045 * meanCp;
  const Sh = 1 + 0.015 * meanCp * T;
  const Rt = -Math.sin(deg2rad(2 * dTheta)) * Rc;

  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}
