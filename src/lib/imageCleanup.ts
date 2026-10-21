export type ImageBucket = 'survey-photos' | 'equipment-images';
export const IMAGE_REFERENCES = [
  ['survey_locations', 'stamped_photo_path'],
  ['equipment_catalog', 'default_image_path'],
  ['exercise_sites', 'site_image_path'],
] as const;

// Only resolve files belonging to this project's bucket. Never delete external URLs.
export function storageImagePath(value: string | null | undefined, bucket: ImageBucket, publicBase: string): string | null {
  if (!value || !publicBase.endsWith(`/${bucket}/`)) return null;
  let path = value;
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) {
    try {
      const url = new URL(value);
      const base = new URL(publicBase);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null;
      path = decodeURIComponent(url.pathname.slice(base.pathname.length));
    } catch { return null; }
  }
  if (!path || /[?#\\]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) return null;
  return path;
}

export interface ImageCleanupBackend {
  publicBase: (bucket: ImageBucket) => string;
  references: (table: string, column: string, offset: number) => Promise<(string | null)[]>;
  remove: (bucket: ImageBucket, path: string) => Promise<void>;
}

export async function cleanupReplacedImage(backend: ImageCleanupBackend, bucket: ImageBucket,
  previous: string | null | undefined, current: string | null | undefined): Promise<string | undefined> {
  const base = backend.publicBase(bucket);
  const oldPath = storageImagePath(previous, bucket, base);
  if (!oldPath || oldPath === storageImagePath(current, bucket, base)) return;
  try {
    for (const [table, column] of IMAGE_REFERENCES) {
      for (let offset = 0; ; offset += 1000) {
        const values = await backend.references(table, column, offset);
        if (values.some(value => storageImagePath(value, bucket, base) === oldPath)) return;
        if (values.length < 1000) break;
      }
    }
    await backend.remove(bucket, oldPath);
  } catch (error) {
    console.warn('Previous image cleanup failed:', error);
    const detail = error instanceof Error ? error.message : '조회·삭제 요청에 실패했습니다.';
    return `사진은 저장되었지만 기존 파일을 정리하지 못했습니다. ${detail}`;
  }
}
