export interface SitePhotoSource {
  survey_locations?: { stamped_photo_path: string | null } | null;
  site_image_path?: string | null;
}

// Keep legacy-only photos visible until the database migration is complete.
export function sitePhotoPath(site: SitePhotoSource | null): string | null {
  return site?.survey_locations?.stamped_photo_path || site?.site_image_path || null;
}
