// 퍼스널컬러 결과와 진단 이력을 localStorage와 함께 관리하는 훅입니다.
import { useEffect, useState } from 'react';
import { fuseResults } from '../services/personalColorEngine';
import type { FinalResult, PhotoAnalysisResult, QuestionnaireScores } from '../types';
import type { PersonalColorRecord } from '../wardrobeTypes';
import { STORAGE_KEYS } from '../wardrobeConstants';
import { loadJson, saveJson } from '../services/storage';

export function usePersonalColor() {
  const [photoData, setPhotoData] = useState<PhotoAnalysisResult | null>(null);
  const [personalColorResult, setPersonalColorResult] = useState<FinalResult | null>(() => loadJson<FinalResult | null>(STORAGE_KEYS.personalColor, null));
  const [personalColorHistory, setPersonalColorHistory] = useState<PersonalColorRecord[]>(() => loadJson<PersonalColorRecord[]>(STORAGE_KEYS.personalHistory, []));

  useEffect(() => {
    if (!personalColorResult || personalColorHistory.length > 0) return;
    const migrated = [{ id: `pc-${Date.now()}`, measuredAt: new Date().toISOString(), result: personalColorResult }];
    setPersonalColorHistory(migrated);
    saveJson(STORAGE_KEYS.personalHistory, migrated);
  }, [personalColorHistory.length, personalColorResult]);

  const completeQuestionnaire = (scores: QuestionnaireScores, rawResponses: Record<string, string>) => {
    if (!photoData) return null;
    const result = fuseResults(photoData, scores, rawResponses);
    const record = { id: `pc-${Date.now()}`, measuredAt: new Date().toISOString(), result };
    const nextHistory = [record, ...personalColorHistory].slice(0, 20);
    setPersonalColorResult(result);
    setPersonalColorHistory(nextHistory);
    saveJson(STORAGE_KEYS.personalColor, result);
    saveJson(STORAGE_KEYS.personalHistory, nextHistory);
    return result;
  };

  const applyPersonalColorRecord = (record: PersonalColorRecord) => {
    const nextHistory = [record, ...personalColorHistory.filter((entry) => entry.id !== record.id)].slice(0, 20);
    setPersonalColorResult(record.result);
    setPersonalColorHistory(nextHistory);
    saveJson(STORAGE_KEYS.personalColor, record.result);
    saveJson(STORAGE_KEYS.personalHistory, nextHistory);
  };

  const resetPersonalColor = () => {
    setPersonalColorResult(null);
    setPhotoData(null);
    localStorage.removeItem(STORAGE_KEYS.personalColor);
    setPersonalColorHistory([]);
    localStorage.removeItem(STORAGE_KEYS.personalHistory);
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
