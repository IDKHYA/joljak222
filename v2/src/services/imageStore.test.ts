// IndexedDB 이미지 저장(오프로드/복원) 동작을 fake-indexeddb로 검증하는 테스트
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { putImage, getImage, deleteImage, offloadImages, rehydrateImages, deleteItemImages, isImageMarker } from './imageStore';
import type { ClothingItem } from '../wardrobeTypes';

const DATA_URL = 'data:image/png;base64,AAAA';

function item(overrides: Partial<ClothingItem>): ClothingItem {
  return { id: 'x', imageUrl: '', sourceType: 'upload', ...overrides } as ClothingItem;
}

describe('imageStore — 기본 CRUD', () => {
  it('put → get → delete 라운드트립', async () => {
    await putImage('k1', DATA_URL);
    expect(await getImage('k1')).toBe(DATA_URL);
    await deleteImage('k1');
    expect(await getImage('k1')).toBeNull();
  });
});

describe('offloadImages / rehydrateImages', () => {
  it('data URL은 마커로 치환·저장되고, 복원하면 원래 data URL로 돌아온다', async () => {
    const items = [item({ id: 'a', imageUrl: DATA_URL, cutoutImageUrl: DATA_URL })];
    const light = await offloadImages(items);
    expect(isImageMarker(light[0].imageUrl)).toBe(true);
    expect(isImageMarker(light[0].cutoutImageUrl)).toBe(true);
    // 가벼운 목록에는 data URL이 없어야 한다(localStorage 용량 보호)
    expect(light[0].imageUrl.startsWith('data:')).toBe(false);

    const hydrated = await rehydrateImages(light);
    expect(hydrated[0].imageUrl).toBe(DATA_URL);
    expect(hydrated[0].cutoutImageUrl).toBe(DATA_URL);
  });

  it('카탈로그 URL(/catalog/..)은 오프로드 대상이 아니다', async () => {
    const items = [item({ id: 'c', imageUrl: '/catalog/upper_shirt_001.png', sourceType: 'catalog' })];
    const light = await offloadImages(items);
    expect(light[0].imageUrl).toBe('/catalog/upper_shirt_001.png');
  });

  it('마커에 해당하는 데이터가 없으면 마커를 유지한다', async () => {
    const items = [item({ id: 'missing', imageUrl: 'idb:missing:imageUrl' })];
    const hydrated = await rehydrateImages(items);
    expect(hydrated[0].imageUrl).toBe('idb:missing:imageUrl');
  });

  it('deleteItemImages는 해당 항목 이미지를 모두 정리한다', async () => {
    await offloadImages([item({ id: 'd', imageUrl: DATA_URL })]);
    expect(await getImage('d:imageUrl')).toBe(DATA_URL);
    await deleteItemImages('d');
    expect(await getImage('d:imageUrl')).toBeNull();
  });
});
