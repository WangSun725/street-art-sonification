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
from region_proposals import is_wall_crack


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


def build_exclusive_interaction_masks(
    masks: list[np.ndarray],
    points: list[tuple[float, float]],
    scores: list[float],
    fine_masks: list[np.ndarray | None] | None = None,
    *,
    concept_indices: list[int] | None = None,
    background_indices: list[int] | None = None,
) -> tuple[list[np.ndarray], dict]:
    """Resolve overlapping SAM masks into one deterministic ownership map.

    SAM masks are intentionally allowed to overlap: a face can sit inside a
    figure and a painted object can sit inside a wall. That is useful model
    output, but it is ambiguous for pointer and gaze interaction. This pass
    preserves every original mask while assigning each covered pixel to
    exactly one playable region.

    Ownership favours a region's interior core and Qwen anchor point, then
    adds a scale-normalised specificity term so a large wall cannot swallow a
    smaller, well-localised shape. No foreground/background classification is
    required.
    """
    if not masks:
        return [], {
            "method": "exclusive-core-anchor-partition-v1",
            "exclusive": True,
            "covered_pixels": 0,
            "overlap_pixels_resolved": 0,
        }

    shape = masks[0].shape
    if any(mask.shape != shape for mask in masks):
        raise ValueError("All region masks must share the same image dimensions")

    height, width = shape
    total_pixels = max(1, height * width)
    coverage = np.zeros(shape, dtype=np.uint8)
    for mask in masks:
        coverage = np.minimum(255, coverage + mask.astype(np.uint8))

    owner = np.full(shape, -1, dtype=np.int16)
    best_score = np.full(shape, -np.inf, dtype=np.float32)
    yy, xx = np.ogrid[:height, :width]

    for index, (mask, point, confidence) in enumerate(zip(masks, points, scores)):
        binary = mask.astype(np.uint8)
        area = max(1, int(binary.sum()))
        equivalent_radius = max(4.0, float(np.sqrt(area / np.pi)))
        interior = cv2.distanceTransform(binary, cv2.DIST_L2, 5) / equivalent_radius

        px = float(np.clip(point[0], 0, width - 1))
        py = float(np.clip(point[1], 0, height - 1))
        anchor_sigma = max(12.0, equivalent_radius * 0.58)
        anchor = np.exp(
            -((xx - px) ** 2 + (yy - py) ** 2) / (2.0 * anchor_sigma * anchor_sigma)
        ).astype(np.float32)

        # Log specificity stays stable across image sizes. Its weight breaks
        # wall/detail ambiguity without allowing a tiny mask to take pixels
        # outside its own SAM prediction.
        specificity = min(2.4, float(np.log(total_pixels / area + 1.0)))
        candidate = (
            interior.astype(np.float32) * 2.2
            + anchor * 0.82
            + specificity * 0.34
            + float(np.clip(confidence, 0.0, 1.0)) * 0.18
        )
        update = mask & (candidate > best_score)
        owner[update] = index
        best_score[update] = candidate[update]

    if concept_indices and background_indices:
        # A grounded object should retain all of its disconnected pieces
        # against a broad fill. Keep normal ownership between specific objects.
        background_owned = np.isin(owner, background_indices)
        for index in sorted(concept_indices, key=lambda i: int(masks[i].sum())):
            update = background_owned & masks[index]
            owner[update] = index
            background_owned[update] = False

    if fine_masks is not None:
        # Validated thin marks lie on top of painted material. Assign those
        # pixels to the mark without taking any of the surrounding wall.
        for index, fine_mask in enumerate(fine_masks):
            if fine_mask is not None:
                owner[fine_mask & masks[index]] = index
    exclusive = [(owner == index) for index in range(len(masks))]
    return exclusive, {
        "method": "exclusive-core-anchor-partition-v1",
        "exclusive": True,
        "covered_pixels": int((coverage > 0).sum()),
        "overlap_pixels_resolved": int((coverage > 1).sum()),
        "unassigned_pixels": int((coverage == 0).sum()),
    }


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


def remap_location(location: dict, crop: list[int], source_width: int, source_height: int) -> dict | None:
    crop_width, crop_height = crop[2] - crop[0], crop[3] - crop[1]
    x1, y1, x2, y2 = normalized_rect(location["bbox"], source_width, source_height)
    clipped = [max(x1, crop[0]), max(y1, crop[1]), min(x2, crop[2]), min(y2, crop[3])]
    if rect_area(clipped) < 16:
        return None
    source_point = location.get("point", [500, 500])
    px = round(source_point[0] / 1000 * source_width)
    py = round(source_point[1] / 1000 * source_height)
    if not (clipped[0] <= px < clipped[2] and clipped[1] <= py < clipped[3]):
        px, py = (clipped[0] + clipped[2]) // 2, (clipped[1] + clipped[3]) // 2
    return {
        "bbox": [
            round((clipped[0] - crop[0]) / crop_width * 1000),
            round((clipped[1] - crop[1]) / crop_height * 1000),
            round((clipped[2] - crop[0]) / crop_width * 1000),
            round((clipped[3] - crop[1]) / crop_height * 1000),
        ],
        "point": [
            round((px - crop[0]) / crop_width * 1000),
            round((py - crop[1]) / crop_height * 1000),
        ],
    }


def remap_proposal(proposal: dict, crop: list[int], source_width: int, source_height: int) -> dict | None:
    locations = [
        mapped for location in [proposal, *proposal.get("parts", [])]
        if (mapped := remap_location(location, crop, source_width, source_height)) is not None
    ]
    if not locations:
        return None
    mapped = {**proposal, **locations[0]}
    if "parts" in proposal:
        mapped["parts"] = locations[1:]
    return mapped


def detect_crack_lines(image: np.ndarray, bounds: list[int], blocked: np.ndarray) -> np.ndarray:
    """Find thin dark ridges inside an already identified wall surface."""
    x1, y1, x2, y2 = bounds
    gray = cv2.cvtColor(image[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
    output = np.zeros(image.shape[:2], dtype=bool)
    if min(gray.shape) < 32:
        return output
    scale = max(.4, max(image.shape[:2]) / 1800)
    gray = cv2.GaussianBlur(gray, (3, 3), .7)
    responses = []
    for size in (9, 21):
        diameter = max(3, round(size * scale) | 1)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (diameter, diameter))
        responses.append(cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel))
    response = cv2.max(*responses)
    threshold = max(14, float(np.percentile(response, 94)))
    # A dark line has brighter pixels on both sides. A single colour step
    # (a painted edge or the outside of the building) usually has only one.
    luminance = gray.astype(np.int16)
    ridge = np.zeros_like(gray, dtype=bool)
    for distance in (max(2, round(3 * scale)), max(3, round(7 * scale))):
        for dy, dx in ((0, distance), (distance, 0), (distance, distance), (distance, -distance)):
            first = np.roll(luminance, (dy, dx), axis=(0, 1))
            second = np.roll(luminance, (-dy, -dx), axis=(0, 1))
            contrast = np.minimum(first, second) - luminance
            ridge |= (contrast >= 10) & (np.abs(first - second) <= 12 + contrast)
    candidate = ((response >= threshold) & ridge).astype(np.uint8)
    candidate = cv2.morphologyEx(candidate, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3)))
    border = max(3, round(13 * scale))
    candidate[:border] = candidate[-border:] = 0
    candidate[:, :border] = candidate[:, -border:] = 0
    candidate[blocked[y1:y2, x1:x2]] = 0
    count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, connectivity=8)
    keep = np.zeros(count, dtype=bool)
    for index, (_, _, width, height, area) in enumerate(stats[1:], 1):
        length = max(width, height)
        straight_edge = length >= 38 * scale and min(width, height) < max(5 * scale, .09 * length)
        keep[index] = (
            length >= max(12, round(22 * scale))
            and area / length <= max(5, 9 * scale)
            and not straight_edge
        )
    lines = keep[labels].astype(np.uint8)
    # Keep the thin marks reachable by pointer and gaze at display size.
    radius = max(1, round(2 * scale))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * radius + 1, 2 * radius + 1))
    output[y1:y2, x1:x2] = (cv2.dilate(lines, kernel) > 0) & ~blocked[y1:y2, x1:x2]
    return output


def segment_location(predictor, location: dict, kind: str, width: int, height: int, *, restrict: bool) -> tuple[np.ndarray, float]:
    x1, y1, x2, y2 = location["bbox"]
    px, py = location["point"]
    box = np.asarray([
        x1 / 1000 * (width - 1), y1 / 1000 * (height - 1),
        x2 / 1000 * (width - 1), y2 / 1000 * (height - 1),
    ], dtype=np.float32)
    masks, scores, _ = predictor.predict(
        point_coords=np.asarray([[px / 1000 * (width - 1), py / 1000 * (height - 1)]], dtype=np.float32),
        point_labels=np.asarray([1], dtype=np.int32),
        box=box,
        multimask_output=True,
    )
    mask, score = select_mask(masks, scores, kind)
    if restrict:
        left, top, right, bottom = normalized_rect(location["bbox"], width, height)
        mask[:top] = mask[bottom:] = False
        mask[:, :left] = mask[:, right:] = False
    return mask, score


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--proposals", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--sam3", type=Path, help="Optional semantic masks in prepared image coordinates")
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
    sam3_records = {}
    if args.sam3:
        for record in json.loads((args.sam3 / "regions.json").read_text()):
            sam3_records[record["index"]] = record
            if "proposal" in record and record["index"] == len(proposals):
                proposals.append(record["proposal"])
    proposals = [
        (source_index, mapped) for source_index, proposal in enumerate(proposals)
        if (mapped := remap_proposal(proposal, crop, prepared_width, prepared_height)) is not None
    ]
    predictor.set_image(image_rgb)

    region_records: list[dict] = []
    used: set[str] = set()
    with torch.inference_mode():
        for index, (source_index, proposal) in enumerate(proposals, start=1):
            px, py = proposal["point"]
            region_id = unique_id(proposal.get("id", ""), used, index)
            label = proposal.get("label", region_id)
            kind = "texture" if is_wall_crack(label) else proposal.get("type", "detail")
            parts = proposal.get("parts", [])
            semantic = sam3_records.get(source_index)
            source = cv2.imread(str(args.sam3 / semantic["mask"]), cv2.IMREAD_GRAYSCALE) if semantic else None
            mask = (source[crop[1]:crop[3], crop[0]:crop[2]] > 0
                    if source is not None and source.shape == (prepared_height, prepared_width) else None)
            used_sam3 = mask is not None and mask.any()
            if used_sam3:
                scores = list(semantic["scores"])
            else:
                mask, score = segment_location(predictor, proposal, kind, width, height, restrict=bool(parts))
                scores = [score]
            for part in parts:
                x1, y1, x2, y2 = normalized_rect(part["bbox"], width, height)
                if used_sam3 and mask[y1:y2, x1:x2].sum() >= .06 * max(1, (x2 - x1) * (y2 - y1)):
                    continue
                part_mask, part_score = segment_location(predictor, part, kind, width, height, restrict=True)
                if part_mask.any():
                    mask |= part_mask
                    scores.append(part_score)
            region_records.append({
                "id": region_id,
                "label": label,
                "type": kind,
                "index": index,
                "color_rgb": proposal.get("color_rgb", [84, 134, 247]),
                "mask": mask,
                "scores": scores,
                "fine_mask": None,
                "sam3_matches": len(semantic["scores"]) if used_sam3 else 0,
                "box_px": normalized_rect(proposal["bbox"], width, height),
                "point_px": (
                    px / 1000 * (width - 1),
                    py / 1000 * (height - 1),
                ),
                "meaning": proposal.get("meaning", ""),
            })

    model_box = isolation.get("model_box")
    if isolation["applied"]:
        wall_bounds = [0, 0, width, height]
    elif model_box and isolation.get("model_confidence", 0) >= .82 and rect_area(model_box) < .88 * rect_area(content_rect):
        wall_bounds = clamp_rect(
            [model_box[0] - crop[0], model_box[1] - crop[1], model_box[2] - crop[0], model_box[3] - crop[1]],
            [0, 0, width, height],
        )
    else:
        wall_bounds = None
    crack_records = [record for record in region_records if is_wall_crack(record["label"])]
    if wall_bounds and len(crack_records) == 1:
        # Use window masks to avoid interpreting window frames and reflections
        # as wall cracks. Leave painted figures eligible: a real crack can
        # run through the paint.
        blocked = np.zeros((height, width), dtype=bool)
        for record in region_records:
            area = record["mask"].mean()
            object_type = record["type"] in {"figure", "gesture", "symbol", "detail"}
            if re.search(r"\bwindows?\b", record["label"], re.I) or (object_type and .002 < area < .025):
                blocked |= cv2.dilate(record["mask"].astype(np.uint8), np.ones((17, 17), np.uint8)) > 0
                box = record["box_px"]
                if rect_area(box) < .09 * width * height:
                    x1, y1, x2, y2 = clamp_rect(
                        [box[0] - 12, box[1] - 12, box[2] + 12, box[3] + 12],
                        [0, 0, width, height],
                    )
                    blocked[y1:y2, x1:x2] = True
            elif object_type and .025 <= area < .3:
                # Painted objects can contain wall cracks, but their
                # silhouettes are a frequent false ridge.
                kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
                contour = cv2.morphologyEx(record["mask"].astype(np.uint8), cv2.MORPH_GRADIENT, kernel)
                blocked |= contour > 0
        lines = detect_crack_lines(image_bgr, wall_bounds, blocked)
        if 0 < lines.sum() <= .06 * rect_area(wall_bounds):
            support_file = args.sam3 / "crack-support.png" if args.sam3 else None
            if support_file and support_file.is_file():
                support = cv2.imread(str(support_file), cv2.IMREAD_GRAYSCALE)
                if support is not None and support.shape == (prepared_height, prepared_width):
                    support = support[crop[1]:crop[3], crop[0]:crop[2]] > 0
                    near = cv2.dilate(lines.astype(np.uint8), np.ones((13, 13), np.uint8)) > 0
                    confirmed = support & near & ~blocked & ~lines
                    if confirmed.any():
                        lines |= confirmed
                        crack_records[0]["sam3_support_pixels"] = int(confirmed.sum())
            crack_records[0]["fine_mask"] = lines

    playable_masks = [
        record["fine_mask"] if record["fine_mask"] is not None else record["mask"]
        for record in region_records
    ]
    exclusive_masks, interaction_partition = build_exclusive_interaction_masks(
        playable_masks,
        [record["point_px"] for record in region_records],
        [record["scores"][0] for record in region_records],
        [record["fine_mask"] for record in region_records],
        concept_indices=[
            index for index, record in enumerate(region_records)
            if record["sam3_matches"] and record["mask"].mean() < .25
        ],
        background_indices=[
            index for index, record in enumerate(region_records)
            if record["type"] in {"wall", "fill"} or record["mask"].mean() >= .35
            or re.search(r"\bbackground\b", record["label"], re.I)
        ],
    )
    output_regions: list[dict] = []
    for record, interaction_mask in zip(region_records, exclusive_masks):
        index = record["index"]
        region_id = record["id"]
        source_name = f"{index:02d}_{region_id}_sam.png"
        mask_name = f"{index:02d}_{region_id}_mask.png"
        hit_name = f"{index:02d}_{region_id}_hit.png"
        source_visual = record["mask"].astype(np.uint8) * 255
        interaction_visual = interaction_mask.astype(np.uint8) * 255
        cv2.imwrite(str(args.output / source_name), source_visual)
        cv2.imwrite(str(args.output / mask_name), interaction_visual)
        # Pointer, gaze, contour display, and scan analysis all use the same
        # exclusive territory. This keeps visible and audible boundaries in
        # agreement and avoids reintroducing overlap through dilation.
        cv2.imwrite(str(args.output / hit_name), interaction_visual)
        method = "Qwen3-VL proposal + SAM 2.1 Tiny"
        if record["fine_mask"] is not None:
            method = "Qwen3-VL wall scope + thin-line refinement"
        elif record["sam3_matches"]:
            method = "SAM 3 concept segmentation"
        output_regions.append({
            "id": region_id,
            "label": record["label"],
            "type": record["type"],
            "index": index,
            "color_rgb": record["color_rgb"],
            "source_mask": source_name,
            "visual_mask": mask_name,
            "hit_mask": hit_name,
            "sam_scores": [round(score, 4) for score in record["scores"]],
            "source_area_ratio": round(float(record["mask"].mean()), 5),
            "area_ratio": round(float(interaction_mask.mean()), 5),
            "meaning": record["meaning"],
            "method": method + " + exclusive interaction partition",
            **({"sam3_matches": record["sam3_matches"]} if record["sam3_matches"] else {}),
            **({"sam3_support_pixels": record["sam3_support_pixels"]} if "sam3_support_pixels" in record else {}),
            **({"fine_detail": True} if record["fine_mask"] is not None else {}),
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
        "mask_model": (
            "SAM 3 (MLX 6-bit) + SAM 2.1 Hiera Tiny"
            if any(r["sam3_matches"] or r.get("sam3_support_pixels") for r in region_records)
            else "SAM 2.1 Hiera Tiny"
        ),
        "interaction_partition": interaction_partition,
        "device": device,
        "regions": output_regions,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
