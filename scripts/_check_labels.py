# 임시 디버그 스크립트
import json, re, sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

LABEL_ROOT = Path(r"C:\Users\dheod\Documents\ForMe\project_image_model\이미지 데이터")
ROOT = Path(r"C:\Users\dheod\Downloads\lastbose\통합_퍼컬_옷장")
CATALOG_FILES = [
    ROOT / "src/data/trainingCatalog.ts",
    ROOT / "src/data/outerCatalog.ts",
]

catalog_ids = set()
for path in CATALOG_FILES:
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.search(r'catalogItemId:\s*"([^"]+)"', line)
        if m:
            catalog_ids.add(m.group(1))

null_ids = set()
for p in LABEL_ROOT.rglob("*.json"):
    if p.name == "summary.json":
        continue
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
        if d.get("human_label") is None:
            null_ids.add(d.get("id", p.stem))
    except Exception:
        pass

in_catalog = null_ids & catalog_ids
not_in_catalog = null_ids - catalog_ids
no_json = catalog_ids - set()  # 아래서 채울 예정

all_json_ids = set()
for p in LABEL_ROOT.rglob("*.json"):
    if p.name == "summary.json":
        continue
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
        all_json_ids.add(d.get("id", p.stem))
    except Exception:
        pass

no_json_catalog = catalog_ids - all_json_ids

print(f"카탈로그 총:              {len(catalog_ids)}")
print(f"null JSON 총:             {len(null_ids)}")
print(f"카탈로그에 있는 null:     {len(in_catalog)}")
print(f"카탈로그에 없는 null:     {len(not_in_catalog)}")
print(f"JSON 자체가 없는 카탈로그: {len(no_json_catalog)}")
print(f"=> 실제 미분류 합계:       {len(in_catalog) + len(no_json_catalog)}")
print()
print("카탈로그에 없는 null ID 샘플:")
for x in sorted(not_in_catalog)[:10]:
    print(f"  {x}")
