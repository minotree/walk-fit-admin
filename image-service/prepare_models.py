"""Download public model weights only. Never reads or sends photographs."""
from pathlib import Path
import hashlib
import urllib.request

from processor import subject_box
from PIL import Image

folder = Path(__file__).parent / '.models'
folder.mkdir(exist_ok=True)
target = folder / 'person-yolox.onnx'
expected = 'c5c2d13e59ae883e6af3b45daea64af4833a4951c92d116ec270d9ddbe998063'
if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != expected:
    print('Downloading OpenCV Zoo YOLOX person detector...', flush=True)
    url = 'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/object_detection_yolox/object_detection_yolox_2022nov.onnx'
    with urllib.request.urlopen(url, timeout=60) as response:
        data = response.read(40 * 1024 * 1024)
    if hashlib.sha256(data).hexdigest() != expected:
        raise RuntimeError('Person model checksum mismatch')
    target.write_bytes(data)
print('Preparing foreground detector...', flush=True)
subject_box(Image.new('RGB', (64, 64), 'white'))
print('Models ready.', flush=True)
