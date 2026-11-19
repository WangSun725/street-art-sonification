"""Isolate RtMidi so a native CoreMIDI failure cannot stop the web server."""

from __future__ import annotations

import argparse
import heapq
import json
import sys
import threading
import time
from typing import Any


def backend() -> Any:
    import mido

    mido.set_backend("mido.backends.rtmidi")
    return mido


class MidiScheduler:
    def __init__(self, output: Any, mido: Any):
        self.output = output
        self.mido = mido
        self.condition = threading.Condition()
        self.pending: list[tuple[float, int, dict]] = []
        self.active: dict[tuple[int, int], int] = {}
        self.sequence = 0
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def submit(self, message: dict) -> None:
        start_ms = message.get("startAtMs")
        if start_ms is not None and float(start_ms) < time.time() * 1000 - 80:
            return
        delay = 0 if start_ms is None else max(0, min(2, (float(start_ms) - time.time() * 1000) / 1000))
        with self.condition:
            self.sequence += 1
            heapq.heappush(self.pending, (time.monotonic() + delay, self.sequence, message))
            self.condition.notify()

    def cancel(self) -> None:
        with self.condition:
            self.pending.clear()
            for channel, note in self.active:
                try:
                    self.output.send(self.mido.Message("note_off", channel=channel, note=note, velocity=0))
                except Exception as exc:
                    print(json.dumps({"error": str(exc)}), file=sys.stderr, flush=True)
            self.active.clear()
            self.condition.notify()

    def close(self) -> None:
        self.cancel()
        with self.condition:
            self.running = False
            self.condition.notify()
        self.thread.join(timeout=1)

    def _run(self) -> None:
        with self.condition:
            while self.running:
                if not self.pending:
                    self.condition.wait()
                    continue
                deadline, sequence, message = self.pending[0]
                delay = deadline - time.monotonic()
                if delay > 0:
                    self.condition.wait(timeout=delay)
                    continue
                heapq.heappop(self.pending)
                try:
                    self._send(message, sequence, deadline)
                except Exception as exc:
                    print(json.dumps({"error": str(exc)}), file=sys.stderr, flush=True)

    def _send(self, message: dict, sequence: int, deadline: float) -> None:
        channel = max(0, min(15, int(message.get("channel", 0))))
        kind = message["type"]
        if kind == "cc":
            control = max(0, min(127, int(message.get("control", 1))))
            value = max(0, min(127, int(message.get("value", 0))))
            self.output.send(self.mido.Message("control_change", control=control, value=value, channel=channel))
            return
        note = max(0, min(127, int(message.get("note", 60))))
        key = (channel, note)
        if kind == "off":
            if self.active.get(key) == message["token"]:
                self.output.send(self.mido.Message("note_off", note=note, velocity=0, channel=channel))
                self.active.pop(key)
            return
        if key in self.active:
            self.output.send(self.mido.Message("note_off", note=note, velocity=0, channel=channel))
        velocity = max(1, min(127, int(message.get("value", 96))))
        duration = max(.04, min(12, float(message.get("duration", .12))))
        self.output.send(self.mido.Message("note_on", note=note, velocity=velocity, channel=channel))
        self.active[key] = sequence
        self.sequence += 1
        heapq.heappush(self.pending, (
            max(deadline, time.monotonic()) + duration,
            self.sequence,
            {"type": "off", "note": note, "channel": channel, "token": sequence},
        ))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--port", default="__virtual__")
    parser.add_argument("--virtual-name", default="Street Art Sonification")
    arguments = parser.parse_args()
    mido = backend()
    if arguments.list:
        print(json.dumps({"ports": list(mido.get_output_names())}), flush=True)
        return 0

    if arguments.port == "__virtual__":
        output = mido.open_output(arguments.virtual_name, virtual=True)
    else:
        output = mido.open_output(arguments.port)
    print(json.dumps({"ready": True}), flush=True)

    scheduler = MidiScheduler(output, mido)

    try:
        for line in sys.stdin:
            try:
                message = json.loads(line)
                kind = message.get("type")
                if kind == "close":
                    break
                if kind == "cancel":
                    scheduler.cancel()
                elif kind in {"note", "cc"}:
                    scheduler.submit(message)
            except Exception as exc:
                print(json.dumps({"error": str(exc)}), file=sys.stderr, flush=True)
    finally:
        scheduler.close()
        output.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
