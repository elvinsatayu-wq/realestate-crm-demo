const express = require('express');
const db = require('../db');
const { HttpError } = require('../errors');
const { ROLES, hashPassword, publicUser, requirePerm, setSession } = require('../auth');

const router = express.Router();

const byRoleThenName = (a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name, 'th');

// Names + roles for every signed-in user (assignee dropdowns, "ฝ่ายขาย" columns).
router.get('/directory', (req, res) => {
  res.json(db.all('users').map((u) => ({ id: u.id, name: u.name, role: u.role, active: u.active !== false })).sort(byRoleThenName));
});

router.use(requirePerm('users:manage'));

router.get('/', (req, res) => {
  res.json(db.all('users').map(publicUser).sort(byRoleThenName));
});

function validateUser(body = {}, prev = null) {
  const errors = [];
  const name = String(body.name || '').trim();
  const username = String(body.username || '').trim().toLowerCase();
  // Disabled form fields aren't submitted → keep the previous value.
  const role = body.role ?? prev?.role;
  const active = body.active === undefined ? prev?.active !== false : !(body.active === false || body.active === 'false');
  const password = String(body.password || '');

  if (!name) errors.push('กรุณาระบุชื่อ - นามสกุล');
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    errors.push('ชื่อผู้ใช้ต้องเป็น a-z, 0-9, จุด, ขีด หรือขีดล่าง ความยาว 3–32 ตัวอักษร');
  } else if (db.find('users', (u) => u.username.toLowerCase() === username && u.id !== prev?.id).length) {
    errors.push('ชื่อผู้ใช้นี้ถูกใช้แล้ว');
  }
  if (!ROLES.includes(role)) errors.push('กรุณาเลือกบทบาท');
  if ((!prev || password) && password.length < 8) errors.push('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  if (errors.length) throw new HttpError(400, errors.join(' • '), errors);

  const data = { name: name.slice(0, 120), username, role, active };
  if (password) data.passwordHash = hashPassword(password);
  return data;
}

const otherActiveAdmins = (excludeId) =>
  db.find('users', (u) => u.role === 'admin' && u.active !== false && u.id !== excludeId).length;

const assignedCount = (userId) =>
  ['leads', 'walkins', 'bookings'].reduce((n, c) => n + db.find(c, (r) => r.assignedTo === userId).length, 0);

router.post('/', (req, res) => {
  const user = db.insert('users', { ...validateUser(req.body), tokenVersion: 0 });
  res.status(201).json(publicUser(user));
});

router.put('/:id', (req, res) => {
  const prev = db.get('users', req.params.id);
  if (!prev) throw new HttpError(404, 'ไม่พบผู้ใช้งาน');
  const data = validateUser(req.body, prev);
  const self = prev.id === req.user.id;

  if (self && (data.role !== prev.role || !data.active)) {
    throw new HttpError(409, 'ไม่สามารถเปลี่ยนบทบาทหรือปิดการใช้งานบัญชีของตนเองได้');
  }
  if (prev.role === 'admin' && (data.role !== 'admin' || !data.active) && !otherActiveAdmins(prev.id)) {
    throw new HttpError(409, 'ระบบต้องมี Admin ที่ใช้งานได้อย่างน้อย 1 บัญชี');
  }

  // Password/role change or deactivation signs the user out everywhere.
  const revoke = !!data.passwordHash || data.role !== prev.role || (prev.active !== false && !data.active);
  const user = db.update('users', prev.id, { ...data, tokenVersion: (prev.tokenVersion || 0) + (revoke ? 1 : 0) });
  if (self && revoke) setSession(res, user); // keep the editor signed in
  res.json(publicUser(user));
});

router.delete('/:id', (req, res) => {
  const user = db.get('users', req.params.id);
  if (!user) throw new HttpError(404, 'ไม่พบผู้ใช้งาน');
  if (user.id === req.user.id) throw new HttpError(409, 'ไม่สามารถลบบัญชีของตนเองได้');
  if (user.role === 'admin' && !otherActiveAdmins(user.id)) throw new HttpError(409, 'ระบบต้องมี Admin ที่ใช้งานได้อย่างน้อย 1 บัญชี');
  const count = assignedCount(user.id);
  if (count) {
    throw new HttpError(409, `ผู้ใช้นี้ยังรับผิดชอบลูกค้าอยู่ ${count} รายการ — แนะนำให้ "ปิดการใช้งาน" แทน หรือโอนลูกค้าให้คนอื่นก่อนลบ`);
  }
  db.remove('users', user.id);
  res.status(204).end();
});

module.exports = router;
