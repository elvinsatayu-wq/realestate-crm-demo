/** Default accounts and one-off data migrations for the auth/assignment feature. */
const crypto = require('crypto');
const db = require('./db');
const { OPTIONS } = require('./schemas');
const { hashPassword } = require('./auth');

// ⚠ Demo credentials — change them after the first login (Admin → ผู้ใช้งาน).
const DEFAULT_ACCOUNTS = [
  { username: 'admin', name: 'ผู้ดูแลระบบ', role: 'admin', password: 'admin1234' },
  { username: 'manager', name: 'คุณมานพ หัวหน้าทีมขาย', role: 'manager', password: 'manager1234' },
  ...OPTIONS.salesTeam.map((name, i) => ({ username: `sales${i + 1}`, name, role: 'sales', password: 'sales1234' })),
];

function buildUser({ password, ...fields }) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ...fields,
    active: true,
    tokenVersion: 0,
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };
}

const defaultUsers = () => DEFAULT_ACCOUNTS.map(buildUser);

function printDefaultAccounts() {
  console.log('\nสร้างบัญชีผู้ใช้เริ่มต้นแล้ว (กรุณาเปลี่ยนรหัสผ่านหลังเข้าสู่ระบบ):');
  console.table(DEFAULT_ACCOUNTS.map(({ username, password, role, name }) => ({ username, password, role, name })));
}

function ensureDefaultUsers() {
  if (db.all('users').length) return;
  db.replaceAll('users', defaultUsers());
  printDefaultAccounts();
}

/**
 * Records created before assignments existed get an `assignedTo` user id:
 * walk-ins by matching their salesperson name, bookings/transfers from their source.
 * Leads had no owner, so they start unassigned (Admin/Manager can assign them).
 */
function migrateAssignments() {
  const fill = (name, owner) => {
    const list = db.all(name);
    if (list.every((r) => r.assignedTo !== undefined)) return;
    db.replaceAll(name, list.map((r) => (r.assignedTo !== undefined ? r : { ...r, assignedTo: owner(r) })));
  };
  const byName = new Map(db.all('users').map((u) => [u.name, u.id]));
  fill('leads', () => '');
  fill('walkins', (r) => byName.get(r.salesperson) || '');
  const walkins = new Map(db.all('walkins').map((w) => [w.id, w]));
  fill('bookings', (r) => walkins.get(r.walkinId)?.assignedTo || '');
  const bookings = new Map(db.all('bookings').map((b) => [b.id, b]));
  fill('transfers', (r) => bookings.get(r.bookingId)?.assignedTo || '');
}

module.exports = { defaultUsers, printDefaultAccounts, ensureDefaultUsers, migrateAssignments };
