#!/usr/bin/env python3
"""Local web application for the street-art sonification prototype."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles


ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = Path(__file__).resolve().parent
RUNTIME_DIR = WEB_DIR / "runtime"
JOBS_DIR = RUNTIME_DIR / "jobs"
DEMO_IMAGE = ROOT / "inputs" / "the-defiant-one.webp"
DEMO_DIR = ROOT / "outputs" / "interactive-prep" / "the-defiant-one-regions"
QWEN_PYTHON = ROOT / ".interaction-env" / "bin" / "python"
SAM_PYTHON = ROOT / ".venv" / "bin" / "python"
QWEN_MODEL = ROOT / "third_party" / "models" / "Qwen3-VL-2B-Instruct-4bit"
SAM_SCRIPT = WEB_DIR / "analyze_regions.py"
MAX_UPLOAD_BYTES = 16 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
JOBS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Street Art Resonance Lab")
app.mount("/static", StaticFiles(directory=WEB_DIR / "static"), name="static")
app.mount("/runtime", StaticFiles(directory=RUNTIME_DIR), name="runtime")

jobs: dict[str, dict[str, Any]] = {}
latest_state: dict[str, Any] = {
    "type": "pointer_state",
    "region": None,
    "normalized": {"x": 0, "y": 0},
    "speed": 0,
    "edgeProximity": 0,
    "dwellMs": 0,
    "timestamp": 0,
}
event_clients: set[WebSocket] = set()
analysis_lock = asyncio.Lock()


def demo_payload() -> dict[str, Any]:
    manifest = json.loads((DEMO_DIR / "regions.json").read_text(encoding="utf-8"))
    manifest["analysis_id"] = "demo"
    manifest["image_url"] = "/assets/demo/image"
    manifest["status"] = "ready"
    for region in manifest["regions"]:
        region["visual_mask_url"] = f"/assets/demo/{region['visual_mask']}"
        region["hit_mask_url"] = f"/assets/demo/{region['hit_mask']}"
        region.pop("label_zh", None)
    return manifest


def extract_json(text: str) -> dict[str, Any]:
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    candidate = fenced.group(1) if fenced else None
    if candidate is None:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            candidate = text[start : end + 1]
    if not candidate:
        raise ValueError("The vision model did not return JSON")
    return json.loads(candidate)


def slug(value: str, fallback: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return value[:40] or fallback


def normalize_proposals(raw: dict[str, Any]) -> list[dict[str, Any]]:
    proposals: list[dict[str, Any]] = []
    seen_boxes: list[list[int]] = []
    colors = [
        [245, 192, 54], [232, 82, 120], [57, 195, 178], [84, 134, 247],
        [164, 102, 245], [32, 170, 228], [247, 142, 43], [233, 70, 67],
        [126, 211, 33], [22, 184, 213],
    ]
    valid_types = {"figure", "face", "gesture", "lettering", "wall", "texture", "detail", "symbol", "fill"}
    for index, item in enumerate(raw.get("regions", [])):
        if not isinstance(item, dict):
            continue
        try:
            box = [max(0, min(1000, int(float(v)))) for v in item["bbox"][:4]]
            point = [max(0, min(1000, int(float(v)))) for v in item["point"][:2]]
        except (KeyError, TypeError, ValueError):
            continue
        x1, y1, x2, y2 = box
        if x2 - x1 < 25 or y2 - y1 < 25:
            continue
        # Different abstract labels on the same rectangle are not different
        # playable regions. Remove near-identical proposals before SAM.
        def overlap(a: list[int], b: list[int]) -> float:
            ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
            iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
            intersection = ix * iy
            union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - intersection
            return intersection / union if union else 0
        if any(overlap(box, previous) > 0.92 for previous in seen_boxes):
            continue
        seen_boxes.append(box)
        label = str(item.get("label") or f"Region {index + 1}").strip()[:48]
        region_type = str(item.get("type", "detail")).lower()
        if region_type not in valid_types:
            region_type = "detail"
        margin_x = max(8, int((x2 - x1) * 0.06))
        margin_y = max(8, int((y2 - y1) * 0.06))
        if not (x1 + margin_x <= point[0] <= x2 - margin_x and y1 + margin_y <= point[1] <= y2 - margin_y):
            point = [(x1 + x2) // 2, (y1 + y2) // 2]
        proposals.append({
            "id": slug(str(item.get("id") or label), f"region_{index + 1}"),
            "label": label,
            "type": region_type,
            "bbox": box,
            "point": point,
            "meaning": str(item.get("meaning") or "").strip()[:180],
            "color_rgb": colors[len(proposals) % len(colors)],
        })
        if len(proposals) == 10:
            break

    fallbacks = [
        ("paint_surface", "Painted wall field", "wall", [0, 0, 1000, 1000], [80, 100]),
        ("upper_marks", "Upper painted marks", "lettering", [0, 0, 1000, 480], [180, 160]),
        ("lower_texture", "Lower wall texture", "texture", [0, 480, 1000, 1000], [160, 800]),
        ("central_form", "Central painted form", "figure", [180, 100, 850, 1000], [500, 540]),
        ("left_marks", "Left painted marks", "texture", [0, 120, 340, 920], [140, 520]),
        ("right_marks", "Right painted marks", "texture", [660, 100, 1000, 920], [860, 500]),
        ("focal_detail", "Focal painted detail", "detail", [280, 100, 760, 560], [510, 320]),
    ]
    for rid, label, kind, box, point in fallbacks:
        if len(proposals) >= 6:
            break
        proposals.append({
            "id": rid,
            "label": label,
            "type": kind,
            "bbox": box,
            "point": point,
            "meaning": "A structural street-art layer used for interaction.",
            "color_rgb": colors[len(proposals) % len(colors)],
        })
    return proposals


def qwen_prompt(statement: str) -> str:
    context = statement.strip() or "No artist statement was supplied. Infer only visually evident content."
    return f"""Analyze this completed street-art image as material for an accessible interactive sound artwork.
Artist statement: {context[:1200]}
Return ONLY valid JSON, no markdown. Use this schema:
{{"regions":[{{"id":"snake_case","label":"short English label","type":"figure|face|gesture|lettering|wall|texture|detail|symbol|fill","bbox":[x1,y1,x2,y2],"point":[x,y],"meaning":"one short sensory interpretation"}}]}}
Coordinates are normalized integers 0-1000. Return exactly 8 distinct playable regions, one for each line below. If a listed feature is absent, replace it with another concrete visible painted shape:
1. main painted figure or largest focal object
2. face or focal internal detail
3. gesture, hand, accessory or held object
4. one actual painted lettering or glyph cluster
5. a second different painted mark or color field
6. exposed wall/material region
7. paint drip, crack, weathering or spray texture
8. another small distinctive painted symbol or detail
Every label must name what is visibly there (for example "woman with sunglasses", "black upper-left glyphs", "yellow wall field"), never only an abstract word such as "color", "texture", "detail" or "symbol". Use at most one box covering more than 60% of the image. All other boxes must tightly surround different visible shapes. Nested details are allowed, but duplicate boxes are forbidden. Each point must be well inside the intended painted shape, not on a box edge or empty background. Keep meaning under 12 words and connect the visible mark to a tactile or sonic quality."""


async def run_command(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    return await asyncio.to_thread(
        subprocess.run,
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )


async def analyze_job(job_id: str, image_path: Path, statement: str) -> None:
    job = jobs[job_id]
    async with analysis_lock:
        try:
            job.update(stage="vision", message="Reading the street-art elements…", progress=18)
            qwen = await run_command([
                str(QWEN_PYTHON), "-m", "mlx_vlm.generate",
                "--model", str(QWEN_MODEL), "--image", str(image_path),
                "--prompt", qwen_prompt(statement), "--max-tokens", "1500",
                "--temperature", "0", "--no-verbose",
            ], timeout=240)
            if qwen.returncode != 0:
                raise RuntimeError(qwen.stderr.strip()[-600:] or "Vision analysis failed")
            proposals = normalize_proposals(extract_json(qwen.stdout))
            proposal_path = image_path.parent / "proposals.json"
            proposal_path.write_text(json.dumps({"regions": proposals}, ensure_ascii=False, indent=2), encoding="utf-8")

            job.update(stage="segment", message=f"Defining {len(proposals)} interactive regions…", progress=52)
            result_dir = image_path.parent / "result"
            sam = await run_command([
                str(SAM_PYTHON), str(SAM_SCRIPT),
                "--image", str(image_path), "--proposals", str(proposal_path),
                "--output", str(result_dir),
            ], timeout=360)
            if sam.returncode != 0:
                raise RuntimeError(sam.stderr.strip()[-900:] or "Mask generation failed")

            manifest_path = result_dir / "regions.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest.update({
                "analysis_id": job_id,
                "image_url": f"/runtime/jobs/{job_id}/{image_path.name}",
                "status": "ready",
                "artist_statement": statement,
            })
            for region in manifest["regions"]:
                region["visual_mask_url"] = f"/runtime/jobs/{job_id}/result/{region['visual_mask']}"
                region["hit_mask_url"] = f"/runtime/jobs/{job_id}/result/{region['hit_mask']}"
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
            job.update(status="ready", stage="ready", message="Analysis complete. The artwork is ready to explore.", progress=100, result=manifest)
        except Exception as exc:
            job.update(status="error", stage="error", message=str(exc), progress=100)


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(WEB_DIR / "static" / "index.html")


@app.get("/favicon.svg")
async def favicon() -> FileResponse:
    return FileResponse(WEB_DIR / "static" / "favicon.svg", media_type="image/svg+xml")


@app.get("/api/demo")
async def api_demo() -> JSONResponse:
    return JSONResponse(demo_payload())


@app.get("/assets/demo/image")
async def demo_image() -> FileResponse:
    return FileResponse(DEMO_IMAGE)


@app.get("/assets/demo/{filename}")
async def demo_asset(filename: str) -> FileResponse:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", filename):
        raise HTTPException(status_code=404)
    path = DEMO_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404)
    return FileResponse(path)


@app.post("/api/analyze")
async def api_analyze(
    image: UploadFile = File(...),
    statement: str = Form(default=""),
) -> JSONResponse:
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Please upload a JPG, PNG, or WebP image.")
    data = await image.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="The image must be smaller than 16 MB.")
    if not data:
        raise HTTPException(status_code=400, detail="The image file is empty.")

    if hashlib.sha256(data).digest() == hashlib.sha256(DEMO_IMAGE.read_bytes()).digest():
        return JSONResponse(demo_payload())

    job_id = uuid.uuid4().hex[:12]
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True)
    extension = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[image.content_type]
    image_path = job_dir / f"artwork{extension}"
    image_path.write_bytes(data)
    jobs[job_id] = {
        "analysis_id": job_id,
        "status": "analyzing",
        "stage": "queued",
        "message": "Image received. Preparing the analysis…",
        "progress": 5,
        "created_at": time.time(),
    }
    asyncio.create_task(analyze_job(job_id, image_path, statement))
    return JSONResponse(jobs[job_id], status_code=202)


@app.get("/api/analyze/{job_id}")
async def api_analyze_status(job_id: str) -> JSONResponse:
    job = jobs.get(job_id)
    if not job:
        manifest_path = JOBS_DIR / job_id / "result" / "regions.json"
        if manifest_path.is_file():
            return JSONResponse(json.loads(manifest_path.read_text(encoding="utf-8")))
        raise HTTPException(status_code=404, detail="This analysis could not be found.")
    return JSONResponse(job)


@app.get("/api/state")
async def api_state() -> JSONResponse:
    return JSONResponse(latest_state)


@app.websocket("/ws/events")
async def ws_events(websocket: WebSocket) -> None:
    await websocket.accept()
    event_clients.add(websocket)
    await websocket.send_json({"type": "connected", "message": "Street Art control stream ready"})
    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "pointer_state":
                latest_state.clear()
                latest_state.update(message)
                stale: list[WebSocket] = []
                for client in event_clients:
                    if client is websocket:
                        continue
                    try:
                        await client.send_json(message)
                    except Exception:
                        stale.append(client)
                for client in stale:
                    event_clients.discard(client)
    except WebSocketDisconnect:
        event_clients.discard(websocket)


@app.on_event("shutdown")
async def clean_old_jobs() -> None:
    # Uploads are demo-session data; keep recent results so the page can reload.
    cutoff = time.time() - 24 * 60 * 60
    for directory in JOBS_DIR.iterdir():
        if directory.is_dir() and directory.stat().st_mtime < cutoff:
            shutil.rmtree(directory, ignore_errors=True)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("STREET_ART_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port)
