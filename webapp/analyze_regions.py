#!/usr/bin/env python3
"""Refine semantic region proposals into browser-ready masks with SAM 2.1."""

from __future__ import annotations

import argparse
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
    max_side = 1800
    if max(height, width) > max_side:
        scale = max_side / max(height, width)
        image_bgr = cv2.resize(image_bgr, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA)
        height, width = image_bgr.shape[:2]
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    proposals = json.loads(args.proposals.read_text(encoding="utf-8"))["regions"]

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = build_sam2(CONFIG, str(CHECKPOINT), device=device)
    predictor = SAM2ImagePredictor(model)
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

    (args.output / "regions.json").write_text(json.dumps({
        "image_size": {"width": width, "height": height},
        "proposal_source": "Qwen3-VL 2B Instruct 4-bit",
        "mask_model": "SAM 2.1 Hiera Tiny",
        "device": device,
        "regions": output_regions,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
