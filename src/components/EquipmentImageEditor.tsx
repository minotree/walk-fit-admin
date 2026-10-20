import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { changeRegion, MIN_REGION_SIZE } from '../lib/imageRegions';
import type { Rect, Point, RegionAction } from '../lib/imageRegions';

type Analysis = { preview: string; boxes: Rect[]; crop: Rect; warning: string | null; width?: number; height?: number };
type Output = { preview: string; width: number; height: number; bytes: number };
const endpoint = (import.meta.env.VITE_IMAGE_SERVICE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');

async function request<T>(path: string, data: FormData, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${endpoint}/${path}`, { method: 'POST', body: data, signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('이미지 처리 서버에 연결할 수 없습니다. scripts/start-image-service.cmd를 실행해 주세요.');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === 'string' ? error.detail : '이미지 처리에 실패했습니다.');
  }
  return response.json();
}

export function EquipmentImageEditor({ open, onAccept, onCancel }: {
  open: boolean; onAccept: (file: File) => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [boxes, setBoxes] = useState<Rect[]>([]);
  const [crop, setCrop] = useState<Rect>([0, 0, 1, 1]);
  const [mode, setMode] = useState<'mask' | 'crop'>('mask');
  const [draft, setDraft] = useState<{ rect: Rect; target: number | 'crop' | 'new' } | null>(null);
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [output, setOutput] = useState<Output | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const viewport = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewportSize({ width: Math.max(1, element.clientWidth - 24), height: Math.max(1, element.clientHeight - 24) }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const imageScale = Math.min(viewportSize.width / imageSize.width, viewportSize.height / imageSize.height);
  const controller = useRef<AbortController | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<{ target: number | 'crop' | 'new'; action: RegionAction; origin: Point; initial: Rect } | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const invalidate = () => { setOutput(null); setConfirmed(false); };
  const choose = async (selected: File) => {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setError(''); setAnalysis(null); invalidate(); setFile(selected);
    setSelectedBox(null); setDrawing(false); setDraft(null); gesture.current = null;
    if (selected.size > 25 * 1024 * 1024) { setError('25MB 이하 이미지를 선택해 주세요.'); return; }
    setBusy(true);
    try {
      const data = new FormData(); data.append('file', selected);
      const result = await request<Analysis>('analyze', data, active.signal);
      if (result.width && result.height) setImageSize({ width: result.width, height: result.height });
      setAnalysis(result); setBoxes(result.boxes); setCrop(result.crop);
    } catch (err) {
      if (!active.signal.aborted) setError(err instanceof Error ? err.message : '이미지 분석 실패');
    } finally { if (!active.signal.aborted) setBusy(false); }
  };

  const point = (event: PointerEvent<HTMLDivElement>): [number, number] => {
    const rect = stage.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))];
  };
  const begin = (event: PointerEvent<HTMLDivElement>, target: number | 'crop' | 'new', action: RegionAction, initial: Rect) => {
    if (busy || event.button !== 0 || gesture.current) return;
    event.preventDefault(); event.stopPropagation();
    stage.current!.setPointerCapture(event.pointerId);
    if (typeof target === 'number') setSelectedBox(target);
    else setSelectedBox(null);
    gesture.current = { target, action, origin: point(event), initial };
    setDraft(action === 'draw' ? null : { rect: initial, target });
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active) return;
    const area = changeRegion(active.initial, active.origin, point(event), active.action);
    gesture.current = null; setDraft(null);
    if (stage.current?.hasPointerCapture(event.pointerId)) stage.current.releasePointerCapture(event.pointerId);
    if (area[2] - area[0] < MIN_REGION_SIZE || area[3] - area[1] < MIN_REGION_SIZE) return;
    if (active.action !== 'draw' && area.every((value, index) => value === active.initial[index])) return;
    if (active.target === 'new') {
      if (mode === 'mask') { setSelectedBox(boxes.length); setBoxes(previous => [...previous, area]); }
      else setCrop(area);
    } else if (active.target === 'crop') setCrop(area);
    else setBoxes(previous => previous.map((box, index) => index === active.target ? area : box));
    setDrawing(false);
    invalidate();
  };
  const generate = async () => {
    if (!file) return;
    setBusy(true); setError(''); invalidate();
    const active = new AbortController(); controller.current = active;
    try {
      const data = new FormData(); data.append('file', file);
      data.append('regions', JSON.stringify({ crop, boxes }));
      setOutput(await request<Output>('render', data, active.signal));
    } catch (err) {
      if (!active.signal.aborted) setError(err instanceof Error ? err.message : '변환 실패');
    } finally { if (!active.signal.aborted) setBusy(false); }
  };
  const accept = () => {
    if (!output || !confirmed) return;
    const bytes = Uint8Array.from(atob(output.preview.split(',')[1]), character => character.charCodeAt(0));
    onAccept(new File([bytes], 'equipment.webp', { type: 'image/webp' }));
  };
  const overlay = (rect: Rect, color: string, key: string, target?: number | 'crop') => {
    const editable = !busy && !drawing && target !== undefined && (mode === 'crop' ? target === 'crop' : typeof target === 'number');
    const selected = editable && (target === 'crop' || target === selectedBox);
    const handles: { action: RegionAction; x: number; y: number; cursor: string }[] = [
      { action: 'nw', x: 0, y: 0, cursor: 'nwse-resize' }, { action: 'n', x: 50, y: 0, cursor: 'ns-resize' },
      { action: 'ne', x: 100, y: 0, cursor: 'nesw-resize' }, { action: 'e', x: 100, y: 50, cursor: 'ew-resize' },
      { action: 'se', x: 100, y: 100, cursor: 'nwse-resize' }, { action: 's', x: 50, y: 100, cursor: 'ns-resize' },
      { action: 'sw', x: 0, y: 100, cursor: 'nesw-resize' }, { action: 'w', x: 0, y: 50, cursor: 'ew-resize' },
    ];
    return <div key={key} onPointerDown={event => { if (editable) begin(event, target!, 'move', rect); }} style={{
    position: 'absolute', pointerEvents: editable ? 'auto' : 'none', left: `${rect[0] * 100}%`, top: `${rect[1] * 100}%`,
    width: `${(rect[2] - rect[0]) * 100}%`, height: `${(rect[3] - rect[1]) * 100}%`,
    boxSizing: 'border-box', border: `${selected ? 3 : 2}px solid ${color}`, background: selected ? `${color}10` : 'transparent',
    cursor: editable ? 'move' : 'inherit', zIndex: selected ? 3 : 1,
  }}>
    {typeof target === 'number' && <span style={{ position: 'absolute', top: 2, left: 2, background: color, color: 'white', fontSize: 12, lineHeight: 1.4, padding: '0 3px', pointerEvents: 'none' }}>{target + 1}</span>}
    {selected && handles.map(handle => <div key={handle.action} title="드래그하여 크기 조정"
      onPointerDown={event => begin(event, target!, handle.action, rect)} style={{
        position: 'absolute', left: `${handle.x}%`, top: `${handle.y}%`, width: 14, height: 14,
        transform: 'translate(-50%, -50%)', background: 'white', border: `2px solid ${color}`,
        boxSizing: 'border-box', cursor: handle.cursor, touchAction: 'none',
      }} />)}
  </div>;
  };

  const closeEditor = () => {
    controller.current?.abort(); setBusy(false); gesture.current = null; setDraft(null); onCancel();
  };

  return <dialog ref={dialog} className="equipment-image-dialog" aria-labelledby="image-editor-title"
    onCancel={event => { event.preventDefault(); closeEditor(); }}>
    <header className="equipment-image-dialog-header">
      <h2 id="image-editor-title">이미지 변환 · 모자이크 · 자르기</h2>
      <button type="button" aria-label="이미지 편집창 닫기" onClick={closeEditor}>닫기 ✕</button>
    </header>
    <div className="equipment-image-dialog-body">
    <section className="image-editor-layout" aria-label="이미지 변환 및 사람 가림">
    <div className="image-editor-controls">
    <p>HEIC/JPEG/PNG/WebP · 최대 25MB · 원본은 로컬에서 처리합니다.</p>
    <input aria-label="변환할 이미지 선택" type="file" accept="image/*,.heic,.heif" disabled={busy}
      onChange={event => { const selected = event.target.files?.[0]; if (selected) void choose(selected); event.target.value = ''; }} />
    {busy && <p role="status">이미지 처리 중… 첫 실행은 피사체 감지 모델 준비로 시간이 걸릴 수 있습니다.</p>}
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {analysis && <>
      <p>현재 가림 {boxes.length}개 (최초 자동 감지 {analysis.boxes.length}개). 작은 사람·뒷모습·가려진 사람은 놓칠 수 있습니다. 사진 전체를 확인해 주세요.</p>
      {analysis.warning && <p role="status">{analysis.warning}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
        <button type="button" disabled={busy} aria-pressed={mode === 'mask'} onClick={() => { setMode('mask'); setDrawing(false); }}>사람 가리기</button>
        <button type="button" disabled={busy} aria-pressed={mode === 'crop'} onClick={() => { setMode('crop'); setDrawing(false); setSelectedBox(null); }}>기구 영역 자르기</button>
        <button type="button" disabled={busy || (mode === 'mask' && boxes.length >= 100)} aria-pressed={drawing}
          onClick={() => { setDrawing(true); setSelectedBox(null); }}>{mode === 'mask' ? '새 가림 영역' : '자르기 다시 그리기'}</button>
        {mode === 'mask' && <>
          <button type="button" disabled={busy || selectedBox === null} onClick={() => {
            setBoxes(previous => previous.filter((_, index) => index !== selectedBox)); setSelectedBox(null); invalidate();
          }}>선택 가림 삭제</button>
          <button type="button" disabled={busy || boxes.length === 0} onClick={() => {
            setBoxes([]); setSelectedBox(null); setDrawing(false); invalidate();
          }}>가림 전체 초기화</button>
          <button type="button" disabled={busy} onClick={() => {
            setBoxes(analysis.boxes.map(box => [...box] as Rect)); setSelectedBox(null); setDrawing(false); invalidate();
          }}>자동 감지 복원</button>
        </>}
        {mode === 'crop' && <button type="button" disabled={busy} onClick={() => { setCrop([0, 0, 1, 1]); setDrawing(false); invalidate(); }}>자르기 초기화</button>}
      </div>
      {mode === 'mask' && boxes.length > 0 && <div aria-label="가림 영역 선택" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {boxes.map((_, index) => <button key={index} type="button" disabled={busy} aria-pressed={selectedBox === index}
          onClick={() => { setSelectedBox(index); setDrawing(false); }}>가림 {index + 1}</button>)}
      </div>}
      <p>{drawing ? '사진을 드래그하여 새 영역을 그리세요.' : mode === 'mask'
        ? '주황색 영역을 선택해 안쪽을 드래그하면 이동하고, 테두리의 흰 점을 드래그하면 크기가 바뀝니다. 겹친 영역은 위 번호로 선택하세요.'
        : '초록색 영역 안쪽을 드래그해 이동하거나 테두리의 흰 점으로 크기를 조정하세요. 초록색 테두리 안쪽이 저장됩니다.'}</p>
    </>}
    </div>
    <div className="image-editor-workspace">
    <div className="image-editor-source">
      <div className="image-editor-pane-heading">원본 편집</div>
      <div ref={viewport} className="image-editor-viewport">
      {analysis ? <div ref={stage} style={{ position: 'relative', width: imageSize.width * imageScale, height: imageSize.height * imageScale, flexShrink: 0, touchAction: 'none', cursor: busy ? 'wait' : 'crosshair', lineHeight: 0 }}
        onPointerDown={event => {
          if (mode === 'mask' && boxes.length >= 100) return;
          begin(event, 'new', 'draw', [0, 0, 0, 0]);
        }}
        onPointerMove={event => {
          const active = gesture.current;
          if (active) setDraft({ rect: changeRegion(active.initial, active.origin, point(event), active.action), target: active.target });
        }}
        onPointerUp={finish} onPointerCancel={() => { gesture.current = null; setDraft(null); }}
        onLostPointerCapture={() => { gesture.current = null; setDraft(null); }}>
        <img src={analysis.preview} alt="로컬 원본: 드래그하여 사람 가림 또는 자르기 영역 지정" draggable={false}
          onLoad={event => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          style={{ width: '100%', height: '100%', display: 'block' }} />
        {boxes.map((box, index) => overlay(draft?.target === index ? draft.rect : box, '#ea580c', `mask-${index}`, index))}
        {overlay(draft?.target === 'crop' ? draft.rect : crop, '#16a34a', 'crop', 'crop')}
        {draft?.target === 'new' && overlay(draft.rect, '#ef4444', 'draft')}
      </div> : <p>변환할 이미지를 선택해 주세요.</p>}
      </div>
      <button type="button" disabled={busy || !analysis} onClick={() => void generate()}>WebP 결과 만들기</button>
    </div>
    <div className="image-editor-result">
      <div className="image-editor-pane-heading">변환 결과</div>
    {output ? <>
      <p>{output.width} × {output.height}px · {(output.bytes / 1024).toFixed(1)}KB · WebP</p>
      <div className="image-editor-result-preview"><img src={output.preview} alt="업로드할 최종 WebP" /></div>
      <label style={{ display: 'block', margin: '8px 0' }}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />최종 이미지 전체를 확인했고 식별 가능한 사람이 남아 있지 않습니다.</label>
      <button type="button" disabled={!confirmed || busy} onClick={() => void accept()}>확인한 이미지 적용</button>
    </> : <div className="image-editor-result-preview"><p>영역 조정 후 ‘WebP 결과 만들기’를 눌러 주세요.</p></div>}
    </div>
    </div>
    <div className="image-editor-footer"><span>가림·자르기 변경 후 결과를 다시 만들어 확인하세요.</span><button type="button" onClick={closeEditor}>취소</button></div>
  </section>
  </div>
  </dialog>;
}
