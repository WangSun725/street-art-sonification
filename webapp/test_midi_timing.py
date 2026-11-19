import tempfile
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

from output_bridge.manager import ExternalOutputManager
from output_bridge.midi_worker import MidiScheduler


class MidiTimingTests(unittest.TestCase):
    def test_staggered_arrivals_share_one_note_on_time_and_cancel_clears_future_notes(self):
        received = []
        both_started = threading.Event()

        def send(message):
            received.append((time.monotonic(), message))
            if sum(message["type"] == "note_on" for _, message in received) == 2:
                both_started.set()

        output = SimpleNamespace(send=send)
        mido = SimpleNamespace(Message=lambda kind, **data: {"type": kind, **data})
        scheduler = MidiScheduler(output, mido)
        try:
            start = time.time() * 1000 + 100
            scheduler.submit({"type": "note", "note": 36, "duration": .3, "startAtMs": start})
            time.sleep(.025)
            scheduler.submit({"type": "note", "note": 60, "duration": .3, "startAtMs": start})
            self.assertFalse(both_started.is_set())
            self.assertTrue(both_started.wait(timeout=1))
            starts = [timestamp for timestamp, message in received if message["type"] == "note_on"]
            self.assertLess(abs(starts[0] - starts[1]), .01)
            scheduler.submit({"type": "note", "note": 72, "startAtMs": time.time() * 1000 + 70})
            scheduler.cancel()
            time.sleep(.1)
            self.assertFalse(any(message["type"] == "note_on" and message["note"] == 72 for _, message in received))
            self.assertEqual(sum(message["type"] == "note_off" for _, message in received), 2)
        finally:
            scheduler.close()

    def test_performance_bridge_preserves_scheduled_batches_without_snapshot_retriggers(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = ExternalOutputManager(Path(directory) / "output.json")
            messages = []
            manager._send_midi = lambda mapping, value: messages.append((mapping, value))
            voice = {"regionId": "paint", "channel": 4, "eventId": "snapshot", "notes": [36]}
            scheduled = [
                {**voice, "eventId": "step-0", "scheduledAtMs": 100000, "notes": [36]},
                {**voice, "eventId": "step-1", "scheduledAtMs": 100125, "notes": [43]},
            ]
            frame = {"music": {"bpm": 120, "transportId": "session", "activeVoices": [voice], "scheduledEvents": scheduled}}
            manager._send_performance_events(frame, "paint", True)
            notes = [mapping for mapping, _ in messages if mapping["message"] == "note"]
            self.assertEqual([mapping["startAtMs"] for mapping in notes], [100000, 100125])
            messages.clear()
            frame["music"]["scheduledEvents"] = []
            manager._send_performance_events(frame, "paint", False)
            self.assertFalse(any(mapping["message"] == "note" for mapping, _ in messages))


if __name__ == "__main__":
    unittest.main()
