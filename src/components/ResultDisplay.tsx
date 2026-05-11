/*
 * ResultDisplay.tsx
 *
 * 퍼스널컬러 최종 결과를 사용자에게 설명하는 결과 화면 컴포넌트입니다.
 * FinalResult의 Top1/Top2 시즌, 신뢰도, 사진/설문 융합 비중, 추천 팔레트, 피해야 할 색상,
 * 측정 상세와 개발자 모드 디버그 정보를 시각적으로 보여줍니다.
 *
 * 이 화면은 단순히 "결과 라벨"만 보여주는 것이 아니라,
 * 왜 해당 시즌이 나왔는지 사진 점수/설문 점수/ROI 측정값/품질 점수로 추적 가능하게 만드는 설명 가능성 계층입니다.
 * 발표 평가에서 핵심 로직의 근거를 보여줄 때 가장 중요한 UI입니다.
 */
import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { AlertTriangle, Code2, Info, Ruler } from 'lucide-react';
import { motion } from 'motion/react';
import { FinalResult, PhotoAnalysisResult, RoiMeasurement } from '@/src/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FAMILY_GUIDES, FAMILY_LABELS, PERSONAL_COLOR_MODEL_NOTE, SEASON_DETAILS } from '@/src/seasonContent';

interface ResultDisplayProps {
  result: FinalResult;
  photoData: PhotoAnalysisResult;
}

// 내부 계산값은 너무 길게 보이면 해석이 어려워서 소수 4자리로 통일합니다.
const featureValue = (value: number) => value.toFixed(4);

// 0~1 점수를 사람이 읽기 쉬운 퍼센트 문자열로 바꿉니다.
const scorePercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const metricDescriptions: Record<string, string> = {
  temperature: '사진에서는 피부, 입술, 머리, 홍채 색의 RGB 균형을 보고 쿨/웜 방향을 계산합니다. 음수는 쿨, 양수는 웜에 가깝습니다.',
  lightness: '얼굴 주요 색상의 밝기 평균입니다. 값이 높을수록 라이트/브라이트 계열에 유리하고, 낮을수록 딥 계열에 유리합니다.',
  clarity: '채도 기반의 선명도입니다. 양수면 선명하고 맑은 색감, 음수면 회색기가 섞인 부드러운 뮤트 성향으로 해석합니다.',
  contrast: '얼굴 내부 대비와 피부-머리 대비를 함께 본 값입니다. 검은 머리 하나 때문에 겨울로 쏠리지 않도록 머리 대비 비중은 낮게 잡았습니다.',
  mutedScore: '채도가 낮고 부드러울수록 높아지는 보조 지표입니다. 소프트 서머/소프트 오텀 판정에 특히 중요합니다.',
  paletteScore: '사진에서 추출한 피부, 머리, 홍채, 입술 색이 해당 시즌 팔레트와 LAB 색공간에서 얼마나 가까운지 나타냅니다.',
  traitScore: '사진 특징 벡터가 시즌별 온도감, 명도, 선명도, 대비 프로필과 얼마나 비슷한지 나타냅니다.',
  rawScore: '팔레트 점수와 특징 점수를 합친 시즌별 원점수입니다. 사진 점수에서는 팔레트 42%, 특징 58%를 사용합니다.',
  normalizedScore: '모든 시즌 원점수의 합을 100%로 보정한 상대 점수입니다. 순위 비교에는 이 값이 더 직관적입니다.',
  photoScore: '사진 분석만으로 계산된 해당 시즌의 상대 점수입니다.',
  questionnaireScore: '설문 답변만으로 계산된 해당 시즌의 상대 점수입니다.',
  fusedRawScore: '사진 점수와 설문 점수를 현재 융합 비율로 섞은 원점수입니다.',
  fusedNormalizedScore: '최종 순위에 쓰이는 융합 점수입니다. 모든 시즌의 융합 원점수를 다시 100% 기준으로 정규화합니다.',
  overall: '사진 품질의 종합 점수입니다. 노출, 좌우 대칭, 색 구분도, 얼굴 크기, 조명 보정 상태를 함께 봅니다.',
  exposure: '피부 샘플의 밝기가 너무 어둡거나 날아가지 않았는지 나타냅니다.',
  symmetry: '왼쪽/오른쪽 피부 샘플 차이가 작은지 나타냅니다. 조명이 한쪽으로 강하면 낮아질 수 있습니다.',
  distinctness: '피부와 머리, 홍채, 입술 색이 서로 충분히 구분되는지 나타냅니다.',
  faceSize: '얼굴이 프레임 안에서 충분히 크게 잡혔는지 나타냅니다.',
  background: '배경 또는 흰 종이 기준이 조명 보정에 얼마나 안정적인지 나타냅니다.',
  backgroundBrightness: '흰 종이 또는 배경 샘플의 밝기입니다. 너무 낮거나 높으면 흰 종이 기준으로 탈락할 수 있습니다.',
  backgroundNeutrality: '흰 종이 또는 배경 샘플이 RGB상 얼마나 중립적인지 나타냅니다. 색이 묻거나 그림자가 강하면 낮아집니다.',
  correctionStrength: '화이트 밸런스 보정을 얼마나 강하게 적용했는지 나타냅니다.',
  calibrationSource: 'white-reference면 흰 종이 가이드 영역을 사용했고, neutral-background/corner-fallback이면 흰 종이가 기준으로 통과하지 못해 배경 기반 보정을 사용했다는 뜻입니다.',
};

// 표나 카드에서 계산 근거를 접었다 펼칠 수 있게 하는 설명 블록입니다.
function DetailDisclosure({ children }: { children: React.ReactNode }) {
  return (
    <details className="group mt-2 rounded-xl border border-stone-200 bg-white/75 px-3 py-2 text-xs text-stone-600 open:bg-white">
      <summary className="cursor-pointer list-none font-medium text-stone-700 marker:hidden">
        자세히 보기
        <span className="ml-2 text-stone-400 group-open:hidden">+</span>
        <span className="ml-2 hidden text-stone-400 group-open:inline">-</span>
      </summary>
      <p className="mt-2 leading-relaxed">{children}</p>
    </details>
  );
}

// 개발자 모드에서 숫자 지표와 설명을 함께 보여주는 공통 카드입니다.
function MetricValue({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-2 break-words font-mono text-sm text-stone-900">{value}</p>
      {detail && <DetailDisclosure>{detail}</DetailDisclosure>}
    </div>
  );
}

// 결과 팔레트나 피해야 할 색을 HEX 칩 그리드로 표시합니다.
function ColorChipGrid({ colors, columns = 'grid-cols-5' }: { colors: string[]; columns?: string }) {
  return (
    <div className={`grid ${columns} gap-3`}>
      {colors.map((hex) => (
        <div key={hex} className="space-y-2">
          <div className="h-14 rounded-2xl border border-stone-200 shadow-sm" style={{ backgroundColor: hex }} />
          <p className="text-[11px] text-center text-stone-500">{hex}</p>
        </div>
      ))}
    </div>
  );
}

// ROI 하나의 측정 결과를 보여줍니다.
// RGB, Lab, HSL, 샘플링 위치를 함께 보여줘 사진 분석이 어느 영역에서 나온 값인지 추적하게 합니다.
function MeasurementCard({ item }: { item: RoiMeasurement }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-stone-900">{item.label}</p>
        <div className="w-9 h-9 rounded-full border border-stone-200" style={{ backgroundColor: item.color }} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs text-stone-600">
        <div>
          <p className="mb-1 text-stone-500">RGB</p>
          <p>{item.rgb.r}, {item.rgb.g}, {item.rgb.b}</p>
          <DetailDisclosure>카메라에서 읽은 색을 흰 종이/배경 보정 후 RGB 0~255 값으로 표시합니다.</DetailDisclosure>
        </div>
        <div>
          <p className="mb-1 text-stone-500">LAB</p>
          <p>{item.lab.l.toFixed(2)}, {item.lab.a.toFixed(2)}, {item.lab.b.toFixed(2)}</p>
          <DetailDisclosure>LAB는 사람 눈의 색 차이에 더 가깝게 비교하기 위한 색공간입니다. 팔레트 거리 계산에 사용합니다.</DetailDisclosure>
        </div>
        <div>
          <p className="mb-1 text-stone-500">HSL</p>
          <p>{item.hsl.h.toFixed(1)}°, {item.hsl.s.toFixed(1)}%, {item.hsl.l.toFixed(1)}%</p>
          <DetailDisclosure>HSL은 색상각, 채도, 밝기입니다. 선명도와 뮤트 성향을 해석할 때 참고합니다.</DetailDisclosure>
        </div>
        <div>
          <p className="mb-1 text-stone-500">ROI</p>
          <p>{item.region.x}, {item.region.y}, {item.region.width} x {item.region.height}</p>
          <DetailDisclosure>캡처 이미지 안에서 이 색을 샘플링한 영역 좌표입니다. 입술은 더 작은 중앙 영역을 쓰고, 빨강/핑크 후보 픽셀을 우선 선택한 뒤 갈색 그림자 쏠림을 제한적으로 보정합니다.</DetailDisclosure>
        </div>
      </div>
      <p className="text-[11px] text-stone-500">{item.color}</p>
    </div>
  );
}

// 봄/여름/가을/겨울 계열에 맞는 결과 배지 색상을 선택합니다.
function getSeasonToneClass(family: keyof typeof FAMILY_GUIDES) {
  if (family === 'spring') return 'bg-amber-50 text-amber-900 border-amber-200';
  if (family === 'summer') return 'bg-sky-50 text-sky-900 border-sky-200';
  if (family === 'autumn') return 'bg-orange-50 text-orange-900 border-orange-200';
  return 'bg-violet-50 text-violet-900 border-violet-200';
}

// temperature/lightness/clarity/contrast 같은 -1~1 축을 막대 위치와 설명으로 보여줍니다.
function AxisExplanation({ label, value, meaning }: { label: string; value: number; meaning: string }) {
  const position = `${Math.max(0, Math.min(100, ((value + 1) / 2) * 100))}%`;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-stone-900">{label}</p>
        <p className="font-mono text-xs text-stone-600">{featureValue(value)}</p>
      </div>
      <div className="relative h-2 rounded-full bg-stone-200">
        <div className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-stone-900" style={{ left: position }} />
      </div>
      <p className="text-xs leading-relaxed text-stone-600">{meaning}</p>
      <DetailDisclosure>{metricDescriptions[label] ?? meaning}</DetailDisclosure>
    </div>
  );
}

// 사진 점수, 설문 점수, 융합 점수를 같은 구조의 표로 표시합니다.
// mode에 따라 보여줄 컬럼만 바꿔서 중복 JSX를 줄입니다.
function ScoreTable({
  rows,
  mode,
}: {
  rows: Array<Record<string, number | string | boolean | string[]>>;
  mode: 'photo' | 'questionnaire' | 'fused';
}) {
  const fields =
    mode === 'photo'
      ? [
          ['팔레트', 'paletteScore', metricDescriptions.paletteScore],
          ['특징', 'traitScore', metricDescriptions.traitScore],
          ['원점수', 'rawScore', metricDescriptions.rawScore],
          ['정규화', 'normalizedScore', metricDescriptions.normalizedScore],
        ]
      : mode === 'questionnaire'
        ? [
            ['설문 원점수', 'rawScore', '설문 특징 벡터와 시즌 프로필을 비교한 원점수입니다.'],
            ['설문 정규화', 'normalizedScore', metricDescriptions.normalizedScore],
          ]
        : [
            ['사진', 'photoScore', metricDescriptions.photoScore],
            ['설문', 'questionnaireScore', metricDescriptions.questionnaireScore],
            ['융합 원점수', 'fusedRawScore', metricDescriptions.fusedRawScore],
            ['최종', 'fusedNormalizedScore', metricDescriptions.fusedNormalizedScore],
          ];

  return (
    <div className="space-y-3">
      <div className="hidden overflow-x-auto rounded-2xl border border-stone-200 md:block">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-stone-100 text-stone-600">
            <tr>
              <th className="px-3 py-2 font-semibold">시즌</th>
              {fields.map(([label]) => (
                <th key={label} className="px-3 py-2 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 bg-white">
            {rows.map((row) => (
              <tr key={String(row.seasonId)} className={row.isTop ? 'bg-stone-900 text-white' : 'text-stone-700'}>
                <td className="px-3 py-2 font-semibold">{row.seasonName}</td>
                {fields.map(([label, key]) => (
                  <td key={`${row.seasonId}-${label}`} className="px-3 py-2">
                    {scorePercent(Number(row[key]))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <div key={String(row.seasonId)} className={`rounded-2xl border p-4 ${row.isTop ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-800'}`}>
            <p className="font-semibold">{row.seasonName}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {fields.map(([label, key, detail]) => (
                <div key={`${row.seasonId}-${label}`} className={`rounded-xl p-3 ${row.isTop ? 'bg-white/10' : 'bg-stone-50'}`}>
                  <p className={`text-[11px] ${row.isTop ? 'text-stone-200' : 'text-stone-500'}`}>{label}</p>
                  <p className="mt-1 font-mono text-sm">{scorePercent(Number(row[key]))}</p>
                  {!row.isTop && <DetailDisclosure>{detail}</DetailDisclosure>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(([label, _key, detail]) => (
          <React.Fragment key={label}>
            <DetailDisclosure>
              <b>{label}</b>: {detail}
            </DetailDisclosure>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// 결과의 모든 중간 계산값을 확인하는 상세 분석 다이얼로그입니다.
// 사용자가 왜 이 시즌이 나왔는지 사진/설문/융합 점수 순서로 추적할 수 있게 구성합니다.
function DeveloperModeDialog({ result, photoData }: ResultDisplayProps) {
  const photoDebugRows = (photoData.debug?.photoSeasonBreakdown ?? [])
    .map((row) => ({ ...row, isTop: row.seasonId === result.evidence.photoSignal.dominantSeasonId }))
    .sort((a, b) => b.normalizedScore - a.normalizedScore);
  const questionTopSeasonId = [...(result.debug?.questionnaireSeasonScores ?? [])].sort((a, b) => b.normalizedScore - a.normalizedScore)[0]?.seasonId;
  const questionnaireRows = (result.debug?.questionnaireSeasonScores ?? [])
    .map((row) => ({ ...row, isTop: row.seasonId === questionTopSeasonId }))
    .sort((a, b) => b.normalizedScore - a.normalizedScore);
  const fusedRows = (result.debug?.fusedSeasonScores ?? [])
    .map((row) => ({ ...row, isTop: row.seasonId === result.seasonTop1Id }))
    .sort((a, b) => b.fusedNormalizedScore - a.fusedNormalizedScore);
  const features = photoData.measurementDetails.normalizedFeatures;
  const photoWeight = result.evidence.fusionWeights.photo;
  const questionnaireWeight = result.evidence.fusionWeights.questionnaire;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" className="rounded-full border-stone-900 bg-stone-900 text-white hover:bg-stone-700">
            <Code2 className="w-4 h-4 mr-2" />
            개발자 모드
          </Button>
        }
      />
      <DialogContent className="h-[92dvh] !w-[calc(100vw-1rem)] !max-w-none border-stone-200 bg-white p-0 overflow-hidden sm:!w-[calc(100vw-2rem)] xl:!w-[1280px]" showCloseButton>
        <DialogHeader className="p-4 pr-12 border-b border-stone-200 bg-stone-50/80 sm:p-6 sm:pr-14">
          <DialogTitle className="text-stone-900">개발자 모드: 판정 인과관계 전체 분석</DialogTitle>
          <DialogDescription className="text-stone-600">
            측정 색상, 특징 벡터, 사진 점수, 설문 점수, 최종 융합 점수가 어떤 순서로 결과에 반영됐는지 추적합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="h-[calc(92dvh-112px)] overflow-y-auto p-4 space-y-4 sm:p-6 sm:space-y-6">
          <Card className="border-stone-200 bg-stone-50/70">
            <CardHeader>
              <CardTitle className="text-base text-stone-900">1. 최종 결론 요약</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-stone-700">
              <p>
                최종 1순위는 <b>{result.seasonTop1}</b>, 2순위는 <b>{result.seasonTop2}</b>입니다. 사진 신호의 1순위는{' '}
                <b>{result.evidence.photoSignal.dominantSeason}</b>이고, 설문 신호는 <b>{result.evidence.questionSignal.temperature}</b> /{' '}
                <b>{result.evidence.questionSignal.clarity}</b>입니다.
              </p>
              <p>
                최종 계산은 사진 {scorePercent(photoWeight)} + 설문 {scorePercent(questionnaireWeight)} 비율로 섞었습니다. 사진 품질이 높아질수록 사진 비중이 조금 올라가지만,
                현재 정책상 사진 비중은 최대 36%입니다.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetricValue label="사진 비중" value={scorePercent(photoWeight)} detail="사진 품질이 좋을수록 올라가며 현재 정책상 22%~36% 범위 안에서 움직입니다." />
                <MetricValue label="설문 비중" value={scorePercent(questionnaireWeight)} detail="사진 비중을 제외한 나머지 비율입니다. 사용자의 자기 인식과 착용 반응을 결과에 안정적으로 반영합니다." />
              </div>
            </CardContent>
          </Card>

          <Card className="border-stone-200 bg-stone-50/70">
            <CardHeader>
              <CardTitle className="text-base text-stone-900">2. 사진에서 추출한 원본 색상과 ROI</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              {photoData.measurementDetails.roiMeasurements.map((item) => (
                <React.Fragment key={item.label}>
                  <MeasurementCard item={item} />
                </React.Fragment>
              ))}
            </CardContent>
          </Card>

          <Card className="border-stone-200 bg-stone-50/70">
            <CardHeader>
              <CardTitle className="text-base text-stone-900">3. 사진 특징 벡터 해석</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <AxisExplanation label="temperature" value={features.temperature} meaning="음수면 쿨, 양수면 웜입니다. 피부와 입술 비중이 가장 큽니다." />
                <AxisExplanation label="lightness" value={features.lightness} meaning="밝고 가벼운 인상인지, 깊고 어두운 인상인지 나타냅니다." />
                <AxisExplanation label="clarity" value={features.clarity} meaning="양수면 선명/비비드, 음수면 부드러운 뮤트 성향입니다." />
                <AxisExplanation label="contrast" value={features.contrast} meaning="얼굴 내부 대비와 피부-머리 대비를 합친 값입니다. 검은 머리만으로 겨울이 되지 않도록 머리 비중은 낮게 둡니다." />
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
                <p className="font-semibold text-stone-900">계산 메모</p>
                {(photoData.debug?.featureFormulaNotes ?? []).map((note) => (
                  <p key={note} className="text-sm leading-relaxed text-stone-600">
                    {note}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-stone-200 bg-stone-50/70">
            <CardHeader>
              <CardTitle className="text-base text-stone-900">4. 사진 시즌 점수표</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-stone-600">
                사진 점수는 팔레트 거리 42%와 특징 유사도 58%를 합산합니다. 이후 모든 시즌 점수 합이 100%가 되도록 정규화합니다.
              </p>
              <ScoreTable rows={photoDebugRows} mode="photo" />
              <div className="grid gap-3 lg:grid-cols-2">
                {photoDebugRows.slice(0, 4).map((row) => (
                  <div key={row.seasonId} className="rounded-2xl border border-stone-200 bg-white p-4">
                    <p className="font-semibold text-stone-900">{row.seasonName}</p>
                    {row.notes.map((note) => (
                      <p key={note} className="mt-2 text-xs leading-relaxed text-stone-600">
                        {note}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-stone-200 bg-stone-50/70">
            <CardHeader>
              <CardTitle className="text-base text-stone-900">5. 설문 점수와 의미</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {result.debug?.questionnaireScores &&
                  Object.entries(result.debug.questionnaireScores).map(([key, value]) => (
                    <React.Fragment key={key}>
                      <MetricValue label={key} value={featureValue(value)} detail={metricDescriptions[key] ?? '설문 답변에서 계산된 정규화 특징 값입니다.'} />
                    </React.Fragment>
                  ))}
              </div>
              <p className="text-sm leading-relaxed text-stone-600">
                설문은 각 질문에서 선택 가능한 최대 가중치를 기준으로 정규화합니다. 따라서 뮤트/저대비 선택이 누락되지 않고 시즌 점수에 직접 반영됩니다.
              </p>
              <ScoreTable rows={questionnaireRows} mode="questionnaire" />
            </CardContent>
          </Card>

          <Card className="border-stone-200 bg-stone-50/70">
            <CardHeader>
              <CardTitle className="text-base text-stone-900">6. 최종 융합 점수와 인과관계</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-stone-600">
                각 시즌의 최종 원점수 = 사진 정규화 점수 x {scorePercent(photoWeight)} + 설문 정규화 점수 x {scorePercent(questionnaireWeight)} 입니다.
                이 원점수를 다시 전체 시즌 합 기준으로 정규화한 값이 최종 순위입니다.
              </p>
              <ScoreTable rows={fusedRows} mode="fused" />
              <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
                <p className="font-semibold text-stone-900">결과 문장 해석</p>
                <p className="text-sm leading-relaxed text-stone-600">{result.explanation}</p>
                <p className="text-sm leading-relaxed text-stone-600">{result.evidence.boundary.note}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-stone-200 bg-stone-50/70">
            <CardHeader>
              <CardTitle className="text-base text-stone-900">7. 품질/조명 보정 상태</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricValue label="사진 품질 overall" value={featureValue(photoData.measurementDetails.qualityBreakdown.overall)} detail={metricDescriptions.overall} />
              <MetricValue label="노출 exposure" value={featureValue(photoData.measurementDetails.qualityBreakdown.exposure)} detail={metricDescriptions.exposure} />
              <MetricValue label="좌우 대칭 symmetry" value={featureValue(photoData.measurementDetails.qualityBreakdown.symmetry)} detail={metricDescriptions.symmetry} />
              <MetricValue label="얼굴 크기 faceSize" value={featureValue(photoData.measurementDetails.qualityBreakdown.faceSize)} detail={metricDescriptions.faceSize} />
              <MetricValue label="배경 밝기" value={featureValue(photoData.measurementDetails.lightingCalibration.backgroundBrightness)} detail={metricDescriptions.backgroundBrightness} />
              <MetricValue label="보정 강도" value={featureValue(photoData.measurementDetails.lightingCalibration.correctionStrength)} detail={metricDescriptions.correctionStrength} />
              <MetricValue label="보정 소스" value={photoData.measurementDetails.lightingCalibration.calibrationSource} detail={metricDescriptions.calibrationSource} />
              <MetricValue label="흰 종이 사용" value={photoData.measurementDetails.lightingCalibration.whiteReferenceUsed ? '예' : '아니오'} detail="예라면 오른쪽 아래 흰 종이 가이드 영역이 화이트 밸런스 기준으로 통과했다는 뜻입니다." />
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ResultDisplay({ result, photoData }: ResultDisplayProps) {
  useEffect(() => {
    if (result.confidence > 0.62) {
      confetti({
        particleCount: 120,
        spread: 68,
        origin: { y: 0.55 },
        colors: ['#ffffff', '#f3e7d0', '#cfe0f7', '#d6c8c3'],
      });
    }
  }, [result]);

  const topSeason = SEASON_DETAILS[result.seasonTop1Id];
  const secondSeason = SEASON_DETAILS[result.seasonTop2Id];
  const familyGuide = FAMILY_GUIDES[topSeason.family];
  const adjacentSeasons = topSeason.adjacent.map((id) => SEASON_DETAILS[id]);
  const fusionPhotoPercent = `${Math.round(result.evidence.fusionWeights.photo * 100)}%`;
  const fusionQuestionPercent = `${Math.round(result.evidence.fusionWeights.questionnaire * 100)}%`;
  const bestColors = result.palette.slice(0, 10);
  const similarColors = result.palette.slice(10, 16);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-20">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-5">
        <Badge variant="outline" className="rounded-full border-stone-200 bg-white px-4 py-1 text-stone-600">
          4계절 대분류 + 12계절 세부 진단
        </Badge>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-stone-950">
          {topSeason.title}
          <span className="block mt-3 font-serif text-2xl md:text-3xl font-normal italic text-stone-600">
            {FAMILY_LABELS[topSeason.family]} 계열 안에서 가장 잘 맞는 세부 시즌
          </span>
        </h1>
        <p className="text-sm font-medium text-stone-500">{topSeason.commonAliasSentence}</p>
        <p className="max-w-3xl mx-auto text-lg leading-relaxed text-stone-600">
          이 결과는 얼굴 색 샘플과 설문 반응을 함께 본 하이브리드 판정입니다. 4계절 대분류 위에 12계절 세부 구조를 올려서
          왜 {topSeason.title}로 해석되는지까지 자연스럽게 이해할 수 있도록 설명합니다.
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="border-stone-200 bg-white shadow-sm">
          <CardHeader className="border-b border-stone-200 bg-stone-50/80">
            <CardTitle className="flex items-center gap-2 text-stone-900">
              왜 이렇게 나왔나요?
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="flex flex-wrap gap-3">
              <Badge className={getSeasonToneClass(topSeason.family)}>{topSeason.title}</Badge>
              <Badge variant="outline" className="border-stone-200 text-stone-600">
                보통 {topSeason.commonAlias}
              </Badge>
              <Badge variant="outline" className="border-stone-200 text-stone-600">
                2순위 {secondSeason.title}
              </Badge>
            </div>

            <div className="space-y-4 text-stone-700 leading-relaxed">
              <p>{topSeason.summary}</p>
              <p>{topSeason.styling}</p>
              <p>{topSeason.whyItFits}</p>
              <p>{result.explanation}</p>
            </div>

            <Separator className="bg-stone-200" />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-5 space-y-3">
                <p className="text-sm font-semibold text-stone-900">4계절과 12계절의 관계</p>
                <p className="text-sm leading-relaxed text-stone-600">{PERSONAL_COLOR_MODEL_NOTE.overview}</p>
              </div>
              <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-5 space-y-3">
                <p className="text-sm font-semibold text-stone-900">현재 대분류 해석</p>
                <p className="text-sm text-stone-700">{familyGuide.title}</p>
                <p className="text-sm leading-relaxed text-stone-600">{familyGuide.summary}</p>
                <p className="text-xs text-stone-500">하위 계절: {familyGuide.seasons}</p>
                <p className="text-xs text-stone-500">영문 표기: {topSeason.englishNames.join(' / ')}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-5 space-y-3">
              <p className="text-sm font-semibold text-stone-900">인접 계절 개념</p>
              <p className="text-sm leading-relaxed text-stone-600">{PERSONAL_COLOR_MODEL_NOTE.adjacency}</p>
              <div className="flex flex-wrap gap-2">
                {adjacentSeasons.map((season) => (
                  <Badge key={season.title} variant="outline" className="border-stone-200 bg-white text-stone-700">
                    {season.title}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-200 bg-white shadow-sm">
          <CardHeader className="border-b border-stone-200 bg-stone-50/80">
            <CardTitle className="flex items-center gap-2 text-stone-900">
              근거 요약
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-500">사진 신호</p>
              <p className="font-semibold text-stone-900">
                {result.evidence.photoSignal.temperature} / {SEASON_DETAILS[result.evidence.photoSignal.dominantSeasonId].title}
              </p>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-500">설문 신호</p>
              <p className="font-semibold text-stone-900">
                {result.evidence.questionSignal.temperature} / {result.evidence.questionSignal.clarity}
              </p>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-500">하이브리드 비율</p>
              <p className="font-semibold text-stone-900">사진 {fusionPhotoPercent} / 설문 {fusionQuestionPercent}</p>
              <p className="text-sm text-stone-600">{result.evidence.boundary.note}</p>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-500">추천 특징</p>
              <p className="text-sm text-stone-700">온도감: {result.recommendationFeatures.preferredTemperature}</p>
              <p className="text-sm text-stone-700">선명도: {result.recommendationFeatures.preferredClarity}</p>
              <p className="text-sm text-stone-700">명도: {result.recommendationFeatures.preferredLightness}</p>
              <p className="text-sm text-stone-700">대비감: {result.recommendationFeatures.contrastLevel}</p>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white p-4">
              <p className="font-semibold text-stone-900">보통 이렇게도 불러요</p>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {topSeason.title}은 실무나 상담 현장에서 <span className="font-medium text-stone-900">{topSeason.commonAlias}</span>처럼 부르는 경우도 많습니다.
                기존 12계절 결과는 유지하면서, 익숙한 표현으로도 함께 이해할 수 있도록 표시했습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-stone-200 bg-white shadow-sm">
          <CardHeader className="border-b border-stone-200 bg-stone-50/80">
            <CardTitle className="text-stone-900">잘 어울리는 색상</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <p className="text-sm leading-relaxed text-stone-600">{topSeason.bestColorDescription}</p>
            <ColorChipGrid colors={bestColors} />

            <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-5 space-y-3">
              <p className="text-sm font-semibold text-stone-900">톤이 유사한 보조 활용 색상</p>
              <p className="text-sm leading-relaxed text-stone-600">
                꼭 베스트 컬러만 사용할 필요는 없습니다. 같은 시즌 안에서 톤이 비슷한 색을 함께 쓰면 훨씬 자연스럽고 활용 범위도 넓어집니다.
              </p>
              <ColorChipGrid colors={similarColors} columns="grid-cols-3 md:grid-cols-6" />
            </div>

            <div className="rounded-3xl border border-rose-100 bg-rose-50/80 p-5 space-y-3">
              <div className="flex items-center gap-2 text-rose-900">
                <AlertTriangle className="w-4 h-4" />
                <p className="text-sm font-semibold">피해야 하는 색상</p>
              </div>
              <p className="text-sm leading-relaxed text-rose-800">{topSeason.worstColorsDescription}</p>
              <ColorChipGrid colors={topSeason.worstColors} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-200 bg-white shadow-sm">
          <CardHeader className="border-b border-stone-200 bg-stone-50/80">
            <CardTitle className="text-stone-900">색상 해석 프레임</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-4">
              <p className="font-semibold text-stone-900">HSV 3축 이해</p>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{PERSONAL_COLOR_MODEL_NOTE.hsv}</p>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-4">
              <p className="font-semibold text-stone-900">현재 결과에서 중요한 포인트</p>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                지금 결과는 얼굴 샘플 색과 팔레트 거리, 그리고 설문에서 드러난 온도감, 선명도, 명도, 대비 반응을 같이 비교해
                나온 값입니다. 그래서 단순히 웜/쿨 하나만 보는 것이 아니라, 같은 계열 안에서도 왜 더 밝은 축인지, 더 부드러운
                축인지까지 함께 해석할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-stone-200 bg-white shadow-sm">
        <CardHeader className="border-b border-stone-200 bg-stone-50/80">
          <CardTitle className="flex items-center gap-2 text-stone-900">
            <Info className="w-4 h-4 text-stone-500" />
            측정값 상세 보기
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 flex flex-wrap gap-3">
          <DeveloperModeDialog result={result} photoData={photoData} />
          <Dialog>
            <DialogTrigger
              render={
                <Button variant="outline" className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100">
                  <Ruler className="w-4 h-4 mr-2" />
                  측정 데이터 열기
                </Button>
              }
            />
            <DialogContent className="max-w-5xl border-stone-200 bg-white p-0 overflow-hidden" showCloseButton>
              <DialogHeader className="p-6 border-b border-stone-200 bg-stone-50/80">
                <DialogTitle className="text-stone-900">측정 데이터 상세</DialogTitle>
                <DialogDescription className="text-stone-600">
                  얼굴 박스, ROI 좌표, RGB/LAB/HSL 값, 사진 품질 점수와 상위 시즌 점수를 함께 확인할 수 있습니다.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="border-stone-200 bg-stone-50/70">
                    <CardHeader>
                      <CardTitle className="text-sm text-stone-900">얼굴 박스</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-stone-700">
                      <p>X: {photoData.measurementDetails.faceBounds.x}px</p>
                      <p>Y: {photoData.measurementDetails.faceBounds.y}px</p>
                      <p>Width: {photoData.measurementDetails.faceBounds.width}px</p>
                      <p>Height: {photoData.measurementDetails.faceBounds.height}px</p>
                    </CardContent>
                  </Card>

                  <Card className="border-stone-200 bg-stone-50/70">
                    <CardHeader>
                      <CardTitle className="text-sm text-stone-900">정규화 특징 벡터</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-stone-700">
                      <p>temperature: {featureValue(photoData.measurementDetails.normalizedFeatures.temperature)}</p>
                      <p>lightness: {featureValue(photoData.measurementDetails.normalizedFeatures.lightness)}</p>
                      <p>clarity: {featureValue(photoData.measurementDetails.normalizedFeatures.clarity)}</p>
                      <p>contrast: {featureValue(photoData.measurementDetails.normalizedFeatures.contrast)}</p>
                      <p>mutedScore: {featureValue(photoData.measurementDetails.normalizedFeatures.mutedScore)}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-stone-200 bg-stone-50/70">
                  <CardHeader>
                    <CardTitle className="text-sm text-stone-900">사진 품질 점수</CardTitle>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-3 gap-4 text-sm text-stone-700">
                    <p>overall: {featureValue(photoData.measurementDetails.qualityBreakdown.overall)}</p>
                    <p>exposure: {featureValue(photoData.measurementDetails.qualityBreakdown.exposure)}</p>
                    <p>symmetry: {featureValue(photoData.measurementDetails.qualityBreakdown.symmetry)}</p>
                    <p>distinctness: {featureValue(photoData.measurementDetails.qualityBreakdown.distinctness)}</p>
                    <p>faceSize: {featureValue(photoData.measurementDetails.qualityBreakdown.faceSize)}</p>
                    <p>background: {featureValue(photoData.measurementDetails.qualityBreakdown.background)}</p>
                  </CardContent>
                </Card>

                <Card className="border-stone-200 bg-stone-50/70">
                  <CardHeader>
                    <CardTitle className="text-sm text-stone-900">조명 보정과 분포 특징</CardTitle>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-3 gap-4 text-sm text-stone-700">
                    <p>bgBrightness: {featureValue(photoData.measurementDetails.lightingCalibration.backgroundBrightness)}</p>
                    <p>bgNeutrality: {featureValue(photoData.measurementDetails.lightingCalibration.backgroundNeutrality)}</p>
                    <p>correction: {featureValue(photoData.measurementDetails.lightingCalibration.correctionStrength)}</p>
                    <p>source: {photoData.measurementDetails.lightingCalibration.calibrationSource}</p>
                    <p>whiteRef: {photoData.measurementDetails.lightingCalibration.whiteReferenceUsed ? 'used' : 'fallback'}</p>
                    <p>distOverall: {featureValue(photoData.measurementDetails.distributionBreakdown.overall)}</p>
                    <p>distSkin: {featureValue(photoData.measurementDetails.distributionBreakdown.skin)}</p>
                    <p>distHair: {featureValue(photoData.measurementDetails.distributionBreakdown.hair)}</p>
                    <p>distEyes: {featureValue(photoData.measurementDetails.distributionBreakdown.eyes)}</p>
                    <p>distLips: {featureValue(photoData.measurementDetails.distributionBreakdown.lips)}</p>
                    <p>whiteBg: {photoData.measurementDetails.lightingCalibration.whiteBackdropRecommended ? '권장' : '양호'}</p>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <h4 className="font-semibold text-stone-900">ROI별 색상 측정값</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    {photoData.measurementDetails.roiMeasurements.map((item) => (
                      <React.Fragment key={item.label}>
                        <MeasurementCard item={item} />
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <Card className="border-stone-200 bg-stone-50/70">
                  <CardHeader>
                    <CardTitle className="text-sm text-stone-900">상위 시즌 점수</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {photoData.measurementDetails.topSeasonScores.map((item) => (
                      <div key={item.seasonId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm text-stone-700">
                          <span>{item.seasonName}</span>
                          <span>{item.score.toFixed(2)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
                          <div className="h-full rounded-full bg-stone-900" style={{ width: `${Math.min(100, item.score)}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
