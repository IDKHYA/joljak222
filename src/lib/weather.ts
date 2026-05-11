/*
 * weather.ts
 *
 * 추천 도메인에서 사용하는 날씨 데이터 수집과 기온 구간 변환을 담당합니다.
 * Open-Meteo Forecast API, Open-Meteo Air Quality API, BigDataCloud reverse geocode를 조합해
 * 현재 기온, 체감온도, 날씨 상태, 강수/우산 정보, 미세먼지, 위치 라벨을 WeatherSnapshot으로 정규화합니다.
 *
 * 추천 엔진은 여기서 만든 weatherBand를 사용해 의류 후보를 필터링하고 weatherScore를 계산합니다.
 * API 실패나 위치 권한 실패는 useWeather.ts에서 fallback 위치와 함께 처리되며,
 * 이 파일은 외부 응답을 앱 내부에서 쓰기 쉬운 결정적인 데이터 구조로 바꾸는 역할을 합니다.
 */
export type WeatherBand =
  | '4도 이하'
  | '5~8도'
  | '9~11도'
  | '12~16도'
  | '17~19도'
  | '20~22도'
  | '23~27도'
  | '28도 이상';

export const WEATHER_BANDS: WeatherBand[] = [
  '4도 이하',
  '5~8도',
  '9~11도',
  '12~16도',
  '17~19도',
  '20~22도',
  '23~27도',
  '28도 이상',
];

export interface WeatherSnapshot {
  locationLabel: string;
  latitude: number;
  longitude: number;
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  weatherText: string;
  precipitation: number;
  precipitationProbability: number;
  shouldCarryUmbrella: boolean;
  umbrellaReason: string;
  isDay: boolean;
  windSpeed: number;
  airQuality: AirQualitySnapshot | null;
  maxTemperature?: number;
  minTemperature?: number;
  weatherBand: WeatherBand;
  fetchedAt: string;
}

export interface AirQualitySnapshot {
  pm10: number | null;
  pm25: number | null;
  europeanAqi: number | null;
  dustGrade: '좋음' | '보통' | '나쁨' | '매우 나쁨' | '정보 없음';
  maskRequired: boolean;
  maskRecommendation: string;
}

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  label: string;
}

export const DEFAULT_WEATHER_LOCATION: WeatherLocation = {
  latitude: 37.5665,
  longitude: 126.978,
  label: '서울 기준',
};

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: '맑음',
  1: '대체로 맑음',
  2: '부분적으로 흐림',
  3: '흐림',
  45: '안개',
  48: '서리 안개',
  51: '약한 이슬비',
  53: '이슬비',
  55: '강한 이슬비',
  61: '약한 비',
  63: '비',
  65: '강한 비',
  71: '약한 눈',
  73: '눈',
  75: '강한 눈',
  80: '약한 소나기',
  81: '소나기',
  82: '강한 소나기',
  95: '뇌우',
  96: '우박 동반 뇌우',
  99: '강한 우박 동반 뇌우',
};

const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]);

// 실제 기온을 추천 엔진이 이해하는 8개 착장 구간으로 변환합니다.
// App.tsx는 이 문자열을 기준으로 의류의 seasonTag/키워드를 필터링합니다.
export function getWeatherBandFromTemperature(temperature: number): WeatherBand {
  if (temperature <= 4) return '4도 이하';
  if (temperature <= 8) return '5~8도';
  if (temperature <= 11) return '9~11도';
  if (temperature <= 16) return '12~16도';
  if (temperature <= 19) return '17~19도';
  if (temperature <= 22) return '20~22도';
  if (temperature <= 27) return '23~27도';
  return '28도 이상';
}

// PM10/PM2.5 수치를 사용자가 이해하기 쉬운 미세먼지 등급으로 단순화합니다.
function getDustGrade(pm10: number | null, pm25: number | null): AirQualitySnapshot['dustGrade'] {
  if (pm10 == null && pm25 == null) return '정보 없음';
  if ((pm25 ?? 0) > 75 || (pm10 ?? 0) > 150) return '매우 나쁨';
  if ((pm25 ?? 0) > 35 || (pm10 ?? 0) > 80) return '나쁨';
  if ((pm25 ?? 0) > 15 || (pm10 ?? 0) > 30) return '보통';
  return '좋음';
}

// 외부 API의 대기질 값을 앱 내부 WeatherSnapshot에 넣을 구조로 정리합니다.
function buildAirQuality(pm10: number | null, pm25: number | null, europeanAqi: number | null): AirQualitySnapshot {
  const dustGrade = getDustGrade(pm10, pm25);
  const maskRequired = dustGrade === '나쁨' || dustGrade === '매우 나쁨';
  return {
    pm10,
    pm25,
    europeanAqi,
    dustGrade,
    maskRequired,
    maskRecommendation: maskRequired ? '마스크 착용 권장' : dustGrade === '정보 없음' ? '미세먼지 정보 없음' : '마스크 선택',
  };
}

// 날씨 코드, 강수량, 강수확률을 종합해 우산 필요 여부와 이유를 만듭니다.
function buildUmbrellaAdvice(weatherCode: number, precipitation: number, precipitationProbability: number) {
  if (RAIN_CODES.has(weatherCode) || precipitation >= 0.1 || precipitationProbability >= 55) {
    return {
      shouldCarryUmbrella: true,
      umbrellaReason: precipitationProbability >= 55 ? `강수 확률 ${precipitationProbability}%` : '비 예보 있음',
    };
  }
  return {
    shouldCarryUmbrella: false,
    umbrellaReason: '우산 필요 낮음',
  };
}

// Open-Meteo Air Quality API를 호출합니다.
// 대기질은 추천을 막는 핵심 조건은 아니므로 실패 시 null로 조용히 fallback합니다.
async function fetchAirQuality(location: WeatherLocation): Promise<AirQualitySnapshot | null> {
  try {
    const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
    url.searchParams.set('latitude', String(location.latitude));
    url.searchParams.set('longitude', String(location.longitude));
    url.searchParams.set('current', 'pm10,pm2_5,european_aqi');
    url.searchParams.set('timezone', 'auto');

    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const payload = await response.json();
    const current = payload.current;
    if (!current) return null;
    return buildAirQuality(
      current.pm10 == null ? null : Number(current.pm10),
      current.pm2_5 == null ? null : Number(current.pm2_5),
      current.european_aqi == null ? null : Number(current.european_aqi),
    );
  } catch {
    return null;
  }
}

// 좌표를 사용자가 읽을 수 있는 위치명으로 바꿉니다.
// 실패하면 전달받은 fallback label을 그대로 사용해 날씨 기능이 중단되지 않게 합니다.
async function fetchLocationName(location: WeatherLocation): Promise<string> {
  if (location.label === DEFAULT_WEATHER_LOCATION.label) return location.label;
  try {
    const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
    url.searchParams.set('latitude', String(location.latitude));
    url.searchParams.set('longitude', String(location.longitude));
    url.searchParams.set('localityLanguage', 'ko');

    const response = await fetch(url.toString());
    if (!response.ok) return location.label;
    const payload = await response.json();
    const parts = [
      payload.city,
      payload.locality,
      payload.principalSubdivision,
    ].filter(Boolean);
    return [...new Set(parts)].slice(0, 2).join(' ') || location.label;
  } catch {
    return location.label;
  }
}

// 현재 날씨, 강수확률, 일 최고/최저, 대기질, 위치명을 병렬로 가져와 WeatherSnapshot으로 정규화합니다.
// UI와 추천 엔진은 외부 API 원본이 아니라 이 정규화된 객체만 사용합니다.
export async function fetchCurrentWeather(location: WeatherLocation): Promise<WeatherSnapshot> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,precipitation,rain,showers,snowfall');
  url.searchParams.set('hourly', 'precipitation_probability');
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'auto');

  const [response, airQuality, locationLabel] = await Promise.all([
    fetch(url.toString()),
    fetchAirQuality(location),
    fetchLocationName(location),
  ]);
  if (!response.ok) throw new Error(`날씨 API 요청에 실패했습니다. (${response.status})`);

  const payload = await response.json();
  const current = payload.current;
  const daily = payload.daily;
  if (!current) throw new Error('현재 날씨 데이터를 찾을 수 없습니다.');

  const temperature = Number(current.temperature_2m ?? 0);
  const weatherCode = Number(current.weather_code ?? -1);
  const precipitation = Number(current.precipitation ?? current.rain ?? current.showers ?? current.snowfall ?? 0);
  const precipitationProbability = Math.max(...(payload.hourly?.precipitation_probability?.slice(0, 6) ?? [0]).map((value: number) => Number(value ?? 0)));
  const umbrella = buildUmbrellaAdvice(weatherCode, precipitation, precipitationProbability);

  return {
    locationLabel,
    latitude: location.latitude,
    longitude: location.longitude,
    temperature,
    apparentTemperature: Number(current.apparent_temperature ?? temperature),
    weatherCode,
    weatherText: WEATHER_CODE_LABELS[weatherCode] ?? '날씨 정보',
    precipitation,
    precipitationProbability,
    shouldCarryUmbrella: umbrella.shouldCarryUmbrella,
    umbrellaReason: umbrella.umbrellaReason,
    isDay: Boolean(current.is_day),
    windSpeed: Number(current.wind_speed_10m ?? 0),
    airQuality,
    maxTemperature: daily?.temperature_2m_max?.[0],
    minTemperature: daily?.temperature_2m_min?.[0],
    weatherBand: getWeatherBandFromTemperature(temperature),
    fetchedAt: new Date().toISOString(),
  };
}
