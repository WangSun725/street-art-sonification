#!/usr/bin/env python3
"""Create a model-assisted playable-region demo for the included artwork.

Qwen3-VL supplied the semantic proposal. This script uses reviewed points and
boxes with SAM 2.1 Tiny to generate pixel masks, then renders comparison and
mask-atlas images for visual QA. It analyzes only the completed image and does
not infer a painting order.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
import torch
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor


ROOT = Path(__file__).resolve().parent
IMAGE_PATH = ROOT / "inputs" / "the-defiant-one.webp"
OUTPUT_DIR = ROOT / "outputs" / "interactive-prep" / "the-defiant-one-regions"
CHECKPOINT = ROOT / "third_party" / "sam2" / "checkpoints" / "sam2.1_hiera_tiny.pt"
CONFIG = "configs/sam2.1/sam2.1_hiera_t.yaml"


@dataclass
class Prompt:
    box: tuple[int, int, int, int]
    point: tuple[int, int]


@dataclass
class Region:
    id: str
    label: str
    kind: str
    prompts: list[Prompt]
    color: tuple[int, int, int]  # RGB
    min_area: float = 0.0001
    max_area: float = 0.95
    hit_dilate: int = 0
    notes: str = ""
    method: str = "sam2"
    masks: list[np.ndarray] = field(default_factory=list)
    scores: list[float] = field(default_factory=list)


REGIONS = [
    Region(
        "colored_wall",
        "Colored wall",
        "wall",
        [Prompt((0, 0, 849, 1029), (35, 75))],
        (245, 192, 54),
        max_area=0.80,
        notes="Architectural/material bed; selected from an exposed yellow wall area.",
    ),
    Region(
        "background_lettering",
        "Background lettering",
        "lettering",
        [
            Prompt((0, 0, 155, 455), (75, 110)),
            Prompt((225, 0, 585, 245), (445, 55)),
            Prompt((610, 0, 849, 260), (705, 85)),
        ],
        (232, 82, 120),
        max_area=0.42,
        hit_dilate=7,
        notes="Union of three separated upper-background glyph groups.",
    ),
    Region(
        "left_drips_decay",
        "Drips / wall decay",
        "drip",
        [Prompt((0, 335, 160, 930), (35, 565))],
        (57, 195, 178),
        max_area=0.25,
        hit_dilate=8,
        notes="Left-side paint-run and weathered wall field.",
    ),
    Region(
        "central_figure",
        "Central figure",
        "figure",
        [Prompt((35, 60, 839, 1029), (430, 525))],
        (84, 134, 247),
        min_area=0.20,
        max_area=0.88,
        notes="Parent region for the central stencil-like character.",
    ),
    Region(
        "raised_arm",
        "Raised arm / object",
        "figure",
        [Prompt((45, 220, 325, 990), (185, 505))],
        (164, 102, 245),
        max_area=0.36,
        notes="Gesture-bearing left-side arm and held object.",
    ),
    Region(
        "black_clothing",
        "Black foreground clothing",
        "fill",
        [Prompt((70, 535, 840, 1029), (405, 845))],
        (32, 170, 228),
        max_area=0.58,
        notes="Large lower black mass used as a low-frequency musical layer.",
    ),
    Region(
        "face",
        "Face / skin fill",
        "fill",
        [Prompt((270, 75, 715, 590), (470, 405))],
        (247, 142, 43),
        max_area=0.30,
        notes="Internal light face region nested inside the figure.",
    ),
    Region(
        "sunglasses",
        "Sunglasses",
        "outline",
        [Prompt((285, 200, 625, 365), (480, 285))],
        (233, 70, 67),
        max_area=0.13,
        hit_dilate=10,
        notes="High-contrast facial detail; hit mask is enlarged for interaction.",
    ),
    Region(
        "cigarette_smoke",
        "Cigarette / smoke",
        "outline",
        [Prompt((275, 275, 455, 425), (373, 365))],
        (126, 211, 33),
        max_area=0.08,
        hit_dilate=14,
        notes="Thin detail; the playable hit area is deliberately wider than the visual line.",
    ),
]


def choose_mask(masks: np.ndarray, scores: np.ndarray, region: Region) -> tuple[np.ndarray, float]:
    areas = masks.reshape(masks.shape[0], -1).mean(axis=1)
    valid = np.where((areas >= region.min_area) & (areas <= region.max_area))[0]
    pool = valid if len(valid) else np.arange(len(scores))
    index = int(pool[np.argmax(scores[pool])])
    return masks[index].astype(bool), float(scores[index])


def clean_mask(mask: np.ndarray) -> np.ndarray:
    binary = mask.astype(np.uint8) * 255
    kernel = np.ones((3, 3), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, 8)
    if count <= 1:
        return binary > 0
    keep = np.zeros_like(binary)
    threshold = max(40, int(binary.size * 0.00008))
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] >= threshold:
            keep[labels == index] = 255
    return keep > 0


def text_box(image: np.ndarray, text: str, origin: tuple[int, int], color: tuple[int, int, int]) -> None:
    x, y = origin
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = 0.52
    thickness = 1
    (width, height), baseline = cv2.getTextSize(text, font, scale, thickness)
    cv2.rectangle(image, (x - 4, y - height - 5), (x + width + 5, y + baseline + 4), (18, 22, 30), -1)
    cv2.putText(image, text, (x, y), font, scale, color, thickness, cv2.LINE_AA)


def resize_panel(image: np.ndarray, height: int = 760) -> np.ndarray:
    ratio = height / image.shape[0]
    return cv2.resize(image, (round(image.shape[1] * ratio), height), interpolation=cv2.INTER_AREA)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    image_bgr = cv2.imread(str(IMAGE_PATH), cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise SystemExit(f"Could not read {IMAGE_PATH}")
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Loading SAM 2.1 Tiny on {device}", flush=True)
    model = build_sam2(CONFIG, str(CHECKPOINT), device=device)
    predictor = SAM2ImagePredictor(model)

    with torch.inference_mode():
        predictor.set_image(image_rgb)
        for region in REGIONS:
            for prompt in region.prompts:
                masks, scores, _ = predictor.predict(
                    point_coords=np.asarray([prompt.point], dtype=np.float32),
                    point_labels=np.asarray([1], dtype=np.int32),
                    box=np.asarray(prompt.box, dtype=np.float32),
                    multimask_output=True,
                )
                mask, score = choose_mask(masks, scores, region)
                region.masks.append(clean_mask(mask))
                region.scores.append(score)
            union = np.logical_or.reduce(region.masks)
            region.masks = [clean_mask(union)]
            print(
                f"{region.id:24s} score={max(region.scores):.3f} area={union.mean():.1%}",
                flush=True,
            )

    # SAM is excellent for object-like regions, but street-art lettering and
    # wall color are material/mark classes rather than isolated objects. Refine
    # those two layers with transparent, training-free image rules while using
    # the SAM figure mask to keep them out of the subject.
    by_id = {region.id: region for region in REGIONS}
    figure_mask = by_id["central_figure"].masks[0]
    figure_guard = cv2.dilate(
        figure_mask.astype(np.uint8) * 255, np.ones((9, 9), np.uint8)
    ) > 0
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)

    lettering_roi = np.zeros(gray.shape, dtype=np.uint8)
    for prompt in by_id["background_lettering"].prompts:
        x1, y1, x2, y2 = prompt.box
        lettering_roi[y1:y2, x1:x2] = 1
    lettering = (gray < 72) & (lettering_roi > 0) & ~figure_guard
    lettering = cv2.morphologyEx(
        lettering.astype(np.uint8) * 255,
        cv2.MORPH_CLOSE,
        np.ones((5, 5), np.uint8),
    )
    lettering = clean_mask(lettering > 0)
    by_id["background_lettering"].masks = [lettering]
    by_id["background_lettering"].method = "sam2-proposal + opencv-dark-mark-refinement"
    by_id["background_lettering"].notes = (
        "Dark coarse background marks inside the reviewed upper-wall boxes; "
        "the central figure is explicitly excluded."
    )

    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    colored_wall = (saturation > 72) & (value > 55) & ~figure_guard
    colored_wall &= ~cv2.dilate(
        lettering.astype(np.uint8) * 255, np.ones((3, 3), np.uint8)
    ).astype(bool)
    colored_wall = clean_mask(colored_wall)
    by_id["colored_wall"].masks = [colored_wall]
    by_id["colored_wall"].method = "sam2-figure-exclusion + opencv-color-segmentation"
    by_id["colored_wall"].notes = (
        "High-saturation painted wall outside the central figure and dark lettering."
    )

    overlay = image_bgr.copy()
    region_map = np.zeros_like(image_bgr)
    manifest: list[dict[str, object]] = []

    # Large parent/background regions are rendered first. Nested details remain visible.
    for index, region in enumerate(REGIONS, start=1):
        mask = region.masks[0]
        rgb = np.asarray(region.color, dtype=np.uint8)
        bgr = rgb[::-1]
        overlay[mask] = (0.58 * overlay[mask] + 0.42 * bgr).astype(np.uint8)
        region_map[mask] = bgr

        visual_mask = mask.astype(np.uint8) * 255
        hit_mask = visual_mask
        if region.hit_dilate:
            size = region.hit_dilate * 2 + 1
            hit_mask = cv2.dilate(visual_mask, np.ones((size, size), np.uint8))

        cv2.imwrite(str(OUTPUT_DIR / f"{index:02d}_{region.id}_mask.png"), visual_mask)
        cv2.imwrite(str(OUTPUT_DIR / f"{index:02d}_{region.id}_hit.png"), hit_mask)

        contours, _ = cv2.findContours(visual_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(overlay, contours, -1, tuple(int(v) for v in bgr), 2, cv2.LINE_AA)
        anchor = region.prompts[0].point
        text_box(overlay, f"{index} {region.label}", anchor, tuple(int(v) for v in bgr))

        manifest.append(
            {
                "id": region.id,
                "label": region.label,
                "type": region.kind,
                "method": region.method,
                "index": index,
                "color_rgb": list(region.color),
                "visual_mask": f"{index:02d}_{region.id}_mask.png",
                "hit_mask": f"{index:02d}_{region.id}_hit.png",
                "sam_scores": [round(value, 4) for value in region.scores],
                "area_ratio": round(float(mask.mean()), 5),
                "prompts": [
                    {"bbox_px": list(prompt.box), "point_px": list(prompt.point)}
                    for prompt in region.prompts
                ],
                "notes": region.notes,
            }
        )

    cv2.imwrite(str(OUTPUT_DIR / "overlay.png"), overlay)
    cv2.imwrite(str(OUTPUT_DIR / "region_map.png"), region_map)

    original_panel = resize_panel(image_bgr)
    overlay_panel = resize_panel(overlay)
    region_panel = resize_panel(region_map)
    header_height = 58
    panel_width = original_panel.shape[1]
    comparison = np.full(
        (original_panel.shape[0] + header_height, panel_width * 3, 3),
        246,
        dtype=np.uint8,
    )
    comparison[header_height:, :panel_width] = original_panel
    comparison[header_height:, panel_width : panel_width * 2] = overlay_panel
    comparison[header_height:, panel_width * 2 :] = region_panel
    for column, label in enumerate(("ORIGINAL", "SAM REGIONS + LABELS", "PLAYABLE REGION MAP")):
        x = column * panel_width + 18
        cv2.putText(
            comparison,
            label,
            (x, 37),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.58,
            (26, 31, 42),
            2,
            cv2.LINE_AA,
        )
    cv2.imwrite(str(OUTPUT_DIR / "comparison.png"), comparison)

    # Render each mask separately so over-segmentation and overlap are easy to audit.
    tile_width, tile_height = 340, 430
    atlas = np.full((tile_height * 3, tile_width * 3, 3), 244, dtype=np.uint8)
    for tile_index, region in enumerate(REGIONS):
        mask = region.masks[0]
        bgr = np.asarray(region.color[::-1], dtype=np.uint8)
        isolated = (image_bgr.astype(np.float32) * 0.24).astype(np.uint8)
        isolated[mask] = (
            image_bgr[mask].astype(np.float32) * 0.48 + bgr.astype(np.float32) * 0.52
        ).astype(np.uint8)
        contours, _ = cv2.findContours(
            mask.astype(np.uint8) * 255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        cv2.drawContours(isolated, contours, -1, tuple(int(v) for v in bgr), 3, cv2.LINE_AA)
        scaled = cv2.resize(isolated, (tile_width, tile_height - 48), interpolation=cv2.INTER_AREA)
        row, column = divmod(tile_index, 3)
        y0, x0 = row * tile_height, column * tile_width
        atlas[y0 + 48 : y0 + tile_height, x0 : x0 + tile_width] = scaled
        cv2.putText(
            atlas,
            f"{tile_index + 1}. {region.label}",
            (x0 + 10, y0 + 24),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (25, 30, 40),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            atlas,
            f"score {max(region.scores):.3f} | area {mask.mean():.1%}",
            (x0 + 10, y0 + 43),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,
            (80, 86, 98),
            1,
            cv2.LINE_AA,
        )
    cv2.imwrite(str(OUTPUT_DIR / "mask_atlas.png"), atlas)

    with (OUTPUT_DIR / "regions.json").open("w", encoding="utf-8") as handle:
        json.dump(
            {
                "image": str(IMAGE_PATH.relative_to(ROOT)),
                "image_size": {"width": image_bgr.shape[1], "height": image_bgr.shape[0]},
                "proposal_source": "Qwen3-VL 2B Instruct, reviewed points/boxes",
                "mask_model": "SAM 2.1 Hiera Tiny",
                "device": device,
                "regions": manifest,
            },
            handle,
            indent=2,
            ensure_ascii=False,
        )

    print(f"Saved comparison: {OUTPUT_DIR / 'comparison.png'}", flush=True)
    print(f"Saved manifest: {OUTPUT_DIR / 'regions.json'}", flush=True)


if __name__ == "__main__":
    main()
