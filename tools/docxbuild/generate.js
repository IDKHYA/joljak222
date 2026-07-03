// 발표 상세 보고서(.docx) — 스토리 구조: 개요 → 왜 개선/발전 → 기능별 이전·변경·효과 → 향후
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
} = require('docx');

const PURPLE = '5226A0';
const PURPLE_LT = 'F4EFFF';
const INK = '1F2430';
const MUTED = '5B6472';
const LINE = 'D9D2E6';
const CODE = '7A3E00';
const CONTENT = 9026;
const FONT = 'Malgun Gothic';

const P = (text, opts = {}) => new Paragraph({
  spacing: { after: opts.after ?? 130, line: 310 },
  children: [new TextRun({ text, size: opts.size ?? 22, color: opts.color ?? INK, bold: opts.bold, italics: opts.italics })],
});

const subP = (label, text, opts = {}) => new Paragraph({
  spacing: { before: opts.before ?? 70, after: opts.after ?? 120, line: 310 },
  children: [
    new TextRun({ text: label + '.  ', bold: true, color: opts.color || PURPLE, size: 22 }),
    new TextRun({ text, size: 22, color: INK }),
  ],
});

const bullet = (content) => new Paragraph({
  numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80, line: 306 },
  children: typeof content === 'string' ? [new TextRun({ text: content, size: 22, color: INK })] : content,
});

const code = (text) => new Paragraph({
  shading: { type: ShadingType.CLEAR, fill: 'F3F0F8' }, spacing: { before: 40, after: 120, line: 300 },
  children: [new TextRun({ text, size: 19, color: CODE, font: 'Consolas' })],
});

const tip = (text) => new Paragraph({
  shading: { type: ShadingType.CLEAR, fill: 'FFF8E6' }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'B8860B', space: 10 } },
  spacing: { before: 80, after: 160, line: 296 },
  children: [new TextRun({ text: '발표 팁  ', size: 18, bold: true, color: '8A6400' }), new TextRun({ text, size: 19, color: '6B5200' })],
});

// 스토리 강조 박스 (왜 섹션)
const story = (text) => new Paragraph({
  shading: { type: ShadingType.CLEAR, fill: PURPLE_LT }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: PURPLE, space: 10 } },
  spacing: { before: 100, after: 180, line: 308 },
  children: [new TextRun({ text, size: 21.5, color: '2B2440', bold: true })],
});

const cell = (text, { w, header = false, valBold = false } = {}) => new TableCell({
  width: { size: w, type: WidthType.DXA }, shading: header ? { type: ShadingType.CLEAR, fill: PURPLE_LT } : undefined,
  margins: { top: 64, bottom: 64, left: 110, right: 110 },
  borders: { top: { style: BorderStyle.SINGLE, size: 1, color: LINE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: LINE }, left: { style: BorderStyle.SINGLE, size: 1, color: LINE }, right: { style: BorderStyle.SINGLE, size: 1, color: LINE } },
  children: [new Paragraph({ spacing: { line: 276 }, children: [new TextRun({ text, size: header ? 19 : 19.5, bold: header || valBold, color: header ? PURPLE : (valBold ? PURPLE : INK) })] })],
});

const makeTable = (widths, headers, rows, { valCol = -1 } = {}) => new Table({
  width: { size: CONTENT, type: WidthType.DXA }, columnWidths: widths,
  rows: [
    new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, { w: widths[i], header: true })) }),
    ...rows.map((r) => new TableRow({ children: r.map((x, i) => cell(x, { w: widths[i], valBold: i === valCol })) })),
  ],
});

const H = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const before = (t) => subP('이전', t);
const after = (t) => subP('변경', t);
const effect = (t) => subP('효과', t, { color: '1B7A4B' });

const c = [];

// ===== Title =====
c.push(
  new Paragraph({ spacing: { before: 480, after: 60 }, children: [new TextRun({ text: '퍼스널컬러 AI 옷장 어시스턴트 · Fitly', size: 24, bold: true, color: PURPLE })] }),
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: '개선 & 추가발전 — 발표 최종 보고서', size: 44, bold: true, color: INK })] }),
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: '왜 이 방향으로 갔는지(2~3장) → 각 기능의 이전·변경·효과(4장~)', size: 22, color: MUTED })] }),
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: '기준: personalcolorcheckpage → 현재 (26개 커밋)  ·  2026.05', size: 21, color: MUTED })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: PURPLE, space: 1 } }, spacing: { before: 120, after: 200 }, children: [] }),
);

// ===== 1. 프로젝트 개요 =====
c.push(H('1. 프로젝트 개요'));
c.push(P('서비스명은 퍼스널컬러 AI 옷장 어시스턴트(코드명 Fitly)다. 얼굴 사진과 설문 5문항으로 12계절 퍼스널컬러를 진단하고, 그 결과로 사용자의 옷을 색상 적합도순 코디로 추천한다. 옷 사진을 올리면 배경 제거와 ML 계절 분류가 자동으로 이뤄진다.'));
c.push(subP('문제의식', '전문가 대면 퍼스널컬러 진단은 비용(평균 5~15만원)과 접근성에 한계가 있고, 진단을 받아도 실제 옷 선택으로 이어지지 않는 단절이 있다. 또 색상과 날씨를 동시에 고려한 코디 추천은 드물다. 이 셋을 하나의 흐름(진단 → 옷장 → 날씨 → 추천 → 데일리룩)으로 잇는 것이 이 프로젝트다.'));
c.push(subP('구성', '세 모듈로 푼다.'));
c.push(makeTable([3000, 6026],
  ['모듈', '핵심 내용'],
  [
    ['① 퍼스널컬러 진단', '얼굴 15개 ROI에서 Lab 4축 특징(색온도·명도·선명도·대비) 추출 + 설문 5문항을 사진 품질 기반 동적 비율로 융합 → 12계절'],
    ['② 의류 이미지 분석', 'SegFormer 분할 + 95개 특징 Random Forest(트리 300그루)로 3계절 적합성 예측 (정확도 89.74%, 라벨 516장 기준)'],
    ['③ 코디 추천', 'CIEDE2000 색상 거리 + Itten 색상 조화 + 날씨를 4축 점수(38·22·28·12)로 결합'],
  ], { valCol: 0 }));
c.push(P('기술 스택은 React + TypeScript SPA, FastAPI 이미지 서버, 브라우저 localStorage이며 카탈로그 의류는 860벌이다.', { color: MUTED, size: 20 }));

// ===== 2. 왜 개선 =====
c.push(H('2. 개선하게 된 요소 — 왜 추천 알고리즘인가'));
c.push(P('이 프로젝트의 심장은 추천이다. 퍼스널컬러 진단·옷장·날씨는 모두 “그래서 무슨 옷을 입을까”라는 추천을 위한 입력이고, 사용자가 실제 가치를 느끼는 지점도 추천 결과다. 그래서 한정된 시간에 무엇을 손볼지 정할 때, 부가 기능을 늘리기보다 이 핵심을 단단히 하는 쪽을 택했다.'));
c.push(P('문제는 중간 발표 시점의 추천이 “동작은 하지만 설명할 수 없는” 상태였다는 점이다.'));
c.push(bullet('왜 이 코디인지 설명하지 못하는 블랙박스였다.'));
c.push(bullet('점수 계수가 근거 없는 매직 넘버라 “왜 이 값이냐”에 답할 수 없었다.'));
c.push(bullet('개별 의류 점수 합산 중심이라 코디(조합) 단위 완성도를 보지 못했다.'));
c.push(bullet('추천 로직이 App.tsx에 섞여 검증도 설명도 어려웠다.'));
c.push(story('졸업작품과 논문에서 가장 방어해야 할 질문은 “그 추천이 왜 타당한가”다. 그런데 그 질문에 답할 수 없었다. 그래서 추천 알고리즘을 ‘설명 가능하고, 코디 단위로 평가하며, 테스트로 검증된 엔진’으로 만드는 것을 최우선 개선 방향으로 잡았다.'));
c.push(P('구체적 개선은 4~11장에서 하나씩 “이전 → 변경 → 효과”로 다룬다.', { color: MUTED, size: 20 }));

// ===== 3. 왜 추가발전 =====
c.push(H('3. 추가 발전하게 된 요소 — 왜 데일리룩·단일 옷 추천인가'));
c.push(P('추천이 탄탄해져도 사용자 경험은 “추천 리스트를 보는 것”에서 멈춘다. 하지만 진짜 개인화는 한 걸음 더 가야 한다고 봤다. 사람들은 “오늘 이 옷을 입고 싶은데 뭘 매치하지”처럼 이미 고정하고 싶은 한 벌이 있고, 마음에 든 코디는 “내 룩”으로 남기고 싶어 한다.'));
c.push(P('그래서 개인화를 더 강화하려고 두 기능을 발전시켰다.'));
c.push(bullet([new TextRun({ text: '단일 옷 코디 추천 — ', bold: true, color: PURPLE, size: 22 }), new TextRun({ text: '옷 한 벌을 기준으로 어울리는 조합을 찾아 “이 옷에 뭘 입지”라는 실제 질문에 답한다.', size: 22, color: INK })]));
c.push(bullet([new TextRun({ text: '데일리룩 — ', bold: true, color: PURPLE, size: 22 }), new TextRun({ text: '고른 코디를 보드에 배치하고 텍스트까지 얹어 나만의 룩 이미지로 완성한다.', size: 22, color: INK })]));
c.push(story('즉 경험을 “진단 → 추천”에서 “진단 → 추천 → 내 상황 맞춤 → 결과물 완성”으로 확장했다. 추천 품질을 올리는 ‘개선’과 결이 다른, 경험을 넓히는 ‘추가발전’이다.'));
c.push(P('두 기능의 상세는 12~13장에서 “이전 → 변경 → 효과”로 다룬다.', { color: MUTED, size: 20 }));

// ===== 4. 엔진 모듈화 =====
c.push(H('4. [개선] 추천 엔진 모듈화와 단위 테스트'));
c.push(before('추천 로직이 App.tsx(기준선 3,546줄)에 화면 코드와 뒤섞여 있어, “이 추천은 어떤 알고리즘으로 나왔다”를 짚어 설명하기 어렵고 점수 함수 단위로 테스트할 수도 없었다.'));
c.push(after('추천 점수 계산·조합 생성을 src/services/recommendationEngine.ts(696줄)로 분리하고, 코디 한 벌의 점수·설명을 합성하는 scoreOutfit() 헬퍼를 추출해 전수 추천과 기준 옷 추천이 같은 산식을 공유한다. 점수 함수에 Vitest 단위 테스트 23개를 붙였다.'));
c.push(effect('추천을 “화면 코드”가 아니라 “알고리즘 모듈”로 설명·검증할 수 있다. 산식을 바꿔도 테스트가 회귀를 잡아 개선을 안전하게 반복할 수 있다.'));

// ===== 5. 4축 =====
c.push(H('5. [개선] 최종 점수 — 4축 가중합'));
c.push(before('개별 의류의 “이 옷이 내 퍼컬에 맞나”만으로는 한 벌 코디의 완성도를 평가할 수 없었다. 색만 맞고 날씨에 안 맞거나, 따로 보면 좋은데 같이 입으면 부조화일 수 있다.'));
c.push(after('네 축을 가중 합산해 코디 점수를 만든다(SCORE_WEIGHTS). 각 축 계산은 아래와 같다.'));
c.push(makeTable([2300, 1100, 5626],
  ['축', '비중', '계산 방식'],
  [
    ['퍼스널컬러', '38%', '의류 대표색(또는 상위 3색 비율 가중)과 팔레트의 CIEDE2000 최소 거리 → 구간형 점수, 회피색 근접 시 감점'],
    ['색상 조화', '28%', '상하의 hue·명도·채도 관계 + 시즌 대비 보정 + 안정성 가산 (8장)'],
    ['날씨', '22%', '기온 구간 키워드 매칭(+28), 사계절(+8), 세탁/보관/제외 상태 감점'],
    ['착용 안정성', '12%', '모든 아이템 보유중이면 92, 아니면 68'],
  ], { valCol: 1 }));
c.push(effect('한 축이 과해도 다른 축이 균형을 잡는다. 정체성(퍼컬) > 완성도(조화) > 실용(날씨) > 보정(안정) 순의 비중이 “이 앱은 퍼스널컬러가 중심”이라는 정체성을 점수에 새긴다.'));

// ===== 6. palette curve =====
c.push(H('6. [개선] 퍼스널컬러 적합도 — 선형에서 구간형 색거리로'));
c.push(before('색상 적합도가 단순 선형 감점이었다. 상수 4.5의 근거를 설명하기 어렵고, 색차가 조금만 커져도 점수가 급락해 체감과 어긋났다.'));
c.push(code('paletteScore = 100 - DeltaE * 4.5   // 이전(baseline)'));
c.push(after('Delta E(CIEDE2000) 거리를 의미 구간으로 나눠 점수 곡선을 만든다(scorePaletteDistance). “거의 같은 색 / 잘 맞는 색 / 쓸 수는 있는 색 / 거리가 있는 색”의 의미가 분리된다.'));
c.push(makeTable([3200, 3000, 2826],
  ['Delta E 거리', '해석', '점수 범위'],
  [
    ['0 ~ 5', '거의 같은 색·매우 가까운 색', '96 ~ 100'],
    ['5 ~ 12', '팔레트와 잘 맞는 색', '86 ~ 96'],
    ['12 ~ 22', '쓸 수 있지만 강한 적합색은 아님', '70 ~ 86'],
    ['22 ~ 35', '팔레트와 거리가 있음', '45 ~ 70'],
    ['35 이상', '추천 우선순위 낮음', '45 이하'],
  ], { valCol: 2 }));
c.push(effect('점수의 의미가 명확해지고, 가까운 색 구간의 변별력은 살리되 먼 색은 완만히 떨어져 실제 색 평가와 맞게 됐다.'));

// ===== 7. neutral/denim =====
c.push(H('7. [개선] 중립색·데님의 역할 재정의'));
c.push(before('중립색·데님이면 퍼스널컬러 점수에 무조건 +8을 더했다. “중립색·데님은 항상 퍼컬에 잘 맞는 색”처럼 처리하는 오류였다.'));
c.push(after('퍼스널컬러 점수의 무조건 보너스를 +3으로 줄이고, 중립색·데님의 진짜 가치는 코디 전체의 안정성 가산(8장)에서 크게 반영하도록 옮겼다.'));
c.push(effect('중립색·데님을 “그 자체로 좋은 색”이 아니라 “강한 포인트색을 받쳐 코디를 안정시키는 요소”로 재정의했다. 색 적합도와 코디 역할이 분리돼 점수 의미가 정확해졌다.'));

// ===== 8. harmony =====
c.push(H('8. [개선] 색상 조화 점수 — 3요소 분해'));
c.push(before('조화 점수가 색상 관계 기본 점수에 시즌 대비 보정만 더하는 단순 구조였고, 명도·채도 관계를 보지 않았으며 보정값이 매직 넘버였다. 그래서 “상하의 색이 따로 노는” 코디를 제대로 거르지 못했다.'));
c.push(after('조화 점수를 hue 관계 50% + 명도 균형 30% + 채도 균형 20%로 분해하고 시즌 대비 보정·안정성 가산·패턴 페널티를 더한다. 각 요소의 메커니즘은 다음과 같다.'));
c.push(bullet([new TextRun({ text: 'hue 관계 — ', bold: true, size: 22, color: PURPLE }), new TextRun({ text: '색상환 각도 차이를 단색/유사/포인트/삼색/보색으로 분류(15·45·90·135도 경계)하고 관계별 기본 점수(보색 88·유사 82·단색 80·삼색 76·tension 55)를 준다. Itten 배색 선호 서열이 근거.', size: 22, color: INK })]));
c.push(bullet([new TextRun({ text: '명도 균형 — ', bold: true, size: 22, color: PURPLE }), new TextRun({ text: '상하의 명도차 이상값을 0.22로 보고 멀어질수록 감점. 8%p 미만이면 한 덩어리로 뭉개져 −28, 55%p 초과면 갈라져 −10.', size: 22, color: INK })]));
c.push(bullet([new TextRun({ text: '채도 균형 — ', bold: true, size: 22, color: PURPLE }), new TextRun({ text: '채도차가 클수록 감점. 둘 다 고채도(>0.65)면 포인트가 둘이라 −12, 둘 다 무채(<0.12)면 밋밋해 −6.', size: 22, color: INK })]));
c.push(bullet([new TextRun({ text: '시즌·아우터·패턴 — ', bold: true, size: 22, color: PURPLE }), new TextRun({ text: '겨울(고대비 선호)엔 보색 가산·여름(저대비)엔 보색 감점, 아우터가 있으면 바깥 레이어까지(0.5/0.3/0.2) 평가, 패턴 충돌은 감점.', size: 22, color: INK })]));
c.push(effect('개별 색이 아니라 “함께 입었을 때”의 완성도를 평가한다. 색상환만으로는 못 잡던 부조화(뭉갬·과한 포인트 충돌)를 명도·채도로 거른다.'));
c.push(P('※ 패턴 페널티는 구현돼 있으나, 현재 카탈로그 860벌이 전부 단색(solid)이라 실제 발동은 수동 등록 의류에 한정된다. 패턴 자동 태깅은 향후 과제(15장)다.', { color: MUTED, size: 20 }));

// ===== 9. 근거화 + 불변 =====
c.push(H('9. [개선] 매직 넘버 근거화와 점수 불변 증명'));
c.push(before('8장의 좋은 산식도 코드에는 0.5, 0.22, 28 같은 숫자로만 박혀 있어 “왜 이 값이냐”에 답할 수 없었다. 지난 발표에서 가장 약했던 지점이다.'));
c.push(after('점수 산식에 박혀 있던 숫자들(가중치·기본 점수·임계값)을 이름 붙인 상수로 빼고 근거 주석을 달았다(예: IDEAL_LIGHTNESS_GAP = 0.22). 값은 바꾸지 않았고, 바꾸지 않았음을 회귀 스냅샷 테스트로 박제했다 — 대표 케이스 89 / 85 / 84가 리팩터링 전후로 동일하다.'));
c.push(makeTable([2400, 2600, 4026],
  ['상수', '값', '근거'],
  [
    ['조화 비중', 'hue .5 / 명도 .3 / 채도 .2', 'hue가 1차 요인, 명도는 가독성, 채도는 충돌 억제'],
    ['hue 기본 점수', '보색 88 / 유사 82 / tension 55', '보색·유사색이 가장 안정, 어중간한 거리가 가장 약함'],
    ['이상 명도차', '0.22', '상하의가 구분되면서도 과하지 않은 대비'],
    ['저명도 대비', '8%p 미만 → −28', '차이가 너무 작으면 한 덩어리로 뭉개짐'],
    ['고채도 충돌', '둘 다 >0.65 → −12', '포인트가 둘이라 과하게 충돌'],
    ['안정성 가산', '포인트+받침 → +6', '무채·데님이 강한 포인트색을 받칠 때 가장 안정'],
  ], { valCol: 1 }));
c.push(effect('모든 점수 계수를 색채 이론·지각 경험칙으로 방어할 수 있다. 설명 가능성을 얻으면서 기존 동작은 그대로 보존했음을 테스트로 보장한다.'));

// ===== 10. 설명 동적화 =====
c.push(H('10. [개선] 설명 문장 동적화 (LLM 미사용)'));
c.push(before('추천 카드 설명이 모든 코디에 똑같은 고정 문구라 정보량이 0이었다.'));
c.push(after('엔진이 이미 계산한 값(시즌, 색의 hue 버킷, 적합·조화 점수)을 규칙으로 조합해 문장을 생성한다(buildHeadlineReason, buildFitReason). LLM은 쓰지 않는다.'));
c.push(makeTable([1700, 3663, 3663],
  ['필드', 'Before', 'After'],
  [
    ['코디 한 줄', '“퍼스널 컬러 적합도와 코디 안정성을 우선 반영했습니다.” (고정)', '“트루 윈터에 어울리는 선명한 대비 (적합 88)” (동적)'],
    ['아이템 사유', '“팔레트 기준 87점”', '“팔레트의 파랑 계열과 잘 맞음 (적합 87)”'],
  ], { valCol: 0 }));
c.push(effect('사용자가 “왜 이 코디인지”를 시즌·배색·색계열·점수로 바로 읽는다. 동시에 추천의 핵심 논리가 LLM이 아니라 엔진에 있다는 점을 지킨다.'));

// ===== 11. UI =====
c.push(H('11. [개선] 추천 결과 UI — 근거를 화면에'));
c.push(before('점수만 보이고 그 점수가 어디서 왔는지 보이지 않아 추천이 블랙박스로 느껴졌다.'));
c.push(after('결과 카드에 ① 동적 헤드라인, ② 퍼스널핏·색조화·날씨 근거 3줄, ③ 4축 점수 분해, ④ 기준 대비 품질 가산/감산, ⑤ 보유/카탈로그 출처 뱃지를 노출한다 (모두 baseline에는 없던 요소).'));
c.push(effect('사용자가 추천을 신뢰할 근거를 화면에서 즉시 확인한다. 어느 축에서 점수가 났는지 보여 추천이 설득력을 갖는다.'));

// ===== 12. 단일 옷 추천 =====
c.push(H('12. [추가발전] 단일 옷 코디 추천'));
c.push(before('전수 추천은 “옷장 전체에서 좋은 코디”를 뽑을 뿐, “오늘 이 셔츠를 입고 싶은데 뭘 매치하지”처럼 고정하고 싶은 한 벌이 있는 상황을 지원하지 못했다.'));
c.push(after('기준 옷 한 벌을 반드시 포함하는 조합만 생성한다(buildAnchoredRecommendations). 기준이 상의면 하의(+아우터), 하의면 상의(+아우터), 아우터면 상의×하의를 채우고, 상대 옷은 내 옷장 / 카탈로그 / 둘 다 중에서 고른다. 점수는 5장의 4축 엔진(scoreOutfit)을 그대로 재사용한다.'));
c.push(subP('성능', '아우터 기준 + 카탈로그 전체면 상의 582 × 하의 75 ≈ 43,650개 조합을 렌더 도중 계산해 멈췄다. 상대 후보를 퍼스널컬러 적합도 상위로 미리 잘라(상의·하의 60개, 아우터 20개) 최대 약 3,600개로 묶었다(약 92% 감소).'));
c.push(subP('다양성 버그', '초기엔 결과가 3개로 고정됐다. 표준 다양성 함수가 “한 아이템 최대 3회”로 자르는데 기준 옷은 모든 코디에 들어가 3개에서 한도에 걸린 탓. 기준 옷을 카운트에서 빼고 상대 옷만 2회로 제한해 최대 24개의 다양한 조합이 나오게 고쳤다.'));
c.push(effect('“이 옷에 뭘 같이 입지?”에 답하고, 후보를 적합도 상위로 추려 빠르면서도 품질 좋은 조합만 보여 준다. 카탈로그를 섞으면 “가진 옷에 살 옷을 더해 보는” 흐름도 된다.'));

// ===== 13. 데일리룩 =====
c.push(H('13. [추가발전] 데일리룩 — 나만의 룩 이미지'));
c.push(before('추천에서 코디를 고른 뒤, 그것을 “나만의 룩”으로 시각화·보관하는 단계가 없었다.'));
c.push(after('저장한 코디를 플랫레이 보드 레이어로 변환하고(buildDailyLookState, 카테고리별 슬롯 프리셋) 위치·크기·회전·앞뒤 순서를 조정한다. 텍스트 레이어(문구·색·크기·회전)를 얹고, 누끼(배경 제거)가 없는 옷은 자동 PNG 처리한 뒤, 완성 보드를 canvas로 렌더해 한 장의 PNG로 저장한다.'));
c.push(effect('추천 → 선택 → 이미지 완성까지 앱 안에서 끝난다. 사용자가 결과물을 남기고 공유할 수 있어 개인화 경험이 완결된다.'));
c.push(tip('데일리룩은 코드로는 이전부터 있었지만 중간 발표에서 공개하지 않았다. 관객 기준으로는 첫 공개이며, 깃 히스토리 질문엔 “구현은 이전부터, 공개는 이번이 처음”으로 답하면 정확하다.'));

// ===== 14. 수치 요약 =====
c.push(H('14. 수치 요약'));
c.push(makeTable([4500, 4526],
  ['항목', '수치'],
  [
    ['baseline 대비 커밋 수', '26개'],
    ['App.tsx 라인 수', '3,546줄 → 547줄 (로직을 모듈로 분리)'],
    ['추천 엔진 코드', 'recommendationEngine.ts 696줄 (신규)'],
    ['추천 엔진 단위 테스트', '23개'],
    ['ML 분류 특징 수', '95개 (RandomForest 트리 300그루, 최상위 특징: 소매 비율 9.48%)'],
    ['4축 가중치', '38 / 22 / 28 / 12 (%)'],
    ['조화 분해 비중', 'hue 50 / 명도 30 / 채도 20 (%)'],
    ['의류 계절 분류 정확도', '89.74% — 직접 라벨링 516장·3계절(겨울·봄가을·여름) 기준, 룰 19.2% 대비 약 4.7배'],
    ['점수 불변 회귀 케이스', '89 / 85 / 84 (리팩터링 전후 동일)'],
    ['단일 옷 추천 성능', '43,650 → 3,600 조합 (약 92% 감소)'],
  ], { valCol: 1 }));

// ===== 15. 향후 계획 =====
c.push(H('15. 향후 계획'));
c.push(P('제품 · 추천', { bold: true, after: 60 }));
c.push(bullet('추천 방식(데일리·오피스·데이트)을 제목이 아니라 점수에 실제 반영 (type 키워드 기반 격식·무드 → 이후 메타데이터/LLM 태깅으로 정밀화).'));
c.push(bullet('신발·액세서리까지 기준이 되는 코디 탐색으로 확장.'));
c.push(bullet('색 계열 단위 다양성으로 더 폭넓은 조합 제시.'));
c.push(P('시스템 · 연구', { bold: true, before: 80, after: 60 }));
c.push(bullet('옷 사진 → 계절·색·카테고리 자동 분류·등록 end-to-end 파이프라인.'));
c.push(bullet('사용자가 고른 코디에 적합도·조화를 실시간 피드백하는 코디 평가 기능.'));
c.push(bullet('LLM 비전으로 패턴·소재 태깅 (점수 계산은 엔진 유지, 데이터 입력에 한정).'));
c.push(bullet('착용 이력·선호 기반 협업 필터링, 모바일 내 추론용 모델 경량화.'));

// ===== 16. Q&A =====
c.push(H('16. 예상 질문 대응'));
c.push(bullet('“가중치(38/22/28/12)는 왜 이 값인가.” → 정체성(퍼컬) > 완성도(조화) > 실용(날씨) > 보정(안정) 순.'));
c.push(bullet('“조화 점수의 0.22, −28, 0.65 근거는.” → 9장 근거표(색채 이론·지각 경험칙).'));
c.push(bullet('“리팩터링하면서 결과가 바뀐 것 아닌가.” → 회귀 스냅샷 89/85/84 동일로 증명(9장).'));
c.push(bullet('“추천에 LLM을 썼나.” → 안 썼다. 설명 문장도 계산값 기반 규칙 생성(10장).'));
c.push(bullet('“데일리룩은 새로 만든 건가.” → 중간 발표 미공개라 관객에겐 첫 공개. 구현은 이전부터, 공개는 이번.'));
c.push(bullet('“설문을 줄였는데 정확도는.” → 5문항이 진단 4축을 모두 덮고, 설문은 사진을 보조하는 안정화 신호. 핵심 정확도는 사진이 좌우(1장).'));

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22, color: INK } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 29, bold: true, font: FONT, color: PURPLE },
        paragraph: { spacing: { before: 340, after: 150 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 6 } } } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: c,
  }],
});

const out = path.join(__dirname, '..', '..', '발표_최종.docx');
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log('WROTE', out); });
