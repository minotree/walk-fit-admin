"""Explicit local sample check; writes only optimized previews to ignored test-output/."""
import json
import sys
from pathlib import Path

from PIL import Image
from app import analyze
from processor import decode_image, render

folder = Path(__file__).parent / 'test-output'
folder.mkdir(exist_ok=True)
for filename in sys.argv[1:]:
    path = Path(filename)
    image = decode_image(path.read_bytes())
    result = analyze(image)
    raw, size = render(image, result['crop'], result['boxes'])
    target = folder / (path.stem + '.webp')
    target.write_bytes(raw)
    # PNG preview for local visual inspection; no original copy is retained.
    with Image.open(target) as preview:
        preview.save(target.with_suffix('.png'))
    print(json.dumps({'file': path.name, 'size': size, 'bytes': len(raw),
                      'boxes': result['boxes'], 'crop': result['crop'],
                      'warning': result['warning']}, ensure_ascii=True))
