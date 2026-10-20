import assert from 'node:assert/strict';
import test from 'node:test';
import { createImageId } from '../src/lib/imageId.ts';

test('image upload IDs work without crypto.randomUUID', () => {
  const source = { getRandomValues: array => { array.fill(255); return array; } };
  assert.equal(createImageId(source), 'ffffffff-ffff-4fff-bfff-ffffffffffff');
});
test('generated image IDs are distinct UUID v4 values', () => {
  const ids = Array.from({ length: 100 }, () => createImageId());
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
