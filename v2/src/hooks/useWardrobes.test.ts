// 옷장 저장 복원 규칙이 v2 카탈로그 ID를 보존하는지 검증합니다.
import { describe, expect, it } from 'vitest';
import { TRAINING_CATALOG_ITEMS } from '../data/trainingCatalog';
import type { ClothingItem } from '../wardrobeTypes';

describe('reconcileStoredClothing', () => {
  it('catalog- 접두사가 없는 현재 v2 카탈로그 의류도 재시작 후 보존한다', async () => {
    const wardrobeModule = await import('./useWardrobes');
    const reconcileStoredClothing = (wardrobeModule as {
      reconcileStoredClothing?: (items: ClothingItem[], catalogItems: typeof TRAINING_CATALOG_ITEMS) => ClothingItem[];
    }).reconcileStoredClothing;
    const catalogItem = TRAINING_CATALOG_ITEMS.find((item) => !item.catalogItemId.startsWith('catalog-'));

    expect(reconcileStoredClothing).toBeTypeOf('function');
    expect(catalogItem).toBeDefined();

    const storedItem: ClothingItem = {
      id: `c-w-demo-1-${catalogItem!.catalogItemId}`,
      wardrobeId: 'w-demo-1',
      imageUrl: 'stale-image.png',
      category: catalogItem!.category,
      type: catalogItem!.subcategory,
      color: catalogItem!.color,
      size: catalogItem!.size,
      brand: catalogItem!.brand,
      createdAt: '2026-07-03T00:00:00.000Z',
      representativeColor: catalogItem!.representativeColor,
      representativeHex: catalogItem!.representativeHex,
      dominantColors: catalogItem!.dominantColors,
      seasonTag: '사계절',
      patternType: catalogItem!.patternType,
      material: catalogItem!.material,
      availabilityStatus: '보유중',
      isNeutral: catalogItem!.isNeutral,
      isDenim: catalogItem!.isDenim,
      denimWash: catalogItem!.denimWash,
      sourceType: 'catalog',
      catalogItemId: catalogItem!.catalogItemId,
    };

    const restored = reconcileStoredClothing!([storedItem], TRAINING_CATALOG_ITEMS);

    expect(restored).toHaveLength(1);
    expect(restored[0].catalogItemId).toBe(catalogItem!.catalogItemId);
    expect(restored[0].imageUrl).toBe(catalogItem!.imageUrl);
  });
});
