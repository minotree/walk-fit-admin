export type ToiletStatus = 'yes' | 'no' | 'unknown';
export type DrinkingWaterStatus = 'yes' | 'no' | 'unknown';

export interface ExerciseSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address_text: string;
  toilet_status: ToiletStatus;
  drinking_water_status: DrinkingWaterStatus;
  amenity_note: string;
  last_verified_at: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface EquipmentCatalog {
  id: string;
  name: string;
  model_name: string;
  default_image_path: string | null;
  instructions: string;
  effects: string;
  precautions: string;
  source_reference: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SiteEquipment {
  id: string;
  site_id: string;
  equipment_id: string;
  site_image_path: string | null;
  quantity: number;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  // 조인 조회용 확장 객체
  equipment_catalog?: EquipmentCatalog;
}