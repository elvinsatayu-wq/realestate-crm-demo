import { initLayout } from '../core/layout.js';
import { api } from '../core/api.js';
import { createCrudForm, confirmDelete } from '../core/crud.js';
import { currentUser, roleLabel, ROLE_TONES } from '../core/auth.js';
import { $, $$, esc, badge, rowActions, debounce, createTable, showError } from '../core/ui.js';

initLayout({ page: 'users', title: 'ผู้ใช้งานและสิทธิ์', subtitle: 'เพิ่ม แก้ไข และกำหนดบทบาทผู้ใช้งานในระบบ', dateFilter: false });

const state = { rows: [] };
const userForm = $('#user-form');
const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

const table = createTable($('#user-table'), {
  pageSize: 20,
  emptyText: 'ไม่พบผู้ใช้งาน',
  columns: [
    {
      label: 'ผู้ใช้งาน',
      render: (r) => `
        <div class="flex items-center gap-3">
          <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 font-semibold text-brand-700">${esc(r.name.replace(/^คุณ/, '').trim().charAt(0))}</div>
          <div class="min-w-0">
            <p class="flex items-center gap-2 font-medium text-slate-800 whitespace-nowrap">${esc(r.name)} ${r.id === currentUser.id ? badge('คุณ', 'gold') : ''}</p>
            <p class="text-xs text-slate-400">@${esc(r.username)}</p>
          </div>
        </div>`,
    },
    { label: 'บทบาท', render: (r) => badge(roleLabel(r.role), ROLE_TONES[r.role]) },
    { label: 'สถานะ', render: (r) => (r.active ? badge('ใช้งาน', 'emerald') : badge('ปิดใช้งาน', 'slate')) },
    { label: 'เข้าสู่ระบบล่าสุด', render: (r) => `<span class="whitespace-nowrap text-slate-500">${dateTime(r.lastLoginAt)}</span>` },
    { label: 'สร้างเมื่อ', render: (r) => `<span class="whitespace-nowrap text-slate-500">${dateTime(r.createdAt)}</span>` },
    { label: '', class: 'text-right', render: (r) => rowActions('', { remove: r.id !== currentUser.id }) },
  ],
  actions: {
    edit: (id, row) => form.open({ ...row, active: String(row.active), password: '' }),
    delete: (id, row) => confirmDelete({ resource: 'users', id, name: `${row.name} (@${row.username})`, afterDelete: load }),
  },
});

const form = createCrudForm({
  resource: 'users',
  modal: $('#user-modal'),
  form: userForm,
  titles: { create: 'เพิ่มผู้ใช้งาน', edit: 'แก้ไขผู้ใช้งาน' },
  defaults: () => ({ role: 'sales', active: 'true', password: '' }),
  beforeOpen(record) {
    const f = userForm.elements;
    // Password is required for new accounts, optional (= unchanged) when editing.
    f.password.required = !record;
    $('[data-password-req]', userForm).hidden = !!record;
    $('[data-password-hint]', userForm).textContent = record ? 'เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน' : '';
    const self = record?.id === currentUser.id;
    f.role.disabled = self;
    f.active.disabled = self;
    $('[data-self-note]', userForm).classList.toggle('hidden', !self);
  },
  afterSave: load,
});

function applyFilters() {
  const q = $('#filter-q').value.trim().toLowerCase();
  const role = $('#filter-role').value;
  table.setRows(state.rows.filter((r) => (!role || r.role === role) && (!q || [r.name, r.username].some((v) => v.toLowerCase().includes(q)))));
}

async function load() {
  try {
    state.rows = await api.list('users', { ranged: false });
    $$('[data-count]').forEach((el) => {
      el.textContent = state.rows.filter((r) => r.role === el.dataset.count && r.active).length;
    });
    applyFilters();
  } catch (err) {
    showError(err);
  }
}

$('#filter-q').addEventListener('input', debounce(applyFilters));
$('#filter-role').addEventListener('change', applyFilters);
$('[data-new]').addEventListener('click', () => form.open());
load();
