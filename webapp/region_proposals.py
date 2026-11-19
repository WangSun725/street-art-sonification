"""Shared geometry and semantic checks for region proposals."""

import re


REGION_TAXONOMY = "street-art-9"
REGION_TYPES = {
    "figure": ("Figure", "drums", "a complete depicted person, animal or character, including a standalone portrait"),
    "figure_part": ("Figure Part", "counter_synth", "an independently segmented anatomical part, such as a hand, eye or wing, even when it is the focus"),
    "depicted_object": ("Depicted Object", "lead_synth", "another recognizable depicted thing, such as a key, glasses, flower, vehicle or building; it can be held by a figure"),
    "lettering": ("Lettering", "keys_mallet", "letters, numbers or stylized graffiti writing, including their attached outlines and fill"),
    "graphic_line": ("Graphic Line", "guitar", "an independently identifiable painted stroke or decorative line; an attached outline belongs to its object or letters"),
    "abstract_shape": ("Abstract Shape", "organ", "a bounded nonrepresentational shape, such as a geometric block or decorative dot, including repeats of the same shape"),
    "painted_ground": ("Painted Ground", "bass", "a broad paint field or gradient behind or between other elements; a figure's or letter's fill belongs to that element"),
    "paint_texture": ("Paint Texture", "percussion_texture", "a separately visible patch of sprayed speckles, brush marks, or drips made with paint"),
    "exposed_support": ("Exposed Support", "pad", "unpainted material deliberately used as negative space or as a form in the artwork; exclude ordinary wall or wear"),
}
GROUND_TYPES = {"painted_ground", "paint_texture", "exposed_support"}
BASE_LAYER_TYPES = {"painted_ground", "exposed_support"}
FINE_TYPES = {"graphic_line", "paint_texture"}
LEGACY_TYPES = {
    "face": "figure_part", "gesture": "figure_part", "detail": "depicted_object",
    "symbol": "abstract_shape", "outline": "graphic_line", "drip": "paint_texture",
    "texture": "paint_texture", "fill": "painted_ground", "wall": "painted_ground",
}

WALL_LINE = r"(?:cracks?|fissures?|mortar (?:lines?|joints?)|brick (?:seams?|joints?))"
PICTURE_LABEL = re.compile(r"^(?:(?:left|right|upper|lower|main|central|large|small) )*(?:mural|graffiti|artwork)(?: panel)?$", re.I)
BARE_SUPPORT = re.compile(
    r"^(?:(?:bare|exposed|unpainted|adjacent|side) )?(?:(?:brick|stone|concrete|masonry) )?"
    r"(?:walls?|fa[çc]ades?|bricks?|mortar|concrete|stone)$", re.I,
)
ARCHITECTURAL_FEATURE = re.compile(r"^(?:(?:upper|lower|left|right|real|glass) )*(?:windows?|doors?)$", re.I)
GEOMETRIC_MARK = re.compile(
    r"^(?:(?:painted|abstract|geometric|decorative|colored|coloured|red|orange|yellow|green|blue|purple|white|black|pink|brown) )+"
    r"(?:blocks?|cubes?|squares?|circles?|triangles?|polygons?|diamonds?)$", re.I,
)
PAINTED_WALL_FIELD = re.compile(
    r"^(?:background|(?:(?:painted|colorful|colourful|colored|coloured|red|orange|yellow|green|blue|purple|white|black|pink|brown) )+"
    r"(?:brick )?(?:wall(?: field)?|background|field|ground))$", re.I,
)
ANATOMICAL_PART = re.compile(
    r"^(?:(?:painted|left|right|large|small|outstretched|raised) )*"
    r"(?:hands?|arms?|eyes?|wings?|fingers?|feet|foot|legs?|paws?|tails?)$", re.I,
)
PAINTED_LETTERING = re.compile(r"\b(?:lettering|glyphs?|typography)\b", re.I)


def region_type_guide() -> str:
    return "\n".join(f"{key}: {entry[2]}" for key, entry in REGION_TYPES.items())


def proposal_region_type(value: str, label: str, artwork_role: str) -> str | None:
    if is_wall_crack(label):
        return "exposed_support" if artwork_role == "integrated_material" else "graphic_line"
    if ANATOMICAL_PART.fullmatch(label):
        return "figure_part"
    if GEOMETRIC_MARK.fullmatch(label):
        return "abstract_shape"
    if PAINTED_WALL_FIELD.fullmatch(label):
        return "painted_ground"
    if artwork_role == "integrated_material":
        return "exposed_support"
    if PAINTED_LETTERING.search(label):
        return "lettering"
    if value == "exposed_support":
        return None  # The material must be identified as part of the design.
    return value if value in REGION_TYPES else LEGACY_TYPES.get(value)


def set_region_type(region: dict, kind: str) -> None:
    label, instrument, _ = REGION_TYPES[kind]
    region.update(type=kind, type_label=label, default_instrument=instrument)
    if kind in FINE_TYPES:
        region["fine_detail"] = True
    else:
        region.pop("fine_detail", None)


def is_wall_crack(label: str) -> bool:
    return bool(re.search(rf"\b(?:{WALL_LINE}|cracked|cracking)\b", label, re.I)) and not bool(
        re.search(r"\b(?:glass|mirror|window|screen)\b", label, re.I)
    )


def is_incidental_region(label: str, artwork_role: str = "") -> bool:
    if artwork_role == "incidental":
        return True
    if artwork_role == "integrated_material":
        return False
    painted_mark = artwork_role == "painted" or re.search(
        rf"\b(?:painted|drawn|stencilled|stenciled|illustrated) {WALL_LINE}\b", label, re.I,
    )
    return is_wall_crack(label) and not painted_mark


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
