const express = require('express');
const db = require('../db');
const { OPTIONS } = require('../schemas');
const { inRange, byDateDesc, isVisible } = require('./resource');
const { can } = require('../auth');

const RECORDS = ['leads', 'walkins', 'bookings', 'transfers'];

const DAY_MS = 86400000;

const pad = (n) => String(n).padStart(2, '0');
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const sum = (list, key) => list.reduce((total, r) => total + (Number(r[key]) || 0), 0);

function countBy(list, key, order) {
  const counts = new Map(order.map((o) => [typeof o === 'string' ? o : o.value, 0]));
  for (const r of list) {
    if (r[key]) counts.set(r[key], (counts.get(r[key]) || 0) + 1);
  }
  return { labels: [...counts.keys()], data: [...counts.values()] };
}

/** Daily buckets for ranges up to ~2 months, monthly buckets beyond that. */
function buildTrend(ranged, from, to) {
  const dates = Object.values(ranged).flat().map((r) => r.date).filter(Boolean).sort();
  const today = todayYMD();
  const start = from || dates[0] || today;
  const end = to || (dates.length && dates[dates.length - 1] > today ? dates[dates.length - 1] : today);
  if (start > end) return { granularity: 'day', labels: [], series: {} };

  const monthly = (Date.parse(end) - Date.parse(start)) / DAY_MS + 1 > 62;
  const keyOf = (date) => (monthly ? date.slice(0, 7) : date);

  const labels = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (monthly) cursor.setUTCDate(1);
  while (cursor <= last) {
    labels.push(cursor.toISOString().slice(0, monthly ? 7 : 10));
    if (monthly) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const series = {};
  for (const [name, list] of Object.entries(ranged)) {
    const counts = Object.fromEntries(labels.map((k) => [k, 0]));
    for (const r of list) {
      const key = keyOf(r.date);
      if (key in counts) counts[key] += 1;
    }
    series[name] = labels.map((k) => counts[k]);
  }
  return { granularity: monthly ? 'month' : 'day', labels, series };
}

/** Per-person performance for Admin/Manager; unassigned records get their own row. */
function buildTeam(ranged) {
  const users = db.all('users');
  const rows = new Map();
  const row = (id = '') => {
    if (!rows.has(id)) {
      const u = users.find((x) => x.id === id);
      rows.set(id, {
        id,
        name: u ? u.name : id ? 'ผู้ใช้ที่ถูกลบ' : 'ยังไม่มอบหมาย',
        role: u?.role || '',
        active: u ? u.active !== false : false,
        leads: 0, walkins: 0, gradeA: 0, bookings: 0, transfers: 0, transferValue: 0,
      });
    }
    return rows.get(id);
  };
  users.filter((u) => u.role === 'sales' && u.active !== false).forEach((u) => row(u.id));
  ranged.leads.forEach((r) => { row(r.assignedTo).leads += 1; });
  ranged.walkins.forEach((r) => {
    const x = row(r.assignedTo);
    x.walkins += 1;
    if (r.grade === 'A') x.gradeA += 1;
  });
  ranged.bookings.filter((b) => b.status !== 'ยกเลิก').forEach((r) => { row(r.assignedTo).bookings += 1; });
  ranged.transfers.forEach((r) => {
    const x = row(r.assignedTo);
    x.transfers += 1;
    x.transferValue += Number(r.netAmount) || 0;
  });
  return [...rows.values()].sort((a, b) => b.transferValue - a.transferValue || b.bookings - a.bookings || b.walkins - a.walkins);
}

const router = express.Router();

// GET /api/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD — scoped to what the user may see.
router.get('/', (req, res) => {
  const { from = '', to = '' } = req.query;
  const all = Object.fromEntries(RECORDS.map((name) => [name, db.find(name, (r) => isVisible(req.user, r))]));
  const ranged = Object.fromEntries(
    Object.entries(all).map(([name, list]) => [name, list.filter((r) => inRange(r.date, from, to))]),
  );
  const activeBookings = ranged.bookings.filter((b) => b.status !== 'ยกเลิก');
  const count = (source) => Object.fromEntries(Object.entries(source).map(([k, v]) => [k, v.length]));

  res.json({
    range: { from, to },
    totals: count(all),
    inRange: { ...count(ranged), activeBookings: activeBookings.length },
    value: {
      booking: sum(activeBookings, 'price'),
      deposit: sum(activeBookings, 'deposit'),
      transfer: sum(ranged.transfers, 'netAmount'),
      cashBack: sum(ranged.transfers, 'cashBack'),
      cancelled: ranged.bookings.length - activeBookings.length,
    },
    pendingTransfer: all.bookings.filter((b) => b.status === 'จองแล้ว').length,
    trend: buildTrend(ranged, from, to),
    leadChannels: countBy(ranged.leads, 'channel', OPTIONS.leadChannels),
    leadStatuses: countBy(ranged.leads, 'status', OPTIONS.leadStatuses),
    walkinGrades: countBy(ranged.walkins, 'grade', OPTIONS.grades),
    recentBookings: can(req.user, 'bookings:read') ? [...ranged.bookings].sort(byDateDesc).slice(0, 6) : [],
    team: can(req.user, 'team:view') ? buildTeam(ranged) : null,
  });
});

module.exports = router;
