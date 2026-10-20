// src/pages/EquipmentPage.tsx
import React, { useState, useEffect } from 'react';
import type { EquipmentCatalog } from '../types/database';
import { EquipmentImageEditor } from '../components/EquipmentImageEditor';
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
  const [saveStage, setSaveStage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [listError, setListError] = useState('');
  const [editingImage, setEditingImage] = useState(false);
  const [imageEditorVersion, setImageEditorVersion] = useState(0);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const pendingPreview = pendingImage?.preview || '';

  useEffect(() => {
    return () => { if (pendingPreview) URL.revokeObjectURL(pendingPreview); };
  }, [pendingPreview]);

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
    setListError('');
    try {
      const data = await listEquipmentCatalog(searchQuery);
      setEquipmentList(data);
    } catch (err: any) {
      setListError(err instanceof Error ? err.message : '기구 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [searchQuery]);

  const handleSelectItem = (item: EquipmentCatalog) => {
    if (saving) return;
    setErrorMsg(''); setSuccessMsg('');
    setImageEditorVersion(previous => previous + 1);
    setEditingImage(false);
    setPendingImage(null);
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
    if (saving) return;
    setErrorMsg(''); setSuccessMsg('');
    setImageEditorVersion(previous => previous + 1);
    setEditingImage(false);
    setPendingImage(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setErrorMsg(''); setSuccessMsg('');
    if (editingImage) {
      setErrorMsg('이미지 편집을 마친 뒤 ‘확인한 이미지 적용’을 누르거나, 편집창의 ‘취소’를 눌러 주세요.');
      return;
    }
    if (!formData.name.trim()) {
      setErrorMsg('운동기구 이름을 입력해 주세요.');
      return;
    }
    if (!isNew && !selectedItem) {
      setErrorMsg('저장할 운동기구를 선택해 주세요.');
      return;
    }

    setSaving(true);
    try {
      let imageUrl = formData.default_image_path;
      if (pendingImage) {
        setSaveStage('사진 업로드 중…');
        imageUrl = await uploadEquipmentImage(pendingImage.file);
        // Retain the uploaded URL if the following DB write fails, so retry does not upload twice.
        setFormData(previous => ({ ...previous, default_image_path: imageUrl }));
        setPendingImage(null);
      }
      const payload = { ...formData, default_image_path: imageUrl };
      setSaveStage('운동기구 정보 저장 중…');
      if (isNew) {
        const created = await createEquipmentCatalog(payload);
        setSuccessMsg('새 운동기구가 도감에 저장되었습니다.');
        setSelectedItem(created);
        setIsNew(false);
        setFormData(previous => ({ ...previous, default_image_path: imageUrl }));
      } else if (selectedItem) {
        const updated = await updateEquipmentCatalog(selectedItem.id, payload);
        setSuccessMsg('운동기구 정보가 저장되었습니다.');
        setSelectedItem(updated);
      }
      await fetchList();
    } catch (err: any) {
      setErrorMsg(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
      setSaveStage('');
    }
  };

  return (
    <div className="workspace-page" style={{ display: 'flex', gap: '1.2rem', padding: '1rem', boxSizing: 'border-box' }}>
      {/* 좌측 패널: 기구 도감 목록 */}
      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderRight: '1px solid #e2e8f0', paddingRight: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>운동기구 도감 ({equipmentList.length})</h2>
          <button
            disabled={saving}
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

        {listError && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{listError}</p>}

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
          <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '720px' }}>
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
                {pendingPreview || formData.default_image_path ? (
                  <img src={pendingPreview || formData.default_image_path} alt="표준 이미지" style={{ width: '120px', height: '120px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                ) : (
                  <div style={{ width: '120px', height: '120px', backgroundColor: '#e2e8f0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#64748b' }}>이미지 없음</div>
                )}
                <div>
                  <button type="button" disabled={saving || editingImage} onClick={() => setEditingImage(true)}>이미지 선택·변환</button>
                  {pendingImage && <p style={{ fontSize: 12 }}>확인한 WebP · 저장할 때 업로드됩니다.</p>}
                </div>
              </div>
              <EquipmentImageEditor
                key={imageEditorVersion}
                open={editingImage}
                onAccept={file => { setPendingImage({ file, preview: URL.createObjectURL(file) }); setEditingImage(false); }}
                onCancel={() => setEditingImage(false)}
              />
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
            {editingImage && <p style={{ color: '#92400e', fontSize: 13 }}>이미지 편집 중입니다. ‘확인한 이미지 적용’ 또는 ‘취소’ 후 저장해 주세요.</p>}
            {errorMsg && <p role="alert" style={{ color: '#b91c1c', background: '#fef2f2', padding: 12, borderRadius: 6 }}>{errorMsg}</p>}
            {successMsg && <p role="status" style={{ color: '#166534', background: '#f0fdf4', padding: 12, borderRadius: 6 }}>{successMsg}</p>}
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving}
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
              {saving ? saveStage || '저장 중…' : '운동기구 정보 저장'}
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
