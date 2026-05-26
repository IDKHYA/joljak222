# 카탈로그 데이터 품질을 자동 점검하는 스크립트입니다.
# trainingCatalog.ts / outerCatalog.ts 를 파싱해 아이템 수, 이미지 존재 여부,
# 카테고리·시즌·소분류 분포, 중복 ID, 빈 필드를 점검하고 결과를 출력합니다.
import re
import os
import sys
from pathlib import Path
from collections import Counter

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
CATALOG_FILES = [
    ROOT / "src/data/trainingCatalog.ts",
    ROOT / "src/data/outerCatalog.ts",
]
PUBLIC_CATALOG = ROOT / "public/catalog"

# --- 파싱 (라인 단위) ---
def _field(line: str, key: str) -> str:
    m = re.search(rf'{key}:\s*"([^"]*)"', line)
    return m.group(1) if m else ""

def parse_catalog_files():
    items = []
    for path in CATALOG_FILES:
        for line in path.read_text(encoding="utf-8").splitlines():
            if 'catalogItemId:' not in line:
                continue
            cid = _field(line, "catalogItemId")
            if not cid:
                continue
            items.append({
                "catalogItemId":     cid,
                "name":              _field(line, "name"),
                "category":          _field(line, "category"),
                "subcategory":       _field(line, "subcategory"),
                "seasonTag":         _field(line, "seasonTag"),
                "imageUrl":          _field(line, "imageUrl"),
                "representativeHex": _field(line, "representativeHex"),
            })
    return items

# --- 검증 ---
def validate(items):
    issues = []
    ids = [i["catalogItemId"] for i in items]

    dup_ids = [id_ for id_, cnt in Counter(ids).items() if cnt > 1]
    if dup_ids:
        issues.append(f"[WARN] 중복 catalogItemId {len(dup_ids)}개. {dup_ids[:5]}")

    for item in items:
        cid = item["catalogItemId"]
        for field in ["category", "seasonTag", "imageUrl", "representativeHex"]:
            if not item[field]:
                issues.append(f"[WARN] 빈 필드 [{field}] — {cid}")

        image_path = item["imageUrl"]
        if image_path.startswith("/catalog/"):
            fname = image_path.removeprefix("/catalog/")
            if not (PUBLIC_CATALOG / fname).exists():
                issues.append(f"[ERR]  이미지 없음. {fname} ({cid})")

    return issues

# --- 리포트 ---
def report(items, issues):
    print("=" * 56)
    print("  카탈로그 데이터 검증 리포트")
    print("=" * 56)
    print(f"\n총 아이템 수. {len(items)}")

    cat_counter = Counter(i["category"] for i in items)
    print("\n[카테고리 분포]")
    for cat, cnt in sorted(cat_counter.items(), key=lambda x: -x[1]):
        print(f"  {cat:<12} {cnt}개")

    season_counter = Counter(i["seasonTag"] for i in items)
    print("\n[시즌 태그 분포 (상위 10)]")
    for tag, cnt in season_counter.most_common(10):
        print(f"  {tag:<20} {cnt}개")

    subcat_counter = Counter(i["subcategory"] for i in items)
    print(f"\n[소분류 종류 수] {len(subcat_counter)}개")

    if PUBLIC_CATALOG.exists():
        png_count = len(list(PUBLIC_CATALOG.glob("*.png")))
        print(f"\n[public/catalog PNG 파일 수] {png_count}개")
        diff = png_count - len(items)
        if diff < 0:
            print(f"  [WARN] 아이템보다 이미지가 {abs(diff)}개 적음")
        elif diff > 0:
            print(f"  [INFO] 미참조 PNG {diff}개 존재")
    else:
        print("\n[WARN] public/catalog 디렉토리를 찾을 수 없음")

    print(f"\n[검증 이슈] {len(issues)}건")
    if issues:
        for issue in issues:
            print(f"  {issue}")
    else:
        print("  [OK] 이슈 없음")

    print("=" * 56)

if __name__ == "__main__":
    items = parse_catalog_files()
    issues = validate(items)
    report(items, issues)
