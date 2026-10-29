"""Map interaction frames to MIDI and OSC without coupling them to the UI."""

from __future__ import annotations

import copy
import json
import math
import select
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any


DEFAULT_CONFIG: dict[str, Any] = {
    "enabled": False,
    "osc": {"host": "127.0.0.1", "port": 9000},
    "midi": {"port": "__virtual__", "virtualName": "Street Art Sonification"},
    "mappings": [
        {
            "id": "horizontal-position",
            "enabled": True,
            "source": "normalized.x",
            "protocol": "osc",
            "target": "/streetart/position/x",
            "message": "value",
            "channel": 1,
            "inputMin": 0,
            "inputMax": 1,
            "outputMin": 0,
            "outputMax": 1,
            "invert": False,
            "smoothingMs": 70,
        },
        {
            "id": "vertical-position",
            "enabled": True,
            "source": "normalized.y",
            "protocol": "osc",
            "target": "/streetart/position/y",
            "message": "value",
            "channel": 1,
            "inputMin": 0,
            "inputMax": 1,
            "outputMin": 0,
            "outputMax": 1,
            "invert": False,
            "smoothingMs": 80,
        },
        {
            "id": "brightness",
            "enabled": True,
            "source": "color.brightness",
            "protocol": "osc",
            "target": "/streetart/brightness",
            "message": "value",
            "channel": 1,
            "inputMin": 0,
            "inputMax": 1,
            "outputMin": 0,
            "outputMax": 1,
            "invert": False,
            "smoothingMs": 120,
        },
        {
            "id": "region-enter",
            "enabled": True,
            "source": "region.enter",
            "protocol": "osc",
            "target": "/streetart/region/enter",
            "message": "trigger",
            "channel": 1,
            "inputMin": 0,
            "inputMax": 1,
            "outputMin": 0,
            "outputMax": 1,
            "invert": False,
            "smoothingMs": 0,
        },
    ],
}

SOURCES = {
    "normalized.x",
    "normalized.y",
    "speed",
    "edgeProximity",
    "texture",
    "color.hue",
    "color.saturation",
    "color.brightness",
    "scan.progress",
    "scan.primaryIntensity",
    "music.bpm",
    "music.rootMidi",
    "music.modeIndex",
    "music.beatPhase",
    "region.enter",
}

PERFORMANCE_CCS: dict[str, int] = {
    "movement": 1,
    "pan": 10,
    "expression": 11,
    "harmonicIntensity": 71,
    "release": 72,
    "attack": 73,
    "brightness": 74,
    "reverb": 91,
    "chorus": 93,
}


def _number(value: Any, default: float) -> float:
    try:
        value = float(value)
        return value if math.isfinite(value) else default
    except (TypeError, ValueError):
        return default


def _clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def _nested(frame: dict[str, Any], path: str) -> Any:
    value: Any = frame
    for part in path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


class ExternalOutputManager:
    """Own output connections and apply saved mappings to interaction frames."""

    def __init__(self, config_path: Path):
        self.config_path = config_path
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.config = self._load()
        self._osc_client: Any = None
        self._osc_target: tuple[str, int] | None = None
        self._midi_port: Any = None
        self._midi_target: str | None = None
        self._smooth: dict[str, tuple[float, float]] = {}
        self._last_sent: dict[str, tuple[float, float]] = {}
        self._last_region: str | None = None
        self._last_output_mode: str | None = None
        self._last_voice_events: dict[str, str] = {}
        self._last_performance_cc: dict[tuple[int, int], int] = {}
        self._lock = threading.RLock()
        self.last_activity: dict[str, Any] = {
            "status": "idle",
            "protocol": None,
            "target": None,
            "value": None,
            "timestamp": 0,
            "error": None,
        }

    def _load(self) -> dict[str, Any]:
        if not self.config_path.is_file():
            return copy.deepcopy(DEFAULT_CONFIG)
        try:
            return self.validate(json.loads(self.config_path.read_text(encoding="utf-8")))
        except Exception:
            return copy.deepcopy(DEFAULT_CONFIG)

    def save(self, raw: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.config = self.validate(raw)
            temporary = self.config_path.with_suffix(".tmp")
            temporary.write_text(json.dumps(self.config, indent=2), encoding="utf-8")
            temporary.replace(self.config_path)
            self._smooth.clear()
            self._last_sent.clear()
            self._close_outputs()
            return copy.deepcopy(self.config)

    def validate(self, raw: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(raw, dict):
            raise ValueError("Output configuration must be an object")
        osc = raw.get("osc") if isinstance(raw.get("osc"), dict) else {}
        midi = raw.get("midi") if isinstance(raw.get("midi"), dict) else {}
        host = str(osc.get("host", "127.0.0.1")).strip()[:253]
        if not host or any(character.isspace() for character in host):
            raise ValueError("OSC host is invalid")
        port = int(_clamp(_number(osc.get("port"), 9000), 1, 65535))
        midi_port = str(midi.get("port", "__virtual__"))[:180]
        virtual_name = str(midi.get("virtualName", "Street Art Sonification")).strip()[:80]
        mappings: list[dict[str, Any]] = []
        for index, item in enumerate(raw.get("mappings", [])):
            if not isinstance(item, dict):
                continue
            source = str(item.get("source", "normalized.x"))
            protocol = str(item.get("protocol", "osc"))
            message = str(item.get("message", "value"))
            if source not in SOURCES or protocol not in {"osc", "midi"}:
                continue
            if protocol == "osc":
                target = str(item.get("target", "/streetart/value")).strip()
                if not target.startswith("/") or " " in target or len(target) > 180:
                    raise ValueError(f"Mapping {index + 1} needs a valid OSC address")
                message = "trigger" if source == "region.enter" else "value"
            else:
                target_number = int(_clamp(_number(item.get("target"), 1), 0, 127))
                target = str(target_number)
                message = "note" if source == "region.enter" or message == "note" else "cc"
            input_min = _number(item.get("inputMin"), 0)
            input_max = _number(item.get("inputMax"), 1)
            if input_min == input_max:
                input_max = input_min + 1
            default_max = 127 if protocol == "midi" else 1
            output_min = _number(item.get("outputMin"), 0)
            output_max = _number(item.get("outputMax"), default_max)
            if protocol == "midi":
                output_min = _clamp(output_min, 0, 127)
                output_max = _clamp(output_max, 0, 127)
            mappings.append({
                "id": str(item.get("id") or f"mapping-{index + 1}")[:80],
                "enabled": bool(item.get("enabled", True)),
                "source": source,
                "protocol": protocol,
                "target": target,
                "message": message,
                "channel": int(_clamp(_number(item.get("channel"), 1), 1, 16)),
                "inputMin": input_min,
                "inputMax": input_max,
                "outputMin": output_min,
                "outputMax": output_max,
                "invert": bool(item.get("invert", False)),
                "smoothingMs": int(_clamp(_number(item.get("smoothingMs"), 60), 0, 2000)),
            })
            if len(mappings) >= 32:
                break
        return {
            "enabled": bool(raw.get("enabled", False)),
            "osc": {"host": host, "port": port},
            "midi": {"port": midi_port, "virtualName": virtual_name or "Street Art Sonification"},
            "mappings": mappings,
        }

    def midi_ports(self) -> tuple[list[str], str | None]:
        try:
            worker = Path(__file__).with_name("midi_worker.py")
            result = subprocess.run(
                [sys.executable, str(worker), "--list"],
                text=True,
                capture_output=True,
                timeout=5,
                check=False,
            )
            if result.returncode != 0:
                return [], (result.stderr.strip().splitlines()[-1] if result.stderr.strip() else "CoreMIDI is unavailable")
            return list(json.loads(result.stdout).get("ports", [])), None
        except Exception as exc:
            return [], str(exc)

    def dependency_status(self) -> dict[str, Any]:
        status: dict[str, Any] = {}
        try:
            import pythonosc  # noqa: F401
            status["osc"] = {"available": True, "error": None}
        except Exception as exc:
            status["osc"] = {"available": False, "error": str(exc)}
        ports, midi_error = self.midi_ports()
        status["midi"] = {"available": midi_error is None, "error": midi_error, "ports": ports}
        return status

    def public_state(self) -> dict[str, Any]:
        return {
            "config": copy.deepcopy(self.config),
            "dependencies": self.dependency_status(),
            "activity": copy.deepcopy(self.last_activity),
        }

    def _source_value(self, frame: dict[str, Any], source: str, region_entered: bool) -> float | None:
        if source == "region.enter":
            return 1.0 if region_entered else None
        if source == "scan.primaryIntensity":
            active = _nested(frame, "scan.activeRegions")
            value = active[0].get("intensity") if isinstance(active, list) and active else None
        else:
            value = _nested(frame, source)
        if value is None:
            return None
        return _number(value, 0)

    def _mapped_value(self, mapping: dict[str, Any], value: float, now: float) -> float:
        position = (value - mapping["inputMin"]) / (mapping["inputMax"] - mapping["inputMin"])
        position = _clamp(position, 0, 1)
        if mapping["invert"]:
            position = 1 - position
        result = mapping["outputMin"] + position * (mapping["outputMax"] - mapping["outputMin"])
        smoothing = mapping["smoothingMs"]
        previous = self._smooth.get(mapping["id"])
        if smoothing and previous:
            elapsed_ms = max(0, (now - previous[1]) * 1000)
            alpha = 1 - math.exp(-elapsed_ms / max(1, smoothing))
            result = previous[0] + (result - previous[0]) * alpha
        self._smooth[mapping["id"]] = (result, now)
        return result

    def process(self, frame: dict[str, Any]) -> None:
        if not self.config.get("enabled"):
            return
        with self._lock:
            region = frame.get("region") if isinstance(frame.get("region"), dict) else None
            region_id = str(region.get("id")) if region else None
            output_mode = str(frame.get("outputMode") or "web")
            mode_changed = output_mode != self._last_output_mode
            region_entered = bool(region_id and (region_id != self._last_region or mode_changed))
            if mode_changed:
                self._last_voice_events.clear()
            self._last_region = region_id
            self._last_output_mode = output_mode
            now = time.monotonic()
            if output_mode == "midi":
                try:
                    self._send_performance_events(frame, region_id, region_entered)
                except Exception as exc:
                    self._record("error", "midi", "performance pattern", None, str(exc))
            for mapping in self.config["mappings"]:
                if not mapping["enabled"]:
                    continue
                if mapping["id"] == "performance-region-note" and _nested(frame, "music.activeVoices"):
                    continue
                # The performance UI treats browser sound and MIDI as exclusive
                # listening modes. OSC remains available as a parallel control
                # stream in either mode.
                if mapping["protocol"] == "midi" and frame.get("outputMode") == "web":
                    continue
                raw_value = self._source_value(frame, mapping["source"], region_entered)
                if raw_value is None:
                    continue
                value = self._mapped_value(mapping, raw_value, now)
                previous = self._last_sent.get(mapping["id"])
                is_trigger = mapping["source"] == "region.enter"
                threshold = .75 if mapping["protocol"] == "midi" else .002
                if not is_trigger and previous and abs(value - previous[0]) < threshold and now - previous[1] < .5:
                    continue
                try:
                    if mapping["protocol"] == "osc":
                        self._send_osc(mapping, value, frame)
                    else:
                        self._send_midi(mapping, value)
                    self._last_sent[mapping["id"]] = (value, now)
                except Exception as exc:
                    self._record("error", mapping["protocol"], mapping["target"], None, str(exc))

    def _send_performance_events(self, frame: dict[str, Any], region_id: str | None, region_entered: bool) -> None:
        voices = _nested(frame, "music.activeVoices")
        if not isinstance(voices, list):
            return
        active_ids: set[str] = set()
        active_channels: set[int] = set()
        for voice in voices:
            if not isinstance(voice, dict):
                continue
            voice_region = str(voice.get("regionId") or region_id or "voice")
            active_ids.add(voice_region)
            channel = int(_clamp(_number(voice.get("channel"), 1), 1, 16))
            active_channels.add(channel)
            controls = voice.get("controls") if isinstance(voice.get("controls"), dict) else {}
            for control_name, cc_number in PERFORMANCE_CCS.items():
                fallback = voice.get("mix", 1) if control_name == "expression" else (.5 if control_name == "pan" else 0)
                cc_value = int(round(_clamp(_number(controls.get(control_name), fallback), 0, 1) * 127))
                cc_key = (channel, cc_number)
                previous_cc = self._last_performance_cc.get(cc_key)
                if previous_cc is None or abs(cc_value - previous_cc) >= 2:
                    self._send_midi(
                        {"message": "cc", "target": str(cc_number), "channel": channel},
                        cc_value,
                    )
                    self._last_performance_cc[cc_key] = cc_value
            event_id = str(voice.get("eventId") or "")
            notes = voice.get("notes")
            if not isinstance(notes, list):
                notes = [voice.get("note")] if region_entered and voice.get("note") is not None else []
            if event_id and self._last_voice_events.get(voice_region) == event_id:
                continue
            if event_id:
                self._last_voice_events[voice_region] = event_id
            velocity = _clamp(_number(voice.get("velocity"), 96), 1, 127)
            bpm = max(20, _number(_nested(frame, "music.bpm"), 72))
            duration = max(.04, _number(voice.get("durationBeats"), .25) * 60 / bpm)
            # Extended open voicings can contain a triad plus 7th, 9th, 11th
            # or 13th. Preserve the same chord that Web Audio receives.
            for raw_note in notes[:8]:
                note = int(_clamp(_number(raw_note, 60), 0, 127))
                self._send_midi(
                    {"message": "note", "target": str(note), "channel": channel, "duration": duration},
                    velocity,
                )
        for inactive in set(self._last_voice_events) - active_ids:
            self._last_voice_events.pop(inactive, None)
        for cc_key in list(self._last_performance_cc):
            channel, cc_number = cc_key
            if channel in active_channels:
                continue
            if cc_number == 11 and self._last_performance_cc[cc_key] != 0:
                self._send_midi({"message": "cc", "target": "11", "channel": channel}, 0)
            self._last_performance_cc.pop(cc_key, None)

    def _ensure_osc(self) -> Any:
        target = (self.config["osc"]["host"], self.config["osc"]["port"])
        if self._osc_client is None or self._osc_target != target:
            from pythonosc.udp_client import SimpleUDPClient

            self._osc_client = SimpleUDPClient(*target)
            self._osc_target = target
        return self._osc_client

    def _send_osc(self, mapping: dict[str, Any], value: float, frame: dict[str, Any]) -> None:
        if mapping["source"] == "region.enter":
            region = frame.get("region") or {}
            payload: Any = [1.0, str(region.get("id", "")), str(region.get("label", "")), str(region.get("type", ""))]
        else:
            payload = float(value)
        self._ensure_osc().send_message(mapping["target"], payload)
        self._record("sent", "osc", mapping["target"], payload, None)

    def _ensure_midi(self) -> Any:
        selected = self.config["midi"]["port"]
        if self._midi_port is not None and self._midi_port.poll() is None and self._midi_target == selected:
            return self._midi_port
        self._close_midi()
        worker = Path(__file__).with_name("midi_worker.py")
        self._midi_port = subprocess.Popen(
            [
                sys.executable,
                str(worker),
                "--port",
                selected,
                "--virtual-name",
                self.config["midi"]["virtualName"],
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        ready, _, _ = select.select([self._midi_port.stdout], [], [], 4)
        if not ready:
            self._close_midi()
            raise RuntimeError("MIDI output did not become ready")
        response = self._midi_port.stdout.readline()
        if self._midi_port.poll() is not None or not response:
            error = self._midi_port.stderr.read().strip() if self._midi_port.stderr else ""
            self._close_midi()
            raise RuntimeError(error.splitlines()[-1] if error else "Could not open the MIDI output")
        self._midi_target = selected
        return self._midi_port

    def _send_midi(self, mapping: dict[str, Any], value: float) -> None:
        worker = self._ensure_midi()
        channel = mapping["channel"] - 1
        data = int(round(_clamp(value, 0, 127)))
        target = int(mapping["target"])
        if mapping["message"] == "note":
            message = {
                "type": "note",
                "note": target,
                "value": max(1, data),
                "channel": channel,
                "duration": max(.04, min(12, _number(mapping.get("duration"), .12))),
            }
        else:
            message = {"type": "cc", "control": target, "value": data, "channel": channel}
        if worker.stdin is None:
            raise RuntimeError("MIDI worker input is unavailable")
        worker.stdin.write(json.dumps(message) + "\n")
        worker.stdin.flush()
        self._record("sent", "midi", f"{mapping['message']} {target} · ch {mapping['channel']}", data, None)

    def test(self, protocol: str) -> dict[str, Any]:
        with self._lock:
            if protocol == "osc":
                self._ensure_osc().send_message("/streetart/test", [1.0, "Street Art Sonification"])
                self._record("test sent", "osc", "/streetart/test", 1.0, None)
            elif protocol == "midi":
                mapping = {"target": "60", "message": "note", "channel": 1}
                self._send_midi(mapping, 96)
                self.last_activity["status"] = "test sent"
            else:
                raise ValueError("Protocol must be osc or midi")
            return copy.deepcopy(self.last_activity)

    def _record(self, status: str, protocol: str | None, target: str | None, value: Any, error: str | None) -> None:
        self.last_activity = {
            "status": status,
            "protocol": protocol,
            "target": target,
            "value": value,
            "timestamp": int(time.time() * 1000),
            "error": error,
        }

    def _close_midi(self) -> None:
        if self._midi_port is not None:
            try:
                if self._midi_port.poll() is None and self._midi_port.stdin is not None:
                    self._midi_port.stdin.write('{"type":"close"}\n')
                    self._midi_port.stdin.flush()
                    self._midi_port.wait(timeout=1)
            except Exception:
                try:
                    self._midi_port.terminate()
                except Exception:
                    pass
        self._midi_port = None
        self._midi_target = None
        self._last_performance_cc.clear()

    def _close_outputs(self) -> None:
        self._close_midi()
        self._osc_client = None
        self._osc_target = None

    def close(self) -> None:
        with self._lock:
            self._close_outputs()
