/*
 * lib/utils.ts
 *
 * UI 컴포넌트에서 공통으로 사용하는 작은 유틸리티 모음입니다.
 * 현재는 clsx와 tailwind-merge를 결합한 cn 함수를 제공해 조건부 className과 Tailwind 클래스 충돌을 정리합니다.
 *
 * components/ui 하위의 버튼, 카드, 탭, 다이얼로그 같은 공용 컴포넌트가 이 함수를 사용합니다.
 * 도메인 로직과 직접 연결되지는 않지만, 앱 전체 UI 스타일을 일관되게 조합하기 위한 기반 파일입니다.
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
