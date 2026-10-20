import base64
import json
import io
import threading

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from processor import decode_image, person_boxes, render, subject_box

app = FastAPI(docs_url=None, redoc_url=None)
app.add_middleware(CORSMiddleware,
    allow_origins=['http://127.0.0.1:5173', 'http://localhost:5173',
                   'http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost'],
    allow_methods=['POST', 'GET'], allow_headers=['Content-Type'])
lock = threading.Lock()
MAX_BYTES = 25 * 1024 * 1024


def validate_rect(rect):
    if not isinstance(rect, list) or len(rect) != 4:
        raise ValueError('영역 형식이 올바르지 않습니다.')
    if any(type(v) not in (int, float) or not 0 <= v <= 1 for v in rect):
        raise ValueError('영역 좌표는 0~1이어야 합니다.')
    if rect[2] <= rect[0] or rect[3] <= rect[1]:
        raise ValueError('영역의 크기가 올바르지 않습니다.')
    return rect


async def read_image(file):
    raw = await file.read(MAX_BYTES + 1)
    await file.close()
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, '25MB 이하 이미지를 선택해 주세요.')
    try:
        return await run_in_threadpool(decode_image, raw)
    except Exception as exc:
        raise HTTPException(400, '이미지를 읽을 수 없습니다. HEIC/JPEG/PNG/WebP 파일을 확인해 주세요.') from exc


def analyze(image):
    with lock:
        warnings = []
        try:
            people = person_boxes(image)
        except Exception:
            people = []
            warnings.append('사람 자동 감지를 실행하지 못했습니다. 사진 전체를 확인하고 사람을 직접 가려 주세요. 모델 준비 방법은 image-service/README.md를 확인하세요.')
        try:
            subject = subject_box(image)
        except Exception:
            subject = None
            warnings.append('피사체 자동 감지에 실패했습니다. 기구 영역을 직접 지정해 주세요.')
        if subject is None and not warnings:
            warnings.append('피사체를 찾지 못했습니다. 기구 영역을 직접 지정해 주세요.')
        stream = io.BytesIO()
        image.save(stream, 'PNG')
        crop = [0, 0, 1, 1]
        if subject:
            x1, y1, x2, y2 = subject
            dx, dy = (x2 - x1) * .1, (y2 - y1) * .1
            crop = [max(0, x1 - dx), max(0, y1 - dy), min(1, x2 + dx), min(1, y2 + dy)]
        return {'preview': 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode(),
                'boxes': people, 'crop': crop, 'warning': ' '.join(warnings) or None,
                'width': image.width, 'height': image.height}


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/analyze')
async def analyze_image(file: UploadFile = File(...)):
    image = await read_image(file)
    return await run_in_threadpool(analyze, image)


@app.post('/render')
async def render_image(file: UploadFile = File(...), regions: str = Form(...)):
    try:
        options = json.loads(regions)
        crop = validate_rect(options['crop'])
        boxes = options['boxes']
        if not isinstance(boxes, list) or len(boxes) > 100:
            raise ValueError('가림 영역은 최대 100개입니다.')
        boxes = [validate_rect(box) for box in boxes]
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(400, '자르기/가림 영역이 올바르지 않습니다.') from exc
    image = await read_image(file)
    raw, size = await run_in_threadpool(render, image, crop, boxes)
    return {'preview': 'data:image/webp;base64,' + base64.b64encode(raw).decode(),
            'width': size[0], 'height': size[1], 'bytes': len(raw)}
