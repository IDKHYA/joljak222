/*
 * useWeather.ts
 *
 * 추천 화면과 홈 화면에서 사용할 현재 날씨 상태를 관리하는 React hook입니다.
 * 브라우저 geolocation을 우선 사용하고, 권한 거부나 조회 실패 시 서울 fallback으로 WeatherSnapshot을 요청합니다.
 *
 * 반환값은 data/loading/error/source/refresh로 구성되어 UI가 날씨 로딩 상태와 실패 상태를 안전하게 표현할 수 있게 합니다.
 * 추천 엔진 입장에서는 이 hook이 제공하는 weatherBand가 기온별 의류 후보 필터와 weatherScore 계산의 기준이 됩니다.
 */
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_WEATHER_LOCATION, fetchCurrentWeather, WeatherLocation, WeatherSnapshot } from '../lib/weather';

interface UseWeatherState {
  data: WeatherSnapshot | null;
  loading: boolean;
  error: string;
  source: 'geolocation' | 'fallback';
}

export function useWeather() {
  const [state, setState] = useState<UseWeatherState>({
    data: null,
    loading: true,
    error: '',
    source: 'fallback',
  });

  // 전달받은 위치로 WeatherSnapshot을 요청하고 hook 상태를 갱신합니다.
  // source를 같이 저장해 UI가 현재 위치 기반인지 fallback 기반인지 표시할 수 있게 합니다.
  const fetchWeather = useCallback(async (location: WeatherLocation, source: UseWeatherState['source']) => {
    setState((prev) => ({ ...prev, loading: true, error: '', source }));
    try {
      const data = await fetchCurrentWeather(location);
      setState({ data, loading: false, error: '', source });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '날씨 정보를 불러오지 못했습니다.',
      }));
    }
  }, []);

  // 위치 권한이 없거나 geolocation이 실패하면 서울 기준 날씨를 사용합니다.
  const fetchFallbackWeather = useCallback(() => {
    void fetchWeather(DEFAULT_WEATHER_LOCATION, 'fallback');
  }, [fetchWeather]);

  // 브라우저 위치 권한을 요청하고, 성공하면 현재 위치 날씨를 가져옵니다.
  // 실패/거부/타임아웃은 모두 fallback 날씨로 연결해 추천 화면이 빈 상태가 되지 않게 합니다.
  const refresh = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      fetchFallbackWeather();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        void fetchWeather(
          {
            latitude,
            longitude,
            label: '현재 위치',
          },
          'geolocation',
        );
      },
      () => fetchFallbackWeather(),
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 1000 * 60 * 10,
      },
    );
  }, [fetchFallbackWeather, fetchWeather]);

  // hook을 처음 사용하는 시점에 자동으로 한 번 날씨를 불러옵니다.
  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
