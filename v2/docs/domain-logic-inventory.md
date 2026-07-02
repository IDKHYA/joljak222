# v2 로직 핵심 정보 인벤토리

작성일: 2026-07-02.

이 문서는 v2 재구축 때 계속 참조해야 하는 로직성 정보를 한곳에 모은다. 원본은 v1 파일이지만, v2에서는 그대로 복사하기보다 계약과 의도를 먼저 승계한다.

## 1. 퍼스널컬러 시즌과 HEX 팔레트

원본 파일: `src/personalColorWorkbook.ts`, `src/types.ts`.

12계절 ID는 아래 순서를 기준으로 한다.

```text
light-spring
true-spring
bright-spring
light-summer
true-summer
soft-summer
soft-autumn
true-autumn
dark-autumn
dark-winter
true-winter
bright-winter
```

각 시즌은 다음 정보를 가진다.

- `id`: 내부 식별자.
- `name`: 한국어 시즌명.
- `englishName`: 영어 시즌명과 별칭.
- `family`: `spring`, `summer`, `autumn`, `winter`.
- `toneNote`: 온도·명도·선명도 성향 메모.
- `traits`: `temperature`, `lightness`, `clarity`, `contrast` 4축 값.
- `workbookStats`: 평균 RGB, 평균 명도, 채도, 온도, 대비.
- `palette`: 시즌별 24개 HEX 색상.

v2 원칙.

- 이 데이터는 검증된 도메인 자산으로 승계한다.
- 추천 로직은 단순 최근접 HEX 목록 비교에서 시작하되, 이후 시즌별 적합 영역으로 재가공할 수 있다.
- 회피색과 추천색은 같은 색 공간 계약 안에서 다룬다.
- HEX 값은 화면 표시용이 아니라 추천 엔진의 수치 입력이다.

## 2. 퍼스널컬러 진단 계약

원본 파일: `src/types.ts`, `src/constants.ts`, `src/services/personalColorEngine.ts`.

설문은 5문항이며 4축 점수를 만든다.

- `temperature`: 웜·쿨.
- `lightness`: 라이트·딥.
- `clarity`: 클리어·뮤트.
- `contrast`: 저대비·고대비.

사진 분석 결과는 얼굴 ROI에서 피부, 머리, 눈, 입술 색을 뽑고 조명 품질과 얼굴 인식 품질을 함께 기록한다.

최종 결과 `FinalResult`의 핵심 필드는 다음과 같다.

- `seasonTop1Id`, `seasonTop2Id`.
- `confidence`.
- `decisionType`: `hybrid`, `photo`, `questionnaire`.
- `evidence.fusionWeights.photo`.
- `evidence.fusionWeights.questionnaire`.
- `palette`.
- `recommendationFeatures`.

v2 원칙.

- 진단 엔진은 v1에서 이미 검증된 축으로 본다.
- 첫 v2 구현에서는 로직을 얇게 이식하고, App 구조만 새로 잡는다.
- 결과 카드는 PNG로 저장 가능해야 한다.
- 조명 품질이 낮으면 사진 비중을 낮추고 재촬영을 권한다.

## 3. v1 의류 스키마에서 배울 점

원본 파일: `src/wardrobeTypes.ts`, `src/wardrobeConstants.ts`.

v1 `ClothingItem` 핵심 필드.

- `id`, `wardrobeId`.
- `imageUrl`, `originalImageUrl`, `cutoutImageUrl`.
- `category`: `상의`, `하의`, `아우터`, `신발`, `액세서리`.
- `type`.
- `representativeColor`, `representativeHex`.
- `dominantColors`.
- `seasonTag`.
- `patternType`.
- `material`.
- `availabilityStatus`.
- `isNeutral`.
- `isDenim`, `denimWash`.
- `sourceType`: `catalog`, `upload`.

v2에서 그대로 가져오지 않을 것.

- `seasonTag`를 옷의 착용 계절 직접 분류로 쓰는 방식.
- `material`과 `isDenim`이 추천에 실제로 기여하는지 검증 없이 유지하는 방식.
- 등록 경로마다 다른 품질의 메타데이터가 저장되는 구조.
- 자동 예측값이 사용자 확정값을 덮을 수 있는 구조.

v2에서 유지할 것.

- 대표색 1개와 주요색 여러 개를 함께 저장하는 방향.
- 카탈로그, URL, 사진 등록이 같은 최종 스키마를 채워야 한다는 원칙.
- `availabilityStatus`로 추천 제외 상태를 표현하는 방식.

## 4. 색상 메타 기준

원본 파일: `src/wardrobeConstants.ts`.

v1 색 이름 기준은 `COLOR_META`에 있다. 대표 예시는 아래와 같다.

| 색상명 | HEX | 속성 |
| --- | --- | --- |
| 화이트 | `#F7F7F4` | neutral |
| 아이보리 | `#F1E8D7` | neutral |
| 블랙 | `#171717` | neutral |
| 차콜 | `#34363A` | neutral |
| 그레이 | `#8B8F97` | neutral |
| 네이비 | `#22334D` | neutral |
| 데님 | `#5C7898` | denim |
| 베이지 | `#D7C2A1` | neutral |
| 브라운 | `#795342` | color |
| 레드 | `#C7474C` | color |
| 핑크 | `#D8A8B5` | color |
| 민트 | `#A8D8C2` | color |
| 그린 | `#88A97E` | color |
| 올리브 | `#7D8051` | color |
| 라벤더 | `#B8A8D4` | color |

v2 원칙.

- 색 이름은 UI와 설명용이다.
- 추천 계산은 HEX, RGB, LAB, HSL 변환값을 기준으로 한다.
- 카탈로그 메타 생성 시 색 이름과 HEX가 뒤섞이지 않게 스키마에서 분리한다.
- `isNeutral`은 직접 저장하기보다 색 메타에서 파생하는 방향을 우선 검토한다.

## 5. 추천 엔진의 검증된 축

원본 파일: `src/services/recommendationEngine.ts`.

v1 추천 엔진은 4축 점수를 합산한다.

| 축 | v1 가중치 | 설명 |
| --- | ---: | --- |
| 퍼스널컬러 적합도 | 0.38 | 의류 색과 사용자 시즌 팔레트의 CIEDE2000 거리 기반 |
| 날씨 적합도 | 0.22 | 기온 밴드와 의류 착용 적합성 |
| 색상 조화도 | 0.28 | Itten 색상환, 명도차, 채도 균형 |
| 착용 안정성 | 0.12 | 보유 상태와 추천 안정성 |

진단 신뢰도 관련 상수.

- `TOP2_CONFIDENCE_FULL = 0.9`.
- `TOP2_CONFIDENCE_FLOOR = 0.5`.
- `TOP2_MAX_SHARE = 0.35`.
- 신뢰도가 낮을수록 Top2 시즌 팔레트를 최대 35%까지 섞는다.
- 신뢰도가 낮으면 퍼컬 축 일부를 조화 축으로 이동한다.

색 조화 관련 상수.

- `HARMONY_COMPONENT_WEIGHTS = { hue: 0.5, lightness: 0.3, saturation: 0.2 }`.
- `IDEAL_LIGHTNESS_GAP = 0.22`.
- `LOW_LIGHTNESS_CONTRAST.maxGap = 0.08`.
- `LOW_LIGHTNESS_CONTRAST.penalty = 28`.
- `DOUBLE_POINT_SATURATION.minSaturation = 0.65`.
- `DOUBLE_POINT_SATURATION.penalty = 12`.
- `FLAT_SATURATION.maxSaturation = 0.12`.
- `FLAT_SATURATION.penalty = 6`.

v2 원칙.

- 4축 구조는 승계한다.
- 날씨 축은 `seasonTag` 대신 `WarmthLevel`과 기온 밴드 직접 매핑으로 재설계한다.
- 겹치지 않는 추천 N개를 엔진 요구사항에 포함한다.
- 추천 결과는 반드시 축별 점수와 자연어 근거를 포함한다.

## 6. 날씨 밴드

원본 파일: `src/lib/weather.ts`, `src/wardrobeConstants.ts`.

v1 기온 밴드는 아래 순서를 쓴다.

```text
4도 이하
5~8도
9~11도
12~16도
17~19도
20~22도
23~27도
28도 이상
```

v2 원칙.

- 날씨 API 실패와 위치 권한 거부는 정상 시나리오다.
- 시연에서는 수동 기온 오버라이드가 필수다.
- 골든 패스는 네트워크 없이 동작해야 하므로 실시간 날씨는 필수가 아니다.

## 7. 저장 계층

원본 파일: `src/services/imageStore.ts`, `src/services/storage.ts`.

v1은 localStorage에 마커와 메타데이터를 저장하고, 큰 이미지는 IndexedDB로 오프로드한다. 이 설계와 테스트는 건강한 자산으로 분류한다.

v2 원칙.

- 1차에서는 설계를 승계한다.
- URL 등록과 사진 등록이 실제 문제를 만들기 전까지 저장 계층을 재설계하지 않는다.
- 이미지 원본, 누끼 산출물, 데일리룩 산출물은 목적이 다르므로 스키마에서 분리한다.
