import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageChops

from region_coverage import (
    local_detail_candidates, merge_coverage_masks, prepare_coverage_search, prepare_detail_search,
    prepare_figure_context, remap_focus_candidates,
)


def save_region(directory, name, kind, mask, *, reviewed=True, score=.9):
    filename = f"{name}.png"
    mask.save(directory / filename)
    return {
        "id": name, "label": name, "type": kind,
        "source_mask": filename, "hit_mask": filename, "visual_mask": filename,
        "sam_scores": [score], "category_source": "mask_review" if reviewed else "vision_proposal",
    }


class RegionCoverageTests(unittest.TestCase):
    def setUp(self):
        workspace = tempfile.TemporaryDirectory()
        self.addCleanup(workspace.cleanup)
        self.root = Path(workspace.name)
        self.before = self.root / "before"
        self.after = self.root / "after"
        self.before.mkdir()
        self.after.mkdir()
        self.size = (200, 100)
        self.visible = ImageChops.lighter(self.mask((0, 0, 90, 100)), self.mask((110, 0, 200, 100)))
        image = Image.new("RGB", self.size, "#bf584e")
        image.putalpha(self.visible)
        image.save(self.before / "artwork.png")
        self.manifest = {
            "processed_image": "artwork.png", "interaction_partition": {"exclusive": True},
            "preprocessing": {"coordinate_transform": {
                "prepared_to_output_segments": [
                    {"prepared_rect": [0, 0, 90, 100], "output_origin": {"x": 0, "y": 0}},
                    {"prepared_rect": [160, 0, 270, 100], "output_origin": {"x": 90, "y": 0}},
                ],
            }},
            "regions": [],
        }

    def mask(self, bounds):
        mask = Image.new("L", self.size)
        mask.paste(255, bounds)
        return mask

    def test_search_uses_both_panels_and_leaves_transparency_out(self):
        _, target, crops = prepare_coverage_search(self.before, self.manifest, self.root)
        self.assertEqual(target.histogram()[255], 18000)
        self.assertTrue(any(box[2] <= 90 for _, box in crops))
        self.assertTrue(any(box[0] >= 90 for _, box in crops))
        self.assertTrue(all(box[2] <= 90 or box[0] >= 90 for _, box in crops))

        candidate = {"label": "lettering", "bbox": [0, 100, 500, 900], "point": [250, 500]}
        mapped = remap_focus_candidates([candidate], (110, 0, 190, 100), target)
        self.assertEqual(mapped[0]["bbox"], [550, 100, 750, 900])
        self.assertEqual(mapped[0]["point"], [650, 500])
        self.assertEqual(remap_focus_candidates([candidate], (90, 0, 110, 100), target), [])

    def test_new_same_category_mask_survives_a_bad_candidate(self):
        first = self.mask((10, 15, 70, 55))
        missing = self.mask((125, 10, 185, 40))
        self.manifest["regions"] = [save_region(self.before, "first", "lettering", first)]
        found = {"regions": [
            save_region(self.after, "duplicate", "lettering", first),
            save_region(self.after, "disjoint", "lettering", missing),
            save_region(self.after, "unconfirmed", "figure", self.mask((120, 45, 170, 80)), reviewed=False),
            save_region(self.after, "outside", "abstract_shape", self.mask((91, 5, 109, 90))),
        ]}
        result, report = merge_coverage_masks(
            self.manifest, self.before, found, self.after, self.visible,
        )

        self.assertEqual([item["id"] for item in result["regions"]], ["first", "disjoint"])
        self.assertEqual(report["covered_after"] - report["covered_before"], 1800)
        with Image.open(self.after / "first.png") as after:
            self.assertIsNone(ImageChops.difference(first, after).getbbox())
        self.assertEqual((self.before / "artwork.png").read_bytes(), (self.after / "artwork.png").read_bytes())

    def test_new_type_can_reclaim_a_small_feature_from_a_broad_mask(self):
        original = save_region(self.before, "letters", "lettering", self.visible)
        self.manifest["regions"] = [original]
        star = self.mask((15, 15, 35, 35))
        repeated = save_region(self.after, "repeat", "lettering", star)
        abstract = save_region(self.after, "star", "abstract_shape", star)
        abstract["category_evidence"] = "A separate painted star"
        result, _ = merge_coverage_masks(
            self.manifest, self.before, {"regions": [repeated, abstract]},
            self.after, self.visible, split_large_masks=True,
        )
        self.assertEqual([r["id"] for r in result["regions"]], ["letters", "star"])
        with Image.open(self.after / original["hit_mask"]) as remainder:
            self.assertEqual(ImageChops.darker(remainder, star).histogram()[255], 0)
            self.assertEqual(ImageChops.lighter(remainder, star).histogram()[255], 18000)

    def test_search_checks_uncovered_panels_before_large_existing_masks(self):
        left = self.mask((0, 0, 90, 100))
        self.manifest["regions"] = [save_region(self.before, "paint", "painted_ground", left)]
        _, target, crops = prepare_coverage_search(self.before, self.manifest, self.root, include_large_masks=True)

        self.assertIsNone(ImageChops.difference(target, self.mask((110, 0, 200, 100))).getbbox())
        self.assertTrue(crops)
        self.assertTrue(all(box[0] >= 90 for _, box in crops))

    def test_figure_context_keeps_space_for_an_adjacent_object(self):
        figure = save_region(self.before, "figure", "figure", self.mask((40, 10, 80, 90)))
        self.manifest["regions"] = [{**figure, "area_ratio": .16}]
        canvas = self.before / "artwork.png"
        _, box = prepare_figure_context(self.before, self.manifest, canvas)
        self.assertEqual(box, (15, 0, 105, 100))

        candidate = {"label": "held object", "bbox": [800, 200, 900, 600], "point": [850, 400]}
        mapped = remap_focus_candidates([candidate], box, Image.new("L", self.size, 255))
        self.assertEqual(mapped[0]["bbox"], [435, 200, 480, 600])

    def test_full_coverage_still_checks_each_panel_and_remaps_exclusions(self):
        self.manifest["regions"] = [
            save_region(self.before, "left-panel", "figure", self.mask((0, 0, 90, 100))),
            save_region(self.before, "right-panel", "painted_ground", self.mask((110, 0, 200, 100))),
        ]
        self.assertIsNone(prepare_coverage_search(self.before, self.manifest, self.root))
        _, visible, crops = prepare_detail_search(self.before, self.manifest)
        self.assertEqual([box for _, box in crops], [(0, 0, 90, 100), (96, 0, 200, 100)])
        candidate = {"label": "ornament", "type": "abstract_shape",
                     "bbox": [200, 300, 600, 600], "point": [400, 400]}
        generic = {**candidate, "label": "Abstract Shape"}
        mapped = local_detail_candidates([candidate, generic], crops[1][1], visible, [
            {**candidate, "exclude": [[700, 500], ["bad", 300]]},
        ])
        self.assertEqual(len(mapped), 1)
        self.assertEqual(mapped[0]["bbox"], [585, 300, 790, 600])
        self.assertEqual(mapped[0]["negative_points"], [[844, 500]])

    def test_local_details_preserve_other_regions_and_most_of_the_parent(self):
        parent = self.mask((0, 0, 90, 100))
        original = save_region(self.before, "figure", "figure", parent)
        separate = save_region(self.before, "existing-symbol", "abstract_shape", self.mask((115, 5, 150, 45)))
        self.manifest["regions"] = [original, separate]
        shared = self.mask((22, 15, 50, 55))
        small = save_region(self.after, "ornament", "abstract_shape", shared)
        large = save_region(self.after, "whole-facemask", "depicted_object", self.mask((12, 0, 89, 75)))
        for region in [small, large]:
            region["category_evidence"] = "A recognizable separate detail"
        result, report = merge_coverage_masks(
            self.manifest, self.before, {"regions": [small, large]}, self.after, self.visible, local_details=True,
        )
        self.assertEqual(report["accepted_labels"], ["ornament"])
        self.assertEqual(report["rejected_labels"], ["whole-facemask"])
        self.assertEqual([r["id"] for r in result["regions"]], ["figure", "existing-symbol", "ornament"])
        with Image.open(self.after / original["hit_mask"]) as remainder:
            self.assertIsNone(ImageChops.darker(remainder, shared).getbbox())
            self.assertIsNone(ImageChops.difference(ImageChops.lighter(remainder, shared), parent).getbbox())


if __name__ == "__main__":
    unittest.main()
