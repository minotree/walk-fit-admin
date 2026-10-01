// src/services/surveys.ts
import { supabase } from '../lib/supabase';
import { BUCKETS } from '../lib/constants';

export interface SurveyLocation {
  id: string;
  facility_name?: string;       // 지점명/시설명 (PWA 수집 입력값)
  address?: string;              // 주소 정보
  stamped_photo_path?: string;  // 스탬프 촬영 사진 상대 경로
  original_photo_path?: string; // 원본 촬영 사진 상대 경로
  review_note?: string;          // 현장 메모
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
export async function updateSurveyPhoto(surveyLocationId: string, file: File): Promise<string> {
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
  const { error: updateError } = await supabase
    .from('survey_locations')
    .update({ stamped_photo_path: fileName })
    .eq('id', surveyLocationId);

  if (updateError) {
    console.error('updateSurveyPhoto DB error:', updateError);
    throw new Error('조사 데이터 사진 경로 업데이트에 실패했습니다.');
  }

  return fileName;
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
  // facility_name(시설명)을 1순위로 지점 이름(name)에 지정
  const siteName = survey.facility_name?.trim() || survey.address?.trim() || '신규 수집 지점';

  const { data: siteData, error: siteError } = await supabase
    .from('exercise_sites')
    .insert([
      {
        name: siteName,                            // facility_name 반영!
        latitude: survey.latitude,
        longitude: survey.longitude,
        address_text: survey.address || '',
        amenity_note: survey.review_note || '',
        survey_location_id: survey.id,            // survey_locations 외래키 연동
        is_published: false,
        last_verified_at: new Date().toISOString().split('T')[0],
      },
    ])
    .select()
    .single();

  if (siteError) {
    console.error('approveSurveyToSite insert error:', siteError);
    throw new Error('지점 승인 생성 중 오류가 발생했습니다.');
  }

  // 승인 상태(status = 'approved')로 변경
  const { error: updateError } = await supabase
    .from('survey_locations')
    .update({ status: 'approved' })
    .eq('id', survey.id);

  if (updateError) {
    console.error('approveSurveyToSite status update error:', updateError);
  }

  return siteData;
}