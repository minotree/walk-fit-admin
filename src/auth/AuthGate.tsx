// src/auth/AuthGate.tsx
import React, { useState, useEffect } from 'react';
import { loginWithEmail, logout, checkAdminAccess } from '../services/auth';

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 세션 확인 및 관리자 권한 검증
  const verifyAccess = async () => {
    setLoading(true);
    setErrorMsg(null);
    const result = await checkAdminAccess();
    setIsAdmin(result.isAdmin);
    if (!result.isAdmin && result.error && result.error !== '로그인이 필요합니다.') {
      setErrorMsg(result.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    verifyAccess();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const loginRes = await loginWithEmail(email, password);
    if (loginRes.error) {
      setErrorMsg(loginRes.error);
      setLoading(false);
      return;
    }

    await verifyAccess();
  };

  const handleLogout = async () => {
    await logout();
    setIsAdmin(false);
    setErrorMsg(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <div>권한 확인 중...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <form onSubmit={handleLogin} style={{ background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '320px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1.5rem', textAlign: 'center' }}>Walk Fit Admin</h2>
          {errorMsg && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '14px' }}>{errorMsg}</div>}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px' }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px' }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            로그인
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #ddd', backgroundColor: '#fff' }}>
        <h1 style={{ margin: 0, fontSize: '18px' }}>Walk Fit Admin</h1>
        <button onClick={handleLogout} style={{ padding: '6px 12px', cursor: 'pointer' }}>
          로그아웃
        </button>
      </header>
      <main>{children}</main>
    </div>
  );
};