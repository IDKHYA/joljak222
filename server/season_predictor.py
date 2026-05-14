# SegFormer 세그멘테이션 결과에서 계절/재질을 예측하는 모듈
# background_remove_api.py의 /api/clothing/extract 엔드포인트에서 import해 사용합니다.
from __future__ import annotations

import colorsys
import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

FASHION_LABELS: dict[int, str] = {
    0: "Unlabelled", 1: "shirt, blouse", 2: "top, t-shirt, sweatshirt",
    3: "sweater", 4: "cardigan", 5: "jacket", 6: "vest", 7: "pants",
    8: "shorts", 9: "skirt", 10: "coat", 11: "dress", 12: "jumpsuit",
    13: "cape", 14: "glasses", 15: "hat", 16: "headband, head covering, hair accessory",
    17: "tie", 18: "glove", 19: "watch", 20: "belt", 21: "leg warmer",
    22: "tights, stockings", 23: "sock", 24: "shoe", 25: "bag, wallet",
    26: "scarf", 27: "umbrella", 28: "hood", 29: "collar", 32: "sleeve",
    33: "pocket", 34: "neckline", 35: "buckle", 36: "zipper",
}

UPPER_IDS = {1, 2, 3, 6, 28, 29, 32, 34}
LOWER_IDS = {7, 8, 9}
OUTER_IDS = {4, 5, 10, 13, 28, 29, 32, 34}
FULLBODY_IDS = {11, 12}
ALL_CLOTHING_IDS = UPPER_IDS | LOWER_IDS | OUTER_IDS | FULLBODY_IDS
DETAIL_IDS = {14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 32, 33, 34, 35, 36}
MAIN_IDS = {"upper": {1, 2, 3, 6}, "lower": {7, 8, 9}, "outer": {4, 5, 10, 13}}

ALL_LABEL_KEYS = [
    "shirt, blouse", "top, t-shirt, sweatshirt", "sweater", "cardigan",
    "jacket", "vest", "pants", "shorts", "skirt", "coat", "dress",
    "jumpsuit", "cape", "hood", "collar", "sleeve", "neckline",
    "glasses", "hat", "headband, head covering, hair accessory",
    "tie", "glove", "watch", "belt", "leg warmer", "tights, stockings",
    "sock", "shoe", "bag, wallet", "scarf", "umbrella", "pocket", "buckle", "zipper",
]

LABEL_SEASON_SCORE: dict[str, dict[str, float]] = {
    "shorts": {"여름": 3}, "top, t-shirt, sweatshirt": {"여름": 1, "봄/가을": 1},
    "shirt, blouse": {"여름": 1, "봄/가을": 1}, "skirt": {"여름": 1, "봄/가을": 1},
    "dress": {"여름": 1, "봄/가을": 1}, "vest": {"여름": 1, "봄/가을": 1},
    "jacket": {"봄/가을": 2}, "cardigan": {"봄/가을": 2}, "jumpsuit": {"봄/가을": 1},
    "cape": {"봄/가을": 1}, "pants": {"봄/가을": 1}, "coat": {"겨울": 3},
    "sweater": {"겨울": 2, "봄/가을": 1}, "leg warmer": {"겨울": 2},
    "tights, stockings": {"겨울": 1}, "glove": {"겨울": 2}, "scarf": {"겨울": 2},
}

DETAIL_SEASON_SCORE: dict[str, dict[str, float]] = {
    "hood": {"겨울": 1}, "zipper": {"겨울": 1},
    "pocket": {"봄/가을": 1}, "buckle": {"봄/가을": 1},
}

MATERIAL_FROM_FINE_LABEL: dict[str, str] = {
    "sweater": "knit", "cardigan": "knit", "coat": "wool", "jacket": "nylon",
    "vest": "nylon", "pants": "cotton", "shorts": "cotton", "skirt": "cotton",
    "shirt, blouse": "cotton", "top, t-shirt, sweatshirt": "cotton",
    "dress": "cotton", "jumpsuit": "cotton",
}

VALID_SEASONS = ("봄/가을", "여름", "겨울")

ARTIFACTS_DIR = Path(__file__).parent / "artifacts"

_model = None
_feature_columns: list[str] | None = None


def get_season_model():
    global _model, _feature_columns
    if _model is not None:
        return _model, _feature_columns
    model_path = ARTIFACTS_DIR / "season_model.joblib"
    cols_path = ARTIFACTS_DIR / "feature_columns.json"
    if not model_path.exists() or not cols_path.exists():
        print(f"[season-predictor] 모델 파일 없음: {ARTIFACTS_DIR}", flush=True)
        return None, None
    import joblib
    _model = joblib.load(model_path)
    _feature_columns = json.loads(cols_path.read_text(encoding="utf-8"))
    print("[season-predictor] 계절 분류 모델 로드 완료", flush=True)
    return _model, _feature_columns


def _safe_col(value: Any) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in str(value)).strip("_") or "unknown"


def _flatten(prefix: str, value: Any, row: dict) -> None:
    if not isinstance(value, dict):
        return
    for key, item in value.items():
        if isinstance(item, dict):
            _flatten(f"{prefix}_{_safe_col(key)}", item, row)
        elif isinstance(item, (int, float, bool)):
            row[f"{prefix}_{_safe_col(key)}"] = float(item)


def extract_label_pixel_ratios(pred: np.ndarray, mask: np.ndarray) -> dict:
    total = int(mask.sum())
    if total == 0:
        return {key: 0.0 for key in ALL_LABEL_KEYS}
    result: dict[str, float] = {}
    for label_id, label_name in FASHION_LABELS.items():
        if label_id == 0:
            continue
        result[label_name] = round(int(((pred == label_id) & mask).sum()) / total, 4)
    for key in ALL_LABEL_KEYS:
        result.setdefault(key, 0.0)
    return result


def extract_bbox(mask: np.ndarray) -> dict:
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    if not rows.any():
        return {"x": 0, "y": 0, "width": 0, "height": 0, "area_ratio": 0.0, "center_y_ratio": 0.0}
    row_min = int(np.where(rows)[0][0])
    row_max = int(np.where(rows)[0][-1])
    col_min = int(np.where(cols)[0][0])
    col_max = int(np.where(cols)[0][-1])
    h, w = mask.shape
    bbox_h = row_max - row_min + 1
    bbox_w = col_max - col_min + 1
    return {
        "x": col_min, "y": row_min, "width": bbox_w, "height": bbox_h,
        "area_ratio": round((bbox_h * bbox_w) / (h * w), 4),
        "center_y_ratio": round((row_min + bbox_h / 2) / h, 4),
    }


def extract_shape(mask: np.ndarray) -> dict:
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    if not rows.any():
        return {"height_width_ratio": 0.0, "fill_ratio": 0.0}
    row_min = int(np.where(rows)[0][0])
    row_max = int(np.where(rows)[0][-1])
    col_min = int(np.where(cols)[0][0])
    col_max = int(np.where(cols)[0][-1])
    bbox_h = row_max - row_min + 1
    bbox_w = col_max - col_min + 1
    bbox_area = bbox_h * bbox_w
    fill = int(mask[row_min:row_max + 1, col_min:col_max + 1].sum()) / bbox_area if bbox_area else 0.0
    return {"height_width_ratio": round(bbox_h / bbox_w if bbox_w else 0.0, 4), "fill_ratio": round(fill, 4)}


def extract_color_stats(pil_img: Image.Image, mask: np.ndarray) -> dict:
    img_arr = np.array(pil_img.convert("RGB"))
    if img_arr.shape[:2] != mask.shape:
        resized = np.array(Image.fromarray(mask.astype(np.uint8)).resize((img_arr.shape[1], img_arr.shape[0]), Image.NEAREST)) > 0
    else:
        resized = mask

    pixels = img_arr[resized].astype(np.float32)
    empty = {"brightness_mean": 0.0, "brightness_std": 0.0, "saturation_mean": 0.0, "saturation_std": 0.0,
             "neutral_ratio": 0.0, "warm_ratio": 0.0, "cool_ratio": 0.0, "other_color_ratio": 0.0,
             "dark_ratio": 0.0, "bright_ratio": 0.0, "brightness_range": 0.0, "color_variance": 0.0, "edge_density": 0.0}
    if len(pixels) == 0:
        return empty

    r, g, b = pixels[:, 0], pixels[:, 1], pixels[:, 2]
    brightness = (r + g + b) / 3
    hsv = np.array([colorsys.rgb_to_hsv(px[0] / 255, px[1] / 255, px[2] / 255) for px in pixels])
    hue, saturation = hsv[:, 0], hsv[:, 1]
    neutral = saturation < 0.15
    warm = ((hue <= 0.17) | (hue >= 0.93)) & ~neutral
    cool = ((hue >= 0.45) & (hue <= 0.75)) & ~neutral

    stats = {
        "brightness_mean": round(float(brightness.mean()), 2),
        "brightness_std": round(float(brightness.std()), 2),
        "saturation_mean": round(float(saturation.mean()), 4),
        "saturation_std": round(float(saturation.std()), 4),
        "neutral_ratio": round(float(neutral.mean()), 4),
        "warm_ratio": round(float(warm.mean()), 4),
        "cool_ratio": round(float(cool.mean()), 4),
        "other_color_ratio": round(float(1.0 - neutral.mean() - warm.mean() - cool.mean()), 4),
        "dark_ratio": round(float((brightness < 80).mean()), 4),
        "bright_ratio": round(float((brightness > 180).mean()), 4),
        "brightness_range": round(float(brightness.max() - brightness.min()), 2),
        "color_variance": round(float(pixels.var()), 2),
    }
    try:
        import cv2
        gray = np.zeros(resized.shape, dtype=np.uint8)
        gray[resized] = np.clip(np.mean(img_arr[resized], axis=1), 0, 255).astype(np.uint8)
        edges = cv2.Canny(gray, 50, 150)
        stats["edge_density"] = round(float(edges[resized].mean()) / 255, 4)
    except ImportError:
        stats["edge_density"] = 0.0
    return stats


def extract_quality(mask: np.ndarray, all_clothing_mask: np.ndarray, img_shape: tuple) -> dict:
    total = img_shape[0] * img_shape[1]
    part_px = int(mask.sum())
    all_px = int(all_clothing_mask.sum())
    return {
        "image_pixel_count": total,
        "all_clothing_pixel_count": all_px,
        "part_pixel_count": part_px,
        "clothing_visibility_ratio": round(all_px / total, 4) if total else 0.0,
        "part_visibility_ratio": round(part_px / total, 4) if total else 0.0,
        "part_share_ratio": round(part_px / all_px, 4) if all_px else 0.0,
        "is_low_visibility": (all_px / total < 0.05) if total else True,
        "is_small_crop": part_px < 2000,
    }


def get_dominant_colors(pil_img: Image.Image, mask: np.ndarray, n_colors: int = 5) -> list[dict]:
    try:
        from sklearn.cluster import KMeans
        from sklearn.metrics import silhouette_score
    except ImportError:
        return []

    img_small = pil_img.convert("RGB")
    w, h = img_small.size
    scale = min(512 / max(w, h), 1.0)
    if scale < 1.0:
        sz = (int(w * scale), int(h * scale))
        img_small = img_small.resize(sz, Image.BILINEAR)
        mask_small = np.array(Image.fromarray(mask.astype(np.uint8)).resize(sz, Image.NEAREST)) > 0
    else:
        mask_small = mask

    pixels = np.array(img_small)[mask_small].astype(np.float32)
    if len(pixels) < 10:
        return []

    best_k, best_score = 1, -1.0
    for k in range(2, min(n_colors + 1, len(pixels))):
        km = KMeans(n_clusters=k, random_state=42, n_init=5)
        labels_k = km.fit_predict(pixels)
        try:
            step = max(1, len(pixels) // 2000)
            score = silhouette_score(pixels[::step], labels_k[::step])
        except Exception:
            score = -1.0
        if score > best_score:
            best_score, best_k = score, k

    km = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    label_arr = km.fit_predict(pixels)
    centers = np.round(km.cluster_centers_).astype(int)
    total = len(label_arr)
    colors = []
    for idx in range(best_k):
        ratio = int((label_arr == idx).sum()) / total
        if ratio < 0.04:
            continue
        rgb = centers[idx].tolist()
        colors.append({"rgb": rgb, "hex": "#{:02X}{:02X}{:02X}".format(*rgb), "ratio": round(ratio, 4)})
    return sorted(colors, key=lambda c: c["ratio"], reverse=True)


def get_rule_season(fine_labels: list[str], detail_labels: list[str], colors: list[dict],
                    pred: np.ndarray, mask: np.ndarray, img_shape: tuple) -> tuple[str, dict, str]:
    score: dict[str, float] = {"봄/가을": 0.0, "여름": 0.0, "겨울": 0.0}

    for label in fine_labels:
        for season, point in LABEL_SEASON_SCORE.get(label, {}).items():
            score[season] += point
    for label in detail_labels:
        for season, point in DETAIL_SEASON_SCORE.get(label, {}).items():
            score[season] += point
    for color in colors[:2]:
        r, g, b = color["rgb"]
        brightness = (r + g + b) / 3
        ratio = color["ratio"]
        if brightness > 180:
            score["여름"] += 1.0 * ratio
            score["봄/가을"] += 0.5 * ratio
        elif brightness < 80:
            score["겨울"] += 1.0 * ratio
            score["봄/가을"] += 0.5 * ratio
        else:
            score["봄/가을"] += 1.0 * ratio

    clothing_px = int(mask.sum())
    if clothing_px > 0:
        sleeve_px = int(((pred == 32) & mask).sum())
        sleeve_ratio = sleeve_px / clothing_px
        if sleeve_ratio < 0.08:
            score["여름"] += 2.0
        elif sleeve_ratio >= 0.20:
            score["봄/가을"] += 1.0
            score["겨울"] += 1.0

    total_px = img_shape[0] * img_shape[1]
    if total_px > 0:
        exposure = clothing_px / total_px
        if exposure < 0.10:
            score["여름"] += 2.0
        elif exposure >= 0.40:
            score["겨울"] += 2.0
        else:
            score["봄/가을"] += 0.5

    total = sum(score.values())
    if total == 0:
        return "미분류", score, "low"
    best = max(score, key=score.get)
    confidence = "high" if score[best] / total > 0.6 else "low"
    return best, score, confidence


def infer_labels_from_pred(pred: np.ndarray, mask: np.ndarray, part: str) -> tuple[list[str], list[str]]:
    main_ids = MAIN_IDS.get(part, set())
    main_mask = np.isin(pred, list(main_ids)) & mask
    fine_labels = [FASHION_LABELS[int(lid)] for lid in np.unique(pred[main_mask])
                   if int(lid) in FASHION_LABELS and int(lid) != 0]
    detail_mask = np.isin(pred, list(DETAIL_IDS)) & mask
    detail_labels = [FASHION_LABELS[int(lid)] for lid in np.unique(pred[detail_mask])
                     if int(lid) in FASHION_LABELS and int(lid) != 0]
    return fine_labels, detail_labels


def infer_material(fine_labels: list[str]) -> str:
    for label in fine_labels:
        mat = MATERIAL_FROM_FINE_LABEL.get(label)
        if mat:
            return mat
    return "unknown"


def _build_feature_row(item: dict) -> dict:
    row: dict[str, float] = {}
    part = str(item.get("part") or "unknown")
    for candidate in ("upper", "lower", "outer"):
        row[f"part_{candidate}"] = 1.0 if part == candidate else 0.0
    row["fullbody_expanded"] = 1.0 if item.get("fullbody_expanded") else 0.0

    features = item.get("features") or {}
    _flatten("label_ratio", features.get("label_pixel_ratios"), row)
    _flatten("bbox", features.get("bbox"), row)
    _flatten("shape", features.get("shape"), row)
    _flatten("color_stats", features.get("color_stats"), row)
    _flatten("quality", features.get("quality"), row)

    for label in (item.get("fine_labels") or []):
        row[f"fine_{_safe_col(label)}"] = 1.0
    for label in (item.get("detail_labels") or []):
        row[f"detail_{_safe_col(label)}"] = 1.0

    colors = item.get("colors") or []
    row["colors_count"] = float(len(colors))
    for i, color in enumerate(colors[:5], start=1):
        rgb = color.get("rgb") or [0, 0, 0]
        if len(rgb) >= 3:
            r, g, b = float(rgb[0]), float(rgb[1]), float(rgb[2])
            row[f"color_{i}_r"] = r
            row[f"color_{i}_g"] = g
            row[f"color_{i}_b"] = b
            row[f"color_{i}_brightness"] = (r + g + b) / 3.0
        row[f"color_{i}_ratio"] = float(color.get("ratio") or 0.0)

    season_score = item.get("season_score") or {}
    for season in VALID_SEASONS:
        row[f"rule_score_{_safe_col(season)}"] = float(season_score.get(season) or 0.0)

    conf = item.get("season_confidence")
    if isinstance(conf, str):
        row["rule_confidence_high"] = 1.0 if conf.lower() == "high" else 0.0
        row["rule_confidence_low"] = 1.0 if conf.lower() == "low" else 0.0

    rule_season = item.get("season")
    for season in VALID_SEASONS + ("미분류",):
        row[f"rule_season_{_safe_col(season)}"] = 1.0 if rule_season == season else 0.0

    return row


def predict(pred: np.ndarray, mask: np.ndarray, pil_img: Image.Image, target_part: str) -> dict[str, Any]:
    """
    SegFormer 결과에서 계절 분류와 재질을 예측합니다.

    Returns:
        predictedSeason: "봄/가을" | "여름" | "겨울" | "미분류"
        seasonConfidence: 0.0 ~ 1.0
        seasonProbabilities: 계절별 확률 (ML 모델이 있을 때만)
        predictedMaterial: ClothingItem.material 값
    """
    img_shape = np.array(pil_img).shape[:2]
    fine_labels, detail_labels = infer_labels_from_pred(pred, mask, target_part)
    colors = get_dominant_colors(pil_img, mask)
    rule_season, rule_score, rule_confidence = get_rule_season(
        fine_labels, detail_labels, colors, pred, mask, img_shape
    )
    material = infer_material(fine_labels)

    fallback = {
        "predictedSeason": rule_season,
        "seasonConfidence": 0.7 if rule_confidence == "high" else 0.4,
        "predictedMaterial": material,
    }

    model, feature_columns = get_season_model()
    if model is None or feature_columns is None:
        return fallback

    try:
        import pandas as pd
        all_clothing_mask = np.isin(pred, list(ALL_CLOTHING_IDS))
        item_dict = {
            "part": target_part,
            "fullbody_expanded": False,
            "fine_labels": fine_labels,
            "detail_labels": detail_labels,
            "colors": colors,
            "season": rule_season,
            "season_score": rule_score,
            "season_confidence": rule_confidence,
            "features": {
                "label_pixel_ratios": extract_label_pixel_ratios(pred, mask),
                "bbox": extract_bbox(mask),
                "shape": extract_shape(mask),
                "color_stats": extract_color_stats(pil_img, mask),
                "quality": extract_quality(mask, all_clothing_mask, img_shape),
            },
        }
        row = _build_feature_row(item_dict)
        df = pd.DataFrame([row])
        for col in feature_columns:
            if col not in df.columns:
                df[col] = 0.0
        x = df[feature_columns].apply(pd.to_numeric, errors="coerce").fillna(0.0)
        probs = model.predict_proba(x)[0]
        classes = list(model.classes_)
        pred_class = classes[int(probs.argmax())]
        confidence = float(probs.max())
        return {
            "predictedSeason": pred_class,
            "seasonConfidence": round(confidence, 3),
            "seasonProbabilities": {cls: round(float(p), 3) for cls, p in zip(classes, probs)},
            "predictedMaterial": material,
        }
    except Exception as exc:
        print(f"[season-predictor] inference 실패, 룰 기반 폴백 사용: {exc}", flush=True)
        return fallback
