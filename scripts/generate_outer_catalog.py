# 2차 확장 아우터_cropped 폴더의 이미지를 trainingCatalog.ts에 추가합니다.
import json, os, glob, shutil

OUTER_DIR = r'C:\Users\dheod\Documents\ForMe\project_image_model\이미지 데이터\2차 확장\아우터_cropped'
JSON_DIR  = os.path.join(OUTER_DIR, '아우터_json')
PUBLIC_CATALOG_DIR = r'C:\Users\dheod\Downloads\lastbose\통합_퍼컬_옷장\public\catalog'
OUT_TS = r'C:\Users\dheod\Downloads\lastbose\통합_퍼컬_옷장\src\data\trainingCatalog.ts'
ID_PREFIX = 'v2_'

FINE_LABEL_TO_SUBCATEGORY = {
    'jacket': '재킷',
    'coat': '코트',
    'cardigan': '가디건',
    'cape': '케이프',
    'vest': '조끼',
}

SEASON_MAP = {'봄/가을': '봄/가을', '여름': '여름', '겨울': '겨울', '사계절': '사계절'}

os.makedirs(PUBLIC_CATALOG_DIR, exist_ok=True)

# 현재 카탈로그에 등록된 ID 목록 추출 (중복 방지)
with open(OUT_TS, encoding='utf-8') as f:
    existing_content = f.read()
import re
existing_ids = set(re.findall(r'catalogItemId: "([^"]+)"', existing_content))
print(f'기존 카탈로그 항목 수: {len(existing_ids)}')

# PNG 파일 basename → 경로 맵
img_files = {os.path.basename(f): f for f in glob.glob(os.path.join(OUTER_DIR, '*.png'))}
json_files = sorted([f for f in glob.glob(os.path.join(JSON_DIR, '*.json')) if 'summary' not in os.path.basename(f)])
print(f'JSON {len(json_files)}개, PNG {len(img_files)}개')

entries = []
skipped = 0

for jpath in json_files:
    with open(jpath, encoding='utf-8') as f:
        data = json.load(f)

    item_id = ID_PREFIX + data.get('id', '')
    if item_id in existing_ids:
        print(f'  이미 존재, 스킵: {item_id}')
        skipped += 1
        continue

    fine_labels = data.get('fine_labels', [])
    colors = data.get('colors', [])
    season_auto = data.get('season', '사계절')
    source_file = data.get('source_file', '')

    img_filename = os.path.basename(source_file)
    if img_filename not in img_files:
        print(f'  이미지 없음, 스킵: {img_filename}')
        skipped += 1
        continue

    fine_label = fine_labels[0] if fine_labels else ''
    subcategory = FINE_LABEL_TO_SUBCATEGORY.get(fine_label, '재킷')
    season_tag = SEASON_MAP.get(season_auto, '사계절')

    dest_filename = f'{item_id}.png'
    dest_path = os.path.join(PUBLIC_CATALOG_DIR, dest_filename)
    if not os.path.exists(dest_path):
        shutil.copy2(img_files[img_filename], dest_path)

    colors_ts_parts = []
    for c in colors[:3]:
        hex_val = c.get('hex', '#888888')
        ratio = c.get('ratio', 0)
        colors_ts_parts.append(f'{{ hex: "{hex_val}", ratio: {ratio:.4f} }}')
    colors_ts = '[' + ', '.join(colors_ts_parts) + ']'
    rep_hex = colors[0]['hex'] if colors else '#888888'

    entries.append({
        'id': item_id,
        'subcategory': subcategory,
        'season_tag': season_tag,
        'rep_hex': rep_hex,
        'colors_ts': colors_ts,
        'img_filename': dest_filename,
    })

print(f'추가 예정: {len(entries)}개, 스킵: {skipped}개')

if not entries:
    print('추가할 항목 없음.')
    exit()

new_lines = []
for e in entries:
    line = (
        f'  {{ catalogItemId: "{e["id"]}", name: "아우터 {e["subcategory"]}", '
        f'category: "아우터" as const, subcategory: "{e["subcategory"]}", '
        f'imageUrl: "/catalog/{e["img_filename"]}", color: "{e["rep_hex"]}", '
        f'size: "FREE", brand: "학습 데이터 2차", '
        f'representativeColor: "{e["rep_hex"]}", representativeHex: "{e["rep_hex"]}", '
        f'dominantColors: {e["colors_ts"]}, '
        f'seasonTag: "{e["season_tag"]}", patternType: "solid" as const, '
        f'material: "unknown" as const, isNeutral: false, isDenim: false, '
        f'sourceType: "catalog" as const }},'
    )
    new_lines.append(line)

insert_before = '];\n'
idx = existing_content.rfind(insert_before)
if idx == -1:
    insert_before = '];'
    idx = existing_content.rfind(insert_before)

if idx == -1:
    print('ERROR: ]; 를 찾지 못했습니다.')
else:
    new_content = existing_content[:idx] + '\n'.join(new_lines) + '\n' + existing_content[idx:]
    with open(OUT_TS, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'추가 완료: {len(entries)}개 → {OUT_TS}')
