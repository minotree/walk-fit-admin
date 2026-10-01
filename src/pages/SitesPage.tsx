// src/pages/SitesPage.tsx
import React, { useState, useEffect } from 'react';
import type { ToiletStatus, DrinkingWaterStatus } from '../types/database';
import { listSites, updateSite, getSiteImageUrl } from '../services/sites';
import { SiteEquipmentManager } from '../components/SiteEquipmentManager';

export const SitesPage: React.FC = () => {
  const [sites, setSites] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'published' | 'unpublished'>('all');
  const [loading, setLoading] = useState(false);

  const [selectedSite, setSelectedSite] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    latitude: 37.5665,
    longitude: 126.978,
    address_text: '',
    toilet_status: 'unknown' as ToiletStatus,
    drinking_water_status: 'unknown' as DrinkingWaterStatus,
    amenity_note: '',
    site_image_path: '' as string | null,
    last_verified_at: '',
    is_published: false,
  });

  const fetchSites = async () => {
    setLoading(true);
    try {
      const res = await listSites({ searchQuery, publishedFilter });
      setSites(res.data);
      setTotalCount(res.totalCount);
    } catch (err: any) {
      setErrorMsg(err.message || '목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, [searchQuery, publishedFilter]);

  const handleSelectSite = (site: any) => {
    setSelectedSite(site);
    setErrorMsg(null);
    setSuccessMsg(null);

    // JOIN된 survey_locations에서 PWA 촬영 사진 상대 경로 추출
    const photoPath = site.survey_locations?.stamped_photo_path 
                   || site.survey_locations?.original_photo_path 
                   || site.main_image_path 
                   || null;

    setFormData({
      name: site.name,
      latitude: site.latitude,
      longitude: site.longitude,
      address_text: site.address_text || '',
      toilet_status: site.toilet_status,
      drinking_water_status: site.drinking_water_status,
      amenity_note: site.amenity_note || '',
      site_image_path: photoPath,
      last_verified_at: site.last_verified_at || '',
      is_published: site.is_published,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite) return;
    if (!formData.name.trim()) {
      setErrorMsg('지점 이름을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updated = await updateSite(selectedSite.id, {
        name: formData.name.trim(),
        latitude: formData.latitude,
        longitude: formData.longitude,
        address_text: formData.address_text,
        toilet_status: formData.toilet_status,
        drinking_water_status: formData.drinking_water_status,
        amenity_note: formData.amenity_note,
        last_verified_at: formData.last_verified_at || null,
        is_published: formData.is_published,
      });

      setSuccessMsg('지점 정보가 저장되었습니다.');
      setSelectedSite(updated);
      await fetchSites();
    } catch (err: any) {
      setErrorMsg(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Storage 경로를 Public URL로 변환하여 보기 전용으로 출력
  const displayImageUrl = getSiteImageUrl(formData.site_image_path);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', gap: '1rem', padding: '1rem', boxSizing: 'border-box' }}>
      {/* 좌측 패널: 지점 검색 및 목록 */}
      <div style={{ width: '360px', display: 'flex', flexDirection: 'column', gap: '0.8rem', borderRight: '1px solid #eee', paddingRight: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>지점 목록 ({totalCount})</h2>
        </div>

        <input
          type="text"
          placeholder="지점 이름 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
        />
        <select
          value={publishedFilter}
          onChange={(e: any) => setPublishedFilter(e.target.value)}
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
        >
          <option value="all">전체 상태 보기</option>
          <option value="published">공개만</option>
          <option value="unpublished">비공개만</option>
        </select>

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
          {loading ? (
            <div style={{ padding: '1rem', textAlign: 'center' }}>로딩 중...</div>
          ) : sites.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#888' }}>지점이 없습니다.</div>
          ) : (
            sites.map((site) => (
              <div
                key={site.id}
                onClick={() => handleSelectSite(site)}
                style={{
                  padding: '12px',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  backgroundColor: selectedSite?.id === site.id ? '#e7f1ff' : '#fff',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {site.name}
                  <span style={{ fontSize: '12px', marginLeft: '8px', color: site.is_published ? '#28a745' : '#dc3545' }}>
                    [{site.is_published ? '공개' : '비공개'}]
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {site.address_text || '주소 미입력'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 우측 패널: 상세 편집 폼 및 운동기구 매핑 */}
      <div style={{ flex: 1, overflowY: 'auto', paddingLeft: '0.5rem' }}>
        {selectedSite ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '800px' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {errorMsg && <div style={{ color: 'red', backgroundColor: '#ffe6e6', padding: '10px', borderRadius: '4px' }}>{errorMsg}</div>}
              {successMsg && <div style={{ color: 'green', backgroundColor: '#e6ffe6', padding: '10px', borderRadius: '4px' }}>{successMsg}</div>}

              {/* 지점 이름 */}
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>지점 이름 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 보라매공원 산책로 A지점"
                  required
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
              </div>

              {/* 지점 대표 사진 (보기 전용) */}
              <div style={{ textAlign: 'center' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', textAlign: 'left' }}>지점 대표 사진 (PWA 수집)</label>
                {displayImageUrl ? (
                  <div style={{ display: 'inline-block' }}>
                    <img
                      src={displayImageUrl}
                      alt="지점 대표 사진"
                      style={{ maxWidth: '320px', maxHeight: '200px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'left' }}>등록된 PWA 수집 대표 사진이 없습니다.</div>
                )}
              </div>

              {/* 주소 설명 */}
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>위치 / 주소 설명</label>
                <input
                  type="text"
                  value={formData.address_text}
                  onChange={(e) => setFormData({ ...formData, address_text: e.target.value })}
                  placeholder="찾아가는 길 또는 도로명 주소"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
              </div>

              {/* 편의시설 상태 */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>화장실 여부</label>
                  <select
                    value={formData.toilet_status}
                    onChange={(e: any) => setFormData({ ...formData, toilet_status: e.target.value })}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                  >
                    <option value="unknown">미확인</option>
                    <option value="yes">있음 (Yes)</option>
                    <option value="no">없음 (No)</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>음수대 여부</label>
                  <select
                    value={formData.drinking_water_status}
                    onChange={(e: any) => setFormData({ ...formData, drinking_water_status: e.target.value })}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                  >
                    <option value="unknown">미확인</option>
                    <option value="yes">있음 (Yes)</option>
                    <option value="no">없음 (No)</option>
                  </select>
                </div>
              </div>

              {/* 편의시설 메모 */}
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>편의시설 설명 메모</label>
                <textarea
                  value={formData.amenity_note}
                  onChange={(e) => setFormData({ ...formData, amenity_note: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
              </div>

              {/* 현장 확인일 & 공개 여부 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <label style={{ fontWeight: 'bold', marginRight: '8px' }}>현장 확인일:</label>
                  <input
                    type="date"
                    value={formData.last_verified_at}
                    onChange={(e) => setFormData({ ...formData, last_verified_at: e.target.value })}
                    style={{ padding: '6px' }}
                  />
                </div>

                <label style={{ fontWeight: 'bold', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                    style={{ marginRight: '6px' }}
                  />
                  사용자 앱에 공개
                </label>
              </div>

              {/* 저장 버튼 */}
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '12px',
                  backgroundColor: saving ? '#ccc' : '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  marginTop: '0.5rem',
                }}
              >
                {saving ? '저장 중...' : '지점 정보 저장'}
              </button>
            </form>

            {/* 하단: 지점별 운동기구 관리 매핑 컴포넌트 */}
            <SiteEquipmentManager siteId={selectedSite.id} siteName={selectedSite.name} />
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#888' }}>
            좌측 목록에서 지점을 선택해 주세요.
          </div>
        )}
      </div>
    </div>
  );
};