// React 타입 패키지 설치 전까지 v2 빌드를 가능하게 하는 최소 선언이다.
declare module 'react' {
  export type ReactNode = unknown;

  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;

  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((previous: S) => S)) => void];

  export const StrictMode: (props: { children?: ReactNode }) => JSX.Element;

  const React: {
    StrictMode: typeof StrictMode;
  };

  export default React;
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
