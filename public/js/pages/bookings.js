import { initLayout } from '../core/layout.js';
import { api } from '../core/api.js';
import { onRangeChange, todayYMD, withRange } from '../core/date-filter.js';
import { createCrudForm, confirmDelete } from '../core/crud.js';
import { icon } from '../core/icons.js';
import { can, populateAssignees, assigneeCell } from '../core/auth.js';
import {
  $, $$, esc, fmt, badge, kpiCard, rowActions, sum, debounce, consumeParam,
  populateOptions, createTable, showError, openModal, closeModal, toast, GRADE_TONES,
} from '../core/ui.js';

initLayout({ page: 'bookings', title: 'Booking', subtitle: 'บันทึกการจองแปลงและติดตามสถานะจนถึงการโอนกรรมสิทธิ์' });

const BOOKING_TONES = { จองแล้ว: 'gold', โอนแล้ว: 'emerald', ยกเลิก: 'rose' };

const state = { rows: [], walkins: null };
const filters = { q: $('#filter-q'), status: $('#filter-status'), payment: $('#filter-payment') };
const bookingForm = $('#booking-form');
const picker = $('#walkin-picker');

function nextStepCell(r) {
  if (r.status === 'จองแล้ว' && can('transfers:write')) {
    const href = `/transfers?bookingId=${encodeURIComponent(r.id)}`;
    return `<a class="btn btn-gold btn-sm" data-range-link="${href}" href="${withRange(href)}">โอนกรรมสิทธิ์ ${icon('arrowRight', 'w-3.5 h-3.5')}</a>`;
  }
  if (r.status === 'โอนแล้ว') {
    return `<a class="btn btn-soft btn-sm" data-range-link="/transfers" href="${withRange('/transfers')}">${icon('check', 'w-3.5 h-3.5')} ดูการโอน</a>`;
  }
  return '';
}

const table = createTable($('#booking-table'), {
  columns: [
    { label: 'วันที่จอง', render: (r) => `<span class="whitespace-nowrap">${fmt.date(r.date)}</span>` },
    {
      label: 'ลูกค้า',
      render: (r) => `
        <div class="font-medium text-slate-800 whitespace-nowrap">${esc(r.name)}</div>
        <div class="text-xs text-slate-400 whitespace-nowrap">${esc(r.phone || '-')}${r.walkinId ? ` · <span class="text-brand-500">${icon('link', 'inline w-3 h-3')} Walk In</span>` : ''}</div>`,
    },
    {
      label: 'โครงการ / แปลง',
      render: (r) => `<div class="whitespace-nowrap">${esc(r.project)}</div><div class="text-xs text-slate-400">แปลง ${esc(r.plot)}</div>`,
    },
    { label: 'ราคาแปลง', class: 'text-right', render: (r) => `<span class="tabular-nums whitespace-nowrap">${fmt.money(r.price)}</span>` },
    { label: 'เงินจอง', class: 'text-right', render: (r) => `<span class="tabular-nums whitespace-nowrap">${fmt.money(r.deposit)}</span>` },
    { label: 'วิธีการซื้อ', render: (r) => badge(r.paymentMethod, r.paymentMethod === 'เงินสด' ? 'emerald' : 'sky') },
    { label: 'สถานะ', render: (r) => badge(r.status, BOOKING_TONES[r.status]) },
    { label: 'ฝ่ายขาย', render: (r) => assigneeCell(r) },
    { label: 'ขั้นตอนถัดไป', render: nextStepCell },
    { label: '', class: 'text-right', render: () => rowActions('', { edit: can('bookings:write'), remove: can('bookings:delete') }) },
  ],
  actions: {
    edit: (id, row) => form.open(row),
    delete: (id, row) => confirmDelete({ resource: 'bookings', id, name: `${row.name} · ${row.project} แปลง ${row.plot}`, afterDelete: load }),
  },
});

const form = createCrudForm({
  resource: 'bookings',
  modal: $('#booking-modal'),
  form: bookingForm,
  titles: { create: 'บันทึกการจอง', edit: 'แก้ไขรายการจอง' },
  defaults: () => ({ date: todayYMD(), status: 'จองแล้ว', paymentMethod: 'ขอสินเชื่อ' }),
  beforeOpen(record) {
    // Transferred bookings keep their status; it is controlled by the Transfer page.
    bookingForm.elements.status.disabled = record?.status === 'โอนแล้ว';
    renderWalkinLink();
  },
  afterSave: load,
});

/* ---------- Walk In link & picker ---------- */
async function getWalkins() {
  state.walkins ||= await api.list('walkins', { ranged: false });
  return state.walkins;
}

async function renderWalkinLink() {
  const box = $('#walkin-link');
  const id = bookingForm.elements.walkinId.value;
  if (!id) {
    box.innerHTML = `<p class="font-medium text-brand-900">ลูกค้าจาก Walk In</p><p class="text-xs text-slate-500">ดึงชื่อและเบอร์โทรจากรายการ Walk In มากรอกอัตโนมัติ</p>`;
    return;
  }
  const walkin = (await getWalkins()).find((w) => w.id === id);
  box.innerHTML = `
    <p class="flex items-center gap-1.5 font-medium text-brand-900">${icon('link', 'w-4 h-4')} เชื่อมโยงกับ Walk In แล้ว</p>
    <p class="text-xs text-slate-500">${walkin ? `${esc(walkin.name)} · เข้าชม ${fmt.date(walkin.date)} · Grade ${esc(walkin.grade)}` : 'ไม่พบรายการ Walk In ต้นทาง'}
      <button type="button" class="ml-1 text-rose-600 hover:underline" data-unlink>ยกเลิกการเชื่อมโยง</button></p>`;
  $('[data-unlink]', box).addEventListener('click', () => {
    bookingForm.elements.walkinId.value = '';
    renderWalkinLink();
  });
}

function applyWalkin(walkin) {
  const f = bookingForm.elements;
  f.walkinId.value = walkin.id;
  f.name.value = walkin.name;
  f.phone.value = walkin.phone || '';
  if (f.assignedTo) f.assignedTo.value = walkin.assignedTo || '';
  renderWalkinLink();
}

async function renderPicker() {
  const list = $('#picker-list');
  const q = $('#picker-q').value.trim().toLowerCase();
  const grade = $('input[name="picker-grade"]:checked', picker).value;
  const bookedIds = new Set(state.rows.map((b) => b.walkinId).filter(Boolean));
  const rows = (await getWalkins())
    .filter((w) => (!grade || w.grade === grade) && (!q || [w.name, w.phone, w.lineId].some((v) => (v || '').toLowerCase().includes(q))))
    .slice(0, 100);

  list.innerHTML = rows.length
    ? rows
        .map(
          (w) => `
      <li>
        <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-50/60 focus:bg-brand-50 focus:outline-none" data-walkin="${esc(w.id)}">
          <div class="min-w-0 flex-1">
            <p class="font-medium text-slate-800 truncate">${esc(w.name)}</p>
            <p class="text-xs text-slate-400 truncate">${esc(w.phone || '-')} · เข้าชม ${fmt.date(w.date)} · ${esc(w.budget || 'ไม่ระบุงบ')}</p>
          </div>
          ${bookedIds.has(w.id) ? badge('มีการจองแล้ว', 'slate') : ''}
          ${badge(`Grade ${w.grade}`, GRADE_TONES[w.grade])}
        </button>
      </li>`,
        )
        .join('')
    : '<li class="px-4 py-10 text-center text-sm text-slate-400">ไม่พบรายการ Walk In</li>';
}

$('#pick-walkin').addEventListener('click', async () => {
  try {
    state.walkins = null; // always pick from fresh data
    $('#picker-q').value = '';
    await renderPicker();
    openModal(picker);
  } catch (err) {
    showError(err);
  }
});
$('#picker-q').addEventListener('input', debounce(renderPicker, 150));
$$('input[name="picker-grade"]', picker).forEach((el) => el.addEventListener('change', renderPicker));
$('#picker-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-walkin]');
  if (!btn) return;
  const walkin = (await getWalkins()).find((w) => w.id === btn.dataset.walkin);
  if (!walkin) return;
  applyWalkin(walkin);
  closeModal(picker);
  toast(`ดึงข้อมูลของ ${walkin.name} เรียบร้อย`, 'info');
});

/* ---------- Page ---------- */
function renderKpis() {
  const { rows } = state;
  const active = rows.filter((r) => r.status !== 'ยกเลิก');
  const count = (s) => rows.filter((r) => r.status === s).length;
  $('#kpis').innerHTML = [
    kpiCard({ label: 'จำนวนการจอง', value: fmt.num(active.length), hint: `ไม่รวมยกเลิก ${fmt.num(count('ยกเลิก'))} รายการ`, icon: 'bookings' }),
    kpiCard({ label: 'มูลค่าการจองรวม', value: fmt.million(sum(active, 'price')), hint: 'ราคาแปลงรวม', tone: 'gold', icon: 'banknotes' }),
    kpiCard({ label: 'เงินจองรวม', value: fmt.million(sum(active, 'deposit')), hint: 'ยอดเงินจองที่รับแล้ว', tone: 'violet', icon: 'banknotes' }),
    kpiCard({ label: 'รอโอนกรรมสิทธิ์', value: fmt.num(count('จองแล้ว')), hint: 'พร้อมต่อยอดไปหน้า Transfer', tone: 'amber', icon: 'clock' }),
    kpiCard({ label: 'โอนแล้ว', value: fmt.num(count('โอนแล้ว')), hint: `${fmt.pct(count('โอนแล้ว'), active.length)} ของการจอง`, tone: 'emerald', icon: 'transfers' }),
  ].join('');
}

function applyFilters() {
  const q = filters.q.value.trim().toLowerCase();
  const status = filters.status.value;
  const payment = filters.payment.value;
  table.setRows(
    state.rows.filter(
      (r) =>
        (!status || r.status === status) &&
        (!payment || r.paymentMethod === payment) &&
        (!q || [r.name, r.phone, r.project, r.plot].some((v) => (v || '').toLowerCase().includes(q))),
    ),
  );
}

async function load() {
  try {
    state.rows = await api.list('bookings');
    renderKpis();
    applyFilters();
  } catch (err) {
    showError(err);
  }
}

async function init() {
  const options = await api.options();
  populateOptions(document, options);
  populateAssignees();

  filters.q.addEventListener('input', debounce(applyFilters));
  filters.status.addEventListener('change', applyFilters);
  filters.payment.addEventListener('change', applyFilters);
  $('[data-new]')?.addEventListener('click', () => form.open());
  onRangeChange(load);

  await load();

  // Arrived from Walk In page ("จอง" button) → prefill from that walk-in.
  const walkinId = consumeParam('walkinId');
  if (walkinId) {
    try {
      const walkin = await api.get('walkins', walkinId);
      form.open(null, { walkinId: walkin.id, name: walkin.name, phone: walkin.phone, assignedTo: walkin.assignedTo || '' });
    } catch (err) {
      showError(err);
    }
  } else if (consumeParam('new')) {
    form.open();
  }
}

init().catch(showError);
