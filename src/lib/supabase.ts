// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// .env.local에 정의된 VITE_SUPABASE_PUBLISHABLE_KEY (또는 VITE_SUPABASE_ANON_KEY) 참조
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // 세션을 localStorage가 아닌 메모리에만 유지 (TRD 5장 보안 규격)
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});