"""
background_remove_api.py

수동 의류 등록 도메인에서 사용하는 이미지 처리 FastAPI 서버입니다.
프론트엔드의 수동 업로드 화면은 사용자가 올린 옷 사진을 이 서버로 보내고,
서버는 배경 제거/정밀 의류 추출/대표색 분석 결과를 JSON으로 반환합니다.

주요 역할:
1. /api/background/remove: rembg u2netp 기반 일반 배경 제거.
2. /api/clothing/extract: SegFormer fashion segmentation 기반 카테고리별 정밀 의류 추출.
3. alpha bbox 계산: 투명 배경이 아닌 실제 의류 영역을 찾아 썸네일/레이어 배치에 활용.
4. dominant color 추출: 누끼 결과의 대표 HEX/RGB/ratio를 계산해 ClothingItem.representativeHex 기본값으로 사용.
5. 모델 캐싱: rembg 세션과 SegFormer 모델을 전역 변수로 lazy load해 요청마다 모델을 다시 로딩하지 않음.

현재는 로컬 MVP 서버지만, 장기적으로는 업로드 API, 이미지 처리 worker, object storage와 연결되는 서버 계층으로 확장할 수 있습니다.
"""
from __future__ import annotations

import base64
from collections import Counter
from datetime import datetime, timezone
from io import BytesIO
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from season_predictor import predict as predict_season


MODEL_NAME = "u2netp"
MAX_IMAGE_SIDE = 1600
CUTOUT_VERSION = "hard-alpha-v3"
PRECISION_CUTOUT_VERSION = "fashion-segformer-v1"
ALPHA_KEEP_THRESHOLD = 56
ALPHA_EDGE_THRESHOLD = 24
FASHION_MODEL_NAME = "sayeed99/segformer-b3-fashion"

app = FastAPI(title="Fitly Background Remove API")
session = None
remove_fn = None
fashion_processor = None
fashion_model = None
fashion_device = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def resize_for_model(image: Image.Image) -> Image.Image:
    """모바일 업로드 이미지가 너무 클 때 서버 추론 비용을 줄이기 위해 축소합니다."""
    width, height = image.size
    scale = min(1.0, MAX_IMAGE_SIDE / max(width, height))
    if scale >= 1:
        return image
    next_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return image.resize(next_size, Image.Resampling.LANCZOS)


def alpha_bbox(image: Image.Image) -> dict[str, int] | None:
    """투명도 채널을 기준으로 실제 의류가 남아 있는 영역을 계산합니다."""
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return None
    left, top, right, bottom = bbox
    return {
        "x": left,
        "y": top,
        "width": right - left,
        "height": bottom - top,
    }


def harden_alpha(image: Image.Image) -> Image.Image:
    """모델이 남긴 반투명 그림자와 블러 배경을 제거해 옷 외 영역을 완전 투명하게 만듭니다."""
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    # 192처럼 높은 임계값을 쓰면 밝은 옷의 가장자리와 얇은 원단까지 사라져 누끼 품질이 급격히 나빠집니다.
    # 낮은 alpha 잔여물만 제거하고, 살아남은 옷 영역은 완전 불투명하게 만들어 블러 배경을 줄입니다.
    hard_alpha = alpha.point(lambda value: 255 if value >= ALPHA_KEEP_THRESHOLD else 0)
    edge_alpha = alpha.point(lambda value: 255 if value >= ALPHA_EDGE_THRESHOLD else 0)
    bbox = edge_alpha.getbbox()
    if bbox:
        # 가장자리 1px 정도는 유지해 옷 테두리가 너무 많이 깎이지 않도록 합니다.
        grown = Image.new("L", rgba.size, 0)
        left, top, right, bottom = bbox
        grown.paste(255, (max(0, left - 1), max(0, top - 1), min(rgba.width, right + 1), min(rgba.height, bottom + 1)))
        hard_alpha = Image.composite(hard_alpha, Image.new("L", rgba.size, 0), grown)
    rgba.putalpha(hard_alpha)
    return rgba


def mask_bbox(mask: Any) -> dict[str, int] | None:
    """SegFormer boolean mask에서 실제 의류가 차지하는 bbox를 계산합니다."""
    import numpy as np

    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    return {
        "x": int(xs.min()),
        "y": int(ys.min()),
        "width": int(xs.max() - xs.min() + 1),
        "height": int(ys.max() - ys.min() + 1),
    }


def rgba_from_boolean_mask(image: Image.Image, mask: Any) -> Image.Image:
    """원본 이미지는 유지하고 mask 밖의 alpha만 0으로 만들어 정밀 누끼 PNG를 생성합니다."""
    import numpy as np

    rgba = np.array(image.convert("RGBA"))
    rgba[..., 3] = mask.astype(np.uint8) * 255
    return Image.fromarray(rgba, mode="RGBA")


def clean_boolean_mask(mask: Any) -> Any:
    """의류 파싱 마스크의 작은 점과 구멍을 정리합니다."""
    import cv2
    import numpy as np
    from scipy import ndimage as ndi

    if mask.sum() == 0:
        return mask
    kernel = np.ones((5, 5), np.uint8)
    cleaned = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel) > 0
    cleaned = ndi.binary_fill_holes(cleaned)

    num, labels, stats, _ = cv2.connectedComponentsWithStats(cleaned.astype(np.uint8), 8)
    if num <= 1:
        return cleaned
    # 레이어드 옷을 고려해 큰 연결 성분 3개까지 유지합니다.
    top = np.argsort(stats[1:, cv2.CC_STAT_AREA])[::-1][:3] + 1
    return np.isin(labels, top)


def target_ids(target_part: str) -> set[int]:
    """프론트엔드가 요청한 의류 부위를 SegFormer label id 집합으로 변환합니다."""
    label_groups = {
        "upper": {1, 2, 3, 6, 28, 29, 32, 34},
        "lower": {7, 8, 9},
        "outer": {4, 5, 10, 13, 28, 29, 32, 34},
        "shoes": {24},
        "bag": {25},
        "accessory": {14, 15, 16, 17, 18, 19, 20, 23, 25, 26},
        "upper_lower": {1, 2, 3, 6, 7, 8, 9, 11, 12, 28, 29, 32, 34},
    }
    if target_part not in label_groups:
        raise HTTPException(status_code=400, detail="지원하지 않는 정밀 누끼 대상입니다.")
    return label_groups[target_part]


def get_fashion_model():
    """정밀 누끼 모델은 무거우므로 첫 정밀 요청 때만 로드합니다."""
    global fashion_processor, fashion_model, fashion_device
    if fashion_processor is not None and fashion_model is not None and fashion_device is not None:
        return fashion_processor, fashion_model, fashion_device

    print("[precision-cutout] importing torch/transformers", flush=True)
    import torch
    from transformers import AutoModelForSemanticSegmentation, SegformerImageProcessor

    fashion_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dtype = torch.float16 if fashion_device.type == "cuda" else torch.float32
    print(f"[precision-cutout] loading {FASHION_MODEL_NAME} on {fashion_device}", flush=True)
    fashion_processor = SegformerImageProcessor.from_pretrained(FASHION_MODEL_NAME)
    fashion_model = AutoModelForSemanticSegmentation.from_pretrained(FASHION_MODEL_NAME, torch_dtype=dtype)
    fashion_model.to(fashion_device).eval()
    print("[precision-cutout] model ready", flush=True)
    return fashion_processor, fashion_model, fashion_device


def run_fashion_segmentation(image: Image.Image, max_side: int = 640) -> Any:
    """Fashion SegFormer로 픽셀별 의류 카테고리를 예측합니다."""
    import numpy as np
    import torch

    processor, model, device = get_fashion_model()
    original_width, original_height = image.size
    scale = min(1.0, max_side / max(original_width, original_height))
    working = image.convert("RGB")
    if scale < 1:
        working = working.resize((max(1, round(original_width * scale)), max(1, round(original_height * scale))), Image.Resampling.BILINEAR)

    inputs = processor(images=working, return_tensors="pt")
    inputs = {key: value.to(device) for key, value in inputs.items()}
    with torch.no_grad():
        outputs = model(**inputs)
    logits = torch.nn.functional.interpolate(outputs.logits, size=working.size[::-1], mode="bilinear", align_corners=False)
    pred = logits.argmax(dim=1)[0].detach().cpu().numpy().astype(np.uint8)
    if pred.shape != (original_height, original_width):
        pred = np.array(Image.fromarray(pred).resize((original_width, original_height), Image.Resampling.NEAREST))

    del inputs, outputs, logits
    if device.type == "cuda":
        torch.cuda.empty_cache()
    return pred


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    """RGB tuple을 프론트엔드가 저장하는 HEX 문자열로 변환합니다."""
    return f"#{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}"


def extract_dominant_colors(image: Image.Image, max_colors: int = 5) -> list[dict[str, Any]]:
    """누끼 결과의 불투명 픽셀만 사용해 앱에서 바로 쓸 대표 색상 팔레트를 만듭니다."""
    rgba = image.convert("RGBA")
    small = rgba.resize((max(1, rgba.width // 4), max(1, rgba.height // 4)), Image.Resampling.BILINEAR)
    counter: Counter[tuple[int, int, int]] = Counter()
    total = 0

    for r, g, b, a in small.getdata():
        # 반투명 가장자리와 너무 밝은 배경 잔여 픽셀은 대표 색상 계산에서 제외합니다.
        if a < 96:
            continue
        if max(r, g, b) > 245 and min(r, g, b) > 235:
            continue
        bucket = (round(r / 24) * 24, round(g / 24) * 24, round(b / 24) * 24)
        bucket = tuple(max(0, min(255, value)) for value in bucket)
        counter[bucket] += 1
        total += 1

    if total == 0:
        return []

    return [
        {
            "hex": rgb_to_hex(rgb),
            "rgb": list(rgb),
            "ratio": round(count / total, 4),
        }
        for rgb, count in counter.most_common(max_colors)
    ]


def png_data_url(image: Image.Image) -> str:
    """PNG 이미지를 브라우저에서 바로 표시 가능한 data URL로 인코딩합니다."""
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def get_session():
    """서버 시작은 빠르게 하고, 첫 누끼 요청 때만 모델을 로드합니다."""
    global remove_fn, session
    if remove_fn is None:
        print("[background-remove] importing rembg", flush=True)
        from rembg import new_session, remove

        remove_fn = remove
    else:
        from rembg import new_session

    if session is None:
        print(f"[background-remove] loading rembg model: {MODEL_NAME}", flush=True)
        session = new_session(MODEL_NAME)
        print("[background-remove] model ready", flush=True)
    return session


@app.get("/api/health")
def health() -> dict[str, str]:
    """프론트엔드 또는 개발자가 서버/모델 상태를 빠르게 확인하는 헬스체크 엔드포인트입니다."""
    return {"status": "ok", "model": MODEL_NAME, "modelLoaded": str(session is not None)}


@app.post("/api/background/remove")
async def remove_background(file: UploadFile = File(...)) -> dict[str, Any]:
    """일반 의류 이미지 배경 제거 엔드포인트입니다."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")

    try:
        raw = await file.read()
        image = Image.open(BytesIO(raw)).convert("RGBA")
        image = resize_for_model(image)
        model_session = get_session()
        if remove_fn is None:
            raise RuntimeError("rembg remove function is not ready")
        result = harden_alpha(remove_fn(image, session=model_session).convert("RGBA"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"배경 제거에 실패했습니다: {exc}") from exc

    return {
        "imageDataUrl": png_data_url(result),
        "width": result.width,
        "height": result.height,
        "bbox": alpha_bbox(result),
        "colors": extract_dominant_colors(result),
        "model": MODEL_NAME,
        "version": CUTOUT_VERSION,
        "processedAt": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/clothing/extract")
async def extract_clothing(file: UploadFile = File(...), targetPart: str = Form("upper")) -> dict[str, Any]:
    """상/하의/아우터 등 특정 부위만 분리하는 정밀 누끼 엔드포인트입니다."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")

    try:
        raw = await file.read()
        image = Image.open(BytesIO(raw)).convert("RGB")
        image = resize_for_model(image)
        pred = run_fashion_segmentation(image)
        ids = target_ids(targetPart)
        import numpy as np

        # 모델의 픽셀별 label map에서 사용자가 요청한 부위 id만 True로 남깁니다.
        mask = np.isin(pred, list(ids))
        # dress/jumpsuit는 상하의 요청에서 같이 살립니다.
        if targetPart in {"upper", "lower", "upper_lower"}:
            mask = mask | np.isin(pred, [11, 12])
        mask = clean_boolean_mask(mask)
        if mask.sum() == 0:
            raise RuntimeError("선택한 부위의 의류 마스크를 찾지 못했습니다.")
        result = rgba_from_boolean_mask(image, mask)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"정밀 누끼에 실패했습니다: {exc}") from exc

    prediction = predict_season(pred, mask, image, targetPart)

    return {
        "imageDataUrl": png_data_url(result),
        "width": result.width,
        "height": result.height,
        "bbox": mask_bbox(mask),
        "colors": extract_dominant_colors(result),
        "model": FASHION_MODEL_NAME,
        "version": PRECISION_CUTOUT_VERSION,
        "targetPart": targetPart,
        "predictedSeason": prediction.get("predictedSeason"),
        "seasonConfidence": prediction.get("seasonConfidence"),
        "seasonProbabilities": prediction.get("seasonProbabilities"),
        "predictedMaterial": prediction.get("predictedMaterial"),
        "processedAt": datetime.now(timezone.utc).isoformat(),
    }
