import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'vite';
import path from 'node:path';

const state = {};
globalThis.fetch = async () => { throw new Error('Network access is forbidden in image replacement tests'); };
globalThis.__imageTestBackend = {
  async rpc(name, args) {
    state.rpc = { name, args };
    return { data: state.rpcFails ? null : { id: 'existing-site' }, error: state.rpcFails || null };
  },
  from(table) {
    let update;
    let column;
    return {
      select(value) { column = value; (state.queries ||= []).push({ table, columns: value }); return this; },
      eq() { return this; }, is() { return this; }, order() { return this; },
      then(resolve) { resolve({ data: [], count: 0, error: null }); },
      update(value) { update = value; return this; },
      async single() {
        if (!update) return { data: { [column]: state.old }, error: null };
        state.events.push('update');
        state.lastUpdate = update;
        if (state.dbFails) return { data: null, error: { message: 'DB failed' } };
        state.current = update.stamped_photo_path ?? update.default_image_path;
        return { data: { id: 'target', ...update }, error: null };
      },
      async range(offset, end) {
        state.events.push('references');
        return { data: (state.references[table] || []).slice(offset, end + 1).map(value => ({ [column]: value })), error: null };
      },
    };
  },
  storage: { from(bucket) { return {
    getPublicUrl(path) { return { data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/${bucket}/${path}` } }; },
    async upload() { state.events.push('upload'); return { error: state.uploadFails ? { message: 'Upload failed' } : null }; },
    async remove(paths) {
      state.events.push('remove'); state.removed.push({ bucket, paths });
      return { data: state.removeFails ? null : [{ name: paths[0] }], error: state.removeFails ? { message: 'Denied' } : null };
    },
  }; } },
};

const result = await build({ configFile: false, logLevel: 'silent', plugins: [{
  name: 'isolated-image-services', enforce: 'pre',
  resolveId(id) {
    if (id === 'test-entry' || id.replaceAll('\\', '/').endsWith('/test-entry')) return '\0test-entry';
    if (id === '../lib/supabase') return '\0mock-supabase';
  },
  load(id) {
    if (id === '\0mock-supabase') return 'export const supabase = globalThis.__imageTestBackend;';
    if (id === '\0test-entry') return `export { updateSurveyPhoto } from ${JSON.stringify(path.resolve('src/services/surveys.ts'))};
      export { updateEquipmentCatalog } from ${JSON.stringify(path.resolve('src/services/equipment.ts'))};
      export { updateSite, listSites } from ${JSON.stringify(path.resolve('src/services/sites.ts'))};
      export { listSiteEquipment } from ${JSON.stringify(path.resolve('src/services/siteEquipment.ts'))};
      export { approveSurveyToSite } from ${JSON.stringify(path.resolve('src/services/surveys.ts'))};`;
  },
}], build: { write: false, lib: { entry: 'test-entry', formats: ['es'] } } });
const code = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output).find(item => item.type === 'chunk').code;
const services = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const file = new File(['test'], 'new.webp', { type: 'image/webp' });

for (const kind of ['survey', 'equipment']) {
  const bucket = kind === 'survey' ? 'survey-photos' : 'equipment-images';
  const replace = () => kind === 'survey' ? services.updateSurveyPhoto('target', file)
    : services.updateEquipmentCatalog('target', { name: 'test', default_image_path: 'new.webp' });
  function reset(extra = {}) {
    Object.assign(state, { old: 'old.webp', current: 'old.webp', references: {}, events: [], removed: [], dbFails: false, uploadFails: false, removeFails: false }, extra);
  }
  test(`${kind}: old file is removed only after successful DB save`, async () => {
    reset(); await replace();
    assert.ok(state.events.indexOf('remove') > state.events.indexOf('update'));
    assert.notEqual(state.current, 'old.webp');
    assert.deepEqual(state.removed, [{ bucket, paths: ['old.webp'] }]);
  });
  test(`${kind}: failed DB save never deletes old file`, async () => {
    reset({ dbFails: true }); await assert.rejects(replace());
    assert.deepEqual(state.removed, []); assert.equal(state.current, 'old.webp');
  });
  test(`${kind}: shared site image remains in storage`, async () => {
    reset({ references: { exercise_sites: ['old.webp'] } }); await replace();
    assert.deepEqual(state.removed, []);
  });
  test(`${kind}: cleanup failure returns a warning with the saved photo`, async () => {
    reset({ removeFails: true }); const saved = await replace();
    assert.match(saved.cleanupWarning, /사진은 저장되었지만/);
    assert.notEqual(state.current, 'old.webp');
  });
}

test('survey: upload failure leaves DB and previous file untouched', async () => {
  Object.assign(state, { old: 'old.webp', current: 'old.webp', events: [], removed: [], uploadFails: true });
  await assert.rejects(services.updateSurveyPhoto('target', file));
  assert.deepEqual(state.events, ['upload']); assert.deepEqual(state.removed, []);
});

test('site saves never write photo copies or relationship IDs, even if supplied by a caller', async () => {
  Object.assign(state, { events: [], dbFails: false });
  await services.updateSite('target', { name: 'site', site_image_path: 'stale.webp', survey_location_id: 'other-survey', survey_locations: { stamped_photo_path: 'new.webp' } });
  for (const key of ['site_image_path', 'survey_location_id', 'survey_locations']) assert.equal(key in state.lastUpdate, false);
  assert.equal(state.lastUpdate.name, 'site');
});
test('approval sends only the survey ID to the transactional RPC', async () => {
  state.rpcFails = null;
  assert.deepEqual(await services.approveSurveyToSite({ id: 'survey-id', address: 'stale address' }), { id: 'existing-site' });
  assert.deepEqual(state.rpc, { name: 'admin_approve_survey_to_site', args: { p_survey_id: 'survey-id' } });
});
test('missing approval RPC clearly reports the required migration', async () => {
  state.rpcFails = { code: 'PGRST202', message: 'Missing function' };
  await assert.rejects(services.approveSurveyToSite({ id: 'survey-id' }), /DB 업데이트가 필요/);
});
test('approval errors propagate without falling back to nontransactional writes', async () => {
  state.events = [];
  state.rpcFails = { code: '42501', message: 'Denied' };
  await assert.rejects(services.approveSurveyToSite({ id: 'survey-id' }), /Denied/);
  assert.deepEqual(state.events, []);
});
test('site photos join through the representative survey foreign key', async () => {
  state.queries = [];
  await services.listSites();
  assert.equal(state.queries[0].table, 'exercise_sites');
  assert.match(state.queries[0].columns, /survey_locations!survey_location_id\s*\(\s*stamped_photo_path/);
});
test('installed equipment joins its catalog instead of storing a photo copy', async () => {
  state.queries = [];
  await services.listSiteEquipment('site-id');
  assert.equal(state.queries[0].table, 'site_equipment');
  assert.match(state.queries[0].columns, /equipment_catalog\s*\(\*\)/);
});
