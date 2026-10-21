import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanupReplacedImage, storageImagePath, IMAGE_REFERENCES } from '../src/lib/imageCleanup.ts';

const base = 'https://project.supabase.co/storage/v1/object/public/';
const url = (bucket, path) => base + bucket + '/' + path;
test('reference columns match the supplied database schema', () => {
  assert.deepEqual(IMAGE_REFERENCES, [
    ['survey_locations', 'stamped_photo_path'],
    ['equipment_catalog', 'default_image_path'],
    ['exercise_sites', 'site_image_path'],
  ]);
});
function fixture() {
  const rows = {};
  const removed = [];
  const backend = {
    publicBase: bucket => url(bucket, ''),
    async references(table, column, offset) { return (rows[table] || []).slice(offset, offset + 1000); },
    async remove(bucket, path) { removed.push({ bucket, path }); },
  };
  return { rows, removed, backend };
}

test('normalizes relative and own public URLs; excludes external and invalid paths', () => {
  assert.equal(storageImagePath(url('equipment-images', 'catalog/a%20b.webp') + '?v=1', 'equipment-images', url('equipment-images', '')), 'catalog/a b.webp');
  for (const path of ['https://other.test/catalog/a.webp', url('survey-photos', 'a.webp'), '../a.webp', '/a.webp', '//other.test/a', 'data:image/png;base64,a']) {
    assert.equal(storageImagePath(path, 'equipment-images', url('equipment-images', '')), null);
  }
});

for (const bucket of ['survey-photos', 'equipment-images']) {
  test(`${bucket}: removes only the replaced file`, async () => {
    const f = fixture();
    assert.equal(await cleanupReplacedImage(f.backend, bucket, url(bucket, 'old.webp'), 'new.webp'), undefined);
    assert.deepEqual(f.removed, [{ bucket, path: 'old.webp' }]);
  });
  test(`${bucket}: keeps shared references in every image table`, async () => {
    for (const table of ['survey_locations', 'equipment_catalog', 'exercise_sites']) {
      const f = fixture(); f.rows[table] = [url(bucket, 'old.webp')];
      await cleanupReplacedImage(f.backend, bucket, 'old.webp', 'new.webp');
      assert.deepEqual(f.removed, []);
    }
  });
  test(`${bucket}: checks references after the first page`, async () => {
    const f = fixture(); f.rows.exercise_sites = [...Array(1000).fill(null), 'old.webp'];
    await cleanupReplacedImage(f.backend, bucket, 'old.webp', 'new.webp');
    assert.deepEqual(f.removed, []);
  });
  test(`${bucket}: missing, external and unchanged files are preserved without querying`, async () => {
    const f = fixture();
    f.backend.references = () => { throw new Error('Must not query'); };
    for (const old of [null, 'https://external.test/a.webp', url(bucket, 'new.webp')]) {
      assert.equal(await cleanupReplacedImage(f.backend, bucket, old, 'new.webp'), undefined);
    }
    assert.deepEqual(f.removed, []);
  });
}

test('reference lookup failure preserves the file and reports a warning', async () => {
  const f = fixture(); f.backend.references = async () => { throw new Error('RLS denied'); };
  assert.match(await cleanupReplacedImage(f.backend, 'survey-photos', 'old.webp', 'new.webp'), /RLS denied/);
  assert.deepEqual(f.removed, []);
});

test('delete failure reports a warning instead of failing the completed save', async () => {
  const f = fixture(); f.backend.remove = async () => { throw new Error('Storage denied'); };
  assert.match(await cleanupReplacedImage(f.backend, 'equipment-images', 'old.webp', 'new.webp'), /Storage denied/);
});
