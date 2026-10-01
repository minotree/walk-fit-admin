// src/services/equipment.ts
import { supabase } from '../lib/supabase';
import { BUCKETS } from '../lib/constants';
import type { EquipmentCatalog } from '../types/database';

/**
 * 운동기구 대표/표준 이미지 업로드
 */
export async function uploadEquipmentImage(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `catalog/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKETS.EQUIPMENT_IMAGES)
    .upload(fileName, file, { upsert: true });

  if (uploadError) {
    console.error('uploadEquipmentImage error:', uploadError);
    throw new Error('운동기구 사진 업로드 실패');
  }

  const { data } = supabase.storage.from(BUCKETS.EQUIPMENT_IMAGES).getPublicUrl(fileName);
  return data.publicUrl;
}

/**
 * 운동기구 목록 조회
 */
export async function listEquipmentCatalog(searchQuery: string = '') {
  let query = supabase.from('equipment_catalog').select('*');

  if (searchQuery.trim()) {
    query = query.ilike('name', `%${searchQuery.trim()}%`);
  }

  const { data, error } = await query.order('name', { ascending: true });

  if (error) {
    console.error('listEquipmentCatalog error:', error);
    throw new Error('운동기구 목록을 불러오지 못했습니다.');
  }

  return (data as EquipmentCatalog[]) || [];
}

/**
 * 신규 운동기구 카탈로그 등록
 */
export async function createEquipmentCatalog(item: Partial<EquipmentCatalog>) {
  const { data, error } = await supabase
    .from('equipment_catalog')
    .insert([
      {
        name: item.name,
        model_name: item.model_name || '',
        default_image_path: item.default_image_path || null,
        instructions: item.instructions || '',
        effects: item.effects || '',
        precautions: item.precautions || '',
        source_reference: item.source_reference || '',
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('createEquipmentCatalog error:', error);
    throw new Error('운동기구 등록에 실패했습니다.');
  }

  return data as EquipmentCatalog;
}

/**
 * 기존 운동기구 카탈로그 정보 수정
 */
export async function updateEquipmentCatalog(id: string, item: Partial<EquipmentCatalog>) {
  const { data, error } = await supabase
    .from('equipment_catalog')
    .update({
      name: item.name,
      model_name: item.model_name,
      default_image_path: item.default_image_path,
      instructions: item.instructions,
      effects: item.effects,
      precautions: item.precautions,
      source_reference: item.source_reference,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('updateEquipmentCatalog error:', error);
    throw new Error('운동기구 정보 수정에 실패했습니다.');
  }

  return data as EquipmentCatalog;
}