import { icon } from './icons.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function debounce(fn, ms = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ---------- Formatting ---------- */
const nf = new Intl.NumberFormat('th-TH');
export const fmt = {
  num: (n) => nf.format(Number(n) || 0),
  money: (n) => (n == null || n === '' ? '-' : `฿${nf.format(n)}`),
  /** ฿12.5 ล้าน style for large amounts */
  million: (n) =>
    Number(n) >= 1e6 ? `฿${(n / 1e6).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ล้าน` : fmt.money(n || 0),
  date: (ymd) =>
    ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-',
  pct: (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : '0%'),
};

export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Reads a query param once and removes it from the address bar. */
export function consumeParam(name) {
  const url = new URL(location.href);
  const value = url.searchParams.get(name);
  if (value !== null) {
    url.searchParams.delete(name);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
  return value;
}

/* ---------- Badges & cards ---------- */
const TONES = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  gold: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  pink: 'bg-pink-50 text-pink-700 ring-pink-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export const badge = (text, tone = 'slate') =>
  text
    ? `<span class="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone] || TONES.slate}">${esc(text)}</span>`
    : '<span class="text-slate-300">-</span>';

export const CHANNEL_TONES = {
  Facebook: 'blue',
  Instagram: 'pink',
  Website: 'violet',
  'Call in': 'emerald',
  ป้ายบอกทาง: 'amber',
  บิลบอร์ด: 'orange',
};
export const GRADE_TONES = { A: 'emerald', B: 'blue', C: 'amber', D: 'slate' };

const KPI_TONES = {
  brand: 'bg-brand-50 text-brand-700',
  gold: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  sky: 'bg-sky-50 text-sky-700',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-700',
  slate: 'bg-slate-100 text-slate-600',
};

export const kpiCard = ({ label, value, hint = '', tone = 'brand', icon: iconName }) => `
  <div class="card p-4 flex items-start gap-3">
    ${iconName ? `<div class="kpi-icon ${KPI_TONES[tone] || KPI_TONES.brand}">${icon(iconName, 'w-5 h-5')}</div>` : ''}
    <div class="min-w-0">
      <p class="text-xs font-medium text-slate-500 truncate">${label}</p>
      <p class="mt-1 text-xl font-semibold leading-tight text-slate-900 tabular-nums break-words">${value}</p>
      ${hint ? `<p class="mt-0.5 text-xs text-slate-400 truncate">${hint}</p>` : ''}
    </div>
  </div>`;

export const rowActions = (extra = '', { edit = true, remove = true } = {}) => `
  <div class="flex items-center justify-end gap-1">
    ${extra}
    ${edit ? `<button type="button" class="icon-btn" data-action="edit" title="แก้ไข" aria-label="แก้ไข">${icon('pencil', 'w-4 h-4')}</button>` : ''}
    ${remove ? `<button type="button" class="icon-btn danger" data-action="delete" title="ลบ" aria-label="ลบ">${icon('trash', 'w-4 h-4')}</button>` : ''}
  </div>`;

/* ---------- Aggregation ---------- */
/** Counts rows by `key` (array values count once per item); `order` fixes label order. */
export function countBy(rows, key, order = []) {
  const counts = new Map(order.map((o) => [typeof o === 'string' ? o : o.value, 0]));
  for (const row of rows) {
    const values = Array.isArray(row[key]) ? row[key] : [row[key]];
    for (const v of values) if (v != null && v !== '') counts.set(v, (counts.get(v) || 0) + 1);
  }
  return { labels: [...counts.keys()], data: [...counts.values()] };
}

/** Counts numeric `key` into buckets: [{ label, min, max }] (max exclusive). */
export function bucketize(rows, key, buckets) {
  const data = buckets.map(() => 0);
  for (const row of rows) {
    const v = Number(row[key]);
    if (row[key] == null || row[key] === '' || Number.isNaN(v)) continue;
    const i = buckets.findIndex((b) => v >= (b.min ?? -Infinity) && v < (b.max ?? Infinity));
    if (i >= 0) data[i] += 1;
  }
  return { labels: buckets.map((b) => b.label), data };
}

export const sum = (rows, key) => rows.reduce((total, r) => total + (Number(r[key]) || 0), 0);

/* ---------- Forms ---------- */
const optionValue = (o) => (typeof o === 'string' ? o : o.value);
const optionLabel = (o) => (typeof o === 'string' ? o : o.label);

export const optionTags = (list, placeholder) =>
  (placeholder != null ? `<option value="">${esc(placeholder)}</option>` : '') +
  list.map((o) => `<option value="${esc(optionValue(o))}">${esc(optionLabel(o))}</option>`).join('');

/**
 * Fills option lists declared in markup from the server's /api/options:
 *   <select data-options="budgets" data-placeholder="...">
 *   <datalist data-options="banks">
 *   <div data-chips="visitReasons" data-name="reasons" data-type="checkbox|radio">
 */
export function populateOptions(root, options) {
  $$('select[data-options]', root).forEach((el) => {
    el.innerHTML = optionTags(options[el.dataset.options] || [], el.dataset.placeholder);
  });
  $$('datalist[data-options]', root).forEach((el) => {
    el.innerHTML = (options[el.dataset.options] || []).map((o) => `<option value="${esc(optionValue(o))}"></option>`).join('');
  });
  $$('[data-chips]', root).forEach((el) => {
    const type = el.dataset.type || 'checkbox';
    el.innerHTML = (options[el.dataset.chips] || [])
      .map((o) => `<label class="chip"><input type="${type}" name="${el.dataset.name}" value="${esc(optionValue(o))}"><span>${esc(optionLabel(o))}</span></label>`)
      .join('');
  });
}

/** Form → plain object. Checkbox groups become arrays. */
export function serializeForm(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') {
      data[el.name] ||= [];
      if (el.checked) data[el.name].push(el.value);
    } else if (el.type === 'radio') {
      if (el.checked) data[el.name] = el.value;
      else if (!(el.name in data)) data[el.name] = '';
    } else {
      data[el.name] = el.value;
    }
  }
  return data;
}

export function fillForm(form, data = {}) {
  form.reset();
  for (const el of form.elements) {
    if (!el.name) continue;
    // reset() does not clear hidden inputs, so do it explicitly.
    if (el.type === 'hidden' && !(el.name in data)) el.value = '';
    if (!(el.name in data)) continue;
    const value = data[el.name];
    if (el.type === 'checkbox') el.checked = Array.isArray(value) && value.includes(el.value);
    else if (el.type === 'radio') el.checked = value != null && String(value) === el.value;
    else el.value = value ?? '';
  }
}

/* ---------- Modal ---------- */
export function openModal(modal) {
  modal.hidden = false;
  document.body.classList.add('overflow-hidden');
  modal.querySelector('.modal-panel')?.scrollIntoView({ block: 'start' });
  requestAnimationFrame(() => modal.querySelector('[autofocus], input:not([type=hidden]):not([readonly]), select, textarea')?.focus());
}

export function closeModal(modal) {
  if (!modal) return;
  modal.hidden = true;
  if (!document.querySelector('.modal:not([hidden])')) document.body.classList.remove('overflow-hidden');
}

document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer) closeModal(closer.closest('.modal'));
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = $$('.modal:not([hidden])').pop();
  if (open) closeModal(open);
});

let confirmModal;
/** Promise<boolean> confirmation dialog. */
export function confirmDialog({ title = 'ยืนยันการทำรายการ', message, confirmText = 'ยืนยัน', danger = true }) {
  if (!confirmModal) {
    confirmModal = document.createElement('div');
    confirmModal.className = 'modal';
    confirmModal.hidden = true;
    confirmModal.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal-panel max-w-md mt-[10vh]" role="alertdialog" aria-modal="true">
        <div class="modal-body flex gap-4">
          <div class="kpi-icon bg-rose-50 text-rose-600">${icon('trash', 'w-5 h-5')}</div>
          <div><h3 class="font-semibold text-slate-900" data-title></h3><p class="mt-1 text-sm text-slate-500" data-message></p></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-close>ยกเลิก</button>
          <button type="button" class="btn" data-ok></button>
        </div>
      </div>`;
    document.body.append(confirmModal);
  }
  $('[data-title]', confirmModal).textContent = title;
  $('[data-message]', confirmModal).textContent = message;
  const ok = $('[data-ok]', confirmModal);
  ok.textContent = confirmText;
  ok.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
  openModal(confirmModal);
  ok.focus();

  return new Promise((resolve) => {
    const done = (result) => {
      ok.removeEventListener('click', onOk);
      observer.disconnect();
      closeModal(confirmModal);
      resolve(result);
    };
    const onOk = () => done(true);
    ok.addEventListener('click', onOk);
    // Any other way of closing (backdrop, Esc, Cancel) resolves false.
    const observer = new MutationObserver(() => confirmModal.hidden && done(false));
    observer.observe(confirmModal, { attributes: true, attributeFilter: ['hidden'] });
  });
}

/* ---------- Toasts ---------- */
export function toast(message, type = 'success') {
  let host = $('#toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.setAttribute('role', 'status');
    document.body.append(host);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="mt-0.5">${icon(type === 'error' ? 'x' : 'check', 'w-4 h-4')}</span><span>${esc(message)}</span>`;
  host.append(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
}

export function showError(err) {
  console.error(err);
  const lines = err.details?.length ? err.details : [err.message || 'เกิดข้อผิดพลาด'];
  toast(lines.join(' • '), 'error');
}

/* ---------- Table ---------- */
/**
 * Paged table. columns: [{ label, render(row), class }]
 * actions: { name: (id, row) => {} } wired to [data-action="name"] inside rows.
 * footer(rows): optional <tfoot> row html.
 */
export function createTable(el, { columns, pageSize = 15, emptyText = 'ไม่พบข้อมูลในช่วงเวลาที่เลือก', actions = {}, footer }) {
  let rows = [];
  let page = 1;

  el.innerHTML = `
    <div class="overflow-x-auto scroll-thin">
      <table class="data-table">
        <thead><tr>${columns.map((c) => `<th class="${c.class || ''}">${c.label}</th>`).join('')}</tr></thead>
        <tbody></tbody>
        <tfoot></tfoot>
      </table>
    </div>
    <div class="table-footer"></div>`;
  const tbody = $('tbody', el);
  const tfoot = $('tfoot', el);
  const pager = $('.table-footer', el);

  function render() {
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    page = Math.min(page, pages);
    const start = (page - 1) * pageSize;
    const slice = rows.slice(start, start + pageSize);

    tbody.innerHTML = slice.length
      ? slice.map((r) => `<tr data-id="${esc(r.id)}">${columns.map((c) => `<td class="${c.class || ''}">${c.render(r)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${columns.length}" class="!py-14 text-center text-slate-400">${emptyText}</td></tr>`;
    tfoot.innerHTML = footer && rows.length ? footer(rows) : '';
    pager.innerHTML = `
      <span>${rows.length ? `แสดง ${fmt.num(start + 1)}–${fmt.num(start + slice.length)} จาก ${fmt.num(rows.length)} รายการ` : 'ไม่มีรายการ'}</span>
      <div class="flex items-center gap-2">
        <button type="button" class="btn btn-ghost btn-sm" data-page="-1" ${page <= 1 ? 'disabled' : ''}>ก่อนหน้า</button>
        <span class="tabular-nums">${page} / ${pages}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-page="1" ${page >= pages ? 'disabled' : ''}>ถัดไป</button>
      </div>`;
  }

  el.addEventListener('click', (e) => {
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn) {
      page += Number(pageBtn.dataset.page);
      render();
      return;
    }
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const id = actionBtn.closest('tr')?.dataset.id;
    const row = rows.find((r) => r.id === id);
    if (row) actions[actionBtn.dataset.action]?.(id, row);
  });

  return {
    setRows(next, { keepPage = false } = {}) {
      rows = next;
      if (!keepPage) page = 1;
      render();
    },
  };
}
