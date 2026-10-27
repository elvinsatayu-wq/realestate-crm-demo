/**
 * Sample data generator. Dates are relative to today so the dashboard always has
 * recent activity. Run `npm run seed` to wipe data/db.json and regenerate.
 */
const crypto = require('crypto');
const { OPTIONS } = require('./schemas');
const { defaultUsers, printDefaultAccounts } = require('./users');

// Deterministic PRNG so every reseed produces the same dataset
function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'สมชาย', 'สมหญิง', 'ณัฐวุฒิ', 'พิมพ์ชนก', 'ธนากร', 'กัญญารัตน์', 'วรวุฒิ', 'ศิริพร', 'ภูมิพัฒน์', 'อรอุมา',
  'ชยพล', 'ปวีณา', 'กิตติพงษ์', 'นภัสสร', 'อนุชา', 'สุธิดา', 'ธีรเดช', 'จิราพร', 'พงศกร', 'รัชนี',
];
const LAST_NAMES = [
  'ศรีสุข', 'วงศ์ใหญ่', 'ทองดี', 'แสงอรุณ', 'บุญมา', 'จันทร์เพ็ญ', 'รัตนพงษ์', 'เจริญผล', 'สุวรรณศรี',
  'พิทักษ์ชน', 'มหาวงศ์', 'ประเสริฐกุล',
];
const DISTRICTS = ['บางนา', 'ประเวศ', 'สวนหลวง', 'ลาดกระบัง', 'พระโขนง', 'บางกะปิ', 'วัฒนา', 'บางพลี', 'มีนบุรี', 'ปทุมวัน', 'สาทร', 'คลองเตย'];
const ROUTES = ['ถนนบางนา-ตราด', 'มอเตอร์เวย์', 'ถนนศรีนครินทร์', 'ถนนกาญจนาภิเษก', 'ทางด่วนบูรพาวิถี', 'ถนนเทพรัตน'];
const LEAD_NOTES = [
  'สนใจบ้านเดี่ยว 4 ห้องนอน ขอโบรชัวร์',
  'สอบถามโปรโมชันเดือนนี้ และค่าส่วนกลาง',
  'ต้องการบ้านใกล้โรงเรียนนานาชาติ',
  'ขอนัดชมบ้านตัวอย่างวันเสาร์',
  'สอบถามเงื่อนไขการผ่อนดาวน์',
  'ติดต่อกลับช่วงเย็นหลัง 18:00',
];
const VISIT_NOTES = [
  'ชอบแบบบ้านหลังมุม ขอใบเสนอราคา',
  'มากับครอบครัว ให้ความสำคัญกับพื้นที่สวน',
  'เปรียบเทียบกับโครงการคู่แข่งในย่านเดียวกัน',
  'ต้องการปรึกษาเรื่องสินเชื่อเพิ่มเติม',
  'สนใจแปลงติดสวนส่วนกลาง',
];

function generateSeedData({ days = 180, seed = 20261027 } = {}) {
  const rand = mulberry32(seed);
  const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const chance = (p) => rand() < p;
  const weighted = (entries) => {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [value, w] of entries) if ((r -= w) < 0) return value;
    return entries[entries.length - 1][0];
  };
  const subset = (list, min, max) => {
    const shuffled = [...list].sort(() => rand() - 0.5);
    return shuffled.slice(0, int(min, max));
  };

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const today = ymd(base);
  const daysAgo = (n) => {
    const d = new Date(base);
    d.setDate(d.getDate() - n);
    return ymd(d);
  };
  const addDays = (date, n) => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + n);
    const out = ymd(d);
    return out > today ? today : out;
  };
  const stamp = (date) => new Date(`${date}T10:00:00`).toISOString();
  const meta = (date) => ({ id: crypto.randomUUID(), createdAt: stamp(date), updatedAt: stamp(date) });
  const person = () => ({
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    phone: `08${int(1, 9)}-${int(100, 999)}-${int(1000, 9999)}`,
    lineId: chance(0.7) ? `line_${int(1000, 99999)}` : '',
  });

  const users = defaultUsers();
  const salesUsers = users.filter((u) => u.role === 'sales');

  const leads = Array.from({ length: 120 }, () => {
    const date = daysAgo(int(0, days));
    return {
      ...meta(date),
      date,
      assignedTo: pick(salesUsers).id,
      ...person(),
      channel: weighted([['Facebook', 40], ['Instagram', 22], ['Website', 25], ['Call in', 13]]),
      budget: weighted(OPTIONS.budgets.map((b, i) => [b, [18, 30, 26, 16, 10][i]])),
      detail: pick(LEAD_NOTES),
      status: weighted([['นัดหมายเข้าชม', 28], ['สอบถามรายละเอียด', 32], ['ติดต่อไม่ได้', 12], ['ไม่รับสาย', 14], ['ไม่สนใจ', 14]]),
    };
  });

  const walkins = Array.from({ length: 90 }, () => {
    const date = daysAgo(int(0, days));
    const owner = pick(salesUsers);
    return {
      ...meta(date),
      date,
      time: `${pad(int(9, 17))}:${pick(['00', '15', '30', '45'])}`,
      media: weighted([['Facebook', 30], ['Instagram', 15], ['Website', 20], ['ป้ายบอกทาง', 20], ['บิลบอร์ด', 15]]),
      ...person(),
      budget: weighted(OPTIONS.budgets.map((b, i) => [b, [15, 28, 28, 18, 11][i]])),
      gender: weighted([['ชาย', 46], ['หญิง', 46], ['LGBTQ', 8]]),
      age: int(26, 64),
      occupation: weighted(OPTIONS.occupations.map((o, i) => [o, [30, 32, 10, 8, 14, 6][i]])),
      income: int(4, 45) * 10000,
      residents: int(1, 6),
      reasons: subset(OPTIONS.visitReasons, 1, 3),
      route: pick(ROUTES),
      homeDistrict: pick(DISTRICTS),
      workDistrict: pick(DISTRICTS),
      promotions: subset(OPTIONS.promotions, 0, 2),
      detail: pick(VISIT_NOTES),
      grade: weighted([['A', 18], ['B', 30], ['C', 34], ['D', 18]]),
      salesperson: owner.name,
      assignedTo: owner.id,
    };
  });

  const bookings = walkins
    .filter((w) => w.grade === 'A' || (w.grade === 'B' && chance(0.35)))
    .map((w) => {
      const date = addDays(w.date, int(0, 10));
      const price = int(80, 260) * 100000;
      return {
        ...meta(date),
        date,
        walkinId: w.id,
        name: w.name,
        phone: w.phone,
        project: pick(OPTIONS.projects),
        plot: `${pick(['A', 'B', 'C'])}-${pad(int(1, 48))}`,
        price,
        deposit: pick([50000, 100000, 200000]),
        paymentMethod: weighted([['ขอสินเชื่อ', 75], ['เงินสด', 25]]),
        status: chance(0.07) ? 'ยกเลิก' : 'จองแล้ว',
        note: '',
        assignedTo: w.assignedTo,
      };
    });

  // Roughly 3 in 4 bookings older than 40 days have completed their transfer.
  const transfers = bookings
    .filter((b) => b.status === 'จองแล้ว' && b.date <= daysAgo(40))
    .filter((b, i) => i % 4 !== 3)
    .map((b) => {
      b.status = 'โอนแล้ว';
      const date = addDays(b.date, int(30, 60));
      const loan = b.paymentMethod === 'ขอสินเชื่อ';
      return {
        ...meta(date),
        date,
        bookingId: b.id,
        netAmount: b.price - b.deposit - int(0, 4) * 50000,
        bank: loan ? pick(OPTIONS.banks.slice(0, -1)) : OPTIONS.banks[OPTIONS.banks.length - 1],
        cashBack: loan && chance(0.6) ? int(1, 8) * 50000 : 0,
        note: '',
        name: b.name,
        phone: b.phone,
        project: b.project,
        plot: b.plot,
        price: b.price,
        deposit: b.deposit,
        paymentMethod: b.paymentMethod,
        bookingDate: b.date,
        assignedTo: b.assignedTo,
      };
    });

  return { users, leads, walkins, bookings, transfers };
}

module.exports = { generateSeedData };

if (require.main === module) {
  const db = require('./db');
  const data = generateSeedData();
  db.reset(data);
  const summary = Object.entries(data).map(([k, v]) => `${k}: ${v.length}`).join(', ');
  console.log(`Seeded sample data → ${summary}`);
  printDefaultAccounts();
}
