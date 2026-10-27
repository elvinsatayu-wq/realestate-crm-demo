import { api } from './api.js';
import { isInRange } from './date-filter.js';
import { $, fillForm, serializeForm, openModal, closeModal, toast, showError, confirmDialog } from './ui.js';

/**
 * Wires a modal form for create/edit of one resource.
 * `widgets` maps a field name to a custom input with set(value)/get() (e.g. follow-up rows).
 * Returns { open(record?, defaults?) }.
 */
export function createCrudForm({ resource, modal, form, titles, defaults = () => ({}), widgets = {}, beforeOpen, afterSave }) {
  const titleEl = $('[data-modal-title]', modal);
  const submit = $('[type=submit]', form);

  function open(record, prefill = {}) {
    const values = record || { ...defaults(), ...prefill };
    form.dataset.editId = record?.id || '';
    fillForm(form, values);
    Object.entries(widgets).forEach(([field, widget]) => widget.set(values[field] || []));
    titleEl.textContent = record ? titles.edit : titles.create;
    beforeOpen?.(record);
    openModal(modal);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = form.dataset.editId;
    const data = serializeForm(form);
    Object.entries(widgets).forEach(([field, widget]) => {
      data[field] = widget.get();
    });
    submit.disabled = true;
    try {
      const saved = id ? await api.update(resource, id, data) : await api.create(resource, data);
      closeModal(modal);
      toast(id ? 'บันทึกการแก้ไขเรียบร้อย' : 'บันทึกข้อมูลเรียบร้อย');
      if (saved.date && !isInRange(saved.date)) toast('รายการนี้อยู่นอกช่วงวันที่ที่เลือก จึงไม่แสดงในตารางขณะนี้', 'info');
      await afterSave?.(saved);
    } catch (err) {
      showError(err);
    } finally {
      submit.disabled = false;
    }
  });

  return { open };
}

export async function confirmDelete({ resource, id, name, afterDelete }) {
  const ok = await confirmDialog({
    title: 'ยืนยันการลบข้อมูล',
    message: `ต้องการลบข้อมูล "${name}" ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้`,
    confirmText: 'ลบข้อมูล',
  });
  if (!ok) return;
  try {
    await api.remove(resource, id);
    toast('ลบข้อมูลเรียบร้อย');
    await afterDelete?.();
  } catch (err) {
    showError(err);
  }
}
