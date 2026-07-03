// 저장한 코디 목록과 데일리룩 제작 진입점을 보여주는 컴포넌트입니다.
import { useMemo, useState } from 'react';
import { Bookmark, Plus, Search, Shirt } from 'lucide-react';
import { Chip, EmptyState, PageTitle } from '../../components/common';
import { clothingDisplayImage, displayClothingColor } from '../../services/clothingDisplay';
import { normalizePatternType } from '../../services/clothingMeta';
import { buildDailyLookState } from '../../services/dailyLook';
import type { RecommendationWeatherBand, SavedOutfit, ScoredClothingItem, Wardrobe } from '../../wardrobeTypes';
import { MATERIAL_LABELS, PATTERN_LABELS } from '../../wardrobeConstants';

function DailyLookBoardPreview({ outfit, items }: { outfit: SavedOutfit; items: ScoredClothingItem[] }) {
  const itemById = new Map<string, ScoredClothingItem>(items.map((item) => [item.id, item]));
  const state = outfit.dailyLookState ?? buildDailyLookState(outfit.itemIds.map((id) => itemById.get(id)).filter(Boolean) as ScoredClothingItem[]);
  return (
    <div className="saved-dailylook-board" aria-label={`${outfit.title} 자동 배치 미리보기`}>
      {[...state.layers].filter((layer) => layer.visible).sort((left, right) => left.zIndex - right.zIndex).map((layer) => {
        const item = itemById.get(layer.itemId);
        if (!item) return null;
        return (
          <div
            className="saved-board-layer"
            key={layer.itemId}
            style={{
              left: `${(layer.x / state.canvas.width) * 100}%`,
              top: `${(layer.y / state.canvas.height) * 100}%`,
              transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
              zIndex: layer.zIndex,
            }}
          >
            <img src={clothingDisplayImage(item)} alt={item.type} />
          </div>
        );
      })}
    </div>
  );
}

// 저장된 추천 코디 목록입니다. 삭제, 가상착용 만들기 진입을 담당합니다.
type SavedOutfitSort = 'recent' | 'score' | 'weather' | 'title';

const WEATHER_SORT_ORDER: Record<RecommendationWeatherBand, number> = {
  '상관없음': 0,
  '4도 이하': 1,
  '5~8도': 2,
  '9~11도': 3,
  '12~16도': 4,
  '17~19도': 5,
  '20~22도': 6,
  '23~27도': 7,
  '28도 이상': 8,
};

// 저장된 추천 코디 목록입니다. 검색, 정렬, 삭제, 데일리룩 만들기 진입을 담당합니다.
export function SavedOutfits({
  saved,
  items,
  wardrobes,
  onDelete,
  onMakeDailyLook,
  onCreateDailyLook,
  onOpenWardrobe,
}: {
  saved: SavedOutfit[];
  items: ScoredClothingItem[];
  wardrobes: Wardrobe[];
  onDelete: (id: string) => void;
  onMakeDailyLook: (id: string) => void;
  onCreateDailyLook: () => void;
  onOpenWardrobe: (wardrobeId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SavedOutfitSort>('recent');
  const wardrobeNameById = useMemo(() => new Map(wardrobes.map((wardrobe) => [wardrobe.id, wardrobe.name])), [wardrobes]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const savedWithItems = useMemo(() => saved.map((outfit) => ({
    outfit,
    outfitItems: outfit.itemIds.map((id) => itemById.get(id)).filter(Boolean) as ScoredClothingItem[],
  })), [itemById, saved]);
  const filteredSaved = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? savedWithItems.filter(({ outfit, outfitItems }) => {
        const haystack = [
          outfit.title,
          outfit.mode,
          outfit.weatherBand,
          String(outfit.score),
          ...outfitItems.flatMap((item) => [item.type, item.color, item.brand, item.category, wardrobeNameById.get(item.wardrobeId) ?? '']),
        ].join(' ').toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      : savedWithItems;

    return [...filtered].sort((left, right) => {
      if (sort === 'score') return right.outfit.score - left.outfit.score;
      if (sort === 'weather') return WEATHER_SORT_ORDER[left.outfit.weatherBand] - WEATHER_SORT_ORDER[right.outfit.weatherBand];
      if (sort === 'title') return left.outfit.title.localeCompare(right.outfit.title, 'ko-KR');
      return new Date(right.outfit.savedAt).getTime() - new Date(left.outfit.savedAt).getTime();
    });
  }, [query, savedWithItems, sort, wardrobeNameById]);

  return (
    <section className="page-stack">
      <div className="dailylook-list-title">
        <PageTitle title="데일리룩" description="추천 화면에서 저장한 조합을 모아보고, 데일리룩 만들기에서 하나의 룩 이미지로 편집합니다." icon={<Bookmark />} />
        <button className="blue-button" type="button" onClick={onCreateDailyLook}><Plus size={16} /> 데일리룩 만들기</button>
      </div>
      <section className="saved-outfit-controls panel">
        <label className="saved-outfit-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="코디명, 옷 종류, 색상, 옷장 검색" />
        </label>
        <label>
          정렬
          <select value={sort} onChange={(event) => setSort(event.target.value as SavedOutfitSort)}>
            <option value="recent">최근순</option>
            <option value="score">점수순</option>
            <option value="weather">날씨순</option>
            <option value="title">이름순</option>
          </select>
        </label>
      </section>
      {saved.length === 0 ? <EmptyState title="저장된 데일리룩이 없습니다." description="추천에서 마음에 드는 조합을 저장하면 여기에 표시됩니다." /> : (
        <div className="outfit-grid saved-outfit-grid">
          {filteredSaved.map(({ outfit, outfitItems }) => {
            const isConfirmed = Boolean(outfit.dailyLookState?.isConfirmed);
            return (
              <article className="panel outfit-card saved-outfit-card" key={outfit.id}>
                <div className="saved-outfit-head">
                  <div>
                    <h3>{outfit.title}</h3>
                    <p>{outfit.mode} · {outfit.weatherBand} · {outfit.score}점 · {isConfirmed ? '완성됨' : '시안 대기'}</p>
                  </div>
                  <div className="saved-outfit-tools">
                    <div className="mini-palette">{outfit.colorHexes.map((hex, index) => <Chip key={`${hex}-${index}`} hex={hex} />)}</div>
                    <button className="text-danger" type="button" onClick={() => onDelete(outfit.id)}>삭제</button>
                  </div>
                </div>
                {outfit.dailyLookState?.confirmedImage ? <img className="dailylook-confirmed-thumb" src={outfit.dailyLookState.confirmedImage} alt={`${outfit.title} 완성 이미지`} /> : <DailyLookBoardPreview outfit={outfit} items={items} />}
                <details className="saved-outfit-detail">
                  <summary>자세히 보기</summary>
                  {outfit.explanationBullets?.length ? (
                    <ul className="saved-outfit-reasons">
                      {outfit.explanationBullets.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  ) : <p className="saved-outfit-empty-reason">직접 만든 데일리룩입니다. 아이템을 추가하고 저장하면 조합을 다시 확인할 수 있습니다.</p>}
                  <div className="saved-item-preview-grid">
                    {outfitItems.map((item) => (
                      <figure key={item.id}>
                        <img src={clothingDisplayImage(item)} alt={item.type} />
                        <figcaption>
                          <strong>{item.type}</strong>
                          <small>{displayClothingColor(item)} · {MATERIAL_LABELS[item.material ?? 'unknown']} · {PATTERN_LABELS[normalizePatternType(item.patternType)]}</small>
                          <button type="button" onClick={() => onOpenWardrobe(item.wardrobeId)}>
                            {wardrobeNameById.get(item.wardrobeId) ?? '옷장'}에서 보기
                          </button>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </details>
                <button className="black-button" type="button" onClick={() => onMakeDailyLook(outfit.id)}><Shirt size={15} /> 데일리룩 만들기</button>
              </article>
            );
          })}
          {filteredSaved.length === 0 && <EmptyState title="검색 결과가 없습니다." description="검색어를 줄이거나 다른 정렬 기준을 선택해 주세요." />}
        </div>
      )}
    </section>
  );
}

// 저장 코디를 레이어 캔버스 형태로 배치하는 가상착용 화면입니다.
// 누끼가 없는 아이템은 onEnsureCutouts로 배경 제거를 시도한 뒤 레이어로 표시합니다.
