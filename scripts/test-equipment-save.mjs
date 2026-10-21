// Run the real form against an in-memory service; never accesses Supabase.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const folder = path.resolve('.build-tools/save-test');
await mkdir(folder, { recursive: true });
const entry = path.join(folder, 'entry.tsx');
await writeFile(entry, `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { EquipmentPage } from '../../src/pages/EquipmentPage';
import { SurveyInboxPage } from '../../src/pages/SurveyInboxPage';
import { SitesPage } from '../../src/pages/SitesPage';
import { DataResetDialog } from '../../src/components/DataResetDialog';
import '../../src/index.css';
window.alert = () => { throw new Error('Native alert must not be used'); };
const sampleCanvas = document.createElement('canvas'); sampleCanvas.width = 1200; sampleCanvas.height = 1600;
const samplePreview = sampleCanvas.toDataURL('image/webp');
window.__samplePreview = samplePreview;
window.fetch = async url => {
  if (String(url) === samplePreview) return new Response(new Blob([Uint8Array.from(atob(samplePreview.split(',')[1]), c => c.charCodeAt(0))], { type: 'image/webp' }));
  if (String(url).endsWith('/analyze')) return new Response(JSON.stringify({ preview: samplePreview, width: 1200, height: 1600, boxes: [[.4, .3, .7, .6], [.5, .6, .65, .8]], crop: [0, 0, 1, 1], warning: null }));
  if (String(url).endsWith('/render')) return new Response(JSON.stringify({ preview: samplePreview, width: 2, height: 2, bytes: 80 }));
  throw new Error('Unexpected network request in isolated test');
};
const pause = () => new Promise(resolve => setTimeout(resolve, 60));
const assert = (value, message) => { if (!value) throw new Error(message); };
const button = text => Array.from(document.querySelectorAll('button')).find(item => item.textContent === text);
const save = () => button('운동기구 정보 저장').click();
const text = () => document.body.textContent;
const checks = [];
const root = createRoot(document.getElementById('root'));
const shell = children => <div className="app-shell"><header style={{ padding: '1rem 2rem' }}>Walk Fit Admin</header><main className="app-main"><div className="app-tabs" style={{ padding: 12 }}>관리자 탭</div>{children}</main></div>;
root.render(shell(<EquipmentPage />));
window.__showSurvey = () => root.render(shell(<SurveyInboxPage />));
window.__equipmentCount = 3;
window.__showSites = () => root.render(shell(<SitesPage key={'sites-' + window.__equipmentCount} />));
window.__resetCalls = 0;
window.__resetComplete = false;
const showReset = open => root.render(shell(<DataResetDialog open={open} onClose={() => showReset(false)} onComplete={() => { window.__resetComplete = true; }} />));
window.__showReset = () => showReset(true);
async function run() {
  await pause(); button('+ 새 기구 등록').click(); await pause();
  save(); await pause();
  assert(text().includes('운동기구 이름을 입력해 주세요.'), 'Missing name must show inline validation'); checks.push('validation');
  const input = document.querySelector('input[placeholder="예: 체스트 프레스"]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '테스트 기구');
  input.dispatchEvent(new Event('input', { bubbles: true })); await pause();
  button('이미지 선택·변환').click(); await pause(); save(); await pause();
  const modal = document.querySelector('dialog');
  assert(modal.open && modal.matches(':modal'), 'Image editor must open as a modal');
  assert(modal.contains(document.activeElement), 'Focus must move inside the modal');
  assert(text().includes('이미지 편집을 마친 뒤'), 'Editing guard must explain why saving is blocked'); checks.push('editing guard');
  const fileInput = modal.querySelector('input[type=file]');
  const transfer = new DataTransfer(); transfer.items.add(new File(['test'], 'test.webp', { type: 'image/webp' }));
  fileInput.files = transfer.files; fileInput.dispatchEvent(new Event('change', { bubbles: true })); await pause();
  button('WebP 결과 만들기').click(); await pause();
  modal.querySelector('input[type=checkbox]').click(); await pause();
  button('확인한 이미지 적용').click(); await pause();
  assert(!modal.open, 'Applying an image must close the modal');
  button('이미지 선택·변환').click(); await pause();
  assert(modal.open && modal.querySelector('input[type=file]') === fileInput && button('WebP 결과 만들기'), 'Reopening must preserve the editor and its image');
  button('닫기 ✕').click(); await pause(); assert(!modal.open, 'Header close button must close the modal');
  button('이미지 선택·변환').click(); await pause();
  modal.dispatchEvent(new Event('cancel', { cancelable: true })); await pause();
  assert(!modal.open, 'Native Escape/cancel must close the modal'); checks.push('modal open, apply, reopen, close and cancel');
  save(); await pause();
  assert(window.__saveCalls === 1 && text().includes('새 운동기구가 도감에 저장되었습니다.'), 'Create must succeed without native alerts'); checks.push('create');
  save(); await pause();
  assert(window.__updateCalls === 1 && text().includes('운동기구 정보가 저장되었습니다.'), 'Update must succeed'); checks.push('update');
  window.__failSave = true; save(); await pause();
  assert(text().includes('테스트 저장 오류 (42501)'), 'DB errors must remain visible');
  assert(!button('운동기구 정보 저장').disabled, 'Failure must allow retry'); checks.push('visible error and retry');
  document.getElementById('test-result').textContent = 'PASS: ' + checks.join(', ');
}
run().catch(error => { document.getElementById('test-result').textContent = 'FAIL: ' + error.message; });
`);
const mockService = `
let rows = []; window.__saveCalls = 0; window.__updateCalls = 0;
export async function listEquipmentCatalog() { return rows; }
export async function createEquipmentCatalog(item) { window.__saveCalls++; const row = { ...item, id: 'mock-1' }; rows = [row]; return row; }
export async function updateEquipmentCatalog(id, item) { if (window.__failSave) throw new Error('테스트 저장 오류 (42501)'); window.__updateCalls++; return { ...item, id }; }
export async function uploadEquipmentImage() { return 'https://example.test/mock-equipment.webp'; }
`;
const result = await build({ configFile: false, logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [
  { name: 'mock-equipment-service', enforce: 'pre', resolveId(id, importer) {
    if (id === '../services/equipment' && importer?.replaceAll('\\', '/').endsWith('/src/pages/EquipmentPage.tsx')) return '\0mock-equipment';
    if (id === '../services/surveys' && importer?.replaceAll('\\', '/').endsWith('/src/pages/SurveyInboxPage.tsx')) return '\0mock-surveys';
    if (id === '../components/LocationPickerMap' && importer?.replaceAll('\\', '/').endsWith('/src/pages/SurveyInboxPage.tsx')) return '\0mock-map';
    if (id === '../services/sites' && importer?.replaceAll('\\', '/').endsWith('/src/pages/SitesPage.tsx')) return '\0mock-sites';
    if (id === '../services/siteEquipment' && importer?.replaceAll('\\', '/').endsWith('/src/components/SiteEquipmentManager.tsx')) return '\0mock-site-equipment';
    if (id === '../services/equipment' && importer?.replaceAll('\\', '/').endsWith('/src/components/SiteEquipmentManager.tsx')) return '\0mock-equipment';
    if (id === '../services/dataReset' && importer?.replaceAll('\\', '/').endsWith('/src/components/DataResetDialog.tsx')) return '\0mock-reset';
  }, load(id) {
    if (id === '\0mock-equipment') return mockService;
    if (id === '\0mock-surveys') return `
      export async function listSurveyLocations() { return [{ id: 'survey-test', address: '서울특별시 도봉구 테스트 주소', review_note: '현장 메모 테스트입니다. 운동기구와 편의시설을 확인했습니다.', stamped_photo_path: 'test', latitude: 37.5, longitude: 127, status: 'pending', created_at: '2026-10-21' }]; }
      export function getSurveyImageUrl() { return window.__samplePreview; }
      export async function approveSurveyToSite() { throw new Error('Approval must not be called in layout tests'); }
      export async function updateSurveyPhoto(id, file) {
        if (window.__failSurveySave) throw new Error('대표 사진 저장 테스트 오류');
        window.__surveyUploads = (window.__surveyUploads || 0) + 1;
        window.__surveySaved = { id, type: file.type };
        return { path: 'edited.webp' };
      }
    `;
    if (id === '\0mock-map') return `import React from 'react'; export function LocationPickerMap({ height }) { return React.createElement('div', { style: { height, width: '100%', boxSizing: 'border-box', border: '1px solid #ccc' } }, '테스트 지도'); }`;
    if (id === '\0mock-sites') return `
      export async function listSites() { return { data: [{ id: 'site-test', name: '테스트 지점', address_text: '서울특별시 도봉구 테스트 주소', amenity_note: '현장 확인 완료', site_image_path: 'test', last_verified_at: '2026-10-21', is_published: false, toilet_status: 'unknown', drinking_water_status: 'unknown' }], totalCount: 1 }; }
      export function getSiteImageUrl() { return window.__samplePreview; }
      export async function updateSite() { throw new Error('Must not write site data in layout test'); }
    `;
    if (id === '\0mock-site-equipment') return `
      export async function listSiteEquipment() { return Array.from({ length: window.__equipmentCount }, (_, index) => ({ id: 'equipment-' + index, quantity: 1, is_published: true, equipment_catalog: { name: '테스트 기구 ' + index } })); }
      export async function addSiteEquipment() { throw new Error('Must not add equipment'); }
      export async function updateSiteEquipment() { throw new Error('Must not update equipment'); }
      export async function deleteSiteEquipment() { throw new Error('Must not delete equipment'); }
    `;
    if (id === '\0mock-reset') return `
      const initial = { tables: { site_equipment: 2, exercise_sites: 1, equipment_catalog: 2, survey_locations: 1 }, buckets: { 'equipment-images': ['test.webp'], 'survey-photos': ['test.webp'] } };
      export const dataReset = { async preview() { return initial; }, async reset(preview, confirmation, progress) {
        if (confirmation !== '전체 초기화') throw new Error('Wrong confirmation');
        window.__resetCalls++; progress('검증 중');
        return { tables: { site_equipment: 0, exercise_sites: 0, equipment_catalog: 0, survey_locations: 0 }, buckets: { 'equipment-images': [], 'survey-photos': [] } };
      } };
    `;
  } }, react(),
], build: { write: false, lib: { entry, formats: ['iife'], name: 'EquipmentSaveTest' } } });
const bundles = Array.isArray(result) ? result : [result];
const script = bundles.flatMap(bundle => bundle.output).find(item => item.type === 'chunk').code;
const css = bundles.flatMap(bundle => bundle.output).filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => item.source).join('\n');
const html = path.join(folder, 'test.html');
await writeFile(html, '<!doctype html><meta charset="utf-8"><style>' + css + '</style><div id="root"></div><pre hidden id="test-result">RUNNING</pre><script>' + script.replaceAll('</script', '<\\/script') + '</script>');
const browser = process.env.TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const child = spawn(browser, ['--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking',
  '--user-data-dir=' + path.join(folder, 'profile'), '--remote-debugging-port=9224',
  '--remote-debugging-address=127.0.0.1', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const pause = () => new Promise(resolve => setTimeout(resolve, 200));
let socket;
try {
  let version;
  for (let i = 0; i < 50; i++) {
    try { version = await (await fetch('http://127.0.0.1:9224/json/version')).json(); break; } catch { await pause(); }
  }
  if (!version) throw new Error('Test browser did not start its local debugging endpoint');
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = event => { const message = JSON.parse(event.data); if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); } };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, message => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const { targetId } = await send('Target.createTarget', { url: pathToFileURL(html).href });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  let status;
  for (let i = 0; i < 50; i++) {
    const response = await send('Runtime.evaluate', { expression: "document.getElementById('test-result')?.textContent", returnByValue: true }, sessionId);
    status = response.result?.value;
    if (status && status !== 'RUNNING') break;
    await pause();
  }
  if (!status?.startsWith('PASS:')) throw new Error(status || 'No browser test result');
  console.log(status);
  for (const [width, height] of [[800, 600], [1525, 1000], [1920, 1080]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
    await pause();
    const response = await send('Runtime.evaluate', { expression: `JSON.stringify({
      width: innerWidth, height: innerHeight,
      documentHeight: document.documentElement.scrollHeight, documentWidth: document.documentElement.scrollWidth,
      rootWidth: document.getElementById('root').getBoundingClientRect().width,
      pageBottom: document.querySelector('.workspace-page').getBoundingClientRect().bottom,
      panelHeight: document.querySelector('.workspace-page').lastElementChild.clientHeight,
      panelContent: document.querySelector('.workspace-page').lastElementChild.scrollHeight
    })`, returnByValue: true }, sessionId);
    const metrics = JSON.parse(response.result.value);
    if (metrics.documentHeight > height || metrics.documentWidth > width || metrics.rootWidth !== width || metrics.pageBottom > height + 1)
      throw new Error('Window overflow: ' + JSON.stringify(metrics));
    if (height === 600 && metrics.panelContent <= metrics.panelHeight) throw new Error('Long form must remain scrollable inside its panel');
    await send('Runtime.evaluate', { expression: "Array.from(document.querySelectorAll('button')).find(button => button.textContent === '이미지 선택·변환').click()" }, sessionId);
    await pause();
    const modalResponse = await send('Runtime.evaluate', { expression: `JSON.stringify((() => {
      const dialog = document.querySelector('dialog'); const bounds = dialog.getBoundingClientRect();
      const body = dialog.querySelector('.equipment-image-dialog-body');
      const section = dialog.querySelector('.image-editor-layout');
      const stage = dialog.querySelector('.image-editor-viewport > div').getBoundingClientRect();
      const viewport = dialog.querySelector('.image-editor-viewport').getBoundingClientRect();
      const buttons = Array.from(dialog.querySelectorAll('button')).filter(button => ['WebP 결과 만들기', '확인한 이미지 적용', '취소'].includes(button.textContent));
      return { modal: dialog.matches(':modal'), top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right,
        overflow: body.scrollHeight - body.clientHeight, contentOverflow: section.scrollHeight - section.clientHeight,
        stageVisible: stage.top >= viewport.top && stage.bottom <= viewport.bottom && stage.left >= viewport.left && stage.right <= viewport.right,
        aspectRatio: stage.width / stage.height,
        buttonsVisible: buttons.length === 3 && buttons.every(button => { const rect = button.getBoundingClientRect(); return rect.top >= bounds.top && rect.bottom <= bounds.bottom; }) };
    })())`, returnByValue: true }, sessionId);
    const modal = JSON.parse(modalResponse.result.value);
    if (!modal.modal || modal.top < 0 || modal.left < 0 || modal.bottom > height || modal.right > width)
      throw new Error('Modal overflow: ' + JSON.stringify(modal));
    if (modal.overflow > 1 || modal.contentOverflow > 1 || !modal.stageVisible || !modal.buttonsVisible || Math.abs(modal.aspectRatio - .75) > .01)
      throw new Error('Image editing must fit without scrolling or distortion: ' + JSON.stringify(modal));
    await send('Runtime.evaluate', { expression: "document.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }))" }, sessionId);
    await pause();
    console.log('PASS: viewport ' + width + 'x' + height + ', no outer scrollbar, internal panel accessible');
  }
  await send('Runtime.evaluate', { expression: 'window.__showSurvey()' }, sessionId);
  await pause();
  for (const [width, height] of [[1280, 720], [1525, 1000], [1920, 1080]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
    await pause();
    const response = await send('Runtime.evaluate', { expression: `JSON.stringify((() => {
      const panel = document.querySelector('.survey-detail-panel');
      const photo = document.querySelector('.survey-photo-card').getBoundingClientRect();
      const map = document.querySelector('.survey-map-card').getBoundingClientRect();
      const approve = Array.from(panel.querySelectorAll('button')).find(button => button.textContent.includes('승인 및 전환')).getBoundingClientRect();
      return { overflow: panel.scrollHeight - panel.clientHeight, pageOverflow: document.documentElement.scrollHeight - innerHeight,
        photoHeight: photo.height, mapHeight: map.height, sideBySide: map.left >= photo.right, approveBottom: approve.bottom };
    })())`, returnByValue: true }, sessionId);
    const layout = JSON.parse(response.result.value);
    if (layout.overflow > 1 || layout.pageOverflow > 0 || !layout.sideBySide || layout.photoHeight < 240 || layout.mapHeight < 240 || layout.approveBottom > height)
      throw new Error('Survey fullscreen overflow: ' + JSON.stringify(layout));
    console.log('PASS: survey ' + width + 'x' + height + ', photo/map/notes/approval visible without scrolling');
  }
  const surveyEditing = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 100));
    const button = text => Array.from(document.querySelectorAll('button')).find(b => b.textContent === text);
    const assert = (value, message) => { if (!value) throw new Error(message); };
    button('기존 사진 편집').click(); await pause();
    assert(document.querySelector('dialog')?.open && button('사진 영역 자르기'), 'Existing photo must load in the shared editor');
    assert(!button('WebP 결과 만들기').disabled, 'Existing photo must be analyzed automatically');
    button('취소').click(); await pause();
    assert(!window.__surveyUploads, 'Cancel must not upload');
    button('새 사진 선택·편집').click(); await pause();
    const input = document.querySelector('dialog input[type=file]');
    const transfer = new DataTransfer(); transfer.items.add(new File(['test'], 'new.webp', { type: 'image/webp' }));
    input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); await pause();
    button('WebP 결과 만들기').click(); await pause();
    document.querySelector('dialog input[type=checkbox]').click(); await pause();
    button('확인한 이미지 적용').click(); await pause();
    assert(window.__surveyUploads === 1 && window.__surveySaved.id === 'survey-test' && window.__surveySaved.type === 'image/webp', 'New edited photo must save to the selected survey');
    button('기존 사진 편집').click(); await pause();
    button('WebP 결과 만들기').click(); await pause();
    document.querySelector('dialog input[type=checkbox]').click(); await pause();
    window.__failSurveySave = true;
    button('확인한 이미지 적용').click(); await pause();
    assert(document.querySelector('dialog')?.open && document.querySelector('dialog').textContent.includes('대표 사진 저장 테스트 오류'), 'Save error must be visible inside the editor');
    window.__failSurveySave = false;
    button('확인한 이미지 적용').click(); await pause();
    assert(window.__surveyUploads === 2 && !document.querySelector('dialog'), 'Retry must preserve the edited result and close after saving');
    return 'PASS: survey existing/new photo editing, cancel without upload, confirmed WebP save and error retry';
  })()` }, sessionId);
  if (surveyEditing.exceptionDetails) throw new Error(JSON.stringify(surveyEditing.exceptionDetails));
  console.log(surveyEditing.result.value);
  for (const count of [0, 3, 30]) {
    await send('Runtime.evaluate', { expression: 'window.__equipmentCount = ' + count + '; window.__showSites()' }, sessionId);
    await pause();
    await send('Runtime.evaluate', { expression: "document.querySelector('.workspace-page > div:first-child > div:last-child > div').click()" }, sessionId);
    await pause();
    for (const [width, height] of [[1280, 720], [1525, 1000], [1920, 1080]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
      await pause();
      const response = await send('Runtime.evaluate', { expression: `JSON.stringify((() => {
        const panel = document.querySelector('.site-detail-panel');
        const form = document.querySelector('.site-edit-form').getBoundingClientRect();
        const manager = document.querySelector('.site-equipment-manager').getBoundingClientRect();
        const save = document.querySelector('.site-save-button').getBoundingClientRect();
        const list = document.querySelector('.site-equipment-list');
        return { overflow: panel.scrollHeight - panel.clientHeight, horizontalOverflow: panel.scrollWidth - panel.clientWidth,
          sideBySide: manager.left >= form.right, saveBottom: save.bottom, listOverflow: list.scrollHeight - list.clientHeight,
          managerBottom: manager.bottom, photoHeight: document.querySelector('.site-photo-frame').getBoundingClientRect().height,
          listHeight: list.clientHeight, listContentHeight: list.scrollHeight,
          addHeight: document.querySelector('.site-equipment-add-bar').getBoundingClientRect().height,
          managerHeight: manager.height };
      })())`, returnByValue: true }, sessionId);
      const layout = JSON.parse(response.result.value);
      if (layout.overflow > 1 || layout.horizontalOverflow > 1 || !layout.sideBySide || layout.saveBottom > height || layout.managerBottom > height || layout.photoHeight < 100)
        throw new Error('Sites fullscreen overflow: ' + JSON.stringify(layout));
      if (count <= 3 && layout.listOverflow > 1) throw new Error('Short equipment list must fit without scrolling: ' + JSON.stringify({ count, width, height, layout }));
      if (count === 30 && layout.listOverflow <= 0) throw new Error('Long equipment list must remain accessible within its own area');
      console.log('PASS: sites ' + width + 'x' + height + ', equipment=' + count + ', form/save/manager visible without page scrolling');
    }
  }
  const resetResult = await send('Runtime.evaluate', { expression: `(async () => {
    const wait = () => new Promise(resolve => setTimeout(resolve, 80));
    const find = text => Array.from(document.querySelectorAll('button')).find(button => button.textContent === text);
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    window.__showReset(); await wait();
    check(find('모든 데이터와 파일 영구 삭제').disabled && window.__resetCalls === 0, 'Must not delete on open');
    find('삭제 대상 조회·새로고침').click(); await wait();
    check(document.querySelectorAll('.data-reset-dialog tbody tr').length === 6, 'All targets must be listed');
    check(find('모든 데이터와 파일 영구 삭제').disabled && window.__resetCalls === 0, 'Preview must not delete');
    document.querySelector('.data-reset-dialog input[type=checkbox]').click(); await wait();
    check(find('모든 데이터와 파일 영구 삭제').disabled, 'Acknowledgement alone must not enable deletion');
    const input = document.querySelector('input[aria-label="초기화 확인 문구"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '전체 초기화');
    input.dispatchEvent(new Event('input', { bubbles: true })); await wait();
    check(!find('모든 데이터와 파일 영구 삭제').disabled, 'Confirmed operation must be enabled');
    find('모든 데이터와 파일 영구 삭제').click(); await wait();
    check(window.__resetCalls === 1 && window.__resetComplete, 'Confirmed reset must execute exactly once');
    find('닫기').click(); await wait(); window.__showReset(); await wait();
    check(find('모든 데이터와 파일 영구 삭제').disabled && !document.querySelector('.data-reset-dialog tbody'), 'Reopening must clear the previous preview and confirmation');
    return 'PASS: reset preview, acknowledgement, confirmation, execution and clean reopen';
  })()`, awaitPromise: true, returnByValue: true }, sessionId);
  if (resetResult.exceptionDetails) throw new Error(resetResult.exceptionDetails.exception?.description || 'Reset UI test failed');
  console.log(resetResult.result.value);
  await send('Browser.close');
} finally { socket?.close(); child.kill(); }
