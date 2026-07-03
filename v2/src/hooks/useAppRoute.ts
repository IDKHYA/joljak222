// 앱 페이지와 브라우저 history 라우팅 상태를 관리하는 훅입니다.
import { useEffect, useRef, useState } from 'react';
import type { AnalysisStep, AppRouteState, Page, WardrobeView } from '../wardrobeTypes';

function sameRoute(left: AppRouteState, right: AppRouteState) {
  return (
    left.page === right.page &&
    left.analysisStep === right.analysisStep &&
    left.wardrobeView === right.wardrobeView &&
    left.selectedWardrobeId === right.selectedWardrobeId
  );
}

export function useAppRoute(
  selectedWardrobeId: string,
  setSelectedWardrobeId: (id: string) => void,
  fallbackWardrobeId: string,
) {
  const [page, setPage] = useState<Page>('home');
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('photo');
  const [wardrobeView, setWardrobeView] = useState<WardrobeView>('list');
  const routeStateRef = useRef<AppRouteState>({
    page: 'home',
    analysisStep: 'photo',
    wardrobeView: 'list',
    selectedWardrobeId,
  });
  const routeInitializedRef = useRef(false);

  const getRouteState = (): AppRouteState => ({
    page,
    analysisStep,
    wardrobeView,
    selectedWardrobeId,
  });

  const applyRouteState = (route: Partial<AppRouteState>) => {
    const next: AppRouteState = {
      ...routeStateRef.current,
      ...route,
    };
    routeStateRef.current = next;
    setPage(next.page);
    setAnalysisStep(next.analysisStep);
    setWardrobeView(next.wardrobeView);
    setSelectedWardrobeId(next.selectedWardrobeId);
  };

  const navigate = (route: Partial<AppRouteState>, options: { replace?: boolean } = {}) => {
    const next: AppRouteState = {
      ...getRouteState(),
      ...route,
    };

    if (sameRoute(routeStateRef.current, next)) return;

    applyRouteState(next);

    if (typeof window === 'undefined') return;
    const historyState = { fitlyRoute: next };
    if (options.replace) {
      window.history.replaceState(historyState, '', window.location.href);
    } else {
      window.history.pushState(historyState, '', window.location.href);
    }
  };

  const goPage = (nextPage: Page) => {
    navigate({
      page: nextPage,
      analysisStep: nextPage === 'personal' ? 'photo' : analysisStep,
      wardrobeView: nextPage === 'wardrobe' ? 'list' : wardrobeView,
    });
  };

  const goBack = () => {
    if (typeof window === 'undefined') {
      navigate({ page: 'home' }, { replace: true });
      return;
    }
    window.history.back();
  };

  useEffect(() => {
    routeStateRef.current = getRouteState();
  }, [page, analysisStep, wardrobeView, selectedWardrobeId]);

  useEffect(() => {
    if (routeInitializedRef.current || typeof window === 'undefined') return;
    routeInitializedRef.current = true;
    const initialRoute = getRouteState();
    routeStateRef.current = initialRoute;
    window.history.replaceState({ fitlyRoute: initialRoute }, '', window.location.href);

    const handlePopState = (event: PopStateEvent) => {
      const route = event.state?.fitlyRoute as AppRouteState | undefined;
      applyRouteState(route ?? {
        page: 'home',
        analysisStep: 'photo',
        wardrobeView: 'list',
        selectedWardrobeId: fallbackWardrobeId,
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return {
    page,
    analysisStep,
    setAnalysisStep,
    wardrobeView,
    navigate,
    goPage,
    goBack,
  };
}
