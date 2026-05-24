// 학습 카탈로그 JSON 데이터를 앱 타입으로 노출합니다.
import catalogItems from './trainingCatalog.json';

type ClothingCategory = '상의' | '하의' | '아우터' | '신발' | '액세서리';
type PatternType = 'solid' | 'stripe' | 'plaid' | 'graphic';
type MaterialType = 'cotton' | 'denim' | 'knit' | 'leather' | 'nylon' | 'wool' | 'unknown';
type DenimWash = 'light' | 'mid' | 'dark' | 'black';

export interface CatalogItem {
  catalogItemId: string;
  name: string;
  category: ClothingCategory;
  subcategory: string;
  imageUrl: string;
  color: string;
  size: string;
  brand: string;
  representativeColor: string;
  representativeHex: string;
  dominantColors: { hex?: string; ratio?: number }[];
  seasonTag: string;
  patternType: PatternType;
  material: MaterialType;
  isNeutral: boolean;
  isDenim: boolean;
  denimWash?: DenimWash;
  sourceType: 'catalog';
}

export const TRAINING_CATALOG_ITEMS = catalogItems as CatalogItem[];
