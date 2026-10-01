// src/components/SiteEquipmentManager.tsx
import React, { useState, useEffect } from 'react';
import type { SiteEquipment, EquipmentCatalog } from '../types/database';
import {
  listSiteEquipment,
  addSiteEquipment,
  updateSiteEquipment,
  deleteSiteEquipment,
} from '../services/siteEquipment';
import { listEquipmentCatalog } from '../services/equipment';

interface Props {
  siteId: string;
  siteName: string;
}

export const SiteEquipmentManager: React.FC<Props> = ({ siteId, siteName }) => {
  const [siteEquipmentList, setSiteEquipmentList] = useState<SiteEquipment[]>([]);
  const [catalogList, setCatalogList] = useState<EquipmentCatalog[]>([]);
  const [loading, setLoading] = useState(false);

  // 선택된 기구 & 수량
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentCatalog | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  // 모달 제어 및 검색어
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  // 에러 및 성공 메시지
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. 데이터 불러오기
  const fetchData = async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const [seList, catList] = await Promise.all([
        listSiteEquipment(siteId),
        listEquipmentCatalog(),
      ]);
      setSiteEquipmentList(seList);
      setCatalogList(catList);
    } catch (err: any) {
      setErrorMsg(err.message || '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setSelectedEquipment(null);
    setQuantity(1);
  }, [siteId]);

  // 2. 모달에서 기구 선택 처리
  const handleSelectFromModal = (item: EquipmentCatalog) => {
    setSelectedEquipment(item);
    setIsModalOpen(false);
  };

  // 3. 지점에 기구 추가
    const handleAddEquipment = async () => {
    if (!selectedEquipment) {
        alert('도감에서 운동기구를 먼저 선택해 주세요.');
        return;
    }

    setAdding(true);
    setErrorMsg(null);
    try {
        // addSiteEquipment(siteId, equipmentId, quantity) 순서로 전달
        await addSiteEquipment(siteId, selectedEquipment.id, quantity);

        setSelectedEquipment(null);
        setQuantity(1);
        await fetchData();
    } catch (err: any) {
        setErrorMsg(err.message || '기구 추가 중 오류가 발생했습니다.');
    } finally {
        setAdding(false);
    }
    };

  // 4. 수량 변경
  const handleQuantityChange = async (id: string, newQty: number) => {
    if (newQty < 1) return;
    try {
      await updateSiteEquipment(id, { quantity: newQty });
      setSiteEquipmentList((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity: newQty } : item))
      );
    } catch (err: any) {
      alert(err.message || '수량 변경 실패');
    }
  };

  // 5. 공개 상태 변경
  const handlePublishToggle = async (id: string, currentPublished: boolean) => {
    try {
      await updateSiteEquipment(id, { is_published: !currentPublished });
      setSiteEquipmentList((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_published: !currentPublished } : item))
      );
    } catch (err: any) {
      alert(err.message || '공개 상태 변경 실패');
    }
  };

  // 6. 지점에서 기구 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('해당 지점에서 운동기구를 삭제하시겠습니까?')) return;
    try {
      await deleteSiteEquipment(id);
      await fetchData();
    } catch (err: any) {
      alert(err.message || '삭제 실패');
    }
  };

  // 모달 검색 필터링
  const filteredCatalog = catalogList.filter((item) =>
    item.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
    (item.model_name && item.model_name.toLowerCase().includes(modalSearch.toLowerCase()))
  );

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '2px solid #e2e8f0', paddingTop: '1.2rem' }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '16px', color: '#0f172a' }}>
        🏋️ {siteName} - 설치된 운동기구 관리 ({siteEquipmentList.length}종)
      </h3>

      {errorMsg && (
        <div style={{ color: '#dc2626', backgroundColor: '#fef2f2', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', marginBottom: '1rem' }}>
          {errorMsg}
        </div>
      )}

      {/* 기구 선택 및 추가 바 */}
      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
        {/* 선택된 기구 표시 영역 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
          {selectedEquipment ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fff', padding: '6px 12px', borderRadius: '6px', border: '1px solid #2563eb', flex: 1 }}>
              {selectedEquipment.default_image_path ? (
                <img src={selectedEquipment.default_image_path} alt="" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px' }} />
              ) : (
                <div style={{ width: '36px', height: '36px', backgroundColor: '#f1f5f9', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#94a3b8' }}>No Img</div>
              )}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>{selectedEquipment.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{selectedEquipment.model_name || '모델명 없음'}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
              도감에서 추가할 운동기구를 선택해 주세요.
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '8px 14px',
              backgroundColor: '#ffffff',
              color: '#2563eb',
              border: '1px solid #2563eb',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            🔍 {selectedEquipment ? '기구 변경' : '도감에서 기구 선택'}
          </button>
        </div>

        {/* 수량 설정 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>수량:</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: '60px', padding: '6px', fontSize: '13px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          />
        </div>

        {/* 추가 버튼 */}
        <button
          type="button"
          onClick={handleAddEquipment}
          disabled={adding || !selectedEquipment}
          style={{
            padding: '8px 16px',
            backgroundColor: adding || !selectedEquipment ? '#cbd5e1' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: adding || !selectedEquipment ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {adding ? '추가 중...' : '+ 지점에 추가'}
        </button>
      </div>

      {/* 이미 설치된 기구 리스트 (현행 유지) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '13px' }}>로딩 중...</div>
        ) : siteEquipmentList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '13px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
            이 지점에 설치된 운동기구가 없습니다. 위 버튼을 눌러 도감에서 기구를 추가해 주세요.
          </div>
        ) : (
          siteEquipmentList.map((item) => {
            const catalog = item.equipment_catalog;
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                }}
              >
                {/* 기구 정보 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {catalog?.default_image_path ? (
                    <img src={catalog.default_image_path} alt="" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', backgroundColor: '#f1f5f9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#94a3b8' }}>
                      No Img
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>
                      {catalog?.name || '알 수 없는 기구'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {catalog?.model_name || '모델명 미입력'}
                    </div>
                  </div>
                </div>

                {/* 수량, 공개 및 삭제 제어 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#475569' }}>수량:</span>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                      style={{ width: '50px', padding: '4px', fontSize: '12px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <label style={{ fontSize: '12px', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="checkbox"
                      checked={item.is_published}
                      onChange={() => handlePublishToggle(item.id, item.is_published)}
                    />
                    앱에 공개
                  </label>

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 팝업 모달: 운동기구 도감 선택 모달 */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '640px', maxHeight: '80vh', backgroundColor: '#fff', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            
            {/* 모달 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.8rem' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>📖 운동기구 도감에서 선택</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* 검색창 */}
            <input
              type="text"
              placeholder="기구 이름 또는 모델명 검색..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />

            {/* 기구 그리드 카드 리스트 */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '4px' }}>
              {filteredCatalog.length === 0 ? (
                <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  검색된 운동기구가 없습니다.
                </div>
              ) : (
                filteredCatalog.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectFromModal(item)}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '8px',
                      backgroundColor: selectedEquipment?.id === item.id ? '#eff6ff' : '#fff',
                      borderColor: selectedEquipment?.id === item.id ? '#2563eb' : '#e2e8f0',
                      transition: 'all 0.2s',
                    }}
                  >
                    {item.default_image_path ? (
                      <img src={item.default_image_path} alt={item.name} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100px', backgroundColor: '#f1f5f9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#94a3b8' }}>
                        No Image
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>{item.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{item.model_name || '모델명 없음'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 모달 푸터 */}
            <div style={{ textAlign: 'right', borderTop: '1px solid #e2e8f0', paddingTop: '0.8rem' }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
              >
                닫기
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};