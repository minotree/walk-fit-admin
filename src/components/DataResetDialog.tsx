import { useEffect, useRef, useState } from 'react';
import { RESET_BUCKETS, RESET_CONFIRMATION, RESET_TABLES } from '../lib/dataReset';
import type { ResetPreview } from '../lib/dataReset';
import { dataReset } from '../services/dataReset';

export function DataResetDialog({ open, onClose, onComplete }: {
  open: boolean; onClose: () => void; onComplete: () => void;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [preview, setPreview] = useState<ResetPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open) dialog.current?.close();
  }, [open]);

  const inspect = async () => {
    setLoading(true); setError(''); setPreview(null); setConfirmation(''); setAccepted(false); setCompleted(false); setProgress('');
    try { setPreview(await dataReset.preview()); }
    catch (err) { setError(err instanceof Error ? err.message : '대상 조회 실패'); }
    finally { setLoading(false); }
  };
  const remove = async () => {
    if (!preview || !accepted || confirmation !== RESET_CONFIRMATION || deleting) return;
    setDeleting(true); setError('');
    try {
      setPreview(await dataReset.reset(preview, confirmation, setProgress));
      setCompleted(true); setProgress('4개 테이블과 2개 버킷의 내용이 모두 비워졌습니다.');
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : '초기화 실패');
      setPreview(null); setProgress('');
    } finally { setDeleting(false); setConfirmation(''); setAccepted(false); }
  };
  const close = () => {
    if (deleting || loading) return;
    setPreview(null); setConfirmation(''); setAccepted(false); setError(''); setProgress(''); setCompleted(false); onClose();
  };
  return <dialog ref={dialog} className="data-reset-dialog" aria-labelledby="data-reset-title"
    onCancel={event => { event.preventDefault(); close(); }}>
    <h2 id="data-reset-title">현장 조사 포함 전체 초기화</h2>
    <p>운동 지점·운동기구·연결 정보·현장 조사와 두 버킷의 모든 파일을 영구 삭제합니다. PWA에서 수집한 원본도 포함됩니다.</p>
    <p>로그인 계정, 관리자 권한, 테이블 구조와 버킷 자체는 유지합니다.</p>
    <p>먼저 필요한 자료를 백업하고 PWA를 포함한 다른 곳의 등록·수정을 중단해 주세요. 파일과 DB 삭제는 하나의 트랜잭션이 아니므로 실패 시 일부만 삭제될 수 있습니다.</p>
    <button type="button" disabled={loading || deleting} onClick={() => void inspect()}>{loading ? '조회 중…' : '삭제 대상 조회·새로고침'}</button>
    {preview && <table><thead><tr><th>삭제 대상</th><th>건수</th></tr></thead><tbody>
      {RESET_TABLES.map(table => <tr key={table}><td>{table}</td><td>{preview.tables[table].toLocaleString()}행</td></tr>)}
      {RESET_BUCKETS.map(bucket => <tr key={bucket}><td>{bucket}</td><td>{preview.buckets[bucket].length.toLocaleString()}파일</td></tr>)}
    </tbody></table>}
    {preview && !completed && <>
      <label className="data-reset-acknowledgement"><input type="checkbox" checked={accepted} disabled={deleting} onChange={event => setAccepted(event.target.checked)} />현장 조사 원본과 사진까지 삭제되며, 복구할 수 없음을 확인했습니다.</label>
      <label>확인 문구 <strong>전체 초기화</strong>를 입력하세요.
        <input aria-label="초기화 확인 문구" value={confirmation} disabled={deleting} autoComplete="off" onChange={event => setConfirmation(event.target.value)} />
      </label>
    </>}
    {error && <p role="alert" className="data-reset-error">{error}</p>}
    {progress && <p role="status">{progress}</p>}
    <div className="data-reset-actions">
      <button type="button" disabled={loading || deleting} onClick={close}>닫기</button>
      {!completed && <button type="button" className="data-reset-delete" disabled={!preview || !accepted || confirmation !== RESET_CONFIRMATION || deleting || loading} onClick={() => void remove()}>{deleting ? '초기화 중…' : '모든 데이터와 파일 영구 삭제'}</button>}
    </div>
  </dialog>;
}
