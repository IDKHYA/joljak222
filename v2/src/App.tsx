/*
 * App.tsx
 *
 * 이 파일은 통합 퍼스널컬러 AI 옷장 앱의 최상위 애플리케이션 계층입니다.
 * React SPA의 페이지 전환, localStorage 기반 영속 상태, 옷장/의류/추천/저장 코디/데일리룩 흐름을 한 곳에서 연결합니다.
 *
 * 큰 흐름은 다음과 같습니다.
 * 1. 퍼스널컬러 진단 결과(FinalResult)를 저장하고 이력을 관리합니다.
 * 2. 옷장(Wardrobe)과 의류(ClothingItem)를 localStorage에서 읽고 저장합니다.
 * 3. 카탈로그 의류와 사용자가 직접 업로드한 의류를 같은 ClothingItem 구조로 통합합니다.
 * 4. 의류 대표 HEX를 Lab 색공간으로 변환해 퍼스널컬러 팔레트와 Delta E 거리 기반 적합도 점수를 계산합니다.
 * 5. 날씨 구간, 보유 상태, 색상 조화도, 퍼스널컬러 점수를 합산해 코디 추천을 생성합니다.
 * 6. 추천 결과를 SavedOutfit으로 저장하고, Try On/데일리룩 레이어 구성으로 확장합니다.
 *
 * 의류/추천 도메인은 별도 모듈로 분리되어 있습니다.
 * 타입은 wardrobeTypes.ts, 상수는 wardrobeConstants.ts, 추천 엔진은 services/recommendationEngine.ts에 있으며,
 * 이 파일에는 화면 컴포넌트, 라우팅, localStorage 영속 상태, 가상착용(데일리룩) 로직이 남아 있습니다.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Camera,
  Check,
  ChevronRight,
  CloudSun,
  Grid2X2,
  Home,
  List,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Shirt,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import PhotoAnalyzer from './components/PhotoAnalyzer';
import Questionnaire from './components/Questionnaire';
import { BackTitle, Chip, ColorTileGrid, EmptyState, InfoBox, MetricBox, PageTitle, PanelTitle, StatCard } from './components/common';
import { FAMILY_GUIDES, FAMILY_LABELS, PERSONAL_COLOR_MODEL_NOTE, SEASON_DETAILS } from './seasonContent';
import { TRAINING_CATALOG_ITEMS } from './data/trainingCatalog';
import type { CatalogItem } from './data/trainingCatalog';
import { useWeather } from './hooks/useWeather';
import { FinalResult } from './types';
import type {
  ClothingCategory,
  ClothingItem,
  MaterialType,
  Page,
  RecommendationMode,
  RecommendationWeatherBand,
  SeasonTag,
  ScoredClothingItem,
} from './wardrobeTypes';
import {
  CUTOUT_VERSION,
  SEASON_LABELS,
} from './wardrobeConstants';
import {
  buildRecommendations,
  scoreItemForPersonalColor,
} from './services/recommendationEngine';
import { INITIAL_WARDROBES, useWardrobes } from './hooks/useWardrobes';
import { useSavedOutfits } from './hooks/useSavedOutfits';
import { useAppRoute } from './hooks/useAppRoute';
import { usePersonalColor } from './hooks/usePersonalColor';
import { useManualClothing } from './hooks/useManualClothing';
import { HomeDashboard } from './features/home/HomeDashboard';
import { WardrobeSection } from './features/wardrobe/WardrobeSection';
import { RecommendationDashboard } from './features/recommendation/RecommendationDashboard';
import { AnchorOutfitFinder } from './features/recommendation/AnchorOutfitFinder';
import { SavedOutfits } from './features/saved-outfits/SavedOutfits';
import { TryOn } from './features/try-on/TryOn';
import { PersonalColorHistoryPanel, PersonalResult } from './features/personal/PersonalResult';
import { buildColorMeta, catalogFromAnalysis, categoryFromMeta, dominantColorFromAnalysis, normalizeSeasonTag } from './services/clothingMeta';
import { clothingDisplayImage } from './services/clothingDisplay';
import { imageUrlToUploadBlob, requestBackgroundRemoval } from './services/clothingImageApi';

// 수동으로 정의한 샘플 카탈로그 데이터를 앱 내부 CatalogItem 형태로 만듭니다.
function catalog(id: string, name: string, category: ClothingCategory, subcategory: string, color: string, size: string, brand: string, imageUrl: string): CatalogItem {
  const meta = buildColorMeta(category, subcategory, color);
  return { catalogItemId: id, name, category, subcategory, imageUrl, color, size, brand, ...meta, sourceType: 'catalog' };
}

// 이미지 분석 결과의 part 정보를 사용해 카테고리를 보정합니다.
// fallback이 액세서리로 들어온 경우에도 실제로는 하의/아우터/신발일 수 있어 여기서 정리합니다.
const INITIAL_CATALOG_ITEMS: CatalogItem[] = [
  catalog('catalog-1', '베이직 무지 화이트 반팔 티셔츠', '상의', '반팔티', '화이트', 'M', 'Fitly Basic', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-2', '오버핏 스트라이프 셔츠', '상의', '셔츠', '블루', 'M', 'Monday Label', 'https://images.unsplash.com/photo-1596755094514-f87e32f85e2c?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-3', '블록 꼬지 터틀넥 니트', '상의', '니트', '아이보리', 'S', 'Soft Day', 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-4', '파스텔 크롭 가디건', '상의', '가디건', '핑크', 'S', 'Cotton Room', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-5', '빈티지 그래픽 맨투맨', '상의', '맨투맨', '블랙', 'L', 'Graphic Lab', 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-6', '스트레이트 핏 연청 데님', '하의', '청바지', '데님', '28', 'Denim Standard', 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-7', '와이드 핀턱 슬랙스', '하의', '슬랙스', '블랙', '29', 'Office Form', 'https://images.unsplash.com/photo-1506629905607-d9c297d4c040?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-8', '치노 숏 팬츠', '하의', '반바지', '베이지', '28', 'Sunny Wear', 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-9', '롱 플리츠 스커트', '하의', '스커트', '카키', 'M', 'Calm Line', 'https://images.unsplash.com/photo-1583496661160-fb5886a13d27?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-10', '생지 데님 팬츠', '하의', '청바지', '데님', '29', 'Denim Standard', 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-11', '싱글 버튼 오버핏 블레이저', '아우터', '블레이저', '브라운', 'M', 'Office Form', 'https://images.unsplash.com/photo-1551489186-cf8726f514f8?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-12', '클래식 비건 레더 자켓', '아우터', '재킷', '블랙', 'M', 'Monday Label', 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-13', '베이직 트렌치 코트', '아우터', '트렌치코트', '베이지', 'M', 'Soft Day', 'https://images.unsplash.com/photo-1520975954732-35dd22299614?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-14', '루즈핏 청자켓', '아우터', '재킷', '데님', 'M', 'Denim Standard', 'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-15', '경량 필딩 자켓', '아우터', '재킷', '카키', 'L', 'Daily Layer', 'https://images.unsplash.com/photo-1548883354-94bcfe321cbb?auto=format&fit=crop&w=700&q=80'),
  catalog('catalog-16', '화이트 스니커즈', '신발', '스니커즈', '화이트', '270', 'Clean Step', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=700&q=80'),
];

const ACTIVE_CATALOG_ITEMS = TRAINING_CATALOG_ITEMS;

// 기준 옷 코디 찾기에서 카탈로그 후보 풀에 부여하는 가상 옷장 id입니다.
// 옷장(보유) 아이템과 출처를 구분하고, 카탈로그 아이템끼리 id가 안정적으로 유지되게 합니다.
const ANCHOR_CATALOG_POOL_ID = 'anchor-catalog-pool';

// 카탈로그 상품을 사용자의 특정 옷장에 들어가는 실제 ClothingItem으로 복사합니다.
// 같은 카탈로그라도 옷장별로 별도 id를 갖게 해 삭제/상태 변경을 독립적으로 처리합니다.
function fromCatalog(item: CatalogItem, wardrobeId: string): ClothingItem {
  return {
    id: `c-${wardrobeId}-${item.catalogItemId}`,
    wardrobeId,
    imageUrl: item.imageUrl,
    category: item.category,
    type: item.subcategory,
    color: item.color,
    size: item.size,
    brand: item.brand,
    createdAt: new Date().toISOString(),
    representativeColor: item.representativeColor,
    representativeHex: item.representativeHex,
    dominantColors: item.dominantColors,
    seasonTag: normalizeSeasonTag(item.seasonTag),
    patternType: item.patternType,
    material: item.material,
    availabilityStatus: '보유중',
    isNeutral: item.isNeutral,
    isDenim: item.isDenim,
    denimWash: item.denimWash,
    sourceType: 'catalog',
    catalogItemId: item.catalogItemId,
  };
}

function catalogToDailyLookItem(item: CatalogItem): ScoredClothingItem {
  return {
    ...fromCatalog(item, 'catalog-dailylook'),
    id: `catalog-dailylook-${item.catalogItemId}`,
    personalFitScore: null,
    fitGrade: null,
    fitReason: '카탈로그에서 데일리룩 만들기에 추가한 아이템입니다.',
    avoidRisk: false,
  };
}

// 모바일 레이아웃/카메라 처리 분기를 위한 viewport 검사입니다.
function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches;
}

// 앱의 최상위 상태 컨테이너입니다.
// 퍼스널컬러 결과, 옷장/의류, 추천 코디, 저장 코디, 라우팅 상태를 여기서 관리하고 하위 화면에 props로 내려줍니다.
function App() {
  const { setPhotoData, personalColorResult, personalColorHistory, completeQuestionnaire, applyPersonalColorRecord, resetPersonalColor } = usePersonalColor();
  const { wardrobes, clothingItems, selectedWardrobeId, setSelectedWardrobeId, scoredItems, activeWardrobe, activeItems, wardrobeHealthScore, readyWardrobeCount, persistClothing, createWardrobe, deleteClothing, renameWardrobe, deleteWardrobe, resetWardrobes, updateClothingItems } = useWardrobes(personalColorResult, ACTIVE_CATALOG_ITEMS);
  const { page, analysisStep, setAnalysisStep, wardrobeView, navigate, goPage, goBack } = useAppRoute(
    selectedWardrobeId,
    setSelectedWardrobeId,
    wardrobes[0]?.id ?? INITIAL_WARDROBES[0].id,
  );
  const [catalogCategory, setCatalogCategory] = useState<'전체' | ClothingCategory>('전체');
  const [detailCategory, setDetailCategory] = useState<'전체' | ClothingCategory>('전체');
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [catalogSaveMode, setCatalogSaveMode] = useState<'create' | 'append'>('append');
  const [newWardrobeName, setNewWardrobeName] = useState('나의 새 옷장');
  const [wardrobeSearch, setWardrobeSearch] = useState('');
  const [detailSearch, setDetailSearch] = useState('');
  const [detailLayout, setDetailLayout] = useState<'grid' | 'list'>('grid');
  const [recommendMode, setRecommendMode] = useState<RecommendationMode>('데일리');
  const [recommendSearch, setRecommendSearch] = useState('');
  const [recommendRequested, setRecommendRequested] = useState(false);
  const [selectedRecommendWardrobes, setSelectedRecommendWardrobes] = useState<Set<string>>(() => new Set(INITIAL_WARDROBES.map((item) => item.id)));
  const weatherState = useWeather();
  const [weatherBand, setWeatherBand] = useState<RecommendationWeatherBand>('20~22도');
  const [weatherTouched, setWeatherTouched] = useState(false);
  const { manual, setManual, fileInputRef, cameraInputRef, backgroundRemoveStatus, backgroundRemoveError, handleFileChange, removeManualBackground, extractManualClothingPrecisely, handleManualCategory } = useManualClothing();

  useEffect(() => {
    if (!weatherTouched && weatherState.data) setWeatherBand(weatherState.data.weatherBand);
  }, [weatherState.data, weatherTouched]);

  useEffect(() => {
    if (!wardrobes.some((wardrobe) => wardrobe.id === selectedWardrobeId)) {
      setSelectedWardrobeId(wardrobes[0]?.id ?? '');
    }
    setSelectedRecommendWardrobes((prev) => {
      const next = new Set([...prev].filter((id) => wardrobes.some((wardrobe) => wardrobe.id === id)));
      if (next.size === 0) wardrobes.forEach((wardrobe) => next.add(wardrobe.id));
      return next;
    });
  }, [selectedWardrobeId, wardrobes]);

  const dailyLookSourceItems = useMemo(() => [...scoredItems, ...ACTIVE_CATALOG_ITEMS.map(catalogToDailyLookItem)], [scoredItems]);
  const { savedOutfits, activeTryOnOutfitId, saveOutfit, deleteSavedOutfit, updateSavedOutfitDailyLook, createBlankDailyLook: createBlankDailyLookState, openDailyLookMaker: setActiveDailyLook, resetSavedOutfits } = useSavedOutfits(dailyLookSourceItems);
  const filteredCatalog = catalogCategory === '전체' ? ACTIVE_CATALOG_ITEMS : ACTIVE_CATALOG_ITEMS.filter((item) => item.category === catalogCategory);
  const selectedCatalogItems = ACTIVE_CATALOG_ITEMS.filter((item) => selectedCatalogIds.includes(item.catalogItemId));
  const recommendItems = scoredItems.filter((item) => selectedRecommendWardrobes.has(item.wardrobeId));
  const recommendations = useMemo(() => buildRecommendations(recommendItems, weatherBand, recommendMode, personalColorResult), [recommendItems, weatherBand, recommendMode, personalColorResult]);

  // 기준 옷 코디 찾기. 카탈로그 전체를 퍼스널컬러 점수까지 매겨 후보 풀로 만들어 두고(memo), 옷장 풀과 함께 넘긴다.
  const anchorCatalogPool = useMemo(
    () => ACTIVE_CATALOG_ITEMS.map((item) => scoreItemForPersonalColor(fromCatalog(item, ANCHOR_CATALOG_POOL_ID), personalColorResult)),
    [personalColorResult],
  );
  const [anchorItem, setAnchorItem] = useState<ScoredClothingItem | null>(null);

  const completeQuestionnaireAndNavigate = (scores: Parameters<typeof completeQuestionnaire>[0], rawResponses: Parameters<typeof completeQuestionnaire>[1]) => {
    if (completeQuestionnaire(scores, rawResponses)) navigate({ page: 'personal', analysisStep: 'result' });
  };

  const saveCatalogSelection = () => {
    if (selectedCatalogIds.length === 0) return;
    const targetWardrobeId = catalogSaveMode === 'create' ? createWardrobe(newWardrobeName.trim() || '나의 새 옷장') : activeWardrobe?.id;
    if (!targetWardrobeId) return;
    const existingCatalogIds = new Set(clothingItems.filter((item) => item.wardrobeId === targetWardrobeId).map((item) => item.catalogItemId));
    const additions = selectedCatalogItems
      .filter((item) => !existingCatalogIds.has(item.catalogItemId))
      .map((item) => fromCatalog(item, targetWardrobeId));
    persistClothing([...clothingItems, ...additions]);
    setSelectedCatalogIds([]);
    navigate({ page: 'wardrobe', wardrobeView: 'detail', selectedWardrobeId: targetWardrobeId }, { replace: true });
    setCatalogSaveMode('append');
  };

  const addManualItem = () => {
    if (!activeWardrobe) return;
    const detectedColor = dominantColorFromAnalysis(manual.segmentation?.colors);
    const meta = buildColorMeta(manual.category, manual.type, manual.color, manual.segmentation?.colors, manual.brand);
    const item: ClothingItem = {
      id: `manual-${Date.now()}`,
      wardrobeId: activeWardrobe.id,
      imageUrl: manual.cutoutImageUrl || manual.imageUrl || 'https://images.unsplash.com/photo-1648483098902-7af8f711498f?auto=format&fit=crop&w=700&q=80',
      originalImageUrl: manual.originalImageUrl || manual.imageUrl || undefined,
      cutoutImageUrl: manual.cutoutImageUrl || undefined,
      segmentation: manual.segmentation ?? undefined,
      category: manual.category,
      type: manual.type,
      color: manual.color,
      size: manual.size,
      brand: manual.brand || '직접 등록',
      createdAt: new Date().toISOString(),
      representativeColor: meta.representativeColor,
      representativeHex: detectedColor?.hex ?? meta.representativeHex,
      dominantColors: meta.dominantColors,
      seasonTag: ((manual.predictedSeasonTag && manual.predictedSeasonTag !== '미분류')
        ? manual.predictedSeasonTag
        : manual.seasonTag) as SeasonTag,
      patternType: meta.patternType,
      material: (manual.predictedMaterial as MaterialType | null) ?? meta.material,
      availabilityStatus: manual.availabilityStatus,
      isNeutral: meta.isNeutral,
      isDenim: meta.isDenim,
      denimWash: meta.denimWash,
      sourceType: 'upload',
    };
    persistClothing([...clothingItems, item]);
    navigate({ page: 'wardrobe', wardrobeView: 'detail' }, { replace: true });
  };

  const createBlankDailyLook = () => {
    createBlankDailyLookState();
    navigate({ page: 'tryon' });
  };

  const openDailyLookMaker = (id: string) => {
    setActiveDailyLook(id);
    navigate({ page: 'tryon' });
  };

  const openWardrobeFromDailyLook = (wardrobeId: string) => {
    navigate({ page: 'wardrobe', selectedWardrobeId: wardrobeId, wardrobeView: 'detail' });
  };

  const ensureDailyLookCutouts = async (itemIds: string[]) => {
    const targets = clothingItems.filter((item) => itemIds.includes(item.id) && (!item.cutoutImageUrl || item.segmentation?.version !== CUTOUT_VERSION));
    for (const item of targets) {
      try {
        const sourceUrl = item.originalImageUrl || item.imageUrl;
        const sourceBlob = await imageUrlToUploadBlob(sourceUrl);
        const result = await requestBackgroundRemoval(sourceBlob, `${item.id}.png`);
        const detectedColor = dominantColorFromAnalysis(result.colors);
        const nextColor = detectedColor?.hex ?? item.color;
        const nextMeta = buildColorMeta(item.category, item.type, nextColor, result.colors, item.brand);
        updateClothingItems((prev) => {
          const next = prev.map((entry) => entry.id === item.id ? {
            ...entry,
            imageUrl: result.imageDataUrl,
            cutoutImageUrl: result.imageDataUrl,
            originalImageUrl: entry.originalImageUrl || sourceUrl,
            segmentation: {
              width: result.width,
              height: result.height,
              bbox: result.bbox,
              colors: result.colors ?? [],
              model: result.model,
              version: result.version ?? CUTOUT_VERSION,
              processedAt: result.processedAt,
            },
            color: nextColor,
            representativeColor: nextMeta.representativeColor,
            representativeHex: detectedColor?.hex ?? nextMeta.representativeHex,
            dominantColors: nextMeta.dominantColors,
            patternType: nextMeta.patternType,
            material: nextMeta.material,
            isNeutral: nextMeta.isNeutral,
            isDenim: nextMeta.isDenim,
            denimWash: nextMeta.denimWash,
          } : entry);
          return next;
        });
      } catch (error) {
        throw new Error(`${item.type} 누끼 처리 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }
  };

  const resetAllData = () => {
    resetPersonalColor();
    setAnalysisStep('photo');
    resetWardrobes();
    resetSavedOutfits();
  };

  const openCatalog = (mode: 'create' | 'append') => {
    setCatalogSaveMode(mode);
    setSelectedCatalogIds([]);
    setCatalogCategory('전체');
    navigate({ page: 'wardrobe', wardrobeView: 'catalog' });
  };

  return (
    <div className="fitly-shell">
      <Sidebar page={page} go={goPage} personalColorResult={personalColorResult} />
      <div className="mobile-app-frame">
        <header className="mobile-header">
          <button type="button" onClick={() => goPage('home')}><Home size={19} /></button>
          <span className="mobile-brand-title"><strong>Fitly</strong><small>Personal_Color_Project</small></span>
          <button type="button" onClick={() => goPage('settings')}><User size={17} /></button>
        </header>
        <main className="app-main">
          {page === 'home' && (
            <HomeDashboard
              personalColorResult={personalColorResult}
              wardrobes={wardrobes}
              scoredItems={scoredItems}
              savedOutfits={savedOutfits}
              weather={weatherState.data}
              weatherLoading={weatherState.loading}
              weatherError={weatherState.error}
              weatherSource={weatherState.source}
              weatherBand={weatherBand}
              refreshWeather={weatherState.refresh}
              recommendationCount={recommendations.length}
              go={goPage}
              openCatalog={() => openCatalog('create')}
              openManual={() => navigate({ page: 'wardrobe', wardrobeView: 'manual' })}
            />
          )}

          {page === 'personal' && (
            <section className="page-stack">
              <PageTitle title="나만의 퍼스널컬러 찾기" description="촬영과 설문으로 측정한 결과가 옷장 추천 기준으로 저장됩니다." icon={<Camera />} />
              {analysisStep === 'photo' && <PhotoAnalyzer onAnalysisComplete={(result) => { setPhotoData(result); navigate({ page: 'personal', analysisStep: 'questionnaire' }); }} />}
              {analysisStep === 'questionnaire' && <Questionnaire onComplete={completeQuestionnaireAndNavigate} />}
              {analysisStep === 'result' && personalColorResult && <PersonalResult result={personalColorResult} onRetry={() => navigate({ page: 'personal', analysisStep: 'photo' })} />}
            </section>
          )}

          {page === 'wardrobe' && (
            <WardrobeSection
              view={wardrobeView}
              setView={(view) => navigate({ page: 'wardrobe', wardrobeView: view })}
              onBack={goBack}
              wardrobes={wardrobes}
              activeWardrobe={activeWardrobe}
              allItems={scoredItems}
              activeItems={activeItems}
              wardrobeHealthScore={wardrobeHealthScore}
              readyWardrobeCount={readyWardrobeCount}
              wardrobeSearch={wardrobeSearch}
              setWardrobeSearch={setWardrobeSearch}
              detailSearch={detailSearch}
              setDetailSearch={setDetailSearch}
              detailCategory={detailCategory}
              setDetailCategory={setDetailCategory}
              detailLayout={detailLayout}
              setDetailLayout={setDetailLayout}
              catalogItems={filteredCatalog}
              catalogCategory={catalogCategory}
              setCatalogCategory={setCatalogCategory}
              selectedCatalogIds={selectedCatalogIds}
              setSelectedCatalogIds={setSelectedCatalogIds}
              selectedCatalogItems={selectedCatalogItems}
              catalogSaveMode={catalogSaveMode}
              setCatalogSaveMode={setCatalogSaveMode}
              newWardrobeName={newWardrobeName}
              setNewWardrobeName={setNewWardrobeName}
              onSelectWardrobe={(id) => navigate({ page: 'wardrobe', selectedWardrobeId: id, wardrobeView: 'detail' })}
              onRenameWardrobe={renameWardrobe}
              onDeleteWardrobe={deleteWardrobe}
              onDeleteItem={deleteClothing}
              onOpenCatalog={openCatalog}
              onSaveCatalog={saveCatalogSelection}
              onRecommend={() => {
                if (activeWardrobe) setSelectedRecommendWardrobes(new Set([activeWardrobe.id]));
                setRecommendRequested(true);
                navigate({ page: 'recommend' });
              }}
              manual={manual}
              setManual={setManual}
              fileInputRef={fileInputRef}
              cameraInputRef={cameraInputRef}
              onFileChange={handleFileChange}
              onRemoveBackground={removeManualBackground}
              onPrecisionExtract={extractManualClothingPrecisely}
              backgroundRemoveStatus={backgroundRemoveStatus}
              backgroundRemoveError={backgroundRemoveError}
              onCategory={handleManualCategory}
              onSaveManual={addManualItem}
              onFindOutfits={setAnchorItem}
            />
          )}

          {page === 'recommend' && (
            !personalColorResult ? (
              <section className="page-stack">
                <BackTitle title="AI 옷장 추천" description="실시간 날씨와 퍼스널컬러, 상황을 함께 반영합니다." onBack={goBack} />
                <EmptyState title="퍼스널 컬러 측정이 필요합니다." description="추천은 측정 결과가 저장된 뒤 활성화됩니다." action={<button className="black-button" type="button" onClick={() => navigate({ page: 'personal', analysisStep: 'photo' })}>측정하러 가기</button>} />
              </section>
            ) : (
              <RecommendationDashboard
                personalColorResult={personalColorResult}
                wardrobes={wardrobes}
                items={scoredItems}
                selectedWardrobes={selectedRecommendWardrobes}
                setSelectedWardrobes={setSelectedRecommendWardrobes}
                search={recommendSearch}
                setSearch={setRecommendSearch}
                mode={recommendMode}
                setMode={(value) => { setRecommendMode(value); setRecommendRequested(false); }}
                weatherBand={weatherBand}
                setWeatherBand={(value) => { setWeatherTouched(true); setWeatherBand(value); setRecommendRequested(false); }}
                weather={weatherState.data}
                weatherLoading={weatherState.loading}
                weatherError={weatherState.error}
                weatherSource={weatherState.source}
                refreshWeather={weatherState.refresh}
                recommendations={recommendations}
                requested={recommendRequested}
                setRequested={setRecommendRequested}
                onSave={saveOutfit}
                onBack={goBack}
              />
            )
          )}

          {page === 'saved' && <SavedOutfits saved={savedOutfits} items={dailyLookSourceItems} wardrobes={wardrobes} onDelete={deleteSavedOutfit} onMakeDailyLook={openDailyLookMaker} onCreateDailyLook={createBlankDailyLook} onOpenWardrobe={openWardrobeFromDailyLook} />}
          {page === 'tryon' && <TryOn saved={savedOutfits} items={dailyLookSourceItems} wardrobes={wardrobes} activeOutfitId={activeTryOnOutfitId} onSaveDailyLook={updateSavedOutfitDailyLook} onEnsureCutouts={ensureDailyLookCutouts} onBack={() => goPage('saved')} />}
          {page === 'settings' && (
            <section className="page-stack">
              <PageTitle title="설정" description="데모 사용자 1명의 저장 데이터를 관리합니다." icon={<Settings />} />
              <PersonalColorHistoryPanel history={personalColorHistory} current={personalColorResult} onApply={applyPersonalColorRecord} />
              <section className="panel settings-panel">
                <button className="line-button" type="button" onClick={() => { resetPersonalColor(); setAnalysisStep('photo'); }}><RotateCcw size={16} /> 퍼스널 컬러 결과 초기화</button>
                <button className="black-button" type="button" onClick={resetAllData}><Check size={16} /> 전체 데모 데이터 초기화</button>
              </section>
            </section>
          )}
        </main>
        {anchorItem && (
          <AnchorOutfitFinder
            anchor={anchorItem}
            wardrobePool={scoredItems}
            catalogPool={anchorCatalogPool}
            personalColorResult={personalColorResult}
            onSave={saveOutfit}
            onClose={() => setAnchorItem(null)}
          />
        )}
        <MobileNav page={page} go={goPage} />
      </div>
    </div>
  );
}

// 데스크톱 좌측 네비게이션입니다. 현재 페이지와 진단 완료 여부를 함께 보여줍니다.
function Sidebar({ page, go, personalColorResult }: { page: Page; go: (page: Page) => void; personalColorResult: FinalResult | null }) {
  const items: Array<[Page, string, typeof Home]> = [
    ['home', '홈', Home],
    ['wardrobe', '옷장', ShoppingBag],
    ['recommend', 'AI 추천', Sparkles],
    ['saved', '데일리룩', Bookmark],
    ['settings', '설정', Settings],
  ];
  return (
    <aside className="desktop-sidebar">
      <button className="sidebar-logo" type="button" onClick={() => go('home')}>
        <span className="brand-mark">F</span>
        <span><strong>Fitly</strong><small>Personal_Color_Project</small></span>
      </button>
      <nav className="sidebar-nav">
        {items.map(([key, label, Icon]) => (
          <button key={key} className={page === key ? 'active' : ''} type="button" onClick={() => go(key)}>
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <button className="sidebar-profile" type="button" onClick={() => go('settings')}>
        <span><User size={15} /></span>
        <span><strong>내 프로필</strong><small>{personalColorResult ? SEASON_LABELS[personalColorResult.seasonTop1Id] : '미측정'}</small></span>
      </button>
    </aside>
  );
}

// 모바일 하단 네비게이션입니다. 좁은 화면에서 주요 페이지 이동을 담당합니다.
function MobileNav({ page, go }: { page: Page; go: (page: Page) => void }) {
  const items: Array<[Page, string, typeof Home]> = [
    ['home', '홈', Home],
    ['wardrobe', '옷장', ShoppingBag],
    ['recommend', '추천', Sparkles],
    ['saved', '데일리룩', Bookmark],
    ['settings', '설정', Settings],
  ];
  return (
    <nav className="mobile-bottom-nav">
      {items.map(([key, label, Icon]) => (
        <button key={key} className={page === key ? 'active' : ''} type="button" onClick={() => go(key)}>
          <Icon size={19} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export default App;
