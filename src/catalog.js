import { pluginKey } from './selection.js';

// Only source of plugin packages. It belongs to MegaRepo's existing verified build output.
export const CATALOG_URL = 'https://raw.githubusercontent.com/admknight/CloudstreamExtensions/refs/heads/builds/plugins.json';
const CATALOG_TTL_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12 * 1000;
let memo = null;
let pending = null;

export function isAdult(plugin) {
  return Array.isArray(plugin.tvTypes) && plugin.tvTypes.some(v => typeof v === 'string' && v.trim().toUpperCase() === 'NSFW');
}

function checkEntry(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  if (typeof p.internalName !== 'string' || !p.internalName.trim() || p.internalName.length > 256) return false;
  if (typeof p.name !== 'string' || !p.name.trim()) return false;
  if (typeof p.url !== 'string' || !/^https:\/\//i.test(p.url) || !/\.cs3(?:[?#]|$)/i.test(p.url)) return false;
  if (!Number.isInteger(p.version) || p.version < 1 || !Number.isInteger(p.apiVersion)) return false;
  if (!Number.isInteger(p.status) || p.status < 0 || p.status > 3) return false;
  if (!Array.isArray(p.authors)) return false;
  return true;
}

export function normalizeCatalog(data) {
  if (!Array.isArray(data) || data.length < 1 || data.length > 10000) throw new Error('Invalid upstream catalog');
  const items = [];
  const byKey = new Map();
  const byInternal = new Set();
  for (const entry of data) {
    if (!checkEntry(entry)) throw new Error('Invalid upstream plugin metadata');
    // Never offer plugins which upstream has explicitly marked as down.
    if (entry.status === 0) continue;
    const key = pluginKey(entry.internalName);
    if (byKey.has(key) || byInternal.has(entry.internalName)) throw new Error('Ambiguous plugin identity');
    byInternal.add(entry.internalName);
    const item = Object.freeze({key, adult:isAdult(entry), source:entry});
    items.push(item);
    byKey.set(key, item);
  }
  if (!items.length) throw new Error('No available upstream plugins');
  return Object.freeze({items, byKey, updatedAt:new Date().toISOString()});
}

export async function getCatalog() {
  if (memo && Date.now() - memo.fetchedAt < CATALOG_TTL_MS) return memo.value;
  if (pending) return pending;
  pending = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(CATALOG_URL, {signal:controller.signal, cf:{cacheTtl:120, cacheEverything:true}});
      if (!response.ok) throw new Error('Catalog HTTP ' + response.status);
      const value = normalizeCatalog(await response.json());
      memo = {value, fetchedAt:Date.now()};
      return value;
    } finally { clearTimeout(timeout); }
  })();
  try { return await pending; }
  finally { pending = null; }
}

// Used by tests only, to avoid state leakage between test cases.
export function clearCatalogCacheForTest() { memo = null; pending = null; }
