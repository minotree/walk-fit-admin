# React + TypeScript + Vite

## Windows 실행파일 빌드

```powershell
.\scripts\build-admin.cmd
```

Rust와 Microsoft C++ Build Tools가 필요합니다. 실행파일은
`src-tauri/target/release/WalkFitAdmin.exe`, 설치파일은
`src-tauri/target/release/bundle/`에 생성됩니다.
현재 이미지 변환은 별도 로컬 서버가 필요하므로 `scripts\start-image-service.cmd`도 실행하세요.

저장 화면 회귀 테스트는 `node scripts/test-equipment-save.mjs`로 실행합니다.
설치된 Edge를 화면 없이 실행하고 메모리의 테스트 서비스만 사용하며, 실제 Supabase에 쓰지 않습니다.

## 운동기구 사진 변환

HEIC 지원, 사람 자동 감지와 수동 가림, 기구 영역 자르기, 모바일 WebP 변환을 제공합니다.
최초 설치와 실행 방법은 [이미지 처리 안내](image-service/README.md)를 참고하세요.
현재 환경에 패키지와 모델이 준비되어 있으면, `scripts\start-image-service.cmd`와
`npm.cmd run dev`를 각각 실행합니다.

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
