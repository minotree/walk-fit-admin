# 운동기구 이미지 처리

원본은 로컬 Python 프로세스에서만 처리합니다. 클라우드로 전송하거나 영구 보관하지 않습니다.
업로드 수신 중 생성될 수 있는 로컬 임시 파일은 읽은 후 닫아 삭제합니다.
처리 서버는 `127.0.0.1:8765`에만 바인딩합니다. 인터넷에 노출하지 마세요.

## 최초 준비 (프로젝트 루트, PowerShell)

```powershell
python -m venv .venv-images
.venv-images\Scripts\python.exe -m pip install -r image-service\requirements.txt
.venv-images\Scripts\python.exe image-service\prepare_models.py
```

## 실행

두 터미널에서 각각 실행합니다.

```powershell
.\scripts\start-image-service.cmd
```

```powershell
npm.cmd run dev
```

운동기구 도감 → 신규/기존 기구 → 이미지 선택·변환(모달) → 이미지 선택 → 가림/자르기 수정 →
WebP 결과 만들기 → 전체 확인 체크 → 확인한 이미지 적용 → 운동기구 정보 저장.
적용 단계에서는 브라우저 메모리에만 보관하고, 기구 저장 시 WebP를 Supabase에 업로드합니다.
모달은 닫기/취소/ESC로 닫을 수 있으며, 같은 기구에서 다시 열면 편집 상태를 유지합니다.

## 처리 정책

- HEIC/HEIF, JPEG, PNG, WebP 읽기 및 EXIF 회전 보정. 최대 25MB / 4천만 픽셀.
- 작업용 이미지 최대 2000px, 출력 최대 960×720px. 작은 원본 확대 없음.
- rembg u2netp로 전경 경계를 추정해 10% 여백을 포함하여 자동 자르기. 원래 배경 유지.
  운동기구 전용 모델은 아니므로 사람이나 배경을 피사체로 선택할 수 있습니다. 수동 자르기로 보정하세요.
- 최초 사용 시 u2netp 모델을 GitHub에서 다운로드하여 `.models/`에 보관합니다. 사진을 보내지 않습니다.
  다운로드/추론 실패 시 안내 후 수동 자르기를 사용합니다.
- OpenCV Zoo YOLOX 모델의 사람 분류로 가림 후보 생성. 전체 사진과 겹치는 4개 영역을 검사합니다.
  모델은 Apache-2.0 라이선스이며 준비 명령이 공식 저장소에서 내려받고 SHA-256을 검증합니다.
  작은 사람, 앉은 사람, 뒷모습, 가려진 사람 등의 감지는 보장하지 않습니다.
- 사람 영역의 세부 정보를 굵은 픽셀 모자이크로 제거합니다. 단색 사각형으로 덮지 않습니다.
  사람별 최대 10열/22행, 최소 16px 블록으로 축소한 뒤 확대하며 원본을 섞지 않습니다.
  잘못된 감지는 마지막 가림 취소로 수정할 수 있습니다.
  원본에서 직접 영역을 추가할 수 있고, 사람이 프레임 밖으로 빠지도록 수동 자르기도 가능합니다.
- 가림 전체 초기화 / 자동 감지 복원 / 선택 가림 삭제를 제공합니다.
  가림 영역을 클릭하거나 번호로 선택한 뒤 안쪽을 드래그하여 이동하고, 흰 핸들을 드래그하여 크기를 조정합니다.
  자르기 영역도 이동/크기 조정하거나 다시 그릴 수 있습니다.
  같은 기구 편집 중 이미지를 적용한 뒤 창을 다시 열면 원본과 편집 영역을 유지합니다.
  다른 기구 선택, 새 등록, 탭 이동, 새로고침 시 메모리의 원본/편집 상태는 초기화됩니다.
- WebP 품질 80부터 65까지 조정하여 200KB 이하를 목표로 합니다. 용량 상한을 보장하지는 않습니다.
- 최종 출력은 새 RGB 픽셀로 인코딩하여 EXIF/GPS/XMP를 복사하지 않습니다.
- 자동 처리 후 최종 확인 체크가 필수입니다. 식별 가능성이나 초상권 문제 해소를 자동으로 보장하지 않습니다.
- Tauri도 이 로컬 서버를 별도로 실행해야 합니다. Python 서비스 자동 번들링은 포함하지 않습니다.
  원격 웹 배포는 처리 서버의 인증/HTTPS 구성이 별도로 필요합니다.

## 검증

```powershell
.venv-images\Scripts\python.exe -m unittest discover -s image-service -p "test_*.py" -v
node --test scripts/test-image-regions.mjs
```

API 업로드 방식: https://fastapi.tiangolo.com/tutorial/request-files/
회전 보정: https://pillow.readthedocs.io/en/stable/reference/ImageOps.html
사람 감지 모델 및 라이선스: https://github.com/opencv/opencv_zoo/tree/main/models/object_detection_yolox
