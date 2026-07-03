// 업로드 의류 이미지(data URL)를 IndexedDB에 저장해 localStorage 용량 초과를 막는 모듈입니다.
// localStorage에는 메타데이터와 'idb:<key>' 마커만 두고, 실제 이미지 바이트는 IndexedDB가 보관합니다.
import type { ClothingItem } from '../wardrobeTypes';

const DB_NAME = 'fitly-images';
const DB_VERSION = 1;
const STORE = 'images';
const MARKER_PREFIX = 'idb:';
// 데이터 URL을 가질 수 있는 ClothingItem 이미지 필드들. 이것만 오프로드/복원 대상이다.
const IMAGE_FIELDS = ['imageUrl', 'cutoutImageUrl', 'originalImageUrl'] as const;
type ImageField = (typeof IMAGE_FIELDS)[number];

function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putImage(key: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function getImage(key: string): Promise<string | null> {
  const db = await openDb();
  try {
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as string) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function deleteImage(key: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// 의류 목록의 data URL 이미지를 IndexedDB로 옮기고, 해당 필드를 'idb:<key>' 마커로 치환한 가벼운 목록을 돌려줍니다.
// IndexedDB가 없거나 쓰기에 실패하면 원본(데이터 URL 유지)을 그대로 둬 데이터 유실을 막습니다.
export async function offloadImages(items: ClothingItem[]): Promise<ClothingItem[]> {
  if (!idbAvailable()) return items;
  const result: ClothingItem[] = [];
  for (const item of items) {
    let next = item;
    for (const field of IMAGE_FIELDS) {
      const value = item[field] as string | undefined;
      if (typeof value === 'string' && value.startsWith('data:')) {
        const key = `${item.id}:${field}`;
        try {
          await putImage(key, value);
          next = { ...next, [field]: `${MARKER_PREFIX}${key}` } as ClothingItem;
        } catch {
          // 쓰기 실패 시 원본 data URL을 유지한다(유실 방지).
        }
      }
    }
    result.push(next);
  }
  return result;
}

// 'idb:<key>' 마커를 IndexedDB의 실제 data URL로 복원합니다. 데이터 URL/일반 URL은 그대로 둡니다.
export async function rehydrateImages(items: ClothingItem[]): Promise<ClothingItem[]> {
  if (!idbAvailable()) return items;
  const result: ClothingItem[] = [];
  for (const item of items) {
    let next = item;
    for (const field of IMAGE_FIELDS) {
      const value = item[field] as string | undefined;
      if (typeof value === 'string' && value.startsWith(MARKER_PREFIX)) {
        const key = value.slice(MARKER_PREFIX.length);
        try {
          const data = await getImage(key);
          if (data) next = { ...next, [field]: data } as ClothingItem;
        } catch {
          // 읽기 실패 시 마커를 유지한다.
        }
      }
    }
    result.push(next);
  }
  return result;
}

// 한 의류의 이미지들을 IndexedDB에서 정리합니다(삭제 시 고아 데이터 방지). 실패해도 조용히 넘어갑니다.
export async function deleteItemImages(id: string): Promise<void> {
  if (!idbAvailable()) return;
  for (const field of IMAGE_FIELDS) {
    try {
      await deleteImage(`${id}:${field}`);
    } catch {
      // 무시
    }
  }
}

export function isImageMarker(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith(MARKER_PREFIX);
}

export const __testing = { MARKER_PREFIX, IMAGE_FIELDS } as { MARKER_PREFIX: string; IMAGE_FIELDS: readonly ImageField[] };
