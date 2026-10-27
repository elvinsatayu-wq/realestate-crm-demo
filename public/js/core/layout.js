import { icon, hydrateIcons } from './icons.js';
import { mountDateFilter, onRangeChange, rangeLabel, syncLinks } from './date-filter.js';
import { $, $$, esc, badge } from './ui.js';
import { currentUser, can, applyPermissions, logout, roleLabel, ROLE_TONES } from './auth.js';

const NAV = [
  { key: 'dashboard', href: '/', label: 'Dashboard', sub: 'ภาพรวมระบบ' },
  { key: 'leads', href: '/leads', label: 'Lead', sub: 'ลูกค้าเป้าหมาย', perm: 'leads:read' },
  { key: 'walkins', href: '/walkins', label: 'Walk In', sub: 'ลูกค้าเข้าชมโครงการ', perm: 'walkins:read' },
  { key: 'bookings', href: '/bookings', label: 'Booking', sub: 'รายการจอง', perm: 'bookings:read' },
  { key: 'transfers', href: '/transfers', label: 'Transfer', sub: 'โอนกรรมสิทธิ์', perm: 'transfers:read' },
];
const ADMIN_NAV = [{ key: 'users', href: '/users', label: 'ผู้ใช้งาน', sub: 'บัญชีและสิทธิ์การใช้งาน', perm: 'users:manage' }];

const SCOPE_NOTE = 'แสดงเฉพาะลูกค้าที่คุณได้รับมอบหมาย';

function renderRangeLabels() {
  $$('[data-range-label]').forEach((el) => {
    el.textContent = rangeLabel();
  });
}

const navLink = (item, page) => `
  <a data-range-link="${item.href}" href="${item.href}" class="nav-link ${item.key === page ? 'active' : ''}" ${item.key === page ? 'aria-current="page"' : ''}>
    ${icon(item.key, 'w-5 h-5 shrink-0')}
    <span class="leading-tight"><span class="block text-sm font-medium">${item.label}</span><span class="block text-[11px] text-slate-500">${item.sub}</span></span>
  </a>`;

/**
 * Renders sidebar + top bar (with the global date filter) around the page's <main>,
 * then strips every [data-perm] element the signed-in user isn't allowed to see.
 */
export function initLayout({ page, title, subtitle = '', dateFilter = true }) {
  const visible = (items) => items.filter((item) => !item.perm || can(item.perm));
  const adminItems = visible(ADMIN_NAV);

  const sidebar = $('#sidebar');
  sidebar.className =
    'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-950 text-slate-300 transition-transform duration-200 -translate-x-full lg:translate-x-0';
  sidebar.innerHTML = `
    <div class="flex items-center gap-3 px-5 h-16 border-b border-white/5">
      <div class="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white shadow-lg shadow-gold-600/20">${icon('home', 'w-5 h-5')}</div>
      <div class="leading-tight">
        <p class="font-semibold text-white tracking-wide">Real Estate CRM</p>
        <p class="text-[11px] text-slate-400">Sales Management Suite</p>
      </div>
      <button type="button" class="ml-auto icon-btn !text-slate-400 hover:!bg-white/10 lg:hidden" data-nav-close aria-label="ปิดเมนู">${icon('x', 'w-5 h-5')}</button>
    </div>
    <nav class="flex-1 overflow-y-auto scroll-thin px-3 py-5 space-y-1">
      <p class="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500">Sales Pipeline</p>
      ${visible(NAV).map((item) => navLink(item, page)).join('')}
      ${adminItems.length ? `<p class="px-3 pt-5 pb-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500">ผู้ดูแลระบบ</p>${adminItems.map((item) => navLink(item, page)).join('')}` : ''}
    </nav>
    ${
      dateFilter
        ? `<div class="mx-3 mb-2 rounded-xl bg-white/5 p-3.5">
            <p class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gold-400">${icon('calendar', 'w-4 h-4')} ช่วงข้อมูลที่เลือก</p>
            <p class="mt-1 text-xs text-slate-300 leading-relaxed" data-range-label></p>
          </div>`
        : ''
    }
    <div class="m-3 mt-1 flex items-center gap-3 rounded-xl border border-white/5 bg-white/[.03] p-3">
      <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-500/20 font-semibold text-gold-300">${esc((currentUser.name || '?').replace(/^คุณ/, '').trim().charAt(0))}</div>
      <div class="min-w-0 flex-1 leading-tight">
        <p class="truncate text-sm font-medium text-white">${esc(currentUser.name)}</p>
        <p class="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400"><span class="truncate">@${esc(currentUser.username)}</span> ${badge(roleLabel(currentUser.role), ROLE_TONES[currentUser.role])}</p>
      </div>
      <button type="button" class="icon-btn !text-slate-400 hover:!bg-white/10 hover:!text-white" data-logout title="ออกจากระบบ" aria-label="ออกจากระบบ">${icon('logout', 'w-5 h-5')}</button>
    </div>`;

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-40 bg-brand-950/50 backdrop-blur-sm lg:hidden';
  overlay.hidden = true;
  document.body.append(overlay);

  const topbar = $('#topbar');
  topbar.className = 'sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur';
  topbar.innerHTML = `
    <div class="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 md:px-6 lg:px-8 py-3">
      <button type="button" class="icon-btn lg:hidden -ml-1" data-nav-open aria-label="เปิดเมนู">${icon('menu', 'w-6 h-6')}</button>
      <div class="min-w-0 flex-1">
        <h1 class="text-lg font-semibold text-brand-950 truncate">${title}</h1>
        ${subtitle ? `<p class="text-xs text-slate-500 truncate">${subtitle}</p>` : ''}
      </div>
      ${dateFilter ? '<div data-date-filter class="w-full md:w-auto"></div>' : ''}
    </div>`;

  const setNav = (open) => {
    sidebar.classList.toggle('-translate-x-full', !open);
    overlay.hidden = !open;
  };
  $('[data-nav-open]', topbar).addEventListener('click', () => setNav(true));
  $('[data-nav-close]', sidebar).addEventListener('click', () => setNav(false));
  overlay.addEventListener('click', () => setNav(false));
  $('[data-logout]', sidebar).addEventListener('click', logout);

  // Sales see a hint that lists are limited to their own customers.
  $$('[data-scope-note]').forEach((el) => {
    if (can('records:all')) return el.remove();
    el.hidden = false;
    el.innerHTML = `${icon('shield', 'w-3.5 h-3.5')} ${SCOPE_NOTE}`;
  });

  applyPermissions();
  if (dateFilter) mountDateFilter($('[data-date-filter]', topbar));
  hydrateIcons();
  syncLinks();
  renderRangeLabels();
  onRangeChange(renderRangeLabels);
  document.title = `${title} · Real Estate CRM`;
}
