import assert from 'node:assert/strict';
import test from 'node:test';
import { changeRegion, MIN_REGION_SIZE } from '../src/lib/imageRegions.ts';

const near = (actual, expected) => actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-9));

test('moving a region clamps to the image without changing its size', () => {
  near(changeRegion([.2, .3, .6, .8], [.4, .5], [1, 0], 'move'), [.6, 0, 1, .5]);
});
test('resizing stops at the opposite edge and preserves a usable region', () => {
  near(changeRegion([.2, .3, .6, .8], [.2, .3], [.9, .9], 'nw'),
    [.6 - MIN_REGION_SIZE, .8 - MIN_REGION_SIZE, .6, .8]);
});
test('all eight resize handles move only their corresponding edges', () => {
  const initial = [.2, .3, .6, .8];
  for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
    near(changeRegion(initial, [.4, .5], [.45, .55], handle),
      [.2 + (handle.includes('w') ? .05 : 0), .3 + (handle.includes('n') ? .05 : 0),
        .6 + (handle.includes('e') ? .05 : 0), .8 + (handle.includes('s') ? .05 : 0)]);
  }
});
test('drawing works in either direction', () => {
  near(changeRegion([0, 0, 0, 0], [.8, .7], [.2, .1], 'draw'), [.2, .1, .8, .7]);
});
