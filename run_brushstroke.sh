#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODEL_DIR="$PROJECT_DIR/third_party/stylized-neural-painting"
PYTHON_BIN="$PROJECT_DIR/.venv/bin/python"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 INPUT_IMAGE [OUTPUT_DIR] [LONG_EDGE_PIXELS]" >&2
  exit 2
fi

INPUT_IMAGE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
OUTPUT_DIR="${2:-$PROJECT_DIR/outputs/custom}"
LONG_EDGE="${3:-1030}"

mkdir -p "$OUTPUT_DIR"
cd "$MODEL_DIR"

MPLBACKEND=Agg PYTORCH_ENABLE_MPS_FALLBACK=1 "$PYTHON_BIN" demo_prog.py \
  --img_path "$INPUT_IMAGE" \
  --canvas_color white \
  --canvas_size "$LONG_EDGE" \
  --keep_aspect_ratio \
  --max_m_strokes 500 \
  --max_divide 5 \
  --iters_per_scale 500 \
  --renderer oilpaintbrush \
  --renderer_checkpoint_dir checkpoints_G_oilpaintbrush_light \
  --net_G zou-fusion-net-light \
  --output_dir "$OUTPUT_DIR" \
  --disable_preview \
  --seed 17
