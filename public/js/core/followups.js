import { icon } from './icons.js';
import { todayYMD } from './date-filter.js';
import { esc, fmt } from './ui.js';

/**
 * Repeatable "บันทึกการติดตาม" rows (date + note) inside a form.
 * Inputs carry no `name`, so serializeForm/fillForm ignore them;
 * the CRUD form reads and writes this widget through get()/set().
 *
 * Markup: <div data-followups></div> plus a <button data-add-followup>.
 */
export function createFollowups(container, addButton) {
  container.addEventListener('click', (e) => {
    if (!e.target.closest('[data-remove-followup]')) return;
    e.target.closest('[data-followup-row]').remove();
    renumber();
  });

  addButton.addEventListener('click', () => {
    add({ date: todayYMD(), note: '' });
    container.lastElementChild?.querySelector('textarea')?.focus();
  });

  function renumber() {
    const rows = [...container.querySelectorAll('[data-followup-row]')];
    rows.forEach((row, i) => {
      row.querySelector('[data-no]').textContent = `ครั้งที่ ${i + 1}`;
    });
    container.querySelector('[data-followup-empty]')?.remove();
    if (!rows.length) {
      container.insertAdjacentHTML(
        'beforeend',
        '<p data-followup-empty class="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">ยังไม่มีบันทึกการติดตาม — กด "เพิ่มบันทึกการติดตาม" เพื่อเริ่มบันทึก</p>',
      );
    }
  }

  function add({ date = '', note = '' }) {
    container.querySelector('[data-followup-empty]')?.remove();
    container.insertAdjacentHTML(
      'beforeend',
      `<div data-followup-row class="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[11rem_1fr_auto]">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-500"><span data-no></span> · วันที่ติดตาม</span>
          <input type="date" class="field-input" data-field="date" value="${esc(date)}">
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-500">รายละเอียดการติดตาม</span>
          <textarea class="field-input !min-h-[2.6rem]" rows="2" data-field="note" placeholder="ผลการติดต่อ สิ่งที่ลูกค้าแจ้ง หรือนัดหมายครั้งถัดไป">${esc(note)}</textarea>
        </label>
        <button type="button" class="icon-btn danger self-end sm:mb-1" data-remove-followup title="ลบบันทึกนี้" aria-label="ลบบันทึกนี้">${icon('trash', 'w-4 h-4')}</button>
      </div>`,
    );
    renumber();
  }

  return {
    set(list = []) {
      container.innerHTML = '';
      list.forEach(add);
      renumber();
    },
    get() {
      return [...container.querySelectorAll('[data-followup-row]')].map((row) => ({
        date: row.querySelector('[data-field="date"]').value,
        note: row.querySelector('[data-field="note"]').value.trim(),
      }));
    },
  };
}

/** Small "ติดตาม N ครั้ง · ล่าสุด …" line for table cells. */
export function followupSummary(list) {
  if (!list?.length) return '';
  const latest = list.reduce((a, b) => (b.date > a.date ? b : a));
  return `<div class="mt-1 flex items-center gap-1 text-xs text-brand-600 whitespace-nowrap" title="${esc(latest.note)}">${icon('clock', 'w-3.5 h-3.5')} ติดตาม ${fmt.num(list.length)} ครั้ง · ล่าสุด ${fmt.date(latest.date)}</div>`;
}
