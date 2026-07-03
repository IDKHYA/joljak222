// 옷 추가 도메인의 메타데이터 추출(HEX→중립·색이름·데님)과 카탈로그 회귀를 검증하는 테스트
import { describe, it, expect } from 'vitest';
import { buildColorMeta, colorMetaForInput } from './clothingMeta';
import { TRAINING_CATALOG_ITEMS } from '../data/trainingCatalog';

describe('colorMetaForInput — HEX 입력', () => {
  it('HEX를 가장 가까운 색 이름으로 매핑하고 HEX 자체는 보존한다', () => {
    const navy = colorMetaForInput('#22334D');
    expect(navy.representative).toBe('네이비');
    expect(navy.hex).toBe('#22334D');
  });
  it('이름 입력은 COLOR_META를 그대로 반환한다(회귀)', () => {
    expect(colorMetaForInput('블랙').representative).toBe('블랙');
  });
});

describe('buildColorMeta — HEX 입력 데이터 정합성 (1단계)', () => {
  it('무채색 HEX는 isNeutral=true (흰·검·네이비), 유채색은 false', () => {
    expect(buildColorMeta('상의', '반팔티', '#F7F7F4').isNeutral).toBe(true); // 화이트
    expect(buildColorMeta('상의', '반팔티', '#171717').isNeutral).toBe(true); // 블랙
    expect(buildColorMeta('상의', '반팔티', '#22334D').isNeutral).toBe(true); // 네이비
    expect(buildColorMeta('상의', '반팔티', '#C7474C').isNeutral).toBe(false); // 레드
    expect(buildColorMeta('상의', '반팔티', '#88A97E').isNeutral).toBe(false); // 그린
  });

  it('representativeColor가 HEX 문자열이 아니라 사람이 읽는 색 이름으로 저장된다', () => {
    const meta = buildColorMeta('상의', '반팔티', '#22334D');
    expect(meta.representativeColor).toBe('네이비');
    expect(meta.representativeColor).not.toMatch(/^#/);
  });

  it('데님블루 HEX는 하의·아우터에서만 데님으로 인정된다(상의 오탐 방지)', () => {
    const bottom = buildColorMeta('하의', '팬츠', '#5C7898'); // 데님색, 키워드 없음
    expect(bottom.isDenim).toBe(true);
    expect(bottom.denimWash).toBeDefined();
    const top = buildColorMeta('상의', '셔츠', '#5C7898'); // 같은 색이지만 상의
    expect(top.isDenim).toBe(false);
    const brightBlueBottom = buildColorMeta('하의', '팬츠', '#6F95C9'); // 밝은 블루(데님 아님)
    expect(brightBlueBottom.isDenim).toBe(false);
  });
});

describe('buildColorMeta — 이름 입력 회귀 보존', () => {
  it('이름 입력의 중립/데님/이름은 COLOR_META 기준 그대로다', () => {
    expect(buildColorMeta('상의', '반팔티', '블랙').isNeutral).toBe(true);
    expect(buildColorMeta('상의', '반팔티', '블랙').representativeColor).toBe('블랙');
    expect(buildColorMeta('상의', '반팔티', '레드').isNeutral).toBe(false);
    expect(buildColorMeta('하의', '팬츠', '데님').isDenim).toBe(true);
  });
});

// 손수 라벨링한 미니 평가셋. 카탈로그의 저장 isNeutral은 전부 false라 ground truth로 못 쓰므로(데이터 결함),
// "사람이 보기에 무채/베이스 색인가"를 독립적으로 라벨링해 HEX 기반 판정의 타당성을 검증한다.
const NEUTRAL_EVAL_SET: { hex: string; neutral: boolean; note: string }[] = [
  { hex: '#FFFFFF', neutral: true, note: '화이트' },
  { hex: '#F5F5F0', neutral: true, note: '오프화이트' },
  { hex: '#171717', neutral: true, note: '블랙' },
  { hex: '#2B2B2B', neutral: true, note: '니어블랙' },
  { hex: '#808080', neutral: true, note: '그레이' },
  { hex: '#B0B0AC', neutral: true, note: '라이트그레이' },
  { hex: '#4A4A4A', neutral: true, note: '차콜' },
  { hex: '#22334D', neutral: true, note: '네이비' },
  { hex: '#D7C2A1', neutral: true, note: '베이지' },
  { hex: '#C9BBA0', neutral: true, note: '샌드' },
  { hex: '#B8B2A8', neutral: true, note: '스톤' },
  { hex: '#E8DED0', neutral: true, note: '크림' },
  { hex: '#DDD8D2', neutral: true, note: '라이트스톤' },
  { hex: '#C7474C', neutral: false, note: '레드' },
  { hex: '#2E7D32', neutral: false, note: '그린' },
  { hex: '#6F95C9', neutral: false, note: '블루' },
  { hex: '#D8A8B5', neutral: false, note: '핑크' },
  { hex: '#E7C84A', neutral: false, note: '옐로우' },
  { hex: '#8B79C9', neutral: false, note: '퍼플' },
  { hex: '#C8DD8B', neutral: false, note: '라임' },
  { hex: '#E07B39', neutral: false, note: '오렌지' },
  { hex: '#88A97E', neutral: false, note: '세이지그린' },
  { hex: '#7D8051', neutral: false, note: '올리브' },
  { hex: '#B05742', neutral: false, note: '테라코타' },
  { hex: '#A8D8C2', neutral: false, note: '민트' },
];

describe('미니 평가셋 — HEX 기반 isNeutral 정확도', () => {
  it('손수 라벨링한 25색에서 isNeutral 일치율 ≥ 90%', () => {
    let agree = 0;
    const misses: string[] = [];
    for (const { hex, neutral, note } of NEUTRAL_EVAL_SET) {
      const got = buildColorMeta('상의', '반팔티', hex).isNeutral;
      if (got === neutral) agree += 1;
      else misses.push(`${note}(${hex}) 기대=${neutral} 실제=${got}`);
    }
    const rate = agree / NEUTRAL_EVAL_SET.length;
    console.log(`[eval] isNeutral 일치율 = ${(rate * 100).toFixed(1)}% (${agree}/${NEUTRAL_EVAL_SET.length})`);
    if (misses.length) console.log('[eval] 불일치:', misses.join(' | '));
    expect(rate).toBeGreaterThanOrEqual(0.9);
  });
});

// 기록용(비-assert): 카탈로그의 저장 isNeutral이 전부 false인 데이터 결함을 드러낸다.
describe('카탈로그 데이터 진단 (기록용)', () => {
  it('저장 isNeutral 분포와 HEX 기반 재도출 분포를 로그로 남긴다', () => {
    const storedTrue = TRAINING_CATALOG_ITEMS.filter((i) => i.isNeutral).length;
    const derivedTrue = TRAINING_CATALOG_ITEMS.filter((i) => buildColorMeta(i.category, i.subcategory, i.representativeHex, i.dominantColors).isNeutral).length;
    console.log(`[diag] 카탈로그 저장 isNeutral=true: ${storedTrue}/${TRAINING_CATALOG_ITEMS.length} (결함: 전부 false)`);
    console.log(`[diag] HEX 재도출 isNeutral=true: ${derivedTrue}/${TRAINING_CATALOG_ITEMS.length}`);
    expect(TRAINING_CATALOG_ITEMS.length).toBeGreaterThan(0);
  });
});
