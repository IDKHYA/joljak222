import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { AlertTriangle, CheckCircle2, Info, Palette, Ruler, Sparkles } from 'lucide-react';
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

const confidencePercent = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
const featureValue = (value: number) => value.toFixed(4);

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
        </div>
        <div>
          <p className="mb-1 text-stone-500">LAB</p>
          <p>{item.lab.l.toFixed(2)}, {item.lab.a.toFixed(2)}, {item.lab.b.toFixed(2)}</p>
        </div>
        <div>
          <p className="mb-1 text-stone-500">HSL</p>
          <p>{item.hsl.h.toFixed(1)}°, {item.hsl.s.toFixed(1)}%, {item.hsl.l.toFixed(1)}%</p>
        </div>
        <div>
          <p className="mb-1 text-stone-500">ROI</p>
          <p>{item.region.x}, {item.region.y}, {item.region.width} x {item.region.height}</p>
        </div>
      </div>
      <p className="text-[11px] text-stone-500">{item.color}</p>
    </div>
  );
}

function getSeasonToneClass(family: keyof typeof FAMILY_GUIDES) {
  if (family === 'spring') return 'bg-amber-50 text-amber-900 border-amber-200';
  if (family === 'summer') return 'bg-sky-50 text-sky-900 border-sky-200';
  if (family === 'autumn') return 'bg-orange-50 text-orange-900 border-orange-200';
  return 'bg-violet-50 text-violet-900 border-violet-200';
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
  const consistencyLabel =
    result.evidence.consistency === 'high' ? '높음' : result.evidence.consistency === 'medium' ? '중간' : '낮음';
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
              <Sparkles className="w-4 h-4 text-stone-500" />
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
              <Badge variant="outline" className="border-stone-200 text-stone-600">
                신뢰도 {confidencePercent(result.confidence)}
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
              <Palette className="w-4 h-4 text-stone-500" />
              근거 요약
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-500">사진 신호</p>
              <p className="font-semibold text-stone-900">
                {result.evidence.photoSignal.temperature} / {SEASON_DETAILS[result.evidence.photoSignal.dominantSeasonId].title}
              </p>
              <p className="text-sm text-stone-600">신뢰도 {confidencePercent(result.evidence.photoSignal.confidence)}</p>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-500">설문 신호</p>
              <p className="font-semibold text-stone-900">
                {result.evidence.questionSignal.temperature} / {result.evidence.questionSignal.clarity}
              </p>
              <p className="text-sm text-stone-600">신뢰도 {confidencePercent(result.evidence.questionSignal.confidence)}</p>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-500">하이브리드 비율</p>
              <p className="font-semibold text-stone-900">사진 {fusionPhotoPercent} / 설문 {fusionQuestionPercent}</p>
              <p className="text-sm text-stone-600">{result.evidence.boundary.note}</p>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3">
              {result.evidence.consistency === 'high' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              )}
              <span className="text-sm text-stone-700">사진-설문 일치도: {consistencyLabel}</span>
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
                      <MeasurementCard key={item.label} item={item} />
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
