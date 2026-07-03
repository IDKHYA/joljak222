// 퍼스널컬러 결과와 진단 이력을 저장소 어댑터와 함께 관리하는 훅입니다.
import { useEffect, useState } from 'react';
import { fuseResults } from '../services/personalColorEngine';
import type { FinalResult, PhotoAnalysisResult, QuestionnaireScores } from '../types';
import type { PersonalColorRecord } from '../wardrobeTypes';
import { getInitialPersonalColorState } from '../services/demoUserData';
import { localAppPersistence } from '../services/appPersistence';

const personalColorPersistence = localAppPersistence.personalColor;

export function usePersonalColor() {
  const [initialPersonalColorState] = useState(() =>
    getInitialPersonalColorState(
      personalColorPersistence.loadResult(),
      personalColorPersistence.loadHistory(),
    ),
  );
  const [photoData, setPhotoData] = useState<PhotoAnalysisResult | null>(null);
  const [personalColorResult, setPersonalColorResult] = useState<FinalResult | null>(() => initialPersonalColorState.result);
  const [personalColorHistory, setPersonalColorHistory] = useState<PersonalColorRecord[]>(() => initialPersonalColorState.history);

  useEffect(() => {
    if (!personalColorResult) return;
    personalColorPersistence.saveResult(personalColorResult);
    personalColorPersistence.saveHistory(personalColorHistory);
  }, [personalColorHistory.length, personalColorResult]);

  const completeQuestionnaire = (scores: QuestionnaireScores, rawResponses: Record<string, string>) => {
    if (!photoData) return null;
    const result = fuseResults(photoData, scores, rawResponses);
    const record = { id: `pc-${Date.now()}`, measuredAt: new Date().toISOString(), result };
    const nextHistory = [record, ...personalColorHistory].slice(0, 20);
    setPersonalColorResult(result);
    setPersonalColorHistory(nextHistory);
    personalColorPersistence.saveResult(result);
    personalColorPersistence.saveHistory(nextHistory);
    return result;
  };

  const applyPersonalColorRecord = (record: PersonalColorRecord) => {
    const nextHistory = [record, ...personalColorHistory.filter((entry) => entry.id !== record.id)].slice(0, 20);
    setPersonalColorResult(record.result);
    setPersonalColorHistory(nextHistory);
    personalColorPersistence.saveResult(record.result);
    personalColorPersistence.saveHistory(nextHistory);
  };

  const resetPersonalColor = () => {
    setPersonalColorResult(null);
    setPhotoData(null);
    setPersonalColorHistory([]);
    personalColorPersistence.clear();
  };

  return {
    photoData,
    setPhotoData,
    personalColorResult,
    personalColorHistory,
    completeQuestionnaire,
    applyPersonalColorRecord,
    resetPersonalColor,
  };
}
