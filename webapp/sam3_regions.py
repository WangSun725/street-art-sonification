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

from region_proposals import REGION_TAXONOMY, is_wall_crack


OBJECT_TYPES = {
    "figure", "figure_part", "depicted_object", "lettering", "abstract_shape",
    "face", "gesture", "detail", "symbol",
}
ARTWORK_PROMPTS = ["painted mural", "mural panel", "graffiti mural"]
DISCOVERY_PROMPTS = {
    "graffiti lettering": ("Graffiti lettering", "lettering", .60),
    "stylized graffiti letters": ("Painted letter group", "lettering", .55),
    "painted portrait": ("Painted portrait", "figure", .63),
    "abstract painted shapes": ("Abstract painted shapes", "abstract_shape", .72),
    "sharp gray painted shapes": ("Gray angular shapes", "abstract_shape", .74),
}
DETAIL_PROMPTS = {
    "decorative star": "abstract_shape",
    "round emblem": "abstract_shape",
    "painted ornament": "abstract_shape",
    "painted face covering": "depicted_object",
    "painted jewelry": "depicted_object",
}
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


def write_artwork_masks(output, hits, content):
    """Keep confident whole-mural masks and consolidate duplicate detections."""
    left, top, right, bottom = content
    size = (right - left) * (bottom - top)
    candidates = sorted(
        ((score, mask) for prompt in ARTWORK_PROMPTS for _, score, mask in hits[prompt]
         if score >= .75 and mask[top:bottom, left:right].sum() >= .012 * size),
        key=lambda item: -item[0],
    )
    panels = []
    largest = max((np.count_nonzero(mask) for _, mask in candidates), default=0)
    for score, mask in candidates:
        area = np.count_nonzero(mask)
        if area < .15 * largest:
            continue
        for panel in panels:
            intersection = np.count_nonzero(mask & panel["mask"])
            if intersection >= .70 * min(area, np.count_nonzero(panel["mask"])):
                if intersection >= .65 * max(area, np.count_nonzero(panel["mask"])):
                    panel["mask"] = panel["mask"] | mask
                break
        else:
            panels.append({"score": score, "mask": mask})
    records = []
    for index, panel in enumerate(panels):
        filename = f"artwork-{index}.png"
        Image.fromarray(panel["mask"].astype(np.uint8) * 255).save(output / filename)
        records.append({"mask": filename, "score": panel["score"]})
    (output / "artwork.json").write_text(json.dumps(records), encoding="utf-8")


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


def coverage_masks(predictor, image, requested, output):
    scope = (0, 0, image.width, image.height)
    hits = predict(predictor, image, [prompt for _, _, prompt in requested], .30)
    records = []
    for index, proposal, prompt in requested:
        anchor = pixel_box(proposal["bbox"], image.size)
        x1, y1, x2, y2 = anchor
        matches = []
        for box, score, mask in hits[prompt]:
            agreement = overlap(anchor, box)
            area = np.count_nonzero(mask)
            if score < .55 or agreement < .25 or np.count_nonzero(mask[y1:y2, x1:x2]) < .70 * area:
                continue
            matches.append((agreement * score, box, score, mask))
        if matches:
            _, box, score, mask = max(matches, key=lambda item: item[0])
            records.append(write_region(output, image.size, scope, [(box, score, mask)], index))
    return records


def detail_proposals(predictor, image, output):
    hits = predict(predictor, image, list(DETAIL_PROMPTS), .66)
    width, height = image.size
    options = []
    for label, kind in DETAIL_PROMPTS.items():
        detections = sorted(hits[label], key=lambda hit: -hit[1])
        for box, score, mask in detections[:3]:
            left, top, right, bottom = (max(0, min(size, round(float(v))))
                                        for v, size in zip(box, (width, height, width, height)))
            ys, xs = np.nonzero(mask[top:bottom, left:right])
            share = len(xs) / (width * height)
            if not .0005 <= share <= .08:
                continue
            closest = np.argmin((xs - (right - left) / 2) ** 2 + (ys - (bottom - top) / 2) ** 2)
            options.append((score, {
                "label": label, "type": kind, "artwork_role": "painted",
                "bbox": [round(v * 1000 / (height if i % 2 else width))
                         for i, v in enumerate((left, top, right, bottom))],
                "point": [round((left + xs[closest]) * 1000 / width), round((top + ys[closest]) * 1000 / height)],
            }))
    records = [record for _, record in sorted(options, key=lambda item: -item[0])]
    (output / "detail-proposals.json").write_text(json.dumps({"regions": records}), encoding="utf-8")


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
    args.output.mkdir(parents=True, exist_ok=True)
    if payload.get("discover_details"):
        predictor = _load_predictor(str(args.model), .30)
        with wired_limit(predictor.model):
            detail_proposals(predictor, image, args.output)
        return
    if payload.get("coverage_pass"):
        records = []
        if requested:
            predictor = _load_predictor(str(args.model), .30)
            with wired_limit(predictor.model):
                records = coverage_masks(predictor, image, requested, args.output)
        (args.output / "regions.json").write_text(json.dumps(records), encoding="utf-8")
        return
    # Broad colour fields sometimes contain a repeated painted motif that
    # Qwen did not name. Only promote a colour-matched group with 2+ cubes.
    colors = {}
    if len(proposals) < 9 and any(re.search(r"\b(?:background|geometric|color fields?)\b", p["label"], re.I) for p in proposals):
        colors = paint_color_masks(crop)
        colors = dict(sorted(colors.items(), key=lambda entry: -np.count_nonzero(entry[1]))[:3])
        colors = {f"{color} cube": mask for color, mask in colors.items() if mask.mean() >= .04}
    crack_count = sum(is_wall_crack(p["label"]) for p in proposals)
    predictor = _load_predictor(str(args.model), .30)
    # Preserve the tested whole-frame concept input. Suppress matches outside
    # the mural scope using their mask, rather than changing the input scale.
    with wired_limit(predictor.model):
        discover = DISCOVERY_PROMPTS if payload.get("region_taxonomy") == REGION_TAXONOMY and len(proposals) <= 5 else {}
        hits = predict(predictor, image, [p for _, _, p in requested] + list(colors) + ARTWORK_PROMPTS + list(discover), .30)
        content = payload.get("preprocessing", {}).get("content_box", [0, 0, image.width, image.height])
        write_artwork_masks(args.output, hits, content)
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
                "id": prompt.replace(" ", "_"), "label": f"Painted {prompt}s",
                "type": "abstract_shape" if payload.get("region_taxonomy") == REGION_TAXONOMY else "symbol",
                "artwork_role": "painted",
                "bbox": bbox, "point": [(bbox[0] + bbox[2]) // 2, (bbox[1] + bbox[3]) // 2],
                "meaning": "Repeated painted geometric motif", "color_rgb": [196, 145, 250],
            }
            records.append(record)

        # Recover independently detected painted elements that the VLM did not
        # propose, especially a separate letter group or a portrait on a second panel.
        retained = np.zeros((bottom - top, right - left), dtype=bool)
        for record in records:
            with Image.open(args.output / record["mask"]) as saved:
                retained |= np.asarray(saved)[top:bottom, left:right] > 0
        next_index = len(proposals) + sum("proposal" in record for record in records)
        for prompt, (label, kind, minimum) in discover.items():
            if next_index >= 9:
                break
            added = 0
            for box, score, mask in hits[prompt]:
                local_mask = mask[top:bottom, left:right]
                area = local_mask.sum()
                if (score < minimum or not .012 < local_mask.mean() < .46 or area < .85 * mask.sum()
                        or (local_mask & retained).sum() > .18 * area
                        or any(overlap(pixel_box(p["bbox"], image.size), box) > .60 for p in proposals if p["type"] == kind)):
                    continue
                record = write_region(args.output, image.size, scope, [(box, score, local_mask)], next_index)
                bbox = [round(value * 1000 / image.size[i % 2]) for i, value in enumerate(box)]
                direction = "left" if bbox[0] + bbox[2] < 1000 else "right"
                record["proposal"] = {
                    "id": prompt.replace(" ", "_") + "_" + direction,
                    "label": f"{label} ({direction})" if kind == "figure" else label,
                    "type": kind, "artwork_role": "painted",
                    "bbox": bbox, "point": [(bbox[0] + bbox[2]) // 2, (bbox[1] + bbox[3]) // 2],
                    "meaning": "", "color_rgb": [139, 152, 239],
                }
                records.append(record)
                retained |= local_mask
                next_index += 1
                added += 1
                if next_index >= 9 or added >= (2 if kind == "figure" else 1):
                    break

        if crack_count == 1:
            support = crack_support(predictor, image, scope)
            Image.fromarray(support.astype(np.uint8) * 255).save(args.output / "crack-support.png")
    (args.output / "regions.json").write_text(json.dumps(records), encoding="utf-8")


if __name__ == "__main__":
    main()
