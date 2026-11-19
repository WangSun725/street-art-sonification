"""Find and validate missing region masks in the displayed artwork's coordinates."""

from pathlib import Path

from PIL import Image, ImageChops, ImageStat

from region_proposals import BASE_LAYER_TYPES, FINE_TYPES

DETAIL_TYPES = {"abstract_shape", "depicted_object", "figure_part", "graphic_line", "lettering", "paint_texture"}
DETAIL_PARENT_TYPES = {"abstract_shape", "figure", "lettering", "painted_ground"}


def read_mask(directory, region, key="hit_mask"):
    with Image.open(directory / region[key]) as image:
        return image.convert("L")


def visible_artwork(directory, manifest):
    with Image.open(directory / manifest["processed_image"]) as image:
        artwork = image.convert("RGBA")
    visible = artwork.getchannel("A").point(lambda alpha: 255 if alpha >= 128 else 0)
    return artwork, visible


def coverage_masks(directory, manifest, visible):
    occupied = Image.new("L", visible.size)
    grounds = Image.new("L", visible.size)
    for region in manifest["regions"]:
        mask = read_mask(directory, region)
        occupied = ImageChops.lighter(occupied, mask)
        if region["type"] == "painted_ground":
            grounds = ImageChops.lighter(grounds, mask)
    return ImageChops.subtract(visible, occupied), ImageChops.darker(visible, grounds)


def artwork_panels(manifest, size):
    segments = manifest["preprocessing"]["coordinate_transform"].get("prepared_to_output_segments", [])
    panels = []
    for segment in segments:
        origin = segment["output_origin"]
        x, y = origin["x"], origin["y"]
        left, top, right, bottom = segment["prepared_rect"]
        panels.append((x, y, x + right - left, y + bottom - top))
    return panels or [(0, 0, *size)]


def prepare_coverage_search(result_dir, manifest, work_dir, *, include_large_masks=False):
    artwork, visible = visible_artwork(result_dir, manifest)
    visible_pixels = visible.histogram()[255]
    if not visible_pixels:
        return None
    gaps, grounds = coverage_masks(result_dir, manifest, visible)
    target = gaps
    few_gaps = gaps.histogram()[255] < .12 * visible_pixels
    # A broad and visually varied ground may be concealing other painted
    # features. Only search through it when there are few actual gaps.
    if (few_gaps
            and grounds.histogram()[255] >= .55 * visible_pixels
            and max(ImageStat.Stat(artwork.convert("RGB"), grounds).stddev) >= 24):
        target = ImageChops.lighter(gaps, grounds)
    if include_large_masks and few_gaps:
        for region in manifest["regions"]:
            mask = read_mask(result_dir, region)
            if mask.histogram()[255] >= .16 * visible_pixels:
                target = ImageChops.lighter(target, ImageChops.darker(visible, mask))
    if target.histogram()[255] < .06 * visible_pixels:
        return None

    rgb = Image.new("RGB", artwork.size, "#e3e0da")
    rgb.paste(artwork, mask=visible)
    dimmed = Image.blend(rgb, Image.new("RGB", rgb.size, "#96928a"), .72)
    highlighted = Image.composite(rgb, dimmed, target)
    canvas_path = work_dir / "coverage-artwork.png"
    rgb.save(canvas_path)

    # Avoid proposing a single bounding box across a removed wall-panel seam.
    windows = []
    for panel in artwork_panels(manifest, rgb.size):
        bounds = target.crop(panel).getbbox()
        if bounds is None:
            continue
        left, top, right, bottom = panel
        width, height = right - left, bottom - top
        # Read overlapping windows along both axes. Long murals get more
        # candidate windows while the number of model calls stays bounded.
        tile_width = min(width, max(round(.63 * width), min(width, round(.9 * height))))
        tile_height = min(height, max(round(.72 * height), min(height, round(.9 * width))))
        for dx in sorted({0, (width - tile_width) // 2, width - tile_width,
                          (bounds[0] * 2 + bounds[2] - tile_width) // 3,
                          (bounds[0] + 2 * bounds[2] - 2 * tile_width) // 3}):
            for dy in sorted({0, (height - tile_height) // 2, height - tile_height,
                              (bounds[1] + bounds[3] - tile_height) // 2}):
                x = left + min(max(0, dx), width - tile_width)
                y = top + min(max(0, dy), height - tile_height)
                box = (x, y, x + tile_width, y + tile_height)
                if box not in windows:
                    windows.append(box)

    crops = []
    remaining = target.copy()
    for index in range(3):
        if not windows:
            break
        box = max(windows, key=lambda window: remaining.crop(window).histogram()[255])
        windows.remove(box)
        unseen = remaining.crop(box).histogram()[255]
        if unseen < .045 * visible_pixels or unseen < .12 * target.crop(box).histogram()[255]:
            break
        remaining.paste(0, box)
        path = work_dir / f"coverage-focus-{index + 1}.png"
        highlighted.crop(box).save(path)
        crops.append((path, box))
    return canvas_path, target, crops


def prepare_figure_context(result_dir, manifest, canvas_path):
    """Zoom in on the most prominent figure and leave room for nearby props."""
    figures = [region for region in manifest["regions"] if region["type"] == "figure"]
    if not figures:
        return None
    figure = max(figures, key=lambda region: region["area_ratio"])
    bounds = read_mask(result_dir, figure).getbbox()
    if bounds is None:
        return None
    left, top, right, bottom = bounds
    pad_x = round((right - left) * .62)
    pad_y = round((bottom - top) * .25)
    with Image.open(canvas_path) as canvas:
        box = (max(0, left - pad_x), max(0, top - pad_y),
               min(canvas.width, right + pad_x), min(canvas.height, bottom + pad_y))
        detail = canvas_path.with_name("coverage-figure-context.png")
        canvas.crop(box).save(detail)
    return detail, box


def prepare_detail_search(result_dir, manifest):
    """Look inside large regions even when the first pass covers nearly every pixel."""
    artwork, visible = visible_artwork(result_dir, manifest)
    visible_pixels = visible.histogram()[255]
    canvas = Image.new("RGB", artwork.size, "#e3e0da")
    canvas.paste(artwork, mask=visible)
    work_dir = result_dir.parent
    canvas_path = work_dir / "detail-artwork.png"
    mask_info = [(region, read_mask(result_dir, region)) for region in manifest["regions"]
                 if region["type"] in DETAIL_PARENT_TYPES]
    options = []
    for panel in artwork_panels(manifest, artwork.size):
        for region, mask in mask_info:
            cutout = mask.crop(panel)
            pixels = cutout.histogram()[255]
            if pixels == 0 or pixels < visible_pixels * .08:
                continue
            left, top, right, bottom = cutout.getbbox()
            width, height = right - left, bottom - top
            pad_x = round(width * (.85 if region["type"] == "figure" else .15))
            pad_y = round(height * .26)
            box = (panel[0] + max(0, left - pad_x), panel[1] + max(0, top - pad_y),
                   min(panel[2], panel[0] + right + pad_x), min(panel[3], panel[1] + bottom + pad_y))
            options.append((region, box, pixels))
    crops = []
    for region, box, _ in sorted(options, key=lambda option: (option[0]["type"] != "figure", -option[2])):
        for _, previous in crops:
            if box_iou(box, previous) >= .78:
                break
        else:
            path = work_dir / f"detail-focus-{len(crops) + 1}.png"
            canvas.crop(box).save(path)
            crops.append((path, box))
        if len(crops) == 2:
            break
    if crops:
        canvas.save(canvas_path)
    return canvas_path, visible, crops


def box_iou(a, b):
    intersection = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - intersection
    return intersection / union if union else 0


def local_detail_candidates(candidates, box, visible, raw):
    """Carry the model's optional outside points into artwork coordinates."""
    raw = raw if isinstance(raw, list) else []
    by_label = {str(item.get("label", "")).strip()[:48].casefold(): item
                for item in raw if isinstance(item, dict)}
    detail = []
    for candidate in remap_focus_candidates(candidates, box, visible):
        name = candidate["label"].casefold().replace(" ", "_")
        if candidate["type"] not in DETAIL_TYPES or name in DETAIL_TYPES | {"concrete_name"}:
            continue
        negatives = []
        original = by_label.get(candidate["label"].casefold(), {})
        values = original.get("exclude")
        for point in values[:2] if isinstance(values, list) else []:
            if (isinstance(point, list) and len(point) == 2
                    and all(type(value) in (int, float) and 0 <= value <= 1000 for value in point)):
                negatives.append([round((box[i] + value / 1000 * (box[i + 2] - box[i])) / visible.size[i] * 1000)
                                  for i, value in enumerate(point)])
        detail.append({**candidate, "negative_points": negatives})
    return detail


def remap_focus_candidates(candidates, box, target):
    """Map normalized crop geometry to the displayed artwork and validate its scope."""
    left, top, right, bottom = box
    width, height = target.size
    additions = []
    for candidate in candidates:
        locations = []
        for location in [candidate, *candidate.get("parts", [])]:
            x1, y1, x2, y2 = location["bbox"]
            panel_box = (
                round(left + x1 / 1000 * (right - left)), round(top + y1 / 1000 * (bottom - top)),
                round(left + x2 / 1000 * (right - left)), round(top + y2 / 1000 * (bottom - top)),
            )
            a, b, c, d = panel_box
            if c <= a or d <= b or target.crop(panel_box).histogram()[255] < .25 * (c - a) * (d - b):
                continue
            px, py = location["point"]
            locations.append({
                "bbox": [round(value * 1000 / (height if i % 2 else width)) for i, value in enumerate(panel_box)],
                "point": [round((left + px / 1000 * (right - left)) * 1000 / width),
                          round((top + py / 1000 * (bottom - top)) * 1000 / height)],
            })
        if locations:
            additions.append({**candidate, **locations[0], "parts": locations[1:]})
    return additions


def merge_coverage_masks(original, original_dir, found, found_dir, target, *, limit=None, split_large_masks=False,
                         local_details=False):
    """Add independently verified masks without changing the displayed crop."""
    _, visible = visible_artwork(original_dir, original)
    gaps, grounds = coverage_masks(original_dir, original, visible)
    visible_pixels = visible.histogram()[255]
    masks = [(region.copy(), read_mask(original_dir, region)) for region in original["regions"]]
    sizes = {r["id"]: mask.histogram()[255] for r, mask in masks}
    existing_types = {r["type"] for r, _ in masks}
    claimed = Image.new("L", visible.size)
    added = []
    rejected = []
    rejection_reasons = {}
    # Segment all candidates together, but judge their original SAM masks
    # independently. A bad candidate cannot erase any confirmed boundary.
    for region in sorted(found["regions"], key=lambda item: (
        item["type"] in BASE_LAYER_TYPES, item["type"] in existing_types,
    )):
        if limit is not None and len(masks) + len(added) >= limit:
            break
        raw = read_mask(found_dir, region, "source_mask")
        raw_pixels = raw.histogram()[255]
        required = max(1, round(visible_pixels * (.001 if region["type"] in FINE_TYPES else .003)))
        allowed = gaps if region["type"] in BASE_LAYER_TYPES else ImageChops.lighter(gaps, grounds)
        replaceable = {old["id"] for old, _ in masks if old["type"] == "painted_ground"}
        if local_details and region["type"] in DETAIL_TYPES:
            for old, before in masks:
                area = sizes[old["id"]]
                overlap = ImageChops.darker(raw, before).histogram()[255]
                if (old["type"] in DETAIL_PARENT_TYPES and old["type"] != region["type"]
                        and area >= .08 * visible_pixels and required <= overlap <= .28 * area):
                    allowed = ImageChops.lighter(allowed, before)
                    replaceable.add(old["id"])
        elif (split_large_masks and region["type"] not in existing_types | BASE_LAYER_TYPES
                and len(region.get("category_evidence", "").split()) >= 3):
            for old, before in masks:
                area = sizes[old["id"]]
                overlap = ImageChops.darker(raw, before).histogram()[255]
                if area >= .16 * visible_pixels and required <= overlap <= .35 * area:
                    allowed = ImageChops.lighter(allowed, before)
                    replaceable.add(old["id"])
        mask = ImageChops.subtract(ImageChops.darker(raw, ImageChops.darker(target, allowed)), claimed)
        pixels = mask.histogram()[255]
        reason = None
        if (region.get("category_source") != "mask_review" or region["type"] == "exposed_support"
                or (local_details and (region["type"] not in DETAIL_TYPES
                                       or len(region.get("category_evidence", "").split()) < 3))):
            reason = "uncertain category"
        elif max(region["sam_scores"], default=0) < .55:
            reason = "weak mask"
        elif pixels < required or pixels < .62 * raw_pixels:
            reason = "too small or overlaps a protected region"
        if reason:
            rejected.append(region["label"])
            rejection_reasons[region["id"]] = reason
            continue
        updated = [
            (old, ImageChops.subtract(before, mask) if old["id"] in replaceable else before)
            for old, before in masks
        ]
        if any(before.histogram()[255] < (.72 if local_details else .5) * sizes[old["id"]]
               for old, before in updated if old["id"] in replaceable):
            rejected.append(region["label"])
            rejection_reasons[region["id"]] = "would remove too much of an existing region"
            continue
        masks = updated
        claimed = ImageChops.lighter(claimed, mask)
        added.append((region.copy(), mask))
        existing_types.add(region["type"])

    metadata = {
        "visible_pixels": visible_pixels,
        "covered_before": visible_pixels - gaps.histogram()[255],
        "covered_after": visible_pixels - ImageChops.subtract(gaps, claimed).histogram()[255],
        "accepted_labels": [region["label"] for region, _ in added],
        "rejected_labels": rejected,
        "rejection_reasons": rejection_reasons,
    }
    if not added:
        return original, metadata

    for region, _ in masks:
        (found_dir / region["source_mask"]).write_bytes((original_dir / region["source_mask"]).read_bytes())
    for region, mask in [*masks, *added]:
        mask.save(found_dir / region["visual_mask"])
        mask.save(found_dir / region["hit_mask"])
        region["area_ratio"] = round(mask.histogram()[255] / (visible.width * visible.height), 5)
    (found_dir / original["processed_image"]).write_bytes((original_dir / original["processed_image"]).read_bytes())
    partition = {**original["interaction_partition"], "covered_pixels": metadata["covered_after"],
                 "unassigned_pixels": visible.width * visible.height - metadata["covered_after"]}
    return {**original, "regions": [region for region, _ in [*masks, *added]],
            "interaction_partition": partition}, metadata
