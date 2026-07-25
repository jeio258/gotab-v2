/**
 * 认证模块 — HMAC-SHA256 密码哈希 + HMAC-SHA256 JWT
 * Workers 优化版（低 CPU 占用）
 */

function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

// ---- 密码哈希 (HMAC-SHA256, 兼容 Workers) ----

async function sha256(data) {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password) {
  const salt = crypto.randomUUID();
  const enc = new TextEncoder();
  const hash = await sha256(enc.encode(salt + ':' + password));
  return '2:' + salt + ':' + hash;  // 前缀 "2:" 标识新版 hash
}

export async function verifyPassword(password, stored) {
  // 兼容旧版 PBKDF2 格式 (无 "2:" 前缀)
  if (!stored.startsWith('2:')) {
    return verifyLegacy(password, stored);
  }
  const parts = stored.split(':');
  const salt = parts[1];
  const hash = parts.slice(2).join(':');
  const enc = new TextEncoder();
  const computed = await sha256(enc.encode(salt + ':' + password));
  return hash === computed;
}

// 旧版 PBKDF2 兼容
async function verifyLegacy(password, stored) {
  try {
    const [salt, hash] = stored.split(':');
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(salt + ':' + password),
      'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 10000, hash: 'SHA-256' },
      key, 256
    );
    const computed = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
    return hash === computed;
  } catch {
    return false;
  }
}

// ---- JWT ----

export async function createToken(secret, payload) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, exp: now + 7 * 86400, iat: now };
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(fullPayload));
  const message = header + '.' + body;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const signature = base64url(String.fromCharCode(...new Uint8Array(sig)));
  return message + '.' + signature;
}

export async function verifyToken(secret, token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('bad token');
  const [headerB64, bodyB64, sigB64] = parts;

  const payload = JSON.parse(base64urlDecode(bodyB64));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('expired');

  const message = headerB64 + '.' + bodyB64;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const rawSig = Uint8Array.from(
    atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0)
  );
  const ok = await crypto.subtle.verify('HMAC', key, rawSig, enc.encode(message));
  if (!ok) throw new Error('bad signature');
  return payload;
}

// ---- 中间件 ----

export function getTokenFromRequest(req) {
  const header = req.headers.get('Authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function authenticate(req, env) {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  if (!env.JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set');
    return null;
  }

  try {
    const payload = await verifyToken(env.JWT_SECRET, token);
    return {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

// ---- 速率限制 (KV-based) ----

const RATE_WINDOW = 60;
const RATE_MAX_ATTEMPTS = 5;

export async function checkRateLimit(kv, key) {
  const kvKey = `ratelimit:${key}`;
  const val = await kv.get(kvKey);
  const count = val ? parseInt(val, 10) : 0;
  if (count >= RATE_MAX_ATTEMPTS) return false;

  await kv.put(kvKey, String(count + 1), { expirationTtl: RATE_WINDOW });
  return true;
}
