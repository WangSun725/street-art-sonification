"""Isolate RtMidi so a native CoreMIDI failure cannot stop the web server."""

from __future__ import annotations

import argparse
import json
import sys
import threading
from typing import Any


def backend() -> Any:
    import mido

    mido.set_backend("mido.backends.rtmidi")
    return mido


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

    def note_off(note: int, channel: int) -> None:
        try:
            output.send(mido.Message("note_off", note=note, velocity=0, channel=channel))
        except Exception:
            pass

    try:
        for line in sys.stdin:
            try:
                message = json.loads(line)
                kind = message.get("type")
                if kind == "close":
                    break
                channel = max(0, min(15, int(message.get("channel", 0))))
                if kind == "note":
                    note = max(0, min(127, int(message.get("note", 60))))
                    velocity = max(1, min(127, int(message.get("value", 96))))
                    output.send(mido.Message("note_on", note=note, velocity=velocity, channel=channel))
                    timer = threading.Timer(.12, note_off, args=(note, channel))
                    timer.daemon = True
                    timer.start()
                elif kind == "cc":
                    control = max(0, min(127, int(message.get("control", 1))))
                    value = max(0, min(127, int(message.get("value", 0))))
                    output.send(mido.Message("control_change", control=control, value=value, channel=channel))
            except Exception as exc:
                print(json.dumps({"error": str(exc)}), file=sys.stderr, flush=True)
    finally:
        output.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
