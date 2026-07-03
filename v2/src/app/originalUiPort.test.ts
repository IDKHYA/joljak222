// v2 앱 진입점이 원본 UI 흐름을 실제로 이식했는지 검증하는 테스트
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const requiredUiFiles = [
  'src/App.tsx',
  'src/index.css',
  'src/components/PhotoAnalyzer.tsx',
  'src/components/Questionnaire.tsx',
  'src/features/home/HomeDashboard.tsx',
  'src/features/personal/PersonalResult.tsx',
  'src/features/wardrobe/WardrobeSection.tsx',
  'src/features/recommendation/RecommendationDashboard.tsx',
  'src/features/recommendation/AnchorOutfitFinder.tsx',
  'src/features/saved-outfits/SavedOutfits.tsx',
  'src/features/try-on/TryOn.tsx',
  'src/hooks/usePersonalColor.ts',
  'src/hooks/useWardrobes.ts',
  'src/hooks/useSavedOutfits.ts',
  'src/hooks/useManualClothing.ts',
  'src/services/personalColorEngine.ts',
  'src/services/recommendationEngine.ts',
  'src/services/imageStore.ts',
  'components/ui/button.tsx',
  'components/ui/card.tsx',
  'components/ui/progress.tsx',
];

describe('v2 원본 UI 이식 계약', () => {
  it('원본 화면 흐름에 필요한 소스 파일을 v2 폴더 안에 보유한다', () => {
    for (const filePath of requiredUiFiles) {
      expect(existsSync(join(root, filePath)), `${filePath} 파일이 필요합니다.`).toBe(true);
    }
  });

  it('앱 진입점은 prototype 대시보드가 아니라 원본 UI 흐름을 사용한다', () => {
    const appSource = readFileSync(join(root, 'src/App.tsx'), 'utf8');

    expect(appSource).toContain('HomeDashboard');
    expect(appSource).toContain('PhotoAnalyzer');
    expect(appSource).toContain('Questionnaire');
    expect(appSource).toContain('RecommendationDashboard');
    expect(appSource).toContain('TryOn');
    expect(appSource).not.toContain('골든 패스 대시보드');
  });

  it('첫 prototype 대시보드는 별도 폴더에 보존한다', () => {
    const prototypePath = join(root, 'src/prototype/PrototypeDashboard.tsx');

    expect(existsSync(prototypePath)).toBe(true);
    expect(readFileSync(prototypePath, 'utf8')).toContain('골든 패스 대시보드');
  });
});
