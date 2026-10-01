// src/services/auth.ts
import { supabase } from '../lib/supabase';

export interface AdminAuthResult {
  isAdmin: boolean;
  userId?: string;
  error?: string;
}

/**
 * 이메일/비밀번호 로그인
 */
export async function loginWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Supabase Login Error:', error);
    // 원래 메시지 대신 실제 원인(error.message)을 출력
    return { user: null, error: `로그인 실패: ${error.message}` };
  }

  return { user: data.user, error: null };
}

/**
 * 로그아웃
 */
export async function logout() {
  await supabase.auth.signOut();
}

/**
 * 현재 사용자의 지정 관리자(admin_is_owner) 여부 확인
 * RPC 호출로 서버 권한을 검증합니다.
 */
export async function checkAdminAccess(): Promise<AdminAuthResult> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return { isAdmin: false, error: '로그인이 필요합니다.' };
  }

  // 서버 RPC 함수 admin_is_owner() 호출
  const { data, error } = await supabase.rpc('admin_is_owner');

  if (error) {
    console.error('admin_is_owner RPC 호출 오류:', error);
    return { isAdmin: false, userId: session.user.id, error: '관리자 권한 확인 중 오류가 발생했습니다.' };
  }

  return {
    isAdmin: Boolean(data),
    userId: session.user.id,
    error: data ? undefined : '관리자로 지정된 계정이 아닙니다.',
  };
}