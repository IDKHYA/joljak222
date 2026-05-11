/*
 * PhotoAnalyzer.tsx
 *
 * 퍼스널컬러 진단의 첫 단계인 사진 입력/카메라 분석 UI 컴포넌트입니다.
 * 사용자가 브라우저 카메라를 켜거나 이미지 파일을 업로드하면 Face Landmarker를 통해 얼굴을 추적하고,
 * 얼굴이 안정적으로 유지될 때 3초 자동 촬영 후 photoAnalysis.ts의 색상 분석으로 넘깁니다.
 *
 * 이 컴포넌트는 도메인 판정 자체보다 사용자 경험과 실시간 안정성 제어를 담당합니다.
 * 카메라 권한, 모바일/데스크톱 검출 간격, 자동 촬영 중복 방지, 이미지 업로드 fallback,
 * 흰 종이/배경 보정 안내, 분석 중 상태 표시를 모두 처리합니다.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PhotoAnalysisResult } from '@/src/types';
import { detectFaceSnapshot, getFaceLandmarker } from '@/src/services/faceLandmarker';
import { analyzePhotoColors } from '@/src/services/geminiService';
import { analyzeFaceSnapshotColors, buildSampleRegions, calibrationRegionToPixels, LiveDetectionState } from '@/src/services/photoAnalysis';

interface PhotoAnalyzerProps {
  onAnalysisComplete: (result: PhotoAnalysisResult) => void;
}

const AUTO_CAPTURE_DELAY_MS = 3000;
const DESKTOP_DETECT_INTERVAL_MS = 120;
const MOBILE_DETECT_INTERVAL_MS = 320;
const MOBILE_DETECT_STUCK_MS = 1500;
const FACE_DETECTION_GRACE_MS = 1100;

type ZoomCapabilities = MediaTrackCapabilities & { zoom?: { min?: number; max?: number; step?: number } };

type ZoomCapableTrack = Omit<MediaStreamTrack, 'getCapabilities' | 'applyConstraints'> & {
  getCapabilities?: () => ZoomCapabilities;
  applyConstraints?: (constraints: MediaTrackConstraints & { advanced?: Array<MediaTrackConstraintSet & { zoom?: number }> }) => Promise<void>;
};

const ANALYSIS_STEPS = [
  '카메라 프레임을 고정하는 중',
  '얼굴 랜드마크를 감지하는 중',
  '흰 종이 기준으로 조명 색을 보정하는 중',
  '피부, 눈, 입술, 헤어라인 색을 샘플링하는 중',
  '팔레트 거리와 품질 점수를 계산하는 중',
];

// 브라우저/장치별 카메라 실패 원인을 사용자에게 이해 가능한 문장으로 바꿉니다.
const getCameraErrorMessage = (error: unknown) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    return '이 주소에서는 카메라 권한을 요청할 수 없습니다. PC에서는 http://localhost:3000 으로 접속하고, 휴대폰에서는 HTTPS 주소로 접속해 주세요.';
  }

  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return '카메라 권한이 차단되어 있습니다. 브라우저 주소창의 카메라 아이콘 또는 사이트 설정에서 카메라를 허용한 뒤 다시 시도해 주세요.';
    }

    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return '사용 가능한 카메라를 찾지 못했습니다. 카메라 연결 상태와 Windows 개인정보 설정의 카메라 접근 허용을 확인해 주세요.';
    }

    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return '다른 앱이 카메라를 사용 중이거나 장치가 응답하지 않습니다. 화상회의 앱을 종료한 뒤 다시 시도해 주세요.';
    }

    if (error.name === 'OverconstrainedError') {
      return '요청한 카메라 설정을 사용할 수 없습니다. 다른 카메라를 선택하거나 브라우저를 다시 실행해 주세요.';
    }
  }

  return '카메라에 접근할 수 없습니다. 브라우저 권한과 장치 연결 상태를 확인한 뒤 다시 시도해 주세요.';
};

// 권한 거부처럼 같은 URL에서 재요청이 막히는 오류인지 확인합니다.
const isCameraPermissionBlocked = (error: unknown) =>
  error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');

// localhost/127.0.0.x 주소를 바꿔 브라우저가 카메라 권한을 새 사이트로 다시 요청하게 하는 보조 함수입니다.
const getFreshLocalCameraPermissionUrl = () => {
  const { protocol, hostname, port, pathname, search, hash } = window.location;

  if (hostname === 'localhost') {
    return `${protocol}//127.0.0.1${port ? `:${port}` : ''}${pathname}${search}${hash}`;
  }

  const loopbackMatch = hostname.match(/^127\.0\.0\.(\d+)$/);
  if (!loopbackMatch) return null;

  const current = Number(loopbackMatch[1]);
  if (!Number.isFinite(current) || current >= 9) return null;

  return `${protocol}//127.0.0.${current + 1}${port ? `:${port}` : ''}${pathname}${search}${hash}`;
};

export default function PhotoAnalyzer({ onAnalysisComplete }: PhotoAnalyzerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackFileInputRef = useRef<HTMLInputElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const mobileDetectTimerRef = useRef<number | null>(null);
  const detectInFlightRef = useRef(false);
  const detectStartedAtRef = useRef(0);
  const lastDetectTimeRef = useRef(0);
  const lastFaceSeenAtRef = useRef(0);
  const liveDetectionRef = useRef<LiveDetectionState | null>(null);
  const capturedImageUrlRef = useRef<string | null>(null);
  const autoCaptureTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const countdownEndAtRef = useRef(0);
  const isCapturingRef = useRef(false);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState(ANALYSIS_STEPS[0]);
  const [isModelReady, setIsModelReady] = useState(false);
  const [liveDetection, setLiveDetection] = useState<LiveDetectionState | null>(null);
  const [autoCaptureArmed, setAutoCaptureArmed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [displayMetrics, setDisplayMetrics] = useState({ offsetX: 0, offsetY: 0, width: 0, height: 0, scale: 1 });
  const [streamOrientation, setStreamOrientation] = useState<'portrait' | 'landscape' | 'unknown'>('unknown');
  const [detectionStatus, setDetectionStatus] = useState('얼굴을 가이드 안에 맞춰주세요');
  const [cameraPermissionBlocked, setCameraPermissionBlocked] = useState(false);

  // 컴포넌트가 열리면 카메라와 얼굴 랜드마크 모델을 동시에 준비합니다.
  // 종료 시에는 stream, object URL, 타이머, animation frame을 모두 정리합니다.
  useEffect(() => {
    void startCamera();
    void getFaceLandmarker({ preferCpu: isMobileViewport() })
      .then(() => setIsModelReady(true))
      .catch(() => {
        setError('얼굴 랜드마크 모델을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.');
      });

    return () => {
      stopCamera();
      revokeCapturedImage();
      clearAutoCaptureTimer();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (mobileDetectTimerRef.current) {
        window.clearTimeout(mobileDetectTimerRef.current);
      }
    };
  }, []);

  // 카메라가 준비된 동안 실시간 얼굴 검출 루프를 실행합니다.
  // 데스크톱은 requestAnimationFrame, 모바일은 setTimeout 간격 검출로 부하를 낮춥니다.
  useEffect(() => {
    if (!isCameraReady || capturedImage || isAnalyzing || !isModelReady) {
      clearAutoCaptureTimer();
      clearOverlay();
      return;
    }

    let stopped = false;
    const isMobileDetection = isMobileViewport();
    const preferCpu = isMobileDetection;

    // 현재 비디오 프레임에서 얼굴을 찾고, ROI 오버레이와 자동 촬영 타이머를 갱신합니다.
    const runDetection = async (time: number) => {
      if (!videoRef.current) return;

      if (detectInFlightRef.current) {
        const elapsed = performance.now() - detectStartedAtRef.current;
        if (isMobileDetection && elapsed > MOBILE_DETECT_STUCK_MS) {
          detectInFlightRef.current = false;
        } else {
          return;
        }
      }

      if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) return;

      lastDetectTimeRef.current = time;
      detectStartedAtRef.current = performance.now();
      detectInFlightRef.current = true;
      setDetectionStatus(liveDetectionRef.current ? '얼굴 유지 중' : '얼굴 인식 중');

      try {
        const snapshot = await detectFaceSnapshot(videoRef.current, time, { preferCpu });
        if (stopped || !videoRef.current) return;

        const width = videoRef.current.videoWidth || videoRef.current.clientWidth;
        const height = videoRef.current.videoHeight || videoRef.current.clientHeight;
        updateDisplayMetrics(width, height);

        if (!snapshot) {
          const hasRecentFace = performance.now() - lastFaceSeenAtRef.current < FACE_DETECTION_GRACE_MS;
          if (hasRecentFace) {
            setDetectionStatus('얼굴 유지 중');
            drawOverlay(liveDetectionRef.current, width, height);
            return;
          }

          updateLiveDetection(null);
          clearAutoCaptureTimer();
          setDetectionStatus('얼굴을 가이드 안에 맞춰주세요');
          drawOverlay(null, width, height);
          return;
        }

        const detectionState: LiveDetectionState = {
          landmarks: snapshot.landmarks,
          faceBounds: {
            x: snapshot.bounds.minX * width,
            y: snapshot.bounds.minY * height,
            width: snapshot.bounds.width * width,
            height: snapshot.bounds.height * height,
          },
          sampleRegions: buildSampleRegions(snapshot.landmarks, width, height, snapshot.bounds.width * width, snapshot.bounds.height * height),
        };

        lastFaceSeenAtRef.current = performance.now();
        updateLiveDetection(detectionState);
        scheduleAutoCapture();
        setDetectionStatus('얼굴 유지 중');
        drawOverlay(detectionState, width, height);
      } catch {
        if (stopped) return;

        const width = videoRef.current?.videoWidth || videoRef.current?.clientWidth || 0;
        const height = videoRef.current?.videoHeight || videoRef.current?.clientHeight || 0;
        const hasRecentFace = performance.now() - lastFaceSeenAtRef.current < FACE_DETECTION_GRACE_MS;

        if (!hasRecentFace) {
          updateLiveDetection(null);
          clearAutoCaptureTimer();
          setDetectionStatus('얼굴 인식이 지연되고 있습니다');
          clearOverlay();
        } else if (width && height) {
          setDetectionStatus('얼굴 유지 중');
          drawOverlay(liveDetectionRef.current, width, height);
        }
      } finally {
        detectInFlightRef.current = false;
        detectStartedAtRef.current = 0;
      }
    };

    // 데스크톱에서는 프레임 루프 안에서 일정 간격마다 얼굴 검출을 수행합니다.
    const desktopLoop = (time: number) => {
      rafRef.current = requestAnimationFrame(desktopLoop);
      if (time - lastDetectTimeRef.current < DESKTOP_DETECT_INTERVAL_MS) return;
      void runDetection(time);
    };

    // 모바일에서는 검출 비용을 줄이기 위해 고정 간격으로만 얼굴 검출을 실행합니다.
    const mobileLoop = () => {
      if (stopped) return;
      void runDetection(performance.now()).finally(() => {
        if (!stopped) {
          mobileDetectTimerRef.current = window.setTimeout(mobileLoop, MOBILE_DETECT_INTERVAL_MS);
        }
      });
    };

    if (isMobileDetection) {
      mobileLoop();
    } else {
      rafRef.current = requestAnimationFrame(desktopLoop);
    }

    return () => {
      stopped = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (mobileDetectTimerRef.current) {
        window.clearTimeout(mobileDetectTimerRef.current);
        mobileDetectTimerRef.current = null;
      }
      detectInFlightRef.current = false;
      detectStartedAtRef.current = 0;
      clearAutoCaptureTimer();
      clearOverlay();
    };
  }, [capturedImage, isAnalyzing, isCameraReady, isModelReady]);

  // ref와 state를 함께 갱신해 비동기 루프에서도 최신 얼굴 검출 상태를 참조할 수 있게 합니다.
  const updateLiveDetection = (state: LiveDetectionState | null) => {
    liveDetectionRef.current = state;
    setLiveDetection(state);
  };

  // 자동 촬영 예약과 카운트다운 표시를 모두 해제합니다.
  const clearAutoCaptureTimer = () => {
    if (autoCaptureTimerRef.current) {
      window.clearTimeout(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setAutoCaptureArmed(false);
    setCountdown(null);
  };

  // 얼굴이 안정적으로 보이면 3초 뒤 자동 촬영을 예약합니다.
  // 이미 촬영 중이거나 분석 중이면 중복 실행을 막습니다.
  const scheduleAutoCapture = () => {
    if (autoCaptureTimerRef.current || isCapturingRef.current || capturedImage || isAnalyzing) return;

    countdownEndAtRef.current = performance.now() + AUTO_CAPTURE_DELAY_MS;
    setAutoCaptureArmed(true);
    setCountdown(Math.ceil(AUTO_CAPTURE_DELAY_MS / 1000));

    countdownIntervalRef.current = window.setInterval(() => {
      const remainingMs = Math.max(0, countdownEndAtRef.current - performance.now());
      setCountdown(Math.max(1, Math.ceil(remainingMs / 1000)));
    }, 100);

    autoCaptureTimerRef.current = window.setTimeout(() => {
      clearAutoCaptureTimer();
      void captureAndAnalyze();
    }, AUTO_CAPTURE_DELAY_MS);
  };

  // createObjectURL로 만든 촬영 이미지를 해제해 메모리 누수를 막습니다.
  const revokeCapturedImage = () => {
    if (capturedImageUrlRef.current) {
      URL.revokeObjectURL(capturedImageUrlRef.current);
      capturedImageUrlRef.current = null;
    }
  };

  // 카메라 stream과 화면 상태를 정리합니다. 다른 화면으로 이동하거나 촬영이 끝났을 때 호출됩니다.
  const stopCamera = () => {
    clearAutoCaptureTimer();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraReady(false);
    updateLiveDetection(null);
    setStreamOrientation('unknown');
    setDetectionStatus('얼굴을 가이드 안에 맞춰주세요');
  };

  // 모바일 환경에서는 CPU delegate와 느린 검출 간격을 사용하기 위한 viewport 검사입니다.
  const isMobileViewport = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches;

  // 가능한 경우 전면 카메라를 우선 선택합니다. 초광각 카메라가 잡히면 얼굴 왜곡이 커질 수 있어 후보를 조정합니다.
  const getPreferredFrontCameraDeviceId = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return null;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((device) => device.kind === 'videoinput');
    if (!videoInputs.length) return null;

    const frontCameraCandidates = videoInputs.filter((device) => {
      const label = device.label.toLowerCase();
      return /front|user|selfie|전면|앞/.test(label);
    });
    const candidates = frontCameraCandidates.length ? frontCameraCandidates : videoInputs;

    const wideCamera = candidates.find((device) => {
      const label = device.label.toLowerCase();
      return /ultra|wide|0\.5|0,5|광각|초광각/.test(label);
    });

    return (wideCamera ?? candidates[0])?.deviceId ?? null;
  };

  // 모바일 브라우저가 기본 줌을 크게 잡는 경우 최소 줌으로 낮춰 얼굴이 과하게 확대되지 않게 합니다.
  const applyLowestSupportedZoom = async (stream: MediaStream) => {
    const [track] = stream.getVideoTracks();
    if (!track) return;

    const zoomTrack = track as ZoomCapableTrack;
    const capabilities = zoomTrack.getCapabilities?.();
    const minZoom = capabilities?.zoom?.min;
    if (typeof minZoom !== 'number') return;

    await zoomTrack.applyConstraints?.({
      advanced: [{ zoom: minZoom }],
    }).catch(() => undefined);
  };

  // 카메라 요청 조건을 한 곳에서 만듭니다. deviceId가 있으면 특정 카메라를, 없으면 전면 카메라를 선호합니다.
  const buildCameraConstraints = (deviceId?: string | null): MediaStreamConstraints => ({
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'user' } }),
      width: { ideal: 720 },
      height: { ideal: 1280 },
      aspectRatio: { ideal: 9 / 16 },
    },
  });

  // 카메라 권한을 요청하고 video 태그에 stream을 연결합니다.
  // 제약 조건 실패 시 더 일반적인 가로 해상도 조건으로 한 번 더 fallback합니다.
  const startCamera = async () => {
    stopCamera();
    revokeCapturedImage();
    isCapturingRef.current = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia unavailable');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(buildCameraConstraints());

        if (isMobileViewport()) {
          const preferredDeviceId = await getPreferredFrontCameraDeviceId();
          const currentDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId;
          if (preferredDeviceId && preferredDeviceId !== currentDeviceId) {
            stream.getTracks().forEach((track) => track.stop());
            stream = await navigator.mediaDevices.getUserMedia(buildCameraConstraints(preferredDeviceId));
          }
          await applyLowestSupportedZoom(stream);
        }
      } catch (constraintError) {
        if (constraintError instanceof DOMException && constraintError.name === 'OverconstrainedError') {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'user' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } else {
          throw constraintError;
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await waitForMetadata(videoRef.current);
        await videoRef.current.play().catch(() => undefined);
        updateDisplayMetrics(videoRef.current.videoWidth, videoRef.current.videoHeight);
        setStreamOrientation(videoRef.current.videoHeight >= videoRef.current.videoWidth ? 'portrait' : 'landscape');
      }
      setCapturedImage(null);
      setError(null);
      setIsCameraReady(true);
      setCameraPermissionBlocked(false);
    } catch (cameraError) {
      setCameraPermissionBlocked(isCameraPermissionBlocked(cameraError));
      setError(getCameraErrorMessage(cameraError));
    }
  };

  // 권한 차단 상태면 새 loopback 주소로 이동하고, 일반 오류면 같은 화면에서 다시 카메라를 시작합니다.
  const retryCamera = () => {
    if (cameraPermissionBlocked) {
      const freshUrl = getFreshLocalCameraPermissionUrl();
      if (freshUrl) {
        window.location.assign(freshUrl);
        return;
      }
    }

    void startCamera();
  };

  // 얼굴/ROI 가이드 canvas를 비웁니다.
  const clearOverlay = () => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const context = overlay.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, overlay.width, overlay.height);
  };

  // 오버레이 canvas의 실제 픽셀 크기를 비디오 프레임 크기와 맞춥니다.
  const syncOverlaySize = (width: number, height: number) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    if (overlay.width !== width || overlay.height !== height) {
      overlay.width = width;
      overlay.height = height;
    }
  };

  // 얼굴 박스, 랜드마크 점, ROI 사각형, 흰 종이 기준 영역을 canvas 위에 그립니다.
  const drawOverlay = (detectionState: LiveDetectionState | null, width: number, height: number) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;

    syncOverlaySize(width, height);
    const context = overlay.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, width, height);
    drawWhiteReferenceGuide(context, width, height);

    if (!detectionState) return;

    context.strokeStyle = autoCaptureTimerRef.current ? 'rgba(16, 185, 129, 0.95)' : 'rgba(96, 165, 250, 0.9)';
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
      context.fillRect(region.x, Math.max(0, region.y - 18), 72, 16);
      context.fillStyle = 'rgba(244, 244, 245, 0.95)';
      context.font = '10px ui-monospace, monospace';
      context.fillText(region.label, region.x + 4, Math.max(10, region.y - 6));
    }
  };

  // object-fit: cover로 표시되는 비디오의 실제 화면 위치와 scale을 계산합니다.
  // ROI HTML 오버레이를 비디오 픽셀 좌표에서 화면 좌표로 바꾸는 기준입니다.
  const updateDisplayMetrics = (videoWidth: number, videoHeight: number) => {
    const frame = frameRef.current;
    if (!frame || !videoWidth || !videoHeight) return;
    const frameWidth = frame.clientWidth;
    const frameHeight = frame.clientHeight;
    const scale = Math.max(frameWidth / videoWidth, frameHeight / videoHeight);
    const width = videoWidth * scale;
    const height = videoHeight * scale;
    setDisplayMetrics({
      offsetX: (frameWidth - width) / 2,
      offsetY: (frameHeight - height) / 2,
      width,
      height,
      scale,
    });
  };

  // 비디오 원본 픽셀 좌표의 사각형을 현재 화면에 보이는 CSS 좌표로 변환합니다.
  const toDisplayRect = (rect: { x: number; y: number; width: number; height: number }) => ({
    left: displayMetrics.offsetX + rect.x * displayMetrics.scale,
    top: displayMetrics.offsetY + rect.y * displayMetrics.scale,
    width: rect.width * displayMetrics.scale,
    height: rect.height * displayMetrics.scale,
  });

  // 현재 카메라 프레임을 canvas로 캡처하고 얼굴 색상 분석을 실행합니다.
  // 얼굴이 너무 작거나 없으면 오류를 보여주고, 정상일 때만 상위 컴포넌트에 PhotoAnalysisResult를 전달합니다.
  const captureAndAnalyze = async () => {
    if (isCapturingRef.current || !videoRef.current || !captureCanvasRef.current) return;
    clearAutoCaptureTimer();
    isCapturingRef.current = true;

    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || !video.videoWidth || !video.videoHeight) {
      isCapturingRef.current = false;
      setError('카메라 프레임을 아직 읽지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageUrl = await canvasToObjectUrl(canvas);
    revokeCapturedImage();
    capturedImageUrlRef.current = imageUrl;
    setCapturedImage(imageUrl);
    stopCamera();
    setIsAnalyzing(true);
    setProgress(0);

    for (let index = 0; index < ANALYSIS_STEPS.length; index += 1) {
      setStatusMessage(ANALYSIS_STEPS[index]);
      await new Promise((resolve) => setTimeout(resolve, 180));
      setProgress(((index + 1) / ANALYSIS_STEPS.length) * 100);
    }

    const faceSnapshot = await detectFaceSnapshot(canvas, performance.now(), { preferCpu: isMobileViewport() });
    if (!faceSnapshot) {
      isCapturingRef.current = false;
      setIsAnalyzing(false);
      setError('얼굴을 찾지 못했습니다. 얼굴을 정면으로 두고 밝고 균일한 조명에서 다시 촬영해 주세요.');
      return;
    }

    const faceWidth = faceSnapshot.bounds.width * canvas.width;
    const faceHeight = faceSnapshot.bounds.height * canvas.height;

    if (faceWidth < canvas.width * 0.18 || faceHeight < canvas.height * 0.22) {
      isCapturingRef.current = false;
      setIsAnalyzing(false);
      setError('얼굴이 너무 작게 인식되었습니다. 카메라에 조금 더 가까이 앉고 다시 촬영해 주세요.');
      return;
    }

    const payload = analyzeFaceSnapshotColors(
      context,
      faceSnapshot.landmarks,
      faceSnapshot.bounds,
      canvas.width,
      canvas.height,
      calibrationRegionToPixels(canvas.width, canvas.height),
    );
    const result = analyzePhotoColors(payload);

    setIsAnalyzing(false);
    onAnalysisComplete(result);
  };

  // 카메라가 안 되는 경우 업로드한 이미지 파일을 같은 분석 파이프라인으로 처리합니다.
  const analyzeImageFile = async (file: File) => {
    if (!captureCanvasRef.current || isCapturingRef.current) return;

    clearAutoCaptureTimer();
    stopCamera();
    revokeCapturedImage();
    isCapturingRef.current = true;
    setError(null);
    setIsAnalyzing(true);
    setProgress(12);
    setStatusMessage('사진을 불러오는 중');

    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.src = imageUrl;

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('image load failed'));
      });

      const canvas = captureCanvasRef.current;
      const context = canvas.getContext('2d');
      if (!context || !image.naturalWidth || !image.naturalHeight) {
        throw new Error('image canvas unavailable');
      }

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setCapturedImage(imageUrl);
      capturedImageUrlRef.current = imageUrl;
      setProgress(36);
      setStatusMessage('얼굴 랜드마크를 감지하는 중');

      const faceSnapshot = await detectFaceSnapshot(canvas, performance.now(), { preferCpu: isMobileViewport() });
      if (!faceSnapshot) {
        setError('사진에서 얼굴을 찾지 못했습니다. 정면 얼굴이 잘 보이는 사진으로 다시 선택해 주세요.');
        return;
      }

      const faceWidth = faceSnapshot.bounds.width * canvas.width;
      const faceHeight = faceSnapshot.bounds.height * canvas.height;
      if (faceWidth < canvas.width * 0.18 || faceHeight < canvas.height * 0.22) {
        setError('얼굴이 너무 작게 인식되었습니다. 얼굴이 더 크게 나온 사진으로 다시 선택해 주세요.');
        return;
      }

      setProgress(72);
      setStatusMessage('피부, 눈, 입술, 헤어라인 색을 샘플링하는 중');
      const payload = analyzeFaceSnapshotColors(
        context,
        faceSnapshot.landmarks,
        faceSnapshot.bounds,
        canvas.width,
        canvas.height,
        calibrationRegionToPixels(canvas.width, canvas.height),
      );
      const result = analyzePhotoColors(payload);
      onAnalysisComplete(result);
    } catch {
      URL.revokeObjectURL(imageUrl);
      if (capturedImageUrlRef.current === imageUrl) capturedImageUrlRef.current = null;
      setError('사진을 분석하지 못했습니다. 다른 사진을 선택해 주세요.');
    } finally {
      isCapturingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  // 숨겨진 파일 input에서 선택된 사진을 분석 함수로 넘깁니다.
  const handleFallbackFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void analyzeImageFile(file);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto overflow-hidden border-stone-200 bg-white/90 text-stone-900 shadow-[0_20px_70px_rgba(120,113,108,0.12)] backdrop-blur">
      <CardHeader className="border-b border-stone-200 bg-stone-50/80">
        <CardTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Camera className="w-5 h-5 text-stone-500" />
          사진 분석 모듈
        </CardTitle>
        <CardDescription className="text-stone-500 text-sm">Face Landmarker + White Reference Calibration</CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <p className="text-stone-600">{error}</p>
            {cameraPermissionBlocked && (
              <p className="max-w-md text-xs leading-relaxed text-stone-500">
                이미 거절된 같은 주소에서는 브라우저가 권한창을 다시 띄우지 않습니다. 다시 시도를 누르면 새 로컬 주소로 이동해 권한 요청을 다시 엽니다.
              </p>
            )}
            <Button variant="outline" onClick={retryCamera} className="border-stone-300 bg-white hover:bg-stone-100">
              다시 시도
            </Button>
            {cameraPermissionBlocked && (
              <>
                <Button onClick={() => fallbackFileInputRef.current?.click()} className="bg-stone-900 text-white hover:bg-stone-700">
                  사진 선택해서 분석
                </Button>
                <input ref={fallbackFileInputRef} type="file" accept="image/*" capture="user" hidden onChange={handleFallbackFileChange} />
              </>
            )}
          </div>
        ) : (
          <div
            ref={frameRef}
            className={`photo-camera-frame relative bg-stone-100 rounded-[2rem] border border-stone-200 overflow-hidden group stream-${streamOrientation}`}
          >
            {!capturedImage ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="photo-camera-media" />
                <canvas ref={overlayCanvasRef} className="hidden" />
                <div className={liveDetection ? 'face-guide detected' : 'face-guide'} aria-hidden="true">
                  <span>얼굴 위치</span>
                </div>
                {liveDetection && (
                  <>
                    <div className="face-detection-box" style={toDisplayRect(liveDetection.faceBounds)} aria-hidden="true" />
                    {liveDetection.sampleRegions.slice(0, 7).map((region) => (
                      <div key={region.key} className="sample-region-box" style={toDisplayRect(region)} aria-hidden="true" />
                    ))}
                  </>
                )}
                <div className="white-reference-guide" aria-hidden="true"><span>흰 종이</span></div>
                {countdown && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/90 bg-stone-950/72 text-6xl font-semibold text-white shadow-2xl backdrop-blur">
                      {countdown}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <img src={capturedImage} alt="captured face" className="photo-camera-media" />
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
        {!cameraPermissionBlocked && <input ref={fallbackFileInputRef} type="file" accept="image/*" capture="user" hidden onChange={handleFallbackFileChange} />}

        {!capturedImage && !error && (
          <div className="photo-camera-controls">
            <div className="camera-status-pill">
              {autoCaptureArmed ? '얼굴 유지 중 · 자동 촬영 준비 중' : detectionStatus}
            </div>
            <Button
              onClick={() => void captureAndAnalyze()}
              disabled={!isCameraReady || !isModelReady || isAnalyzing}
              className="mobile-capture-button"
            >
              바로 촬영 및 분석
            </Button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-stone-200 bg-stone-50/80 p-5 text-sm text-stone-600 leading-relaxed">
            얼굴이 인식되면 3초 카운트다운 뒤 자동 촬영됩니다.
          </div>
          <div className="rounded-3xl border border-stone-200 bg-stone-50/80 p-5 text-sm text-stone-600 leading-relaxed">
            깨끗한 흰 종이를 아래쪽 기준 카드 가이드 안에 맞추면 조명 색 보정이 더 안정적으로 적용됩니다.
          </div>
        </div>

        {capturedImage && (
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => void startCamera()} className="rounded-full border-stone-300 bg-white px-8 py-6 text-stone-700 hover:bg-stone-100">
              다시 촬영
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 촬영 가이드 위에 흰 종이 위치를 표시합니다. 이 영역은 photoAnalysis.ts의 화이트밸런스 기준이 됩니다.
const drawWhiteReferenceGuide = (context: CanvasRenderingContext2D, width: number, height: number) => {
  const region = calibrationRegionToPixels(width, height);
  context.save();
  context.fillStyle = 'rgba(255, 255, 255, 0.16)';
  context.strokeStyle = 'rgba(255, 255, 255, 0.96)';
  context.lineWidth = 2;
  context.setLineDash([8, 6]);
  context.fillRect(region.x, region.y, region.width, region.height);
  context.strokeRect(region.x, region.y, region.width, region.height);
  context.setLineDash([]);
  context.fillStyle = 'rgba(9, 9, 11, 0.78)';
  context.fillRect(region.x, Math.max(0, region.y - 22), 104, 18);
  context.fillStyle = 'rgba(255, 255, 255, 0.96)';
  context.font = '11px ui-monospace, monospace';
  context.fillText('흰 종이 기준', region.x + 6, Math.max(12, region.y - 8));
  context.restore();
};

const waitForMetadata = async (video: HTMLVideoElement) => {
  if (video.readyState >= 1) return;

  await new Promise<void>((resolve) => {
    const handleLoadedMetadata = () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      resolve();
    };
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
  });
};

const canvasToObjectUrl = async (canvas: HTMLCanvasElement) =>
  new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to capture canvas image.'));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, 'image/png');
  });
