// 옷장과 의류 상태를 localStorage와 함께 관리하는 훅입니다.
import { useEffect, useMemo, useState } from 'react';
import type { CatalogItem } from '../data/trainingCatalog';
import type { FinalResult } from '../types';
import type { ClothingItem, Wardrobe } from '../wardrobeTypes';
import { STORAGE_KEYS } from '../wardrobeConstants';
import { buildColorMeta, normalizePatternType, normalizeSeasonTag } from '../services/clothingMeta';
import { scoreItemForPersonalColor } from '../services/recommendationEngine';
import { loadJson, saveJson } from '../services/storage';
import { deleteItemImages, offloadImages, rehydrateImages } from '../services/imageStore';

export const INITIAL_WARDROBES: Wardrobe[] = [
  { id: 'w-demo-1', name: '출근용 옷장', createdAt: '2026-04-24T00:00:00.000Z' },
  { id: 'w-demo-2', name: '주말 캐주얼 옷장', createdAt: '2026-04-24T00:00:00.000Z' },
  { id: 'w-demo-3', name: '발표/중요 일정 옷장', createdAt: '2026-04-24T00:00:00.000Z' },
];

const INITIAL_CLOTHING: ClothingItem[] = [];

function normalizeClothingMeta(item: ClothingItem): ClothingItem {
  const meta = buildColorMeta(item.category, item.type, item.color, item.dominantColors ?? item.segmentation?.colors, item.brand);
  return {
    ...item,
    representativeColor: item.representativeColor ?? meta.representativeColor,
    representativeHex: item.representativeHex ?? meta.representativeHex,
    dominantColors: item.dominantColors?.length ? item.dominantColors : meta.dominantColors,
    patternType: normalizePatternType(item.patternType),
    material: item.material ?? meta.material,
    isNeutral: item.isNeutral ?? meta.isNeutral,
    isDenim: item.isDenim ?? meta.isDenim,
    denimWash: item.denimWash ?? meta.denimWash,
  };
}

function reconcileStoredClothing(items: ClothingItem[], catalogItems: CatalogItem[]) {
  const catalogMap = new Map(catalogItems.map((item) => [item.catalogItemId, item]));
  return items
    .filter((item) => item.sourceType !== 'catalog' || item.catalogItemId?.startsWith('catalog-'))
    .map((item) => {
      if (item.sourceType !== 'catalog') return normalizeClothingMeta(item);
      const catalogItem = catalogMap.get(item.catalogItemId ?? '');
      if (!catalogItem) return normalizeClothingMeta(item);
      return normalizeClothingMeta({
        ...item,
        imageUrl: catalogItem.imageUrl,
        category: catalogItem.category,
        type: catalogItem.subcategory,
        color: catalogItem.color,
        brand: catalogItem.brand,
        representativeColor: catalogItem.representativeColor,
        representativeHex: catalogItem.representativeHex,
        dominantColors: catalogItem.dominantColors,
        seasonTag: normalizeSeasonTag(catalogItem.seasonTag),
        patternType: catalogItem.patternType,
        material: catalogItem.material,
        isNeutral: catalogItem.isNeutral,
        isDenim: catalogItem.isDenim,
        denimWash: catalogItem.denimWash,
      });
    });
}

export function useWardrobes(personalColorResult: FinalResult | null, catalogItems: CatalogItem[]) {
  const [wardrobes, setWardrobes] = useState<Wardrobe[]>(() => loadJson(STORAGE_KEYS.wardrobes, INITIAL_WARDROBES));
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>(() => reconcileStoredClothing(loadJson(STORAGE_KEYS.clothing, INITIAL_CLOTHING), catalogItems));
  const [selectedWardrobeId, setSelectedWardrobeId] = useState(() => INITIAL_WARDROBES[0].id);

  // 마운트 시 localStorage의 'idb:' 마커를 IndexedDB의 실제 이미지로 복원한다(업로드 이미지는 IDB가 보관).
  useEffect(() => {
    let active = true;
    rehydrateImages(loadJson(STORAGE_KEYS.clothing, INITIAL_CLOTHING))
      .then((hydrated) => {
        if (active) setClothingItems(reconcileStoredClothing(hydrated, catalogItems));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scoredItems = useMemo(() => clothingItems.map((item) => scoreItemForPersonalColor(item, personalColorResult)), [clothingItems, personalColorResult]);
  const activeWardrobe = wardrobes.find((wardrobe) => wardrobe.id === selectedWardrobeId) ?? wardrobes[0];
  const activeItems = scoredItems.filter((item) => item.wardrobeId === activeWardrobe?.id);
  const wardrobeHealthScore = Math.round(scoredItems.reduce((sum, item) => sum + (item.personalFitScore ?? 100), 0) / Math.max(scoredItems.length, 1));
  const readyWardrobeCount = wardrobes.filter((wardrobe) => {
    const items = clothingItems.filter((item) => item.wardrobeId === wardrobe.id);
    return items.some((item) => item.category === '상의') && items.some((item) => item.category === '하의');
  }).length;

  const persistWardrobes = (next: Wardrobe[]) => {
    setWardrobes(next);
    saveJson(STORAGE_KEYS.wardrobes, next);
  };

  // 의류를 저장한다. 업로드 이미지(data URL)는 IndexedDB로 오프로드하고 localStorage엔 마커만 남겨 용량 초과를 막는다.
  // 오프로드 실패 시 원본을 그대로 저장해 데이터 유실을 방지한다.
  const saveClothing = (next: ClothingItem[]) => {
    offloadImages(next)
      .then((light) => saveJson(STORAGE_KEYS.clothing, light))
      .catch(() => saveJson(STORAGE_KEYS.clothing, next));
  };

  const persistClothing = (next: ClothingItem[]) => {
    setClothingItems(next);
    saveClothing(next);
  };

  const updateClothingItems = (updater: (items: ClothingItem[]) => ClothingItem[]) => {
    setClothingItems((prev) => {
      const next = updater(prev);
      saveClothing(next);
      return next;
    });
  };

  const createWardrobe = (name: string) => {
    const wardrobe: Wardrobe = { id: `w-${Date.now()}`, name, createdAt: new Date().toISOString() };
    persistWardrobes([wardrobe, ...wardrobes]);
    setSelectedWardrobeId(wardrobe.id);
    return wardrobe.id;
  };

  const deleteClothing = (id: string) => {
    void deleteItemImages(id);
    persistClothing(clothingItems.filter((item) => item.id !== id));
  };

  const renameWardrobe = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    persistWardrobes(wardrobes.map((wardrobe) => (wardrobe.id === id ? { ...wardrobe, name: trimmed } : wardrobe)));
  };

  const deleteWardrobe = (id: string) => {
    const nextWardrobes = wardrobes.filter((wardrobe) => wardrobe.id !== id);
    clothingItems.filter((item) => item.wardrobeId === id).forEach((item) => void deleteItemImages(item.id));
    persistWardrobes(nextWardrobes);
    persistClothing(clothingItems.filter((item) => item.wardrobeId !== id));
    setSelectedWardrobeId(nextWardrobes[0]?.id ?? '');
  };

  const resetWardrobes = () => {
    persistWardrobes(INITIAL_WARDROBES);
    persistClothing(INITIAL_CLOTHING);
    setSelectedWardrobeId(INITIAL_WARDROBES[0].id);
  };

  return {
    wardrobes,
    clothingItems,
    setClothingItems,
    selectedWardrobeId,
    setSelectedWardrobeId,
    scoredItems,
    activeWardrobe,
    activeItems,
    wardrobeHealthScore,
    readyWardrobeCount,
    persistClothing,
    createWardrobe,
    deleteClothing,
    renameWardrobe,
    deleteWardrobe,
    resetWardrobes,
    updateClothingItems,
  };
}
