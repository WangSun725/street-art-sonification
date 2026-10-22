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

from image_preprocessing import ImagePreparationError, prepare_uploaded_image
from output_bridge import ExternalOutputManager


ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = Path(__file__).resolve().parent
RUNTIME_DIR = WEB_DIR / "runtime"
JOBS_DIR = RUNTIME_DIR / "jobs"
OUTPUT_CONFIG = RUNTIME_DIR / "external-output.json"
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
external_output = ExternalOutputManager(OUTPUT_CONFIG)


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
    """Return the first complete region object from a model response.

    Local vision models occasionally add a second JSON object, a short note,
    or Markdown fences after the requested payload. ``json.loads`` rejects
    that otherwise usable response as ``Extra data``. ``raw_decode`` stops at
    the end of the first complete value, so scan each opening brace and keep
    the first object that contains the expected regions array.
    """
    decoder = json.JSONDecoder()
    decoded_objects: list[dict[str, Any]] = []
    region_objects: list[dict[str, Any]] = []
    for match in re.finditer(r"[\{\[]", text):
        try:
            value, _ = decoder.raw_decode(text[match.start():])
        except json.JSONDecodeError:
            continue
        if isinstance(value, list) and value and all(isinstance(item, dict) for item in value):
            region_objects.append({"regions": value})
            continue
        if not isinstance(value, dict):
            continue
        if isinstance(value.get("regions"), list):
            region_objects.append(value)
            continue
        decoded_objects.append(value)
    if region_objects:
        def proposal_score(value: dict[str, Any]) -> tuple[int, int]:
            regions = value.get("regions", [])
            complete = sum(
                1 for item in regions
                if isinstance(item, dict)
                and isinstance(item.get("bbox"), list) and len(item["bbox"]) >= 4
                and isinstance(item.get("point"), list) and len(item["point"]) >= 2
            )
            return complete, len(regions)

        return max(region_objects, key=proposal_score)
    if decoded_objects:
        return decoded_objects[0]
    raise ValueError("The vision model did not return valid JSON")


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
        except (KeyError, TypeError, ValueError):
            continue
        if len(box) != 4:
            continue
        x1, y1, x2, y2 = box
        if x2 - x1 < 25 or y2 - y1 < 25:
            continue
        try:
            point = [max(0, min(1000, int(float(v)))) for v in item.get("point", [])[:2]]
            if len(point) != 2:
                raise ValueError
        except (TypeError, ValueError):
            point = [(x1 + x2) // 2, (y1 + y2) // 2]
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
        region_name = str(item.get("region") or "").strip()
        label = str(item.get("label") or region_name or f"Region {index + 1}").strip()[:48]
        generic_labels = {
            "main painted figure or largest focal object",
            "face or focal internal detail",
            "gesture, hand, accessory or held object",
            "one actual painted lettering or glyph cluster",
            "a second different painted mark or color field",
            "exposed wall/material region",
            "paint drip, crack, weathering or spray texture",
            "another small distinctive painted symbol or detail",
            "one additional concrete painted object, mark, or material feature when clearly visible",
            "short english label",
        }
        meaning = str(item.get("meaning") or "").strip()
        if label.lower() in generic_labels:
            if region_name:
                label = region_name
            elif meaning:
                # Small local VLMs occasionally copy a schema placeholder even
                # when asked for a concrete label. The interpretation is still
                # image-specific, so use its opening phrase as the visible name.
                label = re.sub(r"^(the|a|an)\s+", "", meaning, flags=re.IGNORECASE)
                label = re.split(r"[,;]", label, maxsplit=1)[0].strip()[:48]
        region_type = str(item.get("type") or "").lower()
        if region_type not in valid_types:
            semantic_hint = f"{region_name} {label} {meaning}".lower()
            region_type = next((kind for kind in valid_types if kind in semantic_hint), "figure" if index == 0 else "detail")
        margin_x = max(8, int((x2 - x1) * 0.06))
        margin_y = max(8, int((y2 - y1) * 0.06))
        if not (x1 + margin_x <= point[0] <= x2 - margin_x and y1 + margin_y <= point[1] <= y2 - margin_y):
            point = [(x1 + x2) // 2, (y1 + y2) // 2]
        raw_id = str(item.get("id") or "").strip()
        if raw_id.lower() in {"snake_case", "region_id", "id"} or raw_id.isdigit():
            raw_id = ""
        proposals.append({
            "id": slug(raw_id or region_name or label, f"region_{index + 1}"),
            "label": label,
            "type": region_type,
            "bbox": box,
            "point": point,
            "meaning": meaning[:180],
            "color_rgb": colors[len(proposals) % len(colors)],
        })
        if len(proposals) == 9:
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


def normalize_artwork(raw: dict[str, Any], preprocessing: dict[str, Any]) -> dict[str, Any]:
    """Normalize the model's conservative whole-artwork framing proposal."""
    width = preprocessing["prepared_size"]["width"]
    height = preprocessing["prepared_size"]["height"]
    cx1, cy1, cx2, cy2 = preprocessing["content_box"]
    content_box = [
        round(cx1 / width * 1000), round(cy1 / height * 1000),
        round(cx2 / width * 1000), round(cy2 / height * 1000),
    ]
    item = raw.get("artwork") if isinstance(raw.get("artwork"), dict) else {}
    try:
        box = [max(0, min(1000, int(float(value)))) for value in item.get("bbox", content_box)[:4]]
        point = [max(0, min(1000, int(float(value)))) for value in item.get("point", [500, 500])[:2]]
        if len(box) != 4 or len(point) != 2 or box[2] <= box[0] or box[3] <= box[1]:
            raise ValueError
    except (TypeError, ValueError):
        box = content_box
        point = [(content_box[0] + content_box[2]) // 2, (content_box[1] + content_box[3]) // 2]
    try:
        confidence = max(0.0, min(1.0, float(item.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0.0
    return {
        "full_frame": bool(item.get("full_frame", True)),
        "confidence": round(confidence, 4),
        "bbox": box,
        "point": point,
    }


def extract_first_object(text: str) -> dict[str, Any]:
    decoder = json.JSONDecoder()
    for match in re.finditer(r"\{", text):
        try:
            value, _ = decoder.raw_decode(text[match.start():])
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value
    raise ValueError("The vision model did not return a JSON object")


def qwen_prompt(statement: str) -> str:
    context = statement.strip() or "No artist statement was supplied. Infer only visually evident content."
    return f"""Analyze this completed street-art image as material for an accessible interactive sound artwork.
Artist statement: {context[:1200]}
Return ONLY valid JSON, no markdown. Use this schema:
{{"regions":[{{"id":"snake_case","label":"short English label","type":"figure|face|gesture|lettering|wall|texture|detail|symbol|fill","bbox":[x1,y1,x2,y2],"point":[x,y],"meaning":"one short sensory interpretation"}}],"music_plan":{{"bpm":72,"root":"D","mode":"major|minor|dorian|phrygian|mixolydian|minorPentatonic","meter":"4/4"}}}}
The schema strings describe the format only. Never output the literal values "snake_case", "short English label", or a pipe-separated list. Create a unique concrete id, label, and one single type for every detected region.
Coordinates are normalized integers 0-1000. Return 6 to 9 distinct playable regions, using the list below as a visual guide. If a listed feature is absent, replace it with another concrete visible painted shape:
1. main painted figure or largest focal object
2. face or focal internal detail
3. gesture, hand, accessory or held object
4. one actual painted lettering or glyph cluster
5. a second different painted mark or color field
6. exposed wall/material region
7. paint drip, crack, weathering or spray texture
8. another small distinctive painted symbol or detail
9. one additional concrete painted object, mark, or material feature when clearly visible
Every label must name what is visibly there (for example "woman with sunglasses", "black upper-left glyphs", "yellow wall field"), never only an abstract word such as "color", "texture", "detail" or "symbol". Use at most one box covering more than 60% of the image. All other boxes must tightly surround different visible shapes. Nested details are allowed, but duplicate boxes are forbidden. Each point must be well inside the intended painted shape, not on a box edge or empty background. Keep meaning under 12 words and connect the visible mark to a tactile or sonic quality.
Choose the music_plan from the combined emotional character of the visible artwork and Artist Statement. It controls the deterministic real-time sonification engine; it is not a request to generate a song. Use BPM 40-180, one valid root, one valid mode, and 4/4 meter."""


def qwen_regions_retry_prompt(statement: str) -> str:
    context = statement.strip() or "No artist statement was supplied."
    return f"""Identify 6 to 9 distinct visible regions in this street-art image.
Artist statement: {context[:600]}
Return ONLY one valid JSON object with a regions array. Each item must have a unique concrete id, a short visible English label, exactly one type, bbox, point, and a meaning under 12 words. Valid types are figure, face, gesture, lettering, wall, texture, detail, symbol, and fill. Coordinates are integers from 0 to 1000. Bbox has four numbers. Point has exactly two numbers well inside the visible shape. Never use schema placeholders or pipe-separated values. Prefer actual painted figures, faces, hands, lettering, marks, colour fields, wall material, drips, cracks, and spray texture. Do not repeat boxes."""


def normalize_music_plan(raw: dict[str, Any]) -> dict[str, Any]:
    item = raw.get("music_plan") if isinstance(raw.get("music_plan"), dict) else {}
    valid_modes = {"major", "minor", "dorian", "phrygian", "mixolydian", "minorPentatonic"}
    root = str(item.get("root", "D")).strip().upper().replace("♯", "#")
    if root not in {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}:
        root = "D"
    mode = str(item.get("mode", "dorian")).strip()
    if mode not in valid_modes:
        mode = "dorian"
    try:
        bpm = max(40, min(180, round(float(item.get("bpm", 72)))))
    except (TypeError, ValueError):
        bpm = 72
    return {
        "bpm": bpm,
        "root": root,
        "mode": mode,
        "meter": "4/4",
    }


def qwen_artwork_prompt(preprocessing: dict[str, Any]) -> str:
    width = preprocessing["prepared_size"]["width"]
    height = preprocessing["prepared_size"]["height"]
    x1, y1, x2, y2 = preprocessing["content_box"]
    content_box = [
        round(x1 / width * 1000), round(y1 / height * 1000),
        round(x2 / width * 1000), round(y2 / height * 1000),
    ]
    return f"""Find the outer boundary of the complete street-art work in this photograph.
The real photograph occupies normalized rectangle {content_box}. Ignore any padding outside it.
Return only one JSON object with four fields: full_frame, confidence, bbox, and point.
Set full_frame to true and bbox to the complete photograph rectangle whenever the photograph is already entirely street art, wall texture belongs to the work, the painted parts are disconnected, or the boundary is uncertain. Set full_frame to false only when a clearly bounded mural or graffiti work has unrelated scenery around it. The bbox must include every painted part, lettering, and relevant wall surface. Point must be exactly two numbers inside the work. Confidence is from 0 to 1."""


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


async def analyze_job(job_id: str, image_path: Path, statement: str, preprocessing: dict[str, Any]) -> None:
    job = jobs[job_id]
    async with analysis_lock:
        try:
            job.update(stage="vision", message="Reading the artwork…", progress=18)
            qwen = await run_command([
                str(QWEN_PYTHON), "-m", "mlx_vlm.generate",
                "--model", str(QWEN_MODEL), "--image", str(image_path),
                "--prompt", qwen_prompt(statement), "--max-tokens", "1500",
                "--temperature", "0", "--no-verbose",
            ], timeout=240)
            if qwen.returncode != 0:
                raise RuntimeError(qwen.stderr.strip()[-600:] or "Vision analysis failed")
            (image_path.parent / "vision-output.txt").write_text(qwen.stdout, encoding="utf-8")
            try:
                raw_analysis = extract_json(qwen.stdout)
            except ValueError:
                raw_analysis = {}
            raw_regions = raw_analysis.get("regions") if isinstance(raw_analysis.get("regions"), list) else []
            if len(raw_regions) < 4:
                job.update(stage="vision", message="Refining the region reading…", progress=27)
                retry = await run_command([
                    str(QWEN_PYTHON), "-m", "mlx_vlm.generate",
                    "--model", str(QWEN_MODEL), "--image", str(image_path),
                    "--prompt", qwen_regions_retry_prompt(statement), "--max-tokens", "1000",
                    "--temperature", "0", "--no-verbose",
                ], timeout=240)
                (image_path.parent / "vision-retry-output.txt").write_text(retry.stdout, encoding="utf-8")
                if retry.returncode != 0:
                    raise RuntimeError(retry.stderr.strip()[-600:] or "Vision analysis retry failed")
                retry_analysis = extract_json(retry.stdout)
                if "music_plan" not in retry_analysis and isinstance(raw_analysis.get("music_plan"), dict):
                    retry_analysis["music_plan"] = raw_analysis["music_plan"]
                raw_analysis = retry_analysis
            proposals = normalize_proposals(raw_analysis)
            music_plan = normalize_music_plan(raw_analysis)
            job.update(stage="vision", message="Checking the artwork boundary…", progress=36)
            boundary = await run_command([
                str(QWEN_PYTHON), "-m", "mlx_vlm.generate",
                "--model", str(QWEN_MODEL), "--image", str(image_path),
                "--prompt", qwen_artwork_prompt(preprocessing), "--max-tokens", "280",
                "--temperature", "0", "--no-verbose",
            ], timeout=180)
            artwork_payload: dict[str, Any] = {}
            if boundary.returncode == 0:
                (image_path.parent / "artwork-boundary-output.txt").write_text(boundary.stdout, encoding="utf-8")
                try:
                    artwork_payload = {"artwork": extract_first_object(boundary.stdout)}
                except ValueError:
                    artwork_payload = {}
            artwork = normalize_artwork(artwork_payload, preprocessing)
            proposal_path = image_path.parent / "proposals.json"
            proposal_path.write_text(json.dumps({
                "artwork": artwork,
                "preprocessing": preprocessing,
                "regions": proposals,
            }, ensure_ascii=False, indent=2), encoding="utf-8")

            job.update(stage="segment", message=f"Defining {len(proposals)} interactive regions…", progress=45)
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
            job.update(stage="music", message="Preparing the algorithmic music system…", progress=92)
            processed_image = manifest.get("processed_image", "artwork.png")
            manifest.update({
                "analysis_id": job_id,
                "image_url": f"/runtime/jobs/{job_id}/result/{processed_image}",
                "status": "ready",
                "artist_statement": statement,
                "music_plan": music_plan,
            })
            for region in manifest["regions"]:
                region["visual_mask_url"] = f"/runtime/jobs/{job_id}/result/{region['visual_mask']}"
                region["hit_mask_url"] = f"/runtime/jobs/{job_id}/result/{region['hit_mask']}"
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
            job.update(status="ready", stage="ready", message="Image regions and algorithmic music system are ready.", progress=100, result=manifest)
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

    # Reuse the prepared demo only when no statement needs interpreting. A
    # statement should always reach Qwen so it can influence the region reading.
    if not statement.strip() and hashlib.sha256(data).digest() == hashlib.sha256(DEMO_IMAGE.read_bytes()).digest():
        return JSONResponse(demo_payload())

    job_id = uuid.uuid4().hex[:12]
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True)
    extension = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[image.content_type]
    source_path = job_dir / f"source{extension}"
    source_path.write_bytes(data)
    image_path = job_dir / "prepared.png"
    try:
        preprocessing = await asyncio.to_thread(prepare_uploaded_image, data, image_path)
    except ImagePreparationError as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    jobs[job_id] = {
        "analysis_id": job_id,
        "status": "analyzing",
        "stage": "queued",
        "message": "Preparing the artwork…",
        "progress": 5,
        "created_at": time.time(),
        "warnings": preprocessing.get("warnings", []),
    }
    (job_dir / "preprocessing.json").write_text(json.dumps(preprocessing, indent=2), encoding="utf-8")
    asyncio.create_task(analyze_job(job_id, image_path, statement, preprocessing))
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


@app.get("/api/external-output")
async def api_external_output() -> JSONResponse:
    """Return the saved routing configuration, available ports, and activity."""
    return JSONResponse(await asyncio.to_thread(external_output.public_state))


@app.put("/api/external-output")
async def api_update_external_output(configuration: dict[str, Any]) -> JSONResponse:
    try:
        saved = await asyncio.to_thread(external_output.save, configuration)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return JSONResponse({"config": saved, "activity": external_output.last_activity})


@app.post("/api/external-output/test/{protocol}")
async def api_test_external_output(protocol: str) -> JSONResponse:
    try:
        activity = await asyncio.to_thread(external_output.test, protocol.lower())
    except (ImportError, OSError, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return JSONResponse({"activity": activity})


@app.websocket("/ws/events")
async def ws_events(websocket: WebSocket) -> None:
    await websocket.accept()
    event_clients.add(websocket)
    await websocket.send_json({"type": "connected", "message": "Street Art control stream ready"})
    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") in {"pointer_state", "scan_state"}:
                latest_state.clear()
                latest_state.update(message)
                await asyncio.to_thread(external_output.process, message)
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
    external_output.close()
    # Uploads are demo-session data; keep recent results so the page can reload.
    cutoff = time.time() - 24 * 60 * 60
    for directory in JOBS_DIR.iterdir():
        if directory.is_dir() and directory.stat().st_mtime < cutoff:
            shutil.rmtree(directory, ignore_errors=True)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("STREET_ART_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port)
