// localStorage JSON 데이터를 읽고 저장하는 유틸리티입니다.
export function loadJson<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`localStorage 저장 실패: ${key}`, error);
  }
}

export function removeJson(key: string) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`localStorage 삭제 실패: ${key}`, error);
  }
}
