import unittest

from server import GEMS_DIMENSIONS, normalize_gems_profile


class GemsProfileTests(unittest.TestCase):
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
