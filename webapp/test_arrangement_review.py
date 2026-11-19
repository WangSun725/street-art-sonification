import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
import arrangement_review as review


class ArrangementReviewTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.patch = patch.object(review, "REVIEW_ROOT", self.root)
        self.patch.start()
        self.folder = self.root / "round-01"
        for name in ("audio", "dry", "checks", "scores"):
            (self.folder / name).mkdir(parents=True, exist_ok=True)
        self.items = [{"id": "acid_drive_01-" + mode, "revision": 1} for mode in ("major", "minor")]
        review.write_json(self.root / "current.json", {"round": 1})
        review.write_json(self.folder / "manifest.json", {"round": 1, "items": self.items})
        app = FastAPI()
        app.include_router(review.router)
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.patch.stop()
        self.temporary.cleanup()

    def ready(self, clip):
        (self.folder / "audio" / (clip + ".mp3")).write_bytes(b"test-audio")
        review.write_json(self.folder / "checks" / (clip + ".json"), {"sha256": "a" * 64})

    def test_major_and_minor_reviews_persist_independently(self):
        for mode, status in (("major", "keep"), ("minor", "redo")):
            clip = "acid_drive_01-" + mode
            self.ready(clip)
            response = self.client.put("/api/arrangement-review/ratings/" + clip,
                json={"status": status, "notes": mode + " review", "revision": 1})
            self.assertEqual(response.status_code, 200)
        saved = json.loads((self.root / "ratings.json").read_text())["rounds"]["1"]
        self.assertEqual(saved["acid_drive_01-major"]["status"], "keep")
        self.assertEqual(saved["acid_drive_01-minor"]["status"], "redo")
        self.assertEqual(saved["acid_drive_01-minor"]["notes"], "minor review")
        self.assertEqual(saved["acid_drive_01-major"]["audioSha256"], "a" * 64)
        returned = self.client.get("/api/arrangement-review/ratings").json()
        self.assertEqual(returned["ratings"], saved)

    def test_unready_unknown_and_stale_reviews_are_rejected(self):
        payload = {"status": "keep", "notes": "", "revision": 1}
        self.assertEqual(self.client.put("/api/arrangement-review/ratings/acid_drive_01-major", json=payload).status_code, 409)
        self.assertEqual(self.client.put("/api/arrangement-review/ratings/unknown", json=payload).status_code, 404)
        self.ready("acid_drive_01-major")
        self.assertEqual(self.client.put("/api/arrangement-review/ratings/acid_drive_01-major", json={**payload, "revision": 2}).status_code, 409)
        self.assertEqual(self.client.put("/api/arrangement-review/ratings/acid_drive_01-major", json={**payload, "status": "approved-ish"}).status_code, 422)
        self.assertEqual(self.client.put("/api/arrangement-review/ratings/acid_drive_01-major", json={**payload, "notes": "x" * 2001}).status_code, 422)

    def test_completed_audio_cannot_be_overwritten(self):
        clip = "acid_drive_01-major"
        self.ready(clip)
        header = b"RIFF" + b"\0" * 4 + b"WAVE" + b"\0" * 32
        response = self.client.post("/api/arrangement-review/audio/" + clip, content=header, headers={"Content-Type": "audio/wav"})
        self.assertEqual(response.status_code, 409)
        self.assertEqual((self.folder / "audio" / (clip + ".mp3")).read_bytes(), b"test-audio")

    def test_readiness_requires_finished_audio_and_checks(self):
        self.ready("acid_drive_01-major")
        (self.folder / "dry/acid_drive_01-minor.wav").write_bytes(b"partial")
        items = self.client.get("/api/arrangement-review/manifest").json()["items"]
        self.assertTrue(items[0]["ready"])
        self.assertFalse(items[1]["ready"])
        self.assertFalse(items[1]["dryReady"])
        review.write_json(self.folder / "scores/acid_drive_01-minor.json", {})
        items = self.client.get("/api/arrangement-review/manifest").json()["items"]
        self.assertTrue(items[1]["dryReady"])


if __name__ == "__main__":
    unittest.main()
