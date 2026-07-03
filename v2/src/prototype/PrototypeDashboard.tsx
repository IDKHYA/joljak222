// v2 골든 패스 첫 화면을 구성하는 React 애플리케이션이다.
import { Check, CloudSun, Layers3, Save, Shirt, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createGoldenPathModel } from '../app/goldenPathModel';
import { buildDistinctOutfitRecommendations } from '../domain/recommendationEngine';
import { defaultPersonalColor, defaultWardrobePresetItems } from '../domain/presetData';
import type { OutfitRecommendation, WeatherInput } from '../domain/types';

const weatherOptions: Array<{ label: string; weather: WeatherInput }> = [
  { label: '18도', weather: { band: 'mild', temperatureCelsius: 18, source: 'manual' } },
  { label: '8도', weather: { band: 'cold', temperatureCelsius: 8, source: 'manual' } },
  { label: '27도', weather: { band: 'hot', temperatureCelsius: 27, source: 'manual' } },
];

export function App() {
  const [weather, setWeather] = useState<WeatherInput>(weatherOptions[0].weather);
  const model = useMemo(() => createGoldenPathModel(weather), [weather]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedLookId, setSavedLookId] = useState<string | null>(null);
  const recommendationResult = useMemo(
    () =>
      buildDistinctOutfitRecommendations({
        items: defaultWardrobePresetItems,
        personalColor: defaultPersonalColor,
        weather,
        count: 3,
      }),
    [weather],
  );
  const recommendations = recommendationResult.recommendations;
  const selectedRecommendation =
    recommendations.find((recommendation) => recommendation.id === selectedId) ?? recommendations[0] ?? null;
  const savedRecommendation = recommendations.find((recommendation) => recommendation.id === savedLookId) ?? null;

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="v2 골든 패스 단계">
        <div className="brand-mark">V2</div>
        <nav className="rail-nav">
          <a className="rail-link active" href="#diagnosis">
            <Sparkles size={18} /> 진단
          </a>
          <a className="rail-link" href="#wardrobe">
            <Shirt size={18} /> 옷장
          </a>
          <a className="rail-link" href="#recommend">
            <CloudSun size={18} /> 추천
          </a>
          <a className="rail-link" href="#daily-look">
            <Layers3 size={18} /> 데일리룩
          </a>
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">퍼스널컬러 옷장 재구축</p>
            <h1>골든 패스 대시보드</h1>
          </div>
          <div className="status-pill">
            <Check size={16} />
            추천 {model.readiness.distinctOutfitCount}개 성립
          </div>
        </header>

        <section className="control-band" id="diagnosis">
          <div className="diagnosis-panel">
            <div className="panel-heading">
              <Sparkles size={18} />
              <span>퍼컬 결과</span>
            </div>
            <strong>{model.personalColorLabel}</strong>
            <span className="muted">신뢰도 {Math.round(model.personalColor.confidence * 100)}%</span>
            <div className="palette-row" aria-label="추천 팔레트">
              {model.personalColor.paletteHexes.map((hex) => (
                <span key={hex} className="swatch" style={{ backgroundColor: hex }} title={hex} />
              ))}
            </div>
          </div>

          <div className="weather-panel">
            <div className="panel-heading">
              <CloudSun size={18} />
              <span>날씨 오버라이드</span>
            </div>
            <div className="segmented">
              {weatherOptions.map((option) => (
                <button
                  key={option.label}
                  className={option.weather.band === weather.band ? 'segment active' : 'segment'}
                  type="button"
                  onClick={() => setWeather(option.weather)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="muted">현재 {weather.temperatureCelsius}도 기준</span>
          </div>
        </section>

        <section className="main-grid">
          <div className="wardrobe-surface" id="wardrobe">
            <div className="section-title">
              <Shirt size={19} />
              <h2>소프트 서머 캐주얼 프리셋</h2>
            </div>
            <div className="wardrobe-grid">
              {model.wardrobeItems.map((item) => (
                <article className="item-tile" key={item.id}>
                  <img src={item.image.storedUrl} alt={item.displayName} />
                  <div>
                    <strong>{item.displayName}</strong>
                    <span>{item.typeLabel}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="recommend-surface" id="recommend">
            <div className="section-title">
              <CloudSun size={19} />
              <h2>겹치지 않는 추천</h2>
            </div>
            <div className="recommend-list">
              {recommendations.map((recommendation) => (
                <OutfitCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  selected={selectedRecommendation?.id === recommendation.id}
                  saved={savedLookId === recommendation.id}
                  onSelect={() => setSelectedId(recommendation.id)}
                  onSave={() => setSavedLookId(recommendation.id)}
                />
              ))}
            </div>
          </div>

          <div className="daily-look-surface" id="daily-look">
            <div className="section-title">
              <Layers3 size={19} />
              <h2>데일리룩 캔버스</h2>
            </div>
            {selectedRecommendation ? (
              <DailyLookPreview recommendation={selectedRecommendation} saved={savedRecommendation?.id === selectedRecommendation.id} />
            ) : (
              <div className="empty-state">{model.issues[0] ?? '추천을 생성할 수 없습니다.'}</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function OutfitCard({
  recommendation,
  selected,
  saved,
  onSelect,
  onSave,
}: {
  recommendation: OutfitRecommendation;
  selected: boolean;
  saved: boolean;
  onSelect: () => void;
  onSave: () => void;
}) {
  return (
    <article className={selected ? 'outfit-card selected' : 'outfit-card'}>
      <button className="outfit-main" type="button" onClick={onSelect}>
        <div className="mini-stack">
          {recommendation.items.map((item) => (
            <img key={item.id} src={item.image.storedUrl} alt="" />
          ))}
        </div>
        <div className="outfit-copy">
          <strong>{recommendation.title}</strong>
          <span>총점 {Math.round(recommendation.totalScore)}점</span>
          <small>{recommendation.reasons[0]}</small>
        </div>
      </button>
      <div className="score-grid" aria-label="추천 점수 분해">
        <ScoreLabel label="퍼컬" value={recommendation.scoreBreakdown.personalColor} />
        <ScoreLabel label="날씨" value={recommendation.scoreBreakdown.weather} />
        <ScoreLabel label="조화" value={recommendation.scoreBreakdown.harmony} />
        <ScoreLabel label="안정" value={recommendation.scoreBreakdown.stability} />
      </div>
      <button className={saved ? 'save-button saved' : 'save-button'} type="button" onClick={onSave}>
        <Save size={16} />
        {saved ? '저장됨' : '저장'}
      </button>
    </article>
  );
}

function ScoreLabel({ label, value }: { label: string; value: number }) {
  return (
    <span className="score-label">
      <span>{label}</span>
      <strong>{Math.round(value)}</strong>
    </span>
  );
}

function DailyLookPreview({ recommendation, saved }: { recommendation: OutfitRecommendation; saved: boolean }) {
  return (
    <div className="daily-look">
      <div className="canvas-preview">
        {recommendation.items.map((item, index) => (
          <img key={item.id} className={`canvas-item item-${index}`} src={item.image.storedUrl} alt={item.displayName} />
        ))}
      </div>
      <div className="daily-summary">
        <strong>{recommendation.title}</strong>
        <span>{recommendation.items.map((item) => item.displayName).join(' · ')}</span>
        <p>{recommendation.reasons[2]}</p>
        <div className={saved ? 'export-state ready' : 'export-state'}>
          <Save size={16} />
          {saved ? 'PNG 내보내기 준비' : '추천을 저장하면 내보내기 가능'}
        </div>
      </div>
    </div>
  );
}
