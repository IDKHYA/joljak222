// 수동 의류 등록 폼과 AI 누끼 처리 상태를 관리하는 훅입니다.
import React, { useRef, useState } from 'react';
import type { AvailabilityStatus, ClothingCategory, ClothingSegmentationMeta } from '../wardrobeTypes';
import { CUTOUT_VERSION, FINE_LABEL_TO_TYPE, PRECISION_TARGET_BY_CATEGORY, SIZES, TYPES } from '../wardrobeConstants';
import { dominantColorFromAnalysis } from '../services/clothingMeta';
import { getApiHealth, requestBackgroundRemoval, requestPrecisionExtraction, resizeImageFileForUpload } from '../services/clothingImageApi';

export function useManualClothing() {
  const [manual, setManual] = useState({
    imageUrl: '',
    originalImageUrl: '',
    cutoutImageUrl: '',
    imageFile: null as File | null,
    segmentation: null as ClothingSegmentationMeta | null,
    category: '상의' as ClothingCategory,
    type: '반팔티',
    color: '화이트',
    size: 'M',
    brand: '',
    seasonTag: '사계절',
    availabilityStatus: '보유중' as AvailabilityStatus,
    predictedSeasonTag: null as string | null,
    predictedMaterial: null as string | null,
    aiAnalyzed: false,
    aiConfidence: null as number | null,
  });
  const [backgroundRemoveStatus, setBackgroundRemoveStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [backgroundRemoveError, setBackgroundRemoveError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // 실패 메시지를 만든다. 서버가 꺼져 있으면 "연결 불가"로, 떠 있으면 실제 실패 사유로 안내해 사용자가 다음 행동을 알 수 있게 한다.
  const describeFailure = async (error: unknown, fallback: string) => {
    const online = await getApiHealth();
    if (!online) return 'AI 분석 서버에 연결할 수 없습니다. 직접 입력하거나, 서버 실행 후 다시 시도하세요.';
    return error instanceof Error ? error.message : fallback;
  };

  const autoAnalyzeOnUpload = async (file: File) => {
    setBackgroundRemoveStatus('processing');
    setBackgroundRemoveError('');
    let success = false;
    try {
      const resized = await resizeImageFileForUpload(file);
      const result = await requestPrecisionExtraction(resized, 'auto', file.name || 'clothing.jpg');
      const detectedColor = dominantColorFromAnalysis(result.colors);
      const categoryMap: Record<string, ClothingCategory> = { upper: '상의', lower: '하의', outer: '아우터', shoe: '신발', bag: '액세서리', accessory: '액세서리' };
      const detectedCat: ClothingCategory = (result.detectedCategory && categoryMap[result.detectedCategory]) || '상의';
      const firstMatchedType = result.fineLabels
        ?.map((label) => FINE_LABEL_TO_TYPE[label])
        .find((type) => type && TYPES[detectedCat].includes(type));
      const seasonTagFromAI = result.predictedSeason && result.predictedSeason !== '미분류' ? result.predictedSeason : '사계절';

      setManual((prev) => ({
        ...prev,
        imageUrl: result.imageDataUrl,
        cutoutImageUrl: result.imageDataUrl,
        color: detectedColor?.hex ?? prev.color,
        category: detectedCat,
        type: firstMatchedType ?? TYPES[detectedCat][0],
        seasonTag: seasonTagFromAI,
        segmentation: {
          width: result.width,
          height: result.height,
          bbox: result.bbox,
          colors: result.colors ?? [],
          model: result.model,
          version: result.version ?? 'fashion-segformer-v1',
          processedAt: result.processedAt,
        },
        predictedSeasonTag: result.predictedSeason ?? null,
        predictedMaterial: result.predictedMaterial ?? null,
        aiAnalyzed: true,
        aiConfidence: result.seasonConfidence ?? null,
      }));
      success = true;
    } catch (error) {
      setBackgroundRemoveError(await describeFailure(error, 'AI 분석에 실패했습니다. 직접 입력하거나 누끼 따기를 사용하세요.'));
    } finally {
      setBackgroundRemoveStatus(success ? 'done' : 'error');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setManual((prev) => ({ ...prev, imageUrl: objectUrl, originalImageUrl: objectUrl, cutoutImageUrl: '', imageFile: file, segmentation: null, aiAnalyzed: false, aiConfidence: null }));
    setBackgroundRemoveStatus('idle');
    setBackgroundRemoveError('');
    autoAnalyzeOnUpload(file);
  };

  const removeManualBackground = async () => {
    if (!manual.imageFile) {
      setBackgroundRemoveStatus('error');
      setBackgroundRemoveError('먼저 앨범에서 이미지를 선택하거나 사진을 찍어주세요.');
      return;
    }
    setBackgroundRemoveStatus('processing');
    setBackgroundRemoveError('');
    let success = false;
    try {
      const resized = await resizeImageFileForUpload(manual.imageFile);
      const result = await requestBackgroundRemoval(resized, manual.imageFile.name || 'clothing.jpg');
      const detectedColor = dominantColorFromAnalysis(result.colors);
      setManual((prev) => ({
        ...prev,
        imageUrl: result.imageDataUrl,
        cutoutImageUrl: result.imageDataUrl,
        color: detectedColor?.hex ?? prev.color,
        segmentation: {
          width: result.width,
          height: result.height,
          bbox: result.bbox,
          colors: result.colors ?? [],
          model: result.model,
          version: result.version ?? CUTOUT_VERSION,
          processedAt: result.processedAt,
        },
      }));
      success = true;
    } catch (error) {
      setBackgroundRemoveError(await describeFailure(error, '누끼 처리에 실패했습니다.'));
    } finally {
      setBackgroundRemoveStatus(success ? 'done' : 'error');
    }
  };

  const extractManualClothingPrecisely = async () => {
    if (!manual.imageFile) {
      setBackgroundRemoveStatus('error');
      setBackgroundRemoveError('먼저 앨범에서 이미지를 선택하거나 사진을 찍어주세요.');
      return;
    }
    setBackgroundRemoveStatus('processing');
    setBackgroundRemoveError('');
    let success = false;
    try {
      const resized = await resizeImageFileForUpload(manual.imageFile);
      const targetPart = PRECISION_TARGET_BY_CATEGORY[manual.category];
      const result = await requestPrecisionExtraction(resized, targetPart, manual.imageFile.name || 'clothing.jpg');
      const detectedColor = dominantColorFromAnalysis(result.colors);
      setManual((prev) => ({
        ...prev,
        imageUrl: result.imageDataUrl,
        cutoutImageUrl: result.imageDataUrl,
        color: detectedColor?.hex ?? prev.color,
        segmentation: {
          width: result.width,
          height: result.height,
          bbox: result.bbox,
          colors: result.colors ?? [],
          model: result.model,
          version: result.version ?? 'fashion-segformer-v1',
          processedAt: result.processedAt,
        },
        predictedSeasonTag: result.predictedSeason ?? null,
        predictedMaterial: result.predictedMaterial ?? null,
      }));
      success = true;
    } catch (error) {
      setBackgroundRemoveError(await describeFailure(error, '정밀 누끼 처리에 실패했습니다.'));
    } finally {
      setBackgroundRemoveStatus(success ? 'done' : 'error');
    }
  };

  const handleManualCategory = (category: ClothingCategory) => {
    const size = category === '하의' ? SIZES.bottoms[0] : category === '신발' ? SIZES.shoes[0] : SIZES.tops[1];
    setManual((prev) => ({ ...prev, category, type: TYPES[category][0], size }));
  };

  return {
    manual,
    setManual,
    fileInputRef,
    cameraInputRef,
    backgroundRemoveStatus,
    backgroundRemoveError,
    handleFileChange,
    removeManualBackground,
    extractManualClothingPrecisely,
    handleManualCategory,
  };
}
