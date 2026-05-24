// ???? TryOn ?? ??? ??????.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, Check, Plus, RotateCcw } from 'lucide-react';
import { EmptyState, PageTitle, PanelTitle } from '../../components/common';
import { clothingDisplayImage } from '../../services/clothingDisplay';
import { buildDailyLookState } from '../../services/dailyLook';
import type { ClothingCategory, DailyLookLayer, DailyLookState, DailyLookTextLayer, SavedOutfit, ScoredClothingItem, Wardrobe } from '../../wardrobeTypes';
import { CATEGORY_OPTIONS, CUTOUT_VERSION } from '../../wardrobeConstants';

export function TryOn({ saved, items, wardrobes, activeOutfitId, onSaveDailyLook, onEnsureCutouts, onBack }: { saved: SavedOutfit[]; items: ScoredClothingItem[]; wardrobes: Wardrobe[]; activeOutfitId: string | null; onSaveDailyLook: (id: string, state: DailyLookState, itemIds?: string[]) => void; onEnsureCutouts: (itemIds: string[]) => Promise<void>; onBack: () => void }) {
  const selectedOutfit = saved.find((outfit) => outfit.id === activeOutfitId) ?? saved[0];
  const itemLookup = useMemo(() => new Map<string, ScoredClothingItem>(items.map((item) => [item.id, item])), [items]);
  const [draftItemIds, setDraftItemIds] = useState<string[]>(() => selectedOutfit?.itemIds ?? []);
  const dailyLookItems = useMemo(() => draftItemIds.map((id) => itemLookup.get(id)).filter(Boolean) as ScoredClothingItem[], [draftItemIds, itemLookup]);
  const [state, setState] = useState<DailyLookState>(() => buildDailyLookState(dailyLookItems, selectedOutfit?.dailyLookState));
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [pickerSource, setPickerSource] = useState<'wardrobe' | 'catalog'>('wardrobe');
  const [pickerWardrobeId, setPickerWardrobeId] = useState(wardrobes[0]?.id ?? '');
  const [pickerCategory, setPickerCategory] = useState<'전체' | ClothingCategory>('전체');
  const [pickerSeason, setPickerSeason] = useState('전체');
  const [pickerSelectedIds, setPickerSelectedIds] = useState<Set<string>>(new Set());
  const [cutoutStatus, setCutoutStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [cutoutError, setCutoutError] = useState('');
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ itemId: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const textDragRef = useRef<{ textId: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const textResizeRef = useRef<{ textId: string; startX: number; originFontSize: number } | null>(null);
  const cutoutRequestKeyRef = useRef('');

  useEffect(() => {
    if (!selectedOutfit) return;
    setDraftItemIds(selectedOutfit.itemIds);
    const nextItems = selectedOutfit.itemIds.map((id) => itemLookup.get(id)).filter(Boolean) as ScoredClothingItem[];
    const nextState = buildDailyLookState(nextItems, selectedOutfit.dailyLookState);
    setState(nextState);
    setSelectedLayerId(nextState.layers[0]?.itemId ?? null);
    setSelectedTextId(nextState.textLayers?.[0]?.id ?? null);
  }, [selectedOutfit?.id]);

  useEffect(() => {
    const missingItems = dailyLookItems.filter((item) => !item.cutoutImageUrl || item.segmentation?.version !== CUTOUT_VERSION);
    if (!selectedOutfit || missingItems.length === 0) {
      if (cutoutStatus === 'processing') setCutoutStatus('done');
      return;
    }
    const requestKey = `${selectedOutfit.id}:${missingItems.map((item) => item.id).join(',')}`;
    if (cutoutRequestKeyRef.current === requestKey) return;
    cutoutRequestKeyRef.current = requestKey;
    setCutoutStatus('processing');
    setCutoutError('');
    onEnsureCutouts(missingItems.map((item) => item.id))
      .then(() => setCutoutStatus('done'))
      .catch((error) => {
        setCutoutStatus('error');
        setCutoutError(error instanceof Error ? error.message : '데일리룩 누끼 처리에 실패했습니다.');
      });
  }, [cutoutStatus, dailyLookItems, onEnsureCutouts, selectedOutfit]);

  if (!selectedOutfit) {
    return <section className="page-stack"><PageTitle title="데일리룩 만들기" description="저장한 데일리룩을 이미지 조합으로 편집합니다." icon={<Bookmark />} /><EmptyState title="미리볼 데일리룩이 없습니다." description="추천에서 조합을 데일리룩으로 저장하면 이 화면에서 확인할 수 있습니다." /></section>;
  }

  const itemById = new Map<string, ScoredClothingItem>(dailyLookItems.map((item) => [item.id, item]));
  const selectedLayer = selectedLayerId ? state.layers.find((layer) => layer.itemId === selectedLayerId) : undefined;
  const selectedTextLayer = selectedTextId ? state.textLayers?.find((layer) => layer.id === selectedTextId) : undefined;
  const hasCanvasContent = dailyLookItems.length > 0 || Boolean(state.textLayers?.length);
  const selectedItemIds = new Set(draftItemIds);
  const catalogItems = items.filter((item) => item.wardrobeId === 'catalog-dailylook');
  const wardrobeItems = items.filter((item) => item.wardrobeId !== 'catalog-dailylook' && (!pickerWardrobeId || item.wardrobeId === pickerWardrobeId));
  const pickerBaseItems = pickerSource === 'catalog' ? catalogItems : wardrobeItems;
  const pickerItems = pickerBaseItems
    .filter((item) => !selectedItemIds.has(item.id))
    .filter((item) => pickerCategory === '전체' || item.category === pickerCategory)
    .filter((item) => pickerSeason === '전체' || item.seasonTag.includes(pickerSeason))
    .slice(0, pickerSource === 'catalog' ? 120 : undefined);
  const pickerWardrobeName = wardrobes.find((wardrobe) => wardrobe.id === pickerWardrobeId)?.name ?? '옷장';

  const updateLayer = (itemId: string, patch: Partial<DailyLookLayer>) => {
    setState((prev) => ({
      ...prev,
      isConfirmed: false,
      confirmedImage: undefined,
      confirmedAt: undefined,
      layers: prev.layers.map((layer) => (layer.itemId === itemId ? { ...layer, ...patch } : layer)),
    }));
  };

  const updateTextLayer = (textId: string, patch: Partial<DailyLookTextLayer>) => {
    setState((prev) => ({
      ...prev,
      isConfirmed: false,
      confirmedImage: undefined,
      confirmedAt: undefined,
      textLayers: (prev.textLayers ?? []).map((layer) => (layer.id === textId ? { ...layer, ...patch } : layer)),
    }));
  };

  const addTextLayer = () => {
    const textLayer: DailyLookTextLayer = {
      id: `text-${Date.now()}`,
      text: '오늘의 룩',
      x: 540,
      y: 170,
      fontSize: 64,
      color: '#111827',
      rotation: 0,
      zIndex: Math.max(10, ...state.layers.map((layer) => layer.zIndex), ...((state.textLayers ?? []).map((layer) => layer.zIndex))) + 1,
      visible: true,
    };
    setState((prev) => ({
      ...prev,
      isConfirmed: false,
      confirmedImage: undefined,
      confirmedAt: undefined,
      textLayers: [...(prev.textLayers ?? []), textLayer],
    }));
    setSelectedTextId(textLayer.id);
    setSelectedLayerId(null);
  };

  const addDailyLookItem = (itemId: string) => {
    const nextItemIds = Array.from(new Set([...draftItemIds, itemId]));
    const nextItems = nextItemIds.map((id) => itemLookup.get(id)).filter(Boolean) as ScoredClothingItem[];
    const nextState = buildDailyLookState(nextItems, state);
    setDraftItemIds(nextItemIds);
    setState(nextState);
    onSaveDailyLook(selectedOutfit.id, nextState, nextItemIds);
    setItemPickerOpen(false);
  };

  const batchAddDailyLookItems = () => {
    const nextItemIds = Array.from(new Set([...draftItemIds, ...pickerSelectedIds]));
    const nextItems = nextItemIds.map((id) => itemLookup.get(id)).filter(Boolean) as ScoredClothingItem[];
    const nextState = buildDailyLookState(nextItems, state);
    setDraftItemIds(nextItemIds);
    setState(nextState);
    onSaveDailyLook(selectedOutfit.id, nextState, nextItemIds);
    setPickerSelectedIds(new Set());
    setItemPickerOpen(false);
  };

  const togglePickerItem = (itemId: string) => {
    setPickerSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const resetLayout = () => {
    const nextState = buildDailyLookState(dailyLookItems);
    setState(nextState);
    setSelectedLayerId(nextState.layers[0]?.itemId ?? null);
    setSelectedTextId(nextState.textLayers?.[0]?.id ?? null);
  };

  const moveLayerOrder = (direction: 'front' | 'back') => {
    if (!selectedLayer) return;
    const zIndexes = state.layers.map((layer) => layer.zIndex);
    updateLayer(selectedLayer.itemId, { zIndex: direction === 'front' ? Math.max(...zIndexes) + 1 : Math.min(...zIndexes) - 1 });
  };

  const pointerToCanvas = (event: React.PointerEvent<HTMLElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const scale = rect ? state.canvas.width / rect.width : 1;
    return {
      x: (event.clientX - (rect?.left ?? 0)) * scale,
      y: (event.clientY - (rect?.top ?? 0)) * scale,
    };
  };

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, layer: DailyLookLayer) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerToCanvas(event);
    dragRef.current = { itemId: layer.itemId, startX: point.x, startY: point.y, originX: layer.x, originY: layer.y };
    setSelectedLayerId(layer.itemId);
    setSelectedTextId(null);
  };

  const dragLayer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointerToCanvas(event);
    updateLayer(drag.itemId, { x: drag.originX + point.x - drag.startX, y: drag.originY + point.y - drag.startY });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const startTextDrag = (event: React.PointerEvent<HTMLElement>, layer: DailyLookTextLayer) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerToCanvas(event);
    textDragRef.current = { textId: layer.id, startX: point.x, startY: point.y, originX: layer.x, originY: layer.y };
    setSelectedTextId(layer.id);
    setSelectedLayerId(null);
  };

  const dragTextLayer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = textDragRef.current;
    if (!drag) return;
    const point = pointerToCanvas(event);
    updateTextLayer(drag.textId, { x: drag.originX + point.x - drag.startX, y: drag.originY + point.y - drag.startY });
  };

  const endTextDrag = () => {
    textDragRef.current = null;
  };

  const startTextResize = (event: React.PointerEvent<HTMLButtonElement>, layer: DailyLookTextLayer) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerToCanvas(event);
    textResizeRef.current = { textId: layer.id, startX: point.x, originFontSize: layer.fontSize };
    setSelectedTextId(layer.id);
    setSelectedLayerId(null);
  };

  const resizeTextLayer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const resize = textResizeRef.current;
    if (!resize) return;
    event.stopPropagation();
    const point = pointerToCanvas(event);
    const nextFontSize = Math.max(18, Math.min(180, resize.originFontSize + (point.x - resize.startX) * 0.35));
    updateTextLayer(resize.textId, { fontSize: Math.round(nextFontSize) });
  };

  const endTextResize = () => {
    textResizeRef.current = null;
  };

  const removeTextLayer = (textId: string) => {
    setState((prev) => ({
      ...prev,
      isConfirmed: false,
      confirmedImage: undefined,
      confirmedAt: undefined,
      textLayers: (prev.textLayers ?? []).filter((layer) => layer.id !== textId),
    }));
    setSelectedTextId(null);
  };

  const renderConfirmedImage = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = state.canvas.width;
    canvas.height = state.canvas.height;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    context.fillStyle = '#f8f9fb';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const orderedLayers = [...state.layers].filter((layer) => layer.visible).sort((left, right) => left.zIndex - right.zIndex);
    for (const layer of orderedLayers) {
      const item = itemById.get(layer.itemId);
      if (!item) continue;
      const image = await loadCanvasImage(clothingDisplayImage(item));
      const width = 420 * layer.scale;
      const height = width * (image.naturalHeight / Math.max(image.naturalWidth, 1));
      context.save();
      context.translate(layer.x, layer.y);
      context.rotate((layer.rotation * Math.PI) / 180);
      context.drawImage(image, -width / 2, -height / 2, width, height);
      context.restore();
    }

    const orderedTextLayers = [...(state.textLayers ?? [])].filter((layer) => layer.visible).sort((left, right) => left.zIndex - right.zIndex);
    for (const layer of orderedTextLayers) {
      context.save();
      context.translate(layer.x, layer.y);
      context.rotate((layer.rotation * Math.PI) / 180);
      context.fillStyle = layer.color;
      context.font = `700 ${layer.fontSize}px Arial, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(layer.text, 0, 0);
      context.restore();
    }

    return canvas.toDataURL('image/png');
  };

  const confirmDailyLook = async () => {
    let confirmedImage: string | undefined;
    try {
      confirmedImage = await renderConfirmedImage();
    } catch {
      // 외부 이미지 CORS 정책으로 렌더링 저장이 막히면 배치 상태만 저장합니다.
      confirmedImage = undefined;
    }
    const nextState = { ...state, isConfirmed: true, confirmedImage, confirmedAt: new Date().toISOString() };
    setState(nextState);
    onSaveDailyLook(selectedOutfit.id, nextState, draftItemIds);
  };

  return (
    <section className="page-stack">
      <div className="dailylook-maker-title">
        <button className="line-button back-button" type="button" onClick={onBack}><ArrowLeft size={16} /> 데일리룩</button>
        <div className="dailylook-maker-heading">
          <PageTitle title="데일리룩 만들기" description="저장한 데일리룩 조합을 자동 배치하고, 필요할 때만 가볍게 수정합니다." icon={<Bookmark />} />
          <div className="dailylook-save-actions">
            <button className="black-button" type="button" disabled={!hasCanvasContent} onClick={confirmDailyLook}><Check size={15} /> 저장</button>
          </div>
        </div>
      </div>
      <section className="dailylook-compact-summary">
        <strong>{selectedOutfit.title}</strong>
        <span>{selectedOutfit.mode}</span>
        <span>{selectedOutfit.weatherBand}</span>
        <span>{state.isConfirmed ? '저장됨' : '편집 중'}</span>
      </section>
      {!hasCanvasContent && <EmptyState title="아이템이나 텍스트를 추가해 주세요." description="데일리룩 만들기는 추천 저장 조합, 옷장 아이템, 카탈로그 아이템을 섞어서 구성할 수 있습니다." />}
      {cutoutStatus === 'processing' && <p className="dailylook-cutout-status">누끼가 없는 옷을 데일리룩용 PNG로 처리하는 중입니다. 첫 실행은 모델 로딩 때문에 시간이 걸릴 수 있습니다.</p>}
      {cutoutStatus === 'error' && <p className="dailylook-cutout-status error">{cutoutError}</p>}
      <section className="dailylook-maker">
        <div className="dailylook-canvas-panel panel">
          <div className="dailylook-stage" ref={canvasRef}>
            {[...state.layers].filter((layer) => layer.visible).sort((left, right) => left.zIndex - right.zIndex).map((layer) => {
              const item = itemById.get(layer.itemId);
              if (!item) return null;
              return (
                <button
                  key={layer.itemId}
                  className={selectedLayer?.itemId === layer.itemId ? 'dailylook-layer selected' : 'dailylook-layer'}
                  type="button"
                  style={{
                    left: `${(layer.x / state.canvas.width) * 100}%`,
                    top: `${(layer.y / state.canvas.height) * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
                    zIndex: layer.zIndex,
                  }}
                  onPointerDown={(event) => startDrag(event, layer)}
                  onPointerMove={dragLayer}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onClick={() => {
                    setSelectedLayerId(layer.itemId);
                    setSelectedTextId(null);
                  }}
                >
                  <img src={clothingDisplayImage(item)} alt={item.type} draggable={false} />
                  <span>{item.category}</span>
                </button>
              );
            })}
            {[...(state.textLayers ?? [])].filter((layer) => layer.visible).sort((left, right) => left.zIndex - right.zIndex).map((layer) => (
              <div
                key={layer.id}
                className={selectedTextLayer?.id === layer.id ? 'dailylook-text-layer selected' : 'dailylook-text-layer'}
                role="button"
                tabIndex={0}
                style={{
                  left: `${(layer.x / state.canvas.width) * 100}%`,
                  top: `${(layer.y / state.canvas.height) * 100}%`,
                  color: layer.color,
                  fontSize: `${layer.fontSize * 0.5}px`,
                  transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
                  zIndex: layer.zIndex,
                }}
                onPointerDown={(event) => startTextDrag(event, layer)}
                onPointerMove={dragTextLayer}
                onPointerUp={endTextDrag}
                onPointerCancel={endTextDrag}
                onClick={() => {
                  setSelectedTextId(layer.id);
                  setSelectedLayerId(null);
                }}
              >
                <span>{layer.text}</span>
                {selectedTextLayer?.id === layer.id && (
                  <button
                    className="dailylook-text-resize"
                    type="button"
                    aria-label="텍스트 크기 조절"
                    onPointerDown={(event) => startTextResize(event, layer)}
                    onPointerMove={resizeTextLayer}
                    onPointerUp={endTextResize}
                    onPointerCancel={endTextResize}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="dailylook-main-actions">
            <button className="line-button" type="button" onClick={resetLayout}><RotateCcw size={15} /> 자동 배치</button>
          </div>
        </div>
        <div className="dailylook-side-column">
          <section className="dailylook-confirm-panel panel">
            <button className="blue-button" type="button" onClick={addTextLayer}><Plus size={15} /> 텍스트</button>
            <button className="line-button" type="button" onClick={() => setItemPickerOpen(true)}><Plus size={15} /> 옷 추가</button>
          </section>
          <aside className="dailylook-editor-panel panel">
            <PanelTitle title="레이어 편집" />
            {selectedTextLayer ? (
              <section className="dailylook-text-controls">
                <div className="dailylook-selected-item">
                  <strong>텍스트</strong>
                  <small>드래그해서 위치를 조정합니다.</small>
                </div>
                <label>내용
                  <input type="text" value={selectedTextLayer.text} onChange={(event) => updateTextLayer(selectedTextLayer.id, { text: event.target.value })} />
                </label>
                <label>색상
                  <input type="color" value={selectedTextLayer.color} onChange={(event) => updateTextLayer(selectedTextLayer.id, { color: event.target.value })} />
                </label>
                <label>크기
                  <input type="range" min="24" max="120" step="2" value={selectedTextLayer.fontSize} onChange={(event) => updateTextLayer(selectedTextLayer.id, { fontSize: Number(event.target.value) })} />
                </label>
                <label>회전
                  <input type="range" min="-25" max="25" step="1" value={selectedTextLayer.rotation} onChange={(event) => updateTextLayer(selectedTextLayer.id, { rotation: Number(event.target.value) })} />
                </label>
                <div className="dailylook-tool-grid">
                  <button className="line-button" type="button" onClick={() => updateTextLayer(selectedTextLayer.id, { zIndex: Math.max(...state.layers.map((layer) => layer.zIndex), ...((state.textLayers ?? []).map((layer) => layer.zIndex))) + 1 })}>앞으로</button>
                  <button className="line-button" type="button" onClick={() => updateTextLayer(selectedTextLayer.id, { zIndex: Math.min(...state.layers.map((layer) => layer.zIndex), ...((state.textLayers ?? []).map((layer) => layer.zIndex))) - 1 })}>뒤로</button>
                  <button className="line-button" type="button" onClick={() => updateTextLayer(selectedTextLayer.id, { visible: !selectedTextLayer.visible })}>{selectedTextLayer.visible ? '숨김' : '표시'}</button>
                  <button className="line-button danger" type="button" onClick={() => removeTextLayer(selectedTextLayer.id)}>삭제</button>
                </div>
              </section>
            ) : !selectedLayer ? <p>편집할 아이템이나 텍스트를 선택해 주세요.</p> : (
              <>
                <div className="dailylook-selected-item">
                  <strong>{itemById.get(selectedLayer.itemId)?.type}</strong>
                  <small>{selectedLayer.category} · {selectedLayer.slot}</small>
                </div>
                <label>크기
                  <input type="range" min="0.35" max="1.55" step="0.05" value={selectedLayer.scale} onChange={(event) => updateLayer(selectedLayer.itemId, { scale: Number(event.target.value) })} />
                </label>
                <label>회전
                  <input type="range" min="-25" max="25" step="1" value={selectedLayer.rotation} onChange={(event) => updateLayer(selectedLayer.itemId, { rotation: Number(event.target.value) })} />
                </label>
                <div className="dailylook-tool-grid">
                  <button className="line-button" type="button" onClick={() => moveLayerOrder('front')}>앞으로</button>
                  <button className="line-button" type="button" onClick={() => moveLayerOrder('back')}>뒤로</button>
                  <button className="line-button" type="button" onClick={() => updateLayer(selectedLayer.itemId, { visible: !selectedLayer.visible })}>{selectedLayer.visible ? '숨김' : '표시'}</button>
                  <button className="line-button" type="button" onClick={resetLayout}>초기화</button>
                </div>
              </>
            )}
            <section className="dailylook-layer-list">
              {state.layers.map((layer) => {
                const item = itemById.get(layer.itemId);
                return item ? <button key={layer.itemId} className={selectedLayer?.itemId === layer.itemId ? 'active' : ''} type="button" onClick={() => { setSelectedLayerId(layer.itemId); setSelectedTextId(null); }}>{item.category} · {item.type}</button> : null;
              })}
              {(state.textLayers ?? []).map((layer) => <button key={layer.id} className={selectedTextLayer?.id === layer.id ? 'active' : ''} type="button" onClick={() => { setSelectedTextId(layer.id); setSelectedLayerId(null); }}>텍스트 · {layer.text || '빈 텍스트'}</button>)}
            </section>
            {state.confirmedAt && <p>마지막 확정: {new Date(state.confirmedAt).toLocaleString('ko-KR')}</p>}
          </aside>
        </div>
      </section>
      {itemPickerOpen && (
        <div className="dailylook-picker-backdrop" role="presentation" onMouseDown={() => { setItemPickerOpen(false); setPickerSelectedIds(new Set()); }}>
          <section className="dailylook-picker-modal panel" role="dialog" aria-modal="true" aria-label="데일리룩 옷 추가" onMouseDown={(event) => event.stopPropagation()}>
            <div className="dailylook-picker-head">
              <PanelTitle title="옷 추가" />
              <button className="line-button" type="button" onClick={() => { setItemPickerOpen(false); setPickerSelectedIds(new Set()); }}>닫기</button>
            </div>
            <div className="dailylook-picker-tabs">
              <button className={pickerSource === 'wardrobe' ? 'active' : ''} type="button" onClick={() => { setPickerSource('wardrobe'); setPickerSelectedIds(new Set()); }}>내 옷장</button>
              <button className={pickerSource === 'catalog' ? 'active' : ''} type="button" onClick={() => { setPickerSource('catalog'); setPickerSelectedIds(new Set()); }}>프로젝트 카탈로그</button>
            </div>

            {/* 카테고리 pill 필터 */}
            <div className="picker-filter-row">
              {(['전체', ...CATEGORY_OPTIONS] as Array<'전체' | ClothingCategory>).map((cat) => (
                <button key={cat} type="button" className={`picker-pill${pickerCategory === cat ? ' active' : ''}`} onClick={() => setPickerCategory(cat)}>
                  {cat}
                </button>
              ))}
            </div>

            {/* 시즌 pill 필터 — 카탈로그 전용 */}
            {pickerSource === 'catalog' && (
              <div className="picker-filter-row">
                {['전체', '봄', '여름', '가을', '겨울'].map((season) => (
                  <button key={season} type="button" className={`picker-pill${pickerSeason === season ? ' active' : ''}`} onClick={() => setPickerSeason(season)}>
                    {season}
                  </button>
                ))}
              </div>
            )}

            {/* 옷장 선택 — wardrobe 전용 */}
            {pickerSource === 'wardrobe' && (
              <div className="dailylook-picker-controls">
                <label>옷장
                  <select value={pickerWardrobeId} onChange={(event) => setPickerWardrobeId(event.target.value)}>
                    {wardrobes.map((wardrobe) => <option key={wardrobe.id} value={wardrobe.id}>{wardrobe.name}</option>)}
                  </select>
                </label>
              </div>
            )}

            <p className="dailylook-picker-note">
              {pickerSource === 'wardrobe' ? pickerWardrobeName : '퍼컬 추천순'} · {pickerCategory} · {pickerItems.length}개
            </p>

            {/* 아이템 그리드 */}
            {pickerSource === 'catalog' ? (
              <div className="picker-catalog-grid">
                {pickerItems.map((item) => {
                  const isSelected = pickerSelectedIds.has(item.id);
                  const score = item.personalFitScore ?? 0;
                  return (
                    <button key={item.id} type="button" className={`picker-catalog-item${isSelected ? ' selected' : ''}`} onClick={() => togglePickerItem(item.id)}>
                      <div className="picker-catalog-img-wrap">
                        <img src={clothingDisplayImage(item)} alt={item.type} />
                        {isSelected && <span className="picker-check">✓</span>}
                        {score >= 80 && <span className="picker-fit-dot" title={`퍼컬 ${score}점`} />}
                      </div>
                      <small>{item.type}</small>
                    </button>
                  );
                })}
                {pickerItems.length === 0 && <p className="picker-empty">해당 조건의 아이템이 없습니다.</p>}
              </div>
            ) : (
              <div className="dailylook-picker-grid">
                {pickerItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => addDailyLookItem(item.id)}>
                    <img src={clothingDisplayImage(item)} alt={item.type} />
                    <span>
                      <strong>{item.type}</strong>
                      <small>{item.brand} · {item.category}</small>
                      <small>{item.representativeHex ?? item.color}</small>
                    </span>
                  </button>
                ))}
                {pickerItems.length === 0 && <EmptyState title="추가할 옷이 없습니다." description="다른 옷장이나 카테고리를 선택해 주세요." />}
              </div>
            )}

            {/* 하단 sticky 바 — 카탈로그 전용 */}
            {pickerSource === 'catalog' && (
              <div className="picker-action-bar">
                <span className="picker-action-count">{pickerSelectedIds.size > 0 ? `${pickerSelectedIds.size}개 선택됨` : '아이템을 선택하세요'}</span>
                <button className="picker-action-confirm" disabled={pickerSelectedIds.size === 0} onClick={batchAddDailyLookItems}>
                  추가하기
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

// 이미지 URL을 HTMLImageElement로 로드합니다. 가상착용 확정 이미지 렌더링에서 사용됩니다.
function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

