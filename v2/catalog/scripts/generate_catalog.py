# 학습 이미지 JSON 분석 결과를 읽어 카탈로그 TypeScript 데이터를 생성하고
# 이미지를 public/catalog/ 폴더로 복사합니다.
import json, os, glob, shutil, re, sys

RESULT_DIR = r'C:\Users\dheod\Documents\ForMe\project_image_model\이미지 데이터\최종\케이스 1\결과'
IMG_SRC_DIR = r'C:\Users\dheod\Documents\ForMe\project_image_model\이미지 데이터\최종\케이스 1\총합'
PUBLIC_CATALOG_DIR = r'C:\Users\dheod\Downloads\lastbose\통합_퍼컬_옷장\public\catalog'
OUT_TS = r'C:\Users\dheod\Downloads\lastbose\통합_퍼컬_옷장\src\data\trainingCatalog.ts'

PART_TO_CATEGORY = {
    'upper': '상의',
    'lower': '하의',
    'outer': '아우터',
    'footwear': '신발',
    'accessory': '액세서리',
}

FINE_LABEL_TO_SUBCATEGORY = {
    'shirt, blouse': '셔츠',
    'top, t-shirt, sweatshirt': '티셔츠',
    'sweater': '니트',
    'cardigan': '가디건',
    'jacket': '재킷',
    'vest': '조끼',
    'pants': '바지',
    'shorts': '반바지',
    'skirt': '스커트',
    'coat': '코트',
    'dress': '원피스',
    'jumpsuit': '점프수트',
    'cape': '케이프',
    'scarf': '스카프',
    'glove': '장갑',
    'leg warmer': '레그워머',
    'tights, stockings': '타이즈',
    'hood': '후드',
}

SEASON_MAP = {
    '봄/가을': '봄/가을',
    '여름': '여름',
    '겨울': '겨울',
}

os.makedirs(PUBLIC_CATALOG_DIR, exist_ok=True)
os.makedirs(os.path.dirname(OUT_TS), exist_ok=True)

json_files = sorted([f for f in glob.glob(os.path.join(RESULT_DIR, '*.json')) if 'summary' not in f])
print(f'JSON 파일 수: {len(json_files)}')

# source_file 경로에서 파일명만 추출해 총합 폴더의 실제 이미지와 매핑합니다.
all_imgs = {f: os.path.join(IMG_SRC_DIR, f) for f in os.listdir(IMG_SRC_DIR) if f.lower().endswith('.png')}
print(f'이미지 파일 수: {len(all_imgs)}')

entries = []
copied = 0
skipped = 0

for jpath in json_files:
    with open(jpath, encoding='utf-8') as f:
        data = json.load(f)

    item_id = data.get('id', '')
    part = data.get('part', 'upper')
    fine_labels = data.get('fine_labels', [])
    colors = data.get('colors', [])
    human_label = data.get('human_label') or data.get('season', '사계절')
    source_file = data.get('source_file', '')

    # source_file에서 파일명 추출
    img_filename = os.path.basename(source_file)

    if img_filename not in all_imgs:
        skipped += 1
        continue

    category = PART_TO_CATEGORY.get(part, '상의')
    fine_label = fine_labels[0] if fine_labels else ''
    subcategory = FINE_LABEL_TO_SUBCATEGORY.get(fine_label, '기타')
    season_tag = SEASON_MAP.get(human_label, '사계절')

    # 이미지 복사
    dest_filename = f'{item_id}.png'
    dest_path = os.path.join(PUBLIC_CATALOG_DIR, dest_filename)
    if not os.path.exists(dest_path):
        shutil.copy2(all_imgs[img_filename], dest_path)
    copied += 1

    # colors 배열 → TypeScript dominantColors
    colors_ts_parts = []
    for c in colors[:3]:
        hex_val = c.get('hex', '#888888')
        ratio = c.get('ratio', 0)
        colors_ts_parts.append(f'{{ hex: "{hex_val}", ratio: {ratio:.4f} }}')
    colors_ts = '[' + ', '.join(colors_ts_parts) + ']'

    rep_hex = colors[0]['hex'] if colors else '#888888'

    entries.append({
        'id': item_id,
        'category': category,
        'subcategory': subcategory,
        'season_tag': season_tag,
        'rep_hex': rep_hex,
        'colors_ts': colors_ts,
        'img_filename': dest_filename,
    })

print(f'처리됨: {copied}, 스킵: {skipped}')

# TypeScript 파일 생성
lines = [
    '// 퍼스널컬러 ML 모델 학습에 사용된 516개 의류 이미지로 구성된 카탈로그 데이터입니다.',
    "import type { CatalogItem } from '../App';",
    '',
    'export const TRAINING_CATALOG_ITEMS: CatalogItem[] = [',
]

for e in entries:
    line = (
        f'  {{ catalogItemId: "{e["id"]}", name: "{e["category"]} {e["subcategory"]}", '
        f'category: "{e["category"]}" as const, subcategory: "{e["subcategory"]}", '
        f'imageUrl: "/catalog/{e["img_filename"]}", color: "{e["rep_hex"]}", '
        f'size: "FREE", brand: "학습 데이터", '
        f'representativeColor: "{e["rep_hex"]}", representativeHex: "{e["rep_hex"]}", '
        f'dominantColors: {e["colors_ts"]}, '
        f'seasonTag: "{e["season_tag"]}", patternType: "solid" as const, '
        f'material: "unknown" as const, isNeutral: false, isDenim: false, '
        f'sourceType: "catalog" as const }},'
    )
    lines.append(line)

lines.append('];')

with open(OUT_TS, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

print(f'생성 완료: {OUT_TS}')
print(f'총 항목: {len(entries)}개')
