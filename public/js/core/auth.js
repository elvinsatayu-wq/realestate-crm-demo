/**
 * Current session + permission helpers. Uses top-level await, so every module
 * that imports this (layout, pages) runs only after the session is known.
 * Not signed in → redirect to /login and never resolve.
 */
import { esc } from './ui.js';

export const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', sales: 'Sales' };
export const ROLE_TONES = { admin: 'rose', manager: 'violet', sales: 'sky' };

export function redirectToLogin() {
  location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
  return new Promise(() => {});
}

async function loadSession() {
  const res = await fetch('/api/auth/me', { headers: { Accept: 'application/json' } });
  if (res.status === 401) return redirectToLogin();
  if (!res.ok) throw new Error('ไม่สามารถตรวจสอบสถานะการเข้าสู่ระบบได้');
  return res.json();
}

const session = await loadSession();
const directory = await fetch('/api/users/directory').then((r) => (r.ok ? r.json() : []));

export const currentUser = session.user;
export const can = (perm) => session.permissions.includes(perm);
export const roleLabel = (role) => ROLE_LABELS[role] || role;
export const userName = (id) => directory.find((u) => u.id === id)?.name || '';

/** People a record can be assigned to (active Sales and Managers). */
export const assignableUsers = () => directory.filter((u) => u.active && u.role !== 'admin');

/** Removes every element whose data-perm the current user lacks. */
export function applyPermissions(root = document) {
  root.querySelectorAll('[data-perm]').forEach((el) => {
    if (!can(el.dataset.perm)) el.remove();
  });
}

/**
 * Fills <select data-assignees data-placeholder="…" [data-unassigned]> with assignable users.
 * `data-unassigned` adds a "ยังไม่มอบหมาย" filter option.
 */
export function populateAssignees(root = document) {
  root.querySelectorAll('select[data-assignees]').forEach((el) => {
    el.innerHTML =
      `<option value="">${esc(el.dataset.placeholder || '— ยังไม่มอบหมาย —')}</option>` +
      ('unassigned' in el.dataset ? '<option value="__none">ยังไม่มอบหมาย</option>' : '') +
      assignableUsers().map((u) => `<option value="${esc(u.id)}">${esc(u.name)}${u.role === 'manager' ? ' (Manager)' : ''}</option>`).join('');
  });
}

/** Filter predicate for an assignee <select> value ('' = all, '__none' = unassigned). */
export const matchesAssignee = (record, value) => !value || (value === '__none' ? !record.assignedTo : record.assignedTo === value);

/** Table cell content for a record's owner. */
export function assigneeCell(record, fallback = '') {
  const name = userName(record.assignedTo) || fallback;
  return name
    ? `<span class="whitespace-nowrap text-slate-600">${esc(name)}</span>`
    : '<span class="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 ring-1 ring-inset ring-amber-600/20">ยังไม่มอบหมาย</span>';
}

export async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    location.replace('/login');
  }
}
