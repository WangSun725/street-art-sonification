import unittest

from server import GEMS_DIMENSIONS, needs_gems_retry, normalize_gems_profile, parse_gems_retry


class GemsProfileTests(unittest.TestCase):
    def test_placeholder_evidence_cannot_select_a_template(self):
        profile = {"image": {"weights": dict.fromkeys(GEMS_DIMENSIONS, .1), "evidence": "visible evidence only"},
                   "statement": {"weights": dict.fromkeys(GEMS_DIMENSIONS, .1), "evidence": "statement evidence only"}}
        self.assertTrue(needs_gems_retry({"gems_profile": profile}))
        repaired = parse_gems_retry({
            "image_scores": [.8,.3,.2,.1,.1,.6,.7,.1,.05],
            "statement_scores": [.2,.1,.1,.8,.4,.1,.1,.2,.6],
            "image_evidence": "Saturated geometric paint surrounds an outstretched hand.",
            "statement_evidence": "The statement describes an absent home and memory.",
        })
        self.assertFalse(needs_gems_retry({"gems_profile": repaired}))
        self.assertAlmostEqual(repaired["statement"]["weights"]["nostalgia"], .8/2.6)
        with self.assertRaises(ValueError):
            parse_gems_retry({"image_scores": [.1], "statement_scores": [.1]})

    def test_image_and_statement_are_normalized_then_combined(self):
        profile = normalize_gems_profile({
            "gems_profile": {
                "image": {
                    "weights": {"wonder": 1},
                    "evidence": "Bright geometry creates visual awe.",
                },
                "statement": {
                    "weights": {"sadness": 1},
                    "evidence": "The statement describes grief and memory.",
                },
            },
        })
        self.assertEqual(profile["framework"], "GEMS-9")
        self.assertEqual(set(profile["weights"]), set(GEMS_DIMENSIONS))
        self.assertAlmostEqual(sum(profile["weights"].values()), 1, places=5)
        self.assertAlmostEqual(profile["weights"]["wonder"], 0.45, places=5)
        self.assertAlmostEqual(profile["weights"]["sadness"], 0.55, places=5)
        self.assertEqual(profile["dominant"], "sadness")
        self.assertEqual(profile["secondary"], "wonder")
        self.assertEqual(profile["image"]["evidence"], "Bright geometry creates visual awe.")
        self.assertEqual(profile["statement"]["evidence"], "The statement describes grief and memory.")

    def test_invalid_values_fall_back_to_complete_gems_profile(self):
        profile = normalize_gems_profile({"gems_profile": {}})
        self.assertEqual(set(profile["weights"]), set(GEMS_DIMENSIONS))
        self.assertAlmostEqual(sum(profile["weights"].values()), 1, places=5)
        self.assertAlmostEqual(sum(profile["higher_order"].values()), 1, places=5)
        for removed_field in ("label", "valence", "arousal", "warmth", "roughness"):
            self.assertNotIn(removed_field, profile)


if __name__ == "__main__":
    unittest.main()
