import assert from 'node:assert/strict';
import test from 'node:test';
import { sitePhotoPath } from '../src/lib/sitePhoto.ts';

test('joined survey photo takes priority over an old copied path', () => {
  assert.equal(sitePhotoPath({ survey_locations: { stamped_photo_path: 'new.webp' }, site_image_path: 'old.webp' }), 'new.webp');
});
test('requerying the survey changes the displayed photo without copying a site path', () => {
  const site = { survey_locations: { stamped_photo_path: 'first.webp' } };
  site.survey_locations.stamped_photo_path = 'second.webp';
  assert.equal(sitePhotoPath(site), 'second.webp');
});
test('legacy-only and unlinked photos remain visible during migration', () => {
  assert.equal(sitePhotoPath({ survey_locations: null, site_image_path: 'legacy.webp' }), 'legacy.webp');
  assert.equal(sitePhotoPath({ survey_locations: { stamped_photo_path: null }, site_image_path: 'legacy.webp' }), 'legacy.webp');
});
test('missing photos remain empty', () => {
  assert.equal(sitePhotoPath(null), null);
  assert.equal(sitePhotoPath({ survey_locations: { stamped_photo_path: null } }), null);
});
