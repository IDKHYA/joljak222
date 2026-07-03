// React 타입 패키지 설치 전까지 v2 빌드를 가능하게 하는 최소 선언이다.
declare module 'react' {
  export type ReactNode = unknown;
  export type Key = string | number;
  export type SetStateAction<S> = S | ((previous: S) => S);
  export type Dispatch<A> = (value: A) => void;
  export type ComponentProps<T> = Record<string, unknown>;
  export type CSSProperties = Record<string, string | number | undefined>;

  export interface RefObject<T> {
    current: T;
  }

  export interface MutableRefObject<T> {
    current: T;
  }

  export interface ChangeEvent<T = Element> {
    target: T;
    currentTarget: T;
  }

  export interface PointerEvent<T = Element> {
    currentTarget: T;
    clientX: number;
    clientY: number;
    pointerId: number;
    preventDefault(): void;
    stopPropagation(): void;
  }

  export function useCallback<T extends (...args: never[]) => unknown>(callback: T, deps: readonly unknown[]): T;

  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;

  export function useMemo<T>(factory: () => T, deps?: readonly unknown[]): T;

  export function useRef<T>(initialValue: T): MutableRefObject<T>;

  export function useRef<T>(initialValue: T | null): RefObject<T | null>;

  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];

  export const StrictMode: (props: { children?: ReactNode }) => JSX.Element;

  const React: {
    StrictMode: typeof StrictMode;
    useCallback: typeof useCallback;
    useEffect: typeof useEffect;
    useMemo: typeof useMemo;
    useRef: typeof useRef;
    useState: typeof useState;
  };

  export default React;
}

declare namespace React {
  type ReactNode = unknown;
  type Key = string | number;
  type SetStateAction<S> = S | ((previous: S) => S);
  type Dispatch<A> = (value: A) => void;
  type ComponentProps<T> = Record<string, unknown>;
  type CSSProperties = Record<string, string | number | undefined>;

  interface RefObject<T> {
    current: T;
  }

  interface MutableRefObject<T> {
    current: T;
  }

  interface ChangeEvent<T = Element> {
    target: T;
    currentTarget: T;
  }

  interface PointerEvent<T = Element> {
    currentTarget: T;
    clientX: number;
    clientY: number;
    pointerId: number;
    preventDefault(): void;
    stopPropagation(): void;
  }
}

declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment): {
    render(children: unknown): void;
  };
}

declare module 'react/jsx-runtime' {
  export namespace JSX {
    interface Element {}
    interface IntrinsicAttributes {
      key?: unknown;
    }
    interface IntrinsicElements {
      [elementName: string]: unknown;
    }
  }
}

declare namespace JSX {
  interface Element {}
  interface IntrinsicAttributes {
    key?: unknown;
  }
  interface IntrinsicElements {
    [elementName: string]: unknown;
  }
}
