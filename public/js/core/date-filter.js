/**
 * Global date range shared by every page.
 *
 * Source of truth, in priority order:
 *   1. URL (?preset=30d  or  ?from=YYYY-MM-DD&to=YYYY-MM-DD) — so links carry the range
 *   2. localStorage — so the range survives navigation and syncs across open tabs
 *   3. DEFAULT_PRESET
 * Relative presets ("30 วันล่าสุด", "เดือนนี้") are stored by key and re-resolved
 * against today on every load, so they never go stale.
 */
import { icon } from './icons.js';

const STORAGE_KEY = 'crm.dateRange.v1';
const EVENT = 'crm:daterange';
const DEFAULT_PRESET = '90d';
const RANGE_PARAMS = ['preset', 'from', 'to'];

const pad = (n) => String(n).padStart(2, '0');
export const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayYMD = () => toYMD(new Date());
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const PRESETS = [
  { key: 'today', label: 'วันนี้', range: (t) => [t, t] },
  { key: '7d', label: '7 วันล่าสุด', range: (t) => [addDays(t, -6), t] },
  { key: '30d', label: '30 วันล่าสุด', range: (t) => [addDays(t, -29), t] },
  { key: '90d', label: '90 วันล่าสุด', range: (t) => [addDays(t, -89), t] },
  { key: 'month', label: 'เดือนนี้', range: (t) => [new Date(t.getFullYear(), t.getMonth(), 1), new Date(t.getFullYear(), t.getMonth() + 1, 0)] },
  { key: 'lastmonth', label: 'เดือนที่แล้ว', range: (t) => [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)] },
  {
    key: 'quarter',
    label: 'ไตรมาสนี้',
    range: (t) => {
      const q = Math.floor(t.getMonth() / 3) * 3;
      return [new Date(t.getFullYear(), q, 1), new Date(t.getFullYear(), q + 3, 0)];
    },
  },
  { key: 'year', label: 'ปีนี้', range: (t) => [new Date(t.getFullYear(), 0, 1), new Date(t.getFullYear(), 11, 31)] },
  { key: 'all', label: 'ทั้งหมด', range: () => [null, null] },
];

const isYMD = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

function resolve(input = {}) {
  const preset = PRESETS.find((p) => p.key === input.preset);
  if (preset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [from, to] = preset.range(today);
    return { preset: preset.key, from: from ? toYMD(from) : '', to: to ? toYMD(to) : '' };
  }
  let from = isYMD(input.from) ? input.from : '';
  let to = isYMD(input.to) ? input.to : '';
  if (from && to && from > to) [from, to] = [to, from];
  return { preset: 'custom', from, to };
}

function readUrl() {
  const params = new URLSearchParams(location.search);
  if (params.has('preset')) return { preset: params.get('preset') };
  if (params.has('from') || params.has('to')) return { from: params.get('from'), to: params.get('to') };
  return null;
}

function readStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStorage(range) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(range));
  } catch {
    /* storage unavailable (private mode) — URL still carries the range */
  }
}

let current = resolve(readUrl() || readStorage() || { preset: DEFAULT_PRESET });

export const getRange = () => ({ ...current });
export const isInRange = (date) => (!current.from || date >= current.from) && (!current.to || date <= current.to);

function rangeParams(range = current) {
  return range.preset !== 'custom'
    ? { preset: range.preset }
    : Object.fromEntries(Object.entries({ from: range.from, to: range.to }).filter(([, v]) => v));
}

/** Returns `href` with the current range applied (other query params are kept). */
export function withRange(href) {
  const url = new URL(href, location.origin);
  RANGE_PARAMS.forEach((k) => url.searchParams.delete(k));
  Object.entries(rangeParams()).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.pathname + url.search + url.hash;
}

function syncUrl() {
  history.replaceState(history.state, '', withRange(location.href));
}

/** Updates every <a data-range-link="/path"> so plain navigation keeps the range. */
export function syncLinks(root = document) {
  root.querySelectorAll('a[data-range-link]').forEach((a) => {
    a.href = withRange(a.dataset.rangeLink);
  });
}

export function setRange(next) {
  const resolved = resolve(next);
  if (resolved.preset === current.preset && resolved.from === current.from && resolved.to === current.to) return;
  current = resolved;
  writeStorage(current);
  syncUrl();
  syncLinks();
  window.dispatchEvent(new CustomEvent(EVENT, { detail: getRange() }));
}

export function onRangeChange(callback) {
  window.addEventListener(EVENT, (e) => callback(e.detail));
}

const thaiDate = (ymd) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

export function rangeLabel(range = current) {
  const preset = PRESETS.find((p) => p.key === range.preset);
  if (preset?.key === 'all' || (!range.from && !range.to)) return 'ทุกช่วงเวลา';
  const span = range.from === range.to ? thaiDate(range.from) : `${range.from ? thaiDate(range.from) : 'เริ่มต้น'} – ${range.to ? thaiDate(range.to) : 'ปัจจุบัน'}`;
  return preset ? `${preset.label} (${span})` : span;
}

// Persist whatever we resolved on load, and normalise the address bar.
writeStorage(current);
syncUrl();

// Links rendered after load are rewritten at click time as a safety net.
['click', 'auxclick'].forEach((type) =>
  document.addEventListener(
    type,
    (e) => {
      const a = e.target.closest?.('a[data-range-link]');
      if (a) a.href = withRange(a.dataset.rangeLink);
    },
    true,
  ),
);

// Another tab changed the range → follow it.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY || !e.newValue) return;
  try {
    setRange(JSON.parse(e.newValue));
  } catch {
    /* ignore malformed value */
  }
});

/** Renders the preset dropdown + flatpickr range input into `container`. */
export function mountDateFilter(container) {
  container.innerHTML = `
    <div class="flex flex-wrap items-center gap-2">
      <select class="field-input !w-auto !py-2 text-sm" data-preset aria-label="ช่วงเวลาสำเร็จรูป">
        ${PRESETS.map((p) => `<option value="${p.key}">${p.label}</option>`).join('')}
        <option value="custom">กำหนดเอง</option>
      </select>
      <div class="relative flex-1 sm:flex-none">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${icon('calendar', 'w-4 h-4')}</span>
        <input type="text" class="field-input !py-2 !pl-9 sm:w-64 text-sm" placeholder="ทุกช่วงเวลา" data-range-input aria-label="เลือกช่วงวันที่" readonly>
      </div>
    </div>`;

  const select = container.querySelector('[data-preset]');
  const input = container.querySelector('[data-range-input]');

  const picker = window.flatpickr
    ? window.flatpickr(input, {
        mode: 'range',
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'j M Y',
        altInputClass: input.className,
        locale: window.flatpickr.l10ns?.th || 'default',
        disableMobile: true,
        onClose(selected) {
          const [start, end = start] = selected;
          const from = start ? toYMD(start) : '';
          const to = end ? toYMD(end) : '';
          // Closed without picking anything new → keep the current preset.
          if (!from || (from === current.from && to === current.to)) render(current);
          else setRange({ from, to });
        },
      })
    : null;

  // Fallback when the CDN is unreachable: a read-only label.
  if (!picker) input.value = rangeLabel();

  function render(range) {
    select.value = range.preset;
    if (picker) {
      if (range.from || range.to) picker.setDate([range.from || range.to, range.to || range.from], false);
      else picker.clear(false);
    } else input.value = rangeLabel(range);
  }

  select.addEventListener('change', () => {
    if (select.value === 'custom') picker?.open();
    else setRange({ preset: select.value });
  });

  render(current);
  onRangeChange(render);
}
