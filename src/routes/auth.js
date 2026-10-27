const express = require('express');
const db = require('../db');
const { HttpError } = require('../errors');
const { hashPassword, verifyPassword, sessionPayload, setSession, clearSession, requireAuth } = require('../auth');

// Brute-force protection: 5 failed attempts per IP+username locks that pair for 5 minutes.
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;
const attempts = new Map();
// Compared against when the username doesn't exist, so response timing doesn't reveal it.
const DUMMY_HASH = hashPassword('not-a-real-password');

const router = express.Router();

router.post('/login', (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username || !password) throw new HttpError(400, 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');

  const key = `${req.ip}|${username}`;
  const entry = attempts.get(key);
  if (entry?.lockedUntil > Date.now()) {
    const minutes = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    throw new HttpError(429, `เข้าสู่ระบบผิดเกินกำหนด กรุณาลองใหม่ในอีก ${minutes} นาที`);
  }

  const user = db.find('users', (u) => u.username.toLowerCase() === username)[0];
  const valid = verifyPassword(password, user ? user.passwordHash : DUMMY_HASH) && !!user;
  if (!valid) {
    const count = (entry?.lockedUntil > Date.now() ? 0 : entry?.count || 0) + 1;
    attempts.set(key, { count, lockedUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 });
    throw new HttpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  if (user.active === false) throw new HttpError(403, 'บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');

  attempts.delete(key);
  const updated = db.update('users', user.id, { lastLoginAt: new Date().toISOString() });
  setSession(res, updated);
  res.json(sessionPayload(updated));
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json(sessionPayload(req.user));
});

module.exports = router;
