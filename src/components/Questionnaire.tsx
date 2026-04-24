import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { QUESTIONS } from '@/src/constants';
import { QuestionnaireScores } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { calculateQuestionnaireScores } from '@/src/services/geminiService';

interface QuestionnaireProps {
  onComplete: (scores: QuestionnaireScores, rawResponses: Record<string, string>) => void;
}

function ColorSwatches({ swatches, caption }: { swatches?: string[]; caption?: string }) {
  if (!swatches?.length) return null;

  return (
    <div className="space-y-2 md:max-w-[260px]">
      <div className="flex gap-1.5 flex-wrap md:justify-end">
        {swatches.map((color) => (
          <span
            key={color}
            className="h-7 w-7 rounded-full border border-stone-200 shadow-inner"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        ))}
      </div>
      {caption && <p className="text-xs leading-relaxed text-stone-500 md:text-right">{caption}</p>}
    </div>
  );
}

export default function Questionnaire({ onComplete }: QuestionnaireProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});

  const currentQuestion = QUESTIONS[currentIndex];
  const progress = ((currentIndex + 1) / QUESTIONS.length) * 100;

  const handleSelect = (optionValue: string) => {
    const nextResponses = { ...responses, [currentQuestion.id]: optionValue };
    setResponses(nextResponses);

    if (currentIndex < QUESTIONS.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    onComplete(calculateQuestionnaireScores(nextResponses), nextResponses);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto overflow-hidden border-stone-200 bg-white/90 shadow-[0_20px_70px_rgba(120,113,108,0.12)] backdrop-blur">
      <CardHeader className="border-b border-stone-200 bg-stone-50/70">
        <div className="flex justify-between items-center mb-3">
          <CardTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-stone-900">
            <ClipboardList className="w-5 h-5 text-stone-500" />
            설문 진단
          </CardTitle>
          <span className="text-xs font-medium text-stone-500">
            {currentIndex + 1} / {QUESTIONS.length}
          </span>
        </div>
        <Progress value={progress} className="h-1 bg-stone-200" />
      </CardHeader>

      <CardContent className="p-8 md:p-10 min-h-[560px] flex flex-col justify-between">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Questionnaire Signal</p>
              <h3 className="text-3xl font-semibold leading-tight text-stone-900">{currentQuestion.text}</h3>
              {currentQuestion.helperText && <p className="text-base leading-relaxed text-stone-600">{currentQuestion.helperText}</p>}
            </div>

            <div className="grid gap-4">
              {currentQuestion.options.map((option) => {
                const selected = responses[currentQuestion.id] === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`group rounded-3xl border p-5 text-left transition-all ${
                      selected
                        ? 'border-stone-900 bg-stone-900 text-white shadow-lg'
                        : 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-2 md:max-w-[55%]">
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-semibold ${selected ? 'text-white' : 'text-stone-900'}`}>{option.label}</span>
                          <ChevronRight className={`w-4 h-4 ${selected ? 'text-white/80' : 'text-stone-400'} transition-transform group-hover:translate-x-1`} />
                        </div>
                        {option.description && (
                          <p className={`text-sm leading-relaxed ${selected ? 'text-stone-200' : 'text-stone-600'}`}>{option.description}</p>
                        )}
                      </div>
                      <ColorSwatches swatches={option.swatches} caption={option.swatchCaption} />
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex items-center justify-between border-t border-stone-200 pt-6">
          <Button
            variant="ghost"
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            이전
          </Button>

          <div className="flex gap-1.5">
            {QUESTIONS.map((question, index) => (
              <div
                key={question.id}
                className={`h-2 w-2 rounded-full ${
                  index === currentIndex ? 'bg-stone-900' : responses[question.id] ? 'bg-stone-400' : 'bg-stone-200'
                }`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
