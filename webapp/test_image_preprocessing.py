from __future__ import annotations

import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from image_preprocessing import ImagePreparationError, prepare_uploaded_image


def encoded_image(size: tuple[int, int], *, orientation: int = 1) -> bytes:
    image = Image.new("RGB", size, (42, 96, 138))
    exif = Image.Exif()
    exif[274] = orientation
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=88, exif=exif)
    return buffer.getvalue()


class ImagePreprocessingTests(unittest.TestCase):
    def prepare(self, data: bytes) -> tuple[dict, Image.Image]:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        output = Path(temporary.name) / "prepared.png"
        metadata = prepare_uploaded_image(data, output)
        rendered = Image.open(output)
        self.addCleanup(rendered.close)
        return metadata, rendered

    def test_exif_orientation_is_applied(self) -> None:
        metadata, rendered = self.prepare(encoded_image((320, 640), orientation=6))
        self.assertEqual(metadata["oriented_size"], {"width": 640, "height": 320})
        self.assertTrue(metadata["orientation_corrected"])
        self.assertEqual(rendered.size, (640, 320))

    def test_extreme_panorama_is_padded_without_stretching(self) -> None:
        metadata, rendered = self.prepare(encoded_image((1800, 300)))
        self.assertEqual(rendered.size, (1800, 600))
        self.assertEqual(metadata["content_box"], [0, 150, 1800, 450])
        self.assertTrue(metadata["padding"]["applied"])

    def test_large_image_is_resized_proportionally(self) -> None:
        metadata, rendered = self.prepare(encoded_image((2400, 1200)))
        self.assertEqual(rendered.size, (1800, 900))
        self.assertEqual(metadata["resize"]["scale"], 0.75)

    def test_low_resolution_image_adds_warning(self) -> None:
        metadata, _ = self.prepare(encoded_image((320, 240)))
        self.assertTrue(metadata["warnings"])

    def test_total_pixel_limit_is_enforced(self) -> None:
        with patch("image_preprocessing.MAX_SOURCE_PIXELS", 1_000):
            with self.assertRaises(ImagePreparationError):
                self.prepare(encoded_image((40, 30)))


if __name__ == "__main__":
    unittest.main()
