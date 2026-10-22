# Third-party dependencies

This directory is populated locally and is intentionally kept out of Git.

The macOS installer downloads the exact dependencies required by the interactive web application:

- [SAM 2](https://github.com/facebookresearch/sam2), pinned to commit `2b90b9f5ceec907a1c18123530e92e794ad901a4`.
- [SAM 2.1 Hiera Tiny](https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt).
- [Qwen3-VL 2B Instruct 4-bit for MLX](https://huggingface.co/mlx-community/Qwen3-VL-2B-Instruct-4bit).

Model weights, cloned source repositories, and downloaded caches must not be committed to this repository.

SAM 2 and Qwen3-VL are distributed under Apache 2.0. MLX-VLM is distributed under the MIT License. Refer to each upstream project for its complete license terms.
