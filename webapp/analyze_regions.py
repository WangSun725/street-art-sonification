#!/usr/bin/env python3
"""Refine semantic region proposals into browser-ready masks with SAM 2.1."""

from __future__ import annotations

import argparse
import copy
import json
import re
from pathlib import Path

import cv2
import numpy as np
import torch
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor


ROOT = Path(__file__).resolve().parents[1]
CHECKPOINT = ROOT / "third_party" / "sam2" / "checkpoints" / "sam2.1_hiera_tiny.pt"
CONFIG = "configs/sam2.1/sam2.1_hiera_t.yaml"


def clean_mask(mask: np.ndarray) -> np.ndarray:
    binary = mask.astype(np.uint8) * 255
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, 8)
    if count <= 1:
        return binary > 0
    keep = np.zeros_like(binary)
    threshold = max(35, int(binary.size * 0.00006))
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] >= threshold:
            keep[labels == index] = 255
    return keep > 0


def area_limits(kind: str) -> tuple[float, float]:
    return {
        "wall": (0.02, 0.92),
        "figure": (0.015, 0.80),
        "fill": (0.008, 0.72),
        "lettering": (0.001, 0.55),
        "texture": (0.002, 0.65),
        "face": (0.002, 0.32),
        "gesture": (0.001, 0.30),
        "symbol": (0.0004, 0.28),
        "detail": (0.0003, 0.24),
    }.get(kind, (0.0003, 0.80))


def select_mask(masks: np.ndarray, scores: np.ndarray, kind: str) -> tuple[np.ndarray, float]:
    areas = masks.reshape(masks.shape[0], -1).mean(axis=1)
    low, high = area_limits(kind)
    valid = np.where((areas >= low) & (areas <= high))[0]
    pool = valid if len(valid) else np.arange(len(scores))
    # Prefer the model score, with a small penalty for nearly full-canvas masks.
    ranks = scores[pool] - np.maximum(areas[pool] - high, 0) * 1.5
    index = int(pool[np.argmax(ranks)])
    return clean_mask(masks[index]), float(scores[index])


def unique_id(value: str, used: set[str], index: int) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_") or f"region_{index}"
    candidate, suffix = base, 2
    while candidate in used:
        candidate = f"{base}_{suffix}"
        suffix += 1
    used.add(candidate)
    return candidate


def clamp_rect(rect: list[int], bounds: list[int]) -> list[int]:
    x1 = max(bounds[0], min(bounds[2] - 1, rect[0]))
    y1 = max(bounds[1], min(bounds[3] - 1, rect[1]))
    x2 = max(x1 + 1, min(bounds[2], rect[2]))
    y2 = max(y1 + 1, min(bounds[3], rect[3]))
    return [x1, y1, x2, y2]


def normalized_rect(box: list[int], width: int, height: int) -> list[int]:
    return [
        round(box[0] / 1000 * width), round(box[1] / 1000 * height),
        round(box[2] / 1000 * width), round(box[3] / 1000 * height),
    ]


def mask_bounds(mask: np.ndarray) -> list[int] | None:
    ys, xs = np.where(mask)
    if not len(xs):
        return None
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]


def rect_area(rect: list[int]) -> int:
    return max(0, rect[2] - rect[0]) * max(0, rect[3] - rect[1])


def intersection_over_union(a: list[int], b: list[int]) -> float:
    intersection = rect_area([
        max(a[0], b[0]), max(a[1], b[1]),
        min(a[2], b[2]), min(a[3], b[3]),
    ])
    union = rect_area(a) + rect_area(b) - intersection
    return intersection / union if union else 0.0


def choose_artwork_crop(
    predictor: SAM2ImagePredictor,
    artwork: dict,
    proposals: list[dict],
    content_rect: list[int],
    width: int,
    height: int,
) -> tuple[list[int], dict]:
    """Choose a conservative crop; uncertain or full-frame work is untouched."""
    content_area = max(1, rect_area(content_rect))
    proposed = clamp_rect(normalized_rect(artwork.get("bbox", [0, 0, 1000, 1000]), width, height), content_rect)
    confidence = float(artwork.get("confidence", 0.0))
    area_ratio = rect_area(proposed) / content_area
    margins = [
        proposed[0] - content_rect[0], proposed[1] - content_rect[1],
        content_rect[2] - proposed[2], content_rect[3] - proposed[3],
    ]
    meaningful_margins = sum((
        margins[0] >= (content_rect[2] - content_rect[0]) * 0.035,
        margins[2] >= (content_rect[2] - content_rect[0]) * 0.035,
        margins[1] >= (content_rect[3] - content_rect[1]) * 0.035,
        margins[3] >= (content_rect[3] - content_rect[1]) * 0.035,
    ))
    model_full_frame = bool(artwork.get("full_frame", True))
    # Vision models occasionally return a useful, high-confidence artwork box
    # while also setting ``full_frame`` to true.  When the box itself leaves a
    # substantial amount of scenery outside it on at least three sides, the
    # geometry is stronger evidence than that contradictory flag.  The strict
    # confidence and margin requirements keep genuine full-frame murals safe.
    full_frame_overridden = (
        model_full_frame
        and confidence >= 0.90
        and 0.06 <= area_ratio <= 0.78
        and meaningful_margins >= 3
    )
    should_crop = (
        (not model_full_frame or full_frame_overridden)
        and confidence >= 0.82
        and 0.06 <= area_ratio <= 0.82
        and meaningful_margins >= 2
    )
    # A crop is not trusted when Qwen's own playable regions disagree with its
    # outer artwork boundary. Keeping extra scenery is safer than deleting part
    # of a full-frame mural.
    if should_crop:
        for proposal in proposals:
            if proposal.get("type") in {"wall", "texture", "fill"}:
                continue
            region_rect = clamp_rect(normalized_rect(proposal["bbox"], width, height), content_rect)
            overlap = rect_area([
                max(region_rect[0], proposed[0]), max(region_rect[1], proposed[1]),
                min(region_rect[2], proposed[2]), min(region_rect[3], proposed[3]),
            ])
            if overlap / max(1, rect_area(region_rect)) < 0.55:
                should_crop = False
                break
    if not should_crop:
        return content_rect, {
            "applied": False,
            "reason": "full_frame_uncertain_or_region_disagreement",
            "model_full_frame": model_full_frame,
            "full_frame_overridden": full_frame_overridden,
            "model_confidence": round(confidence, 4),
            "model_box": proposed,
        }

    point = artwork.get("point", [500, 500])
    px = max(proposed[0], min(proposed[2] - 1, round(point[0] / 1000 * width)))
    py = max(proposed[1], min(proposed[3] - 1, round(point[1] / 1000 * height)))
    box = np.asarray(proposed, dtype=np.float32)
    masks, scores, _ = predictor.predict(
        point_coords=np.asarray([[px, py]], dtype=np.float32),
        point_labels=np.asarray([1], dtype=np.int32),
        box=box,
        multimask_output=True,
    )
    best_bounds: list[int] | None = None
    best_rank = -1.0
    for mask, score in zip(masks, scores):
        candidate = mask_bounds(clean_mask(mask))
        if candidate is None:
            continue
        candidate = clamp_rect(candidate, content_rect)
        size_ratio = rect_area(candidate) / max(1, rect_area(proposed))
        if not 0.25 <= size_ratio <= 2.8:
            continue
        rank = float(score) + intersection_over_union(candidate, proposed) * 0.35
        if rank > best_rank:
            best_rank = rank
            best_bounds = candidate

    # The detector box remains part of the crop even when SAM contracts to one
    # connected painted component. This protects disconnected lettering and
    # wall texture from accidental removal.
    combined = proposed if best_bounds is None else [
        min(proposed[0], best_bounds[0]), min(proposed[1], best_bounds[1]),
        max(proposed[2], best_bounds[2]), max(proposed[3], best_bounds[3]),
    ]
    margin_x = round((content_rect[2] - content_rect[0]) * 0.025)
    margin_y = round((content_rect[3] - content_rect[1]) * 0.025)
    crop = clamp_rect([
        combined[0] - margin_x, combined[1] - margin_y,
        combined[2] + margin_x, combined[3] + margin_y,
    ], content_rect)
    if rect_area(crop) / content_area > 0.92:
        return content_rect, {
            "applied": False,
            "reason": "crop_too_close_to_full_frame",
            "model_full_frame": model_full_frame,
            "full_frame_overridden": full_frame_overridden,
            "model_confidence": round(confidence, 4),
            "model_box": proposed,
        }
    return crop, {
        "applied": True,
        "reason": "high_confidence_box_overrode_full_frame" if full_frame_overridden else "clear_external_background",
        "model_full_frame": model_full_frame,
        "full_frame_overridden": full_frame_overridden,
        "model_confidence": round(confidence, 4),
        "model_box": proposed,
        "sam_box": best_bounds,
    }


def remap_proposal(proposal: dict, crop: list[int], source_width: int, source_height: int) -> dict | None:
    crop_width, crop_height = crop[2] - crop[0], crop[3] - crop[1]
    source_box = normalized_rect(proposal["bbox"], source_width, source_height)
    clipped = clamp_rect(source_box, crop)
    if rect_area(clipped) < 16:
        return None
    source_point = proposal.get("point", [500, 500])
    px = round(source_point[0] / 1000 * source_width)
    py = round(source_point[1] / 1000 * source_height)
    if not (clipped[0] <= px < clipped[2] and clipped[1] <= py < clipped[3]):
        px, py = (clipped[0] + clipped[2]) // 2, (clipped[1] + clipped[3]) // 2
    mapped = copy.deepcopy(proposal)
    mapped["bbox"] = [
        round((clipped[0] - crop[0]) / crop_width * 1000),
        round((clipped[1] - crop[1]) / crop_height * 1000),
        round((clipped[2] - crop[0]) / crop_width * 1000),
        round((clipped[3] - crop[1]) / crop_height * 1000),
    ]
    mapped["point"] = [
        round((px - crop[0]) / crop_width * 1000),
        round((py - crop[1]) / crop_height * 1000),
    ]
    return mapped


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--proposals", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    image_bgr = cv2.imread(str(args.image), cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise SystemExit("Could not read uploaded image")
    height, width = image_bgr.shape[:2]
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    proposal_payload = json.loads(args.proposals.read_text(encoding="utf-8"))
    preprocessing = proposal_payload.get("preprocessing", {})
    proposals = proposal_payload["regions"]
    content_rect = clamp_rect(preprocessing.get("content_box", [0, 0, width, height]), [0, 0, width, height])

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = build_sam2(CONFIG, str(CHECKPOINT), device=device)
    predictor = SAM2ImagePredictor(model)
    predictor.set_image(image_rgb)

    with torch.inference_mode():
        crop, isolation = choose_artwork_crop(
            predictor,
            proposal_payload.get("artwork", {}),
            proposals,
            content_rect,
            width,
            height,
        )
    prepared_width, prepared_height = width, height
    image_bgr = image_bgr[crop[1]:crop[3], crop[0]:crop[2]].copy()
    height, width = image_bgr.shape[:2]
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    cv2.imwrite(str(args.output / "artwork.png"), image_bgr, [cv2.IMWRITE_PNG_COMPRESSION, 5])
    proposals = [
        mapped for proposal in proposals
        if (mapped := remap_proposal(proposal, crop, prepared_width, prepared_height)) is not None
    ]
    predictor.set_image(image_rgb)

    output_regions: list[dict] = []
    used: set[str] = set()
    with torch.inference_mode():
        for index, proposal in enumerate(proposals, start=1):
            x1, y1, x2, y2 = proposal["bbox"]
            px, py = proposal["point"]
            box = np.asarray([
                x1 / 1000 * (width - 1), y1 / 1000 * (height - 1),
                x2 / 1000 * (width - 1), y2 / 1000 * (height - 1),
            ], dtype=np.float32)
            point = np.asarray([[px / 1000 * (width - 1), py / 1000 * (height - 1)]], dtype=np.float32)
            masks, scores, _ = predictor.predict(
                point_coords=point,
                point_labels=np.asarray([1], dtype=np.int32),
                box=box,
                multimask_output=True,
            )
            mask, score = select_mask(masks, scores, proposal.get("type", "detail"))
            region_id = unique_id(proposal.get("id", ""), used, index)
            mask_name = f"{index:02d}_{region_id}_mask.png"
            hit_name = f"{index:02d}_{region_id}_hit.png"
            visual = mask.astype(np.uint8) * 255
            kind = proposal.get("type", "detail")
            radius = 11 if kind in {"detail", "symbol", "lettering"} else 6
            hit = cv2.dilate(visual, np.ones((radius * 2 + 1, radius * 2 + 1), np.uint8))
            cv2.imwrite(str(args.output / mask_name), visual)
            cv2.imwrite(str(args.output / hit_name), hit)
            output_regions.append({
                "id": region_id,
                "label": proposal.get("label", region_id),
                "type": kind,
                "index": index,
                "color_rgb": proposal.get("color_rgb", [84, 134, 247]),
                "visual_mask": mask_name,
                "hit_mask": hit_name,
                "sam_scores": [round(score, 4)],
                "area_ratio": round(float(mask.mean()), 5),
                "meaning": proposal.get("meaning", ""),
                "method": "Qwen3-VL proposal + SAM 2.1 Tiny mask",
            })

    preprocessing["crop"] = {
        **isolation,
        "prepared_rect": crop,
        "removed_analysis_padding": preprocessing.get("padding", {}).get("applied", False),
    }
    preprocessing["output_size"] = {"width": width, "height": height}
    preprocessing["coordinate_transform"] = {
        "oriented_source_to_prepared_scale": preprocessing.get("resize", {}).get("scale", 1.0),
        "prepared_padding": preprocessing.get("padding", {}),
        "prepared_to_output_crop_origin": {"x": crop[0], "y": crop[1]},
    }
    (args.output / "regions.json").write_text(json.dumps({
        "image_size": {"width": width, "height": height},
        "processed_image": "artwork.png",
        "preprocessing": preprocessing,
        "artwork_isolation": isolation,
        "proposal_source": "Qwen3-VL 2B Instruct 4-bit",
        "mask_model": "SAM 2.1 Hiera Tiny",
        "device": device,
        "regions": output_regions,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
