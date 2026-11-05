#!/usr/bin/env python3
"""Find repeated artwork instances with the local MLX SAM 3 checkpoint."""

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

import numpy as np
from mlx_vlm.generate import wired_limit
from mlx_vlm.models.sam3.generate import _load_predictor, predict_multi
from PIL import Image

from region_proposals import is_wall_crack


OBJECT_TYPES = {"figure", "face", "gesture", "lettering", "detail", "symbol"}
# Allow warm yellow paint shifted towards orange by shading and lighting.
PAINT_COLORS = {"red": 0, "orange": 20, "yellow": 33, "green": 88, "blue": 158, "purple": 193}


def concept_prompt(proposal):
    label = proposal["label"].strip().lower()
    if proposal["type"] not in OBJECT_TYPES or is_wall_crack(label):
        return None
    if re.search(r"\b(?:background|surface|texture|wall|scenery)\b", label):
        return None
    if re.fullmatch(r"[\w -]{2,55}", label) and len(label.split()) <= 6:
        if re.search(r"\bwindows?\b", label):
            return "window"
        return re.sub(r"^(?:large|small) ", "", label)
    return None


def overlap(first, second):
    left, top = max(first[0], second[0]), max(first[1], second[1])
    right, bottom = min(first[2], second[2]), min(first[3], second[3])
    intersection = max(0, right - left) * max(0, bottom - top)
    first_area = (first[2] - first[0]) * (first[3] - first[1])
    second_area = (second[2] - second[0]) * (second[3] - second[1])
    return intersection / max(1, first_area + second_area - intersection)


def pixel_box(normalized, size):
    width, height = size
    return [round(value * (height if index % 2 else width) / 1000) for index, value in enumerate(normalized)]


def predict(predictor, image, prompts, threshold):
    grouped = defaultdict(list)
    if prompts:
        result = predict_multi(predictor, image, list(dict.fromkeys(prompts)), score_threshold=threshold)
        for label, box, score, mask in zip(result.labels, result.boxes, result.scores, result.masks):
            if mask.any():
                grouped[label].append((box, float(score), mask > 0))
    return grouped


def mural_scope(payload, size):
    width, height = size
    content = payload.get("preprocessing", {}).get("content_box", [0, 0, width, height])
    artwork = payload.get("artwork", {})
    if artwork.get("confidence", 0) < .82:
        return content
    box = pixel_box(artwork["bbox"], size)
    clipped = [max(content[0], box[0]), max(content[1], box[1]),
               min(content[2], box[2]), min(content[3], box[3])]
    if clipped[2] > clipped[0] and clipped[3] > clipped[1]:
        return clipped
    return content


def paint_color_masks(image):
    hue, saturation, brightness = np.moveaxis(np.asarray(image.convert("HSV")), -1, 0)
    painted = (saturation >= 120) & (brightness >= 85)
    hue = hue.astype(np.int16)
    return {
        color: painted & (np.abs((hue - center + 128) % 256 - 128) <= 12)
        for color, center in PAINT_COLORS.items()
    }


def write_region(output, size, scope, instances, index):
    left, top, right, bottom = scope
    combined = np.zeros((size[1], size[0]), dtype=np.uint8)
    union = np.logical_or.reduce([mask for _, _, mask in instances])
    combined[top:bottom, left:right] = union * 255
    name = f"region-{index}.png"
    Image.fromarray(combined).save(output / name)
    return {"index": index, "mask": name, "scores": [score for _, score, _ in instances]}


def crack_support(predictor, image, scope):
    left, top, right, bottom = scope
    width, height = right - left, bottom - top
    support = np.zeros((image.height, image.width), dtype=bool)
    for row in range(2):
        for column in range(2):
            x1, y1 = left + round(width * column * .42), top + round(height * row * .42)
            x2, y2 = left + round(width * (column * .42 + .58)), top + round(height * (row * .42 + .58))
            tile = image.crop((x1, y1, x2, y2))
            hits = predict(predictor, tile, ["crack in wall"], .30)["crack in wall"]
            for _, _, mask in hits:
                if mask.mean() <= .015:
                    support[y1:y2, x1:x2] |= mask
    return support


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--proposals", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    image = Image.open(args.image).convert("RGB")
    payload = json.loads(args.proposals.read_text())
    proposals = payload["regions"]
    scope = mural_scope(payload, image.size)
    left, top, right, bottom = scope
    crop = image.crop(scope)
    requested = [(index, proposal, concept_prompt(proposal)) for index, proposal in enumerate(proposals)]
    requested = [(index, proposal, prompt) for index, proposal, prompt in requested if prompt]
    # Broad colour fields sometimes contain a repeated painted motif that
    # Qwen did not name. Only promote a colour-matched group with 2+ cubes.
    colors = {}
    if len(proposals) < 9 and any(re.search(r"\b(?:background|geometric|color fields?)\b", p["label"], re.I) for p in proposals):
        colors = paint_color_masks(crop)
        colors = dict(sorted(colors.items(), key=lambda entry: -np.count_nonzero(entry[1]))[:3])
        colors = {f"{color} cube": mask for color, mask in colors.items() if mask.mean() >= .04}
    crack_count = sum(is_wall_crack(p["label"]) for p in proposals)
    if not requested and not colors and crack_count != 1:
        return

    args.output.mkdir(parents=True, exist_ok=True)
    predictor = _load_predictor(str(args.model), .30)
    # Preserve the tested whole-frame concept input. Suppress matches outside
    # the mural scope using their mask, rather than changing the input scale.
    with wired_limit(predictor.model):
        hits = predict(predictor, image, [p for _, _, p in requested] + list(colors), .30)
        records = []
        used = []
        for index, proposal, prompt in requested:
            anchor = pixel_box(proposal["bbox"], image.size)
            options = [(box, score, mask) for box, score, mask in hits[prompt] if score >= .55]
            instances = []
            for box, score, mask in options:
                local_mask = mask[top:bottom, left:right]
                if local_mask.sum() >= .85 * mask.sum() and .0001 < local_mask.mean() < .45:
                    instances.append((box, score, local_mask))
            if not any(overlap(anchor, box) >= .20 for box, _, _ in instances):
                continue
            records.append(write_region(args.output, image.size, scope, instances, index))
            used.extend(box for box, _, _ in instances)

        discovered = None
        for prompt, color_mask in colors.items():
            instances = []
            for box, score, mask in hits[prompt]:
                local_mask = mask[top:bottom, left:right]
                pixels = local_mask.sum()
                if (pixels >= .90 * mask.sum() and .0005 < local_mask.mean() < .085
                        and (local_mask & color_mask).sum() >= .22 * pixels
                        and all(overlap(box, old) < .55 for old in used)):
                    instances.append((box, score, local_mask))
            if len(instances) >= 2 and (discovered is None or len(instances) > len(discovered[1])):
                discovered = (prompt, instances)
        if discovered:
            prompt, instances = discovered
            index = len(proposals)
            record = write_region(args.output, image.size, scope, instances, index)
            box = instances[0][0]
            width, height = image.size
            bbox = [round(value * 1000 / (height if i % 2 else width)) for i, value in enumerate(box)]
            record["proposal"] = {
                "id": prompt.replace(" ", "_"), "label": f"Painted {prompt}s", "type": "symbol",
                "bbox": bbox, "point": [(bbox[0] + bbox[2]) // 2, (bbox[1] + bbox[3]) // 2],
                "meaning": "Repeated painted geometric motif", "color_rgb": [196, 145, 250],
            }
            records.append(record)

        if crack_count == 1:
            support = crack_support(predictor, image, scope)
            Image.fromarray(support.astype(np.uint8) * 255).save(args.output / "crack-support.png")
    (args.output / "regions.json").write_text(json.dumps(records), encoding="utf-8")


if __name__ == "__main__":
    main()
