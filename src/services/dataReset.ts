import { supabase } from '../lib/supabase';
import { createDataReset } from '../lib/dataReset';
import { checkAdminAccess } from './auth';

export const dataReset = createDataReset({
  async verifyAdmin() {
    const result = await checkAdminAccess();
    if (!result.isAdmin) throw new Error(result.error || '관리자 권한이 필요합니다.');
  },
  async count(table) {
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
    if (error || count === null) throw new Error(`${table} 조회 실패: ${error?.message || '행 수를 확인할 수 없습니다.'}`);
    return count;
  },
  async list(bucket, prefix, offset) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`${bucket} 파일 조회 실패: ${error.message}`);
    return data.map(item => ({ name: item.name, id: item.id ?? null }));
  },
  async remove(bucket, paths) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw new Error(`${bucket} 파일 삭제 실패: ${error.message}`);
  },
  async deleteRows(table) {
    const { error } = await supabase.from(table).delete().not('id', 'is', null);
    if (error) throw new Error(`${table} 삭제 실패: ${error.message}`);
  },
});
