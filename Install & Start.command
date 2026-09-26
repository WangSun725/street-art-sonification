#!/bin/zsh
set -eu

PROJECT_DIR="${0:A:h}"
cd "$PROJECT_DIR"

pause_on_error() {
  local exit_code=$?
  echo
  echo "Installation stopped before completion."
  echo "Please read the error above, then press Return to close this window."
  read -r
  exit "$exit_code"
}
trap pause_on_error ZERR

echo
echo "Street Art Sonification"
echo "First-time setup for Apple Silicon Mac"
echo

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This release supports macOS only."
  false
fi

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "This release requires an Apple Silicon Mac (M1, M2, M3, or M4)."
  false
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "The macOS curl command could not be found."
  false
fi

TOOLS_DIR="$PROJECT_DIR/.tools"
TOOLS_BIN="$TOOLS_DIR/bin"
UV_BIN="$TOOLS_BIN/uv"
export UV_CACHE_DIR="$PROJECT_DIR/.cache/uv"
export UV_PYTHON_INSTALL_DIR="$TOOLS_DIR/python"
export HF_HOME="$PROJECT_DIR/.cache/huggingface"

mkdir -p "$TOOLS_BIN" "$PROJECT_DIR/third_party/models" "$PROJECT_DIR/.cache"

if [[ ! -x "$UV_BIN" ]]; then
  echo "[1/6] Installing the local environment manager…"
  curl -LsSf https://astral.sh/uv/install.sh | env UV_UNMANAGED_INSTALL="$TOOLS_BIN" sh
else
  echo "[1/6] Environment manager is ready."
fi

if [[ ! -x "$PROJECT_DIR/.interaction-env/bin/python" ]]; then
  echo "[2/6] Creating the vision-model environment…"
  "$UV_BIN" venv --python 3.12 "$PROJECT_DIR/.interaction-env"
else
  echo "[2/6] Vision-model environment already exists."
fi
"$UV_BIN" pip install --python "$PROJECT_DIR/.interaction-env/bin/python" -r "$PROJECT_DIR/requirements-interaction.txt"

if [[ ! -x "$PROJECT_DIR/.venv/bin/python" ]]; then
  echo "[3/6] Creating the segmentation environment…"
  "$UV_BIN" venv --python 3.11 "$PROJECT_DIR/.venv"
else
  echo "[3/6] Segmentation environment already exists."
fi
"$UV_BIN" pip install --python "$PROJECT_DIR/.venv/bin/python" -r "$PROJECT_DIR/requirements-sam.txt"

SAM_COMMIT="2b90b9f5ceec907a1c18123530e92e794ad901a4"
SAM_DIR="$PROJECT_DIR/third_party/sam2"
SAM_DOWNLOADS="$TOOLS_DIR/downloads"
SAM_ARCHIVE="$SAM_DOWNLOADS/sam2-$SAM_COMMIT.tar.gz"
SAM_EXTRACTED="$PROJECT_DIR/third_party/sam2-$SAM_COMMIT"
mkdir -p "$SAM_DOWNLOADS"

if [[ ! -f "$SAM_DIR/sam2/__init__.py" ]]; then
  echo "[4/6] Downloading the SAM 2.1 source…"
  curl -L --fail --continue-at - \
    -o "$SAM_ARCHIVE" \
    "https://github.com/facebookresearch/sam2/archive/$SAM_COMMIT.tar.gz"
  tar -xzf "$SAM_ARCHIVE" -C "$PROJECT_DIR/third_party"
  mv "$SAM_EXTRACTED" "$SAM_DIR"
else
  echo "[4/6] SAM 2.1 source is ready."
fi

echo "Installing SAM 2.1 into its local environment…"
SAM2_BUILD_CUDA=0 "$UV_BIN" pip install \
  --python "$PROJECT_DIR/.venv/bin/python" \
  --no-build-isolation \
  -e "$SAM_DIR"

SAM_CHECKPOINT="$SAM_DIR/checkpoints/sam2.1_hiera_tiny.pt"
mkdir -p "$SAM_DIR/checkpoints"
if [[ ! -s "$SAM_CHECKPOINT" ]]; then
  echo "[5/6] Downloading SAM 2.1 Hiera Tiny (approximately 149 MB)…"
  curl -L --fail --continue-at - \
    -o "$SAM_CHECKPOINT.part" \
    "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt"
  mv "$SAM_CHECKPOINT.part" "$SAM_CHECKPOINT"
else
  echo "[5/6] SAM checkpoint is ready."
fi

QWEN_DIR="$PROJECT_DIR/third_party/models/Qwen3-VL-2B-Instruct-4bit"
if [[ ! -s "$QWEN_DIR/model.safetensors" ]]; then
  echo "[6/6] Downloading Qwen3-VL 2B 4-bit (approximately 1.7 GB)…"
  "$PROJECT_DIR/.interaction-env/bin/hf" download \
    mlx-community/Qwen3-VL-2B-Instruct-4bit \
    --local-dir "$QWEN_DIR"
else
  echo "[6/6] Qwen3-VL model is ready."
fi

echo
echo "Installation complete. Starting Street Art Sonification…"
echo
trap - ZERR
exec "$PROJECT_DIR/Start Street Art Sonification.command"
