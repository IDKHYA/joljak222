import React, { useEffect, useRef, useState } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { AlertCircle, Camera, RefreshCw, ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PhotoAnalysisResult } from '@/src/types';
import { detectFaceSnapshot, getFaceLandmarker } from '@/src/services/faceLandmarker';
import { analyzePhotoColors } from '@/src/services/geminiService';
import { clamp, deltaE, rgbToCss, rgbToHsl, rgbToLab } from '@/src/services/colorUtils';

interface PhotoAnalyzerProps {
  onAnalysisComplete: (result: PhotoAnalysisResult) => void;
}

interface SampleRegion {
  key:
    | 'skinLeft'
    | 'skinRight'
    | 'forehead'
    | 'noseLeft'
    | 'noseRight'
    | 'underEyeLeft'
    | 'underEyeRight'
    | 'jawLeft'
    | 'jawRight'
    | 'eyesLeft'
    | 'eyesRight'
    | 'lips'
    | 'hair'
    | 'eyebrowLeft'
    | 'eyebrowRight';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SampleStatistics {
  average: { r: number; g: number; b: number };
  trimmed: { r: number; g: number; b: number };
  variability: number;
}

interface BackgroundCalibration {
  gains: { r: number; g: number; b: number };
  brightness: number;
  neutrality: number;
  correctionStrength: number;
}

interface LiveDetectionState {
  landmarks: NormalizedLandmark[];
  faceBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  sampleRegions: SampleRegion[];
}

const ANALYSIS_STEPS = [
  '카메라 프레임을 고정하는 중',
  '얼굴 랜드마크를 검출하는 중',
  '볼, 눈, 입술, 헤어라인 주변을 샘플링하는 중',
  '엑셀 팔레트와 거리 비교를 계산하는 중',
];

const LEFT_IRIS_INDICES = [468, 469, 470, 471, 472];
const RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477];
const LEFT_EYEBROW_INDICES = [70, 63, 105];
const RIGHT_EYEBROW_INDICES = [336, 296, 334];
const FOREHEAD_INDICES = [10, 9, 151];
const LEFT_NOSE_INDICES = [129, 98, 49];
const RIGHT_NOSE_INDICES = [358, 327, 279];
const LEFT_UNDER_EYE_INDICES = [117, 118, 119];
const RIGHT_UNDER_EYE_INDICES = [346, 347, 348];
const LEFT_JAW_INDICES = [172, 136, 150];
const RIGHT_JAW_INDICES = [397, 365, 379];

export default function PhotoAnalyzer({ onAnalysisComplete }: PhotoAnalyzerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectInFlightRef = useRef(false);
  const lastDetectTimeRef = useRef(0);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState(ANALYSIS_STEPS[0]);
  const [isModelReady, setIsModelReady] = useState(false);
  const [liveDetection, setLiveDetection] = useState<LiveDetectionState | null>(null);

  useEffect(() => {
    void startCamera();
    void getFaceLandmarker()
      .then(() => setIsModelReady(true))
      .catch(() => {
        setError('얼굴 랜드마크 모델을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.');
      });

    return () => {
      stopCamera();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isCameraReady || capturedImage || isAnalyzing || !isModelReady) {
      clearOverlay();
      return;
    }

    const loop = (time: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (!videoRef.current || detectInFlightRef.current) return;
      if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) return;
      if (time - lastDetectTimeRef.current < 120) return;

      lastDetectTimeRef.current = time;
      detectInFlightRef.current = true;

      void detectFaceSnapshot(videoRef.current, time)
        .then((snapshot) => {
          if (!videoRef.current || !overlayCanvasRef.current) return;

          if (!snapshot) {
            setLiveDetection(null);
            clearOverlay();
            return;
          }

          const width = videoRef.current.videoWidth || videoRef.current.clientWidth;
          const height = videoRef.current.videoHeight || videoRef.current.clientHeight;
          const sampleRegions = buildSampleRegions(snapshot.landmarks, width, height, snapshot.bounds.width * width, snapshot.bounds.height * height);

          const detectionState: LiveDetectionState = {
            landmarks: snapshot.landmarks,
            faceBounds: {
              x: snapshot.bounds.minX * width,
              y: snapshot.bounds.minY * height,
              width: snapshot.bounds.width * width,
              height: snapshot.bounds.height * height,
            },
            sampleRegions,
          };

          setLiveDetection(detectionState);
          drawOverlay(detectionState, width, height);
        })
        .catch(() => {
          setLiveDetection(null);
          clearOverlay();
        })
        .finally(() => {
          detectInFlightRef.current = false;
        });
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      clearOverlay();
    };
  }, [capturedImage, isAnalyzing, isCameraReady, isModelReady]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraReady(false);
    setLiveDetection(null);
  };

  const startCamera = async () => {
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve) => {
          const video = videoRef.current;
          if (!video) {
            resolve();
            return;
          }

          if (video.readyState >= 1) {
            resolve();
            return;
          }

          const handleLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            resolve();
          };

          video.addEventListener('loadedmetadata', handleLoadedMetadata);
        });
        await videoRef.current.play().catch(() => undefined);
      }
      setCapturedImage(null);
      setError(null);
      setIsCameraReady(true);
    } catch {
      setError('카메라에 접근할 수 없습니다. 브라우저 권한을 허용한 뒤, 가능하면 밝은 흰 배경 앞에서 다시 시도해주세요.');
    }
  };

  const clearOverlay = () => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const context = overlay.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, overlay.width, overlay.height);
  };

  const syncOverlaySize = (width: number, height: number) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    if (overlay.width !== width || overlay.height !== height) {
      overlay.width = width;
      overlay.height = height;
    }
  };

  const landmarkPoint = (landmarks: NormalizedLandmark[], index: number, width: number, height: number) => ({
    x: landmarks[index].x * width,
    y: landmarks[index].y * height,
  });

  const averagePoint = (landmarks: NormalizedLandmark[], indices: number[], width: number, height: number) => {
    const points = indices.map((index) => landmarkPoint(landmarks, index, width, height));
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  };

  const buildSampleRegions = (
    landmarks: NormalizedLandmark[],
    width: number,
    height: number,
    faceWidth: number,
    faceHeight: number,
  ): SampleRegion[] => {
    const leftCheek = landmarkPoint(landmarks, 205, width, height);
    const rightCheek = landmarkPoint(landmarks, 425, width, height);
    const leftIris = averagePoint(landmarks, LEFT_IRIS_INDICES, width, height);
    const rightIris = averagePoint(landmarks, RIGHT_IRIS_INDICES, width, height);
    const leftEyebrow = averagePoint(landmarks, LEFT_EYEBROW_INDICES, width, height);
    const rightEyebrow = averagePoint(landmarks, RIGHT_EYEBROW_INDICES, width, height);
    const foreheadCenter = averagePoint(landmarks, FOREHEAD_INDICES, width, height);
    const leftNose = averagePoint(landmarks, LEFT_NOSE_INDICES, width, height);
    const rightNose = averagePoint(landmarks, RIGHT_NOSE_INDICES, width, height);
    const leftUnderEye = averagePoint(landmarks, LEFT_UNDER_EYE_INDICES, width, height);
    const rightUnderEye = averagePoint(landmarks, RIGHT_UNDER_EYE_INDICES, width, height);
    const leftJaw = averagePoint(landmarks, LEFT_JAW_INDICES, width, height);
    const rightJaw = averagePoint(landmarks, RIGHT_JAW_INDICES, width, height);
    const lipsCenter = averagePoint(landmarks, [13, 14, 78, 308], width, height);
    const forehead = landmarkPoint(landmarks, 10, width, height);

    const region = (key: SampleRegion['key'], label: string, centerX: number, centerY: number, regionWidth: number, regionHeight: number): SampleRegion => ({
      key,
      label,
      x: clamp(centerX - regionWidth / 2, 0, width - 1),
      y: clamp(centerY - regionHeight / 2, 0, height - 1),
      width: Math.max(1, Math.min(regionWidth, width)),
      height: Math.max(1, Math.min(regionHeight, height)),
    });

    return [
      region('underEyeLeft', '왼쪽 눈가', leftUnderEye.x, leftUnderEye.y, faceWidth * 0.11, faceHeight * 0.06),
      region('underEyeRight', '오른쪽 눈가', rightUnderEye.x, rightUnderEye.y, faceWidth * 0.11, faceHeight * 0.06),
      region('jawLeft', '왼쪽 턱선', leftJaw.x, leftJaw.y, faceWidth * 0.12, faceHeight * 0.07),
      region('jawRight', '오른쪽 턱선', rightJaw.x, rightJaw.y, faceWidth * 0.12, faceHeight * 0.07),
      region('skinLeft', '왼쪽 볼', leftCheek.x, leftCheek.y, faceWidth * 0.14, faceHeight * 0.1),
      region('skinRight', '오른쪽 볼', rightCheek.x, rightCheek.y, faceWidth * 0.14, faceHeight * 0.1),
      region('forehead', '이마 중심', foreheadCenter.x, foreheadCenter.y + faceHeight * 0.03, faceWidth * 0.12, faceHeight * 0.07),
      region('noseLeft', '코 왼쪽', leftNose.x, leftNose.y, faceWidth * 0.08, faceHeight * 0.08),
      region('noseRight', '코 오른쪽', rightNose.x, rightNose.y, faceWidth * 0.08, faceHeight * 0.08),
      region('eyesLeft', '왼쪽 눈동자', leftIris.x, leftIris.y, faceWidth * 0.06, faceHeight * 0.05),
      region('eyesRight', '오른쪽 눈동자', rightIris.x, rightIris.y, faceWidth * 0.06, faceHeight * 0.05),
      region('eyebrowLeft', '왼쪽 눈썹', leftEyebrow.x, leftEyebrow.y, faceWidth * 0.1, faceHeight * 0.05),
      region('eyebrowRight', '오른쪽 눈썹', rightEyebrow.x, rightEyebrow.y, faceWidth * 0.1, faceHeight * 0.05),
      region('lips', '입술 중심', lipsCenter.x, lipsCenter.y, faceWidth * 0.14, faceHeight * 0.06),
      region('hair', '헤어라인', forehead.x, clamp(forehead.y - faceHeight * 0.12, faceHeight * 0.04, height - 1), faceWidth * 0.18, faceHeight * 0.08),
    ];
  };

  const drawOverlay = (detectionState: LiveDetectionState, width: number, height: number) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;

    syncOverlaySize(width, height);
    const context = overlay.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, width, height);

    context.strokeStyle = 'rgba(96, 165, 250, 0.9)';
    context.lineWidth = 2;
    context.strokeRect(detectionState.faceBounds.x, detectionState.faceBounds.y, detectionState.faceBounds.width, detectionState.faceBounds.height);

    context.fillStyle = 'rgba(96, 165, 250, 0.8)';
    for (const landmark of detectionState.landmarks) {
      context.beginPath();
      context.arc(landmark.x * width, landmark.y * height, 1.4, 0, Math.PI * 2);
      context.fill();
    }

    for (const region of detectionState.sampleRegions) {
      context.strokeStyle = 'rgba(244, 244, 245, 0.9)';
      context.lineWidth = 1.2;
      context.strokeRect(region.x, region.y, region.width, region.height);
      context.fillStyle = 'rgba(9, 9, 11, 0.75)';
      context.fillRect(region.x, Math.max(0, region.y - 18), 64, 16);
      context.fillStyle = 'rgba(244, 244, 245, 0.95)';
      context.font = '10px ui-monospace, monospace';
      context.fillText(region.label, region.x + 4, Math.max(10, region.y - 6));
    }
  };

  const sampleRegion = (context: CanvasRenderingContext2D, region: SampleRegion): SampleStatistics => {
    const x = Math.round(region.x);
    const y = Math.round(region.y);
    const w = Math.max(1, Math.round(region.width));
    const h = Math.max(1, Math.round(region.height));
    const data = context.getImageData(x, y, w, h).data;

    const pixels: Array<{ r: number; g: number; b: number }> = [];

    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] < 180) continue;
      pixels.push({ r: data[index], g: data[index + 1], b: data[index + 2] });
    }

    if (pixels.length === 0) {
      return {
        average: { r: 0, g: 0, b: 0 },
        trimmed: { r: 0, g: 0, b: 0 },
        variability: 0,
      };
    }

    const average = pixels.reduce(
      (sum, pixel) => ({ r: sum.r + pixel.r, g: sum.g + pixel.g, b: sum.b + pixel.b }),
      { r: 0, g: 0, b: 0 },
    );
    const averageColor = {
      r: average.r / pixels.length,
      g: average.g / pixels.length,
      b: average.b / pixels.length,
    };

    const sortedByLuminance = [...pixels].sort(
      (left, right) =>
        left.r * 0.2126 + left.g * 0.7152 + left.b * 0.0722 - (right.r * 0.2126 + right.g * 0.7152 + right.b * 0.0722),
    );
    const trimStart = Math.floor(sortedByLuminance.length * 0.15);
    const trimEnd = Math.max(trimStart + 1, Math.ceil(sortedByLuminance.length * 0.85));
    const trimmedPixels = sortedByLuminance.slice(trimStart, trimEnd);
    const trimmed = trimmedPixels.reduce(
      (sum, pixel) => ({ r: sum.r + pixel.r, g: sum.g + pixel.g, b: sum.b + pixel.b }),
      { r: 0, g: 0, b: 0 },
    );
    const trimmedColor = {
      r: trimmed.r / trimmedPixels.length,
      g: trimmed.g / trimmedPixels.length,
      b: trimmed.b / trimmedPixels.length,
    };

    const variability =
      trimmedPixels.reduce((sum, pixel) => {
        const delta =
          ((pixel.r - trimmedColor.r) ** 2 + (pixel.g - trimmedColor.g) ** 2 + (pixel.b - trimmedColor.b) ** 2) / 3;
        return sum + delta;
      }, 0) / trimmedPixels.length;

    return {
      average: averageColor,
      trimmed: trimmedColor,
      variability: Math.sqrt(variability),
    };
  };

  const sampleBackgroundCalibration = (context: CanvasRenderingContext2D, width: number, height: number): BackgroundCalibration => {
    const patches = [
      { x: 0, y: 0, width: width * 0.12, height: height * 0.12 },
      { x: width * 0.88, y: 0, width: width * 0.12, height: height * 0.12 },
      { x: 0, y: height * 0.88, width: width * 0.12, height: height * 0.12 },
      { x: width * 0.88, y: height * 0.88, width: width * 0.12, height: height * 0.12 },
    ];

    const samples = patches.map((patch, index) =>
      sampleRegion(context, {
        key: index % 2 === 0 ? 'skinLeft' : 'skinRight',
        label: '배경',
        x: patch.x,
        y: patch.y,
        width: patch.width,
        height: patch.height,
      }).trimmed,
    );

    const background = samples.reduce(
      (sum, sample) => ({ r: sum.r + sample.r, g: sum.g + sample.g, b: sum.b + sample.b }),
      { r: 0, g: 0, b: 0 },
    );
    const average = {
      r: background.r / samples.length,
      g: background.g / samples.length,
      b: background.b / samples.length,
    };
    const brightness = (average.r * 0.2126 + average.g * 0.7152 + average.b * 0.0722) / 255;
    const channelSpread = Math.max(average.r, average.g, average.b) - Math.min(average.r, average.g, average.b);
    const neutrality = clamp(1 - channelSpread / 70, 0, 1);
    const correctionStrength = clamp(((brightness - 0.55) / 0.35) * neutrality, 0, 1);
    const gray = (average.r + average.g + average.b) / 3;

    return {
      gains: {
        r: clamp(1 + ((gray / Math.max(1, average.r)) - 1) * correctionStrength * 0.65, 0.88, 1.12),
        g: clamp(1 + ((gray / Math.max(1, average.g)) - 1) * correctionStrength * 0.65, 0.88, 1.12),
        b: clamp(1 + ((gray / Math.max(1, average.b)) - 1) * correctionStrength * 0.65, 0.88, 1.12),
      },
      brightness,
      neutrality,
      correctionStrength,
    };
  };

  const applyCalibration = (color: { r: number; g: number; b: number }, calibration: BackgroundCalibration) => ({
    r: clamp(color.r * calibration.gains.r, 0, 255),
    g: clamp(color.g * calibration.gains.g, 0, 255),
    b: clamp(color.b * calibration.gains.b, 0, 255),
  });

  const calculatePhotoQuality = (
    leftSkin: { r: number; g: number; b: number },
    rightSkin: { r: number; g: number; b: number },
    hair: { r: number; g: number; b: number },
    eyes: { r: number; g: number; b: number },
    lips: { r: number; g: number; b: number },
    faceWidth: number,
    frameWidth: number,
    background: BackgroundCalibration,
  ) => {
    const skinAverage = {
      r: (leftSkin.r + rightSkin.r) / 2,
      g: (leftSkin.g + rightSkin.g) / 2,
      b: (leftSkin.b + rightSkin.b) / 2,
    };

    const brightness = (skinAverage.r * 0.2126 + skinAverage.g * 0.7152 + skinAverage.b * 0.0722) / 255;
    const exposureScore = clamp(1 - Math.abs(brightness - 0.62) / 0.42, 0, 1);
    const symmetryScore = clamp(1 - deltaE(rgbToLab(leftSkin), rgbToLab(rightSkin)) / 28, 0, 1);
    const distinctness =
      (deltaE(rgbToLab(skinAverage), rgbToLab(hair)) +
        deltaE(rgbToLab(skinAverage), rgbToLab(eyes)) +
        deltaE(rgbToLab(skinAverage), rgbToLab(lips))) /
      3;
    const distinctnessScore = clamp(distinctness / 32, 0, 1);
    const sizeScore = clamp(faceWidth / (frameWidth * 0.42), 0, 1);
    const backgroundScore = clamp(background.brightness * 0.55 + background.neutrality * 0.45, 0, 1);

    return {
      overall: clamp(0.12 + exposureScore * 0.24 + symmetryScore * 0.18 + distinctnessScore * 0.18 + sizeScore * 0.12 + backgroundScore * 0.16, 0.35, 0.98),
      exposure: exposureScore,
      symmetry: symmetryScore,
      distinctness: distinctnessScore,
      faceSize: sizeScore,
      background: backgroundScore,
    };
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !captureCanvasRef.current) return;

    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || !video.videoWidth || !video.videoHeight) {
      setError('카메라 프레임을 아직 읽지 못했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    setCapturedImage(canvas.toDataURL('image/png'));
    stopCamera();
    setIsAnalyzing(true);
    setProgress(0);

    for (let index = 0; index < ANALYSIS_STEPS.length; index += 1) {
      setStatusMessage(ANALYSIS_STEPS[index]);
      await new Promise((resolve) => setTimeout(resolve, 180));
      setProgress(((index + 1) / ANALYSIS_STEPS.length) * 100);
    }

    const faceSnapshot = await detectFaceSnapshot(canvas, performance.now());
    if (!faceSnapshot) {
      setIsAnalyzing(false);
      setError('얼굴을 찾지 못했습니다. 얼굴을 정면으로 두고, 밝은 흰 배경 앞의 균일한 조명에서 다시 촬영해주세요.');
      return;
    }

    const faceWidth = faceSnapshot.bounds.width * canvas.width;
    const faceHeight = faceSnapshot.bounds.height * canvas.height;

    if (faceWidth < canvas.width * 0.18 || faceHeight < canvas.height * 0.22) {
      setIsAnalyzing(false);
      setError('얼굴이 너무 작게 인식되었습니다. 카메라에 조금 더 가까이 오고, 가능하면 밝은 흰 배경 앞에서 다시 촬영해주세요.');
      return;
    }

    const sampleRegions = buildSampleRegions(faceSnapshot.landmarks, canvas.width, canvas.height, faceWidth, faceHeight);
    const leftSkinRegion = sampleRegions.find((region) => region.key === 'skinLeft')!;
    const rightSkinRegion = sampleRegions.find((region) => region.key === 'skinRight')!;
    const foreheadRegion = sampleRegions.find((region) => region.key === 'forehead')!;
    const noseLeftRegion = sampleRegions.find((region) => region.key === 'noseLeft')!;
    const noseRightRegion = sampleRegions.find((region) => region.key === 'noseRight')!;
    const underEyeLeftRegion = sampleRegions.find((region) => region.key === 'underEyeLeft')!;
    const underEyeRightRegion = sampleRegions.find((region) => region.key === 'underEyeRight')!;
    const jawLeftRegion = sampleRegions.find((region) => region.key === 'jawLeft')!;
    const jawRightRegion = sampleRegions.find((region) => region.key === 'jawRight')!;
    const leftEyeRegion = sampleRegions.find((region) => region.key === 'eyesLeft')!;
    const rightEyeRegion = sampleRegions.find((region) => region.key === 'eyesRight')!;
    const leftEyebrowRegion = sampleRegions.find((region) => region.key === 'eyebrowLeft')!;
    const rightEyebrowRegion = sampleRegions.find((region) => region.key === 'eyebrowRight')!;
    const lipsRegion = sampleRegions.find((region) => region.key === 'lips')!;
    const hairRegion = sampleRegions.find((region) => region.key === 'hair')!;

    const backgroundCalibration = sampleBackgroundCalibration(context, canvas.width, canvas.height);

    const leftSkin = sampleRegion(context, leftSkinRegion);
    const rightSkin = sampleRegion(context, rightSkinRegion);
    const foreheadSkin = sampleRegion(context, foreheadRegion);
    const noseLeft = sampleRegion(context, noseLeftRegion);
    const noseRight = sampleRegion(context, noseRightRegion);
    const underEyeLeft = sampleRegion(context, underEyeLeftRegion);
    const underEyeRight = sampleRegion(context, underEyeRightRegion);
    const jawLeft = sampleRegion(context, jawLeftRegion);
    const jawRight = sampleRegion(context, jawRightRegion);
    const leftEye = sampleRegion(context, leftEyeRegion);
    const rightEye = sampleRegion(context, rightEyeRegion);
    const leftEyebrow = sampleRegion(context, leftEyebrowRegion);
    const rightEyebrow = sampleRegion(context, rightEyebrowRegion);
    const lips = sampleRegion(context, lipsRegion);
    const hair = sampleRegion(context, hairRegion);

    const skin = applyCalibration(
      {
        r:
          leftSkin.trimmed.r * 0.2 +
          rightSkin.trimmed.r * 0.2 +
          foreheadSkin.trimmed.r * 0.14 +
          noseLeft.trimmed.r * 0.08 +
          noseRight.trimmed.r * 0.08 +
          underEyeLeft.trimmed.r * 0.1 +
          underEyeRight.trimmed.r * 0.1 +
          jawLeft.trimmed.r * 0.05 +
          jawRight.trimmed.r * 0.05,
        g:
          leftSkin.trimmed.g * 0.2 +
          rightSkin.trimmed.g * 0.2 +
          foreheadSkin.trimmed.g * 0.14 +
          noseLeft.trimmed.g * 0.08 +
          noseRight.trimmed.g * 0.08 +
          underEyeLeft.trimmed.g * 0.1 +
          underEyeRight.trimmed.g * 0.1 +
          jawLeft.trimmed.g * 0.05 +
          jawRight.trimmed.g * 0.05,
        b:
          leftSkin.trimmed.b * 0.2 +
          rightSkin.trimmed.b * 0.2 +
          foreheadSkin.trimmed.b * 0.14 +
          noseLeft.trimmed.b * 0.08 +
          noseRight.trimmed.b * 0.08 +
          underEyeLeft.trimmed.b * 0.1 +
          underEyeRight.trimmed.b * 0.1 +
          jawLeft.trimmed.b * 0.05 +
          jawRight.trimmed.b * 0.05,
      },
      backgroundCalibration,
    );
    const eyes = applyCalibration(
      {
        r: leftEye.trimmed.r * 0.5 + rightEye.trimmed.r * 0.5,
        g: leftEye.trimmed.g * 0.5 + rightEye.trimmed.g * 0.5,
        b: leftEye.trimmed.b * 0.5 + rightEye.trimmed.b * 0.5,
      },
      backgroundCalibration,
    );
    const eyebrows = applyCalibration(
      {
        r: leftEyebrow.trimmed.r * 0.5 + rightEyebrow.trimmed.r * 0.5,
        g: leftEyebrow.trimmed.g * 0.5 + rightEyebrow.trimmed.g * 0.5,
        b: leftEyebrow.trimmed.b * 0.5 + rightEyebrow.trimmed.b * 0.5,
      },
      backgroundCalibration,
    );
    const calibratedHair = applyCalibration(hair.trimmed, backgroundCalibration);
    const lipsColor = applyCalibration(lips.trimmed, backgroundCalibration);
    const hairColor = {
      r: calibratedHair.r * 0.6 + eyebrows.r * 0.4,
      g: calibratedHair.g * 0.6 + eyebrows.g * 0.4,
      b: calibratedHair.b * 0.6 + eyebrows.b * 0.4,
    };

    const variabilityBreakdown = {
      skin:
        (
          leftSkin.variability +
          rightSkin.variability +
          foreheadSkin.variability +
          noseLeft.variability +
          noseRight.variability +
          underEyeLeft.variability +
          underEyeRight.variability +
          jawLeft.variability +
          jawRight.variability
        ) / 9,
      eyes: (leftEye.variability + rightEye.variability) / 2,
      hair: (hair.variability + leftEyebrow.variability + rightEyebrow.variability) / 3,
      lips: lips.variability,
    };

    const quality = calculatePhotoQuality(
      applyCalibration(leftSkin.trimmed, backgroundCalibration),
      applyCalibration(rightSkin.trimmed, backgroundCalibration),
      hairColor,
      eyes,
      lipsColor,
      faceWidth,
      canvas.width,
      backgroundCalibration,
    );

    const result = analyzePhotoColors({
      extractedColors: {
        skin: rgbToCss(skin),
        hair: rgbToCss(hairColor),
        eyes: rgbToCss(eyes),
        lips: rgbToCss(lipsColor),
      },
      photoQuality: quality.overall,
      measurementDetails: {
        faceBounds: {
          x: Math.round(faceSnapshot.bounds.minX * canvas.width),
          y: Math.round(faceSnapshot.bounds.minY * canvas.height),
          width: Math.round(faceWidth),
          height: Math.round(faceHeight),
        },
        normalizedFeatures: {
          temperature: 0,
          lightness: 0,
          clarity: 0,
          contrast: 0,
          mutedScore: 0,
        },
        qualityBreakdown: {
          overall: Number(quality.overall.toFixed(4)),
          exposure: Number(quality.exposure.toFixed(4)),
          symmetry: Number(quality.symmetry.toFixed(4)),
          distinctness: Number(quality.distinctness.toFixed(4)),
          faceSize: Number(quality.faceSize.toFixed(4)),
          background: Number(quality.background.toFixed(4)),
        },
        distributionBreakdown: {
          overall: Number(((variabilityBreakdown.skin + variabilityBreakdown.eyes + variabilityBreakdown.hair + variabilityBreakdown.lips) / 4).toFixed(4)),
          skin: Number(variabilityBreakdown.skin.toFixed(4)),
          hair: Number(variabilityBreakdown.hair.toFixed(4)),
          eyes: Number(variabilityBreakdown.eyes.toFixed(4)),
          lips: Number(variabilityBreakdown.lips.toFixed(4)),
        },
        lightingCalibration: {
          backgroundBrightness: Number(backgroundCalibration.brightness.toFixed(4)),
          backgroundNeutrality: Number(backgroundCalibration.neutrality.toFixed(4)),
          correctionStrength: Number(backgroundCalibration.correctionStrength.toFixed(4)),
          whiteBackdropRecommended: backgroundCalibration.correctionStrength < 0.45,
        },
        roiMeasurements: [
          {
            label: '피부',
            color: rgbToCss(skin),
            rgb: { r: Math.round(skin.r), g: Math.round(skin.g), b: Math.round(skin.b) },
            lab: { ...rgbToLab(skin) },
            hsl: (() => {
              const hsl = rgbToHsl(skin);
              return { h: hsl.h * 360, s: hsl.s * 100, l: hsl.l * 100 };
            })(),
            region: {
              x: Math.round((leftSkinRegion.x + rightSkinRegion.x) / 2),
              y: Math.round((leftSkinRegion.y + rightSkinRegion.y) / 2),
              width: Math.round((leftSkinRegion.width + rightSkinRegion.width) / 2),
              height: Math.round((leftSkinRegion.height + rightSkinRegion.height) / 2),
            },
          },
          {
            label: '머리',
            color: rgbToCss(hairColor),
            rgb: { r: Math.round(hairColor.r), g: Math.round(hairColor.g), b: Math.round(hairColor.b) },
            lab: { ...rgbToLab(hairColor) },
            hsl: (() => {
              const hsl = rgbToHsl(hairColor);
              return { h: hsl.h * 360, s: hsl.s * 100, l: hsl.l * 100 };
            })(),
            region: { x: Math.round(hairRegion.x), y: Math.round(hairRegion.y), width: Math.round(hairRegion.width), height: Math.round(hairRegion.height) },
          },
          {
            label: '눈동자',
            color: rgbToCss(eyes),
            rgb: { r: Math.round(eyes.r), g: Math.round(eyes.g), b: Math.round(eyes.b) },
            lab: { ...rgbToLab(eyes) },
            hsl: (() => {
              const hsl = rgbToHsl(eyes);
              return { h: hsl.h * 360, s: hsl.s * 100, l: hsl.l * 100 };
            })(),
            region: {
              x: Math.round((leftEyeRegion.x + rightEyeRegion.x) / 2),
              y: Math.round((leftEyeRegion.y + rightEyeRegion.y) / 2),
              width: Math.round((leftEyeRegion.width + rightEyeRegion.width) / 2),
              height: Math.round((leftEyeRegion.height + rightEyeRegion.height) / 2),
            },
          },
          {
            label: '입술',
            color: rgbToCss(lipsColor),
            rgb: { r: Math.round(lipsColor.r), g: Math.round(lipsColor.g), b: Math.round(lipsColor.b) },
            lab: { ...rgbToLab(lipsColor) },
            hsl: (() => {
              const hsl = rgbToHsl(lipsColor);
              return { h: hsl.h * 360, s: hsl.s * 100, l: hsl.l * 100 };
            })(),
            region: { x: Math.round(lipsRegion.x), y: Math.round(lipsRegion.y), width: Math.round(lipsRegion.width), height: Math.round(lipsRegion.height) },
          },
          {
            label: '이마',
            color: rgbToCss(applyCalibration(foreheadSkin.trimmed, backgroundCalibration)),
            rgb: {
              r: Math.round(applyCalibration(foreheadSkin.trimmed, backgroundCalibration).r),
              g: Math.round(applyCalibration(foreheadSkin.trimmed, backgroundCalibration).g),
              b: Math.round(applyCalibration(foreheadSkin.trimmed, backgroundCalibration).b),
            },
            lab: { ...rgbToLab(applyCalibration(foreheadSkin.trimmed, backgroundCalibration)) },
            hsl: (() => {
              const color = applyCalibration(foreheadSkin.trimmed, backgroundCalibration);
              const hsl = rgbToHsl(color);
              return { h: hsl.h * 360, s: hsl.s * 100, l: hsl.l * 100 };
            })(),
            region: { x: Math.round(foreheadRegion.x), y: Math.round(foreheadRegion.y), width: Math.round(foreheadRegion.width), height: Math.round(foreheadRegion.height) },
          },
          {
            label: '눈썹',
            color: rgbToCss(eyebrows),
            rgb: { r: Math.round(eyebrows.r), g: Math.round(eyebrows.g), b: Math.round(eyebrows.b) },
            lab: { ...rgbToLab(eyebrows) },
            hsl: (() => {
              const hsl = rgbToHsl(eyebrows);
              return { h: hsl.h * 360, s: hsl.s * 100, l: hsl.l * 100 };
            })(),
            region: {
              x: Math.round((leftEyebrowRegion.x + rightEyebrowRegion.x) / 2),
              y: Math.round((leftEyebrowRegion.y + rightEyebrowRegion.y) / 2),
              width: Math.round((leftEyebrowRegion.width + rightEyebrowRegion.width) / 2),
              height: Math.round((leftEyebrowRegion.height + rightEyebrowRegion.height) / 2),
            },
          },
        ],
        topSeasonScores: [],
      },
    });

    setIsAnalyzing(false);
    onAnalysisComplete(result);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto overflow-hidden border-stone-200 bg-white/90 text-stone-900 shadow-[0_20px_70px_rgba(120,113,108,0.12)] backdrop-blur">
      <CardHeader className="border-b border-stone-200 bg-stone-50/80">
        <CardTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Camera className="w-5 h-5 text-stone-500" />
          사진 분석 모듈
        </CardTitle>
        <CardDescription className="text-stone-500 text-sm">
          MediaPipe Face Landmarker + Workbook Matching
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <p className="text-stone-600">{error}</p>
            <Button variant="outline" onClick={() => void startCamera()} className="border-stone-300 bg-white hover:bg-stone-100">
              다시 시도
            </Button>
          </div>
        ) : (
          <div className="relative aspect-video bg-stone-100 rounded-[2rem] border border-stone-200 overflow-hidden group">
            {!capturedImage ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                <div className="absolute top-4 left-4 rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[11px] text-stone-700 shadow-sm">
                  {liveDetection ? 'Face Tracking Active' : '얼굴을 중앙에 맞추고 흰 배경을 권장합니다'}
                </div>
                <div className="absolute bottom-4 right-4 rounded-2xl border border-white/80 bg-white/92 px-3 py-2 text-[11px] text-stone-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <ScanFace className="w-3.5 h-3.5 text-stone-500" />
                    <span>랜드마크 {liveDetection ? `${liveDetection.landmarks.length}개` : '대기 중'}</span>
                  </div>
                </div>
              </>
            ) : (
              <img src={capturedImage} alt="captured face" className="w-full h-full object-cover" />
            )}

            {isAnalyzing && (
              <div className="absolute inset-0 bg-white/88 backdrop-blur-sm flex flex-col items-center justify-center p-8 space-y-4">
                <RefreshCw className="w-8 h-8 text-stone-600 animate-spin" />
                <div className="w-full max-w-xs space-y-3">
                  <Progress value={progress} className="h-1 bg-stone-200" />
                  <p className="text-center text-sm text-stone-600">{statusMessage}</p>
                  <p className="text-center text-[10px] text-stone-500 uppercase tracking-widest">{Math.round(progress)}%</p>
                </div>
              </div>
            )}
          </div>
        )}

        <canvas ref={captureCanvasRef} className="hidden" />

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-stone-200 bg-stone-50/80 p-5 text-sm text-stone-600 leading-relaxed">
            얼굴을 중앙 가이드 안에 맞추고 정면을 바라봐 주세요. 가능하면 밝은 흰 배경 앞에서 촬영하면 배경 간섭이 줄어 얼굴 색 측정 안정성에 조금 더 도움이 됩니다.
          </div>
          <div className="rounded-3xl border border-stone-200 bg-stone-50/80 p-5 text-sm text-stone-600 leading-relaxed">
            현재 샘플링 부위: 양쪽 볼, 양쪽 홍채 중심, 입술 중심, 헤어라인 상단. 촬영 후 결과 화면에서 측정값 상세를 볼 수 있으며, 사진 신호와 설문 신호는 기본적으로 함께 계산됩니다.
          </div>
        </div>

        <div className="flex justify-center gap-4">
          {!capturedImage ? (
            <Button
              onClick={() => void captureAndAnalyze()}
              disabled={!isCameraReady || !isModelReady || isAnalyzing || !liveDetection}
              className="rounded-full bg-stone-900 px-8 py-6 font-medium text-white hover:bg-stone-700"
            >
              사진 촬영 후 분석
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => void startCamera()}
              className="rounded-full border-stone-300 bg-white px-8 py-6 text-stone-700 hover:bg-stone-100"
            >
              다시 촬영
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
