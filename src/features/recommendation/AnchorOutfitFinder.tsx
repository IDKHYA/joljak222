// 기준 옷 한 벌을 중심으로 어울리는 코디를 찾아 주는 오버레이 화면
import { useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { OutfitCard } from './RecommendationDashboard';
import { clothingDisplayImage } from '../../services/clothingDisplay';
import { buildAnchoredRecommendations } from '../../services/recommendationEngine';
import type { FinalResult } from '../../types';
import type { OutfitRecommendation, ScoredClothingItem } from '../../wardrobeTypes';

// 상대 옷을 어디서 가져올지 사용자가 고르는 출처 토글입니다.
type PoolSource = 'both' | 'wardrobe' | 'catalog';

const SOURCE_OPTIONS: { key: PoolSource; label: string }[] = [
  { key: 'both', label: '옷장 + 카탈로그' },
  { key: 'wardrobe', label: '내 옷장' },
  { key: 'catalog', label: '카탈로그' },
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

  const pool = useMemo(() => {
    if (source === 'wardrobe') return props.wardrobePool;
    if (source === 'catalog') return props.catalogPool;
    return [...props.wardrobePool, ...props.catalogPool];
  }, [source, props.wardrobePool, props.catalogPool]);

  const catalogIds = useMemo(() => new Set(props.catalogPool.map((item) => item.id)), [props.catalogPool]);

  const results = useMemo(
    () => buildAnchoredRecommendations(props.anchor, pool, props.personalColorResult),
    [props.anchor, pool, props.personalColorResult],
  );

  const anchorRole = ANCHOR_ROLE_LABEL[props.anchor.category] ?? '이 옷';

  return (
    <div className="anchor-finder-backdrop" role="dialog" aria-modal="true">
      <section className="panel anchor-finder-modal">
        <header className="anchor-finder-head">
          <div className="anchor-finder-anchor">
            <img src={clothingDisplayImage(props.anchor)} alt={props.anchor.type} />
            <div className="anchor-finder-anchor-info">
              <small>기준 옷</small>
              <strong>{props.anchor.type}</strong>
              <span>{anchorRole}에 어울리는 코디를 찾았어요.</span>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={props.onClose} aria-label="닫기"><X size={18} /></button>
        </header>

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
              {option.label}
            </button>
          ))}
        </div>

        <div className="anchor-finder-results">
          {results.length === 0 ? (
            <p className="anchor-finder-empty">
              <Sparkles size={16} /> 어울리는 조합을 찾지 못했어요. 다른 출처를 고르거나 옷을 더 추가해 보세요.
            </p>
          ) : (
            <>
              <p className="anchor-finder-count">{results.length}개의 코디를 찾았어요.</p>
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
