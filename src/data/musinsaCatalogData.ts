/*
 * musinsaCatalogData.ts
 *
 * 대형 이커머스 기반 의류 카탈로그 자산을 Vite import.meta.glob으로 로딩하는 데이터 파일입니다.
 * 카테고리별 이미지 파일과 category_color_outputs JSON 분석 결과를 빌드 시점에 정적 모듈로 묶습니다.
 *
 * App.tsx는 이 파일의 IMAGE_MODULES/META_MODULES를 읽어 CatalogItem 목록을 생성합니다.
 * 이미지 파일명에서 catalogKey를 추출하고, 같은 key의 색상 분석 JSON과 매칭해
 * 대표 HEX, 카테고리, 시즌 태그, 패턴, 중립색/데님 여부 같은 추천 가능한 메타데이터로 정규화합니다.
 *
 * 파일/폴더명에는 원본 수집 출처명이 남아 있을 수 있지만,
 * 발표와 UI에서는 특정 브랜드명이 아니라 "대형 이커머스 기반 카탈로그"로 설명합니다.
 */
export const MUSINSA_IMAGE_MODULES = {
  sweatshirts: import.meta.glob<string>('../../맨투맨-스웨트-무신사-추천-상품-93images/page-images/맨투맨-스웨트-무신사-추천-상품/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' }),
  denimPants: import.meta.glob<string>('../../데님-팬츠-무신사-추천-상품-67images/page-images/데님-팬츠-무신사-추천-상품/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' }),
  knits: import.meta.glob<string>('../../니트-스웨터-무신사-추천-상품-32images/page-images/니트-스웨터-무신사-추천-상품/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' }),
  outers: import.meta.glob<string>('../../아우터-무신사-추천-상품-48images/page-images/아우터-무신사-추천-상품/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' }),
  shortSleeveTshirts: import.meta.glob<string>('../../반소매-티셔츠-무신사-추천-상품-80images/page-images/반소매-티셔츠-무신사-추천-상품/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' }),
};

export const MUSINSA_META_MODULES = {
  sweatshirts: import.meta.glob('../../맨투맨-스웨트-무신사-추천-상품-93images/page-images/category_color_outputs/*_result.json', { eager: true, import: 'default' }),
  denimPants: import.meta.glob('../../데님-팬츠-무신사-추천-상품-67images/page-images/category_color_outputs/*_result.json', { eager: true, import: 'default' }),
  knits: import.meta.glob('../../니트-스웨터-무신사-추천-상품-32images/page-images/category_color_outputs/*_result.json', { eager: true, import: 'default' }),
  outers: import.meta.glob('../../아우터-무신사-추천-상품-48images/page-images/category_color_outputs/*_result.json', { eager: true, import: 'default' }),
  shortSleeveTshirts: import.meta.glob('../../반소매-티셔츠-무신사-추천-상품-80images/page-images/category_color_outputs (3)/*_result.json', { eager: true, import: 'default' }),
};

export type MusinsaSourceId = keyof typeof MUSINSA_IMAGE_MODULES;

export const MUSINSA_CATALOG_SOURCES = [
  { id: 'sweatshirts', category: '상의', subcategory: '맨투맨', fallbackColor: '블랙', size: 'FREE', brand: 'MUSINSA Sweat' },
  { id: 'denimPants', category: '하의', subcategory: '청바지', fallbackColor: '데님', size: 'FREE', brand: 'MUSINSA Denim' },
  { id: 'knits', category: '상의', subcategory: '니트', fallbackColor: '아이보리', size: 'FREE', brand: 'MUSINSA Knit' },
  { id: 'outers', category: '아우터', subcategory: '재킷', fallbackColor: '블랙', size: 'FREE', brand: 'MUSINSA Outer' },
  { id: 'shortSleeveTshirts', category: '상의', subcategory: '반팔티', fallbackColor: '화이트', size: 'FREE', brand: 'MUSINSA Tee' },
] as const satisfies ReadonlyArray<{
  id: MusinsaSourceId;
  category: string;
  subcategory: string;
  fallbackColor: string;
  size: string;
  brand: string;
}>;
