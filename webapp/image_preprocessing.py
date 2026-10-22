#!/usr/bin/env python3
"""Safe, geometry-preserving preparation for uploaded artwork images."""

from __future__ import annotations

import math
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps, ImageStat, UnidentifiedImageError


MAX_SOURCE_PIXELS = 40_000_000
MAX_WORKING_SIDE = 1800
MAX_WORKING_ASPECT = 3.0
LOW_RES_SHORT_SIDE = 480
LOW_RES_PIXELS = 300_000
EXIF_ORIENTATION = 274


class ImagePreparationError(ValueError):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def _average_color(image: Image.Image) -> tuple[int, int, int]:
    sample = image.copy()
    sample.thumbnail((64, 64), Image.Resampling.BILINEAR)
    mean = ImageStat.Stat(sample).mean
    # Pull the padding gently toward paper-grey so it reads as framing rather
    # than an extension of the artwork.
    return tuple(round(channel * 0.72 + 238 * 0.28) for channel in mean[:3])


def prepare_uploaded_image(data: bytes, output_path: Path) -> dict[str, Any]:
    """Normalize orientation and size without stretching image content.

    Extreme panoramas receive temporary analysis padding. The exact content
    rectangle and transform are recorded so the padding can be removed again
    before the interactive image and masks are produced.
    """
    try:
        with Image.open(BytesIO(data)) as opened:
            source_width, source_height = opened.size
            source_pixels = source_width * source_height
            if source_pixels > MAX_SOURCE_PIXELS:
                raise ImagePreparationError(
                    f"The image contains {source_pixels / 1_000_000:.1f} megapixels. "
                    f"Please use an image below {MAX_SOURCE_PIXELS / 1_000_000:.0f} megapixels.",
                    status_code=413,
                )
            orientation = int(opened.getexif().get(EXIF_ORIENTATION, 1) or 1)
            opened.seek(0)
            oriented = ImageOps.exif_transpose(opened)
            if getattr(oriented, "is_animated", False):
                oriented.seek(0)
            image = oriented.convert("RGB")
    except ImagePreparationError:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImagePreparationError("The uploaded file could not be decoded as an image.") from exc

    oriented_width, oriented_height = image.size
    long_side = max(oriented_width, oriented_height)
    scale = min(1.0, MAX_WORKING_SIDE / long_side)
    resized_width = max(1, round(oriented_width * scale))
    resized_height = max(1, round(oriented_height * scale))
    if (resized_width, resized_height) != image.size:
        image = image.resize((resized_width, resized_height), Image.Resampling.LANCZOS)

    target_width, target_height = resized_width, resized_height
    if resized_width / resized_height > MAX_WORKING_ASPECT:
        target_height = math.ceil(resized_width / MAX_WORKING_ASPECT)
    elif resized_height / resized_width > MAX_WORKING_ASPECT:
        target_width = math.ceil(resized_height / MAX_WORKING_ASPECT)

    pad_left = (target_width - resized_width) // 2
    pad_right = target_width - resized_width - pad_left
    pad_top = (target_height - resized_height) // 2
    pad_bottom = target_height - resized_height - pad_top
    if any((pad_left, pad_top, pad_right, pad_bottom)):
        prepared = Image.new("RGB", (target_width, target_height), _average_color(image))
        prepared.paste(image, (pad_left, pad_top))
    else:
        prepared = image

    output_path.parent.mkdir(parents=True, exist_ok=True)
    prepared.save(output_path, format="PNG", optimize=True)

    warnings: list[str] = []
    if min(oriented_width, oriented_height) < LOW_RES_SHORT_SIDE or source_pixels < LOW_RES_PIXELS:
        warnings.append("This image is low resolution; fine contours may be less accurate.")

    return {
        "source_size": {"width": source_width, "height": source_height, "pixels": source_pixels},
        "exif_orientation": orientation,
        "orientation_corrected": orientation not in {0, 1},
        "oriented_size": {"width": oriented_width, "height": oriented_height},
        "resize": {
            "scale": round(scale, 8),
            "width": resized_width,
            "height": resized_height,
            "max_side": MAX_WORKING_SIDE,
        },
        "padding": {
            "left": pad_left,
            "top": pad_top,
            "right": pad_right,
            "bottom": pad_bottom,
            "applied": any((pad_left, pad_top, pad_right, pad_bottom)),
        },
        "content_box": [pad_left, pad_top, pad_left + resized_width, pad_top + resized_height],
        "prepared_size": {"width": target_width, "height": target_height},
        "limits": {
            "max_source_pixels": MAX_SOURCE_PIXELS,
            "low_resolution_short_side": LOW_RES_SHORT_SIDE,
        },
        "warnings": warnings,
    }
