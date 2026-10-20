import io
import unittest
from unittest.mock import patch

from PIL import Image
from fastapi.testclient import TestClient

from app import app
from processor import decode_image, render


class ProcessingTests(unittest.TestCase):
    def test_rotation_and_metadata_removed(self):
        source = Image.new('RGB', (200, 100), 'red')
        exif = Image.Exif()
        exif[274] = 6
        exif[315] = 'private photographer'
        buffer = io.BytesIO()
        source.save(buffer, 'JPEG', exif=exif)
        image = decode_image(buffer.getvalue())
        self.assertEqual(image.size, (100, 200))
        raw, _ = render(image, [0, 0, 1, 1], [])
        output = Image.open(io.BytesIO(raw))
        self.assertEqual(output.format, 'WEBP')
        self.assertFalse(output.getexif())
        self.assertNotIn('xmp', output.info)

    def test_mosaic_removes_fine_detail_and_output_bounds(self):
        image = Image.new('RGB', (2000, 1500), 'white')
        # Dense alternating black/white stripes must disappear inside the masked region.
        from PIL import ImageDraw
        draw = ImageDraw.Draw(image)
        for x in range(0, image.width, 2):
            draw.line((x, 0, x, image.height), fill='black')
        raw, size = render(image, [0, 0, 1, 1], [[.2, .2, .8, .8]])
        self.assertLessEqual(size[0], 960)
        self.assertLessEqual(size[1], 720)
        output = Image.open(io.BytesIO(raw)).convert('RGB')
        pixel = output.getpixel((size[0] // 2, size[1] // 2))
        self.assertTrue(all(110 <= value <= 145 for value in pixel))
        # Unmasked white margin from a separate crop is preserved; no grey cover is painted.
        self.assertLess(max(pixel) - min(pixel), 8)

    def test_small_source_not_upscaled(self):
        _, size = render(Image.new('RGB', (100, 80)), [0, 0, 1, 1], [])
        self.assertEqual(size, (100, 80))

    def test_endpoint_errors_and_detection_failure(self):
        client = TestClient(app)
        self.assertEqual(client.post('/analyze', files={'file': ('bad.heic', b'bad')}).status_code, 400)
        buffer = io.BytesIO()
        Image.new('RGB', (200, 200)).save(buffer, 'PNG')
        files = {'file': ('image.png', buffer.getvalue())}
        with patch('app.subject_box', side_effect=RuntimeError('model unavailable')), \
             patch('app.person_boxes', side_effect=RuntimeError('person model unavailable')):
            result = client.post('/analyze', files=files)
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json()['warning'])
        self.assertIn('사람 자동 감지', result.json()['warning'])
        self.assertEqual(client.post('/render', files=files,
            data={'regions': '{"crop":[0,0,2,1],"boxes":[]}'}).status_code, 400)
        result = client.post('/render', files=files,
            data={'regions': '{"crop":[0,0,1,1],"boxes":[[0,0,1,1]]}'})
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json()['preview'].startswith('data:image/webp;base64,'))


if __name__ == '__main__':
    unittest.main()
