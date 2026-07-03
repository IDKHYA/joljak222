// 의류 이미지/색상을 화면에 표시하기 위한 헬퍼 모음
/*
 * clothingDisplay.ts
 *
 * 의류 카드/미리보기에서 어떤 이미지를 보여줄지(clothingDisplayImage),
 * 색상 라벨을 어떻게 표기할지(displayClothingColor), HEX 형식인지(isHexColor)를 판단합니다.
 * 여러 화면 컴포넌트와 App 본체의 색상 입력 처리가 공통으로 사용합니다.
 */
import { DENIM_WASH_LABELS } from '../wardrobeConstants';
import type { ClothingItem } from '../wardrobeTypes';

// 누끼 이미지가 있으면 우선 사용하고, 없으면 원본 의류 이미지를 표시합니다.
export function clothingDisplayImage(item: ClothingItem) {
  return item.cutoutImageUrl || item.imageUrl;
}

// 입력 문자열이 #RRGGBB 형식의 HEX 색상인지 검사합니다.
export function isHexColor(value: string | undefined) {
  return Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));
}

// 의류의 색상 표기를 결정합니다. 데님이면 워시 라벨, HEX면 HEX, 그 외에는 색상명을 사용합니다.
export function displayClothingColor(item: Pick<ClothingItem, 'representativeColor' | 'representativeHex' | 'isDenim' | 'denimWash'>) {
  if (item.isDenim && item.denimWash) return DENIM_WASH_LABELS[item.denimWash];
  return isHexColor(item.representativeColor) ? item.representativeHex : item.representativeColor;
}
