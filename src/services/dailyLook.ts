// 저장 코디를 가상착용(데일리룩) 캔버스 레이어로 자동 배치하는 로직
/*
 * dailyLook.ts
 *
 * 저장된 코디(ScoredClothingItem 목록)를 가상착용 캔버스의 레이어 배열로 변환합니다.
 * 카테고리별 slot을 정하고(slotForItem), 플랫레이 구도 프리셋을 적용해(dailyLookFlatlayPreset)
 * 레이어를 만들며(buildDailyLookLayers), 최종 캔버스 상태를 조립합니다(buildDailyLookState).
 * 외부에는 buildDailyLookState만 노출하고 나머지는 모듈 내부 단계로 둡니다.
 */
import { DAILY_LOOK_CANVAS, DAILY_LOOK_SLOT_BY_CATEGORY, DAILY_LOOK_SLOT_PRESETS } from '../wardrobeConstants';
import type { DailyLookLayer, DailyLookSlot, DailyLookState, ScoredClothingItem } from '../wardrobeTypes';

// 가상착용 캔버스에서 의류가 올라갈 레이어 슬롯을 결정합니다.
function slotForItem(item: ScoredClothingItem): DailyLookSlot {
  if (item.category !== '액세서리') return DAILY_LOOK_SLOT_BY_CATEGORY[item.category];
  if (item.type.includes('모자')) return 'hat';
  if (item.type.includes('가방')) return 'bag';
  return 'accessory';
}

// 추천 저장 직후 보이는 데일리룩 보드는 플랫레이 구도를 우선합니다.
// 핵심 상하의는 중앙 축에 두고, 아우터/가방/모자/신발/액세서리는 주변 여백에 분산해 예시 이미지처럼 한눈에 보이게 합니다.
function dailyLookFlatlayPreset(slot: DailyLookSlot, slotIndex: number): { x: number; y: number; scale: number; rotation: number; zIndex: number } {
  const preset = DAILY_LOOK_SLOT_PRESETS[slot];
  const offsets: Partial<Record<DailyLookSlot, Array<Partial<typeof preset>>>> = {
    outer: [
      { x: 235, y: 365, rotation: -3 },
      { x: 825, y: 365, scale: 0.78, rotation: 3 },
    ],
    upper: [
      { x: 545, y: 350 },
      { x: 390, y: 315, scale: 0.68, rotation: -5 },
    ],
    lower: [
      { x: 545, y: 700 },
      { x: 690, y: 715, scale: 0.76, rotation: 4 },
    ],
    shoes: [
      { x: 760, y: 1120, rotation: -5 },
      { x: 630, y: 1160, rotation: 5 },
    ],
    hat: [
      { x: 785, y: 190 },
      { x: 900, y: 265, scale: 0.32, rotation: -8 },
    ],
    bag: [
      { x: 240, y: 1010 },
      { x: 190, y: 760, scale: 0.38, rotation: -4 },
    ],
    accessory: [
      { x: 830, y: 610 },
      { x: 250, y: 670, rotation: -8 },
      { x: 830, y: 910, scale: 0.3, rotation: 7 },
    ],
  };
  return { ...preset, ...(offsets[slot]?.[slotIndex] ?? {}) };
}

// 저장 코디를 가상착용 레이어 배열로 변환합니다.
// 이전에 사용자가 위치/크기를 조정한 레이어가 있으면 그대로 복원하고, 새 아이템만 기본 프리셋을 적용합니다.
function buildDailyLookLayers(items: ScoredClothingItem[], previous?: DailyLookState): DailyLookLayer[] {
  const previousByItem = new Map(previous?.layers.map((layer) => [layer.itemId, layer]));
  const slotUsage = new Map<DailyLookSlot, number>();
  return items.map((item) => {
    const restored = previousByItem.get(item.id);
    if (restored) return restored;
    const slot = slotForItem(item);
    const slotIndex = slotUsage.get(slot) ?? 0;
    slotUsage.set(slot, slotIndex + 1);
    const preset = dailyLookFlatlayPreset(slot, slotIndex);
    return {
      itemId: item.id,
      category: item.category,
      slot,
      x: preset.x,
      y: preset.y,
      scale: preset.scale,
      rotation: preset.rotation,
      zIndex: preset.zIndex,
      visible: true,
    };
  });
}

// 가상착용 전체 상태를 생성합니다. 캔버스 크기, 레이어, 확정 이미지 정보를 하나로 묶습니다.
export function buildDailyLookState(items: ScoredClothingItem[], previous?: DailyLookState): DailyLookState {
  return {
    canvas: previous?.canvas ?? DAILY_LOOK_CANVAS,
    layers: buildDailyLookLayers(items, previous),
    textLayers: previous?.textLayers ?? [],
    isConfirmed: previous?.isConfirmed ?? false,
    confirmedImage: previous?.confirmedImage,
    confirmedAt: previous?.confirmedAt,
  };
}
