// src/services/sites.ts
import { supabase } from '../lib/supabase';
import { BUCKETS } from '../lib/constants';
import type { ExerciseSite } from '../types/database';

export interface ListSitesParams {
  searchQuery?: string;
  publishedFilter?: 'all' | 'published' | 'unpublished';
}

/**
 * survey_locations JOIN하여 지점 목록 조회
 * (외래키 survey_location_id 명시적 지정)
 */
export async function listSites(params?: ListSitesParams) {
  let query = supabase
    .from('exercise_sites')
    .select(`
      *,
      survey_locations!survey_location_id (
        stamped_photo_path,
        original_photo_path
      )
    `, { count: 'exact' });

  if (params?.searchQuery?.trim()) {
    query = query.ilike('name', `%${params.searchQuery.trim()}%`);
  }

  if (params?.publishedFilter === 'published') {
    query = query.eq('is_published', true);
  } else if (params?.publishedFilter === 'unpublished') {
    query = query.eq('is_published', false);
  }

  const { data, count, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('listSites error:', error);
    throw new Error('지점 목록을 불러오지 못했습니다.');
  }

  return { data: data || [], totalCount: count || 0 };
}

/**
 * 지점 정보 수정 (UPDATE)
 */
export async function updateSite(id: string, siteData: Partial<ExerciseSite>) {
  const { data, error } = await supabase
    .from('exercise_sites')
    .update({
      ...siteData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      survey_locations!survey_location_id (
        stamped_photo_path,
        original_photo_path
      )
    `)
    .single();

  if (error) {
    console.error('updateSite error:', error);
    throw new Error('지점 정보 저장에 실패했습니다.');
  }

  return data;
}

/**
 * Storage 상대 경로를 Public URL로 변환하는 헬퍼 함수
 */
export function getSiteImageUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  
  const { data } = supabase.storage.from(BUCKETS.SURVEY_PHOTOS).getPublicUrl(path);
  return data.publicUrl;
}