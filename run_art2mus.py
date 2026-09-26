#!/usr/bin/env python3
"""Generate an artwork-conditioned music clip with Art2Mus."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
ART2MUS_DIR = PROJECT_DIR / "third_party" / "art2mus"

# Keep downloaded Hugging Face weights inside this project and make unsupported
# MPS operators fall back to CPU when necessary.
os.environ.setdefault("HF_HOME", str(PROJECT_DIR / ".cache" / "huggingface"))
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

sys.path.insert(0, str(ART2MUS_DIR / "src"))
os.chdir(ART2MUS_DIR)

import numpy as np
import scipy.io.wavfile
import torch
from scipy.signal import stft

import conf
from art2mus.art2mus_pipeline import AudioLDM2Pipeline as Art2MusPipeline
from art2mus.art2mus_4_pipeline import AudioLDM2Pipeline as Art2Mus4Pipeline


def low_frequency_ratio(waveform: np.ndarray, sample_rate: int = 16000) -> float:
    """Return the fraction of STFT power below 500 Hz."""
    frequencies, _, spectrum = stft(
        np.asarray(waveform, dtype=np.float32),
        fs=sample_rate,
        nperseg=1024,
        noverlap=768,
    )
    power = np.abs(spectrum) ** 2
    return float(power[frequencies < 500].sum() / max(power.sum(), 1e-12))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--seconds", type=float, default=10.0)
    parser.add_argument("--steps", type=int, default=200)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--candidates", type=int, default=3)
    parser.add_argument("--device", choices=("auto", "cpu", "mps", "cuda"), default="auto")
    parser.add_argument("--keep-candidates", action="store_true")
    parser.add_argument("--model", choices=("art2mus", "art2mus-4"), default="art2mus")
    parser.add_argument("--negative-prompt", default="Low quality.")
    parser.add_argument("--prompt", default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    image = args.image.expanduser().resolve()
    output = args.output.expanduser().resolve()
    if not image.is_file():
        raise FileNotFoundError(image)
    output.parent.mkdir(parents=True, exist_ok=True)

    requested_device = args.device
    if requested_device == "cpu":
        device = torch.device("cpu")
        dtype = torch.float32
    elif requested_device == "mps":
        if not torch.backends.mps.is_available():
            raise RuntimeError("MPS is not available")
        device = torch.device("mps")
        dtype = torch.float32
    elif requested_device == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA is not available")
        device = torch.device("cuda")
        dtype = torch.float16
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
        # Art2Mus is numerically unstable in FP16 on Metal: both the author's
        # sample image and arbitrary inputs collapse into low-frequency rumble.
        dtype = torch.float32
    elif torch.cuda.is_available():
        device = torch.device("cuda")
        dtype = torch.float16
    else:
        device = torch.device("cpu")
        dtype = torch.float32

    if args.model == "art2mus":
        pipeline_class = Art2MusPipeline
        pipeline_path = ART2MUS_DIR / "src" / "art2mus" / "art2mus_pipeline.py"
    else:
        pipeline_class = Art2Mus4Pipeline
        pipeline_path = ART2MUS_DIR / "src" / "art2mus" / "art2mus_4_pipeline.py"

    print(f"Loading {args.model} on {device} ({dtype})", flush=True)
    pipe = pipeline_class.from_pretrained(
        "cvssp/audioldm2",
        torch_dtype=dtype,
        custom_pipeline=str(pipeline_path),
        local_files_only=True,
    )
    # The custom pipeline keeps its embedding dtype in a module-level global.
    # Keep it aligned with the model precision to avoid mixed FP16/FP32 matrix
    # multiplication failures on Metal.
    sys.modules[pipe.__class__.__module__].EMBEDS_DTYPE = dtype
    pipe = pipe.to(device)

    # MPS does not provide a device-specific Generator; Diffusers safely samples
    # with a CPU generator and moves the latents to Metal.
    generator_device = "cuda" if device.type == "cuda" else "cpu"
    generator = torch.Generator(generator_device).manual_seed(args.seed)

    print(
        f"Generating {args.seconds:g}s from {image.name} with {args.steps} steps...",
        flush=True,
    )
    with torch.inference_mode():
        waveforms = pipe(
            prompt=args.prompt,
            image_path=str(image),
            negative_prompt=args.negative_prompt,
            num_inference_steps=args.steps,
            audio_length_in_s=args.seconds,
            num_waveforms_per_prompt=args.candidates,
            generator=generator,
        ).audios

    ratios = [low_frequency_ratio(candidate) for candidate in waveforms]
    for index, ratio in enumerate(ratios, start=1):
        print(f"Candidate {index}: power below 500 Hz = {ratio:.1%}", flush=True)

    # Art2Mus' built-in ImageBind ranking checks image/audio similarity but can
    # rank a low-frequency drone first. Among the image-conditioned candidates,
    # prefer the one least affected by that failure mode.
    best_index = int(np.argmin(ratios))
    print(f"Selected candidate {best_index + 1}", flush=True)

    if args.keep_candidates and len(waveforms) > 1:
        for index, candidate in enumerate(waveforms, start=1):
            candidate_path = output.with_name(
                f"{output.stem}.candidate-{index:02d}{output.suffix}"
            )
            scipy.io.wavfile.write(
                candidate_path,
                rate=16000,
                data=np.asarray(candidate, dtype=np.float32),
            )
            print(f"Saved candidate: {candidate_path}", flush=True)

    waveform = waveforms[best_index]

    waveform = np.asarray(waveform, dtype=np.float32)
    scipy.io.wavfile.write(output, rate=16000, data=waveform)
    print(f"Saved: {output}", flush=True)


if __name__ == "__main__":
    main()
