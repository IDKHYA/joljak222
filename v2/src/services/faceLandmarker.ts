/*
 * faceLandmarker.ts
 *
 * MediaPipe Tasks Vision의 Face Landmarker를 초기화하고 얼굴 랜드마크 스냅샷을 반환하는 서비스입니다.
 * 퍼스널컬러 판정 자체를 수행하는 파일은 아니며, 얼굴 bounds와 normalized landmarks를 안정적으로 얻는 것이 역할입니다.
 *
 * GPU delegate를 우선 사용하고 실패하면 CPU delegate로 fallback합니다.
 * faceLandmarkerPromises에 GPU/CPU별 Promise를 캐싱해 모델이 진단마다 중복 로딩되지 않도록 제어합니다.
 * PhotoAnalyzer.tsx는 이 서비스를 호출해 카메라 프레임 또는 업로드 이미지에서 얼굴 기준점을 얻고,
 * photoAnalysis.ts는 그 기준점을 바탕으로 피부/입술/눈/머리 ROI를 샘플링합니다.
 */
import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';

const TASKS_VISION_VERSION = '0.10.34';
const WASM_BASE_PATH = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const faceLandmarkerPromises: Partial<Record<'GPU' | 'CPU', Promise<FaceLandmarker>>> = {};

interface FaceLandmarkerOptions {
  preferCpu?: boolean;
}

export interface FaceDetectionSnapshot {
  landmarks: NormalizedLandmark[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

// MediaPipe FaceLandmarker 인스턴스를 실제로 생성합니다.
// delegate를 인자로 받아 GPU/CPU 중 어떤 실행 경로를 사용할지 결정합니다.
async function createFaceLandmarker(delegate: 'GPU' | 'CPU') {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);

  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_ASSET_PATH,
      delegate,
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    minFaceDetectionConfidence: 0.35,
    minFacePresenceConfidence: 0.35,
    minTrackingConfidence: 0.35,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });
}

// 이미 로딩된 모델 Promise가 있으면 재사용하고, 없으면 새로 로딩합니다.
// 모바일/저사양 환경에서는 preferCpu로 CPU delegate를 바로 선택할 수 있습니다.
export async function getFaceLandmarker(options: FaceLandmarkerOptions = {}) {
  if (options.preferCpu) {
    if (!faceLandmarkerPromises.CPU) {
      faceLandmarkerPromises.CPU = createFaceLandmarker('CPU');
    }
    return faceLandmarkerPromises.CPU;
  }

  if (!faceLandmarkerPromises.GPU) {
    faceLandmarkerPromises.GPU = createFaceLandmarker('GPU').catch(() => {
      if (!faceLandmarkerPromises.CPU) {
        faceLandmarkerPromises.CPU = createFaceLandmarker('CPU');
      }
      return faceLandmarkerPromises.CPU;
    });
  }

  return faceLandmarkerPromises.GPU;
}

// 비디오/캔버스/이미지 한 프레임에서 얼굴 랜드마크와 얼굴 bounds를 추출합니다.
// 얼굴이 없으면 null을 반환해 PhotoAnalyzer가 사용자 안내 또는 재시도를 처리하게 합니다.
export async function detectFaceSnapshot(
  image: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
  timestamp = performance.now(),
  options: FaceLandmarkerOptions = {},
): Promise<FaceDetectionSnapshot | null> {
  const faceLandmarker = await getFaceLandmarker(options);
  const result = faceLandmarker.detectForVideo(image, timestamp);
  const landmarks = result.faceLandmarks[0];

  if (!landmarks || landmarks.length === 0) {
    return null;
  }

  const xs = landmarks.map((landmark) => landmark.x);
  const ys = landmarks.map((landmark) => landmark.y);
  const minX = Math.max(0, Math.min(...xs));
  const minY = Math.max(0, Math.min(...ys));
  const maxX = Math.min(1, Math.max(...xs));
  const maxY = Math.min(1, Math.max(...ys));

  return {
    landmarks,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}
