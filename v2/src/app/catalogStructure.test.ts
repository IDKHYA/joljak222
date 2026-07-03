// v2 카탈로그 원본 자산과 메타데이터 구조를 검증하는 테스트
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

interface CatalogManifest {
  generatedAt: string;
  source: {
    imageRoot: string;
    trainingCatalogJson: string;
    trainingCatalogTs: string;
    outerCatalogTs: string;
  };
  assets: {
    imageCount: number;
    copiedToPublicCount: number;
  };
  metadata: {
    trainingItemCount: number;
    outerItemCount: number;
  };
}

describe('v2 카탈로그 구조', () => {
  it('원본 이미지와 메타데이터를 v2 폴더 안에 모은다', () => {
    const requiredPaths = [
      'catalog/assets',
      'catalog/metadata/trainingCatalog.json',
      'catalog/metadata/trainingCatalog.ts',
      'catalog/metadata/outerCatalog.ts',
      'catalog/metadata/catalog-manifest.json',
      'public/catalog',
      'src/data/trainingCatalog.json',
      'src/data/trainingCatalog.ts',
      'src/data/outerCatalog.ts',
    ];

    for (const filePath of requiredPaths) {
      expect(existsSync(join(root, filePath)), `${filePath} 경로가 필요합니다.`).toBe(true);
    }
  });

  it('카탈로그 매니페스트는 이미지와 메타데이터 수량을 기록한다', () => {
    const manifest = JSON.parse(
      readFileSync(join(root, 'catalog/metadata/catalog-manifest.json'), 'utf8'),
    ) as CatalogManifest;

    expect(manifest.source.imageRoot).toBe('public/catalog');
    expect(manifest.assets.imageCount).toBeGreaterThanOrEqual(800);
    expect(manifest.assets.copiedToPublicCount).toBe(manifest.assets.imageCount);
    expect(manifest.metadata.trainingItemCount).toBeGreaterThanOrEqual(800);
    expect(manifest.metadata.outerItemCount).toBe(30);
  });
});
