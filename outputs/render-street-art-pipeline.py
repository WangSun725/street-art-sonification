from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


SCALE = 2
WIDTH, HEIGHT = 1200, 260
OUT = Path(__file__).with_name("street-art-pipeline.png")
REGULAR = "/System/Library/Fonts/HelveticaNeue.ttc"
BOLD = "/Library/Fonts/Helvetica Bold.ttf"


def xy(values):
    return tuple(round(value * SCALE) for value in values)


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else REGULAR, size * SCALE)


def centered(draw, box, y, text, size, color, bold=False):
    left, _, right, _ = box
    draw.text(
        xy(((left + right) / 2, y)),
        text,
        font=font(size, bold),
        fill=color,
        anchor="mm",
    )


canvas = Image.new("RGB", xy((WIDTH, HEIGHT)), "#F7F6F2")
draw = ImageDraw.Draw(canvas)

boxes = [
    (26, 67, 226, 193),
    (272, 67, 452, 193),
    (498, 67, 678, 193),
    (724, 67, 914, 193),
    (960, 67, 1174, 193),
]

for start, end in zip(boxes, boxes[1:]):
    x1, x2, y = start[2] + 10, end[0] - 12, 130
    draw.line(xy((x1, y, x2, y)), fill="#A5A29B", width=2 * SCALE)
    draw.polygon(xy((x2, y, x2 - 12, y - 7, x2 - 12, y + 7)), fill="#A5A29B")

draw.rounded_rectangle(xy(boxes[0]), radius=10 * SCALE, fill="#FFFFFF", outline="#D7D4CD", width=SCALE)
draw.rounded_rectangle(xy(boxes[1]), radius=10 * SCALE, fill="#E8E5DE")
draw.rounded_rectangle(xy(boxes[2]), radius=10 * SCALE, fill="#E8E5DE")
draw.rounded_rectangle(xy(boxes[3]), radius=10 * SCALE, fill="#FFFFFF", outline="#D7D4CD", width=SCALE)
draw.rounded_rectangle(xy(boxes[4]), radius=10 * SCALE, fill="#22211F")

centered(draw, boxes[0], 92, "INPUT", 11, "#8D8981")
centered(draw, boxes[0], 125, "ARTWORK IMAGE", 16, "#22211F", True)
centered(draw, boxes[0], 150, "+", 12, "#77736C")
centered(draw, boxes[0], 174, "ARTIST STATEMENT", 15, "#22211F", True)

centered(draw, boxes[1], 92, "MODEL", 11, "#77736C")
centered(draw, boxes[1], 131, "QWEN3-VL 2B", 17, "#22211F", True)
centered(draw, boxes[1], 158, "INSTRUCT 4-BIT", 12, "#66625C")

centered(draw, boxes[2], 92, "MODEL", 11, "#77736C")
centered(draw, boxes[2], 131, "SAM 2.1", 17, "#22211F", True)
centered(draw, boxes[2], 158, "HIERA TINY", 12, "#66625C")

centered(draw, boxes[3], 92, "INTERACTION", 11, "#8D8981")
centered(draw, boxes[3], 128, "REGION MASKS", 16, "#22211F", True)
centered(draw, boxes[3], 152, "+", 12, "#77736C")
centered(draw, boxes[3], 175, "POINTER", 15, "#22211F", True)

centered(draw, boxes[4], 92, "OUTPUT", 11, "#C9C5BC")
centered(draw, boxes[4], 130, "WEB AUDIO", 16, "#FFFFFF", True)
centered(draw, boxes[4], 158, "INTERACTION SIGNAL", 15, "#FFFFFF", True)

canvas.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS).save(OUT, optimize=True)
