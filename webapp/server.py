#!/usr/bin/env python3
"""Local web application for the street-art sonification prototype."""

from __future__ import annotations

import asyncio
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageDraw, ImageFilter, ImageStat

from image_preprocessing import ImagePreparationError, prepare_uploaded_image
from region_coverage import (
    DETAIL_TYPES, box_iou, local_detail_candidates, merge_coverage_masks, prepare_coverage_search,
    prepare_detail_search, prepare_figure_context, read_mask, remap_focus_candidates,
)
from region_proposals import (
    ARCHITECTURAL_FEATURE, BARE_SUPPORT, BASE_LAYER_TYPES, FINE_TYPES, PICTURE_LABEL, REGION_TAXONOMY, REGION_TYPES, is_incidental_region,
    normalize_location, proposal_region_type, region_type_guide, set_region_type,
)
from arrangement_review import router as arrangement_review_router
from output_bridge.audio_stream import router as multitrack_router


ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = Path(__file__).resolve().parent
RUNTIME_DIR = WEB_DIR / "runtime"
JOBS_DIR = RUNTIME_DIR / "jobs"
DEMO_IMAGE = ROOT / "inputs" / "the-defiant-one.webp"
DEMO_DIR = ROOT / "outputs" / "interactive-prep" / "the-defiant-one-regions"
QWEN_PYTHON = ROOT / ".interaction-env" / "bin" / "python"
SAM_PYTHON = ROOT / ".venv" / "bin" / "python"
QWEN_MODEL = ROOT / "third_party" / "models" / "Qwen3-VL-2B-Instruct-4bit"
SAM_SCRIPT = WEB_DIR / "analyze_regions.py"
SAM3_MODEL = ROOT / "third_party" / "models" / "SAM3-6bit"
SAM3_SCRIPT = WEB_DIR / "sam3_regions.py"
QWEN35_MODEL = ROOT / "third_party/models/Qwen3.5-9B-4bit"
PROPOSAL_CHECKPOINTS = {
    "qwen3-vl-2b": (QWEN_MODEL, "Qwen3-VL 2B Instruct 4-bit"),
    "qwen3.5-9b": (QWEN35_MODEL, "Qwen3.5 9B 4-bit"),
}
PROPOSAL_MODEL = os.environ.get("STREET_ART_PROPOSAL_MODEL", "qwen3-vl-2b").lower()
if PROPOSAL_MODEL not in PROPOSAL_CHECKPOINTS:
    raise ValueError("STREET_ART_PROPOSAL_MODEL must be qwen3-vl-2b or qwen3.5-9b")
MAX_UPLOAD_BYTES = 16 * 1024 * 1024
TARGET_ARTWORK_INSTRUMENTS = 6
# Up to nine initial proposals plus two from each of three coverage crops.
MAX_REGION_MASKS = 15
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
DEMO_REGION_TYPES = {
    "colored_wall": "painted_ground", "background_lettering": "lettering",
    "left_drips_decay": "paint_texture", "central_figure": "figure", "raised_arm": "figure_part",
    "black_clothing": "depicted_object", "face": "figure_part",
    "sunglasses": "depicted_object", "cigarette_smoke": "depicted_object",
}

RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
JOBS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Street Art Resonance Lab")
app.mount("/static", StaticFiles(directory=WEB_DIR / "static"), name="static")
app.mount("/runtime", StaticFiles(directory=RUNTIME_DIR), name="runtime")
app.include_router(arrangement_review_router)
app.include_router(multitrack_router)

jobs: dict[str, dict[str, Any]] = {}
analysis_lock = asyncio.Lock()


def demo_payload() -> dict[str, Any]:
    manifest = json.loads((DEMO_DIR / "regions.json").read_text(encoding="utf-8"))
    manifest["analysis_id"] = "demo"
    manifest["image_url"] = "/assets/demo/image"
    manifest["status"] = "ready"
    manifest["region_taxonomy"] = REGION_TAXONOMY
    for region in manifest["regions"]:
        set_region_type(region, DEMO_REGION_TYPES[region["id"]])
        region["visual_mask_url"] = f"/assets/demo/{region['visual_mask']}"
        region["hit_mask_url"] = f"/assets/demo/{region['hit_mask']}"
        region.pop("label_zh", None)
    return manifest


def extract_json(text: str) -> dict[str, Any]:
    """Return the first complete region object from a model response.

    Local vision models occasionally add a second JSON object, a short note,
    or Markdown fences after the requested payload. ``json.loads`` rejects
    that otherwise usable response as ``Extra data``. ``raw_decode`` stops at
    the end of the first complete value, so scan each opening brace and keep
    the first object that contains the expected regions array.
    """
    decoder = json.JSONDecoder()
    decoded_objects: list[dict[str, Any]] = []
    region_objects: list[dict[str, Any]] = []
    for match in re.finditer(r"[\{\[]", text):
        try:
            value, _ = decoder.raw_decode(text[match.start():])
        except json.JSONDecodeError:
            continue
        if isinstance(value, list) and value and all(isinstance(item, dict) for item in value):
            region_objects.append({"regions": value})
            continue
        if not isinstance(value, dict):
            continue
        if isinstance(value.get("regions"), list):
            region_objects.append(value)
            continue
        decoded_objects.append(value)
    recovered = [
        value for value in decoded_objects
        if ("label" in value and "type" in value
            and normalize_location(value, thin=True) is not None)
    ]
    if region_objects:
        def proposal_score(value: dict[str, Any]) -> tuple[int, int, int]:
            regions = value.get("regions", [])
            boxes = {
                tuple(location["bbox"])
                for item in regions
                if isinstance(item, dict)
                if (location := normalize_location(item, thin=True)) is not None
            }
            # A repeated box should never make an alternative response rank
            # higher, and the containing object may also carry statement colors.
            return len(boxes), len(value), len(regions)

        best = max(region_objects, key=proposal_score)
        if not recovered or proposal_score(best)[0]:
            return best
    # A token cutoff can leave the outer object open. Keep complete entries
    # whose geometry can still be validated instead of discarding the pass.
    if recovered:
        return {"regions": recovered}
    if decoded_objects:
        return decoded_objects[0]
    raise ValueError("The vision model did not return valid JSON")


def slug(value: str, fallback: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return value[:40] or fallback


def normalize_proposals(raw: dict[str, Any], *, coverage: bool = False) -> list[dict[str, Any]]:
    proposals: list[dict[str, Any]] = []
    seen_boxes: list[list[int]] = []
    colors = [
        [245, 192, 54], [232, 82, 120], [57, 195, 178], [84, 134, 247],
        [164, 102, 245], [32, 170, 228], [247, 142, 43], [233, 70, 67],
        [126, 211, 33], [22, 184, 213],
    ]
    raw_regions = raw.get("regions")
    if not isinstance(raw_regions, list):
        return proposals
    for index, item in enumerate(raw_regions):
        if not isinstance(item, dict):
            continue
        label_hint = str(item.get("label") or item.get("region") or "")
        artwork_role = str(item.get("artwork_role") or "").strip().lower()
        raw_type = str(item.get("type") or "").strip().lower()
        if artwork_role == "integrated_material" and raw_type not in {"exposed_support", "wall", "texture"}:
            artwork_role = "painted"
        if ((PICTURE_LABEL.fullmatch(label_hint.strip()) and raw_type != "lettering")
                or is_incidental_region(label_hint, artwork_role)):
            continue
        if artwork_role == "integrated_material" and re.fullmatch(
            r"(?:the )?(?:building|house|facade|façade)", label_hint.strip(), re.I,
        ):
            continue
        if artwork_role != "integrated_material" and (
            BARE_SUPPORT.fullmatch(label_hint.strip()) or ARCHITECTURAL_FEATURE.fullmatch(label_hint.strip())
        ):
            continue
        region_type = proposal_region_type(raw_type, label_hint, artwork_role)
        if region_type is None:
            continue
        label_type = label_hint.strip().lower().replace(" ", "_")
        if label_type in REGION_TYPES.keys() - {"lettering", "painted_ground"} and not coverage:
            continue
        if (label_hint.strip().lower() in {"main painted subject", "graphic shapes or lettering", "main subject"}
                or re.fullmatch(r"(?:symbol|detail|shape|object|motif|region)[ _-]*\d*", label_hint.strip(), re.I)):
            continue
        if region_type in BASE_LAYER_TYPES and re.fullmatch(r"painted (?:windows?|doors?)", label_hint.strip(), re.I):
            continue
        thin = region_type in FINE_TYPES
        location = normalize_location(item, thin=thin)
        if location is None:
            continue
        box = location["bbox"]
        # Different abstract labels on the same rectangle are not different
        # playable regions. Remove near-identical proposals before SAM.
        def overlap(a: list[int], b: list[int]) -> float:
            ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
            iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
            intersection = ix * iy
            union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - intersection
            return intersection / union if union else 0
        parts = []
        raw_parts = item.get("parts")
        if isinstance(raw_parts, list):
            for raw_part in raw_parts[:8]:
                part = normalize_location(raw_part, thin=thin) if isinstance(raw_part, dict) else None
                if part and all(overlap(part["bbox"], other) <= .8 for other in [box, *[p["bbox"] for p in parts]]):
                    parts.append(part)
                if len(parts) == 3:
                    break
        region_name = str(item.get("region") or "").strip()
        label = str(item.get("label") or region_name or f"Region {index + 1}").strip()[:48]
        if coverage and label_type in REGION_TYPES and label_type == region_type:
            # A local proposal is provisional until the separated mask has
            # been reviewed. Generic names like "figure" can locate a real
            # omitted subject even when Qwen supplies no more specific name.
            label = REGION_TYPES[label_type][0]
        generic_labels = {
            "main painted figure or largest focal object",
            "face or focal internal detail",
            "gesture, hand, accessory or held object",
            "one actual painted lettering or glyph cluster",
            "a second different painted mark or color field",
            "exposed wall/material region",
            "paint drip, crack, weathering or spray texture",
            "another small distinctive painted symbol or detail",
            "one additional concrete painted object, mark, or material feature when clearly visible",
            "short english label",
        }
        meaning = str(item.get("meaning") or "").strip()
        if label.lower() in generic_labels:
            if region_name:
                label = region_name
            elif meaning:
                # Small local VLMs occasionally copy a schema placeholder even
                # when asked for a concrete label. The interpretation is still
                # image-specific, so use its opening phrase as the visible name.
                label = re.sub(r"^(the|a|an)\s+", "", meaning, flags=re.IGNORECASE)
                label = re.split(r"[,;]", label, maxsplit=1)[0].strip()[:48]
        raw_id = str(item.get("id") or "").strip()
        if raw_id.lower() in {"snake_case", "region_id", "id"} or raw_id.isdigit():
            raw_id = ""
        region_id = slug(raw_id or region_name or label, f"region_{index + 1}")
        same_feature = next((
            proposal for proposal in proposals
            if proposal["id"] == region_id
            and proposal["type"] == region_type
            and proposal["label"].casefold() == label.casefold()
        ), None)
        if same_feature is not None:
            locations = same_feature.setdefault("parts", [])
            for candidate in [location, *parts]:
                if len(locations) >= 3:
                    break
                if all(overlap(candidate["bbox"], other["bbox"]) <= .5 for other in [same_feature, *locations]):
                    locations.append(candidate)
            continue
        if len(proposals) == 9 or (any(overlap(box, previous) > .92 for previous in seen_boxes) and not parts):
            continue
        seen_boxes.append(box)
        proposals.append({
            "id": region_id,
            "label": label,
            "type": region_type,
            **({"artwork_role": artwork_role} if artwork_role in {"painted", "integrated_material"} else {}),
            **location,
            **({"parts": parts} if parts else {}),
            "meaning": meaning[:180],
            "color_rgb": colors[len(proposals) % len(colors)],
        })

    return proposals


def normalize_artwork(raw: dict[str, Any], preprocessing: dict[str, Any]) -> dict[str, Any]:
    """Normalize the model's conservative whole-artwork framing proposal."""
    width = preprocessing["prepared_size"]["width"]
    height = preprocessing["prepared_size"]["height"]
    cx1, cy1, cx2, cy2 = preprocessing["content_box"]
    content_box = [
        round(cx1 / width * 1000), round(cy1 / height * 1000),
        round(cx2 / width * 1000), round(cy2 / height * 1000),
    ]
    item = raw.get("artwork") if isinstance(raw.get("artwork"), dict) else {}
    try:
        box = [max(0, min(1000, int(float(value)))) for value in item.get("bbox", content_box)[:4]]
        point = [max(0, min(1000, int(float(value)))) for value in item.get("point", [500, 500])[:2]]
        if len(box) != 4 or len(point) != 2 or box[2] <= box[0] or box[3] <= box[1]:
            raise ValueError
    except (TypeError, ValueError):
        box = content_box
        point = [(content_box[0] + content_box[2]) // 2, (content_box[1] + content_box[3]) // 2]
    try:
        confidence = max(0.0, min(1.0, float(item.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0.0
    return {
        "full_frame": bool(item.get("full_frame", True)),
        "confidence": round(confidence, 4),
        "bbox": box,
        "point": point,
    }


def extract_first_object(text: str) -> dict[str, Any]:
    decoder = json.JSONDecoder()
    for match in re.finditer(r"\{", text):
        try:
            value, _ = decoder.raw_decode(text[match.start():])
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value
    raise ValueError("The vision model did not return a JSON object")


ARTWORK_REGION_SCOPE = (
    "Find up to 9 distinct visible elements, aiming for 4 or more only when well supported. "
    "Name the visible thing before classifying it. A whole mural or panel is not a region. "
    "Importance, size, color and repetition do not change the type. "
    "Exclude surrounding buildings, bare brick, mortar joints, physical cracks and incidental wear. "
    "Exclude real doors and windows unless painted forms visually incorporate them. If a window or door is itself an illustration, "
    "call it a painted window or painted door. "
    "The artwork_role field has only two values: painted (default) or integrated_material "
    "(unpainted substrate or architectural feature intentionally used in the design)."
)
STATEMENT_COLORS_GUIDE = (
    "statement_colors is an array of objects with name (copy exact color words from the statement) "
    "and emphasis (true only when the statement explicitly prioritizes that color). "
    "Use [] if the statement gives no color."
)


def qwen_prompt(statement: str) -> str:
    context = statement.strip() or "No artist statement was supplied. Infer only visually evident content."
    return f"""Analyze this completed street-art image as material for an accessible interactive sound artwork.
Artist statement: {context[:1200]}
Return ONLY valid JSON, no markdown. Use this schema:
The top-level keys are regions and statement_colors. Each region has id, label, type, artwork_role, bbox, point, and meaning. {STATEMENT_COLORS_GUIDE}
Create a unique concrete id, visible English label, and one single type for every detected region. Never use placeholders or pipe-separated lists.
Use these region types:
{region_type_guide()}
Coordinates are normalized integers 0-1000. A bbox is [left,top,right,bottom]; a point is [x,y]. {ARTWORK_REGION_SCOPE}
Every label must name what is visibly there (for example "woman with sunglasses", "black upper-left glyphs", "yellow wall field"), never only an abstract word such as "color", "texture", "detail" or "symbol". Use at most one box covering more than 60% of the image. All other boxes must tightly surround different visible shapes. Nested details are allowed, but duplicate boxes are forbidden. Each point must be well inside the intended painted shape, not on a box edge or empty background. Keep meaning under 12 words and connect the visible mark to a tactile or sonic quality.
If the statement highlights a specific painted element, include it if you can visibly locate it. Do not infer BPM, key, mode, instruments, or emotions."""


def needs_gems_retry(raw: dict[str, Any]) -> bool:
    profile = raw.get("gems_profile")
    if not isinstance(profile, dict):
        return True
    for source in ("image", "statement"):
        item = profile.get(source)
        if not isinstance(item, dict):
            return True
        evidence = str(item.get("evidence", "")).strip().lower().rstrip(".")
        if evidence in ("", "visible evidence only", "statement evidence only", "one short explanation"):
            return True
        weights = item.get("weights")
        if not isinstance(weights, dict) or any(
            not isinstance(weights.get(name), (int, float)) or isinstance(weights.get(name), bool)
            or not math.isfinite(weights[name]) or not 0 <= weights[name] <= 1
            for name in GEMS_DIMENSIONS
        ):
            return True
        if sum(weights[name] for name in GEMS_DIMENSIONS) <= 0:
            return True
    return False


def qwen_gems_retry_prompt(statement: str) -> str:
    return f"""Estimate the GEMS-9 expressive qualities of this artwork and its Artist Statement separately.
Score order: wonder, transcendence, tenderness, nostalgia, peacefulness, power, joyful_activation, tension, sadness.
Wonder means awe; transcendence inspiration; tenderness affection; nostalgia memory; peacefulness calm; power strength; joyful_activation lively joy; tension unease; sadness sorrow.
Artist Statement: {statement[:1200]}
Return ONLY a JSON object with four keys: image_scores (an array of exactly nine numbers), image_evidence (one sentence naming visible features), statement_scores (an array of exactly nine numbers), statement_evidence (one sentence quoting or paraphrasing the statement).
For EACH array, allocate a total of 100 emotion points across the nine categories. These are relative emotional emphases, NOT your confidence or image recognition accuracy. Give zero or very few points to emotions with no supporting evidence; competing emotions cannot all have high points. The nine numbers in each array must sum to 100. Judge image_scores from the image only and statement_scores from the text only. Calculate the points for this input. Do not output a format example, placeholder sentences, music settings, or region boxes."""


def parse_gems_retry(value: dict[str, Any]) -> dict[str, Any]:
    result = {}
    for source in ("image", "statement"):
        scores = value.get(f"{source}_scores")
        if not isinstance(scores, list) or len(scores) != len(GEMS_DIMENSIONS):
            raise ValueError("Expected nine GEMS scores per source")
        if any(not isinstance(score, (int, float)) or isinstance(score, bool)
               or not math.isfinite(score) or score < 0 for score in scores):
            raise ValueError("GEMS scores must be nonnegative finite numbers")
        total = sum(scores)
        if total <= 0:
            raise ValueError("GEMS scores must contain positive emotional emphasis")
        # Accept fractional weights as well as the explicitly requested points,
        # then preserve their relative emphasis in a normalized distribution.
        scores = [score / total for score in scores]
        result[source] = {
            "weights": dict(zip(GEMS_DIMENSIONS, scores)),
            "evidence": value.get(f"{source}_evidence", ""),
        }
    if needs_gems_retry({"gems_profile": result}):
        raise ValueError("GEMS output contains placeholders or invalid weights")
    return result


def qwen_regions_retry_prompt(statement: str) -> str:
    return f"""Identify distinct regions in this street-art image. Start with the main painted subject, graphic shapes or lettering. Include major painted grounds. Exclude physical building fixtures and surroundings.
Artist statement: {statement[:600] or "None"}
Return a JSON object with a regions array of up to nine elements. Each item has a short English label, one type, and bbox and point. Bbox has exactly four normalized integers [left,top,right,bottom]. Point has exactly two normalized integers [x,y] well inside the shape. Coordinates are 0 to 1000. Keep entries unique.
{region_type_guide()}
{STATEMENT_COLORS_GUIDE}"""


def qwen_recovery_prompt() -> str:
    return """Locate visible painted motifs and broad painted color fields in this mural. Include letter groups, recognizable objects and bounded abstract shapes when present. Name the actual painted element and ignore architecture or scenery.
Return only a JSON object with a regions array. Each region has an English label, type, bbox [left,top,right,bottom], and point [x,y]. All coordinates are integers from 0 to 1000. Use up to six regions. Types: figure, figure_part, depicted_object, lettering, graphic_line, abstract_shape, painted_ground, paint_texture."""


def qwen_coverage_prompt(existing_types: set[str] | None = None) -> str:
    guidance = ""
    if existing_types is not None:
        guidance = (
            f"Already represented types: {', '.join(sorted(existing_types)) or 'none'}. "
            f"Types to look for: {', '.join(sorted(REGION_TYPES.keys() - existing_types))}. "
            "Prefer a visible feature of a missing type when present. Look for separate symbols, shaped "
            "details or paint textures. Keep the correct type for a real feature even if it already exists. "
            "Exclude real holes and cracks. Do not subdivide a field or a letter group to produce more features.\n"
        )
    return f"""Find up to 2 painted features in this close-up of a mural. Read the full-color area from left to right, including the sides. Gray faded areas are context; leave them out.
Describe the visible thing first. Look for distinct graffiti lettering, painted objects, bounded shapes or a broad painted field. Group connected marks that form a single feature. Do not name a cropped fragment of a faded feature, an entire mural, architecture, wall damage or shadows. Return an empty array if no independent painted feature is visible.
{guidance}Types:
{region_type_guide()}
Return compact JSON with one "regions" array. Each entry has a concrete "label", one "type", a tight "bbox" [left,top,right,bottom], and an interior "point" [x,y]. All coordinates are integers 0–1000 relative to this close-up. Do not repeat any entry. For a broad field use its color in the label or say multicolored."""


def qwen_parts_prompt(proposals: list[dict]) -> str:
    regions = [{key: proposal[key] for key in ("id", "label", "bbox")} for proposal in proposals]
    return f"""Locate additional visible patches of the SAME named feature belonging to the artwork. Exclude unrelated wall wear, mortar joints and scenery.
Known regions, with the first patch already located: {json.dumps(regions, ensure_ascii=False)}
Return a JSON object with a "regions" array. Each entry has an existing id and "parts", an array of up to three objects with bbox [x1,y1,x2,y2] and point [x,y]. Use normalized integer coordinates 0 to 1000 relative to the entire image. Each box must tightly enclose a separate visible patch of the same feature and each point must be inside it. Do not include the existing box, unrelated marks, or parts you are unsure about. Return an empty regions array if there are no additional visible patches."""


def save_region_review(result_dir: Path, manifest: dict[str, Any], filename: str) -> Path:
    with Image.open(result_dir / manifest["processed_image"]) as source:
        artwork = Image.new("RGB", source.size, "#dedbd4")
        rgba = source.convert("RGBA")
        artwork.paste(rgba, mask=rgba.getchannel("A"))
    regions = manifest["regions"]
    tile_size = 220
    overview = artwork.copy()
    overview.thumbnail((tile_size * 3, 320))
    sheet = Image.new("RGB", (tile_size * 3, overview.height + (tile_size + 24) * ((len(regions) + 2) // 3)), "#f5f3ec")
    sheet.paste(overview, ((sheet.width - overview.width) // 2, 0))
    draw = ImageDraw.Draw(sheet)
    dimmed = Image.blend(artwork, Image.new("RGB", artwork.size, "#dedbd4"), .8)
    for index, region in enumerate(regions):
        with Image.open(result_dir / region["visual_mask"]) as image:
            mask = image.convert("L")
        bounds = mask.getbbox()
        if bounds is None:
            continue
        x1, y1, x2, y2 = bounds
        padding = max(12, round(max(x2 - x1, y2 - y1) * .12))
        box = (max(0, x1 - padding), max(0, y1 - padding),
               min(artwork.width, x2 + padding), min(artwork.height, y2 + padding))
        tile = Image.composite(artwork.crop(box), dimmed.crop(box), mask.crop(box))
        tile.thumbnail((tile_size - 10, tile_size - 10))
        x = index % 3 * tile_size
        y = overview.height + index // 3 * (tile_size + 24)
        draw.text((x + 8, y + 6), str(index + 1), fill="#252320")
        sheet.paste(tile, (x + (tile_size - tile.width) // 2, y + 24))
    path = result_dir.parent / filename
    sheet.save(path)
    return path


def qwen_region_review_prompt(regions: list[dict], *, local_details: bool = False) -> str:
    hints = [{"tile": index, "candidate": region["label"], "type": region["type"]} for index, region in enumerate(regions, 1)]
    detail_rule = (
        " For this detail pass mark the tile uncertain if it mainly shows a different feature from the label, "
        "only an arbitrary fragment of the named feature, or mixes it with a large part of its surroundings."
        if local_details else ""
    )
    return f"""Check the types of already segmented street-art regions. The first large image is the whole artwork for context. The numbered tiles beneath it show the actual masks in full color, with surrounding pixels faded. Classify the full-color pixels only and use the whole image to tell what they belong to. Candidate names, which can be inaccurate: {json.dumps(hints)}
Use exactly one of these nine labels per tile:
{region_type_guide()}
Rules: a painted geometric block or cube is abstract_shape, even with 3D shading. Broad colored wall paint behind figures is painted_ground. A real window or ordinary bare wall is uncertain unless it was deliberately incorporated as exposed_support. Depicted_object means a named real-world subject pictured in paint, e.g. a key or flower. A standalone portrait is figure; a separately masked eye or hand is figure_part. Check each tile independently.
Return only JSON with a "regions" array. Each object has the "tile" number, "type", and short "evidence" naming the visible feature. Use "uncertain" as the type when the visible evidence is insufficient. Do not change the masks or merge tiles.{detail_rule}"""


def apply_region_review(regions: list[dict], result: dict[str, Any]) -> None:
    items = result.get("regions")
    if not isinstance(items, list):
        return
    votes: dict[int, dict[str, dict]] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        number, kind = item.get("tile"), item.get("type")
        if type(number) is int and 1 <= number <= len(regions) and isinstance(kind, str):
            votes.setdefault(number, {})[kind.strip().lower()] = item
    for number, choices in votes.items():
        if len(choices) != 1:
            continue
        kind = next(iter(choices))
        item = choices[kind]
        evidence = str(item.get("evidence") or "").strip()
        region = regions[number - 1]
        if kind not in REGION_TYPES:
            continue
        kind = proposal_region_type(kind, region["label"], region.get("artwork_role", ""))
        if kind is None:
            continue
        if kind != region["type"]:
            if kind in BASE_LAYER_TYPES or region["type"] in BASE_LAYER_TYPES:
                continue  # The layer determines ownership before the tiles are generated.
            if len(evidence.split()) < 3:
                continue
        set_region_type(region, kind)
        region["category_source"] = "mask_review"
        if evidence:
            region["category_evidence"] = evidence


def normalize_music_plan(raw: dict[str, Any]) -> dict[str, Any]:
    item = raw.get("music_plan") if isinstance(raw.get("music_plan"), dict) else {}
    valid_modes = {"major", "minor", "dorian", "phrygian", "mixolydian", "minorPentatonic"}
    root = str(item.get("root", "D")).strip().upper().replace("♯", "#")
    if root not in {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}:
        root = "D"
    mode = str(item.get("mode", "dorian")).strip()
    if mode not in valid_modes:
        mode = "dorian"
    try:
        bpm = max(40, min(180, round(float(item.get("bpm", 72)))))
    except (TypeError, ValueError):
        bpm = 72
    return {
        "bpm": bpm,
        "root": root,
        "mode": mode,
        "meter": "4/4",
    }


GEMS_DIMENSIONS = (
    "wonder", "transcendence", "tenderness", "nostalgia", "peacefulness",
    "power", "joyful_activation", "tension", "sadness",
)
DEFAULT_GEMS_WEIGHTS = {
    "wonder": 0.12,
    "transcendence": 0.08,
    "tenderness": 0.10,
    "nostalgia": 0.10,
    "peacefulness": 0.20,
    "power": 0.10,
    "joyful_activation": 0.12,
    "tension": 0.10,
    "sadness": 0.08,
}


def normalize_gems_weights(value: Any) -> dict[str, float]:
    source = value if isinstance(value, dict) else {}
    values: dict[str, float] = {}
    for name in GEMS_DIMENSIONS:
        try:
            values[name] = max(0.0, min(1.0, float(source.get(name, 0))))
        except (TypeError, ValueError):
            values[name] = 0.0
    total = sum(values.values())
    if total <= 0:
        values = dict(DEFAULT_GEMS_WEIGHTS)
        total = sum(values.values())
    return {name: round(values[name] / total, 6) for name in GEMS_DIMENSIONS}


def normalize_gems_profile(raw: dict[str, Any]) -> dict[str, Any]:
    item = raw.get("gems_profile") if isinstance(raw.get("gems_profile"), dict) else {}
    image_item = item.get("image") if isinstance(item.get("image"), dict) else {}
    statement_item = item.get("statement") if isinstance(item.get("statement"), dict) else {}
    image_weights = normalize_gems_weights(image_item.get("weights"))
    statement_weights = normalize_gems_weights(statement_item.get("weights"))
    image_share = 0.45
    statement_share = 0.55
    combined = normalize_gems_weights({
        name: image_weights[name] * image_share + statement_weights[name] * statement_share
        for name in GEMS_DIMENSIONS
    })
    ranked = sorted(GEMS_DIMENSIONS, key=lambda name: combined[name], reverse=True)
    higher_order = {
        "sublimity": round(sum(combined[name] for name in (
            "wonder", "transcendence", "tenderness", "nostalgia", "peacefulness",
        )), 6),
        "vitality": round(combined["power"] + combined["joyful_activation"], 6),
        "unease": round(combined["tension"] + combined["sadness"], 6),
    }

    def evidence(source: dict[str, Any], fallback: str) -> str:
        text = str(source.get("evidence", "")).strip()
        return (text or fallback)[:320]

    rationale = str(item.get("combined_rationale", "")).strip()
    return {
        "framework": "GEMS-9",
        "weights": combined,
        "dominant": ranked[0],
        "secondary": ranked[1],
        "higher_order": higher_order,
        "image": {
            "weights": image_weights,
            "evidence": evidence(image_item, "GEMS-9 estimate based on visible artwork features."),
        },
        "statement": {
            "weights": statement_weights,
            "evidence": evidence(statement_item, "GEMS-9 estimate based on the Artist Statement."),
        },
        "combination": {"image": image_share, "statement": statement_share},
        "rationale": (rationale or "Image and statement GEMS-9 profiles were combined deterministically.")[:320],
        "source": "qwen3-vl-separate-image-and-statement-gems9",
    }


def derive_music_plan(
    gems: dict[str, Any], artwork_path: Path, statement: str,
) -> dict[str, Any]:
    """Derive varied but repeatable harmony settings from the finished artwork.

    Qwen estimates a complete GEMS-9 profile without selecting music settings.
    Tempo and mode follow a deterministic GEMS mapping plus visual energy, and
    the tonic comes from a stable artwork-and-statement fingerprint.
    """
    with Image.open(artwork_path) as opened:
        sample = opened.convert("RGB")
        sample.thumbnail((128, 128), Image.Resampling.LANCZOS)
    grayscale = sample.convert("L")
    luminance = ImageStat.Stat(grayscale)
    brightness = max(0.0, min(1.0, luminance.mean[0] / 255.0))
    contrast = max(0.0, min(1.0, luminance.stddev[0] / 72.0))
    saturation = max(0.0, min(1.0, ImageStat.Stat(sample.convert("HSV")).mean[1] / 255.0))
    edged = grayscale.filter(ImageFilter.FIND_EDGES)
    if edged.width > 2 and edged.height > 2:
        edged = edged.crop((1, 1, edged.width - 1, edged.height - 1))
    edge_energy = max(0.0, min(1.0, ImageStat.Stat(edged).mean[0] / 64.0))

    weights = normalize_gems_weights(gems.get("weights"))
    activation = sum(weights[name] * coefficient for name, coefficient in {
        "wonder": 0.62,
        "transcendence": 0.45,
        "tenderness": 0.25,
        "nostalgia": 0.32,
        "peacefulness": 0.15,
        "power": 0.90,
        "joyful_activation": 0.98,
        "tension": 0.85,
        "sadness": 0.20,
    }.items())
    raw_bpm = (
        52 + activation * 88 + contrast * 12 + edge_energy * 16 + saturation * 5
    )
    bpm = int(max(52, min(168, round(raw_bpm / 2) * 2)))

    mode_scores = {
        "major": weights["wonder"] + weights["tenderness"] + weights["peacefulness"],
        "dorian": weights["transcendence"] + weights["nostalgia"],
        "mixolydian": weights["power"] + weights["joyful_activation"],
        "phrygian": weights["tension"],
        "minor": weights["sadness"],
    }
    mode = max(mode_scores, key=mode_scores.get)

    fingerprint = hashlib.sha256()
    fingerprint.update(sample.tobytes())
    fingerprint.update(statement.strip().lower().encode("utf-8"))
    roots = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    root = roots[fingerprint.digest()[0] % len(roots)]
    return {
        "bpm": bpm,
        "root": root,
        "mode": mode,
        "meter": "4/4",
        "source": "derived-from-artwork-statement-and-gems9",
        "gems_dominant": gems.get("dominant", "peacefulness"),
        "features": {
            "brightness": round(brightness, 4),
            "saturation": round(saturation, 4),
            "contrast": round(contrast, 4),
            "edge_energy": round(edge_energy, 4),
        },
    }


def qwen_artwork_prompt(preprocessing: dict[str, Any]) -> str:
    width = preprocessing["prepared_size"]["width"]
    height = preprocessing["prepared_size"]["height"]
    x1, y1, x2, y2 = preprocessing["content_box"]
    content_box = [
        round(x1 / width * 1000), round(y1 / height * 1000),
        round(x2 / width * 1000), round(y2 / height * 1000),
    ]
    return f"""Find the outer boundary of the complete street-art work in this photograph.
The real photograph occupies normalized rectangle {content_box}. Ignore any padding outside it.
Return only one JSON object with four fields: full_frame, confidence, bbox, and point.
Set full_frame to true and bbox to the complete photograph rectangle whenever the photograph is already entirely street art, wall texture belongs to the work, the painted parts are disconnected, or the boundary is uncertain. Set full_frame to false only when a clearly bounded mural or graffiti work has unrelated scenery around it. The bbox must include every painted part, lettering, and relevant wall surface. Point must be exactly two numbers inside the work. Confidence is from 0 to 1."""


async def run_command(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    return await asyncio.to_thread(
        subprocess.run,
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )


async def review_region_categories(
    result_dir: Path, manifest: dict[str, Any], log: Path, *, local_details: bool = False,
) -> None:
    if not manifest["regions"]:
        return
    try:
        filename = log.name.replace("-output.txt", ".png")
        review_path = await asyncio.to_thread(save_region_review, result_dir, manifest, filename)
        review = await run_command([
            str(QWEN_PYTHON), "-m", "mlx_vlm.generate",
            "--model", str(QWEN_MODEL), "--image", str(review_path),
            "--prompt", qwen_region_review_prompt(manifest["regions"], local_details=local_details),
            "--max-tokens", "740" if local_details else "550",
            "--temperature", "0", "--no-verbose",
        ], timeout=100)
        log.write_text(review.stdout, encoding="utf-8")
        if review.returncode == 0:
            apply_region_review(manifest["regions"], extract_json(review.stdout))
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass  # An unsuccessful review leaves the proposal categories intact.


async def find_sam3_coverage(canvas: Path, proposal_path: Path, output: Path) -> bool:
    if not (SAM3_MODEL / "model.safetensors").is_file():
        return False
    try:
        semantic = await run_command([
            str(QWEN_PYTHON), str(SAM3_SCRIPT), "--image", str(canvas),
            "--proposals", str(proposal_path), "--model", str(SAM3_MODEL), "--output", str(output),
        ], timeout=90)
        if semantic.returncode:
            output.with_name(f"{output.name}-error.log").write_text(semantic.stderr, encoding="utf-8")
        return semantic.returncode == 0 and (output / "regions.json").is_file()
    except (OSError, subprocess.TimeoutExpired):
        return False


async def recover_region_coverage(
    result_dir: Path, manifest: dict[str, Any], job: dict[str, Any],
) -> tuple[Path, dict[str, Any]]:
    work_dir = result_dir.parent
    existing_types = {region["type"] for region in manifest["regions"]}
    seeking_instruments = len({REGION_TYPES[kind][1] for kind in existing_types}) < TARGET_ARTWORK_INSTRUMENTS
    search = await asyncio.to_thread(
        prepare_coverage_search, result_dir, manifest, work_dir, include_large_masks=seeking_instruments,
    )
    if search is None:
        return result_dir, manifest

    canvas, target, crops = search
    proposals = []
    for index, (crop, box) in enumerate(crops, 1):
        job.update(message=f"Checking painted area {index} of {len(crops)}…", progress=70 + 3 * index)
        try:
            focused = await run_command([
                str(QWEN_PYTHON), "-m", "mlx_vlm.generate",
                "--model", str(QWEN_MODEL), "--image", str(crop),
                "--prompt", qwen_coverage_prompt(existing_types if seeking_instruments else None), "--max-tokens", "380",
                "--temperature", "0.15", "--seed", "31", "--repetition-penalty", "1.08", "--no-verbose",
            ], timeout=70)
            (work_dir / f"coverage-focus-{index}.txt").write_text(focused.stdout, encoding="utf-8")
            if focused.returncode == 0:
                candidates = normalize_proposals(extract_json(focused.stdout), coverage=True)
                proposals.extend(remap_focus_candidates(candidates, box, target)[:2])
        except (ValueError, subprocess.TimeoutExpired):
            continue
    if seeking_instruments and not any(
        item["type"] == "depicted_object" for item in [*manifest["regions"], *proposals]
    ):
        context = await asyncio.to_thread(prepare_figure_context, result_dir, manifest, canvas)
        if context is not None:
            crop, box = context
            job.update(message="Checking for smaller painted objects near the main figure…", progress=80)
            try:
                detail = await run_command([
                    str(QWEN_PYTHON), "-m", "mlx_vlm.generate", "--model", str(QWEN_MODEL), "--image", str(crop),
                    "--prompt", "Which small illustrated objects or standalone decorative shapes can you see? "
                    "Look for items held by a painted person. Exclude whole people, lettering on the wall and broad "
                    "background colors. Give 1 to 3 specific English names and tight locations, or [] when none. "
                    "JSON array only. Each entry has label and bbox. bbox is [left, top, right, bottom], each coordinate "
                    "is an integer from 0 to 1000 in this image.",
                    "--max-tokens", "270", "--temperature", "0", "--no-verbose",
                ], timeout=70)
                (work_dir / "coverage-figure-context.txt").write_text(detail.stdout, encoding="utf-8")
                if detail.returncode == 0:
                    objects = [{**item, "type": "depicted_object"} for item in extract_json(detail.stdout).get("regions", [])
                               if isinstance(item, dict)]
                    candidates = normalize_proposals({"regions": objects}, coverage=True)
                    proposals.extend(remap_focus_candidates(candidates, box, target)[:2])
            except (ValueError, subprocess.TimeoutExpired):
                pass  # A focused read is optional; keep the coverage candidates.
    # Reuse the same location and label checks after converting crop coordinates.
    proposals = normalize_proposals({"regions": proposals}, coverage=True)
    if not proposals:
        return result_dir, manifest

    existing_ids = {region["id"] for region in manifest["regions"]}
    for proposal in proposals:
        identifier = "coverage_" + proposal["id"]
        while identifier in existing_ids:
            identifier += "_extra"
        proposal["id"] = identifier
        existing_ids.add(identifier)
    proposal_path = work_dir / "coverage-proposals.json"
    proposal_path.write_text(json.dumps({
        "regions": proposals,
        "region_taxonomy": REGION_TAXONOMY,
        "coverage_pass": True,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    extra_dir = work_dir / "result-supplemented"
    job.update(message="Tracing newly found shapes…", progress=82)
    sam3_dir = work_dir / "coverage-sam3"
    sam3_args = ["--sam3", str(sam3_dir)] if await find_sam3_coverage(canvas, proposal_path, sam3_dir) else []
    extra = await run_command([
        str(SAM_PYTHON), str(SAM_SCRIPT), "--image", str(canvas),
        "--proposals", str(proposal_path), "--output", str(extra_dir), *sam3_args,
    ], timeout=130)
    if extra.returncode:
        (work_dir / "coverage-error.log").write_text(extra.stderr, encoding="utf-8")
        return result_dir, manifest
    found = json.loads((extra_dir / "regions.json").read_text(encoding="utf-8"))
    job.update(message="Verifying the new region masks…", progress=87)
    await review_region_categories(extra_dir, found, work_dir / "coverage-review-output.txt")
    refined, report = await asyncio.to_thread(
        merge_coverage_masks, manifest, result_dir, found, extra_dir, target,
        limit=MAX_REGION_MASKS, split_large_masks=seeking_instruments,
    )
    (work_dir / "coverage-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return (extra_dir, refined) if report["accepted_labels"] else (result_dir, manifest)


def detail_search_prompt() -> str:
    categories = "\n".join(line for line in region_type_guide().splitlines() if line.split(":")[0] in DETAIL_TYPES)
    return f"""Find up to three small, separate, intentionally painted features visible in this crop of a street artwork.
Look inside and around it for a held or worn item, a distinct painted emblem or geometric symbol, or a visible, separable body part.
Skip whole people, lettering, broad paint fields, ordinary wall cracks, arbitrary fragments, and highlights or outlines attached to lettering. A separate repeated symbol is allowed if it is clearly visible. Each box should take up less than a quarter of the crop area.
Give each feature a tight bounding box and put a point inside its painted pixels. If a neighboring shape touches it, give an optional exclude point just outside the feature. Coordinates are integers from 0 to 1000 in this crop, in x,y order.
Return JSON only: {{"regions":[{{"label":"concrete name","type":"category","artwork_role":"painted","bbox":[left,top,right,bottom],"point":[x,y],"exclude":[[x,y]]}}]}}.
Use an empty array when there are no clear new features.
{categories}"""


async def find_painted_motifs(canvas: Path, work_dir: Path) -> list[dict]:
    settings = work_dir / "detail-discovery.json"
    settings.write_text('{"regions": [], "discover_details": true}', encoding="utf-8")
    output = work_dir / "detail-sam3"
    if not (SAM3_MODEL / "model.safetensors").is_file():
        return []
    try:
        result = await run_command([
            str(QWEN_PYTHON), str(SAM3_SCRIPT), "--image", str(canvas), "--proposals", str(settings),
            "--model", str(SAM3_MODEL), "--output", str(output),
        ], timeout=90)
        if result.returncode == 0:
            return json.loads((output / "detail-proposals.json").read_text(encoding="utf-8"))["regions"]
        (work_dir / "detail-discovery-error.txt").write_text(result.stderr, encoding="utf-8")
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    return []


async def recover_local_details(result_dir: Path, manifest: dict[str, Any], job: dict[str, Any]):
    if len(manifest["regions"]) >= MAX_REGION_MASKS:
        return result_dir, manifest
    canvas, visible, crops = await asyncio.to_thread(prepare_detail_search, result_dir, manifest)
    if not crops:
        return result_dir, manifest
    work_dir = result_dir.parent
    boxes = [(region["type"], region["label"].casefold(), bounds) for region in manifest["regions"]
             if (bounds := read_mask(result_dir, region).getbbox()) is not None]
    proposals = []

    def add_candidates(candidates, limit):
        start = len(proposals)
        for candidate in candidates:
            pixels = [round(value * visible.size[i % 2] / 1000) for i, value in enumerate(candidate["bbox"])]
            kind = candidate["type"]
            label = candidate["label"].casefold()
            if any((kind == old_kind or label == old_label) and box_iou(pixels, old) >= .52
                   for old_kind, old_label, old in boxes):
                continue
            candidate["id"] = f"detail_{len(proposals) + 1}_{candidate['id']}"
            proposals.append(candidate)
            boxes.append((kind, label, pixels))
            if len(proposals) - start == limit:
                return

    job.update(message="Looking for distinct painted motifs…", progress=87)
    motifs = await find_painted_motifs(canvas, work_dir)
    motif_candidates = []
    for raw in motifs:
        normalized = normalize_proposals({"regions": [raw]}, coverage=True)
        motif_candidates.extend(local_detail_candidates(normalized, (0, 0, *visible.size), visible, [raw]))
    add_candidates(motif_candidates, 4)

    for index, (crop, box) in enumerate(crops, 1):
        job.update(message=f"Checking details in painted area {index} of {len(crops)}…", progress=87 + index)
        try:
            focused = await run_command([
                str(QWEN_PYTHON), "-m", "mlx_vlm.generate", "--model", str(QWEN_MODEL), "--image", str(crop),
                "--prompt", detail_search_prompt(), "--max-tokens", "430", "--temperature", "0", "--no-verbose",
            ], timeout=70)
            (work_dir / f"detail-focus-{index}.txt").write_text(focused.stdout, encoding="utf-8")
            if focused.returncode:
                continue
            raw = extract_json(focused.stdout)
            normalized = normalize_proposals(raw, coverage=True)
            smaller = [candidate for candidate in normalized if candidate["type"] != "lettering"
                       and (candidate["bbox"][2] - candidate["bbox"][0]) * (candidate["bbox"][3] - candidate["bbox"][1]) <= 250_000]
            candidates = local_detail_candidates(smaller, box, visible, raw.get("regions"))
        except (ValueError, subprocess.TimeoutExpired):
            continue
        add_candidates(candidates, 2)
    if not proposals:
        return result_dir, manifest
    payload = work_dir / "detail-proposals.json"
    payload.write_text(json.dumps({
        "regions": proposals, "region_taxonomy": REGION_TAXONOMY, "coverage_pass": True, "local_detail_pass": True,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    output = work_dir / "result-detailed"
    job.update(message="Tracing and verifying the smaller painted shapes…", progress=90)
    segmented = await run_command([
        str(SAM_PYTHON), str(SAM_SCRIPT), "--image", str(canvas), "--proposals", str(payload), "--output", str(output),
    ], timeout=130)
    if segmented.returncode:
        (work_dir / "detail-error.txt").write_text(segmented.stderr, encoding="utf-8")
        return result_dir, manifest
    found = json.loads((output / "regions.json").read_text(encoding="utf-8"))
    await review_region_categories(output, found, work_dir / "detail-review-output.txt", local_details=True)
    refined, report = await asyncio.to_thread(
        merge_coverage_masks, manifest, result_dir, found, output, visible, limit=MAX_REGION_MASKS, local_details=True,
    )
    (work_dir / "detail-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return (output, refined) if report["accepted_labels"] else (result_dir, manifest)


async def propose_regions(image_path: Path, prompt: str, max_tokens: int, timeout: int, *sampling: str):
    checkpoint, _ = PROPOSAL_CHECKPOINTS[PROPOSAL_MODEL]
    thinking = ["--thinking-mode", "disabled"] if PROPOSAL_MODEL == "qwen3.5-9b" else []
    return await run_command([
        str(QWEN_PYTHON), "-m", "mlx_vlm.generate", "--model", str(checkpoint),
        "--image", str(image_path), "--prompt", prompt, "--max-tokens", str(max_tokens),
        *sampling, *thinking, "--no-verbose",
    ], timeout=timeout)


async def analyze_job(job_id: str, image_path: Path, statement: str, preprocessing: dict[str, Any]) -> None:
    job = jobs[job_id]
    async with analysis_lock:
        try:
            job.update(stage="vision", message="Reading the artwork…", progress=18)
            qwen = await propose_regions(image_path, qwen_prompt(statement), 1500, 240, "--temperature", "0")
            if qwen.returncode != 0:
                raise RuntimeError(qwen.stderr.strip()[-600:] or "Vision analysis failed")
            (image_path.parent / "vision-output.txt").write_text(qwen.stdout, encoding="utf-8")
            try:
                raw_analysis = extract_json(qwen.stdout)
            except ValueError:
                raw_analysis = {}
            proposals = normalize_proposals(raw_analysis)
            if len(proposals) < 3 or (len(proposals) < 5 and all(
                proposal["type"] in BASE_LAYER_TYPES for proposal in proposals
            )):
                job.update(stage="vision", message="Refining the region reading…", progress=27)
                retry_analysis = {}
                try:
                    retry = await propose_regions(
                        image_path, qwen_regions_retry_prompt(statement), 1200, 240,
                        "--temperature", "0.15", "--seed", "7",
                    )
                    (image_path.parent / "vision-retry-output.txt").write_text(retry.stdout, encoding="utf-8")
                    if retry.returncode == 0:
                        retry_analysis = extract_json(retry.stdout)
                except (ValueError, subprocess.TimeoutExpired):
                    pass
                proposals = normalize_proposals({"regions": [*proposals, *retry_analysis.get("regions", [])]})
                if "statement_colors" not in raw_analysis:
                    raw_analysis["statement_colors"] = retry_analysis.get("statement_colors", [])
            if len(proposals) < 3 or all(proposal["type"] in BASE_LAYER_TYPES for proposal in proposals):
                try:
                    recovery = await propose_regions(
                        image_path, qwen_recovery_prompt(), 680, 85,
                        "--temperature", "0", "--repetition-penalty", "1.08",
                    )
                    (image_path.parent / "vision-recovery-output.txt").write_text(recovery.stdout, encoding="utf-8")
                    if recovery.returncode == 0:
                        proposals = normalize_proposals({
                            "regions": [*proposals, *extract_json(recovery.stdout).get("regions", [])],
                        })
                except (ValueError, subprocess.TimeoutExpired):
                    pass
            job.update(stage="vision", message="Checking the artwork boundary…", progress=36)
            artwork_payload: dict[str, Any] = {}
            try:
                boundary = await run_command([
                    str(QWEN_PYTHON), "-m", "mlx_vlm.generate",
                    "--model", str(QWEN_MODEL), "--image", str(image_path),
                    "--prompt", qwen_artwork_prompt(preprocessing), "--max-tokens", "280",
                    "--temperature", "0", "--no-verbose",
                ], timeout=180)
            except subprocess.TimeoutExpired:
                boundary = None  # Keep the full artwork and continue with the regions already found.
            if boundary is not None and boundary.returncode == 0:
                (image_path.parent / "artwork-boundary-output.txt").write_text(boundary.stdout, encoding="utf-8")
                try:
                    artwork_payload = {"artwork": extract_first_object(boundary.stdout)}
                except ValueError:
                    artwork_payload = {}
            artwork = normalize_artwork(artwork_payload, preprocessing)
            repeated = [
                proposal for proposal in proposals
                if not proposal.get("parts")
                and re.search(r"\b(?:glyphs|dots|drips|splashes|speckles|streaks|stripes|patches|lettering|cracks|fissures)\b", proposal["label"], re.I)
            ][:3]
            if repeated:
                job.update(message="Locating repeated marks…", progress=40)
                try:
                    extra = await run_command([
                        str(QWEN_PYTHON), "-m", "mlx_vlm.generate",
                        "--model", str(QWEN_MODEL), "--image", str(image_path),
                        "--prompt", qwen_parts_prompt(repeated), "--max-tokens", "420",
                        "--temperature", "0", "--no-verbose",
                    ], timeout=60)
                    if extra.returncode == 0:
                        locations = extract_json(extra.stdout).get("regions", [])
                        by_id = {item["id"]: item for item in repeated}
                        for item in locations:
                            if not isinstance(item, dict) or not isinstance(item.get("id"), str):
                                continue
                            target = by_id.get(item["id"])
                            if target and isinstance(item.get("parts"), list):
                                # Use the same box validation and deduplication as the primary model output.
                                merged = normalize_proposals({"regions": [{**target, "parts": item["parts"]}]})
                                if merged and merged[0].get("parts"):
                                    target["parts"] = merged[0]["parts"]
                except (ValueError, subprocess.TimeoutExpired):
                    pass  # The first location remains playable.
            proposal_path = image_path.parent / "proposals.json"
            proposal_path.write_text(json.dumps({
                "artwork": artwork,
                "preprocessing": preprocessing,
                "region_taxonomy": REGION_TAXONOMY,
                "regions": proposals,
            }, ensure_ascii=False, indent=2), encoding="utf-8")

            sam3_dir = image_path.parent / "sam3"
            sam3_ready = False
            if (SAM3_MODEL / "model.safetensors").is_file():
                job.update(stage="segment", message="Finding matching shapes with SAM 3…", progress=45)
                try:
                    sam3 = await run_command([
                        str(QWEN_PYTHON), str(SAM3_SCRIPT),
                        "--image", str(image_path), "--proposals", str(proposal_path),
                        "--model", str(SAM3_MODEL), "--output", str(sam3_dir),
                    ], timeout=120)
                    sam3_ready = sam3.returncode == 0 and (sam3_dir / "regions.json").is_file()
                    if sam3.returncode:
                        (image_path.parent / "sam3-error.log").write_text(sam3.stderr, encoding="utf-8")
                except (OSError, subprocess.TimeoutExpired):
                    pass  # SAM 2.1 can complete the analysis without SAM 3.

            job.update(stage="segment", message="Defining interactive regions…", progress=60)
            result_dir = image_path.parent / "result"
            sam = await run_command([
                str(SAM_PYTHON), str(SAM_SCRIPT),
                "--image", str(image_path), "--proposals", str(proposal_path),
                "--output", str(result_dir),
                *(["--sam3", str(sam3_dir)] if sam3_ready else []),
            ], timeout=360)
            if sam.returncode != 0:
                raise RuntimeError(sam.stderr.strip()[-900:] or "Mask generation failed")

            manifest = json.loads((result_dir / "regions.json").read_text(encoding="utf-8"))
            # Preserve any motif independently discovered by SAM 3 at its
            # original index, so the second pass can safely reuse those masks.
            if sam3_ready:
                semantic = json.loads((sam3_dir / "regions.json").read_text(encoding="utf-8"))
                for record in semantic:
                    if "proposal" in record and record["index"] == len(proposals):
                        proposals.append(record["proposal"])
            job.update(stage="segment", message="Checking region categories against the masks…", progress=68)
            await review_region_categories(result_dir, manifest, image_path.parent / "region-review-output.txt")
            job.update(message="Checking for missed painted areas…", progress=70)
            try:
                result_dir, manifest = await recover_region_coverage(result_dir, manifest, job)
            except (OSError, ValueError, subprocess.TimeoutExpired):
                pass  # A failed coverage pass leaves the first partition usable.
            try:
                result_dir, manifest = await recover_local_details(result_dir, manifest, job)
            except (OSError, ValueError, subprocess.TimeoutExpired):
                pass  # Keep the verified partition if detail analysis fails.
            if not manifest["regions"]:
                raise RuntimeError("The analysis could not find a playable painted region.")
            job.update(stage="music", message="Preparing the algorithmic music system…", progress=92)
            processed_image = manifest.get("processed_image", "artwork.png")
            result_url = f"/runtime/jobs/{job_id}/{result_dir.name}"
            manifest.update({
                "analysis_id": job_id,
                "image_url": f"{result_url}/{processed_image}",
                "status": "ready",
                "region_layout": "by_category",
                "proposal_source": PROPOSAL_CHECKPOINTS[PROPOSAL_MODEL][1],
                "artist_statement": statement,
                "statement_colors": raw_analysis.get("statement_colors", []),
            })
            for region in manifest["regions"]:
                region["visual_mask_url"] = f"{result_url}/{region['visual_mask']}"
                region["hit_mask_url"] = f"{result_url}/{region['hit_mask']}"
            final_manifest = result_dir.parent / "result" / "regions.json"
            saved_manifest = json.dumps(manifest, ensure_ascii=False, indent=2)
            (result_dir / "regions.json").write_text(saved_manifest, encoding="utf-8")
            if final_manifest.parent != result_dir:
                final_manifest.write_text(saved_manifest, encoding="utf-8")
            job.update(status="ready", stage="ready", message="Image regions and algorithmic music system are ready.", progress=100, result=manifest)
        except Exception as exc:
            job.update(status="error", stage="error", message=str(exc), progress=100)


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(WEB_DIR / "static" / "index.html")


@app.get("/favicon.svg")
async def favicon() -> FileResponse:
    return FileResponse(WEB_DIR / "static" / "favicon.svg", media_type="image/svg+xml")


@app.get("/api/demo")
async def api_demo() -> JSONResponse:
    return JSONResponse(demo_payload())


@app.get("/assets/demo/image")
async def demo_image() -> FileResponse:
    return FileResponse(DEMO_IMAGE)


@app.get("/assets/demo/{filename}")
async def demo_asset(filename: str) -> FileResponse:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", filename):
        raise HTTPException(status_code=404)
    path = DEMO_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404)
    return FileResponse(path)


@app.post("/api/analyze")
async def api_analyze(
    image: UploadFile = File(...),
    statement: str = Form(default=""),
) -> JSONResponse:
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Please upload a JPG, PNG, or WebP image.")
    data = await image.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="The image must be smaller than 16 MB.")
    if not data:
        raise HTTPException(status_code=400, detail="The image file is empty.")

    job_id = uuid.uuid4().hex[:12]
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True)
    extension = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[image.content_type]
    source_path = job_dir / f"source{extension}"
    source_path.write_bytes(data)
    image_path = job_dir / "prepared.png"
    try:
        preprocessing = await asyncio.to_thread(prepare_uploaded_image, data, image_path)
    except ImagePreparationError as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    jobs[job_id] = {
        "analysis_id": job_id,
        "status": "analyzing",
        "stage": "queued",
        "message": "Preparing the artwork…",
        "progress": 5,
        "created_at": time.time(),
        "warnings": preprocessing.get("warnings", []),
    }
    (job_dir / "preprocessing.json").write_text(json.dumps(preprocessing, indent=2), encoding="utf-8")
    asyncio.create_task(analyze_job(job_id, image_path, statement, preprocessing))
    return JSONResponse(jobs[job_id], status_code=202)


@app.get("/api/analyze/{job_id}")
async def api_analyze_status(job_id: str) -> JSONResponse:
    job = jobs.get(job_id)
    if not job:
        manifest_path = JOBS_DIR / job_id / "result" / "regions.json"
        if manifest_path.is_file():
            return JSONResponse(json.loads(manifest_path.read_text(encoding="utf-8")))
        raise HTTPException(status_code=404, detail="This analysis could not be found.")
    return JSONResponse(job)


@app.on_event("shutdown")
async def clean_old_jobs() -> None:
    # Uploads are demo-session data; keep recent results so the page can reload.
    cutoff = time.time() - 24 * 60 * 60
    for directory in JOBS_DIR.iterdir():
        if directory.is_dir() and directory.stat().st_mtime < cutoff:
            shutil.rmtree(directory, ignore_errors=True)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("STREET_ART_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, ws_per_message_deflate=False)
