// src/pages/SurveyInboxPage.tsx
import React, { useState, useEffect } from 'react';
import {
  listSurveyLocations,
  approveSurveyToSite,
  updateSurveyPhoto,
  getSurveyImageUrl,
  type SurveyLocation,
} from '../services/surveys';
import { LocationPickerMap } from '../components/LocationPickerMap';

export const SurveyInboxPage: React.FC = () => {
  const [surveys, setSurveys] = useState<SurveyLocation[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [loading, setLoading] = useState(false);

  const [selectedSurvey, setSelectedSurvey] = useState<SurveyLocation | null>(null);
  const [approving, setApproving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
    setSelectedSurvey(survey);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // 대표 사진 교체 업로드
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSurvey) return;

    setUploading(true);
    setErrorMsg(null);
    try {
      const newPath = await updateSurveyPhoto(selectedSurvey.id, file);
      setSelectedSurvey({
        ...selectedSurvey,
        stamped_photo_path: newPath,
      });
      setSuccessMsg('대표 사진이 교체되었습니다.');
      await fetchSurveys();
    } catch (err: any) {
      setErrorMsg(err.message || '사진 교체에 실패했습니다.');
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
  const photoPath = selectedSurvey?.stamped_photo_path || selectedSurvey?.original_photo_path;
  const imageUrl = getSurveyImageUrl(photoPath);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', gap: '1rem', padding: '1rem', boxSizing: 'border-box' }}>
      {/* 좌측 패널: 조사 수집 목록 */}
      <div style={{ width: '360px', display: 'flex', flexDirection: 'column', gap: '0.8rem', borderRight: '1px solid #eee', paddingRight: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>PWA 현장 조사 수집 ({surveys.length})</h2>

        <select
          value={statusFilter}
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
      <div style={{ flex: 1, overflowY: 'auto', paddingLeft: '0.5rem' }}>
        {selectedSurvey ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '800px' }}>
            {errorMsg && <div style={{ color: 'red', backgroundColor: '#ffe6e6', padding: '10px', borderRadius: '4px' }}>{errorMsg}</div>}
            {successMsg && <div style={{ color: 'green', backgroundColor: '#e6ffe6', padding: '10px', borderRadius: '4px' }}>{successMsg}</div>}

            {/* 대표 사진 카드 */}
            <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', backgroundColor: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>PWA 촬영 대표 사진</span>
                <label style={{ fontSize: '13px', color: '#007bff', cursor: 'pointer', fontWeight: 'bold' }}>
                  📷 대표 사진 교체
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {uploading && <div style={{ fontSize: '12px', color: '#007bff', marginBottom: '8px' }}>사진 교체 중...</div>}

              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="현장 대표 사진"
                  style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '4px', backgroundColor: '#000' }}
                />
              ) : (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                  등록된 사진이 없습니다.
                </div>
              )}
            </div>

            {/* 수집 GPS 위치 지도 */}
            <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', backgroundColor: '#fafafa' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>수집 GPS 위치</div>
              <div style={{ height: '280px', borderRadius: '4px', overflow: 'hidden' }}>
                <LocationPickerMap
                  lat={selectedSurvey.latitude}
                  lng={selectedSurvey.longitude}
                    onChange={() => {}}                 
                />
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '6px', textAlign: 'center' }}>
                위도: {selectedSurvey.latitude} | 경도: {selectedSurvey.longitude}
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
                disabled={approving}
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
    </div>
  );
};