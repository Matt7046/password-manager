/**
 * Lightweight crypto helpers (no paid services / no extra npm deps).
 * Uses Web Crypto when available, otherwise a pure-JS fallback.
 */

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa is available on web; on native RN we polyfill via Buffer-less encoding
  if (typeof btoa === 'function') return btoa(binary);
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triplet = (a << 16) | (b << 8) | c;
    result += chars[(triplet >> 18) & 63];
    result += chars[(triplet >> 12) & 63];
    result += i + 1 < bytes.length ? chars[(triplet >> 6) & 63] : '=';
    result += i + 2 < bytes.length ? chars[triplet & 63] : '=';
  }
  return result;
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/=+$/, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const a = chars.indexOf(clean[i]);
    const b = chars.indexOf(clean[i + 1]);
    const c = chars.indexOf(clean[i + 2]);
    const d = chars.indexOf(clean[i + 3]);
    const triplet = (a << 18) | (b << 12) | ((c >= 0 ? c : 0) << 6) | (d >= 0 ? d : 0);
    out.push((triplet >> 16) & 255);
    if (c >= 0) out.push((triplet >> 8) & 255);
    if (d >= 0) out.push(triplet & 255);
  }
  return new Uint8Array(out);
}

function utf8Encode(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(
        0xe0 | (charcode >> 12),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f),
      );
    } else {
      i++;
      charcode =
        0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f),
      );
    }
  }
  return new Uint8Array(utf8);
}

function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i++];
    if (c < 0x80) out += String.fromCharCode(c);
    else if (c < 0xe0) {
      out += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (c < 0xf0) {
      out += String.fromCharCode(
        ((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f),
      );
    } else {
      const cp =
        ((c & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
      const offset = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
    }
  }
  return out;
}

/** Pure JS SHA-256 */
function sha256Bytes(message: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const bitLen = message.length * 8;
  const withOne = message.length + 1;
  let totalLen = withOne + 8;
  while (totalLen % 64 !== 0) totalLen++;
  const padded = new Uint8Array(totalLen);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  // store bit length as 64-bit big-endian at the end
  const high = Math.floor(bitLen / 0x100000000);
  const low = bitLen >>> 0;
  view.setUint32(padded.length - 8, high, false);
  view.setUint32(padded.length - 4, low, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < padded.length; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function sha256Hex(input: string): string {
  return toHex(sha256Bytes(utf8Encode(input)));
}

/** Iterated SHA-256 key derivation (no external PBKDF2 dependency). */
function deriveBytes(password: string, salt: string, iterations: number): Uint8Array {
  let block = utf8Encode(`${password}:${salt}`);
  for (let i = 0; i < iterations; i++) {
    block = sha256Bytes(block);
  }
  return block;
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/** Stream cipher: keystream = SHA256(key || iv || counter). Same on web and native. */
async function encryptBytes(plaintext: Uint8Array, keyBytes: Uint8Array): Promise<Uint8Array> {
  const iv = getRandomBytes(16);
  const out = new Uint8Array(iv.length + plaintext.length);
  out.set(iv, 0);
  let counter = 0;
  let offset = 0;
  while (offset < plaintext.length) {
    const counterBytes = new Uint8Array(4);
    new DataView(counterBytes.buffer).setUint32(0, counter++, false);
    const seed = new Uint8Array(keyBytes.length + iv.length + 4);
    seed.set(keyBytes, 0);
    seed.set(iv, keyBytes.length);
    seed.set(counterBytes, keyBytes.length + iv.length);
    const keystream = sha256Bytes(seed);
    const n = Math.min(32, plaintext.length - offset);
    for (let i = 0; i < n; i++) {
      out[16 + offset + i] = plaintext[offset + i] ^ keystream[i];
    }
    offset += n;
  }
  return out;
}

async function decryptBytes(payload: Uint8Array, keyBytes: Uint8Array): Promise<Uint8Array> {
  const iv = payload.slice(0, 16);
  const ciphertext = payload.slice(16);
  const out = new Uint8Array(ciphertext.length);
  let counter = 0;
  let offset = 0;
  while (offset < ciphertext.length) {
    const counterBytes = new Uint8Array(4);
    new DataView(counterBytes.buffer).setUint32(0, counter++, false);
    const seed = new Uint8Array(keyBytes.length + iv.length + 4);
    seed.set(keyBytes, 0);
    seed.set(iv, keyBytes.length);
    seed.set(counterBytes, keyBytes.length + iv.length);
    const keystream = sha256Bytes(seed);
    const n = Math.min(32, ciphertext.length - offset);
    for (let i = 0; i < n; i++) {
      out[offset + i] = ciphertext[offset + i] ^ keystream[i];
    }
    offset += n;
  }
  return out;
}

export async function randomSalt(): Promise<string> {
  return toHex(getRandomBytes(16));
}

export function hashPassword(password: string, salt: string): string {
  return toHex(deriveBytes(password, salt, 10_000));
}

export function deriveEncryptionKey(password: string, salt: string): string {
  return toHex(deriveBytes(password, `${salt}:vault`, 10_000));
}

export async function encryptText(plaintext: string, keyHex: string): Promise<string> {
  const encrypted = await encryptBytes(utf8Encode(plaintext), fromHex(keyHex));
  return bytesToBase64(encrypted);
}

export async function decryptText(ciphertext: string, keyHex: string): Promise<string> {
  const plain = await decryptBytes(base64ToBytes(ciphertext), fromHex(keyHex));
  const text = utf8Decode(plain);
  if (!text) throw new Error('Decryption failed');
  return text;
}

export function createId(): string {
  return `${Date.now()}-${toHex(getRandomBytes(6))}`;
}
