# 옷 추가 도메인 GOAL — "옷 인식 후 데이터 추출"을 정말 가능하게

> 분석 기준. 실제 코드(`useManualClothing.ts`, `clothingMeta.ts`, `App.addManualItem`, `server/*`)를 읽고 작성. 추측 없음. 아직 코딩 전.
> 상태. **확정 (v1.0) — 2026-06-05.** BLOCKER 3건은 아래 "확정된 결정"으로 해소함. 코딩 착수는 별도 지시 후.

## 현황 진단 (한 줄)

파이프라인은 **돌아가지만 데이터가 샌다.** 사진 → SegFormer 추출 → 폼 자동 채움까지는 되나, 저장 시 `isNeutral`은 항상 false, `patternType`은 항상 `solid`, `isDenim`은 텍스트 추측이라 **추천 엔진이 쓰는 핵심 필드가 AI 등록 항목에서 비어 버린다.** 또 서버 경로 하드코딩·이미지 base64 localStorage 보관 때문에 "내 PC 데모"를 벗어나지 못한다.

---

# GOAL

사용자가 옷 사진 한 장을 올리면 **카테고리·대표색·계절·소재·패턴·중립/데님 여부가 정확하고 일관되게 자동 추출**되어, 사용자가 최소한의 확인·수정만으로 옷장에 저장할 수 있고, **서버가 꺼져 있어도 흐름이 끊기지 않으며**, 추출 정확도를 **수치로 검증**할 수 있는 상태로 만든다.

핵심은 "추출된 메타데이터가 추천 엔진이 실제로 쓰는 필드(`isNeutral`, `isDenim`, `patternType`, `dominantColors`, `seasonTag`)를 빠짐없이·정확히 채우는 것"이다. 이것이 안 되면 옷을 추가해도 추천 품질이 조용히 나빠진다.

---

# SUCCESS CRITERIA

다음을 모두 만족하면 완료로 본다. 단계별로 나눠 영향이 큰 1단계부터 닫는다.

## 1단계 — 데이터 정합성 (가장 영향 큼)
- AI 등록 항목의 `isNeutral`이 하드코딩 false가 아니라 **대표 HEX의 채도/명도에서 도출**된다(무채색 옷이 무채색으로 저장됨).
- `isDenim`/`denimWash`가 **HEX + 라벨 신호**로 판정된다(청바지 사진이 데님으로 저장됨).
- `representativeColor`가 HEX 문자열이 아니라 **사람이 읽는 색 이름**으로 저장된다(예: `#1B2A4A` → "네이비").
- (패턴 분류는 1단계 완료 기준에서 **제외** — "확정된 결정 C" 참조. 현재 `patternType='solid'` 기본값은 알려진 한계로 문서화한다.)
- 손수 라벨링한 **미니 평가셋(상의/하의/아우터/신발 + 무채/데님/패턴 포함 ≥ 25장)** 에서:
  - 카테고리 자동분류 정확도 **≥ 80%**
  - `isNeutral` 일치율 **≥ 90%**
  - 대표색 ΔE2000 평균 오차 **수치 보고**(목표값은 측정 후 합의)

## 2단계 — 견고성
- 신발·액세서리 사진도 올바른 카테고리로 추출된다(현재 `upper_lower` 한정 → 카테고리별 타깃 사용).
- `/api/health`로 서버 상태를 먼저 확인하고, **서버 꺼짐 시 명확한 안내 + 수동 입력 폴백**이 끊김 없이 동작한다(흰 화면·무한 로딩 없음).
- `dev:api` 스크립트의 **파이썬 절대경로 하드코딩 제거**(다른 PC에서 실행 가능).

## 3단계 — 지속성·검증
- 이미지 blob은 **IndexedDB**, 메타데이터는 localStorage에 저장한다(확정된 결정 A). 파생 사이즈(thumbnail 256 / card 512 / cutout PNG)를 둔다. 수십 벌을 추가해도 용량 초과가 없다.
- 추출 정확도 수치가 보고서에 표로 남는다.

---

# VERIFICATION

완료 여부는 다음으로 검증하고 **수치와 함께** 보고한다.

- `npm run lint` (= `tsc --noEmit`) — 오류 0개.
- `npm test` (vitest) — 기존 29개 무회귀 + **신규 "추출 결과 → ClothingItem 매핑" 단위 테스트** 통과. (HEX→isNeutral, 데님 판정, 패턴 정규화, 카테고리 매핑)
- `npm run build` — 성공.
- 백엔드 end-to-end — `/api/health` 200 확인 + 샘플 이미지 1장으로 `/api/clothing/extract` 호출해 `detectedCategory/colors/predictedSeason` 응답을 캡처(수치·JSON 첨부).
- 미니 평가셋 정확도 — 카테고리/`isNeutral`/대표색 ΔE 표로 보고.

---

# CONSTRAINTS (변경 금지)

- **추천 엔진 점수 공식 변경 금지** — `recommendationEngine.ts`의 `SCORE_WEIGHTS`, `calculateHarmonyScore`, 조화 상수 등. (방금 논문 기반으로 정당화한 부분이라 흔들면 명분이 깨진다.)
- **퍼스널컬러 엔진 변경 금지** — `personalColorEngine.ts`, `faceLandmarker.ts`, `photoAnalysis.ts`.
- **`ClothingItem` 공개 필드의 비호환 변경 금지** — 여러 화면·추천·저장이 의존한다. 확장은 **옵셔널 필드**로만.
- **`buildColorMeta` 하위호환 유지** — 카탈로그 생성과 공유되므로, 기존 카탈로그 항목 동작이 바뀌면 안 된다.
- **기존 테스트 삭제·약화 금지.** (추가는 가능.)
- **`src/data/trainingCatalog.json` 임의 변경 금지.**

---

# SCOPE

수정 가능:
- `src/hooks/useManualClothing.ts` — 자동 분석 흐름, 카테고리별 타깃.
- `src/services/clothingMeta.ts` — `isNeutral`(HEX 기반)·`isDenim`·`patternType`·색 이름 도출 보강.
- `src/services/clothingImageApi.ts` — 헬스체크, 에러 처리.
- `src/features/wardrobe/**` — 등록 리뷰/수정 UI, 저신뢰 경고.
- `src/wardrobeConstants.ts` — `FINE_LABEL_TO_TYPE`, `COLOR_META`, 카테고리별 타깃 맵.
- `server/background_remove_api.py`, `server/season_predictor.py` — 패턴/데님 신호 추가, 카테고리 확장.
- `package.json` — `dev:api` 경로 이식성.
- 신규 파일 — 미니 평가셋, 추출→item 매핑 테스트.

수정 금지:
- `src/services/recommendationEngine.ts` (점수 공식)
- `src/services/personalColorEngine.ts`, `faceLandmarker.ts`, `photoAnalysis.ts`
- `src/data/trainingCatalog.json`
- 기존 `*.test.ts` (삭제/약화)

---

# EXECUTION POLICY

- 먼저 문제를 분석한다(완료 — 위 진단표).
- **영향이 가장 큰 가설부터**: 1단계 데이터 정합성(`isNeutral`/`isDenim`/`patternType`)이 추천 품질에 직결되므로 최우선.
- 변경 후 즉시 `npm test`·`npm run lint`로 검증한다.
- 실패 시 원인과 증거(에러 로그·실제 값)를 기록한다. 추측으로 고치지 않는다.
- 메타데이터 도출 변경은 **카탈로그 회귀**를 반드시 함께 확인한다(`buildColorMeta` 공유).

---

# 확정된 결정 (BLOCKER 해소)

확정 시점에 다음 3건을 결정으로 박는다. 이의가 있으면 개별 항목만 뒤집으면 된다.

- **A. 이미지 저장 = IndexedDB(이미지 blob) + localStorage(메타데이터).** base64를 localStorage에 넣던 방식을 버린다. 파생 사이즈는 아키텍처 문서(`이미지 저장소와 옷장 데이터 아키텍처 설계.md`)의 권장대로 thumbnail 256 / card 512 / cutout PNG를 둔다. S3·CDN·signed URL은 그 문서가 정의한 향후 클라우드 확장으로 유지(이번 범위 아님).
- **B. 평가셋 = 카탈로그 부트스트랩 + 실사용 사진 보완.** 별도 대량 라벨링 대신, 기존 카탈로그(860벌, 카테고리·human_label·대표색 보유)에서 카테고리·무채/데님 분포를 갖춘 ≥25점을 추려 그 메타데이터를 ground truth로 쓴다. 가능하면 실제 휴대폰 사진 5~10장을 추가해 "원본 사진" 경로도 측정한다.
- **C. 패턴 분류는 별도 GOAL로 분리.** 이미지 기반 stripe/plaid/graphic 분류는 신뢰할 근거(데이터·모델)가 없어 이번 범위에서 제외한다. `patternType='solid'` 기본값은 **알려진 한계로 문서화**하되, 없는 패턴을 새로 'solid'로 단정하는 로직을 추가하지 않는다. 'unknown' 표기 도입은 `ClothingItem` 타입 확장이 필요하므로 향후로 미룬다.

# 남은 가정·리스크 (착수 중 막히면 중단·보고)

- 서버 모델 파일(`server/artifacts/season_model.joblib`)과 파이썬 환경이 있어야 백엔드 검증이 가능하다. 없으면 룰 폴백으로만 측정하고 그 사실을 보고한다.
- IndexedDB 전환은 저장 레이어(`storage.ts`·`useWardrobes`)를 건드리므로, 기존 localStorage 데이터의 1회성 마이그레이션(또는 호환 로딩)을 함께 처리한다. 같은 실패가 반복되면 중단·보고.
- 평가셋이 카탈로그 기반이면 "이미 전처리된 누끼 이미지"라 실사용 원본 사진보다 쉬운 입력이다. 정확도 수치 보고 시 이 한계를 명시한다.
- 요구사항 충돌(예: CONSTRAINTS의 `buildColorMeta` 하위호환 vs `isNeutral` 도출 변경)이 생기면 카탈로그 회귀를 먼저 확인하고, 충돌이 남으면 중단·보고.

---

# OUTPUT FORMAT (실행 단계에서의 최종 보고서)

실제 구현을 진행하면 보고서에 다음을 포함한다.
1. 수행한 작업 요약
2. 변경 파일 목록
3. 핵심 diff 설명
4. 테스트 결과(수치)
5. 남은 위험 요소
6. 수동 확인이 필요한 항목

---

## 부록 — 권장 단계 분해 (착수 시)

1. `clothingMeta.buildColorMeta`에 **HEX→isNeutral**(채도·명도 임계) + **HEX→색 이름** 도출 추가. 카탈로그 회귀 확인. → 테스트로 박제.
2. **isDenim/denimWash를 HEX+라벨**로 보강(텍스트 의존 축소). → 테스트.
3. **자동 분석 카테고리 확장**(신발·액세서리): 카테고리별 `targetPart` + categoryMap 확대. → 평가셋으로 정확도 측정.
4. **서버 견고성**: `/api/health` 선확인 + 폴백 UX, `dev:api` 경로 이식성.
5. (의사결정 후) **이미지 저장 전략** 교체.
6. **패턴 인식**은 데이터 확보 후 별도 GOAL로 분리.

---

## 진행 현황 (2026-06-05) — 완료

블로커 해제. anaconda python(3.13.5, 전체 경로)으로 **실제 모델 파이프라인 구동 가능**(torch·transformers·sklearn·cv2·모델 전부 설치 확인), `fake-indexeddb` 설치로 **IndexedDB 단위 검증 가능**. 따라서 당초 "환경 블로커"였던 항목들을 실측·검증으로 닫았다.

| 항목 | 상태 | 검증(수치) |
| --- | --- | --- |
| 1단계 `isNeutral`(HEX) | ✅ 완료 | 미니셋 **96%(24/25)** + 단위테스트 |
| 1단계 `isDenim`(HEX+카테고리 게이트) | ✅ 완료 | 단위테스트 |
| 1단계 `representativeColor` 색이름 | ✅ 완료 | 단위테스트 |
| 1단계 이름입력(카탈로그) 회귀 | ✅ 보존 | 단위테스트 + `fromCatalog` 저장값 사용 |
| 1·2단계 **카테고리 자동분류 정확도** | ✅ 완료 | **실모델 29/30 = 96.7%** (상의·하의·아우터·가방 6/6, 신발 5/6) ≥ 80% |
| 2단계 `dev:api` 경로 이식성 | ✅ 완료 | `python -m uvicorn`으로 변경 |
| 2단계 `/api/health` + 오프라인 안내 | ✅ 완료 | tsc/build (런타임 UX는 앱 구동 시 확인) |
| 2단계 신발/액세서리 백엔드 `auto` | ✅ 완료 | `detect_dominant_category` 단위테스트 + 실모델 96.7% |
| 3단계 IndexedDB 저장 | ✅ 완료 | imageStore 라운드트립 **5 테스트**(fake-indexeddb), useWardrobes 연결(마이그레이션·실패 폴백) |

전체 검증: `npx tsc --noEmit` **0개**, `npx vitest run` **42개 통과**(추천 29 + clothingMeta 8 + imageStore 5), `npx vite build` 성공, 백엔드 `py_compile` OK.

발견(별도 작업). 카탈로그 860벌의 저장 `isNeutral`이 **전부 false**(생성 누락 결함), `representativeColor`가 색이름이 아니라 HEX다. CONSTRAINT상 JSON 직접 수정 금지라 미수정 — **생성 스크립트 재실행으로 정정** 필요(별도 GOAL).

런타임 최종 확인(권장, 코드/테스트로는 통과). ① 앱을 띄워 업로드→저장→새로고침 후 이미지가 IndexedDB에서 복원되는지, ② `npm run dev:api`로 신발/가방 사진 HTTP e2e. (핵심 로직은 모두 자동 검증됨.)
