// ?? ?? ??? ?? ?? ??? ??????.
import React, { useMemo, useState } from 'react';
import { Check, CloudSun, Search, Sparkles } from 'lucide-react';
import { BackTitle, EmptyState } from '../../components/common';
import { clothingDisplayImage } from '../../services/clothingDisplay';
import { groupByColorCombo, HARMONY_BADGE_KO, scoreGrade } from '../../services/recommendationEngine';
import type { useWeather } from '../../hooks/useWeather';
import type { FinalResult } from '../../types';
import type { OutfitRecommendation, RecommendationMode, RecommendationWeatherBand, ScoredClothingItem, Wardrobe } from '../../wardrobeTypes';
import { WEATHER_BANDS } from '../../lib/weather';
import { RECOMMENDATION_MODES, SEASON_LABELS } from '../../wardrobeConstants';

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
}

export function RecommendationDashboard(props: {
  personalColorResult: FinalResult;
  wardrobes: Wardrobe[];
  items: ScoredClothingItem[];
  selectedWardrobes: Set<string>;
  setSelectedWardrobes: React.Dispatch<React.SetStateAction<Set<string>>>;
  search: string;
  setSearch: (value: string) => void;
  mode: RecommendationMode;
  setMode: (value: RecommendationMode) => void;
  weatherBand: RecommendationWeatherBand;
  setWeatherBand: (value: RecommendationWeatherBand) => void;
  weather: ReturnType<typeof useWeather>['data'];
  weatherLoading: boolean;
  weatherError: string;
  weatherSource: 'geolocation' | 'fallback';
  refreshWeather: () => void;
  recommendations: OutfitRecommendation[];
  requested: boolean;
  setRequested: (value: boolean) => void;
  onSave: (outfit: OutfitRecommendation) => void;
  onBack: () => void;
}) {
  const [weatherExpanded, setWeatherExpanded] = useState(false);
  const [wardrobePickerOpen, setWardrobePickerOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(() => !isMobileViewport());
  const filteredWardrobes = props.wardrobes.filter((wardrobe) => wardrobe.name.toLowerCase().includes(props.search.toLowerCase()));
  const selectedItems = props.items.filter((item) => props.selectedWardrobes.has(item.wardrobeId));
  const topCount = selectedItems.filter((item) => item.category === '상의').length;
  const bottomCount = selectedItems.filter((item) => item.category === '하의').length;
  const neutralCount = selectedItems.filter((item) => item.isNeutral || item.isDenim).length;
  const unavailableCount = selectedItems.filter((item) => item.availabilityStatus !== '보유중').length;
  const canRecommend = props.selectedWardrobes.size > 0 && topCount > 0 && bottomCount > 0;
  const allFilteredSelected = filteredWardrobes.length > 0 && filteredWardrobes.every((wardrobe) => props.selectedWardrobes.has(wardrobe.id));

  const toggleWardrobe = (id: string) => {
    props.setSelectedWardrobes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    props.setRequested(false);
  };

  const toggleAll = () => {
    props.setSelectedWardrobes((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredWardrobes.forEach((wardrobe) => next.delete(wardrobe.id));
      } else {
        filteredWardrobes.forEach((wardrobe) => next.add(wardrobe.id));
      }
      return next;
    });
    props.setRequested(false);
  };

  return (
    <section className="recommend-page">
      <BackTitle title="AI 옷장 추천" description="" onBack={props.onBack} />
      <div className="recommend-layout">
        <div className="recommend-main">
          <section className="recommend-choice-panel">
            <section className="recommend-weather-card">
              <div className="recommend-card-head">
                <div><h2><CloudSun size={17} /> 실시간 날씨</h2></div>
                <button className="line-button compact-toggle" type="button" onClick={() => setWeatherExpanded((prev) => !prev)}>{weatherExpanded ? '접기' : '펼치기'}</button>
              </div>
              <div className="weather-info-grid compact-weather">
                <span><small>현재 위치</small><strong>{props.weatherLoading ? '확인 중' : props.weather?.locationLabel ?? (props.weatherSource === 'fallback' ? '서울 기준' : '현재 위치')}</strong></span>
                <span><small>현재 기온</small><strong>{props.weather ? `${Math.round(props.weather.temperature)}도` : '-'}</strong></span>
                <span><small>날씨 상태</small><strong>{props.weatherError || props.weather?.weatherText || '정보 없음'}</strong></span>
                <span><small>추천 구간</small><strong>{props.weatherBand}</strong></span>
                {weatherExpanded && (
                  <>
                    <span><small>미세먼지</small><strong>{formatDustValue(props.weather?.airQuality?.pm10)}</strong></span>
                    <span><small>초미세먼지</small><strong>{formatDustValue(props.weather?.airQuality?.pm25)}</strong></span>
                    <span><small>마스크</small><strong>{props.weather?.airQuality?.maskRecommendation ?? '정보 확인 중'}</strong></span>
                    <span><small>외출 준비</small><strong>{props.weather?.shouldCarryUmbrella ? `우산 챙기기 · ${props.weather.umbrellaReason}` : '우산 필요 낮음'}</strong></span>
                  </>
                )}
              </div>
            </section>

            <section className="recommend-control-panel">
              <div className="fixed-season"><span>퍼스널컬러</span><strong>{SEASON_LABELS[props.personalColorResult.seasonTop1Id]}</strong></div>
              <label><span>상황</span><select value={props.mode} onChange={(event) => props.setMode(event.target.value as RecommendationMode)}>{RECOMMENDATION_MODES.map((mode) => <option key={mode}>{mode}</option>)}</select></label>
              <label><span>날씨</span><select value={props.weatherBand} onChange={(event) => props.setWeatherBand(event.target.value as RecommendationWeatherBand)}><option>상관없음</option>{WEATHER_BANDS.map((band) => <option key={band}>{band}</option>)}</select></label>
            </section>

            <button className="black-button full" type="button" onClick={() => setWardrobePickerOpen(true)}>옷장 선택 {props.selectedWardrobes.size}개</button>
          </section>

          {wardrobePickerOpen && <div className="picker-backdrop" role="presentation" onClick={() => setWardrobePickerOpen(false)} />}
          <div className={wardrobePickerOpen ? 'recommend-wardrobe-picker open' : 'recommend-wardrobe-picker'}>
            <div className="picker-head">
              <h2>옷장 선택</h2>
              <button className="line-button" type="button" onClick={() => setWardrobePickerOpen(false)}>닫기</button>
            </div>
            <label className="search-field"><Search size={16} /><input value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="옷장 검색" /></label>
            <button className="line-button full" type="button" onClick={toggleAll}>{allFilteredSelected ? '전체 해제' : '전체 선택'}</button>
            <div className="recommend-wardrobe-grid">
            {filteredWardrobes.map((wardrobe) => {
              const wardrobeItems = props.items.filter((item) => item.wardrobeId === wardrobe.id);
              const selected = props.selectedWardrobes.has(wardrobe.id);
              return (
                <button key={wardrobe.id} className={selected ? 'recommend-wardrobe-card selected' : 'recommend-wardrobe-card'} type="button" onClick={() => toggleWardrobe(wardrobe.id)}>
                  <span className="recommend-mosaic">{Array.from({ length: 4 }).map((_, index) => wardrobeItems[index] ? <img key={wardrobeItems[index].id} src={clothingDisplayImage(wardrobeItems[index])} alt={wardrobeItems[index].type} /> : <i key={index} />)}</span>
                  <span className="recommend-card-body">
                    <strong>{wardrobe.name}</strong>
                    <small>{wardrobeItems.length}개의 아이템</small>
                    <span className="pill-row"><span>상의 {wardrobeItems.filter((item) => item.category === '상의').length}</span><span>하의 {wardrobeItems.filter((item) => item.category === '하의').length}</span></span>
                  </span>
                  <span className="recommend-check">{selected && <Check size={16} />}</span>
                </button>
              );
            })}
            </div>
          </div>
          <button className="recommend-action-button mobile-only-action" type="button" disabled={!canRecommend} onClick={() => props.setRequested(true)}><Sparkles size={16} /> 추천 받기</button>
        </div>

        <aside className="recommend-summary-panel">
          <button className="summary-toggle" type="button" onClick={() => setSummaryExpanded((prev) => !prev)}>
            <span><Sparkles size={18} /> 추천 요약</span>
            <strong>{summaryExpanded ? '접기' : '펼치기'}</strong>
          </button>
          {summaryExpanded && (
            <>
              <dl>
                <div><dt>퍼스널컬러</dt><dd>{SEASON_LABELS[props.personalColorResult.seasonTop1Id]}</dd></div>
                <div><dt>추천 상황</dt><dd>{props.mode}</dd></div>
                <div><dt>날씨 구간</dt><dd>{props.weatherBand}</dd></div>
                <div><dt>선택 옷장</dt><dd>{props.selectedWardrobes.size}개</dd></div>
                <div><dt>전체 의류</dt><dd>{selectedItems.length}개</dd></div>
              </dl>
              <section className="recommend-ready-box">
                <h3>추천 가능 여부</h3>
                <div className="summary-grid compact">
                  <span><small>상의</small><strong>{topCount}개</strong></span>
                  <span><small>하의</small><strong>{bottomCount}개</strong></span>
                  <span><small>무채색</small><strong>{neutralCount}개</strong></span>
                  <span><small>상태</small><strong>{unavailableCount > 0 ? '보완 필요' : '양호'}</strong></span>
                </div>
                {!canRecommend && <p>최소 상의 1개와 하의 1개가 포함된 옷장을 선택해주세요.</p>}
              </section>
            </>
          )}
          <button className="recommend-action-button desktop-only-action" type="button" disabled={!canRecommend} onClick={() => props.setRequested(true)}><Sparkles size={16} /> 추천 받기</button>
        </aside>
        <section className="recommend-results">
          {props.requested && (
            props.recommendations.length === 0
              ? <EmptyState title="추천 가능한 조합이 부족합니다." description="선택한 옷장에 상의와 하의를 함께 추가해 주세요." />
              : <RecommendationList recommendations={props.recommendations} onSave={props.onSave} />
          )}
        </section>
      </div>
    </section>
  );
}

// 현재 날씨와 추천에 사용되는 기온 구간을 보여주는 카드입니다.
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

// 미세먼지 값이 없을 때 UI에 '-'로 표시하기 위한 포맷 함수입니다.
function formatDustValue(value: number | null | undefined) {
  return value == null ? '확인 중' : String(Math.round(value));
}

// 퍼스널컬러 최종 결과 요약 카드입니다. 홈/결과 화면에서 시즌과 추천 특징을 빠르게 보여줍니다.
function OutfitCard({ outfit, onSave }: { key?: React.Key; outfit: OutfitRecommendation; onSave: (outfit: OutfitRecommendation) => void }) {
  return (
    <article className="panel outfit-card" key={outfit.id}>
      <div className="result-head">
        <div>
          <h3>{outfit.title}</h3>
          <div className="outfit-meta-row">
            <span className="harmony-badge">{HARMONY_BADGE_KO[outfit.harmonyType] ?? outfit.harmonyType}</span>
            <span className="outfit-band-tag">{outfit.weatherBand}</span>
          </div>
        </div>
        <div className="score-circle">
          <strong>{outfit.score}</strong>
          <span>점</span>
        </div>
      </div>
      <div className="outfit-color-strip">
        {outfit.items.map((item) => (
          <span key={item.id} className="outfit-color-swatch" style={{ background: item.representativeHex }} title={item.type} />
        ))}
      </div>
      <div className="recommend-item-strip">
        {outfit.items.map((item) => (
          <div key={item.id} className="outfit-item-thumb">
            <img src={clothingDisplayImage(item)} alt={item.type} />
            {item.fitGrade && <span className={`fit-badge fit-${item.fitGrade.toLowerCase()}`}>{item.fitGrade}</span>}
            <span className="item-type-label">{item.type}</span>
          </div>
        ))}
      </div>
      <div className="score-grade-row">
        <span title={`퍼스널컬러 적합도 ${outfit.personalScore}점`}>퍼컬 <strong className={`grade-${scoreGrade(outfit.personalScore)}`}>{scoreGrade(outfit.personalScore)}</strong></span>
        <span title={`색상 조화도 ${outfit.harmonyScore}점`}>조화 <strong className={`grade-${scoreGrade(outfit.harmonyScore)}`}>{scoreGrade(outfit.harmonyScore)}</strong></span>
        <span title={`날씨 적합도 ${outfit.weatherScore}점`}>날씨 <strong className={`grade-${scoreGrade(outfit.weatherScore)}`}>{scoreGrade(outfit.weatherScore)}</strong></span>
      </div>
      <div className="recommendation-reason-panel">
        <div className="reason-score-bars" aria-label="추천 점수 구성">
          {[
            ['퍼컬', outfit.scoreBreakdown.personal, outfit.personalScore],
            ['날씨', outfit.scoreBreakdown.weather, outfit.weatherScore],
            ['조화', outfit.scoreBreakdown.harmony, outfit.harmonyScore],
            ['안정', outfit.scoreBreakdown.stability, outfit.stabilityScore],
          ].map(([label, contribution, rawScore]) => (
            <div className="reason-score-row" key={label}>
              <span>{label}</span>
              <div className="reason-score-track">
                <i style={{ width: `${Math.max(6, Number(rawScore))}%` }} />
              </div>
              <strong>{contribution}</strong>
            </div>
          ))}
        </div>
        <ul className="reason-bullet-list">
          {outfit.explanationBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>
      <button className="line-button" onClick={() => onSave(outfit)}>데일리룩 저장</button>
    </article>
  );
}

// 계산된 코디 추천 결과를 색상 조합 pill 필터 + 카드 그리드로 보여줍니다.
function RecommendationList({ recommendations, onSave }: { recommendations: OutfitRecommendation[]; onSave: (outfit: OutfitRecommendation) => void }) {
  const groups = useMemo(() => groupByColorCombo(recommendations), [recommendations]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const scoreAudit = useMemo(() => {
    const count = recommendations.length || 1;
    const averageBase = Math.round(recommendations.reduce((sum, outfit) => sum + outfit.baseScore, 0) / count);
    const averageFinal = Math.round(recommendations.reduce((sum, outfit) => sum + outfit.score, 0) / count);
    const averageAdjustment = Math.round(recommendations.reduce((sum, outfit) => sum + outfit.qualityAdjustment, 0) / count);
    return { averageBase, averageFinal, averageAdjustment };
  }, [recommendations]);

  const displayed = selectedKey
    ? (groups.find((g) => g.key === selectedKey)?.outfits ?? [])
    : recommendations;

  return (
    <section className="recommendation-scroll-box">
      <div className="score-audit-panel">
        <strong>추천 점수 진단</strong>
        <span>기존 축 평균 {scoreAudit.averageBase}점</span>
        <span>코디 보정 후 {scoreAudit.averageFinal}점</span>
        <span className={scoreAudit.averageAdjustment >= 0 ? 'positive' : 'negative'}>
          평균 변화 {scoreAudit.averageAdjustment >= 0 ? '+' : ''}{scoreAudit.averageAdjustment}점
        </span>
      </div>
      {/* 색상 조합 필터 pills */}
      <div className="color-combo-tabs">
        <button
          className={`color-combo-pill${selectedKey === null ? ' active' : ''}`}
          onClick={() => setSelectedKey(null)}
        >
          전체 <span className="pill-count">{recommendations.length}</span>
        </button>
        {groups.map((group) => (
          <button
            key={group.key}
            className={`color-combo-pill${selectedKey === group.key ? ' active' : ''}`}
            onClick={() => setSelectedKey(group.key)}
          >
            <span className="pill-swatch" style={{ background: group.topHex }} />
            <span className="pill-swatch" style={{ background: group.bottomHex }} />
            {group.label}
            <span className="pill-count">{group.outfits.length}</span>
          </button>
        ))}
      </div>
      {/* outfit 카드 */}
      <div className="outfit-grid">
        {displayed.map((outfit) => (
          <OutfitCard key={outfit.id} outfit={outfit} onSave={onSave} />
        ))}
      </div>
    </section>
  );
}

// 저장된 추천 코디의 자동 배치 상태를 카드용 보드 미리보기로 렌더링합니다.
