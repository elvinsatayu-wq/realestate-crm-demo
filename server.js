const path = require('path');
const express = require('express');

const db = require('./src/db');
const { generateSeedData } = require('./src/seed');
const { ensureDefaultUsers, migrateAssignments } = require('./src/users');
const { authenticate, requireAuth, can } = require('./src/auth');
const authRouter = require('./src/routes/auth');
const apiRouter = require('./src/routes/api');

const PORT = Number(process.env.PORT) || 3000;

// First run (or DB_MODE=memory) starts with generated sample data.
db.init(generateSeedData);
ensureDefaultUsers();
migrateAssignments();

// Page → permission needed to open it (null = any signed-in user).
const PAGES = {
  '/': null,
  '/leads': 'leads:read',
  '/walkins': 'walkins:read',
  '/bookings': 'bookings:read',
  '/transfers': 'transfers:read',
  '/users': 'users:manage',
};

const app = express();
app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));
app.use(authenticate);

app.use('/api/auth', authRouter);
app.use('/api', requireAuth, apiRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ API ที่ร้องขอ' }));

// Signed-in users skip the login page.
app.get(['/login', '/login.html'], (req, res, next) => (req.user ? res.redirect('/') : next()));

// Guard HTML pages: not signed in → login; signed in without permission → dashboard.
app.get('*', (req, res, next) => {
  const page = req.path.replace(/\.html$/, '').replace(/^\/index$/, '/');
  if (!(page in PAGES)) return next();
  if (!req.user) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  if (PAGES[page] && !can(req.user, PAGES[page])) return res.redirect('/?denied=1');
  next();
});

// `extensions` lets /leads serve public/leads.html
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'เกิดข้อผิดพลาดภายในระบบ' : err.message,
    details: err.details,
  });
});

app.listen(PORT, () => {
  console.log(`Real Estate CRM running at http://localhost:${PORT} (storage: ${db.mode})`);
});
