import test from 'node:test';
import assert from 'node:assert/strict';
import {pluginKey,encodeSelection,decodeSelection,MAX_SELECTION} from '../src/selection.js';

test('key is stable for the same internal name and distinct for other names', () => {
  assert.equal(pluginKey('CloudStream'), pluginKey('CloudStream'));
  assert.notEqual(pluginKey('CloudStream'), pluginKey('cloudstream'));
  assert.match(pluginKey('Anima\u00e7\u00e3o'), /^[0-9a-f]{16}$/);
});

test('selection token roundtrips, sorts, and deduplicates keys', () => {
  const a=pluginKey('a'),b=pluginKey('b');
  const token=encodeSelection([b,a,a]);
  assert.deepEqual(decodeSelection(token),[a,b].sort());
  assert.equal(encodeSelection([a,b]),token);
  assert.match(token,/^[A-Za-z0-9_-]+$/);
});

test('selection rejects malformed, empty, too large and noncanonical tokens',()=>{
  assert.throws(()=>encodeSelection([]),RangeError);
  assert.throws(()=>encodeSelection(['nope']),TypeError);
  assert.throws(()=>encodeSelection(Array.from({length:MAX_SELECTION+1},(_,i)=>i.toString(16).padStart(16,'0'))),RangeError);
  for(const token of ['','!!!','AAAA',encodeSelection([pluginKey('x')])+'A']) assert.throws(()=>decodeSelection(token));
  const valid=encodeSelection([pluginKey('x')]);
  const b=Uint8Array.from(atob(valid.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  assert.throws(()=>decodeSelection(btoa(String.fromCharCode(2,...b.slice(1))).replace(/=+$/,'')));
  const one=encodeSelection([pluginKey('x')]);
  const raw=atob(one.replace(/-/g,'+').replace(/_/g,'/'));
  const duplicated=btoa(raw+raw.slice(1)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  assert.throws(()=>decodeSelection(duplicated));
});
