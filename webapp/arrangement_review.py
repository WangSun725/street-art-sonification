"""Local audition files and persistent human reviews, separate from live output."""
from __future__ import annotations

import asyncio
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

WEB_DIR = Path(__file__).resolve().parent
REVIEW_ROOT = WEB_DIR / "runtime/arrangement-review"
router = APIRouter()
rating_lock = threading.Lock()
audio_lock = asyncio.Lock()


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def load_round(number: int | None = None) -> tuple[Path, dict]:
    try:
        if number is None:
            number = int(json.loads((REVIEW_ROOT / "current.json").read_text())["round"])
        if not 1 <= number <= 99:
            raise ValueError()
        folder = REVIEW_ROOT / f"round-{number:02d}"
        manifest = json.loads((folder / "manifest.json").read_text())
        return folder, manifest
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(404, "The audition library has not been prepared yet.") from exc


def item_for(manifest: dict, clip_id: str) -> dict:
    item = next((item for item in manifest["items"] if item["id"] == clip_id), None)
    if item is None:
        raise HTTPException(404, "Unknown audition.")
    return item


def load_ratings() -> dict:
    try:
        return json.loads((REVIEW_ROOT / "ratings.json").read_text())
    except FileNotFoundError:
        return {"schema": 1, "rounds": {}}


@contextmanager
def locked_ratings():
    # The main app and standalone reviewer may both be open. A file lock keeps
    # concurrent browser saves from losing decisions across the two processes.
    with rating_lock:
        REVIEW_ROOT.mkdir(parents=True, exist_ok=True)
        with (REVIEW_ROOT / "ratings.lock").open("a") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


@router.get("/review")
async def review_page() -> FileResponse:
    return FileResponse(WEB_DIR / "static/arrangement-review.html", headers={"Cache-Control": "no-store"})


@router.get("/review/render")
async def render_page() -> FileResponse:
    return FileResponse(WEB_DIR / "static/arrangement-render.html", headers={"Cache-Control": "no-store"})


@router.get("/api/arrangement-review/manifest")
async def review_manifest(round: int | None = None) -> JSONResponse:
    folder, manifest = load_round(round)
    # Readiness reflects completed files, including a resumed rendering session.
    for item in manifest["items"]:
        checks = folder / "checks" / (item["id"] + ".json")
        item["ready"] = (folder / "audio" / (item["id"] + ".mp3")).is_file() and checks.is_file()
        item["dryReady"] = (folder / "dry" / (item["id"] + ".wav")).is_file() and (folder / "scores" / (item["id"] + ".json")).is_file()
        if checks.is_file():
            item["audioChecks"] = json.loads(checks.read_text())
    archive = folder / f"auditions-round-{manifest['round']:02d}.zip"
    manifest["packUrl"] = f"/runtime/arrangement-review/{folder.name}/{archive.name}" if archive.is_file() else None
    return JSONResponse(manifest, headers={"Cache-Control": "no-store"})


@router.get("/api/arrangement-review/ratings")
async def review_ratings(round: int | None = None) -> JSONResponse:
    _, manifest = load_round(round)
    with locked_ratings():
        ratings = load_ratings().get("rounds", {}).get(str(manifest["round"]), {})
    return JSONResponse({"round": manifest["round"], "ratings": ratings}, headers={"Cache-Control": "no-store"})


class Rating(BaseModel):
    status: Literal["unreviewed", "keep", "redo"]
    notes: str = Field(default="", max_length=2000)
    revision: int = Field(ge=1, le=99)


@router.put("/api/arrangement-review/ratings/{clip_id}")
async def save_rating(clip_id: str, rating: Rating, round: int | None = None) -> JSONResponse:
    folder, manifest = load_round(round)
    item = item_for(manifest, clip_id)
    if rating.revision != item["revision"]:
        raise HTTPException(409, "This audition has changed. Reload before reviewing it.")
    checks_path = folder / "checks" / (clip_id + ".json")
    if not checks_path.is_file() or not (folder / "audio" / (clip_id + ".mp3")).is_file():
        raise HTTPException(409, "Wait for this audition to finish rendering.")
    checks = json.loads(checks_path.read_text())
    record = {**rating.model_dump(), "updatedAt": time.time(), "audioSha256": checks["sha256"]}
    with locked_ratings():
        store = load_ratings()
        store.setdefault("rounds", {}).setdefault(str(manifest["round"]), {})[clip_id] = record
        write_json(REVIEW_ROOT / "ratings.json", store)
    return JSONResponse(record)


@router.post("/api/arrangement-review/audio/{clip_id}")
async def save_rendered_audio(clip_id: str, request: Request, round: int | None = None) -> JSONResponse:
    folder, manifest = load_round(round)
    item = item_for(manifest, clip_id)
    final = folder / "audio" / (clip_id + ".mp3")
    chunks, length = [], 0
    async for chunk in request.stream():
        length += len(chunk)
        if length > 80 * 1024 * 1024:
            raise HTTPException(413, "Audition WAV exceeds 80 MB.")
        chunks.append(chunk)
    wav = b"".join(chunks)
    if len(wav) < 44 or wav[:4] != b"RIFF" or wav[8:12] != b"WAVE":
        raise HTTPException(422, "Expected a rendered WAV file.")
    async with audio_lock:
        if final.is_file():
            raise HTTPException(409, "This round already has an audio file. Use a new round to preserve reviews.")
        token = uuid.uuid4().hex
        source = folder / "audio" / (token + ".wav")
        encoded = folder / "audio" / (token + ".mp3")
        source.write_bytes(wav)
        try:
            result = await asyncio.to_thread(subprocess.run, [
                "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                "-i", str(source), "-af", "alimiter=limit=0.891251:level=false:latency=true",
                "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "48000",
                "-metadata", "title=" + item["name"] + " - C " + item["mode"],
                "-metadata", "comment=Round " + str(manifest["round"]) + " arrangement audition; shared live FM and Web Audio effects",
                str(encoded),
            ], capture_output=True, text=True, timeout=90, check=False)
            if result.returncode:
                raise HTTPException(500, result.stderr[-800:] or "Audio encoding failed.")
            probe = await asyncio.to_thread(subprocess.run, [
                "ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=sample_rate,channels",
                "-of", "json", str(encoded),
            ], capture_output=True, text=True, timeout=15, check=True)
            info = json.loads(probe.stdout)
            if not info["streams"] or info["streams"][0]["channels"] != 2:
                raise HTTPException(500, "The audition did not render as stereo.")
            score = json.loads((folder / "scores" / (clip_id + ".json")).read_text())
            if abs(float(info["format"]["duration"]) - score["totalSeconds"]) > .15:
                raise HTTPException(500, "Rendered duration does not match the score.")
            checksum = hashlib.sha256(encoded.read_bytes()).hexdigest()
            checks = {"sha256": checksum, "seconds": float(info["format"]["duration"]),
                      "bytes": int(info["format"]["size"]), "sampleRate": 48000, "channels": 2,
                      "renderedAt": time.time(), "revision": item["revision"]}
            os.replace(encoded, final)
            write_json(folder / "checks" / (clip_id + ".json"), checks)
            # Only generated intermediates are removed. MP3, score and MIDI stay.
            (folder / "dry" / (clip_id + ".wav")).unlink(missing_ok=True)
            return JSONResponse(checks)
        finally:
            source.unlink(missing_ok=True)
            encoded.unlink(missing_ok=True)
