// src/services/storage.ts
import { supabase } from '../lib/supabase';
import { BUCKETS } from '../lib/constants';

/**
 * 지점 사진 파일 업로드
 */
export async function uploadImage(
  file: File,
  bucket: string = BUCKETS.EQUIPMENT_IMAGES
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `sites/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, { upsert: true });

  if (uploadError) {
    console.error('Upload Error:', uploadError);
    throw new Error('사진 업로드 실패');
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
} 