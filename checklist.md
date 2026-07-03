# 작업 체크리스트

## 2026-05-15 — 퍼컬 진단/추천 알고리즘 개선

- [x] API 예측 결과 연결 — `predictedSeason`, `predictedMaterial`을 `ClothingItem`에 저장
- [x] `이해도.md` 작성 — 11개 파트 전체 구조 문서화
- [x] 설문 8문항 → 5문항 축소 (`white_clothing`, `sun_reaction`, `muted_colors` 제거)
- [x] `labTemperatureIndex()` 추가 — RGB 방식 → Lab b* 축 기반 온도 계산
- [x] `geminiService.ts` 온도 계산 전환 — `colorTemperatureIndex` → `labTemperatureIndex`
- [x] harmonyScore 실제 계산화 — Lab ΔE + 시즌 선호 대비 범위 (이후 hue 각도로 교체)
- [x] `diversifyRecommendations()` — 동일 아이템 결과 독점 방지 (maxPerItem=3)
- [x] 추천 가중치 조정 — 조화 20%→28%, 퍼스널컬러 42%→38%
- [x] `deltaE2000()` 추가 — CIE76 → CIEDE2000 (파란 계열 지각 정확도 향상)
- [x] `scoreItemForPersonalColor` — deltaE2000 전환, 보정 상수 재보정
- [x] Itten 색상 이론 기반 조화 분류 — hue 각도 5개 타입 (monochromatic/analogous/tension/triadic/complementary)
- [x] `.claude/launch.json` — dev 서버 2개 구성 저장 (Vite:3000, uvicorn:8001)

## 미결 / 고려 중

- [x] harmonyType 레이블 UI 표시 → HARMONY_BADGE_KO / HARMONY_TITLE_KO 로 카드에 노출
- [ ] `dominantColors` 배열 활용 — 단일 HEX → 3색 가중 팔레트 매칭으로 교체
- [ ] `geminiService scorePaletteMatch`도 deltaE2000으로 전환 (현재 CIE76 유지)

---

## 2026-05-15 — 2차 확장 카탈로그 + 소분류 필터 + 추천 UI 개선

- [x] `scripts/generate_catalog_v2.py` 작성 — 2차 확장 4개 서브폴더(가을봄22/바지/신발/악세사리) 처리
- [x] 2차 확장 324개 항목 `trainingCatalog.ts`에 추가 (v2_ 접두어, human_label 없어 auto season 사용)
- [x] `part="shoe"` → 신발, `part="bag"` → 액세서리 매핑 추가
- [x] `CatalogItem` 인터페이스를 `App.tsx`에서 `trainingCatalog.ts`로 이동 — 순환 참조 해결
- [x] `Map<unknown, unknown>` 타입 추론 오류 4곳 → `new Map<string, ScoredClothingItem>(...)` 명시 수정
- [x] 소분류 필터 탭(subcategory pills) 구현 — 대분류 탭 선택 시 해당 소분류 pill 행 표시
- [x] `getHarmonyType()` 함수 추가 — Itten 5타입 + neutral 판별
- [x] `HARMONY_TITLE_KO` / `HARMONY_BADGE_KO` 상수 추가 — 추천 카드 제목/배지 한국어화
- [x] `scoreGrade()` 함수 추가 — 90↑S / 80↑A / 70↑B / 60↑C / 나머지D
- [x] 신발을 코디 조합에서 완전 제거 — 상의 × 하의 × 아우터(옵션) 조합만 생성
- [x] 추천 카드 UI 개선 — harmony 배지, 날씨 밴드 태그, 점수 원형, 컬러 스트립, fitGrade 배지, 등급 행
- [x] `v2_shoe_shoe_001~016` 중복 16개 제거 — 워크트리 + 메인 양쪽 dedup (총 830개)
- [x] `index.css` — `.catalog-subtabs`, `.harmony-badge`, `.score-circle`, `.outfit-color-strip`, `.fit-badge`, `.grade-S/A/B/C/D` 등 신규 스타일 추가
- [x] 워크트리 커밋 → 메인 병합 완료

- [x] `background_remove_api.py` — `season_predictor` top-level import → lazy import 전환, uvicorn 기동 오류 수정

## 미결

- [x] `dominantColors` 3색 팔레트 매칭 — `scoreSingleHex` 헬퍼 추가, `scoreItemForPersonalColor` 비율 가중 평균 전환
- [x] `LabColor` 타입 import 추가 — `[number, number, number][]` 잘못된 파라미터 타입 수정
- [ ] `geminiService scorePaletteMatch` deltaE2000 전환
- [x] 아우터 카탈로그 30개 추가 — 재킷 24 + 코트 6, 총 860개 (v2_outer_*)

---

- [x] 데일리룩 목록 상단에 새 데일리룩 만들기 버튼을 추가했습니다.
- [x] 빈 데일리룩을 생성해 편집 화면으로 이동하는 흐름을 연결했습니다.
- [x] 옷장 아이템과 카탈로그 아이템을 데일리룩 편집 화면에서 추가할 수 있게 했습니다.
- [x] 텍스트 레이어 추가, 선택, 드래그, 색상, 크기, 회전, 숨김, 삭제를 구현했습니다.
- [x] 확정 이미지 생성 시 텍스트 레이어도 함께 렌더링되게 했습니다.
- [x] 모바일 폭에서 데일리룩 목록 제목과 버튼이 세로로 정렬되게 했습니다.
- [x] `npm run build`로 타입과 번들 빌드를 확인했습니다.
- [x] 데일리룩 편집 화면의 선택 패널을 간단한 상태 요약으로 축소했습니다.
- [x] 텍스트 레이어를 투명 배경 객체로 바꾸고, 캔버스 안에서 직접 크기 조절 핸들을 제공했습니다.
- [x] 옷 추가 UI를 우측 고정 패널에서 모달로 옮겼습니다.
- [x] 옷 추가 모달에서 내 옷장, 프로젝트 카탈로그, 카테고리를 선택해 아이템을 고를 수 있게 했습니다.
- [x] 저장/수정 버튼을 우측 레이어 도구 영역에서 화면 상단 작업 영역으로 이동했습니다.
- [x] 편집 중 추가한 옷은 저장 버튼을 누르기 전까지 localStorage 데일리룩에 반영하지 않게 했습니다.
- [x] 텍스트 크기 변경이 캔버스에서 즉시 보이도록 표시 글자 크기 계산을 수정했습니다.
- [x] 추천 코디를 저장할 때 자동 플랫레이 배치 상태를 함께 생성하게 했습니다.
- [x] 아우터, 상의, 하의, 신발, 모자, 가방, 액세서리 슬롯이 겹치지 않도록 자동 배치 프리셋을 개선했습니다.
- [x] 데일리룩 목록에서 확정 이미지가 없어도 자동 배치 보드 미리보기를 보여주게 했습니다.
- [x] 상의와 하의 자동 배치 간격을 더 좁혀 한 벌처럼 보이게 조정했습니다.
- [x] 데일리룩 목록의 이름 수정 기능을 제거했습니다.
- [x] 데일리룩 만들기 화면의 수정 모드 토글을 제거하고, 화면 진입 즉시 편집 가능하게 정리했습니다.
- [x] 더 이상 쓰지 않는 데일리룩 item update 함수와 MVP 상하의 필수 검사 함수를 제거했습니다.
# 작업 체크리스트.

## 2026-05-16 카탈로그.md 작성.

- [x] 현재 카탈로그 데이터 파일과 이미지 폴더 구조를 확인한다.
- [x] 앱에서 카탈로그가 화면에 표시되고 옷장으로 저장되는 흐름을 추적한다.
- [x] JSON 분석 결과가 TypeScript 카탈로그와 public 이미지로 변환되는 생성 스크립트 구조를 확인한다.
- [x] `카탈로그.md`를 작성한다.
- [x] 카탈로그 검증 스크립트와 Markdown 파일 생성 여부를 확인한다.

## 2026-05-16 이해도(codex).md 재작성.

- [x] 기존 `이해도.md`를 읽고 문서의 기준점과 누락 가능성을 파악한다.
- [x] 현재 프로젝트의 설정, 프론트엔드, 서버, 스크립트, 데이터 파일을 다시 훑는다.
- [x] 최근 변경된 카탈로그, 추천, 데일리룩, 서버/ML 연결 흐름을 현재 코드 기준으로 정리한다.
- [x] `이해도(codex).md`를 새로 작성한다.
- [x] Markdown 파일 생성 여부와 주요 근거 파일명을 확인한다.

---

## 2026-05-16 — 내 옷 사진 → AI 자동 옷장 등록

- [x] `server/background_remove_api.py` — `/api/clothing/extract` 응답에 `detectedCategory`, `fineLabels` 추가
- [x] `src/App.tsx` — `BackgroundRemoveResult` 인터페이스에 `detectedCategory`, `fineLabels` 추가
- [x] `src/App.tsx` — `manual` 상태에 `aiAnalyzed`, `aiConfidence` 필드 추가
- [x] `src/App.tsx` — `FINE_LABEL_TO_TYPE` 맵 추가 (fine_labels → 한국어 type 자동 매핑)
- [x] `src/App.tsx` — `autoAnalyzeOnUpload(file)` 함수 작성 (upper_lower로 자동 분석)
- [x] `src/App.tsx` — `handleFileChange` 에서 `autoAnalyzeOnUpload` 자동 호출
- [x] `src/App.tsx` — `ManualAdd` 컴포넌트에 AI 분석 배지 추가
- [x] `index.css` — `.ai-analysis-badge` 스타일 추가
- [x] `npm run build` 빌드 통과 확인
# 2026-05-24 추천 근거 패널 1차.

- [x] 추천 카드와 추천 엔진의 현재 연결 지점을 확인한다.
- [x] `OutfitRecommendation`에 카드 표시용 근거 데이터 타입을 추가한다.
- [x] 추천 생성 시 점수 분해와 핵심 이유를 함께 만든다.
- [x] 추천 카드 UI에 근거 패널을 추가한다.
- [x] 추천 엔진 테스트를 보강한다.
- [x] `npm test`, `npm run lint`, `npm run build`를 실행한다.
# 2026-05-24 추천 점수 공식 근거화.

- [x] `scoreSingleHex`의 선형 감점 공식을 Delta E 구간형 점수 함수로 바꾼다.
- [x] 중립색과 데님 보너스를 퍼스널컬러 점수에서 줄이고 조합 안정성 보정으로 옮긴다.
- [x] 추천 근거 문장의 소수점 점수를 정수로 표시한다.
- [x] 데일리룩 목록에 검색, 점수순, 날씨순 정렬을 추가한다.
- [x] 데일리룩 자세히 보기에서 옷장 위치와 어울림 근거를 보여준다.
- [x] 데일리룩 상세에서 해당 옷장으로 이동할 수 있게 한다.
- [x] 데일리룩 만들기에서 옷 추가 후 저장 전 상태가 다시 사라지는 문제를 고친다.
- [x] 테스트, lint, build로 검증한다.

- [x] `calculateHarmonyScore`에 명도 대비와 채도 균형을 추가한다.
- [x] 색상 조합 필터를 Lab 거리 기반 그룹으로 바꾼다.
- [x] 아우터가 있는 코디는 아우터와 안쪽 옷의 조화까지 점수에 반영한다.
- [x] 추천 전후 평균 비교용 점수 진단 패널을 추가한다.
- [x] `개선사항.md`에 2026-05-24 추가 개선 내용을 반영한다.
- [x] `npm test`, `npm run lint`, `npm run build`로 검증한다.
- [x] 점수 공식과 조합 품질 테스트를 추가한다.
- [x] `개선사항.md`를 최신 발표용 설명으로 다시 정리한다.
- [x] `npm test`, `npm run lint`, `npm run build`를 실행한다.
# 2026-05-24 App 화면 모듈 분리.

- [x] Home 화면 컴포넌트를 feature 파일로 분리한다.
- [x] Wardrobe 화면 컴포넌트를 feature 파일로 분리한다.
- [x] Recommendation 화면 컴포넌트를 feature 파일로 분리한다.
- [x] SavedOutfits 화면 컴포넌트를 feature 파일로 분리한다.
- [x] App.tsx는 페이지 조립과 상태 연결 중심으로 줄인다.
- [x] TryOn 분리는 다음 단계로 남긴다.
- [x] `npm run lint`, `npm test`, `npm run build`로 검증한다.
# 2026-05-24 TryOn 모듈 분리.

- [x] TryOn 화면을 feature 파일로 분리한다.
- [x] App.tsx는 TryOn import만 사용하게 줄인다.
- [x] 캔버스 이미지 로더를 함께 이동한다.
- [x] `npm run lint`, `npm test`, `npm run build`로 검증한다.
# 2026-05-24 옷장 상태 훅 분리.

- [x] `useWardrobes` 훅을 만든다.
- [x] 옷장/의류 CRUD와 localStorage 저장을 옮긴다.
- [x] `App.tsx` 상태 연결을 줄인다.
- [x] `npm run lint`, `npm test`, `npm run build`로 검증한다.
# 2026-05-24 남은 App 상태 분리와 카탈로그 JSON화.

- [x] `useSavedOutfits.ts`를 만든다.
- [x] `useAppRoute.ts`를 만든다.
- [x] `trainingCatalog.ts`를 JSON 로딩 구조로 바꾼다.
- [x] `App.tsx` 연결을 정리한다.
- [x] `npm run lint`, `npm test`, `npm run build`로 검증한다.
# 2026-05-24 storage, personal color, manual add 분리.

- [ ] 공통 `storage.ts`를 만든다.
- [ ] `usePersonalColor.ts`를 만든다.
- [ ] `useManualClothing.ts`를 만든다.
- [ ] `App.tsx` 연결을 정리한다.
- [ ] `npm run lint`, `npm test`, `npm run build`로 검증한다.
# 2026-05-24 storage, personal color, manual add 분리 완료.

- [x] 공통 `storage.ts`를 만들었다.
- [x] `usePersonalColor.ts`를 만들었다.
- [x] `useManualClothing.ts`를 만들었다.
- [x] `App.tsx` 연결을 정리했다.
- [x] `npm run lint`, `npm test`, `npm run build`로 검증했다.

# 2026-05-25 이 옷으로 코디 찾기 기능.

기준 옷 한 벌을 골라, 옷장·카탈로그에서 잘 어울리는 코디를 찾아 주는 기능이다.

## 확정된 결정 (사용자 컨펌 완료).

- 후보 풀 출처는 UI 토글로 사용자가 선택한다. 옷장 / 카탈로그 / 둘 다, 기본은 둘 다.
- 기준으로 삼을 수 있는 카테고리는 v1에서 상의·하의·아우터만. 신발·액세서리는 다음.
- 날씨 축은 '상관없음'으로 고정한다. 퍼컬과 조화에 집중한다.
- 진입점은 옷장 상세·카탈로그 아이템의 버튼이다.

## 1. 엔진 (핵심, 회귀 안전).

- [x] `buildRecommendations`의 점수 합성 블록을 `scoreOutfit` 헬퍼로 추출한다.
- [x] `buildRecommendations`가 `scoreOutfit`을 쓰게 바꾼다. 기존 점수 불변.
- [x] `buildAnchoredRecommendations(anchor, pool, result, mode)`를 추가한다. band는 '상관없음' 고정.
- [x] 기준 카테고리별 조합 규칙. 상의→하의(+아우터), 하의→상의(+아우터), 아우터→상의×하의.
- [x] 기준이 자기 자신과 묶이지 않게 풀에서 제외한다.
- [x] 단위 테스트. 기준 항상 포함, 자기중복 없음, 후보 없음→빈배열, 신발 기준→빈배열.
- [x] `npm run lint` + `npm test` 통과 (22개). 조화 회귀 스냅샷 89/85/84 유지.

## 2. 데이터 (App).

- [x] 카탈로그 아이템을 `scoreItemForPersonalColor`로 점수화한 풀을 memo로 만든다.
- [x] 출처 토글 상태 `'wardrobe' | 'catalog' | 'both'`를 둔다(AnchorOutfitFinder 내부).
- [x] 기준 옷 상태(anchor)와 결과 계산을 연결한다.

## 3. UI (기능 파일).

- [x] `src/features/recommendation/AnchorOutfitFinder.tsx`를 만든다.
- [x] 출처 토글, 기준 옷 카드, 결과 코디 리스트를 보여준다.
- [x] 결과 카드는 기존 `OutfitCard`를 export해 재사용하고 출처(보유/카탈로그) 뱃지를 더한다.
- [x] 옷장 상세·카탈로그 카드에 `이 옷으로 코디 찾기` 진입을 단다(상의·하의·아우터에만).
- [x] 진입 시 기준 set + 오버레이로 결과 표시.

## 4. 검증.

- [x] `npm run lint` 통과.
- [x] `npm test` 통과 (22개).
- [x] `npm run build` 통과.
- [x] 화면에서 기준 선택 → 결과 확인 (프리뷰 DOM 검증. 옷장 상세에서 코디 24개, 출처 토글 24→1 전환 확인).

## 6. 피드백 반영 (1차 구현 후).

사용자 피드백 두 가지를 반영했다.

- [x] 옷장 만들기(카탈로그 선택) 화면의 코디 칩 제거. 옷장 구성 흐름에 추천이 끼는 게 어색하다는 지적. 진입은 옷장 상세의 보유 아이템에만 둔다. 카탈로그는 상대 옷 출처(토글)로만 참여한다.
- [x] 조합이 정적인 버그 수정. `diversifyRecommendations`는 아이템 3회 등장 제한인데 기준 옷이 모든 코디에 들어가 4번째부터 전부 잘려 결과가 3개로 고정됐다. 기준 옷을 뺀 상대 옷 기준으로만 제한하도록 바꿔 24개까지 다양하게 노출한다.
- [x] 회귀 테스트 추가(하의 12개 → 결과 12개). `npm test` 23개 통과.

## 5. 기록.

- [ ] `context-notes.md`에 결정 근거를 계속 적는다.
- [ ] `개선사항.md`에 이 기능을 아주 상세히 추가한다.
- [ ] 논리 단위마다 커밋.

# 2026-05-26 단일 옷 추천 UI 고도화.

- [x] 현재 `AnchorOutfitFinder` UI와 추천 카드 재사용 구조를 확인한다.
- [x] 기준 옷 중심 화면, 추천 목적, 출처 선택을 한 화면에서 명확하게 보이게 한다.
- [x] 결과 리스트를 점수·개수·출처가 잘 보이는 추천 화면으로 정리한다.
- [x] 모바일에서도 오버레이가 넘치지 않게 CSS를 조정한다.
- [x] `npm run lint`, `npm test`, `npm run build`로 검증한다.

# 2026-06-01 논문 기반 추천 알고리즘 고도화 (A·B·C·D).

목표. 논문이 기술한 데이터 모델/철학에 맞춰 추천 엔진을 실제로 강화한다. 신뢰도 부재(테스트 mock) 시 기존 동작을 보존해 회귀 스냅샷(89·85·84)을 유지한다.

## A. Top1+Top2 신뢰도 융합 (퍼스널컬러 적합도).
- [x] `scoreItemForPersonalColor`가 Top1 팔레트/회피색만 보던 것을, Top2(`SEASON_PROFILES[seasonTop2Id]`)까지 신뢰도 가중 융합하게 바꿈.
- [x] `confidence` 부재 시 top2Share=0 → 기존 동작 보존(`computeTop2Share`).
- [x] Top2/confidence가 있는 새 단위 테스트 2개 추가(저신뢰 시 웜색 점수↑, 신뢰도 부재 시 Top1 동일).

## B. 신뢰도 기반 4축 가중 동적화 (코디 종합 점수).
- [x] `resolveScoreWeights(result)` 추가. 신뢰도 낮으면 personal↓·harmony↑(최대 0.12 이전).
- [x] `scoreOutfit`/`calculateBaseScore`가 공용 가중을 씀. 신뢰도 부재 시 38/22/28/12 유지.
- [x] 동적 가중 단위 테스트 2개 추가.

## C. 날씨 점수 로직 견고화.
- [x] `getWeatherScore`의 `band.includes('28'/'4'/'5~8')`를 `WEATHER_BAND_ORDER` 인덱스로 대체.
- [x] `'봄/가을'` seasonTag를 간절기(인덱스 2~5)에 +6 가산. 테스트 추가.

## D. 논문 본문 정정 (코드 일치).
- [x] §4-3-1 팔레트 점수 선형→구간형, utilityBonus 8→3, Top1+Top2 융합 반영.
- [x] §4-3-3 hue 임계표를 `classifyHarmonyType`(15/45/90/135)+기본점수 기준으로 정정 + 다요소 명시.
- [x] §4-3-4 신뢰도 동적 가중 + 후보 캡 반영.
- [x] 특징 수 97→95 전수 정정(ground truth `feature_columns.json`).

## 검증.
- [x] `npm test` 29개 통과(기존 23 + 신규 6), `npx tsc --noEmit` 0 에러.

# 2026-06-01 설계 명분 정립 + 논문 인용 보강.

목표. 각 로직 선택을 "왜/원리/효과/근거/발표응용"으로 방어 가능하게 만든다. 인용은 실제 검색으로 검증한 것만.

- [x] 실제 논문 검색으로 인용 6종 검증(ITA°·O'Donovan·Cohen-Or·Moon-Spencer·Kendall&Gal·Adomavicius).
- [x] `설계_명분.md` 작성 — 결정별 [구현됨]/[제안]/[휴리스틱] 상태 + 5요소(왜·원리·효과·근거·발표응용).
- [x] `논문.md` §2-1에 ITA°(Chardon 1991) 근거 추가.
- [x] `논문.md` §2-3에 색 조화 정량화 계보(Moon-Spencer→Cohen-Or→O'Donovan) + 다기준(Adomavicius)·불확실성(Kendall) 추가.
- [x] `논문.md` §4-1-2(색온도 ITA° 근거+공식), §4-3-3(조화 정량화 맥락), §4-3-4(다기준·불확실성 + 손튜닝 정직 표기) 보강.
- [x] `논문.md` 참고문헌 [20]~[26] 추가(피부톤 C절, 조화·다기준·불확실성 D절).
- [x] 정직성. 구현된 것(A·B·C)과 제안(ITA° 정식 도입·조화 점수 정당화)을 명확히 구분, 매직넘버는 "휴리스틱·향후 사용자평가로 학습"으로 표기.
- [ ] (다음 후보) ITA° 코드 정식 도입(L* 포함), 조화 점수 O'Donovan 모델로 보정.

# 2026-06-05 옷 추가 도메인 GOAL 실행.

## 1단계 데이터 정합성 (완료·검증).
- [x] `clothingMeta`: HEX→가장 가까운 COLOR_META 매핑(`nearestColorMeta`)으로 isNeutral·색이름·데님 도출.
- [x] 이름 입력(카탈로그) 경로 회귀 보존(분기 처리). `fromCatalog`는 저장값 사용 → 860 카탈로그 무영향 확인.
- [x] 데님: HEX는 하의·아우터에서만(상의 오탐 방지).
- [x] `clothingMeta.test.ts` 신규: HEX 중립/색이름/데님 + 이름 회귀 + 미니셋 96%(24/25) + 카탈로그 결함 진단.

## 2단계 견고성.
- [x] `dev:api` 절대경로 → `python` 이식성.
- [x] `getApiHealth()` + `describeFailure()`로 서버 꺼짐/분석 실패 구분 안내.
- [x] 신발/액세서리 프런트 categoryMap 확장.
- [x] 백엔드 `auto` 타깃 + `detect_dominant_category` 순수함수 추출. 실모델 평가 **카테고리 29/30=96.7%**(상/하/아우터/가방 6/6, 신발 5/6) ≥80%.

## 3단계 지속성.
- [x] `imageStore.ts`(IndexedDB) — put/get/delete + offload/rehydrate/deleteItemImages. fake-indexeddb로 5테스트.
- [x] `useWardrobes` 연결 — 마운트 시 마커 복원, 저장 시 data URL을 IDB 오프로드, 실패 시 원본 저장(유실 방지), 삭제 시 정리. 구 데이터 자동 마이그레이션.

## 검증.
- [x] `tsc` 0, `vitest` 42 통과(추천29+clothingMeta8+imageStore5), `vite build` 성공, 백엔드 `py_compile` OK.
- [x] anaconda python(전체경로) 가용 + 모델스택 설치 확인 → 실모델 검증 수행.

## 발견.
- [x] 카탈로그 860벌 저장 isNeutral 전부 false + representativeColor가 HEX(생성 결함). JSON 수정 금지라 별도 작업으로 보고.

# 2026-07-02 리버스 FRD — v2 재시작 명세.

- [x] 기획 문서 30여 개 + src/server/scripts 전수 리버스 엔지니어링(하드코딩·계절 분류기 실태 확인).
- [x] 2026-07 기준 무료·오픈 모델 조사(누끼/분할/패션 임베딩/VLM/무료 API/VTON/얼굴).
- [x] `리버스frd.md` 작성 — UI 계약·FR/NFR·승계/폐기 목록·기술 재선정·v2 구조·11월 로드맵·문서 처분 지도.
- [ ] P0 착수 — 라벨·원본 데이터(project_image_model)를 v2 저장소로 이관, config 주입 체계.

# 2026-07-02 의류 인식 파트 상세 해부.

- [x] 서버(background_remove_api, season_predictor, artifacts)·프론트(useManualClothing, clothingMeta, App 병합부)·카탈로그 스크립트 전수 분석 → `의류인식_리버스해부.md`.
- [x] 확정 버그 3건 문서화(계절 수정 무시 / 예측 잔존 / isDenim-material 모순) + 상품컷 계통 편향 워크스루 증명.
- [x] RF 95특징 그룹 분해, 학습 셋 상의 편중 물증(fine_* 4종) 확인.
- [ ] v2 착수 시 해부 문서 §6 문제 18건을 체크리스트로 소화.

# 2026-07-02 계절 개념 혼용 조사.

- [x] 퍼컬 시즌(12계절) vs 착용 계절(SeasonTag) 혼용을 코드·UI·데이터·논문 4개 층에서 추적 → `계절개념_혼용_보고서.md`.
- [x] 점수 코드의 직접 교차 오염 없음 검증 + 버그 D(사계절 필터 소실) 확정.
- [ ] 논문 2장에 용어 정의 절 추가(퍼스널컬러 시즌 vs 착용 계절), 기여 2 명칭 "의류 착용 계절 분류"로 통일.
- [ ] v2에서 타입 분리(PersonalSeason/WearSeason)와 필터 enum 비교 반영.

# 2026-07-02 MVP 골든 패스 확정 + 리버스 FRD 대개정.

- [x] 설계 의도 재확인 — 사진 등록은 부가 경로, 서비스는 카탈로그 + URL 수집 + 사진의 3경로 체계로 확정.
- [x] `리버스frd.md` 개정 — §4.0 골든 패스 신설, FR-2 스키마 계약 재정의, FR-2a·FR-9(옷장 빌더)·FR-10(URL 수집) 신설, NFR-9(시연 내성) 추가, §6.2 수집 어댑터 구조로 재작성, 로드맵 재편(P1=골든 패스 수직 완성, 부가 경로는 URL>사진 순).
- [x] `설계자_관점.md` 작성 — 두 메타데이터 상호작용 큰 틀, 설계 3단계, 폭발 지점 회고, 카탈로그 탄생 배경, 수집 3경로, 골든 패스, 기술 태도 정리.
- [ ] "겹치지 않는 조합" 정의 확인 — 같은 옷 재사용 금지로 가정해 §4.0에 기록, 다르면 갱신.
- [ ] P0 착수 — v1 동결 커밋+태그, 데이터 구출(감사 게이트), config 주입 체계.

# 2026-07-02 리버스 FRD 최종 고도화 — 집중 배분.

- [x] §1.5 집중 배분 신설 — 빡집중 5(데이터 구출·카탈로그 품질·옷장 빌더+추천 성립 보장·추천 설득력·논문 실험 조기 병행) / 덜 집중 5(사진 정교화·로컬 VLM·저장 재설계·옷장 부가 기능·402장 신규 라벨링) / 하지 않음 목록.
- [x] 골든 패스 구멍 3개 FR에 명세 — 진단 결과 이미지 저장(FR-1), 겹치지 않는 N조합 알고리즘+날씨 수동 오버라이드(FR-4), 데일리룩 PNG 내보내기(FR-6).
- [x] FR-9 강화 — 프리셋 3~4종×30~40벌 수동 큐레이션, 추천 성립 보장을 합격 기준으로(검증 스크립트 자동 확인).
- [x] 실측 검증 — 카탈로그 PNG 860장 픽셀 검사(표본 12장): 투명 누끼 아님, RGB 회색 배경(199~225)·저해상도(418×313). §2.2(3)에 실증 추가, P1에 배치 누끼 재편입, P0에 고해상도 원본 구출 명시.
- [x] 덜 집중 반영 — segformer_b2 분할 MVP 제외, 저장 계층 v1 그대로 이식, 3자 비교 실험 P3→P2 병행으로 앞당김, P5에 오프라인 리허설 2회 추가.
- [ ] P1에서 데일리룩이 카탈로그 옷을 어떻게 렌더하는지 v1 TryOn 확인(현재는 회색 상자로 보일 가능성).
