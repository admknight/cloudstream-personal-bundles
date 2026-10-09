/* Stateless selection format v1: one version byte and 8 bytes per stable plugin key.
 * Keys are FNV-1a 64-bit hashes of the upstream internalName, with collision checks
 * performed against the live, verified MegaRepo catalog before publishing results.
 * This is a compact identifier, not a signature or authorization mechanism.
 */
const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;
export const MAX_SELECTION = 100;
export const TOKEN_VERSION = 1;

export function pluginKey(internalName) {
  if (typeof internalName !== 'string' || !internalName.trim()) throw new TypeError('Invalid internalName');
  let result = OFFSET;
  for (const byte of new TextEncoder().encode(internalName)) {
    result = ((result ^ BigInt(byte)) * PRIME) & MASK;
  }
  return result.toString(16).padStart(16, '0');
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function encodeSelection(keys) {
  if (!Array.isArray(keys)) throw new TypeError('Expected a list of plugin keys');
  const unique = [...new Set(keys)].sort();
  if (unique.length < 1 || unique.length > MAX_SELECTION) throw new RangeError('Select between 1 and 100 extensions');
  const bytes = new Uint8Array(1 + unique.length * 8);
  bytes[0] = TOKEN_VERSION;
  unique.forEach((key, i) => {
    if (typeof key !== 'string' || !/^[a-f0-9]{16}$/.test(key)) throw new TypeError('Invalid plugin key');
    for (let j = 0; j < 8; j += 1) bytes[1 + i * 8 + j] = parseInt(key.slice(j * 2, j * 2 + 2), 16);
  });
  return toBase64Url(bytes);
}

export function decodeSelection(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{12,1100}$/.test(token)) throw new TypeError('Invalid bundle token');
  let bytes;
  try {
    const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  } catch { throw new TypeError('Invalid base64 bundle token'); }
  if (bytes[0] !== TOKEN_VERSION || (bytes.length - 1) % 8 !== 0) throw new TypeError('Invalid bundle version or length');
  const count = (bytes.length - 1) / 8;
  if (count < 1 || count > MAX_SELECTION) throw new RangeError('Invalid selection size');
  const keys = [];
  for (let i = 0; i < count; i += 1) {
    keys.push([...bytes.slice(1 + i * 8, 1 + (i + 1) * 8)].map(b => b.toString(16).padStart(2, '0')).join(''));
  }
  if (keys.some((key, i) => i > 0 && key <= keys[i - 1]) || encodeSelection(keys) !== token) {
    throw new TypeError('Noncanonical or duplicate bundle keys');
  }
  return keys;
}
