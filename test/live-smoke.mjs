import assert from 'node:assert/strict';
import { encodeSelection } from '../src/selection.js';

const BASE = process.env.BUNDLE_BASE_URL || 'https://adam-cloudstream-bundles.badass-insane.workers.dev';
const UPSTREAM = 'https://raw.githubusercontent.com/admknight/CloudstreamExtensions/refs/heads/builds/plugins.json';

async function get(url, expectedStatus = 200) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'Accept': 'application/json, text/html' } });
  assert.equal(response.status, expectedStatus, `Unexpected HTTP ${response.status} at ${url}`);
  return response;
}

async function run() {
  assert.ok(BASE.startsWith('https://'), 'Bundle base must use HTTPS');
  const htmlResponse = await get(BASE + '/');
  assert.match(htmlResponse.headers.get('content-type') || '', /text\/html/i);
  const html = await htmlResponse.text();
  assert.match(html, /Personal Bundle|CloudStream/i);
  console.log('PASS: Homepage responds with the bundle-builder HTML.');

  const apiResponse = await get(BASE + '/api/catalog');
  assert.match(apiResponse.headers.get('content-type') || '', /application\/json/i);
  const catalog = await apiResponse.json();
  assert.ok(Array.isArray(catalog.plugins) && catalog.plugins.length > 1, 'Catalog missing plugins');
  assert.equal(catalog.count, catalog.plugins.length);
  assert.ok(catalog.plugins.every(x => x.id && x.name && x.internalName && x.status !== 0));
  assert.equal(new Set(catalog.plugins.map(x => x.id)).size, catalog.plugins.length);
  console.log(`PASS: Catalog contains ${catalog.count} unique, available plugins.`);

  const raw = await (await get(UPSTREAM)).json();
  assert.ok(Array.isArray(raw));
  const active = raw.filter(x => x.status !== 0);
  const rawByName = new Map(active.map(x => [x.internalName, x]));
  assert.equal(catalog.plugins.length, active.length, 'Catalog differs from published active plugins');
  for (const p of catalog.plugins) assert.ok(rawByName.has(p.internalName), 'Unrecognized catalog plugin');
  console.log('PASS: Personal catalog matches current active MegaRepo plugin count and identities.');

  const sfw = catalog.plugins.filter(x => !x.adult).slice(0, 2);
  assert.equal(sfw.length, 2, 'Need two non-NSFW plugins for selection test');
  const token = encodeSelection(sfw.map(x => x.id));
  const repoResponse = await get(`${BASE}/b/${token}/all/repo.json`);
  assert.match(repoResponse.headers.get('content-type') || '', /application\/json/i);
  const manifest = await repoResponse.json();
  assert.equal(manifest.manifestVersion, 1);
  assert.equal(manifest.pluginLists.length, 1);
  assert.equal(manifest.pluginLists[0], `${BASE}/b/${token}/all/plugins.json`);
  assert.ok(manifest.name && manifest.description);
  console.log('PASS: Personal repo.json contains a correct HTTPS plugin-list URL.');

  const listResponse = await get(manifest.pluginLists[0]);
  const plugins = await listResponse.json();
  assert.equal(plugins.length, 2, 'Expected exactly two selected plugins');
  assert.deepEqual(new Set(plugins.map(p => p.internalName)), new Set(sfw.map(p => p.internalName)));
  for (const p of plugins) {
    const orig = rawByName.get(p.internalName);
    assert.equal(p.url, orig.url, 'Source package URL was changed');
    assert.equal(p.version, orig.version, 'Source plugin version was changed');
    assert.match(p.url, /^https:\/\//);
  }
  console.log('PASS: Personal plugins.json contains only two selected plugins with original package URLs and versions.');

  const adult = catalog.plugins.find(x => x.adult);
  if (adult) {
    const mixedToken = encodeSelection([sfw[0].id, adult.id]);
    const sfwResponse = await get(`${BASE}/b/${mixedToken}/sfw/plugins.json`);
    const nsfwResponse = await get(`${BASE}/b/${mixedToken}/nsfw/plugins.json`);
    const sfwOnly = await sfwResponse.json();
    const nsfwOnly = await nsfwResponse.json();
    assert.deepEqual(sfwOnly.map(p => p.internalName), [sfw[0].internalName]);
    assert.deepEqual(nsfwOnly.map(p => p.internalName), [adult.internalName]);
    console.log('PASS: SFW/NSFW personal views exclude the opposite category.');
  } else {
    console.log('SKIP: No NSFW-labeled plugins are currently in the upstream catalog.');
  }

  await get(`${BASE}/b/not-a-valid-token/all/repo.json`, 400);
  await get(`${BASE}/not-a-real-route`, 404);
  console.log('PASS: Malformed bundle tokens and unknown routes fail closed.');
  console.log('SUCCESS: Live Cloudflare Worker smoke checks passed (Android installation not tested).');
}

run().catch(error => {
  console.error('FAIL: Live Cloudflare Worker smoke checks:', error.stack || error);
  process.exitCode = 1;
});
