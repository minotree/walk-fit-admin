// src/pages/SurveyInboxPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  listSurveyLocations,
  approveSurveyToSite,
  updateSurveyPhoto,
  getSurveyImageUrl,
  type SurveyLocation,
} from '../services/surveys';
import { LocationPickerMap } from '../components/LocationPickerMap';
import { EquipmentImageEditor } from '../components/EquipmentImageEditor';

export const SurveyInboxPage: React.FC = () => {
  const [surveys, setSurveys] = useState<SurveyLocation[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [loading, setLoading] = useState(false);

  const [selectedSurvey, setSelectedSurvey] = useState<SurveyLocation | null>(null);
  const [approving, setApproving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [photoEditor, setPhotoEditor] = useState<{ surveyId: string; initialFile?: File } | null>(null);
  const [editingPhoto, setEditingPhoto] = useState(false);
  const photoRequest = useRef<AbortController | null>(null);
  useEffect(() => () => photoRequest.current?.abort(), []);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSurveys = async () => {
    setLoading(true);
    try {
      const data = await listSurveyLocations(statusFilter);
      setSurveys(data);
      if (data.length > 0 && !selectedSurvey) {
        setSelectedSurvey(data[0]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || '수집 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurveys();
  }, [statusFilter]);

  const handleSelectSurvey = (survey: SurveyLocation) => {
    if (uploading || loadingPhoto) return;
    setPhotoEditor(null);
    setEditingPhoto(false);
    setSelectedSurvey(survey);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const openPhotoEditor = async (existing: boolean) => {
    if (!selectedSurvey || uploading || loadingPhoto) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!existing) {
      setPhotoEditor({ surveyId: selectedSurvey.id });
      setEditingPhoto(true);
      return;
    }
    const url = getSurveyImageUrl(selectedSurvey.stamped_photo_path);
    if (!url) return;
    const active = new AbortController();
    photoRequest.current?.abort();
    photoRequest.current = active;
    setLoadingPhoto(true);
    try {
      const response = await fetch(url, { signal: active.signal });
      if (!response.ok) throw new Error('기존 대표 사진을 불러오지 못했습니다.');
      const blob = await response.blob();
      if (blob.size > 25 * 1024 * 1024) throw new Error('25MB 이하 이미지만 편집할 수 있습니다.');
      if (active.signal.aborted) return;
      setPhotoEditor({ surveyId: selectedSurvey.id, initialFile: new File([blob], 'survey-photo', { type: blob.type }) });
      setEditingPhoto(true);
    } catch (err) {
      if (!active.signal.aborted) setErrorMsg(err instanceof Error ? err.message : '기존 사진을 불러오지 못했습니다.');
    } finally {
      if (!active.signal.aborted) setLoadingPhoto(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!selectedSurvey || !photoEditor || photoEditor.surveyId !== selectedSurvey.id || uploading) return;
    const surveyId = selectedSurvey.id;

    setEditingPhoto(false);
    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { path: newPath, cleanupWarning } = await updateSurveyPhoto(surveyId, file);
      setSelectedSurvey(previous => previous?.id === surveyId ? { ...previous, stamped_photo_path: newPath } : previous);
      setSurveys(previous => previous.map(survey => survey.id === surveyId ? { ...survey, stamped_photo_path: newPath } : survey));
      setPhotoEditor(null);
      setSuccessMsg('편집한 대표 사진이 저장되었습니다.');
      if (cleanupWarning) setErrorMsg(cleanupWarning);
    } catch (err: any) {
      setErrorMsg(err.message || '사진 교체에 실패했습니다.');
      setEditingPhoto(true);
    } finally {
      setUploading(false);
    }
  };

  // 지점으로 승인 및 전환
  const handleApprove = async () => {
    if (!selectedSurvey) return;
    if (!confirm('이 조사 데이터를 공식 운동 지점(Exercise Site)으로 승인하시겠습니까?')) return;

    setApproving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await approveSurveyToSite(selectedSurvey);
      alert('지점으로 승인 완료되었습니다!');
      setSelectedSurvey(null);
      await fetchSurveys();
    } catch (err: any) {
      setErrorMsg(err.message || '승인 처리 중 오류가 발생했습니다.');
    } finally {
      setApproving(false);
    }
  };

  // 선택된 항목의 사진 URL 생성
  const photoPath = selectedSurvey?.stamped_photo_path;
  const imageUrl = getSurveyImageUrl(photoPath);

  return (
    <div className="workspace-page" style={{ display: 'flex', gap: '1rem', padding: '1rem', boxSizing: 'border-box' }}>
      {/* 좌측 패널: 조사 수집 목록 */}
      <div style={{ width: '360px', display: 'flex', flexDirection: 'column', gap: '0.8rem', borderRight: '1px solid #eee', paddingRight: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>PWA 현장 조사 수집 ({surveys.length})</h2>

        <select
          value={statusFilter}
          disabled={uploading || loadingPhoto || editingPhoto}
          onChange={(e: any) => setStatusFilter(e.target.value)}
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
        >
          <option value="pending">검수 대기중 (Pending)</option>
          <option value="approved">승인 완료 (Approved)</option>
          <option value="all">전체 보기</option>
        </select>

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
          {loading ? (
            <div style={{ padding: '1rem', textAlign: 'center' }}>로딩 중...</div>
          ) : surveys.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#888' }}>수집된 데이터가 없습니다.</div>
          ) : (
            surveys.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectSurvey(item)}
                style={{
                  padding: '12px',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  backgroundColor: selectedSurvey?.id === item.id ? '#e7f1ff' : '#fff',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {item.address || item.facility_name || '신규 수집 건'}
                  <span
                    style={{
                      fontSize: '12px',
                      marginLeft: '6px',
                      color: item.status === 'approved' ? '#28a745' : '#ffc107',
                    }}
                  >
                    [{item.status === 'approved' ? '승인완료' : '대기중'}]
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  수집일: {new Date(item.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 우측 패널: 수집 데이터 상세 검수 */}
      <div className="survey-detail-panel" style={{ flex: 1, overflowY: 'auto', paddingLeft: '0.5rem' }}>
        {selectedSurvey ? (
          <div className="survey-detail">
            {errorMsg && <div style={{ color: 'red', backgroundColor: '#ffe6e6', padding: '10px', borderRadius: '4px' }}>{errorMsg}</div>}
            {successMsg && <div style={{ color: 'green', backgroundColor: '#e6ffe6', padding: '10px', borderRadius: '4px' }}>{successMsg}</div>}

            {/* 대표 사진 카드 */}
            <div className="survey-media">
            <div className="survey-photo-card" style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', backgroundColor: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>PWA 촬영 대표 사진</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" disabled={uploading || loadingPhoto} onClick={() => void openPhotoEditor(false)}>새 사진 선택·편집</button>
                  <button type="button" disabled={!imageUrl || uploading || loadingPhoto} onClick={() => void openPhotoEditor(true)}>기존 사진 편집</button>
                </div>
              </div>

              {loadingPhoto && <p role="status">기존 사진을 불러오는 중…</p>}
              {uploading && <p role="status">편집한 대표 사진을 저장하는 중…</p>}

              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="현장 대표 사진"
                  style={{ width: '100%', objectFit: 'contain', borderRadius: '4px', backgroundColor: '#000' }}
                />
              ) : (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                  등록된 사진이 없습니다.
                </div>
              )}
            </div>

            {/* 수집 GPS 위치 지도 */}
            <div className="survey-map-card" style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', backgroundColor: '#fafafa' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>수집 GPS 위치</div>
              <div className="survey-map-frame" style={{ borderRadius: '4px', overflow: 'hidden' }}>
                <LocationPickerMap
                  lat={selectedSurvey.latitude}
                  lng={selectedSurvey.longitude}
                  height="100%"
                  disabled
                  onChange={() => {}}
                />
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '6px', textAlign: 'center' }}>
                위도: {selectedSurvey.latitude} | 경도: {selectedSurvey.longitude}
              </div>
            </div>
            </div>

            {/* 주소 및 현장 메모 (좌측 정렬 반영) */}
            <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', backgroundColor: '#fafafa', textAlign: 'left' }}>
              <div style={{ marginBottom: '6px', fontSize: '14px', color: '#333' }}>
                <strong>주소:</strong> {selectedSurvey.address || '주소 정보 없음'}
              </div>
              <div style={{ fontSize: '14px', color: '#333' }}>
                <strong>현장 메모:</strong> {selectedSurvey.review_note || '메모 없음'}
              </div>
            </div>

            {/* 승인 버튼 */}
            {selectedSurvey.status !== 'approved' && (
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving || uploading || loadingPhoto || editingPhoto}
                style={{
                  padding: '12px',
                  backgroundColor: approving ? '#ccc' : '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: approving ? 'not-allowed' : 'pointer',
                  marginTop: '0.5rem',
                }}
              >
                {approving ? '승인 처리 중...' : '✓ 지점으로 승인 및 전환'}
              </button>
            )}
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#888' }}>
            좌측 목록에서 수집 항목을 선택해 주세요.
          </div>
        )}
      </div>
      {photoEditor && <EquipmentImageEditor
        open={editingPhoto}
        initialFile={photoEditor.initialFile}
        autoCrop={false}
        cropLabel="사진 영역 자르기"
        saveError={errorMsg}
        onAccept={file => void handlePhotoUpload(file)}
        onCancel={() => { setEditingPhoto(false); setPhotoEditor(null); }}
      />}
    </div>
  );
};
