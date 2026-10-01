// src/services/siteEquipment.ts
import { supabase } from '../lib/supabase';
import type { SiteEquipment } from '../types/database';

/**
 * 특정 지점에 설치된 운동기구 목록 조회 (EquipmentCatalog JOIN)
 */
export async function listSiteEquipment(siteId: string) {
  const { data, error } = await supabase
    .from('site_equipment')
    .select(`
      *,
      equipment_catalog (*)
    `)
    .eq('site_id', siteId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('listSiteEquipment error:', error);
    throw new Error('지점의 운동기구 목록을 불러오지 못했습니다.');
  }

  return (data as SiteEquipment[]) || [];
}

/**
 * 지점에 새 운동기구 연결 추가
 */
export async function addSiteEquipment(siteId: string, equipmentId: string, quantity: number = 1) {
  const { data, error } = await supabase
    .from('site_equipment')
    .insert([
      {
        site_id: siteId,
        equipment_id: equipmentId,
        quantity,
        is_published: true, // 기본적으로 공개 상태로 매핑
        display_order: 0,
      },
    ])
    .select(`
      *,
      equipment_catalog (*)
    `)
    .single();

  if (error) {
    console.error('addSiteEquipment error:', error);
    throw new Error('지점에 운동기구를 추가하지 못했습니다.');
  }

  return data as SiteEquipment;
}

/**
 * 지점에 연결된 기구 정보 (수량, 공개 여부) 수정
 */
export async function updateSiteEquipment(
  id: string,
  updates: { quantity?: number; is_published?: boolean; display_order?: number }
) {
  const { data, error } = await supabase
    .from('site_equipment')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      equipment_catalog (*)
    `)
    .single();

  if (error) {
    console.error('updateSiteEquipment error:', error);
    throw new Error('지점 운동기구 정보 수정 실패');
  }

  return data as SiteEquipment;
}

/**
 * 지점 연결 운동기구 삭제
 */
export async function deleteSiteEquipment(id: string) {
  const { error } = await supabase.from('site_equipment').delete().eq('id', id);

  if (error) {
    console.error('deleteSiteEquipment error:', error);
    throw new Error('지점 운동기구 연결 삭제 실패');
  }
}