import { supabase } from '../lib/supabase';
import { cleanupReplacedImage, type ImageBucket } from '../lib/imageCleanup';

export function cleanupOldImage(bucket: ImageBucket, previous: string | null | undefined, current: string | null | undefined) {
  return cleanupReplacedImage({
    publicBase(bucket) {
      return supabase.storage.from(bucket).getPublicUrl('').data.publicUrl;
    },
    async references(table, column, offset) {
      const { data, error } = await supabase.from(table).select(column).order('id').range(offset, offset + 999);
      if (error) throw new Error(`${table}.${column} 조회 실패: ${error.message}`);
      if (!data) throw new Error(`${table}.${column} 조회 결과를 확인할 수 없습니다.`);
      return (data as unknown as Record<string, string | null>[]).map(row => row[column]);
    },
    async remove(bucket, path) {
      const { data, error } = await supabase.storage.from(bucket).remove([path]);
      if (error) throw new Error(`${bucket} 파일 삭제 실패: ${error.message}`);
      if (!data?.length) throw new Error(`${bucket}에서 삭제된 파일이 확인되지 않습니다. 파일이 이미 없거나 Storage SELECT/DELETE 정책에 의해 제외되었을 수 있습니다.`);
    },
  }, bucket, previous, current);
}
