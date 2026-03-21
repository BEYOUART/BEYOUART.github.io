const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8000);
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'visitors.json');

const DEFAULT_BLOCKED_PASSWORDS = new Set(['68952026']);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_CODE;
const ADMIN_PASSWORD_HASH_HEX = process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_CODE_HASH;

const parseHashHex = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(trimmed)) {
    throw new Error('ADMIN_PASSWORD_HASH must be a 64-character SHA-256 hex string.');
  }

  return Buffer.from(trimmed, 'hex');
};

const getAdminHash = () => {
  const configuredHash = parseHashHex(ADMIN_PASSWORD_HASH_HEX);

  if (!configuredHash && !ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_PASSWORD_HASH (preferred) or ADMIN_PASSWORD in environment variables.');
  }

  if (configuredHash && ADMIN_PASSWORD) {
    if (DEFAULT_BLOCKED_PASSWORDS.has(ADMIN_PASSWORD)) {
      throw new Error('ADMIN_PASSWORD is blocked. Choose a new secret password.');
    }

    const passwordHash = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
    if (!crypto.timingSafeEqual(passwordHash, configuredHash)) {
      throw new Error('ADMIN_PASSWORD and ADMIN_PASSWORD_HASH are both set but do not match. Update one so they match.');
    }

    return configuredHash;
  }

  if (configuredHash) {
    return configuredHash;
  }

  if (DEFAULT_BLOCKED_PASSWORDS.has(ADMIN_PASSWORD)) {
    throw new Error('ADMIN_PASSWORD is blocked. Choose a new secret password.');
  }

  return crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
};

const ADMIN_HASH = getAdminHash();
const SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

const sessions = new Map();
const loginState = new Map();

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

const json = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
};

const securityHeaders = (res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
    if (chunks.reduce((sum, c) => sum + c.length, 0) > 16 * 1024) {
      throw new Error('Body too large');
    }
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const ensureDataFile = async () => {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    await fsp.writeFile(DATA_FILE, JSON.stringify({ visitors: {} }, null, 2));
  }
};

const readStore = async () => {
  await ensureDataFile();
  try {
    const raw = await fsp.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.visitors ? parsed : { visitors: {} };
  } catch {
    return { visitors: {} };
  }
};

const writeStore = async (store) => {
  await ensureDataFile();
  await fsp.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
};

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const fromProxy = rawIp ? rawIp.split(',')[0].trim() : '';
  return fromProxy || req.socket.remoteAddress || 'unknown';
};

const cleanOldSessions = () => {
  const now = Date.now();
  for (const [token, expiresAt] of sessions.entries()) {
    if (expiresAt <= now) {
      sessions.delete(token);
    }
  }
};

const requireAuth = (req, res) => {
  cleanOldSessions();
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const expiresAt = sessions.get(token);

  if (!expiresAt || expiresAt <= Date.now()) {
    if (token) {
      sessions.delete(token);
    }
    json(res, 401, { error: 'Unauthorized' });
    return null;
  }

  return token;
};

const validatePassword = (password) => {
  const candidateHash = crypto.createHash('sha256').update(String(password || '')).digest();
  if (candidateHash.length !== ADMIN_HASH.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateHash, ADMIN_HASH);
};

const serveStatic = async (req, res, pathname) => {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const absolutePath = path.join(PUBLIC_DIR, requested);
  const normalizedPath = path.normalize(absolutePath);

  if (!normalizedPath.startsWith(PUBLIC_DIR)) {
    json(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const stat = await fsp.stat(normalizedPath);
    if (!stat.isFile()) {
      json(res, 404, { error: 'Not found' });
      return;
    }

    const ext = path.extname(normalizedPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
    });

    fs.createReadStream(normalizedPath).pipe(res);
  } catch {
    json(res, 404, { error: 'Not found' });
  }
};

const server = http.createServer(async (req, res) => {
  securityHeaders(res);

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'POST' && pathname === '/api/track') {
    const ip = getClientIp(req);
    const store = await readStore();
    const existing = store.visitors[ip] || { visits: 0 };
    store.visitors[ip] = {
      lastUsed: new Date().toISOString(),
      visits: Number(existing.visits || 0) + 1
    };
    await writeStore(store);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && pathname === '/api/admin/login') {
    const ip = getClientIp(req);
    const state = loginState.get(ip) || { attempts: 0, lockedUntil: 0 };

    if (Date.now() < state.lockedUntil) {
      json(res, 429, { error: 'Too many attempts. Try again later.' });
      return;
    }

    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { error: 'Invalid request body.' });
      return;
    }

    const ok = validatePassword(body.password);
    if (!ok) {
      const attempts = state.attempts + 1;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        loginState.set(ip, { attempts: 0, lockedUntil: Date.now() + LOCKOUT_MS });
        json(res, 429, { error: 'Too many failed attempts. Access locked temporarily.' });
        return;
      }

      loginState.set(ip, { attempts, lockedUntil: 0 });
      json(res, 401, { error: `Incorrect password. ${MAX_FAILED_ATTEMPTS - attempts} attempt(s) left.` });
      return;
    }

    loginState.set(ip, { attempts: 0, lockedUntil: 0 });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_TTL_MS);
    json(res, 200, { token, expiresInMs: SESSION_TTL_MS });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/admin/visitors') {
    if (!requireAuth(req, res)) {
      return;
    }

    const store = await readStore();
    const visitors = Object.entries(store.visitors || {})
      .map(([ip, details]) => ({
        ip,
        lastUsed: details.lastUsed,
        visits: Number(details.visits || 0)
      }))
      .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));

    json(res, 200, { visitors });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/admin/logout') {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (token) {
      sessions.delete(token);
    }
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET') {
    await serveStatic(req, res, pathname);
    return;
  }

  json(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
