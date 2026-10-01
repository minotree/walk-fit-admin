// src/pages/EquipmentPage.tsx
import React, { useState, useEffect } from 'react';
import type { EquipmentCatalog } from '../types/database';
import {
  listEquipmentCatalog,
  createEquipmentCatalog,
  updateEquipmentCatalog,
  uploadEquipmentImage,
} from '../services/equipment';

export const EquipmentPage: React.FC = () => {
  const [equipmentList, setEquipmentList] = useState<EquipmentCatalog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [selectedItem, setSelectedItem] = useState<EquipmentCatalog | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    model_name: '',
    default_image_path: '',
    instructions: '',
    effects: '',
    precautions: '',
    source_reference: '',
  });

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await listEquipmentCatalog(searchQuery);
      setEquipmentList(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [searchQuery]);

  const handleSelectItem = (item: EquipmentCatalog) => {
    setSelectedItem(item);
    setIsNew(false);
    setFormData({
      name: item.name,
      model_name: item.model_name || '',
      default_image_path: item.default_image_path || '',
      instructions: item.instructions || '',
      effects: item.effects || '',
      precautions: item.precautions || '',
      source_reference: item.source_reference || '',
    });
  };

  const handleNew = () => {
    setSelectedItem(null);
    setIsNew(true);
    setFormData({
      name: '',
      model_name: '',
      default_image_path: '',
      instructions: '',
      effects: '',
      precautions: '',
      source_reference: '',
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadEquipmentImage(file);
      setFormData((prev) => ({ ...prev, default_image_path: url }));
      alert('표준 이미지가 업로드되었습니다.');
    } catch (err: any) {
      alert(err.message || '사진 업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('운동기구 이름을 입력해 주세요.');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await createEquipmentCatalog(formData);
        alert('새 운동기구가 도감에 추가되었습니다.');
        handleSelectItem(created);
      } else if (selectedItem) {
        const updated = await updateEquipmentCatalog(selectedItem.id, formData);
        alert('운동기구 정보가 수정되었습니다.');
        setSelectedItem(updated);
      }
      await fetchList();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 110px)', gap: '1.2rem', padding: '1rem', boxSizing: 'border-box' }}>
      {/* 좌측 패널: 기구 도감 목록 */}
      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderRight: '1px solid #e2e8f0', paddingRight: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>운동기구 도감 ({equipmentList.length})</h2>
          <button
            onClick={handleNew}
            style={{ padding: '4px 10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
          >
            + 새 기구 등록
          </button>
        </div>

        <input
          type="text"
          placeholder="기구 이름 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
        />

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          {loading ? (
            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>로딩 중...</div>
          ) : equipmentList.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>등록된 운동기구가 없습니다.</div>
          ) : (
            equipmentList.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectItem(item)}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  backgroundColor: selectedItem?.id === item.id ? '#eff6ff' : '#fff',
                  borderLeft: selectedItem?.id === item.id ? '3px solid #2563eb' : '3px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                {item.default_image_path ? (
                  <img src={item.default_image_path} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', backgroundColor: '#f1f5f9', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#94a3b8' }}>No Img</div>
                )}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{item.model_name || '모델명 없음'}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 우측 패널: 상세 편집/등록 폼 */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
        {selectedItem || isNew ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '720px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.6rem' }}>
              {isNew ? '새 운동기구 등록' : `운동기구 편집: ${selectedItem?.name}`}
            </h2>

            {/* 기본 정보 */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>운동기구 이름 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 체스트 프레스"
                  required
                  style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>모델명 / 제조사</label>
                <input
                  type="text"
                  value={formData.model_name}
                  onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                  placeholder="예: WF-2026-A"
                  style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* 표준 사진 */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>표준 대표 이미지 / 운동 가이드 사진</label>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {formData.default_image_path ? (
                  <img src={formData.default_image_path} alt="표준 이미지" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                ) : (
                  <div style={{ width: '120px', height: '120px', backgroundColor: '#e2e8f0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#64748b' }}>이미지 없음</div>
                )}
                <div>
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} style={{ fontSize: '13px' }} />
                  {uploading && <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '4px' }}>업로드 중...</div>}
                </div>
              </div>
            </div>

            {/* 사용법/효과/주의사항 */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>운동 방법 (Instructions)</label>
              <textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                rows={3}
                placeholder="올바른 운동 동작 및 사용 순서"
                style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>운동 효과 (Effects)</label>
                <textarea
                  value={formData.effects}
                  onChange={(e) => setFormData({ ...formData, effects: e.target.value })}
                  rows={2}
                  placeholder="주요 자극 부위 및 효과"
                  style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>주의 사항 (Precautions)</label>
                <textarea
                  value={formData.precautions}
                  onChange={(e) => setFormData({ ...formData, precautions: e.target.value })}
                  rows={2}
                  placeholder="부상 예방 주의사항"
                  style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* 출처 */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>출처 / 참고 자료</label>
              <input
                type="text"
                value={formData.source_reference}
                onChange={(e) => setFormData({ ...formData, source_reference: e.target.value })}
                placeholder="제조사 매뉴얼 또는 출처"
                style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>

            {/* 저장 버튼 */}
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 18px',
                backgroundColor: saving ? '#94a3b8' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                marginTop: '0.6rem',
                alignSelf: 'flex-start',
              }}
            >
              {saving ? '저장 중...' : '운동기구 정보 저장'}
            </button>
          </form>
        ) : (
          <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#94a3b8', fontSize: '14px' }}>
            좌측 목록에서 기구를 선택하거나 [+ 새 기구 등록] 버튼을 눌러주세요.
          </div>
        )}
      </div>
    </div>
  );
};