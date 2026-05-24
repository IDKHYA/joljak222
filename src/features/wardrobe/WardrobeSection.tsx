// ?? ??, ??, ????, ?? ?? ??? ??????.
import React, { useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Grid2X2, List, Plus, Search, Shirt, ShoppingBag, Sparkles, Trash2, Upload } from 'lucide-react';
import { BackTitle, Chip, StatCard } from '../../components/common';
import { clothingDisplayImage, isHexColor } from '../../services/clothingDisplay';
import { buildColorMeta, colorMetaForInput } from '../../services/clothingMeta';
import type { CatalogItem } from '../../data/trainingCatalog';
import type { AvailabilityStatus, ClothingCategory, ClothingColorAnalysis, MaterialType, ScoredClothingItem, Wardrobe, WardrobeView } from '../../wardrobeTypes';
import { AVAILABILITY_OPTIONS, CATALOG_TABS, CATEGORY_OPTIONS, CATEGORY_UI_META, COLOR_META, DENIM_WASH_LABELS, MATERIAL_LABELS, PATTERN_LABELS, SEASON_TAGS, SIZES, TYPES } from '../../wardrobeConstants';

export function WardrobeSection(props: {
  view: WardrobeView;
  setView: (view: WardrobeView) => void;
  onBack: () => void;
  wardrobes: Wardrobe[];
  activeWardrobe?: Wardrobe;
  allItems: ScoredClothingItem[];
  activeItems: ScoredClothingItem[];
  wardrobeHealthScore: number;
  readyWardrobeCount: number;
  wardrobeSearch: string;
  setWardrobeSearch: (value: string) => void;
  detailSearch: string;
  setDetailSearch: (value: string) => void;
  detailCategory: '전체' | ClothingCategory;
  setDetailCategory: (value: '전체' | ClothingCategory) => void;
  detailLayout: 'grid' | 'list';
  setDetailLayout: (value: 'grid' | 'list') => void;
  catalogItems: CatalogItem[];
  catalogCategory: '전체' | ClothingCategory;
  setCatalogCategory: (value: '전체' | ClothingCategory) => void;
  selectedCatalogIds: string[];
  setSelectedCatalogIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedCatalogItems: CatalogItem[];
  catalogSaveMode: 'create' | 'append';
  setCatalogSaveMode: (value: 'create' | 'append') => void;
  newWardrobeName: string;
  setNewWardrobeName: (value: string) => void;
  onSelectWardrobe: (id: string) => void;
  onRenameWardrobe: (id: string, name: string) => void;
  onDeleteWardrobe: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onOpenCatalog: (mode: 'create' | 'append') => void;
  onSaveCatalog: () => void;
  onRecommend: () => void;
  manual: {
    imageUrl: string;
    category: ClothingCategory;
    type: string;
    color: string;
    size: string;
    brand: string;
    seasonTag: string;
    availabilityStatus: AvailabilityStatus;
  };
  setManual: React.Dispatch<React.SetStateAction<any>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveBackground: () => void;
  onPrecisionExtract: () => void;
  backgroundRemoveStatus: 'idle' | 'processing' | 'done' | 'error';
  backgroundRemoveError: string;
  onCategory: (category: ClothingCategory) => void;
  onSaveManual: () => void;
}) {
  if (props.view === 'detail' && props.activeWardrobe) {
    return <WardrobeDetailView {...props} activeWardrobe={props.activeWardrobe} />;
  }
  if (props.view === 'catalog') return <CatalogSelectionView {...props} />;
  if (props.view === 'preview') return <CatalogPreviewView {...props} />;
  if (props.view === 'manual') return <ManualAdd {...props} />;
  return <WardrobeOverview {...props} />;
}

// 사용자의 옷장 목록과 생성 UI를 보여주는 화면입니다.
function WardrobeOverview(props: {
  wardrobes: Wardrobe[];
  allItems: ScoredClothingItem[];
  wardrobeHealthScore: number;
  readyWardrobeCount: number;
  wardrobeSearch: string;
  setWardrobeSearch: (value: string) => void;
  onSelectWardrobe: (id: string) => void;
  onRenameWardrobe: (id: string, name: string) => void;
  onDeleteWardrobe: (id: string) => void;
  onOpenCatalog: (mode: 'create' | 'append') => void;
  onRecommend: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const filtered = props.wardrobes.filter((wardrobe) => wardrobe.name.toLowerCase().includes(props.wardrobeSearch.toLowerCase()));

  const startEditing = () => {
    setDraftNames(Object.fromEntries(props.wardrobes.map((wardrobe) => [wardrobe.id, wardrobe.name])));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraftNames({});
    setIsEditing(false);
  };

  const saveEditing = () => {
    props.wardrobes.forEach((wardrobe) => {
      const nextName = draftNames[wardrobe.id];
      if (nextName !== undefined && nextName.trim() !== wardrobe.name) {
        props.onRenameWardrobe(wardrobe.id, nextName);
      }
    });
    setIsEditing(false);
  };

  return (
    <section className="wardrobe-page">
      <div className="wardrobe-heading">
        <div><h1>옷장</h1></div>
      </div>
      <div className="wardrobe-summary-row">
        <StatCard label="옷장 수" value={`${props.wardrobes.length}개`} />
        <StatCard label="전체 아이템" value={`${props.allItems.length}개`} />
      </div>
      <div className="wardrobe-toolbar">
        <label className="search-field"><Search size={17} /><input value={props.wardrobeSearch} onChange={(event) => props.setWardrobeSearch(event.target.value)} placeholder="옷장 검색..." /></label>
        {isEditing ? (
          <>
            <button className="line-button" type="button" onClick={cancelEditing}>취소</button>
            <button className="black-button" type="button" onClick={saveEditing}><Check size={16} /> 저장</button>
          </>
        ) : (
          <button className="line-button" type="button" onClick={startEditing}>수정</button>
        )}
        <button className="black-button" type="button" onClick={() => props.onOpenCatalog('create')}><Plus size={16} /> 옷장 추가</button>
      </div>
      <div className="wardrobe-card-grid">
        {filtered.map((wardrobe) => (
          <WardrobeCard
            key={wardrobe.id}
            wardrobe={wardrobe}
            items={props.allItems.filter((item) => item.wardrobeId === wardrobe.id)}
            editing={isEditing}
            draftName={draftNames[wardrobe.id] ?? wardrobe.name}
            onDraftName={(value) => setDraftNames((prev) => ({ ...prev, [wardrobe.id]: value }))}
            onOpen={() => props.onSelectWardrobe(wardrobe.id)}
            onDelete={() => props.onDeleteWardrobe(wardrobe.id)}
          />
        ))}
      </div>
    </section>
  );
}

// 옷장 하나를 카드로 표시합니다. 이름 수정/삭제/상세 진입 액션을 포함합니다.
function WardrobeCard({
  wardrobe,
  items,
  editing,
  draftName,
  onDraftName,
  onOpen,
  onDelete,
}: {
  key?: React.Key;
  wardrobe: Wardrobe;
  items: ScoredClothingItem[];
  editing: boolean;
  draftName: string;
  onDraftName: (value: string) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const counts = {
    상의: items.filter((item) => item.category === '상의').length,
    하의: items.filter((item) => item.category === '하의').length,
    아우터: items.filter((item) => item.category === '아우터').length,
  };
  return (
    <article className="wardrobe-card">
        <button className="wardrobe-mosaic" type="button" onClick={onOpen}>
        {Array.from({ length: 4 }).map((_, index) => items[index] ? <img key={items[index].id} src={clothingDisplayImage(items[index])} alt={items[index].type} /> : <span key={index} />)}
      </button>
      <div className="wardrobe-card-body">
        {editing ? (
          <label className="wardrobe-name-edit">
            <span>옷장 이름</span>
            <input value={draftName} onChange={(event) => onDraftName(event.target.value)} />
          </label>
        ) : (
          <button className="wardrobe-card-title" type="button" onClick={onOpen}>
            <span><strong>{wardrobe.name}</strong><small>{items.length}개의 옷</small></span>
            <ChevronRight size={18} />
          </button>
        )}
        <div className="pill-row"><span>상의 {counts.상의}</span><span>하의 {counts.하의}</span><span>아우터 {counts.아우터}</span></div>
        {editing && <button className="text-danger" type="button" onClick={onDelete}>삭제</button>}
      </div>
    </article>
  );
}

// 선택한 옷장 안의 의류 목록과 필터/검색/추가 진입 버튼을 보여줍니다.
function WardrobeDetailView(props: {
  activeWardrobe: Wardrobe;
  activeItems: ScoredClothingItem[];
  detailSearch: string;
  setDetailSearch: (value: string) => void;
  detailCategory: '전체' | ClothingCategory;
  setDetailCategory: (value: '전체' | ClothingCategory) => void;
  detailLayout: 'grid' | 'list';
  setDetailLayout: (value: 'grid' | 'list') => void;
  setView: (view: WardrobeView) => void;
  onBack: () => void;
  onDeleteItem: (id: string) => void;
  onOpenCatalog: (mode: 'create' | 'append') => void;
  onRecommend: () => void;
  onRenameWardrobe: (id: string, name: string) => void;
}) {
  const filtered = props.activeItems.filter((item) => (props.detailCategory === '전체' || item.category === props.detailCategory) && `${item.type} ${item.color} ${item.brand}`.toLowerCase().includes(props.detailSearch.toLowerCase()));
  const health = Math.round(props.activeItems.reduce((sum, item) => sum + (item.personalFitScore ?? 100), 0) / Math.max(props.activeItems.length, 1));
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(props.activeWardrobe.name);
  const saveName = () => {
    props.onRenameWardrobe(props.activeWardrobe.id, draftName);
    setIsEditing(false);
  };
  return (
    <section className="wardrobe-page">
      <BackTitle
        title={props.activeWardrobe.name}
        description={`${props.activeItems.length}개의 아이템`}
        onBack={props.onBack}
        right={isEditing ? (
          <div className="detail-edit-actions">
            <button className="line-button" type="button" onClick={() => { setDraftName(props.activeWardrobe.name); setIsEditing(false); }}>취소</button>
            <button className="black-button" type="button" onClick={saveName}><Check size={15} /> 저장</button>
          </div>
        ) : (
          <button className="line-button" type="button" onClick={() => setIsEditing(true)}>수정</button>
        )}
      />
      {isEditing && (
        <section className="panel wardrobe-detail-edit">
          <label>옷장 이름<input value={draftName} onChange={(event) => setDraftName(event.target.value)} /></label>
        </section>
      )}
      <section className="wardrobe-health-panel">
        <div className="health-head"><span><ShoppingBag size={17} /> 옷장 건강도</span><strong>{health}점</strong></div>
        <h2>{health >= 90 ? '구성이 좋아요.' : '보완하면 추천 품질이 더 좋아져요.'}</h2>
        <div className="health-grid">{CATEGORY_OPTIONS.slice(0, 4).map((category) => <span key={category}><small>{category}</small><strong>{props.activeItems.filter((item) => item.category === category).length}개</strong></span>)}</div>
        <p className="wardrobe-warning">겨울 대응 아이템이 적어요.</p>
      </section>
      <div className="detail-toolbar">
        <div className="catalog-tabs">{CATALOG_TABS.slice(0, 5).map((tab) => <button key={tab} className={props.detailCategory === tab ? 'active' : ''} onClick={() => props.setDetailCategory(tab)}>{tab}</button>)}</div>
        <div className="detail-actions">
          <label className="search-field compact"><Search size={15} /><input value={props.detailSearch} onChange={(event) => props.setDetailSearch(event.target.value)} placeholder="색상/대표색/브랜드 검색..." /></label>
          <button className={props.detailLayout === 'grid' ? 'icon-button active' : 'icon-button'} type="button" onClick={() => props.setDetailLayout('grid')} aria-label="격자 보기"><Grid2X2 size={16} /></button>
          <button className={props.detailLayout === 'list' ? 'icon-button active' : 'icon-button'} type="button" onClick={() => props.setDetailLayout('list')} aria-label="목록 보기"><List size={16} /></button>
          <button className="black-button" type="button" onClick={props.onRecommend}><Sparkles size={15} /> AI 추천</button>
          <button className="black-button" type="button" onClick={() => props.onOpenCatalog('append')}><Plus size={15} /> DB에서 담기</button>
        </div>
      </div>
      <div className={props.detailLayout === 'list' ? 'clothing-grid list-view' : 'clothing-grid'}>
        {filtered.map((item) => <ClothingCard key={item.id} item={item} onDelete={() => props.onDeleteItem(item.id)} />)}
      </div>
    </section>
  );
}

// 의류 하나를 카드로 표시합니다. 퍼스널컬러 적합도와 상태 정보를 함께 보여줍니다.
function ClothingCard({ item, onDelete }: { key?: React.Key; item: ScoredClothingItem; onDelete: () => void }) {
  return (
    <article className="clothing-card">
      <img src={clothingDisplayImage(item)} alt={item.type} />
      <div className="clothing-body">
        <span className="category-label">{item.category}</span>
        <strong>{item.type}</strong>
        <small>{item.color} · {item.seasonTag}</small>
        <span className="catalog-color-row"><Chip hex={item.representativeHex} /> {item.representativeHex}</span>
        <div className="item-meta-row">
          <span>{item.fitGrade ?? '측정 대기'}</span>
          <span>{item.availabilityStatus}</span>
          <Chip hex={item.representativeHex} />
        </div>
        <button className="text-danger" type="button" onClick={onDelete}><Trash2 size={13} /> 삭제</button>
      </div>
    </article>
  );
}

// 카탈로그에서 추가할 의류를 고르는 화면입니다.
function CatalogSelectionView(props: {
  setView: (view: WardrobeView) => void;
  onBack: () => void;
  catalogItems: CatalogItem[];
  catalogCategory: '전체' | ClothingCategory;
  setCatalogCategory: (value: '전체' | ClothingCategory) => void;
  selectedCatalogIds: string[];
  setSelectedCatalogIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [subcat, setSubcat] = useState('전체');
  const [season, setSeason] = useState('전체');
  const prevCategory = React.useRef(props.catalogCategory);
  if (prevCategory.current !== props.catalogCategory) {
    prevCategory.current = props.catalogCategory;
    setSubcat('전체');
  }

  const subcategories = props.catalogCategory === '전체' ? [] :
    ['전체', ...Array.from(new Set(props.catalogItems.map((i) => i.subcategory))).sort()];

  const displayItems = props.catalogItems
    .filter((i) => subcat === '전체' || i.subcategory === subcat)
    .filter((i) => season === '전체' || i.seasonTag.includes(season));

  const selected = new Set(props.selectedCatalogIds);

  const toggle = (id: string) =>
    props.setSelectedCatalogIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <section className="wardrobe-page catalog-selection-page">
      <BackTitle title="나만의 옷장 만들기" description="관리자가 준비한 의류 DB에서 체크해서 내 옷장을 빠르게 구성해요." onBack={props.onBack} />
      <div className="catalog-head"><h2><Shirt size={19} /> 내 옷 고르기</h2><p>이미 준비된 옷들 중에서 체크해서 나만의 옷장을 구성해 보세요.</p></div>
      <section className="catalog-browser-panel">
        {/* 대분류 탭 */}
        <div className="catalog-tabs band catalog-tabs-sticky">
          {CATALOG_TABS.map((tab) => <button key={tab} className={props.catalogCategory === tab ? 'active' : ''} onClick={() => props.setCatalogCategory(tab)}>{tab}</button>)}
        </div>
        {/* 소분류 pills */}
        {subcategories.length > 1 && (
          <div className="catalog-subtabs">
            {subcategories.map((sc) => <button key={sc} type="button" className={subcat === sc ? 'active' : ''} onClick={() => setSubcat(sc)}>{sc}</button>)}
          </div>
        )}
        {/* 시즌 pill 필터 */}
        <div className="catalog-subtabs">
          {['전체', '봄', '여름', '가을', '겨울'].map((s) => (
            <button key={s} type="button" className={season === s ? 'active' : ''} onClick={() => setSeason(s)}>{s}</button>
          ))}
        </div>
        {/* 아이템 그리드 */}
        <div className="catalog-scroll-box catalog-scroll-box--with-bar">
          <div className="catalog-card-grid">
            {displayItems.map((item) => (
              <button key={item.catalogItemId} className={selected.has(item.catalogItemId) ? 'catalog-pick-card selected' : 'catalog-pick-card'} type="button" onClick={() => toggle(item.catalogItemId)}>
                <img src={item.imageUrl} alt={item.name} />
                {selected.has(item.catalogItemId) && <span className="selected-check"><Check size={15} /></span>}
                <span className="catalog-card-label">
                  <strong>{item.subcategory}</strong>
                  <small>{item.seasonTag}</small>
                </span>
              </button>
            ))}
            {displayItems.length === 0 && <p className="picker-empty">해당 조건의 아이템이 없습니다.</p>}
          </div>
        </div>
      </section>
      {/* sticky 하단 선택 바 */}
      <div className="catalog-action-bar">
        <span className="picker-action-count">{selected.size > 0 ? `${selected.size}개 선택됨` : '옷을 선택하세요'}</span>
        <button className="picker-action-confirm" disabled={selected.size === 0} onClick={() => props.setView('preview')}>
          선택 완료
        </button>
      </div>
    </section>
  );
}

// 카탈로그 상품을 옷장에 넣기 전에 이미지/색상/카테고리를 미리 확인하는 화면입니다.
function CatalogPreviewView(props: {
  setView: (view: WardrobeView) => void;
  onBack: () => void;
  selectedCatalogItems: CatalogItem[];
  catalogSaveMode: 'create' | 'append';
  setCatalogSaveMode: (value: 'create' | 'append') => void;
  wardrobes: Wardrobe[];
  activeWardrobe?: Wardrobe;
  newWardrobeName: string;
  setNewWardrobeName: (value: string) => void;
  onSaveCatalog: () => void;
}) {
  const selectedByCategory = (category: ClothingCategory) => props.selectedCatalogItems.filter((item) => item.category === category);
  return (
    <section className="wardrobe-page">
      <BackTitle title="나만의 옷장 만들기" description="관리자가 준비한 의류 DB에서 체크해서 내 옷장을 빠르게 구성해요." onBack={props.onBack} />
      <div className="preview-subtitle"><button type="button" onClick={props.onBack}><ArrowLeft size={19} /></button><div><h2>선택한 옷 미리보기</h2><p>새 옷장을 만들거나, 기존 옷장에 담아 바로 사용할 수 있어요.</p></div></div>
      <section className="preview-stage">
        <button className="line-button ai-preview-button" type="button"><Sparkles size={16} /> AI 퍼스널컬러 맞춤 추천</button>
        {(['아우터', '상의', '하의'] as ClothingCategory[]).map((category) => (
          <div className="preview-row" key={category}>
            <strong>{category}</strong>
            <div className="preview-slots">
              {selectedByCategory(category).length === 0 ? <span className="empty-slot">비어있음</span> : selectedByCategory(category).map((item) => <span className="preview-thumb" key={item.catalogItemId}><img src={item.imageUrl} alt={item.name} /><small>{item.name}</small></span>)}
            </div>
          </div>
        ))}
      </section>
      <div className="preview-bottom">
        <section className="panel save-method">
          <h2><Shirt size={18} /> 저장 방식</h2>
          <p>새 옷장을 만들지, 기존 옷장에 담을지 선택해 주세요.</p>
          <div className="save-mode-row">
            <button className={props.catalogSaveMode === 'create' ? 'selected' : ''} type="button" onClick={() => props.setCatalogSaveMode('create')}><strong>새 옷장 만들기</strong><small>선택한 옷들로 새로운 옷장을 만듭니다.</small></button>
            <button className={props.catalogSaveMode === 'append' ? 'selected' : ''} type="button" onClick={() => props.setCatalogSaveMode('append')}><strong>기존 옷장에 담기</strong><small>현재 옷장에 이어서 아이템을 채워 넣습니다.</small></button>
          </div>
          {props.catalogSaveMode === 'create' ? <label>새 옷장 이름<input value={props.newWardrobeName} onChange={(event) => props.setNewWardrobeName(event.target.value)} /></label> : <label>담을 옷장<select value={props.activeWardrobe?.id ?? ''} disabled>{props.wardrobes.map((wardrobe) => <option key={wardrobe.id} value={wardrobe.id}>{wardrobe.name}</option>)}</select></label>}
        </section>
        <section className="panel selection-summary">
          <h2>선택 요약</h2>
          <div className="summary-grid"><span><small>총 선택</small><strong>{props.selectedCatalogItems.length}개</strong></span><span><small>상의/하의</small><strong>{selectedByCategory('상의').length}/{selectedByCategory('하의').length}</strong></span><span><small>아우터</small><strong>{selectedByCategory('아우터').length}개</strong></span><span><small>저장 대상</small><strong>{props.catalogSaveMode === 'create' ? '새 옷장' : '기존 옷장'}</strong></span></div>
          <button className="black-button full" type="button" onClick={props.onSaveCatalog}>선택한 옷 {props.catalogSaveMode === 'create' ? '새 옷장에 담기' : '기존 옷장에 담기'} <ChevronRight size={16} /></button>
        </section>
      </div>
    </section>
  );
}

// 사용자가 직접 의류를 등록하는 화면입니다. 이미지, 카테고리, 타입, 색상, 사이즈, 브랜드를 입력받습니다.
function ManualAdd(props: {
  setView: (view: WardrobeView) => void;
  onBack: () => void;
  manual: any;
  setManual: React.Dispatch<React.SetStateAction<any>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveBackground: () => void;
  onPrecisionExtract: () => void;
  backgroundRemoveStatus: 'idle' | 'processing' | 'done' | 'error';
  backgroundRemoveError: string;
  onCategory: (category: ClothingCategory) => void;
  onSaveManual: () => void;
}) {
  const sizes = props.manual.category === '하의' ? SIZES.bottoms : props.manual.category === '신발' ? SIZES.shoes : SIZES.tops;
  const detectedColors = props.manual.segmentation?.colors ?? [];
  const selectedColorMeta = colorMetaForInput(props.manual.color);
  const structuredMeta = buildColorMeta(props.manual.category, props.manual.type, props.manual.color, detectedColors, props.manual.brand);
  return (
    <section className="wardrobe-page">
      <BackTitle title="나만의 옷 추가" description="사진을 올리고 색상, 종류, 보유 상태를 직접 입력합니다." onBack={props.onBack} />
      <section className="panel manual-layout">
        <div>
          <div className="image-preview">{props.manual.imageUrl ? <img src={props.manual.imageUrl} alt="preview" /> : <Upload />}</div>
          <div className="upload-actions">
            <button className="line-button" onClick={() => props.fileInputRef.current?.click()} type="button">앨범에서 선택</button>
            <button className="line-button" onClick={() => props.cameraInputRef.current?.click()} type="button">사진 찍기</button>
            <button className="line-button" onClick={props.onRemoveBackground} disabled={!props.manual.imageFile || props.backgroundRemoveStatus === 'processing'} type="button">{props.backgroundRemoveStatus === 'processing' ? '누끼 처리 중' : '누끼 따기'}</button>
            <button className="line-button" onClick={props.onPrecisionExtract} disabled={!props.manual.imageFile || props.backgroundRemoveStatus === 'processing'} type="button">{props.backgroundRemoveStatus === 'processing' ? '처리 중' : '정밀 누끼'}</button>
          </div>
          {props.backgroundRemoveStatus === 'processing' && <p className="manual-helper">AI가 사진을 분석하고 있습니다...</p>}
          {props.backgroundRemoveStatus === 'error' && <p className="manual-helper error">{props.backgroundRemoveError}</p>}
          {props.manual.aiAnalyzed && (
            <div className="ai-analysis-badge">
              <span className="ai-badge-header">AI 자동 분석 완료</span>
              <div className="ai-badge-pills">
                <span>{props.manual.category}</span>
                {props.manual.predictedSeasonTag && props.manual.predictedSeasonTag !== '미분류' && (
                  <span>{props.manual.predictedSeasonTag}</span>
                )}
                {props.manual.predictedMaterial && (
                  <span>{MATERIAL_LABELS[props.manual.predictedMaterial as MaterialType] ?? props.manual.predictedMaterial}</span>
                )}
                {props.manual.aiConfidence !== null && (
                  <span className="ai-confidence">신뢰도 {Math.round((props.manual.aiConfidence as number) * 100)}%</span>
                )}
              </div>
              <p className="ai-badge-note">아래 폼을 확인하고 필요하면 수정 후 저장하세요.</p>
            </div>
          )}
          <div className="structured-meta-panel">
            <span>재질 <strong>{MATERIAL_LABELS[structuredMeta.material]}</strong></span>
            <span>패턴 <strong>{PATTERN_LABELS[structuredMeta.patternType]}</strong></span>
            {structuredMeta.isDenim && structuredMeta.denimWash && <span>데님 톤 <strong>{DENIM_WASH_LABELS[structuredMeta.denimWash]}</strong></span>}
          </div>
          {detectedColors.length > 0 && (
            <div className="detected-palette" aria-label="누끼 이미지 대표 색상">
              <strong>감지 색상</strong>
              <div>
                {detectedColors.map((color: ClothingColorAnalysis) => (
                  <button
                    key={color.hex}
                    type="button"
                    title={`${color.hex} · ${Math.round((color.ratio ?? 0) * 100)}%`}
                    onClick={() => props.setManual((prev: any) => ({ ...prev, color: color.hex }))}
                  >
                    <i style={{ backgroundColor: color.hex }} />
                    <span>{color.hex}</span>
                    <em>{Math.round((color.ratio ?? 0) * 100)}%</em>
                  </button>
                ))}
              </div>
            </div>
          )}
          <input ref={props.fileInputRef} type="file" accept="image/*" hidden onChange={props.onFileChange} />
          <input ref={props.cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={props.onFileChange} />
        </div>
        <div className="form-grid manual-form">
          <fieldset className="category-picker">
            <legend>카테고리{props.manual.aiAnalyzed && <span className="ai-auto-tag">AI 자동 선택</span>}</legend>
            <div>
              {CATEGORY_OPTIONS.map((category) => {
                const meta = CATEGORY_UI_META[category];
                return (
                  <button className={props.manual.category === category ? 'active' : ''} key={category} type="button" onClick={() => props.onCategory(category)}>
                    <strong>{meta.label}</strong>
                    <small>{meta.hint}</small>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label>종류<select value={props.manual.type} onChange={(event) => props.setManual((prev: any) => ({ ...prev, type: event.target.value }))}>{TYPES[props.manual.category as ClothingCategory].map((item) => <option key={item}>{item}</option>)}</select></label>
          <fieldset className="color-picker">
            <legend>색상</legend>
            <div className="selected-color-summary">
              <i style={{ backgroundColor: selectedColorMeta.hex }} />
              <span><strong>{isHexColor(props.manual.color) ? '감지 원색' : props.manual.color}</strong><small>{selectedColorMeta.hex}</small></span>
            </div>
            <div className="color-picker-grid">
              {Object.entries(COLOR_META).map(([name, meta]) => (
                <button className={props.manual.color === name ? 'active' : ''} key={name} type="button" onClick={() => props.setManual((prev: any) => ({ ...prev, color: name }))}>
                  <i style={{ backgroundColor: meta.hex }} />
                  <span>{name}</span>
                  <small>{meta.hex}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <label>사이즈<select value={props.manual.size} onChange={(event) => props.setManual((prev: any) => ({ ...prev, size: event.target.value }))}>{sizes.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>브랜드<input value={props.manual.brand} onChange={(event) => props.setManual((prev: any) => ({ ...prev, brand: event.target.value }))} placeholder="선택 입력" /></label>
          <label>계절 태그<select value={props.manual.seasonTag} onChange={(event) => props.setManual((prev: any) => ({ ...prev, seasonTag: event.target.value }))}>{SEASON_TAGS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>보유 상태<select value={props.manual.availabilityStatus} onChange={(event) => props.setManual((prev: any) => ({ ...prev, availabilityStatus: event.target.value }))}>{AVAILABILITY_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <button className="black-button" type="button" onClick={props.onSaveManual}>옷장에 저장</button>
        </div>
      </section>
    </section>
  );
}

// 추천 페이지입니다. 날씨, 목적 모드, 옷장 선택값을 바탕으로 코디 추천 리스트를 보여줍니다.
