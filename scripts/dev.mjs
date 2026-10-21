import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let service;
let vite;
let stopping = false;
const healthy = async () => {
  try {
    const response = await fetch('http://127.0.0.1:8765/health', { signal: AbortSignal.timeout(1000) });
    return response.ok && (await response.json()).status === 'ok';
  } catch { return false; }
};
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  vite?.kill();
  service?.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
process.on('exit', () => { vite?.kill(); service?.kill(); });

try {
  if (!await healthy()) {
    const python = process.platform === 'win32' ? '.venv-images/Scripts/python.exe' : '.venv-images/bin/python';
    if (!existsSync(new URL(`../${python}`, import.meta.url))) throw new Error('이미지 서버 초기 설치가 필요합니다. image-service/README.md를 확인하세요.');
    service = spawn(python, ['-m', 'uvicorn', 'app:app', '--app-dir', 'image-service', '--host', '127.0.0.1', '--port', '8765'], { cwd: root, stdio: 'inherit', windowsHide: true });
    service.on('error', error => { console.error(error); stop(1); });
    service.on('exit', () => { if (!stopping) { console.error('이미지 서버가 종료되었습니다.'); stop(1); } });
    let ready = false;
    for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
      if (await healthy()) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error('이미지 서버 시작 시간이 초과되었습니다.');
  }
  if (!stopping) {
    vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit', windowsHide: true });
    vite.on('error', error => { console.error(error); stop(1); });
    vite.on('exit', code => stop(code ?? 1));
  }
} catch (error) {
  console.error(error.message);
  stop(1);
}
