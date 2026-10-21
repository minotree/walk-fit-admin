import assert from 'node:assert/strict';
import test from 'node:test';
import { createDataReset, RESET_TABLES, RESET_BUCKETS } from '../src/lib/dataReset.ts';

function fixture(numberOfFiles = 2) {
  const rows = Object.fromEntries(RESET_TABLES.map(table => [table, 3]));
  const objects = Object.fromEntries(RESET_BUCKETS.map(bucket => [bucket, new Set(Array.from({ length: numberOfFiles }, (_, i) => 'nested/photos/' + String(i).padStart(5, '0') + '.webp'))]));
  const writes = [];
  const backend = {
    async verifyAdmin() {},
    async count(table) { return rows[table]; },
    async list(bucket, prefix, offset) {
      const base = prefix ? prefix + '/' : '';
      const children = new Map();
      for (const path of objects[bucket]) {
        if (!path.startsWith(base)) continue;
        const relative = path.slice(base.length);
        const parts = relative.split('/');
        children.set(parts[0], { name: parts[0], id: parts.length > 1 ? null : 'file-' + path });
      }
      return [...children.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(offset, offset + 1000);
    },
    async remove(bucket, paths) { writes.push({ bucket, count: paths.length }); for (const path of paths) objects[bucket].delete(path); },
    async deleteRows(table) { writes.push({ table }); rows[table] = 0; },
  };
  return { backend, rows, objects, writes, reset: createDataReset(backend) };
}

test('preview counts rows and recursive files without deleting anything', async () => {
  const f = fixture(); const preview = await f.reset.preview();
  assert.equal(preview.tables.exercise_sites, 3);
  assert.equal(preview.buckets['survey-photos'].length, 2);
  assert.deepEqual(f.writes, []);
});
test('wrong confirmation and denied admin access cannot delete', async () => {
  const f = fixture(); const preview = await f.reset.preview();
  await assert.rejects(() => f.reset.reset(preview, '삭제', () => {}), /확인 문구/);
  f.backend.verifyAdmin = async () => { throw new Error('관리자 아님'); };
  await assert.rejects(() => f.reset.reset(preview, '전체 초기화', () => {}), /관리자 아님/);
  assert.deepEqual(f.writes, []);
});
test('changes after preview abort before deleting any files or rows', async () => {
  const f = fixture(); const preview = await f.reset.preview();
  f.objects['survey-photos'].add('new.webp');
  await assert.rejects(() => f.reset.reset(preview, '전체 초기화', () => {}), /데이터가 변경/);
  assert.deepEqual(f.writes, []);
});
test('pagination and batched removal empty both buckets and delete tables in FK order', async () => {
  const f = fixture(1001); const preview = await f.reset.preview();
  assert.equal(preview.buckets['equipment-images'].length, 1001);
  const remaining = await f.reset.reset(preview, '전체 초기화', () => {});
  assert.deepEqual(f.writes.filter(item => item.table).map(item => item.table), [...RESET_TABLES]);
  assert.deepEqual(f.writes.filter(item => item.bucket).map(item => item.count), [1000, 1, 1000, 1]);
  for (const table of RESET_TABLES) assert.equal(remaining.tables[table], 0);
  for (const bucket of RESET_BUCKETS) assert.equal(remaining.buckets[bucket].length, 0);
});
test('failed storage removal stops before deleting database rows', async () => {
  const f = fixture(); const preview = await f.reset.preview();
  f.backend.remove = async () => { throw new Error('storage denied'); };
  await assert.rejects(() => f.reset.reset(preview, '전체 초기화', () => {}), /일부 항목.*storage denied/);
  assert.deepEqual(f.writes, []);
});
test('silent RLS no-op is detected and later tables are not deleted', async () => {
  const f = fixture(0); const preview = await f.reset.preview();
  f.backend.deleteRows = async table => { f.writes.push({ table }); };
  await assert.rejects(() => f.reset.reset(preview, '전체 초기화', () => {}), /남은 행/);
  assert.deepEqual(f.writes.map(item => item.table), ['site_equipment']);
});
