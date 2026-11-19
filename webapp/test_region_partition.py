import json
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from analyze_regions import (
    add_palette_regions,
    build_exclusive_interaction_masks,
    constrain_paint_fields,
    filter_artwork_proposals,
    isolate_painted_artwork,
)
from region_proposals import proposal_region_type


class ArtworkProposalTests(unittest.TestCase):
    def test_named_lettering_keeps_its_visual_category(self) -> None:
        self.assertEqual(proposal_region_type("depicted_object", "Graffiti lettering", "painted"), "lettering")

    def test_rejects_incidental_wall_details_but_preserves_artwork_marks(self) -> None:
        artwork = {"bbox": [127, 79, 884, 972], "confidence": .95, "full_frame": True}
        proposals = [
            {"label": "brick wall", "bbox": [88, 267, 148, 962]},
            {"label": "crack in wall", "bbox": [174, 902, 222, 962]},
            {"label": "mortar joints", "bbox": [190, 200, 600, 700]},
            {"label": "painted crack", "bbox": [350, 400, 420, 520]},
            {"label": "painted brick wall", "bbox": [220, 200, 500, 400]},
            {"label": "wall crack", "bbox": [500, 250, 600, 400], "artwork_role": "integrated_material"},
            {"label": "red lettering", "bbox": [70, 800, 140, 920]},
        ]

        kept = filter_artwork_proposals(proposals, artwork, [0, 0, 1800, 1200], 1800, 1200)

        self.assertEqual(kept, proposals[3:])

    def test_uncertain_boundary_does_not_remove_a_wall_proposal(self) -> None:
        artwork = {"bbox": [127, 79, 884, 972], "confidence": .65}
        proposals = [{"label": "brick wall", "bbox": [88, 267, 148, 962]}]
        self.assertEqual(filter_artwork_proposals(proposals, artwork, [0, 0, 1800, 1200], 1800, 1200), proposals)


class ExclusiveInteractionMaskTests(unittest.TestCase):
    def test_base_layers_cannot_claim_an_independent_shape(self) -> None:
        ground = np.ones((80, 100), dtype=bool)
        shape = np.zeros_like(ground)
        shape[20:60, 27:84] = True
        masks, _ = build_exclusive_interaction_masks(
            [ground, shape], [(50, 40), (29, 25)], [.99, .60], base_layers={0},
        )
        self.assertTrue(np.array_equal(masks[1], shape))
        self.assertTrue(np.array_equal(masks[0], ~shape))

    def test_named_ground_follows_its_color_and_leaves_other_shapes_alone(self) -> None:
        image = np.zeros((80, 100, 3), dtype=np.uint8)
        image[:, :50] = (0, 0, 220)
        image[:, 50:] = (210, 0, 0)
        foreground = np.zeros(image.shape[:2], dtype=bool)
        foreground[10:65, 12:30] = True
        ground = {"type": "painted_ground", "label": "red wall field", "mask": np.ones_like(foreground)}
        constrain_paint_fields(image, [ground, {"type": "lettering", "mask": foreground}])
        expected = np.zeros_like(foreground)
        expected[:, :50] = True
        self.assertTrue(np.array_equal(ground["mask"], expected & ~foreground))

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

    def test_palette_regions_share_the_original_painted_area_without_overlap(self) -> None:
        image = np.zeros((80, 100, 3), dtype=np.uint8)
        image[:, :30] = [0, 180, 255]
        image[:, 30:60] = [0, 0, 235]
        image[:, 60:90] = [235, 60, 15]
        field = np.ones(image.shape[:2], dtype=bool)
        field[30:50, 15:45] = False  # An already assigned figure crosses two colours.
        figure = ~field
        records = [
            {"id": "field", "label": "colorful background", "type": "figure", "scores": [.9]},
            {"id": "figure", "label": "painted hand", "type": "figure", "scores": [.9]},
        ]
        masks = [field, figure]

        add_palette_regions(image, records, masks, {"field", "figure"})

        self.assertEqual({record["label"] for record in records[2:]}, {"Amber and yellow paint", "Red paint", "Blue paint"})
        self.assertTrue(np.array_equal(masks[1], figure))
        self.assertTrue(np.array_equal(masks[0] | np.logical_or.reduce(masks[2:]), field))
        self.assertTrue(np.all(np.sum(masks, axis=0) == 1))


class ArtworkIsolationTests(unittest.TestCase):
    def test_whole_artwork_mask_is_available_when_no_region_was_proposed(self) -> None:
        image = np.full((50, 80, 3), 100, dtype=np.uint8)
        painted = np.zeros(image.shape[:2], dtype=np.uint8)
        painted[5:45, 10:65] = 255
        with tempfile.TemporaryDirectory() as directory:
            sam3 = Path(directory)
            cv2.imwrite(str(sam3 / "artwork.png"), painted)
            (sam3 / "artwork.json").write_text(json.dumps([{"mask": "artwork.png"}]))
            artwork, regions, metadata = isolate_painted_artwork(image, [], sam3, [0, 0, 80, 50], painted.shape)

        self.assertEqual(artwork.shape, (40, 55, 4))
        self.assertEqual(regions, [])
        self.assertEqual(metadata["layout"], "transparent_silhouette")

    def test_single_sam_mask_joins_supported_seam_and_keeps_ambiguous_gaps(self) -> None:
        image = np.full((80, 150, 3), 45, dtype=np.uint8)
        painted = np.zeros(image.shape[:2], dtype=bool)
        painted[12:68, 8:65] = True
        painted[12:68, 77:142] = True
        painted[:, 107:109] = False  # A narrow gap without its own pair of panel edges.
        image[12:68, 8:65] = 188
        image[12:68, 77:142] = 190
        shape = np.zeros_like(painted)
        shape[30:54, 35:96] = True
        records = [{"id": "spans_panels", "type": "figure", "mask": shape, "point_px": (80, 40)}]
        with tempfile.TemporaryDirectory() as directory:
            sam3 = Path(directory)
            cv2.imwrite(str(sam3 / "combined.png"), painted.astype(np.uint8) * 255)
            (sam3 / "artwork.json").write_text(json.dumps([{"mask": "combined.png"}]))
            artwork, regions, metadata = isolate_painted_artwork(image, records, sam3, [0, 0, 150, 80], painted.shape)
            # The same mask over a level painted wall supplies no physical seam evidence.
            flat = np.full_like(image, 190)
            flat_result, _, flat_metadata = isolate_painted_artwork(flat, records, sam3, [0, 0, 150, 80], painted.shape)
            stripe = flat.copy()
            stripe[:, 65:77] = 45
            _, _, stripe_metadata = isolate_painted_artwork(stripe, records, sam3, [0, 0, 150, 80], painted.shape)

        self.assertEqual(metadata["removed_column_ranges"], [[65, 77]])
        self.assertEqual(artwork.shape, (56, 122, 4))
        self.assertFalse(artwork[:, 87:89, 3].any())
        self.assertEqual(regions[0]["id"], "spans_panels")
        self.assertEqual(regions[0]["point_px"], (60, 28))
        self.assertTrue(regions[0]["mask"][28, 56:58].all())
        self.assertEqual(flat_metadata["layout"], "transparent_silhouette")
        self.assertFalse(flat_result[:, 57:69, 3].any())
        self.assertEqual(stripe_metadata["layout"], "transparent_silhouette")

    def test_joined_panels_keep_irregular_edges_and_remap_hit_masks(self) -> None:
        image = np.full((32, 64, 3), 127, dtype=np.uint8)
        left = np.zeros(image.shape[:2], dtype=bool)
        right = np.zeros_like(left)
        left[4:25, 3:17] = True
        left[4:12, 3:8] = False
        right[2:27, 43:61] = True
        records = [
            {"type": "wall", "mask": np.ones_like(left), "point_px": (32, 10)},
            {"type": "figure", "mask": right, "point_px": (50, 10)},
        ]
        with tempfile.TemporaryDirectory() as directory:
            sam3 = Path(directory)
            for index, mask in enumerate((left, right)):
                cv2.imwrite(str(sam3 / f"{index}.png"), mask.astype(np.uint8) * 255)
            (sam3 / "artwork.json").write_text(json.dumps([{"mask": "0.png"}, {"mask": "1.png"}]))
            artwork, regions, metadata = isolate_painted_artwork(image, records, sam3, [0, 0, 64, 32], (32, 64))

        self.assertEqual(artwork.shape, (25, 32, 4))
        self.assertEqual(metadata["layout"], "joined_panels")
        self.assertEqual(metadata["segments"][1]["output_origin"]["x"], 14)
        self.assertEqual(artwork[3, 0, 3], 0)
        self.assertTrue(np.array_equal(regions[0]["mask"], artwork[:, :, 3] > 0))
        self.assertEqual(regions[1]["point_px"], (21, 8))


if __name__ == "__main__":
    unittest.main()
