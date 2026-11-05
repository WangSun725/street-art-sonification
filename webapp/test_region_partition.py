import unittest

import numpy as np

from analyze_regions import build_exclusive_interaction_masks


class ExclusiveInteractionMaskTests(unittest.TestCase):
    def test_overlapping_masks_become_mutually_exclusive(self) -> None:
        large = np.zeros((80, 100), dtype=bool)
        large[5:75, 5:95] = True
        small = np.zeros_like(large)
        small[25:55, 38:68] = True

        masks, metadata = build_exclusive_interaction_masks(
            [large, small],
            [(20, 40), (53, 40)],
            [0.88, 0.91],
        )

        self.assertTrue(metadata["exclusive"])
        self.assertGreater(metadata["overlap_pixels_resolved"], 0)
        self.assertFalse(np.any(masks[0] & masks[1]))
        self.assertTrue(np.array_equal(masks[0] | masks[1], large | small))
        self.assertTrue(masks[1][40, 53])
        self.assertTrue(masks[0][40, 15])

    def test_partition_is_deterministic(self) -> None:
        first = np.zeros((40, 40), dtype=bool)
        second = np.zeros_like(first)
        first[4:35, 4:30] = True
        second[10:38, 12:37] = True
        args = ([first, second], [(10, 12), (30, 28)], [0.8, 0.8])

        result_a, _ = build_exclusive_interaction_masks(*args)
        result_b, _ = build_exclusive_interaction_masks(*args)

        for mask_a, mask_b in zip(result_a, result_b):
            self.assertTrue(np.array_equal(mask_a, mask_b))

    def test_semantic_instances_keep_disconnected_parts_over_background(self) -> None:
        background = np.ones((80, 100), dtype=bool)
        objects = np.zeros_like(background)
        objects[4:12, 4:12] = True
        objects[30:40, 50:65] = True
        objects[57:68, 78:89] = True

        masks, _ = build_exclusive_interaction_masks(
            [background, objects], [(50, 35), (8, 8)], [.94, .76],
            concept_indices=[1], background_indices=[0],
        )

        self.assertTrue(np.array_equal(masks[1], objects))
        self.assertTrue(np.array_equal(masks[0], ~objects))


if __name__ == "__main__":
    unittest.main()
