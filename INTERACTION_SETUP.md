# Local interaction-model setup

The preparation stack is installed and verified on this MacBook Pro (M1 Pro,
32 GB unified memory). It is deliberately separate from the live browser audio
path: the models prepare masks and metadata; the browser performs responsive
interaction without inference latency.

## Installed components

### Qwen3-VL 2B Instruct, MLX 4-bit

- Runtime: `.interaction-env/`
- Weights: `third_party/models/Qwen3-VL-2B-Instruct-4bit/`
- On-disk model size: approximately 1.8 GB
- License: Apache 2.0
- Purpose: street-art vocabulary, region proposals, bounding boxes, and links
  between visual regions and the artist statement

The environment also contains FastAPI, Uvicorn, Pillow, and OpenCV for the
future local preparation service.

### SAM 2.1 Hiera Tiny

- Runtime: existing `.venv/`
- Source: `third_party/sam2/`
- Checkpoint: `third_party/sam2/checkpoints/sam2.1_hiera_tiny.pt`
- Checkpoint size: approximately 156 MB
- License: Apache 2.0
- Purpose: convert approved points or boxes into accurate pixel masks

## Verified commands

Run Qwen3-VL on the included artwork:

```bash
.interaction-env/bin/python -m mlx_vlm.generate \
  --model third_party/models/Qwen3-VL-2B-Instruct-4bit \
  --max-tokens 180 \
  --temperature 0.0 \
  --prompt "Analyze this completed street artwork. Return 6 to 8 playable regions using the types wall, figure, lettering, outline, fill, drip, overpaint, and decay. Do not invent painting history." \
  --image inputs/the-defiant-one.webp
```

The verified output identified wall, figure, lettering, outline, fill, drip,
and overpaint candidates. A single image analysis took roughly tens of seconds,
which is suitable for preparation but should not run on every pointer event.

The SAM 2 smoke test produced:

`outputs/interactive-prep/sam2_center_test_mask.png`

It used one positive point near the image center and selected the best of three
masks. The chosen mask confidence was approximately `0.902`.

## Recreating the environment

Create the MLX environment and install the pinned top-level dependencies:

```bash
/opt/anaconda3/bin/python3.12 -m venv .interaction-env
.interaction-env/bin/pip install -r requirements-interaction.txt
```

Clone and install SAM 2 without attempting to build its CUDA extension:

```bash
git clone --depth 1 https://github.com/facebookresearch/sam2.git third_party/sam2
SAM2_BUILD_CUDA=0 .venv/bin/pip install --no-build-isolation -e third_party/sam2
```

Download the SAM 2.1 Tiny checkpoint:

```bash
curl -L --fail \
  -o third_party/sam2/checkpoints/sam2.1_hiera_tiny.pt \
  https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt
```

Download the MLX Qwen model:

```bash
.interaction-env/bin/hf download \
  mlx-community/Qwen3-VL-2B-Instruct-4bit \
  --local-dir third_party/models/Qwen3-VL-2B-Instruct-4bit
```

## Performance strategy

- Preparation: Qwen proposes semantic boxes and SAM refines approved regions.
- Review: the author/researcher keeps only 6–10 meaningful regions.
- Export: preparation produces mask PNG files and `regions.json`.
- Performance: the browser loads those static artifacts and synthesizes sound
  with Web Audio. It does not keep either model in memory.

## Hardware assessment

- 32 GB unified memory is sufficient for both selected models.
- Qwen is 4-bit and only 2B parameters, making it appropriate for Apple MLX.
- SAM 2 Tiny has 38.9M parameters and runs successfully through Metal here.
- The larger practical constraint is disk space, so no additional generative
  music model is included in the classroom prototype.
