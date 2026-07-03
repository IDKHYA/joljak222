# 옷 추가 도메인 추출 평가: detect_dominant_category 단위검증 + 실모델 카테고리 정확도 측정
import sys
import os
import json
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))
from background_remove_api import detect_dominant_category, run_fashion_segmentation  # noqa: E402

CAT_MAP = {"upper": "상의", "lower": "하의", "outer": "아우터", "shoe": "신발", "bag": "액세서리"}


def unit_tests():
    up = np.zeros((10, 10), dtype=np.uint8); up[:, :6] = 2
    assert detect_dominant_category(up)[0] == "upper"
    lo = np.full((10, 10), 7, dtype=np.uint8)
    assert detect_dominant_category(lo)[0] == "lower"
    sh = np.full((10, 10), 24, dtype=np.uint8)
    assert detect_dominant_category(sh)[0] == "shoe"
    assert detect_dominant_category(np.zeros((5, 5), dtype=np.uint8))[0] is None
    print("[unit] detect_dominant_category 통과")


def accuracy_eval(per_cat=6):
    data = json.load(open(os.path.join(ROOT, "src/data/trainingCatalog.json"), encoding="utf-8"))
    buckets = {}
    for x in data:
        buckets.setdefault(x["category"], []).append(x)
    sample = []
    for items in buckets.values():
        sample += items[:per_cat]

    total = 0
    correct = 0
    per = {}
    for x in sample:
        path = os.path.join(ROOT, "public", x["imageUrl"].lstrip("/"))
        if not os.path.exists(path):
            continue
        img = Image.open(path).convert("RGB")
        pred = run_fashion_segmentation(img)
        dom = detect_dominant_category(pred)[0]
        got = CAT_MAP.get(dom)
        exp = x["category"]
        ok = got == exp
        total += 1
        correct += ok
        per.setdefault(exp, [0, 0])
        per[exp][1] += 1
        per[exp][0] += ok
        print(f"  {x['catalogItemId']:26} exp={exp} got={got} {'OK' if ok else 'X'}", flush=True)

    print(f"[eval] 카테고리 정확도 = {correct}/{total} = {correct / total * 100:.1f}%")
    for c, (ok, n) in per.items():
        print(f"  - {c}: {ok}/{n}")


if __name__ == "__main__":
    unit_tests()
    accuracy_eval()
