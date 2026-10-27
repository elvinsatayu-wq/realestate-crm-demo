import { initLayout } from '../core/layout.js';
import { api } from '../core/api.js';
import { onRangeChange, todayYMD } from '../core/date-filter.js';
import { createCrudForm, confirmDelete } from '../core/crud.js';
import { barChart } from '../core/charts.js';
import { icon } from '../core/icons.js';
import { can } from '../core/auth.js';
import {
  $, esc, fmt, badge, kpiCard, rowActions, sum, countBy, daysBetween, debounce, consumeParam,
  populateOptions, createTable, showError,
} from '../core/ui.js';

initLayout({ page: 'transfers', title: 'Transfer', subtitle: 'บันทึกการโอนกรรมสิทธิ์และสรุปผลสำเร็จของการขาย' });

const state = { rows: [], bookings: [] };
const transferForm = $('#transfer-form');
const bookingSelect = $('#booking-select');

const table = createTable($('#transfer-table'), {
  columns: [
    { label: 'วันที่โอน', render: (r) => `<span class="whitespace-nowrap">${fmt.date(r.date)}</span>` },
    {
      label: 'ลูกค้า',
      render: (r) => `<div class="font-medium text-slate-800 whitespace-nowrap">${esc(r.name)}</div><div class="text-xs text-slate-400 whitespace-nowrap">${esc(r.phone || '-')}</div>`,
    },
    {
      label: 'โครงการ / แปลง',
      render: (r) => `<div class="whitespace-nowrap">${esc(r.project)}</div><div class="text-xs text-slate-400">แปลง ${esc(r.plot)}</div>`,
    },
    { label: 'ราคาขาย', class: 'text-right', render: (r) => `<span class="tabular-nums whitespace-nowrap">${fmt.money(r.price)}</span>` },
    { label: 'ยอดโอนสุทธิ', class: 'text-right', render: (r) => `<span class="tabular-nums whitespace-nowrap font-semibold text-brand-900">${fmt.money(r.netAmount)}</span>` },
    {
      label: 'ธนาคาร',
      render: (r) => `<div class="whitespace-nowrap">${esc(r.bank || '-')}</div><div class="text-xs">${badge(r.paymentMethod, r.paymentMethod === 'เงินสด' ? 'emerald' : 'sky')}</div>`,
    },
    { label: 'Cash Back', class: 'text-right', render: (r) => `<span class="tabular-nums whitespace-nowrap">${r.cashBack ? fmt.money(r.cashBack) : '-'}</span>` },
    {
      label: 'จอง → โอน',
      class: 'text-right',
      render: (r) => (r.bookingDate ? `<span class="whitespace-nowrap text-slate-500">${fmt.num(daysBetween(r.bookingDate, r.date))} วัน</span>` : '-'),
    },
    { label: '', class: 'text-right', render: () => rowActions('', { edit: can('transfers:write'), remove: can('transfers:delete') }) },
  ],
  footer: (rows) => `
    <tr>
      <td colspan="3">รวม ${fmt.num(rows.length)} รายการ</td>
      <td class="text-right tabular-nums whitespace-nowrap">${fmt.money(sum(rows, 'price'))}</td>
      <td class="text-right tabular-nums whitespace-nowrap">${fmt.money(sum(rows, 'netAmount'))}</td>
      <td></td>
      <td class="text-right tabular-nums whitespace-nowrap">${fmt.money(sum(rows, 'cashBack'))}</td>
      <td colspan="2"></td>
    </tr>`,
  actions: {
    edit: (id, row) => openTransfer(row),
    delete: (id, row) =>
      confirmDelete({
        resource: 'transfers',
        id,
        name: `${row.name} · ${row.project} แปลง ${row.plot}`,
        afterDelete: load,
      }),
  },
});

const form = createCrudForm({
  resource: 'transfers',
  modal: $('#transfer-modal'),
  form: transferForm,
  titles: { create: 'บันทึกการโอนกรรมสิทธิ์', edit: 'แก้ไขการโอนกรรมสิทธิ์' },
  defaults: () => ({ date: todayYMD(), cashBack: 0 }),
  afterSave: load,
});

/* ---------- Booking selection ---------- */
const bookingLabel = (b) => `${b.name} — ${b.project} แปลง ${b.plot} (จอง ${fmt.date(b.date)})`;

function populateBookingSelect(currentId) {
  const choices = state.bookings.filter((b) => b.status === 'จองแล้ว' || b.id === currentId);
  bookingSelect.innerHTML =
    `<option value="">${choices.length ? '— เลือกรายการจอง —' : 'ไม่มีรายการจองที่รอโอน'}</option>` +
    choices.map((b) => `<option value="${esc(b.id)}">${esc(bookingLabel(b))}</option>`).join('');
}

function renderBookingInfo({ suggest = false } = {}) {
  const box = $('#booking-info');
  const booking = state.bookings.find((b) => b.id === bookingSelect.value);
  if (!booking) {
    box.innerHTML = '<p class="text-slate-400">เลือกรายการจองเพื่อดึงข้อมูลโครงการ แปลง และราคามาแสดง</p>';
    return;
  }
  const item = (label, value) => `<div><dt class="text-xs text-slate-400">${label}</dt><dd class="font-medium text-slate-800">${value}</dd></div>`;
  box.innerHTML = `
    <p class="mb-3 flex items-center gap-1.5 text-xs font-semibold text-brand-700">${icon('bookings', 'w-4 h-4')} ข้อมูลจากรายการจอง</p>
    <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      ${item('ลูกค้า', esc(booking.name))}
      ${item('โครงการ', esc(booking.project))}
      ${item('แปลง', esc(booking.plot))}
      ${item('ราคาแปลง', fmt.money(booking.price))}
      ${item('เงินจอง', fmt.money(booking.deposit))}
      ${item('วิธีการซื้อ', esc(booking.paymentMethod))}
    </dl>`;

  // New transfer: pre-fill the expected net amount (price − deposit) and cash bank.
  if (suggest) {
    const f = transferForm.elements;
    f.netAmount.value = Math.max(0, (booking.price || 0) - (booking.deposit || 0));
    if (booking.paymentMethod === 'เงินสด' && !f.bank.value) f.bank.value = 'เงินสด (ไม่ใช้สินเชื่อ)';
  }
}

bookingSelect.addEventListener('change', () => renderBookingInfo({ suggest: !transferForm.dataset.editId }));

async function openTransfer(record, bookingId = '') {
  try {
    state.bookings = await api.list('bookings', { ranged: false });
    populateBookingSelect(record?.bookingId || bookingId);
    form.open(record, { bookingId });
    renderBookingInfo({ suggest: !record && !!bookingId });
  } catch (err) {
    showError(err);
  }
}

/* ---------- Page ---------- */
function renderPending() {
  const pending = state.bookings.filter((b) => b.status === 'จองแล้ว').sort((a, b) => a.date.localeCompare(b.date));
  $('#pending-count').innerHTML = badge(`${fmt.num(pending.length)} รายการ`, pending.length ? 'gold' : 'slate');
  $('#pending-list').innerHTML = pending.length
    ? pending
        .map(
          (b) => `
      <li class="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-slate-800">${esc(b.name)}</p>
          <p class="truncate text-xs text-slate-400">${esc(b.project)} · ${esc(b.plot)} · จองมาแล้ว ${fmt.num(daysBetween(b.date, todayYMD()))} วัน</p>
        </div>
        <button type="button" class="btn btn-soft btn-sm" data-transfer="${esc(b.id)}">บันทึกโอน</button>
      </li>`,
        )
        .join('')
    : '<li class="px-2 py-8 text-center text-sm text-slate-400">ไม่มีรายการรอโอน 🎉</li>';
}

$('#pending-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-transfer]');
  if (btn) openTransfer(null, btn.dataset.transfer);
});

function renderKpis() {
  const { rows, bookings } = state;
  const active = bookings.filter((b) => b.status !== 'ยกเลิก');
  const transferred = active.filter((b) => b.status === 'โอนแล้ว').length;
  const avgDays = rows.length ? Math.round(rows.reduce((s, r) => s + daysBetween(r.bookingDate || r.date, r.date), 0) / rows.length) : 0;
  $('#kpis').innerHTML = [
    kpiCard({ label: 'จำนวนรายการโอน', value: fmt.num(rows.length), hint: 'ในช่วงเวลาที่เลือก', icon: 'transfers' }),
    kpiCard({ label: 'ยอดโอนสุทธิรวม', value: fmt.million(sum(rows, 'netAmount')), hint: `ราคาขายรวม ${fmt.million(sum(rows, 'price'))}`, tone: 'gold', icon: 'banknotes' }),
    kpiCard({ label: 'Cash Back รวม', value: fmt.million(sum(rows, 'cashBack')), hint: 'เงินเหลือคืนลูกค้า', tone: 'violet', icon: 'banknotes' }),
    kpiCard({ label: 'เฉลี่ย จอง → โอน', value: `${fmt.num(avgDays)} วัน`, hint: 'ของรายการในช่วงนี้', tone: 'sky', icon: 'clock' }),
    kpiCard({ label: 'อัตราโอนสำเร็จ (สะสม)', value: fmt.pct(transferred, active.length), hint: `${fmt.num(transferred)} จาก ${fmt.num(active.length)} การจอง`, tone: 'emerald', icon: 'check' }),
  ].join('');
}

function renderCharts() {
  const { rows } = state;
  const banks = countBy(rows, 'bank');
  barChart('chart-bank', banks, { horizontal: true, label: 'รายการ' });
  const projects = [...new Set(rows.map((r) => r.project))];
  barChart(
    'chart-project',
    { labels: projects, data: projects.map((p) => sum(rows.filter((r) => r.project === p), 'netAmount')) },
    { money: true, label: 'ยอดโอน' },
  );
}

function applyFilters() {
  const q = $('#filter-q').value.trim().toLowerCase();
  table.setRows(state.rows.filter((r) => !q || [r.name, r.phone, r.project, r.plot, r.bank].some((v) => (v || '').toLowerCase().includes(q))));
}

async function load() {
  try {
    [state.rows, state.bookings] = await Promise.all([api.list('transfers'), api.list('bookings', { ranged: false })]);
    renderKpis();
    renderCharts();
    renderPending();
    applyFilters();
  } catch (err) {
    showError(err);
  }
}

async function init() {
  const options = await api.options();
  populateOptions(document, options);

  $('#filter-q').addEventListener('input', debounce(applyFilters));
  $('[data-new]')?.addEventListener('click', () => openTransfer(null));
  onRangeChange(load);

  await load();

  // Arrived from Booking page ("โอนกรรมสิทธิ์ →") → open with that booking selected.
  const bookingId = consumeParam('bookingId');
  if (bookingId) openTransfer(null, bookingId);
  else if (consumeParam('new')) openTransfer(null);
}

init().catch(showError);
