# 2차 확장 이미지 데이터를 trainingCatalog.ts에 추가합니다.
# 라벨링 미완 데이터라 human_label 없이 자동 season 필드를 사용합니다.
import json, os, glob, shutil

BASE_DIR = r'C:\Users\dheod\Documents\ForMe\project_image_model\이미지 데이터\2차 확장'
PUBLIC_CATALOG_DIR = r'C:\Users\dheod\Downloads\lastbose\통합_퍼컬_옷장\public\catalog'
OUT_TS = r'C:\Users\dheod\Downloads\lastbose\통합_퍼컬_옷장\src\data\trainingCatalog.ts'
ID_PREFIX = 'v2_'

PART_TO_CATEGORY = {
    'upper': '상의',
    'lower': '하의',
    'outer': '아우터',
    'footwear': '신발',
    'accessory': '액세서리',
    'shoe': '신발',
    'bag': '액세서리',
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
    'shoe': '신발',
    'bag, wallet': '가방',
    'hat': '모자',
    'headband, head covering, hair accessory': '헤어액세서리',
    'watch': '시계',
    'belt': '벨트',
}

SEASON_MAP = {'봄/가을': '봄/가을', '여름': '여름', '겨울': '겨울', '사계절': '사계절'}

os.makedirs(PUBLIC_CATALOG_DIR, exist_ok=True)

# 4개 하위 폴더 탐색
subfolders = [d for d in os.scandir(BASE_DIR) if d.is_dir()]

entries = []
copied = skipped = 0

for subfolder in subfolders:
    # *_json 하위 폴더 찾기
    json_dir = next((d.path for d in os.scandir(subfolder.path) if d.is_dir() and d.name.endswith('_json')), None)
    if not json_dir:
        print(f'JSON 폴더 없음: {subfolder.name}')
        continue

    json_files = sorted([f for f in glob.glob(os.path.join(json_dir, '*.json')) if 'summary' not in os.path.basename(f)])
    # 이미지는 *_cropped 폴더 바로 아래
    img_files = {os.path.basename(f): f for f in glob.glob(os.path.join(subfolder.path, '*.png'))}

    print(f'{subfolder.name}: JSON {len(json_files)}개, PNG {len(img_files)}개')

    for jpath in json_files:
        with open(jpath, encoding='utf-8') as f:
            data = json.load(f)

        item_id = ID_PREFIX + data.get('id', '')
        part = data.get('part', 'upper')
        fine_labels = data.get('fine_labels', [])
        colors = data.get('colors', [])
        human_label = data.get('human_label')
        season_auto = data.get('season', '사계절')
        source_file = data.get('source_file', '')

        img_filename = os.path.basename(source_file)
        if img_filename not in img_files:
            skipped += 1
            continue

        category = PART_TO_CATEGORY.get(part, '액세서리')
        fine_label = fine_labels[0] if fine_labels else ''
        subcategory = FINE_LABEL_TO_SUBCATEGORY.get(fine_label, '기타')
        season_src = human_label if human_label else season_auto
        season_tag = SEASON_MAP.get(season_src, '사계절')

        dest_filename = f'{item_id}.png'
        dest_path = os.path.join(PUBLIC_CATALOG_DIR, dest_filename)
        if not os.path.exists(dest_path):
            shutil.copy2(img_files[img_filename], dest_path)
        copied += 1

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

# trainingCatalog.ts 끝에 추가
new_lines = []
for e in entries:
    line = (
        f'  {{ catalogItemId: "{e["id"]}", name: "{e["category"]} {e["subcategory"]}", '
        f'category: "{e["category"]}" as const, subcategory: "{e["subcategory"]}", '
        f'imageUrl: "/catalog/{e["img_filename"]}", color: "{e["rep_hex"]}", '
        f'size: "FREE", brand: "학습 데이터 2차", '
        f'representativeColor: "{e["rep_hex"]}", representativeHex: "{e["rep_hex"]}", '
        f'dominantColors: {e["colors_ts"]}, '
        f'seasonTag: "{e["season_tag"]}", patternType: "solid" as const, '
        f'material: "unknown" as const, isNeutral: false, isDenim: false, '
        f'sourceType: "catalog" as const }},'
    )
    new_lines.append(line)

with open(OUT_TS, encoding='utf-8') as f:
    content = f.read()

# 마지막 ]; 앞에 삽입
insert_before = '];\n'
idx = content.rfind(insert_before)
if idx == -1:
    insert_before = '];'
    idx = content.rfind(insert_before)

if idx == -1:
    print('ERROR: ]; 를 찾지 못했습니다.')
else:
    new_content = content[:idx] + '\n'.join(new_lines) + '\n' + content[idx:]
    with open(OUT_TS, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'추가 완료: {len(entries)}개 → {OUT_TS}')
