// ????? ??? ?? ?? ??? ??????.
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Chip, ColorTileGrid, InfoBox, MetricBox, PanelTitle } from '../../components/common';
import { FAMILY_GUIDES, FAMILY_LABELS, PERSONAL_COLOR_MODEL_NOTE, SEASON_DETAILS } from '../../seasonContent';
import type { FinalResult } from '../../types';
import type { PersonalColorRecord } from '../../wardrobeTypes';
import { SEASON_LABELS } from '../../wardrobeConstants';

export function PersonalResult({ result, onRetry }: { result: FinalResult; onRetry: () => void }) {
  const topSeason = SEASON_DETAILS[result.seasonTop1Id];
  const secondSeason = SEASON_DETAILS[result.seasonTop2Id];
  const familyGuide = FAMILY_GUIDES[topSeason.family];
  const adjacentSeasons = topSeason.adjacent.map((id) => SEASON_DETAILS[id]);
  const fusionPhotoPercent = `${Math.round(result.evidence.fusionWeights.photo * 100)}%`;
  const fusionQuestionPercent = `${Math.round(result.evidence.fusionWeights.questionnaire * 100)}%`;
  const bestColors = result.palette.slice(0, 10);
  const similarColors = result.palette.slice(10, 16);

  return (
    <section className="personal-result-page">
      <section className="personal-result-hero panel">
        <span className="result-badge">4계절 대분류 + 12계절 세부 진단</span>
        <h1>{topSeason.title}</h1>
        <p className="result-subtitle">{FAMILY_LABELS[topSeason.family]} 계열 안에서 가장 잘 맞는 세부 시즌</p>
        <p>{topSeason.commonAliasSentence}</p>
        <p className="result-hero-copy">얼굴 색 샘플과 설문 반응을 함께 본 하이브리드 판정입니다. 4계절 대분류 위에 12계절 세부 구조를 올려 결과를 설명합니다.</p>
        <button className="black-button" type="button" onClick={onRetry}><RotateCcw size={16} /> 다시 측정</button>
      </section>

      <div className="result-main-grid">
        <section className="panel result-explain-card">
          <PanelTitle title="왜 이렇게 나왔나요?" />
          <div className="result-pill-row">
            <span>{topSeason.title}</span>
            <span>보통 {topSeason.commonAlias}</span>
            <span>2순위 {secondSeason.title}</span>
          </div>
          <div className="result-copy-stack">
            <p>{topSeason.summary}</p>
            <p>{topSeason.styling}</p>
            <p>{topSeason.whyItFits}</p>
            <p>{result.explanation}</p>
          </div>
          <div className="result-info-grid">
            <InfoBox title="4계절과 12계절의 관계" body={PERSONAL_COLOR_MODEL_NOTE.overview} />
            <InfoBox title="현재 대분류 해석" body={`${familyGuide.title}\n${familyGuide.summary}\n하위 계절: ${familyGuide.seasons}`} />
          </div>
          <InfoBox title="인접 계절 개념" body={PERSONAL_COLOR_MODEL_NOTE.adjacency} chips={adjacentSeasons.map((season) => season.title)} />
        </section>

        <section className="panel result-evidence-card">
          <PanelTitle title="근거 요약" />
          <MetricBox title="사진 신호" value={`${result.evidence.photoSignal.temperature} / ${SEASON_DETAILS[result.evidence.photoSignal.dominantSeasonId].title}`} />
          <MetricBox title="설문 신호" value={`${result.evidence.questionSignal.temperature} / ${result.evidence.questionSignal.clarity}`} />
          <MetricBox title="하이브리드 비율" value={`사진 ${fusionPhotoPercent} / 설문 ${fusionQuestionPercent}`} detail={result.evidence.boundary.note} />
          <MetricBox title="추천 특징" value={`온도감 ${result.recommendationFeatures.preferredTemperature}`} detail={`선명도 ${result.recommendationFeatures.preferredClarity} · 명도 ${result.recommendationFeatures.preferredLightness} · 대비감 ${result.recommendationFeatures.contrastLevel}`} />
          <InfoBox title="보통 이렇게도 불러요" body={`${topSeason.title}은 실무나 상담 현장에서 ${topSeason.commonAlias}처럼 부르는 경우도 많습니다.`} />
        </section>
      </div>

      <div className="result-main-grid color-section-grid">
        <section className="panel">
          <PanelTitle title="잘 어울리는 색상" />
          <p>{topSeason.bestColorDescription}</p>
          <ColorTileGrid colors={bestColors} />
          <InfoBox title="톤이 유사한 보조 활용 색상" body="같은 시즌 안에서 톤이 비슷한 색을 함께 쓰면 자연스럽고 활용 범위도 넓어집니다." colors={similarColors} />
          <section className="avoid-color-box">
            <h3>피해야 하는 색상</h3>
            <p>{topSeason.worstColorsDescription}</p>
            <ColorTileGrid colors={topSeason.worstColors} />
          </section>
        </section>

        <section className="panel result-frame-card">
          <PanelTitle title="색상 해석 프레임" />
          <InfoBox title="HSV 3축 이해" body={PERSONAL_COLOR_MODEL_NOTE.hsv} />
          <InfoBox title="현재 결과에서 중요한 포인트" body="얼굴 샘플 색과 팔레트 거리, 설문에서 드러난 온도감, 선명도, 명도, 대비 반응을 같이 비교한 결과입니다. 단순히 웜/쿨만 보는 것이 아니라 같은 계열 안에서도 밝은 축인지, 부드러운 축인지까지 함께 해석합니다." />
        </section>
      </div>
    </section>
  );
}

// 이전 진단 기록을 보여주고, 과거 결과를 현재 결과로 다시 적용할 수 있게 합니다.
export function PersonalColorHistoryPanel({ history, current, onApply }: { history: PersonalColorRecord[]; current: FinalResult | null; onApply: (record: PersonalColorRecord) => void }) {
  const [selectedRecord, setSelectedRecord] = useState<PersonalColorRecord | null>(null);
  const selectedResult = selectedRecord?.result;
  const selectedSeason = selectedResult ? SEASON_DETAILS[selectedResult.seasonTop1Id] : null;

  return (
    <section className="panel personal-history-panel">
      <PanelTitle title="나의 퍼스널 컬러 기록" />
      {!current && history.length === 0 ? (
        <p>아직 저장된 측정 기록이 없습니다.</p>
      ) : (
        <div className="history-grid">
          {history.map((record, index) => {
            const result = record.result;
            const isCurrent = index === 0 && Boolean(current);
            return (
              <article className={isCurrent ? 'history-card current' : 'history-card'} key={record.id}>
                <button className="history-card-main" type="button" onClick={() => setSelectedRecord(record)}>
                  <span>
                    <small>{new Date(record.measuredAt).toLocaleString('ko-KR')}</small>
                    <strong>{SEASON_LABELS[result.seasonTop1Id]}</strong>
                    <em>2순위 {SEASON_LABELS[result.seasonTop2Id]}</em>
                  </span>
                  <span className="mini-palette">{result.palette.slice(0, 5).map((hex, idx) => <Chip key={`${hex}-${idx}`} hex={hex} />)}</span>
                </button>
                <div className="history-actions">
                  <button className="line-button" type="button" onClick={() => setSelectedRecord(record)}>자세히 보기</button>
                  {isCurrent ? <span className="current-label">현재 적용 중</span> : <button className="black-button" type="button" onClick={() => onApply(record)}>이 결과 적용</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {selectedRecord && selectedResult && selectedSeason && (
        <div className="history-detail-backdrop" role="presentation" onClick={() => setSelectedRecord(null)}>
          <section className="history-detail-modal" role="dialog" aria-modal="true" aria-label="퍼스널 컬러 상세 정보" onClick={(event) => event.stopPropagation()}>
            <div className="history-detail-head">
              <div>
                <small>{new Date(selectedRecord.measuredAt).toLocaleString('ko-KR')}</small>
                <h3>{selectedSeason.title}</h3>
                <p>2순위 {SEASON_LABELS[selectedResult.seasonTop2Id]}</p>
              </div>
              <button className="line-button" type="button" onClick={() => setSelectedRecord(null)}>닫기</button>
            </div>
            <p>{selectedSeason.summary}</p>
            <p>{selectedSeason.styling}</p>
            <section>
              <h4>잘 어울리는 색상</h4>
              <ColorTileGrid colors={selectedResult.palette.slice(0, 10)} compact />
            </section>
            <section>
              <h4>주의할 색상</h4>
              <ColorTileGrid colors={selectedSeason.worstColors} compact />
            </section>
            <div className="history-detail-actions">
              <button className="black-button" type="button" onClick={() => { onApply(selectedRecord); setSelectedRecord(null); }}>이 결과 적용</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

// 단일 outfit 카드 렌더링 (RecommendationList 내부 재사용)
