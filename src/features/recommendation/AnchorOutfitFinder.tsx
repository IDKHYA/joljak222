// 기준 옷 한 벌을 중심으로 어울리는 코디를 찾아 주는 오버레이 화면
import { useMemo, useState } from 'react';
import { BriefcaseBusiness, Heart, Shirt, Sparkles, X } from 'lucide-react';
import { OutfitCard } from './RecommendationDashboard';
import { clothingDisplayImage } from '../../services/clothingDisplay';
import { buildAnchoredRecommendations } from '../../services/recommendationEngine';
import type { FinalResult } from '../../types';
import type { OutfitRecommendation, RecommendationMode, ScoredClothingItem } from '../../wardrobeTypes';

// 상대 옷을 어디서 가져올지 사용자가 고르는 출처 토글입니다.
type PoolSource = 'both' | 'wardrobe' | 'catalog';

const SOURCE_OPTIONS: { key: PoolSource; label: string; description: string }[] = [
  { key: 'both', label: '옷장 + 카탈로그', description: '가진 옷과 새 후보를 함께 봅니다.' },
  { key: 'wardrobe', label: '내 옷장', description: '지금 가진 옷만 조합합니다.' },
  { key: 'catalog', label: '카탈로그', description: '살 만한 짝을 찾아봅니다.' },
];

const MODE_OPTIONS: { key: RecommendationMode; label: string; description: string; icon: typeof Shirt }[] = [
  { key: '데일리', label: '데일리', description: '편한 일상룩', icon: Shirt },
  { key: '출근', label: '오피스', description: '깔끔한 출근룩', icon: BriefcaseBusiness },
  { key: '데이트', label: '데이트', description: '부드러운 무드', icon: Heart },
];

const ANCHOR_ROLE_LABEL: Record<string, string> = {
  상의: '이 상의',
  하의: '이 하의',
  아우터: '이 아우터',
};

// 기준 옷을 고정하고, 선택한 출처 풀에서 어울리는 코디를 찾아 점수순으로 보여 줍니다.
export function AnchorOutfitFinder(props: {
  anchor: ScoredClothingItem;
  wardrobePool: ScoredClothingItem[];
  catalogPool: ScoredClothingItem[];
  personalColorResult: FinalResult | null;
  onSave: (outfit: OutfitRecommendation) => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState<PoolSource>('both');
  const [mode, setMode] = useState<RecommendationMode>('데일리');

  const pool = useMemo(() => {
    if (source === 'wardrobe') return props.wardrobePool;
    if (source === 'catalog') return props.catalogPool;
    return [...props.wardrobePool, ...props.catalogPool];
  }, [source, props.wardrobePool, props.catalogPool]);

  const catalogIds = useMemo(() => new Set(props.catalogPool.map((item) => item.id)), [props.catalogPool]);

  const results = useMemo(
    () => buildAnchoredRecommendations(props.anchor, pool, props.personalColorResult, mode),
    [props.anchor, pool, props.personalColorResult, mode],
  );

  const anchorRole = ANCHOR_ROLE_LABEL[props.anchor.category] ?? '이 옷';
  const ownedCount = props.wardrobePool.length;
  const catalogCount = props.catalogPool.length;
  const bestScore = results[0]?.score;

  return (
    <div className="anchor-finder-backdrop" role="dialog" aria-modal="true">
      <section className="panel anchor-finder-modal">
        <header className="anchor-finder-head">
          <div>
            <span className="anchor-finder-kicker"><Sparkles size={14} /> 코디 추천</span>
            <h2>기준 옷에 어울리는 조합</h2>
            <p>{anchorRole}은 고정하고, 어울리는 나머지 옷만 찾아요.</p>
          </div>
          <button type="button" className="icon-button" onClick={props.onClose} aria-label="닫기"><X size={18} /></button>
        </header>

        <section className="anchor-finder-hero">
          <div className="anchor-finder-anchor-card">
            <div className="anchor-finder-image-frame">
              <img src={clothingDisplayImage(props.anchor)} alt={props.anchor.type} />
            </div>
            <div className="anchor-finder-anchor-info">
              <small>기준 옷</small>
              <strong>{props.anchor.type}</strong>
              <span>{props.anchor.color} · {props.anchor.seasonTag}</span>
            </div>
          </div>

          <div className="anchor-finder-controls">
            <div>
              <h3>추천 방식</h3>
              <div className="anchor-finder-mode" role="tablist" aria-label="추천 방식">
                {MODE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      role="tab"
                      aria-selected={mode === option.key}
                      className={mode === option.key ? 'active' : ''}
                      onClick={() => setMode(option.key)}
                    >
                      <Icon size={18} />
                      <span><strong>{option.label}</strong><small>{option.description}</small></span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3>상대 옷 출처</h3>
              <div className="anchor-finder-source" role="tablist" aria-label="상대 옷 출처">
                {SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="tab"
                    aria-selected={source === option.key}
                    className={source === option.key ? 'active' : ''}
                    onClick={() => setSource(option.key)}
                  >
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="anchor-finder-summary">
              <span><Sparkles size={15} /> 추천 후보 <strong>{results.length}</strong></span>
              <span>내 옷장 <strong>{ownedCount}</strong></span>
              <span>카탈로그 <strong>{catalogCount}</strong></span>
              {bestScore !== undefined && <span>최고 점수 <strong>{bestScore}</strong></span>}
            </div>
          </div>
        </section>

        <div className="anchor-finder-results">
          {results.length === 0 ? (
            <p className="anchor-finder-empty">
              <Sparkles size={16} /> 어울리는 조합을 찾지 못했어요. 다른 출처를 고르거나 옷을 더 추가해 보세요.
            </p>
          ) : (
            <>
              <div className="anchor-finder-result-head">
                <div>
                  <strong>추천 코디</strong>
                  <span>{results.length}개의 조합을 점수순으로 정리했어요.</span>
                </div>
                {bestScore !== undefined && <em>{bestScore}/100</em>}
              </div>
              <div className="anchor-finder-grid">
                {results.map((outfit) => (
                  <OutfitCard key={outfit.id} outfit={outfit} onSave={props.onSave} catalogIds={catalogIds} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
