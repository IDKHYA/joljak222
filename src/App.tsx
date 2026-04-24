import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Camera, ClipboardList, Palette, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PhotoAnalyzer from './components/PhotoAnalyzer';
import Questionnaire from './components/Questionnaire';
import ResultDisplay from './components/ResultDisplay';
import { FinalResult, PhotoAnalysisResult, QuestionnaireScores } from './types';
import { fuseResults } from './services/geminiService';

type AppStep = 'intro' | 'photo' | 'questionnaire' | 'fusing' | 'result';

export default function App() {
  const [step, setStep] = useState<AppStep>('intro');
  const [photoData, setPhotoData] = useState<PhotoAnalysisResult | null>(null);
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoComplete = (result: PhotoAnalysisResult) => {
    setPhotoData(result);
    setError(null);
    setStep('questionnaire');
  };

  const handleQuestionnaireComplete = async (scores: QuestionnaireScores, responses: Record<string, string>) => {
    if (!photoData) {
      setError('사진 분석 데이터가 없습니다. 먼저 얼굴 사진을 촬영한 뒤 다시 진행해 주세요.');
      setStep('photo');
      return;
    }

    setError(null);
    setStep('fusing');

    try {
      const result = await Promise.resolve(fuseResults(photoData, scores, responses));
      setFinalResult(result);
      setStep('result');
    } catch (caughtError) {
      console.error(caughtError);
      setError('결과를 정리하는 중 문제가 발생했습니다. 설문 단계부터 다시 진행해 주세요.');
      setStep('questionnaire');
    }
  };

  const reset = () => {
    setStep('intro');
    setPhotoData(null);
    setFinalResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffdf8_0%,#f8f5ef_48%,#f3efe7_100%)] text-stone-900 selection:bg-stone-900 selection:text-stone-50">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,#ffffff_0%,transparent_52%),linear-gradient(to_right,rgba(120,113,108,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,113,108,0.06)_1px,transparent_1px)] bg-[size:auto,4rem_4rem,4rem_4rem]" />

      <header className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <button type="button" onClick={reset} className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-2xl bg-stone-900 text-white flex items-center justify-center shadow-sm">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Personal Color</p>
            <p className="text-xl font-semibold tracking-tight">퍼스널컬러 진단 워크북</p>
          </div>
        </button>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-4 py-2 text-[11px] font-medium text-stone-500 shadow-sm backdrop-blur">
            <span className={step === 'photo' ? 'text-stone-900' : ''}>사진</span>
            <span>/</span>
            <span className={step === 'questionnaire' ? 'text-stone-900' : ''}>설문</span>
            <span>/</span>
            <span className={step === 'result' ? 'text-stone-900' : ''}>결과</span>
          </div>
          {step !== 'intro' && (
            <Button variant="ghost" size="sm" onClick={reset} className="text-stone-600 hover:bg-white/80 hover:text-stone-900">
              <RefreshCw className="w-4 h-4 mr-2" />
              처음부터
            </Button>
          )}
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-8 md:pt-14 pb-16">
        {error && (
          <div className="max-w-3xl mx-auto mb-8">
            <Alert className="border-red-200 bg-red-50 text-red-900">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>진행 중 오류가 발생했습니다</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto text-center space-y-12"
            >
              <div className="space-y-6">
                <p className="text-sm uppercase tracking-[0.45em] text-stone-500">Face Sampling + Workbook Matching</p>
                <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[0.94] text-stone-950">
                  얼굴 색과 질문 응답을 함께 보는
                  <span className="block font-serif italic font-normal text-stone-700">12계절 퍼스널컬러 분석</span>
                </h1>
                <p className="text-lg md:text-xl text-stone-600 leading-relaxed max-w-3xl mx-auto">
                  얼굴 사진에서 피부, 머리, 눈, 입술 색을 추출하고, 설문으로 온도감과 선명도, 명도, 대비를 함께 확인해
                  12계절 퍼스널컬러를 해석합니다. 질문마다 실제 색감을 보여줘서 선택 기준도 더 직관적으로 이해할 수 있도록
                  구성했습니다.
                </p>
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={() => {
                    setError(null);
                    setStep('photo');
                  }}
                  className="rounded-full bg-stone-900 px-10 py-8 text-lg font-medium text-white hover:bg-stone-700"
                >
                  진단 시작하기
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                {[
                  {
                    icon: Camera,
                    title: '얼굴 색 추출',
                    desc: 'MediaPipe 랜드마크를 바탕으로 볼, 이마, 눈가, 턱선, 홍채, 눈썹, 입술, 헤어라인의 색을 정량화합니다.',
                  },
                  {
                    icon: ClipboardList,
                    title: '이해되는 설문',
                    desc: '흰색, 선명한 색, 뮤트 컬러처럼 실제 색 샘플을 함께 보여주어 질문 의도를 눈으로 확인할 수 있습니다.',
                  },
                  {
                    icon: Sparkles,
                    title: '12계절 결과 해석',
                    desc: '4계절 대분류와 12계절 세부 분류의 관계, 인접 시즌, 추천 팔레트까지 결과 화면에서 함께 설명합니다.',
                  },
                ].map((item) => (
                  <Card key={item.title} className="border-stone-200 bg-white/80 shadow-sm backdrop-blur">
                    <CardContent className="p-6 text-left space-y-4">
                      <item.icon className="w-6 h-6 text-stone-500" />
                      <div className="space-y-2">
                        <h3 className="text-stone-900 font-semibold">{item.title}</h3>
                        <p className="text-sm leading-relaxed text-stone-600">{item.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'photo' && (
            <motion.div key="photo" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }}>
              <PhotoAnalyzer onAnalysisComplete={handlePhotoComplete} />
            </motion.div>
          )}

          {step === 'questionnaire' && (
            <motion.div key="questionnaire" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <Questionnaire onComplete={handleQuestionnaireComplete} />
            </motion.div>
          )}

          {step === 'fusing' && (
            <motion.div key="fusing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-28 space-y-8">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border border-stone-300 animate-ping opacity-40" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="w-10 h-10 text-stone-600 animate-spin" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-stone-900">사진과 설문을 함께 정리하고 있습니다</h2>
                <p className="text-sm uppercase tracking-[0.35em] text-stone-500">Hybrid Workbook Engine</p>
              </div>
            </motion.div>
          )}

          {step === 'result' && finalResult && photoData && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ResultDisplay result={finalResult} photoData={photoData} />
              <div className="flex justify-center mt-12">
                <Button variant="outline" onClick={reset} className="rounded-full border-stone-300 bg-white px-8 py-6 text-stone-700 hover:bg-stone-100">
                  다시 분석하기
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
