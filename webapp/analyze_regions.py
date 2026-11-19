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
from region_proposals import BASE_LAYER_TYPES, FINE_TYPES, GROUND_TYPES, REGION_TAXONOMY, is_incidental_region, is_wall_crack, set_region_type


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
        "figure_part": (0.001, 0.32),
        "depicted_object": (0.0003, 0.80),
        "graphic_line": (0.0001, 0.45),
        "abstract_shape": (0.0004, 0.72),
        "painted_ground": (0.008, 0.92),
        "paint_texture": (0.0004, 0.65),
        "exposed_support": (0.002, 0.85),
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
    *,
    base_layers: set[int] | None = None,
) -> tuple[list[np.ndarray], dict]:
    """Resolve overlapping SAM masks into one deterministic ownership map.

    SAM masks are intentionally allowed to overlap: a face can sit inside a
    figure and a painted object can sit inside a wall. That is useful model
    output, but it is ambiguous for pointer and gaze interaction. This pass
    preserves every original mask while assigning each covered pixel to
    exactly one playable region.

    Ownership favours a region's interior core and Qwen anchor point, then
    adds a scale-normalised specificity term to resolve overlaps within a layer.
    Base layers compete only for pixels outside the independent elements.
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
    layers = base_layers or set()
    independent = np.zeros(shape, dtype=bool)
    if layers:
        for index, mask in enumerate(masks):
            if index not in layers:
                independent |= mask
    protected = 0

    for index, (mask, point, confidence) in enumerate(zip(masks, points, scores)):
        if index in layers:
            protected += int(np.count_nonzero(mask & independent))
            mask = mask & ~independent
        if not mask.any():
            continue
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

    exclusive = [(owner == index) for index in range(len(masks))]
    return exclusive, {
        "method": "foreground-first-partition-v2" if base_layers is not None else "exclusive-core-anchor-partition-v1",
        "exclusive": True,
        "covered_pixels": int((coverage > 0).sum()),
        "overlap_pixels_resolved": int((coverage > 1).sum()),
        "unassigned_pixels": int((coverage == 0).sum()),
        "base_layer_conflicts": protected,
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


def intersection_area(a: list[int], b: list[int]) -> int:
    return rect_area([
        max(a[0], b[0]), max(a[1], b[1]),
        min(a[2], b[2]), min(a[3], b[3]),
    ])


def intersection_over_union(a: list[int], b: list[int]) -> float:
    intersection = intersection_area(a, b)
    union = rect_area(a) + rect_area(b) - intersection
    return intersection / union if union else 0.0


def filter_artwork_proposals(
    proposals: list[dict], artwork: dict, content_rect: list[int], width: int, height: int,
) -> list[dict]:
    box = clamp_rect(normalized_rect(artwork.get("bbox", [0, 0, 1000, 1000]), width, height), content_rect)
    has_clear_boundary = (
        float(artwork.get("confidence", 0)) >= .90
        and .06 <= rect_area(box) / rect_area(content_rect) <= .78
    )
    kept = []
    for proposal in proposals:
        label = proposal.get("label", "")
        role = proposal.get("artwork_role", "")
        if is_incidental_region(label, role):
            continue
        bare_wall = re.fullmatch(
            r"(?:bare |exposed |unpainted |adjacent |side )?(?:brick|stone|concrete|masonry) (?:wall|facade)",
            label,
            re.I,
        )
        if has_clear_boundary and bare_wall and role != "integrated_material":
            locations = [proposal, *proposal.get("parts", [])]
            rects = [normalized_rect(location["bbox"], width, height) for location in locations]
            if all(intersection_area(rect, box) < .4 * rect_area(rect) for rect in rects):
                continue
        kept.append(proposal)
    return kept


def choose_artwork_crop(
    predictor: SAM2ImagePredictor,
    artwork: dict,
    proposals: list[dict],
    content_rect: list[int],
    width: int,
    height: int,
) -> tuple[list[int], dict]:
    """Keep the detected artwork plus a small safety margin, or the full content."""
    content_area = max(1, rect_area(content_rect))
    proposed = clamp_rect(normalized_rect(artwork.get("bbox", [0, 0, 1000, 1000]), width, height), content_rect)
    confidence = float(artwork.get("confidence", 0.0))
    area_ratio = rect_area(proposed) / content_area
    model_full_frame = bool(artwork.get("full_frame", True))
    # Confidence is kept for inspection. Only a usable geometry determines the crop.
    usable = 0 < area_ratio < .95 and proposed[2] > proposed[0] and proposed[3] > proposed[1]
    margin_x = round((content_rect[2] - content_rect[0]) * .025)
    margin_y = round((content_rect[3] - content_rect[1]) * .025)
    crop = clamp_rect([
        proposed[0] - margin_x, proposed[1] - margin_y,
        proposed[2] + margin_x, proposed[3] + margin_y,
    ], content_rect) if usable else content_rect
    return crop, {
        "applied": crop != content_rect,
        "reason": "usable_artwork_box" if crop != content_rect else "full_artwork_frame",
        "model_full_frame": model_full_frame,
        "full_frame_overridden": model_full_frame and crop != content_rect,
        "model_confidence": round(confidence, 4),
        "model_box": proposed,
    }


def has_panel_seam(image: np.ndarray, painted: np.ndarray, start: int, end: int, top: int, bottom: int) -> bool:
    """Look for two straight panel edges enclosing a darker recessed band."""
    gap = end - start
    height, width = painted.shape
    if gap < max(4, round(width * .008)) or gap > min(width * .10, (bottom - top) * .32):
        return False
    search = max(3, round(gap * .25))
    shoulder = max(10, gap // 2)
    left, right = start - search - shoulder, end + search + shoulder
    if left < 0 or right > width:
        return False
    left_paint = painted[top:bottom, left:start].any(axis=1)
    right_paint = painted[top:bottom, end:right].any(axis=1)
    if (left_paint & right_paint).mean() < .25:
        return False

    light = cv2.cvtColor(image[:, left:right], cv2.COLOR_BGR2LAB)[:, :, 0].astype(np.float32)
    smooth = cv2.GaussianBlur(light, (5, 5), 0)
    gradient = smooth[:, 2:] - smooth[:, :-2]
    inset = max(1, round((bottom - top) * .05))
    inside = slice(top + inset, bottom - inset)
    edges = []
    for position, direction in ((start, -1), (end, 1)):
        columns = np.arange(position - left - search, position - left + search + 1)
        strengths = direction * gradient[:, columns - 1]
        x = int(np.argmax(np.median(strengths[inside], axis=0)))
        profile = strengths[:, x]
        if any((rows >= 12).mean() < .65 for rows in np.array_split(profile[inside], 4)):
            return False
        edges.append((int(columns[x]), profile))

    (left_edge, left_profile), (right_edge, right_profile) = edges
    if right_edge - left_edge < gap * .65:
        return False
    band = np.median(light[inside, start - left + gap // 4:end - left - gap // 4], axis=1)
    left_side = np.median(light[inside, left_edge - shoulder:left_edge - 2], axis=1)
    right_side = np.median(light[inside, right_edge + 2:right_edge + shoulder], axis=1)
    if (np.minimum(left_side, right_side) - band >= 16).mean() < .72:
        return False

    # A matching stripe continuing beyond both artwork edges is ambiguous.
    both_edges = (left_profile >= 12) & (right_profile >= 12)
    outside = np.r_[both_edges[max(0, top - shoulder):top], both_edges[bottom:min(height, bottom + shoulder)]]
    return outside.size < 8 or outside.mean() < .65


def isolate_painted_artwork(
    image: np.ndarray, region_records: list[dict], sam3_dir: Path | None,
    crop: list[int], prepared_shape: tuple[int, int],
) -> tuple[np.ndarray, list[dict], dict]:
    """Use a whole-artwork mask for display and the same layout for every region."""
    unchanged = (image, region_records, {})
    if sam3_dir is None or not (sam3_dir / "artwork.json").is_file():
        return unchanged

    left, top, right, bottom = crop
    panels = []
    for record in json.loads((sam3_dir / "artwork.json").read_text()):
        raw = cv2.imread(str(sam3_dir / record["mask"]), cv2.IMREAD_GRAYSCALE)
        if raw is None or raw.shape != prepared_shape:
            continue
        panel = raw[top:bottom, left:right] > 0
        if panel.any():
            panels.append(panel)
    if not panels:
        return unchanged

    painted = np.logical_or.reduce(panels)
    if not .025 <= painted.mean() < .94:
        return unchanged
    subject_masks = [
        record["mask"] for record in region_records
        if record["type"] not in GROUND_TYPES | {"wall", "texture", "fill"} and record["mask"].any()
    ]
    if subject_masks:
        subjects = np.logical_or.reduce(subject_masks)
        if np.count_nonzero(painted & subjects) < .72 * np.count_nonzero(subjects):
            return unchanged
    for record in region_records:
        if record["type"] == "exposed_support":
            painted |= record["mask"]

    # Close small holes in the same panel. Do not bridge disconnected artworks.
    count, labels, stats, _ = cv2.connectedComponentsWithStats((~painted).astype(np.uint8), connectivity=8)
    height, width = painted.shape
    for label in range(1, count):
        x, y, w, h, area = stats[label]
        if x > 0 and y > 0 and x + w < width and y + h < height and area <= .0025 * height * width:
            target = painted[y:y + h, x:x + w]
            target[labels[y:y + h, x:x + w] == label] = True

    painted_rows, painted_columns = np.nonzero(painted)
    y1, y2 = int(painted_rows.min()), int(painted_rows.max()) + 1
    x1, x2 = int(painted_columns.min()), int(painted_columns.max()) + 1
    occupied = painted.any(axis=0)
    splits = np.flatnonzero(np.diff(np.r_[False, ~occupied[x1:x2], False])).reshape(-1, 2) + x1
    panel_bounds = [mask_bounds(panel) for panel in panels]
    gaps = []
    for start, end in splits:
        # A broad interval between separately detected panels already has
        # panel evidence. A single SAM mask needs evidence from the photo.
        separate_panels = (end - start >= .045 * width
                           and any(bounds[2] == start for bounds in panel_bounds)
                           and any(bounds[0] == end for bounds in panel_bounds))
        if separate_panels or has_panel_seam(image, painted, start, end, y1, y2):
            gaps.append((int(start), int(end)))
    starts = [x1, *(end for _, end in gaps)]
    ends = [*(start for start, _ in gaps), x2]
    ranges = list(zip(starts, ends))
    columns = np.concatenate([np.arange(start, end) for start, end in ranges])
    alpha = painted[y1:y2, columns]
    artwork = np.dstack((image[y1:y2, columns], alpha.astype(np.uint8) * 255))
    artwork[~alpha] = 0

    remapped = []
    for record in region_records:
        mask = record["mask"][y1:y2, columns] & alpha
        if not mask.any():
            continue
        px, py = record["point_px"]
        new_x = int(np.argmin(np.abs(columns - px)))
        new_y = int(np.clip(round(py) - y1, 0, mask.shape[0] - 1))
        if not mask[new_y, new_x]:
            ys, xs = np.nonzero(mask)
            nearest = np.argmin((columns[xs] - px) ** 2 + (ys + y1 - py) ** 2)
            new_x, new_y = int(xs[nearest]), int(ys[nearest])
        remapped.append({**record, "mask": mask, "point_px": (new_x, new_y)})
    if region_records and not remapped:
        return unchanged

    segments = []
    output_x = 0
    for start, end in ranges:
        segments.append({
            "prepared_rect": [left + start, top + y1, left + end, top + y2],
            "output_origin": {"x": output_x, "y": 0},
        })
        output_x += end - start
    return artwork, remapped, {
        "foreground_mask": "SAM 3",
        "layout": "joined_panels" if len(ranges) > 1 else "transparent_silhouette",
        "segments": segments,
        **({"removed_column_ranges": [[left + start, left + end] for start, end in gaps]} if gaps else {}),
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


def segment_location(
    predictor, location: dict, kind: str, width: int, height: int, *, restrict: bool,
    positive: tuple[int, int] | None = None, negatives: list[tuple[int, int]] | None = None,
) -> tuple[np.ndarray, float]:
    x1, y1, x2, y2 = location["bbox"]
    px, py = location["point"]
    box = np.asarray([
        x1 / 1000 * (width - 1), y1 / 1000 * (height - 1),
        x2 / 1000 * (width - 1), y2 / 1000 * (height - 1),
    ], dtype=np.float32)
    points = [positive or (px / 1000 * (width - 1), py / 1000 * (height - 1)), *(negatives or [])]
    masks, scores, _ = predictor.predict(
        point_coords=np.asarray(points, dtype=np.float32),
        point_labels=np.asarray([1] + [0] * (len(points) - 1), dtype=np.int32),
        box=box,
        multimask_output=True,
    )
    mask, score = select_mask(masks, scores, kind)
    if restrict:
        left, top, right, bottom = normalized_rect(location["bbox"], width, height)
        mask[:top] = mask[bottom:] = False
        mask[:, :left] = mask[:, right:] = False
    return mask, score


def interior_point(mask: np.ndarray) -> tuple[int, int]:
    distance = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5)
    return cv2.minMaxLoc(distance)[3]


def segment_local_detail(predictor, image: np.ndarray, location: dict, kind: str, exclusions=()):
    """Use a fresh embedding of the nearby artwork to keep small edges visible."""
    height, width = image.shape[:2]
    left, top, right, bottom = normalized_rect(location["bbox"], width, height)
    margin = max(12, round(max(right - left, bottom - top) * .28))
    x1, y1 = max(0, left - margin), max(0, top - margin)
    x2, y2 = min(width, right + margin), min(height, bottom + margin)
    patch = image[y1:y2, x1:x2]
    local = remap_location(location, [x1, y1, x2, y2], width, height)
    result = np.zeros((height, width), dtype=bool)
    if local is None:
        return result, 0.0
    negatives = []
    px, py = [round(value * size / 1000) for value, size in zip(location["point"], (width, height))]
    for u, v in exclusions:
        x, y = round(u * width / 1000), round(v * height / 1000)
        if x1 <= x < x2 and y1 <= y < y2 and max(abs(x - px), abs(y - py)) >= 4:
            negatives.append((x - x1, y - y1))
    predictor.set_image(patch)
    refined, score = segment_location(predictor, local, kind, patch.shape[1], patch.shape[0],
                                      restrict=True, negatives=negatives)
    result[y1:y2, x1:x2] = refined
    return result, score


def refine_colliding_elements(predictor, records: list[dict], width: int, height: int) -> None:
    """Use neighboring masks to prompt a second cut when independent shapes collide."""
    elements = [record for record in records if record["type"] not in BASE_LAYER_TYPES and record["mask"].any()]
    for record in elements:
        mask = record["mask"]
        area = int(mask.sum())
        if record["proposal"].get("parts") or record["sam3_matches"] > 1:
            continue
        neighbors = []
        for other in elements:
            if other is record:
                continue
            other_mask = other["mask"]
            intersection = np.count_nonzero(mask & other_mask)
            if intersection < .18 * min(area, other_mask.sum()):
                continue
            if intersection >= .85 * min(area, other_mask.sum()):
                continue  # An intentional part can sit inside its parent.
            neighbors.append(other_mask)
        if not neighbors:
            continue
        neighbor_mask = np.logical_or.reduce(neighbors)
        own_pixels = mask & ~neighbor_mask
        rival_pixels = neighbor_mask & ~mask
        if not own_pixels.any() or not rival_pixels.any():
            continue
        positive = interior_point(own_pixels)
        negative = interior_point(rival_pixels)
        proposal = record["proposal"]
        refined, score = segment_location(
            predictor, proposal, record["type"], width, height, restrict=record["fine_detail"],
            positive=positive, negatives=[negative],
        )
        retained = np.count_nonzero(refined & own_pixels) / np.count_nonzero(own_pixels)
        extra = np.count_nonzero(refined & ~mask) / area
        overlap = np.count_nonzero(mask & neighbor_mask)
        if (refined[positive[1], positive[0]] and retained >= .9 and extra <= .15
                and np.count_nonzero(refined & neighbor_mask) <= .8 * overlap):
            record.update(mask=refined, scores=[score], point_px=positive, refined_boundary=True)


# A color word adds pixel evidence for a specifically named paint field.
# Generic grounds and multicolored or gradient grounds use the SAM mask.
GROUND_HUES = {
    "red": (0, 15), "orange": (15, 12), "yellow": (30, 13), "green": (60, 25),
    "teal": (89, 13), "cyan": (90, 13), "blue": (110, 21), "purple": (140, 20),
    "violet": (139, 17), "pink": (166, 18),
}
GROUND_COLOR_WORDS = GROUND_HUES.keys() | {"black", "white", "gray", "grey", "brown"}


def constrain_paint_fields(image_bgr: np.ndarray, records: list[dict], *, subtract_elements: bool = True) -> None:
    ground = [record for record in records if record["type"] == "painted_ground"]
    if not ground:
        return
    if subtract_elements:
        independent = np.zeros(image_bgr.shape[:2], dtype=bool)
        for record in records:
            if record["type"] not in BASE_LAYER_TYPES:
                independent |= record["mask"]
        for record in ground:
            record["mask"] = record["mask"] & ~independent
    hue, saturation, value = cv2.split(cv2.cvtColor(cv2.medianBlur(image_bgr, 5), cv2.COLOR_BGR2HSV))
    hue = hue.astype(np.int16)
    for record in ground:
        words = set(re.findall(r"[a-z]+", record["label"].lower()))
        colors = words & GROUND_COLOR_WORDS
        if len(colors) != 1 or words & {"gradient", "multicolor", "multicolored", "multicoloured"}:
            continue
        color = next(iter(colors))
        if color in GROUND_HUES:
            center, radius = GROUND_HUES[color]
            distance = np.abs((hue - center + 90) % 180 - 90)
            pigment = (distance <= radius) & (saturation >= 48) & (value >= 36)
        elif color == "brown":
            pigment = (hue <= 28) & (saturation >= 48) & (value >= 34) & (value <= 155)
        elif color == "black":
            pigment = value <= 65
        elif color == "white":
            pigment = (saturation <= 54) & (value >= 183)
        else:
            pigment = (saturation <= 55) & (value >= 65) & (value < 200)
        candidate = clean_mask(record["mask"] & pigment) & record["mask"]
        record["mask"] = candidate
        record["color_constrained"] = True
        if candidate.any():
            record["point_px"] = interior_point(candidate)


def add_palette_regions(
    image: np.ndarray, records: list[dict], masks: list[np.ndarray], used: set[str],
) -> None:
    slots = min(3, 7 - len(records))
    if slots <= 0:
        return
    fields = [
        index for index, (record, mask) in enumerate(zip(records, masks))
        if mask.mean() >= .16 and (
            record["type"] == "fill" or re.search(
                r"\b(?:colou?r(?:ful|ed)?|painted)\b.*\b(?:field|background|wall)\b",
                record["label"], re.I,
            )
        )
    ]
    if not fields:
        return
    field_index = max(fields, key=lambda index: int(masks[index].sum()))
    field = masks[field_index]
    hue, saturation, value = cv2.split(cv2.cvtColor(cv2.medianBlur(image, 5), cv2.COLOR_BGR2HSV))
    painted = field & (saturation >= 115) & (value >= 70)
    bands = [
        ("Red", (hue >= 168) | (hue < 9), [242, 76, 80]),
        ("Amber and yellow", (hue >= 9) & (hue < 34), [251, 163, 40]),
        ("Green", (hue >= 34) & (hue < 84), [85, 193, 103]),
        ("Blue", (hue >= 84) & (hue < 139), [64, 142, 244]),
        ("Violet and pink", (hue >= 139) & (hue < 168), [204, 94, 229]),
    ]
    candidates = []
    for name, in_band, color in bands:
        _, labels, stats, _ = cv2.connectedComponentsWithStats((painted & in_band).astype(np.uint8))
        large = np.flatnonzero(stats[1:, cv2.CC_STAT_AREA] >= field.size * .004) + 1
        mask = np.isin(labels, large)
        size = int(mask.sum())
        if size >= field.size * .01:
            candidates.append((size, name, color, mask))

    remaining = field.copy()
    remaining_size = int(field.sum())
    field_record = records[field_index]
    for size, name, color, mask in sorted(candidates, key=lambda item: item[0], reverse=True):
        if slots == 0:
            break
        if remaining_size - size < field.size * .015:
            continue
        index = len(records) + 1
        records.append({
            "id": unique_id(f"palette_{name}", used, index),
            "label": f"{name} paint",
            "type": "fill",
            "index": index,
            "color_rgb": color,
            "mask": mask,
            "scores": field_record["scores"],
            "fine_detail": False,
            "meaning": f"{name} pigment inside {field_record['label']}.",
            "palette_band": True,
        })
        masks.append(mask)
        remaining &= ~mask
        remaining_size -= size
        slots -= 1
    masks[field_index] = remaining


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--proposals", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--sam3", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    image_bgr = cv2.imread(str(args.image), cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise SystemExit("Could not read uploaded image")
    height, width = image_bgr.shape[:2]
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    proposal_payload = json.loads(args.proposals.read_text(encoding="utf-8"))
    preprocessing = proposal_payload.get("preprocessing", {})
    content_rect = clamp_rect(preprocessing.get("content_box", [0, 0, width, height]), [0, 0, width, height])
    artwork = proposal_payload.get("artwork", {})
    fixed_types = proposal_payload.get("region_taxonomy") == REGION_TAXONOMY
    coverage_pass = proposal_payload.get("coverage_pass", False)
    local_detail_pass = coverage_pass and proposal_payload.get("local_detail_pass", False)
    proposals = proposal_payload["regions"]
    usable_proposals = {id(proposal) for proposal in filter_artwork_proposals(proposals, artwork, content_rect, width, height)}
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = build_sam2(CONFIG, str(CHECKPOINT), device=device)
    predictor = SAM2ImagePredictor(model)

    with torch.inference_mode():
        crop, isolation = choose_artwork_crop(
            predictor,
            artwork,
            proposals,
            content_rect,
            width,
            height,
        )
    prepared_width, prepared_height = width, height
    image_bgr = image_bgr[crop[1]:crop[3], crop[0]:crop[2]].copy()
    height, width = image_bgr.shape[:2]
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    semantic_records = {}
    if args.sam3:
        for record in json.loads((args.sam3 / "regions.json").read_text()):
            semantic_records[record["index"]] = record
            if "proposal" in record and record["index"] == len(proposals) and len(proposals) < 9:
                proposal = record["proposal"]
                proposals.append(proposal)
                usable_proposals.add(id(proposal))
    proposals = [
        (source_index, mapped) for source_index, proposal in enumerate(proposals)
        if id(proposal) in usable_proposals
        and (mapped := remap_proposal(proposal, crop, prepared_width, prepared_height)) is not None
    ]
    if proposals and not local_detail_pass:
        predictor.set_image(image_rgb)

    region_records: list[dict] = []
    used: set[str] = set()
    with torch.inference_mode():
        for index, (source_index, proposal) in enumerate(proposals, start=1):
            px, py = proposal["point"]
            region_id = unique_id(proposal.get("id", ""), used, index)
            label = proposal.get("label", region_id)
            kind = proposal.get("type", "detail")
            fine_detail = kind in FINE_TYPES or is_wall_crack(label)
            if not fixed_types and fine_detail:
                kind = "texture"
            parts = proposal.get("parts", [])
            semantic = semantic_records.get(source_index)
            source = cv2.imread(str(args.sam3 / semantic["mask"]), cv2.IMREAD_GRAYSCALE) if semantic else None
            mask = (source[crop[1]:crop[3], crop[0]:crop[2]] > 0
                    if source is not None and source.shape == (prepared_height, prepared_width) else None)
            used_sam3 = mask is not None and mask.any()
            if local_detail_pass:
                exclusions = [(round((u * prepared_width / 1000 - crop[0]) * 1000 / width),
                               round((v * prepared_height / 1000 - crop[1]) * 1000 / height))
                              for u, v in proposal.get("negative_points", [])]
                mask, score = segment_local_detail(predictor, image_rgb, proposal, kind, exclusions)
                scores = [score]
                used_sam3 = False
            elif used_sam3:
                scores = list(semantic["scores"]) or [.5]
            else:
                mask, score = segment_location(
                    predictor, proposal, kind, width, height,
                    restrict=coverage_pass or fine_detail or (bool(parts) and kind not in BASE_LAYER_TYPES),
                )
                scores = [score]
            for part in parts:
                x1, y1, x2, y2 = normalized_rect(part["bbox"], width, height)
                if used_sam3 and mask[y1:y2, x1:x2].mean() >= .06:
                    continue
                if local_detail_pass:
                    part_mask, part_score = segment_local_detail(predictor, image_rgb, part, kind)
                else:
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
                "sam3_matches": len(semantic["scores"]) if used_sam3 else 0,
                "fine_detail": fine_detail,
                "artwork_role": proposal.get("artwork_role"),
                "proposal": proposal,
                "point_px": (
                    px / 1000 * (width - 1),
                    py / 1000 * (height - 1),
                ),
                "meaning": proposal.get("meaning", ""),
            })
        if fixed_types and not coverage_pass:
            refine_colliding_elements(predictor, region_records, width, height)

    artwork_image, region_records, silhouette = isolate_painted_artwork(
        image_bgr, region_records, args.sam3, crop, (prepared_height, prepared_width),
    )
    height, width = artwork_image.shape[:2]
    isolation.update(silhouette)
    if silhouette:
        isolation["applied"] = True
        isolation["reason"] = "painted_artwork_mask"
    cv2.imwrite(str(args.output / "artwork.png"), artwork_image, [cv2.IMWRITE_PNG_COMPRESSION, 5])

    if fixed_types:
        constrain_paint_fields(artwork_image[:, :, :3], region_records, subtract_elements=not coverage_pass)
    if coverage_pass:
        # These are provisional SAM masks. The server reviews each before
        # adding it to the existing exclusive interaction map.
        exclusive_masks = [record["mask"] for record in region_records]
        interaction_partition = {}
    else:
        exclusive_masks, interaction_partition = build_exclusive_interaction_masks(
            [record["mask"] for record in region_records],
            [record["point_px"] for record in region_records],
            [record["scores"][0] for record in region_records],
            base_layers={
                index for index, record in enumerate(region_records) if record["type"] in BASE_LAYER_TYPES
            } if fixed_types else None,
        )
    if not region_records:
        interaction_partition["unassigned_pixels"] = width * height
    if not fixed_types:
        add_palette_regions(artwork_image[:, :, :3], region_records, exclusive_masks, used)
    output_regions: list[dict] = []
    for record, interaction_mask in zip(region_records, exclusive_masks):
        if (fixed_types or silhouette) and not interaction_mask.any():
            continue
        index = record["index"]
        region_id = record["id"]
        palette_band = record.get("palette_band", False)
        source_name = f"{index:02d}_{region_id}_{'palette' if palette_band else 'sam'}.png"
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
            "method": "Pigment split within the parent mask" if palette_band else
                "Qwen3-VL + local SAM 2.1 cut" if local_detail_pass else
                "Qwen3-VL + SAM 3 + exclusive interaction partition" if record.get("sam3_matches") else
                "Qwen3-VL proposal + SAM 2.1 Tiny + exclusive interaction partition",
            **({"sam3_matches": record["sam3_matches"]} if record.get("sam3_matches") else {}),
            **({"palette_band": True} if palette_band else {}),
            **({"fine_detail": True} if record["fine_detail"] else {}),
            **({"color_constrained": True} if record.get("color_constrained") else {}),
            **({"refined_boundary": True} if record.get("refined_boundary") else {}),
        })
        if fixed_types:
            region = output_regions[-1]
            set_region_type(region, record["type"])
            region["category_source"] = "vision_proposal"
            if record["artwork_role"]:
                region["artwork_role"] = record["artwork_role"]

    preprocessing["crop"] = {
        **isolation,
        "prepared_rect": crop,
        "removed_analysis_padding": preprocessing.get("padding", {}).get("applied", False),
    }
    preprocessing["output_size"] = {"width": width, "height": height}
    preprocessing["coordinate_transform"] = {
        "oriented_source_to_prepared_scale": preprocessing.get("resize", {}).get("scale", 1.0),
        "prepared_padding": preprocessing.get("padding", {}),
        **({"prepared_to_output_segments": silhouette["segments"]} if silhouette else
           {"prepared_to_output_crop_origin": {"x": crop[0], "y": crop[1]}}),
    }
    (args.output / "regions.json").write_text(json.dumps({
        "image_size": {"width": width, "height": height},
        "processed_image": "artwork.png",
        "preprocessing": preprocessing,
        "artwork_isolation": isolation,
        "proposal_source": "Qwen3-VL 2B Instruct 4-bit",
        "mask_model": "SAM 3 + SAM 2.1 Hiera Tiny" if any(r.get("sam3_matches") for r in region_records) else "SAM 2.1 Hiera Tiny",
        "interaction_partition": interaction_partition,
        "device": device,
        **({"region_taxonomy": REGION_TAXONOMY} if fixed_types else {}),
        "regions": output_regions,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
