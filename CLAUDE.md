# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

퍼스널컬러 12계절 진단 + 디지털 옷장 + 코디 추천 웹 앱. React 19 + TypeScript + Vite 6 프론트엔드와, 의류 이미지 누끼/대표색 추출용 FastAPI Python 서버로 구성된다. 문서·주석·커밋 메시지는 한국어를 기본으로 쓴다.

## 자주 쓰는 명령

```bash
npm run dev        # Vite 개발 서버 (포트 3000)
npm run dev:api    # FastAPI 이미지 처리 서버 (포트 8001, server/background_remove_api.py)
npm run build      # 프로덕션 빌드
npm run lint       # ESLint 아님 — tsc --noEmit 타입 체크
npm test           # vitest run (전체 테스트)
npx vitest run src/services/recommendationEngine.test.ts   # 단일 테스트 파일
```

Python 서버 의존성은 `server/requirements.txt`. 정밀 누끼는 첫 요청 시 `sayeed99/segformer-b3-fashion` 모델 로드로 오래 걸릴 수 있다.

## 아키텍처

앱은 크게 세 도메인으로 나뉜다.

### 1. 퍼스널컬러 진단 (사진 + 설문 하이브리드)

외부 AI API 호출 없이 전부 로컬 계산이다.

- `src/components/PhotoAnalyzer.tsx` → `services/faceLandmarker.ts` (MediaPipe Face Landmarker, GPU→CPU fallback) → `services/photoAnalysis.ts` (얼굴 ROI 샘플링, 흰 종이/배경 기반 조명 보정, RGB/HSL/LAB 특징 계산)
- `src/components/Questionnaire.tsx` + `src/constants.ts` (설문 문항·스와치·가중치) → 4축 점수(temperature/lightness/clarity/contrast)
- `src/services/personalColorEngine.ts`가 사진 시즌 점수(팔레트 거리 42% + 특징 유사도 58%)와 설문 점수를 융합. 사진 비중은 사진 품질에 따라 22%~36%로 clamp — 설문이 안정화 역할.
- 12계절 팔레트/traits 데이터는 `src/personalColorWorkbook.ts`, 시즌 설명·별칭은 `src/seasonContent.ts`.

### 2. 디지털 옷장 + 의류 등록

- 도메인 타입은 `src/wardrobeTypes.ts`(ClothingItem 등), 상수는 `src/wardrobeConstants.ts`.
- 의류는 색상 하나가 아니라 `representativeColor` + `dominantColors`(상위 3개) + `material` + `patternType` + `isDenim`/`denimWash`로 구조화 저장한다. 분류는 이름 신호(예: "청", "denim") 우선, 없으면 HEX 밝기 기반 규칙.
- 누끼 파이프라인은 이원화: 일반 상품컷은 rembg u2netp(`POST /api/background/remove`), 착용샷·부위 분리는 SegFormer(`POST /api/clothing/extract`). 프론트 호출부는 `src/services/clothingImageApi.ts`, 메타 분류는 `src/services/clothingMeta.ts`.
- 이미지 영속화는 `src/services/imageStore.ts`(IndexedDB, 테스트는 fake-indexeddb 사용), 나머지 상태 영속화는 `src/services/storage.ts`.

### 3. 코디 추천 + 데일리룩

- `src/services/recommendationEngine.ts`: 퍼컬/날씨/조화/안정성 4축 점수 기반 추천 엔진. 단위 테스트가 가장 잘 갖춰진 모듈 — 점수 로직 수정 시 `recommendationEngine.test.ts`를 먼저 확인·갱신할 것.
- `src/hooks/useWeather.ts` + `src/lib/weather.ts`: 위치 기반 날씨 조회와 기온 구간(WeatherBand) 매핑.
- `src/services/dailyLook.ts`: 저장 코디를 캔버스 레이어로 자동 배치.
- 카탈로그 데이터는 `src/data/trainingCatalog.ts`, `src/data/outerCatalog.ts` (생성/검증 스크립트는 `scripts/`).

### 화면 구조

`src/App.tsx`가 화면 전환과 전역 흐름을 제어하고, 화면별 UI는 `src/features/`(home, personal, wardrobe, recommendation, try-on, saved-outfits) 아래에 있다. 도메인별 상태 로직은 `src/hooks/`(useWardrobes, useManualClothing, usePersonalColor 등)에 분리되어 있다.

## 주의점

- 일부 기존 UI 문자열에 인코딩 깨진 한글이 남아 있다. 새로 작성하는 문자열은 UTF-8 한국어로 쓰되, 기존 깨진 문자열을 임의로 일괄 수정하지 말 것.
- 루트에 한국어 파일명의 설계/발표 문서(md, docx)가 다수 있다. 도메인 배경이 필요하면 `퍼스널컬러_시스템_상세보고서.md`, `추천알고리듬 고도화 작전.md` 등을 참고.
- MediaPipe wasm/모델은 CDN에서 로드되므로 오프라인 환경에서는 얼굴 인식이 실패한다.

## v2 재구축 지침

사용자가 v2 작업을 요청하면 v1을 부분 수리하지 말고 현재 저장소 안의 `v2/` 폴더를 기준으로 크게 다시 재코딩한다. v1은 참고 자료이며, 의류 데이터 스키마·수집 파이프라인·추천 로직·프로젝트 구조는 새로 정리한다.

v2에서 먼저 읽을 문서는 다음과 같다.

- `리버스frd.md`: v2 실행 명세.
- `설계자_관점.md`: 재설계 배경.
- `v2/plan.md`: 단계 계획.
- `v2/checklist.md`: 진행 체크리스트.
- `v2/context-notes.md`: 의사결정 기록.
- `v2/docs/domain-logic-inventory.md`: 퍼컬 HEX, 설문 축, 의류 스키마, 추천 상수 등 로직 핵심 정보.
- `v2/docs/v2-schema-contract.md`: v2 데이터 계약.

v2 핵심 원칙은 다음과 같다.

- 골든 패스는 퍼컬 결과 확인, 프리셋 옷장 선택, 겹치지 않는 추천 3개, 데일리룩 저장, PNG 내보내기다.
- 사진 등록과 URL 등록은 초기 크리티컬 패스 밖의 부가 경로다.
- 퍼스널컬러 시즌과 옷의 착용 적합성은 타입과 문구에서 분리한다.
- 자동 인식 결과는 초안이며 사용자 확정값이 최종 권한이다.
- 코드 작업 전 `v2/checklist.md`와 `v2/context-notes.md`를 갱신하고, 코드 변경 후 테스트 또는 빌드를 실행한다.
