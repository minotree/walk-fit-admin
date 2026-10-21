# React + TypeScript + Vite

## 사진 조인 및 조사 승인 DB 업데이트

지점 저장 시 사진 경로를 복사하지 않고 조사 사진을 조인해 표시합니다.
조사 승인은 트랜잭션 RPC를 사용합니다. 배포 전에 [DB 적용 안내](supabase/README.md)에 따라
점검 SQL과 마이그레이션을 실행해야 합니다. 기존 사진 컬럼은 이관 전 호환용으로 유지합니다.

## 전체 데이터 초기화

상단 `데이터 초기화` → `삭제 대상 조회·새로고침`으로 행/파일 수를 확인한 후,
확인 체크와 `전체 초기화` 입력을 마쳐야 실행됩니다.
`site_equipment`, `exercise_sites`, `equipment_catalog`, `survey_locations`의 모든 행과
`equipment-images`, `survey-photos`의 모든 파일(현장 조사 원본 포함)이 대상입니다.
계정/권한/테이블/버킷 구조는 유지합니다.

백업 후 다른 클라이언트의 수집/수정을 중단하고 실행하세요. 파일 삭제와 테이블 삭제는
하나의 트랜잭션이 아니므로 중간 실패 시 이미 완료된 삭제는 되돌릴 수 없습니다.
실패하면 새로 조회하여 남은 항목을 확인하세요. 기존 로그인 계정의 Supabase RLS/Storage
정책을 사용하며, 관리자 권한 확인은 삭제 직전에도 수행합니다. 서비스 역할 키는 사용하지 않습니다.
삭제 권한이 부족하면 서버 정책 설정이 필요합니다.

`node --test scripts/test-data-reset.mjs`는 가짜 데이터만 사용하며 실제 삭제를 수행하지 않습니다.

## Windows 실행파일 빌드

```powershell
.\scripts\build-admin.cmd
```

Rust와 Microsoft C++ Build Tools가 필요합니다. 실행파일은
`src-tauri/target/release/WalkFitAdmin.exe`, 설치파일은
`src-tauri/target/release/bundle/`에 생성됩니다.
이미지 서버는 앱 실행 시 자동으로 시작되고 종료 시 함께 종료됩니다. Python 환경의 최초 준비는 필요합니다.

저장 화면 회귀 테스트는 `node scripts/test-equipment-save.mjs`로 실행합니다.
설치된 Edge를 화면 없이 실행하고 메모리의 테스트 서비스만 사용하며, 실제 Supabase에 쓰지 않습니다.

## 운동기구 사진 변환

HEIC 지원, 사람 자동 감지와 수동 가림, 기구 영역 자르기, 모바일 WebP 변환을 제공합니다.
최초 설치와 실행 방법은 [이미지 처리 안내](image-service/README.md)를 참고하세요.
현재 환경에 패키지와 모델이 준비되어 있으면 `npm.cmd run dev`만 실행합니다.
Tauri는 `npm.cmd run tauri:dev`로 실행하며 이미지 서버도 자동으로 시작합니다.

대표 사진과 운동기구 도감의 사진 교체는 새 파일 업로드와 DB 저장 성공 후 이전 파일을 정리합니다.
조사·지점·도감에서 참조 중인 파일과 외부 URL은 유지합니다. 설치 기구는 도감의 사진을 참조합니다.
정리 실패 시 사진 저장은 유지하고 화면에 안내합니다. 기존에 쌓인 미사용 파일을 일괄 삭제하지는 않습니다.
참조 확인에는 관리자 계정의 전체 조회 권한, 파일 정리에는 해당 버킷의 삭제 권한이 필요합니다.
다른 클라이언트의 동시 참조 추가와 Storage 삭제는 하나의 트랜잭션으로 처리되지 않습니다.
`node --test scripts/test-image-cleanup.mjs scripts/test-image-replacement.mjs`로 실제 데이터 없이 검증합니다.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
