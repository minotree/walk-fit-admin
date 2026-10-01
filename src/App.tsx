// src/App.tsx
import { useState } from 'react';
import { AuthGate } from './auth/AuthGate';
import { SitesPage } from './pages/SitesPage';
import { SurveyInboxPage } from './pages/SurveyInboxPage';
import { EquipmentPage } from './pages/EquipmentPage';

export function App() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'sites' | 'equipment'>('inbox');

  return (
    <AuthGate>
      {/* 상단 탭 네비게이션 */}
      <div style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: '0 1rem', display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('inbox')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'inbox' ? '2px solid #2563eb' : '2px solid transparent',
            backgroundColor: 'transparent',
            fontWeight: activeTab === 'inbox' ? 'bold' : 'normal',
            color: activeTab === 'inbox' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          📥 현장 수집 검수 (Survey Inbox)
        </button>

        <button
          onClick={() => setActiveTab('sites')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'sites' ? '2px solid #2563eb' : '2px solid transparent',
            backgroundColor: 'transparent',
            fontWeight: activeTab === 'sites' ? 'bold' : 'normal',
            color: activeTab === 'sites' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          📍 지점 관리 (Exercise Sites)
        </button>

        <button
          onClick={() => setActiveTab('equipment')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'equipment' ? '2px solid #2563eb' : '2px solid transparent',
            backgroundColor: 'transparent',
            fontWeight: activeTab === 'equipment' ? 'bold' : 'normal',
            color: activeTab === 'equipment' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          🏋️ 운동기구 도감 (Equipment)
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'inbox' && <SurveyInboxPage />}
      {activeTab === 'sites' && <SitesPage />}
      {activeTab === 'equipment' && <EquipmentPage />}
    </AuthGate>
  );
}

export default App;