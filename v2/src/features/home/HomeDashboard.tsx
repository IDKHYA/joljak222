// 홈 화면의 요약 카드와 주요 진입 동선을 구성하는 컴포넌트입니다.
import { ArrowRight, ChevronRight, CloudSun } from 'lucide-react';
import { clothingDisplayImage } from '../../services/clothingDisplay';
import type { useWeather } from '../../hooks/useWeather';
import type { FinalResult } from '../../types';
import type { Page, RecommendationWeatherBand, SavedOutfit, ScoredClothingItem, Wardrobe } from '../../wardrobeTypes';

export function HomeDashboard(props: {
  personalColorResult: FinalResult | null;
  wardrobes: Wardrobe[];
  scoredItems: ScoredClothingItem[];
  savedOutfits: SavedOutfit[];
  weather: ReturnType<typeof useWeather>['data'];
  weatherLoading: boolean;
  weatherError: string;
  weatherSource: 'geolocation' | 'fallback';
  weatherBand: RecommendationWeatherBand;
  refreshWeather: () => void;
  recommendationCount: number;
  go: (page: Page) => void;
  openCatalog: () => void;
  openManual: () => void;
}) {
  const latestOutfit = props.savedOutfits[0];
  const latestItems = latestOutfit?.itemIds.map((id) => props.scoredItems.find((item) => item.id === id)).filter(Boolean) as ScoredClothingItem[] | undefined;
  return (
    <section className="home-grid">
      <button className="home-card home-main-card" type="button" onClick={() => props.go('personal')}>
        <span className="card-kicker">Personal Color</span>
        <h1>나만의 퍼스널컬러 찾기</h1>
        <p>촬영과 설문으로 나의 퍼스널 컬러를 찾고 옷장 추천 기준으로 저장합니다.</p>
        <span className="home-link">측정 시작 <ArrowRight size={16} /></span>
      </button>
      <div className="home-side-actions">
        <button className="home-card" type="button" onClick={props.openCatalog}><h2>나만의 옷장 만들기</h2><p>DB 의류를 골라 빠르게 옷장을 구성합니다.</p></button>
        <button className="home-card" type="button" onClick={props.openManual}><h2>나만의 옷 추가</h2><p>사진 업로드와 직접 입력으로 옷을 추가합니다.</p></button>
        <button className="home-card" type="button" onClick={() => props.go('saved')}><h2>데일리룩 만들기</h2><p>저장한 데일리룩 조합을 하나의 룩 이미지로 편집합니다.</p></button>
      </div>
      <WeatherCard weather={props.weather} loading={props.weatherLoading} error={props.weatherError} source={props.weatherSource} weatherBand={props.weatherBand} refresh={props.refreshWeather} />
      <section className="home-card stat-home">
        <h2>내 옷장 현황</h2>
        <div className="home-stat-grid">
          <span><strong>{props.wardrobes.length}</strong><small>옷장</small></span>
          <span><strong>{props.scoredItems.length}</strong><small>아이템</small></span>
        </div>
      </section>
      <button className="home-card saved-home-card" type="button" onClick={() => props.go('saved')}>
        <h2>최근 데일리룩</h2>
        {latestOutfit ? (
          <>
            <p>{latestOutfit.title} · {latestOutfit.score}점</p>
            <span className="saved-home-preview">
              {latestItems?.slice(0, 4).map((item) => <img key={item.id} src={clothingDisplayImage(item)} alt={item.type} />)}
            </span>
          </>
        ) : <p>아직 저장된 데일리룩이 없습니다.</p>}
      </button>
      <section className="home-card wardrobe-mini-list">
        <h2>내 옷장 목록</h2>
        {props.wardrobes.slice(0, 3).map((wardrobe) => <button key={wardrobe.id} type="button" onClick={() => props.go('wardrobe')}>{wardrobe.name}<ChevronRight size={15} /></button>)}
      </section>
    </section>
  );
}

function WeatherCard({ weather, loading, error, source, weatherBand }: { weather: ReturnType<typeof useWeather>['data']; loading: boolean; error: string; source: 'geolocation' | 'fallback'; weatherBand: RecommendationWeatherBand; refresh: () => void }) {
  return (
    <section className="home-card weather-card">
      <div>
        <div className="weather-title"><CloudSun size={18} /><h2>실시간 날씨</h2></div>
        <p>{loading ? '날씨 정보를 불러오는 중입니다.' : error || (weather ? `${weather.locationLabel} · ${Math.round(weather.temperature)}도 · ${weather.weatherText}` : '날씨 정보 없음')}</p>
        <div className="weather-advice-row">
          <span>미세먼지 : {formatDustValue(weather?.airQuality?.pm10)}</span>
          <span>초미세먼지 : {formatDustValue(weather?.airQuality?.pm25)}</span>
          <span>마스크 : {weather?.airQuality?.maskRecommendation ?? '정보 확인 중'}</span>
          <span>{weather?.shouldCarryUmbrella ? `우산 챙기기 · ${weather.umbrellaReason}` : '우산 필요 낮음'}</span>
        </div>
        <small>{source === 'geolocation' ? '현재 위치 기반' : '서울 기준'} · 추천 구간 {weatherBand}</small>
      </div>
    </section>
  );
}

function formatDustValue(value: number | null | undefined) {
  return value == null ? '확인 중' : String(Math.round(value));
}

// 옷장 페이지의 상태 분기 컴포넌트입니다. 목록/상세/카탈로그/수동등록 화면을 현재 view에 따라 전환합니다.
