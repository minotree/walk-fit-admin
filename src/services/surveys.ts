// src/services/surveys.ts
import { supabase } from '../lib/supabase';
import { BUCKETS } from '../lib/constants';
import { cleanupOldImage } from './imageCleanup';

export interface SurveyLocation {
  id: string;
  facility_name?: string;
  address?: string;
  stamped_photo_path?: string; // 단일 대표 사진 경로로 사용
  review_note?: string;
  latitude: number;
  longitude: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

/**
 * Storage 상대 경로를 Supabase Public URL로 변환
 */
export function getSurveyImageUrl(path?: string): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const { data } = supabase.storage.from(BUCKETS.SURVEY_PHOTOS).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * PWA 현장 조사 대표 이미지 교체 업로드 및 DB 업데이트
 */
export async function updateSurveyPhoto(surveyLocationId: string, file: File): Promise<{ path: string; cleanupWarning?: string }> {
  const { data: previous, error: readError } = await supabase.from('survey_locations')
    .select('stamped_photo_path').eq('id', surveyLocationId).single();
  if (readError) throw new Error('기존 대표 사진 정보를 확인하지 못했습니다.');
  const fileExt = file.name.split('.').pop();
  const fileName = `representative/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  // 1. survey-photos 버킷에 사진 파일 업로드
  const { error: uploadError } = await supabase.storage
    .from(BUCKETS.SURVEY_PHOTOS)
    .upload(fileName, file, { upsert: true });

  if (uploadError) {
    console.error('uploadSurveyPhoto error:', uploadError);
    throw new Error('대표 사진 파일 업로드에 실패했습니다.');
  }

  // 2. survey_locations 테이블의 stamped_photo_path 업데이트
  let update = supabase
    .from('survey_locations')
    .update({ stamped_photo_path: fileName })
    .eq('id', surveyLocationId);
  update = previous.stamped_photo_path === null ? update.is('stamped_photo_path', null)
    : update.eq('stamped_photo_path', previous.stamped_photo_path);
  const { error: updateError } = await update.select('id').single();

  if (updateError) {
    console.error('updateSurveyPhoto DB error:', updateError);
    throw new Error('조사 데이터 사진 경로 업데이트에 실패했습니다.');
  }

  const cleanupWarning = await cleanupOldImage(BUCKETS.SURVEY_PHOTOS, previous.stamped_photo_path, fileName);
  return { path: fileName, cleanupWarning };
}

/**
 * PWA 현장 조사 수집 목록 조회
 */
export async function listSurveyLocations(statusFilter: 'all' | 'pending' | 'approved' = 'pending') {
  let query = supabase.from('survey_locations').select('*');

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('listSurveyLocations error:', error);
    throw new Error('조사 수집 목록을 불러오지 못했습니다.');
  }

  return (data as SurveyLocation[]) || [];
}

/**
 * PWA 조사 데이터를 exercise_sites 지점으로 승인 및 전환
 */
export async function approveSurveyToSite(survey: SurveyLocation) {
  const { data, error } = await supabase.rpc('admin_approve_survey_to_site', { p_survey_id: survey.id });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('승인 기능의 DB 업데이트가 필요합니다. supabase/README.md의 적용 순서를 확인해 주세요.');
    }
    throw new Error(`지점 승인에 실패했습니다: ${error.message}`);
  }
  if (!data) throw new Error('지점 승인 결과를 확인하지 못했습니다.');
  return data;
}
