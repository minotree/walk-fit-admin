"""Local-only image processing. Originals are never sent to cloud services."""
import io
import os
from pathlib import Path

# Keep model downloads inside the workspace, rather than the user's profile.
os.environ.setdefault('U2NET_HOME', str(Path(__file__).parent / '.models'))

import cv2
import numpy as np
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

register_heif_opener()
Image.MAX_IMAGE_PIXELS = 40_000_000
_session = None
_person_net = None


def decode_image(raw: bytes) -> Image.Image:
    with Image.open(io.BytesIO(raw)) as source:
        if source.width * source.height > Image.MAX_IMAGE_PIXELS:
            raise ValueError('이미지는 4천만 픽셀 이하여야 합니다.')
        image = ImageOps.exif_transpose(source).convert('RGBA')
        background = Image.new('RGB', image.size, 'white')
        background.paste(image, mask=image.getchannel('A'))
        background.thumbnail((2000, 2000), Image.Resampling.LANCZOS)
        return background


def person_boxes(image: Image.Image) -> list[list[float]]:
    """YOLOX COCO person class; full image plus overlapping tiles for distant people.

    Model format: OpenCV Zoo object_detection_yolox (Apache-2.0).
    https://github.com/opencv/opencv_zoo/tree/main/models/object_detection_yolox
    """
    global _person_net
    if _person_net is None:
        path = Path(__file__).parent / '.models' / 'person-yolox.onnx'
        _person_net = cv2.dnn.readNetFromONNX(str(path))
    anchors, steps = [], []
    for step in (8, 16, 32):
        for row in range(640 // step):
            for column in range(640 // step):
                anchors.append((column, row))
                steps.append(step)
    anchors, steps = np.asarray(anchors), np.asarray(steps)[:, None]
    windows = [(0, 0, image.width, image.height)]
    for y in (0, int(image.height * .4)):
        for x in (0, int(image.width * .4)):
            windows.append((x, y, min(image.width, x + int(image.width * .6)),
                            min(image.height, y + int(image.height * .6))))
    rectangles, confidences = [], []
    for left, top, right, bottom in windows:
        tile = image.crop((left, top, right, bottom))
        ratio = 640 / max(tile.size)
        resized = tile.resize((int(tile.width * ratio), int(tile.height * ratio)))
        pixels = np.full((640, 640, 3), 114, dtype=np.float32)
        pixels[:resized.height, :resized.width] = np.asarray(resized)
        _person_net.setInput(np.expand_dims(pixels.transpose(2, 0, 1), 0))
        detections = _person_net.forward()[0]
        scores = detections[:, 4] * detections[:, 5]
        is_person = np.argmax(detections[:, 5:], axis=1) == 0
        indices = np.where((scores >= .25) & is_person)[0]
        for i in indices:
            center = (detections[i, :2] + anchors[i]) * steps[i] / ratio
            size = np.exp(np.clip(detections[i, 2:4], -10, 10)) * steps[i] / ratio
            x, y = center - size / 2
            rectangles.append([float(x + left), float(y + top), float(size[0]), float(size[1])])
            confidences.append(float(scores[i]))
    keep = cv2.dnn.NMSBoxes(rectangles, confidences, .25, .45)
    result = []
    for i in np.asarray(keep).flatten():
        x, y, w, h = rectangles[int(i)]
        x1, y1 = max(0, x - w * .15), max(0, y - h * .1)
        x2, y2 = min(image.width, x + w * 1.15), min(image.height, y + h * 1.1)
        if x2 > x1 and y2 > y1:
            result.append([x1 / image.width, y1 / image.height, x2 / image.width, y2 / image.height])
    return result[:100]


def subject_box(image: Image.Image):
    global _session
    from rembg import new_session, remove
    if _session is None:
        _session = new_session('u2netp')
    mask = remove(image, session=_session, only_mask=True)
    mask = mask.point(lambda value: 255 if value > 100 else 0)
    box = mask.getbbox()
    if not box:
        return None
    x1, y1, x2, y2 = box
    return [x1 / image.width, y1 / image.height, x2 / image.width, y2 / image.height]


def render(image: Image.Image, crop, boxes) -> tuple[bytes, tuple[int, int]]:
    # Remove fine detail before resizing/encoding. Never blend original pixels back in.
    result = image.copy()
    for x1, y1, x2, y2 in boxes:
        bounds = (int(x1 * image.width), int(y1 * image.height),
                  min(image.width, int(x2 * image.width) + 1),
                  min(image.height, int(y2 * image.height) + 1))
        region = result.crop(bounds)
        # At most 10 columns / 22 rows per person, with a minimum 16px block.
        block = max(16, region.width / 10, region.height / 22)
        reduced = region.resize((max(1, int(region.width / block)),
                                 max(1, int(region.height / block))), Image.Resampling.BOX)
        mosaic = reduced.resize(region.size, Image.Resampling.NEAREST)
        result.paste(mosaic, bounds)
    x1, y1, x2, y2 = crop
    result = result.crop((int(x1 * image.width), int(y1 * image.height),
                          max(int(x1 * image.width) + 1, int(x2 * image.width)),
                          max(int(y1 * image.height) + 1, int(y2 * image.height))))
    # Subject crop includes ~10% margin, so 720px roughly yields a 600px subject.
    result.thumbnail((960, 720), Image.Resampling.LANCZOS)
    for quality in (80, 75, 70, 65):
        stream = io.BytesIO()
        # Fresh RGB pixels: no EXIF, GPS, ICC or XMP is copied.
        clean = Image.frombytes('RGB', result.size, result.tobytes())
        clean.save(stream, 'WEBP', quality=quality, method=6)
        raw = stream.getvalue()
        if len(raw) <= 200 * 1024:
            break
    return raw, result.size
