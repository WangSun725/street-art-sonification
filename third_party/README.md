# Third-party dependencies

This directory is populated locally and is intentionally kept out of Git.

The macOS installer downloads the exact dependencies required by the interactive web application:

- [SAM 2](https://github.com/facebookresearch/sam2), pinned to commit `2b90b9f5ceec907a1c18123530e92e794ad901a4`.
- [SAM 2.1 Hiera Tiny](https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt).
- [Qwen3-VL 2B Instruct 4-bit for MLX](https://huggingface.co/mlx-community/Qwen3-VL-2B-Instruct-4bit).

Model weights, cloned source repositories, and downloaded caches must not be committed to this repository.

SAM 2 and Qwen3-VL are distributed under Apache 2.0. MLX-VLM is distributed under the MIT License. Refer to each upstream project for its complete license terms.

## Optional Qwen3.5-9B proposal model

Run from the project root after the standard macOS installation.

```sh
HF_HUB_DISABLE_XET=1 .interaction-env/bin/hf download mlx-community/Qwen3.5-9B-4bit --local-dir third_party/models/Qwen3.5-9B-4bit
STREET_ART_PORT=8769 STREET_ART_PROPOSAL_MODEL=qwen3.5-9b './Start Street Art Sonification.command'
```

Qwen3.5-9B provides initial names, categories, and locations for painted features and handles any retries at that stage. The existing Qwen3-VL 2B checkpoint still handles artwork framing, local recovery and mask review. The default proposal model is `qwen3-vl-2b`.
