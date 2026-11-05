"""Shared geometry and semantic checks for region proposals."""

import re


def is_wall_crack(label: str) -> bool:
    return bool(re.search(r"\b(?:crack(?:s|ed|ing)?|fissures?)\b", label, re.I)) and not bool(
        re.search(r"\b(?:glass|mirror|window|screen)\b", label, re.I)
    )


def normalize_location(item: dict, *, thin: bool = False) -> dict | None:
    try:
        box = [max(0, min(1000, int(float(value)))) for value in item["bbox"][:4]]
        x1, y1, x2, y2 = box
    except (KeyError, TypeError, ValueError, OverflowError):
        return None
    minimum = 5 if thin else 25
    if x2 - x1 < minimum or y2 - y1 < minimum:
        return None
    try:
        point = [max(0, min(1000, int(float(value)))) for value in item.get("point", [])[:2]]
        px, py = point
    except (TypeError, ValueError, OverflowError):
        px, py = -1, -1
    margin_x = min((x2 - x1) // 3, max(8, int((x2 - x1) * .06))) if not thin else 0
    margin_y = min((y2 - y1) // 3, max(8, int((y2 - y1) * .06))) if not thin else 0
    if not (x1 + margin_x <= px < x2 - margin_x and y1 + margin_y <= py < y2 - margin_y):
        px, py = (x1 + x2) // 2, (y1 + y2) // 2
    return {"bbox": box, "point": [px, py]}
