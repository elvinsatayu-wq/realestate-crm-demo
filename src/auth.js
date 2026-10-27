/**
 * Authentication (JWT HS256 in an HttpOnly cookie) and role-based permissions.
 * No external dependencies: tokens are signed with HMAC-SHA256, passwords hashed with scrypt.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { HttpError } = require('./errors');

const COOKIE = 'crm_session';
const TOKEN_TTL_SEC = 12 * 60 * 60;

const ROLES = ['admin', 'manager', 'sales'];

const crud = (resources, actions) => resources.flatMap((r) => actions.map((a) => `${r}:${a}`));

/**
 * Single source of truth for what each role may do. The frontend receives the
 * same list from /api/auth/me and hides menus/buttons accordingly.
 *  - records:all     see every customer record (otherwise only those assigned to you)
 *  - records:assign  choose/change who a record is assigned to
 */
const PERMISSIONS = {
  admin: [
    'users:manage', 'team:view', 'dashboard:finance', 'records:all', 'records:assign',
    ...crud(['leads', 'walkins', 'bookings', 'transfers'], ['read', 'write', 'delete']),
  ],
  manager: [
    'team:view', 'dashboard:finance', 'records:all', 'records:assign',
    ...crud(['leads', 'walkins'], ['read', 'write', 'delete']),
    ...crud(['bookings', 'transfers'], ['read', 'write']),
  ],
  sales: [...crud(['leads', 'walkins'], ['read', 'write', 'delete'])],
};

const can = (user, perm) => !!user && (PERMISSIONS[user.role] || []).includes(perm);

function loadSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (db.inMemory) return crypto.randomBytes(32).toString('hex');
  const file = path.join(path.dirname(db.file), '.auth-secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}
const SECRET = loadSecret();

/* ---------- Tokens ---------- */
const b64url = (value) => Buffer.from(value).toString('base64url');
const hmac = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

function signToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  // `ver` lets us revoke every token of a user (password/role change, deactivation).
  const payload = b64url(JSON.stringify({ sub: user.id, role: user.role, ver: user.tokenVersion || 0, iat: now, exp: now + TOKEN_TTL_SEC }));
  return `${header}.${payload}.${hmac(`${header}.${payload}`)}`;
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const given = Buffer.from(signature);
  const expected = Buffer.from(hmac(`${header}.${payload}`));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  } catch {
    return null;
  }
}

/* ---------- Passwords ---------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(String(password), salt, 64).toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/* ---------- Session helpers ---------- */
const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  name: u.name,
  role: u.role,
  active: u.active !== false,
  createdAt: u.createdAt,
  lastLoginAt: u.lastLoginAt || null,
});

const sessionPayload = (user) => ({ user: publicUser(user), permissions: PERMISSIONS[user.role] || [] });

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
};

const setSession = (res, user) => res.cookie(COOKIE, signToken(user), { ...cookieOptions, maxAge: TOKEN_TTL_SEC * 1000 });
const clearSession = (res) => res.clearCookie(COOKIE, cookieOptions);

/* ---------- Middleware ---------- */
/** Sets req.user when the cookie holds a valid token for an active user. */
function authenticate(req, res, next) {
  const claims = verifyToken(parseCookies(req.headers.cookie)[COOKIE]);
  if (claims) {
    const user = db.get('users', claims.sub);
    if (user && user.active !== false && (user.tokenVersion || 0) === claims.ver) req.user = publicUser(user);
  }
  next();
}

function requireAuth(req, res, next) {
  next(req.user ? undefined : new HttpError(401, 'กรุณาเข้าสู่ระบบ'));
}

const requirePerm = (perm) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'กรุณาเข้าสู่ระบบ'));
  next(can(req.user, perm) ? undefined : new HttpError(403, 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้'));
};

module.exports = {
  ROLES,
  PERMISSIONS,
  can,
  hashPassword,
  verifyPassword,
  publicUser,
  sessionPayload,
  setSession,
  clearSession,
  authenticate,
  requireAuth,
  requirePerm,
};
