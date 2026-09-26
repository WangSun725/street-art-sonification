#!/usr/bin/env python3
"""Replay saved Stylized Neural Painting strokes into an H.264 video."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np


PROJECT_DIR = Path(__file__).resolve().parent
MODEL_DIR = PROJECT_DIR / "third_party" / "stylized-neural-painting"
CACHE_DIR = PROJECT_DIR / ".cache"
CACHE_DIR.mkdir(exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(CACHE_DIR / "matplotlib"))
os.environ.setdefault("XDG_CACHE_HOME", str(CACHE_DIR))
sys.path.insert(0, str(MODEL_DIR))

import renderer  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("strokes", type=Path, help="saved *_strokes.npz file")
    parser.add_argument("output", type=Path, help="output .mp4 path")
    parser.add_argument(
        "--reference-image",
        type=Path,
        help="image whose width and height should be used for the video",
    )
    parser.add_argument("--width", type=int, default=850)
    parser.add_argument("--height", type=int, default=1030)
    parser.add_argument("--canvas-size", type=int, default=1030)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--start-hold", type=float, default=0.5)
    parser.add_argument("--end-hold", type=float, default=2.0)
    return parser.parse_args()


def to_video_frame(canvas: np.ndarray, width: int, height: int) -> np.ndarray:
    rgb = cv2.resize(canvas, (width, height), interpolation=cv2.INTER_AREA)
    bgr = (rgb[:, :, ::-1] * 255.0).clip(0, 255).astype(np.uint8)
    return np.ascontiguousarray(bgr)


def write_frame(process: subprocess.Popen, frame: np.ndarray, repeat: int = 1) -> None:
    assert process.stdin is not None
    payload = frame.tobytes()
    for _ in range(repeat):
        process.stdin.write(payload)


def main() -> None:
    args = parse_args()
    args.strokes = args.strokes.resolve()
    args.output = args.output.resolve()
    if args.reference_image:
        args.reference_image = args.reference_image.resolve()

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("ffmpeg was not found on PATH")

    if args.reference_image:
        reference = cv2.imread(str(args.reference_image), cv2.IMREAD_COLOR)
        if reference is None:
            raise SystemExit(f"could not read reference image: {args.reference_image}")
        height, width = reference.shape[:2]
    else:
        width, height = args.width, args.height

    if width % 2 or height % 2:
        raise SystemExit("H.264 output dimensions must both be even numbers")

    saved = np.load(args.strokes)
    strokes = np.concatenate(
        [saved["x_ctt"], saved["x_color"], saved["x_alpha"]], axis=-1
    )[0]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "rawvideo",
        "-pixel_format",
        "bgr24",
        "-video_size",
        f"{width}x{height}",
        "-framerate",
        str(args.fps),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(args.output),
    ]

    # The original renderer locates its brush textures relative to cwd.
    os.chdir(MODEL_DIR)

    painter = renderer.Renderer(
        renderer="oilpaintbrush",
        CANVAS_WIDTH=args.canvas_size,
        canvas_color="white",
    )
    painter.create_empty_canvas()

    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    try:
        first_frame = to_video_frame(painter.canvas, width, height)
        write_frame(process, first_frame, max(1, round(args.start_hold * args.fps)))

        for index, stroke in enumerate(strokes, start=1):
            painter.stroke_params = stroke
            if painter.check_stroke():
                painter.draw_stroke()
            write_frame(process, to_video_frame(painter.canvas, width, height))
            if index % 50 == 0 or index == len(strokes):
                print(f"rendered {index}/{len(strokes)} strokes", flush=True)

        final_frame = to_video_frame(painter.canvas, width, height)
        write_frame(process, final_frame, max(1, round(args.end_hold * args.fps)))
    finally:
        if process.stdin:
            process.stdin.close()

    return_code = process.wait()
    if return_code:
        raise SystemExit(f"ffmpeg exited with status {return_code}")

    duration = args.start_hold + len(strokes) / args.fps + args.end_hold
    print(f"saved {args.output} ({len(strokes)} strokes, {duration:.1f}s)")


if __name__ == "__main__":
    main()
