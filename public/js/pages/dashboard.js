import { initLayout } from '../core/layout.js';
import { api } from '../core/api.js';
import { onRangeChange, syncLinks, withRange } from '../core/date-filter.js';
import { doughnutChart, lineChart, GRADE_COLORS, STAGE_COLORS } from '../core/charts.js';
import { icon } from '../core/icons.js';
import { $, esc, fmt, badge, createTable, showError, toast, consumeParam } from '../core/ui.js';
import { can, currentUser, roleLabel, ROLE_TONES } from '../core/auth.js';

initLayout({ page: 'dashboard', title: 'Dashboard', subtitle: 'ภาพรวมระบบ Lead → Walk In → Book → Transfer' });

const STAGES = [
  { key: 'leads', label: 'Lead', desc: 'ลูกค้าเป้าหมาย', href: '/leads', icon: 'leads', accent: 'from-blue-500 to-blue-600' },
  { key: 'walkins', label: 'Walk In', desc: 'เข้าชมโครงการ', href: '/walkins', icon: 'walkins', accent: 'from-teal-500 to-teal-600' },
  { key: 'bookings', label: 'Book', desc: 'การจอง', href: '/bookings', icon: 'bookings', accent: 'from-gold-400 to-gold-600' },
  { key: 'transfers', label: 'Transfer', desc: 'โอนกรรมสิทธิ์', href: '/transfers', icon: 'transfers', accent: 'from-brand-700 to-brand-900' },
];
const BOOKING_TONES = { จองแล้ว: 'gold', โอนแล้ว: 'emerald', ยกเลิก: 'rose' };

// Sections removed by data-perm have no container → no table.
const recentTable = $('#recent-table') && createTable($('#recent-table'), {
  pageSize: 6,
  emptyText: 'ยังไม่มีการจองในช่วงเวลาที่เลือก',
  columns: [
    { label: 'วันที่จอง', render: (r) => `<span class="whitespace-nowrap">${fmt.date(r.date)}</span>` },
    { label: 'ลูกค้า', render: (r) => `<span class="font-medium text-slate-800 whitespace-nowrap">${esc(r.name)}</span>` },
    { label: 'โครงการ / แปลง', render: (r) => `<span class="whitespace-nowrap">${esc(r.project)} · ${esc(r.plot)}</span>` },
    { label: 'ราคาแปลง', class: 'text-right', render: (r) => `<span class="tabular-nums whitespace-nowrap">${fmt.money(r.price)}</span>` },
    { label: 'วิธีการซื้อ', render: (r) => badge(r.paymentMethod, r.paymentMethod === 'เงินสด' ? 'emerald' : 'sky') },
    { label: 'สถานะ', render: (r) => badge(r.status, BOOKING_TONES[r.status]) },
  ],
});

const num = (v) => `<span class="tabular-nums">${fmt.num(v)}</span>`;
const teamTable = $('#team-table') && createTable($('#team-table'), {
  pageSize: 20,
  emptyText: 'ยังไม่มีข้อมูลในช่วงเวลาที่เลือก',
  columns: [
    {
      label: 'ผู้รับผิดชอบ',
      render: (r) =>
        r.id
          ? `<div class="flex items-center gap-2 whitespace-nowrap"><span class="font-medium text-slate-800">${esc(r.name)}</span>${r.role ? badge(roleLabel(r.role), ROLE_TONES[r.role]) : ''}${r.active ? '' : badge('ปิดใช้งาน', 'slate')}</div>`
          : `<span class="whitespace-nowrap font-medium text-amber-700">${esc(r.name)}</span>`,
    },
    { label: 'Lead', class: 'text-right', render: (r) => num(r.leads) },
    { label: 'Walk In', class: 'text-right', render: (r) => num(r.walkins) },
    { label: 'Grade A', class: 'text-right', render: (r) => num(r.gradeA) },
    { label: 'จอง', class: 'text-right', render: (r) => num(r.bookings) },
    { label: 'โอน', class: 'text-right', render: (r) => num(r.transfers) },
    { label: 'ยอดโอนสุทธิ', class: 'text-right', render: (r) => `<span class="tabular-nums whitespace-nowrap font-semibold text-brand-900">${fmt.money(r.transferValue)}</span>` },
    { label: 'Walk In → จอง', class: 'text-right', render: (r) => `<span class="tabular-nums text-slate-500">${fmt.pct(r.bookings, r.walkins)}</span>` },
  ],
});

function renderHero(d) {
  $('#greeting').textContent = `สวัสดี, ${currentUser.name}`;
  if (!$('#hero-values')) return;
  const item = (label, value) => `<div><p class="text-xs text-brand-200">${label}</p><p class="text-lg font-semibold tabular-nums">${value}</p></div>`;
  $('#hero-values').innerHTML = [
    item('มูลค่าการจอง', fmt.million(d.value.booking)),
    item('ยอดโอนสุทธิ', fmt.million(d.value.transfer)),
    item('เงินจองรับแล้ว', fmt.million(d.value.deposit)),
    item('Cash Back', fmt.million(d.value.cashBack)),
  ].join('');
}

function renderSummary(d) {
  const extra = {
    leads: '',
    walkins: '',
    bookings: `มูลค่า ${fmt.million(d.value.booking)}${d.value.cancelled ? ` · ยกเลิก ${fmt.num(d.value.cancelled)}` : ''}`,
    transfers: `ยอดโอน ${fmt.million(d.value.transfer)} · รอโอน ${fmt.num(d.pendingTransfer)}`,
  };
  $('#summary').innerHTML = STAGES.map((s) => {
    const value = s.key === 'bookings' ? d.inRange.activeBookings : d.inRange[s.key];
    return `
      <div class="card group relative overflow-hidden p-5">
        <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.accent}"></div>
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-slate-500">จำนวน ${s.label} <span class="text-slate-400">· ${s.desc}</span></p>
            <p class="mt-2 text-3xl font-semibold tabular-nums text-slate-900">${fmt.num(value)}</p>
          </div>
          <div class="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${s.accent} text-white shadow-md">${icon(s.icon, 'w-5 h-5')}</div>
        </div>
        <p class="mt-1 text-xs text-slate-400">สะสมทั้งหมด <span class="font-medium text-slate-600">${fmt.num(d.totals[s.key])}</span> รายการ</p>
        ${extra[s.key] ? `<p class="mt-0.5 text-xs text-slate-400 truncate">${extra[s.key]}</p>` : ''}
        ${
          can(`${s.key}:read`)
            ? `<a data-range-link="${s.href}" href="${withRange(s.href)}" class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-800">
                ดูรายการ ${s.label} ${icon('arrowRight', 'w-4 h-4 transition-transform group-hover:translate-x-0.5')}
              </a>`
            : ''
        }
      </div>`;
  }).join('');
}

function renderFunnel(d) {
  const counts = { ...d.inRange, bookings: d.inRange.activeBookings };
  const max = Math.max(1, ...STAGES.map((s) => counts[s.key]));
  $('#funnel').innerHTML = STAGES.map((s, i) => {
    const value = counts[s.key];
    const prev = i ? counts[STAGES[i - 1].key] : null;
    return `
      <div>
        <div class="mb-1.5 flex items-baseline justify-between text-sm">
          <span class="font-medium text-slate-700">${s.label}</span>
          <span class="tabular-nums text-slate-900 font-semibold">${fmt.num(value)}
            ${prev !== null ? `<span class="ml-1 text-xs font-normal text-slate-400">(${fmt.pct(value, prev)} จาก ${STAGES[i - 1].label})</span>` : ''}
          </span>
        </div>
        <div class="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full transition-all duration-500" style="width:${(value / max) * 100}%;background:${STAGE_COLORS[s.key]}"></div>
        </div>
      </div>`;
  }).join('') + `
    <div class="mt-2 rounded-xl bg-brand-50 p-3 text-sm">
      <p class="text-xs text-brand-700">อัตราปิดการขาย (Lead → Transfer)</p>
      <p class="text-xl font-semibold text-brand-900 tabular-nums">${fmt.pct(counts.transfers, counts.leads)}</p>
    </div>`;
}

function trendLabel(key, granularity) {
  const date = new Date(granularity === 'month' ? `${key}-01T00:00:00` : `${key}T00:00:00`);
  return granularity === 'month'
    ? date.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })
    : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function renderCharts(d) {
  const { trend } = d;
  $('#trend-sub').textContent = trend.granularity === 'month' ? 'จำนวนรายการรายเดือน' : 'จำนวนรายการรายวัน';
  lineChart('chart-trend', {
    labels: trend.labels.map((k) => trendLabel(k, trend.granularity)),
    datasets: STAGES.map((s) => ({ label: s.label, data: trend.series[s.key] || [], color: STAGE_COLORS[s.key] })),
  });
  doughnutChart('chart-lead-channel', d.leadChannels);
  doughnutChart(
    'chart-grade',
    { labels: d.walkinGrades.labels.map((g) => `Grade ${g}`), data: d.walkinGrades.data },
    { colors: d.walkinGrades.labels.map((g) => GRADE_COLORS[g]) },
  );
}

function renderShortcuts() {
  const shortcuts = [
    { label: 'เพิ่ม Lead', href: '/leads?new=1', icon: 'leads', perm: 'leads:write' },
    { label: 'บันทึก Walk In', href: '/walkins?new=1', icon: 'walkins', perm: 'walkins:write' },
    { label: 'บันทึกการจอง', href: '/bookings?new=1', icon: 'bookings', perm: 'bookings:write' },
    { label: 'บันทึกการโอน', href: '/transfers?new=1', icon: 'transfers', perm: 'transfers:write' },
    { label: 'จัดการผู้ใช้งาน', href: '/users', icon: 'users', perm: 'users:manage' },
  ].filter((s) => can(s.perm));
  $('#shortcuts').innerHTML = shortcuts
    .map(
      (s) => `
      <a data-range-link="${s.href}" href="${withRange(s.href)}"
         class="flex flex-col items-start gap-2 rounded-xl border border-slate-200 p-4 transition hover:border-gold-400 hover:bg-gold-50/50">
        <span class="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">${icon(s.icon, 'w-5 h-5')}</span>
        <span class="text-sm font-medium text-slate-700">${s.label}</span>
      </a>`,
    )
    .join('');
}

async function load() {
  try {
    const data = await api.dashboard();
    renderHero(data);
    renderSummary(data);
    renderFunnel(data);
    renderCharts(data);
    recentTable?.setRows(data.recentBookings);
    if (data.team) teamTable?.setRows(data.team);
    syncLinks();
  } catch (err) {
    showError(err);
  }
}

// Redirected here by the server after opening a page without permission.
if (consumeParam('denied')) toast('คุณไม่มีสิทธิ์เข้าถึงหน้าดังกล่าว', 'error');
renderShortcuts();
onRangeChange(load);
load();
