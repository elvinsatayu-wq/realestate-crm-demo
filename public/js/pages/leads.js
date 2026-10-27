import { initLayout } from '../core/layout.js';
import { api } from '../core/api.js';
import { onRangeChange, todayYMD } from '../core/date-filter.js';
import { createCrudForm, confirmDelete } from '../core/crud.js';
import { doughnutChart, barChart } from '../core/charts.js';
import { createFollowups, followupSummary } from '../core/followups.js';
import { can, populateAssignees, assigneeCell, matchesAssignee, userName } from '../core/auth.js';
import {
  $, esc, fmt, badge, kpiCard, rowActions, countBy, debounce, consumeParam,
  populateOptions, createTable, showError, CHANNEL_TONES,
} from '../core/ui.js';

initLayout({ page: 'leads', title: 'Lead Management', subtitle: 'บันทึกและติดตามลูกค้าเป้าหมายจากทุกช่องทาง' });

const STATUS_TONES = {
  นัดหมายเข้าชม: 'emerald',
  สอบถามรายละเอียด: 'sky',
  ติดต่อไม่ได้: 'amber',
  ไม่รับสาย: 'orange',
  ไม่สนใจ: 'rose',
};
const STATUS_COLORS = ['#16a34a', '#0ea5e9', '#f59e0b', '#f97316', '#e11d48'];

const state = { rows: [], options: null };
// filter-assignee only exists for users who see everyone's records.
const filters = { q: $('#filter-q'), status: $('#filter-status'), channel: $('#filter-channel'), assignee: $('#filter-assignee') };

const table = createTable($('#lead-table'), {
  columns: [
    { label: 'วันที่ลงทะเบียน', render: (r) => `<span class="whitespace-nowrap">${fmt.date(r.date)}</span>` },
    {
      label: 'ชื่อลูกค้า',
      render: (r) => `
        <div class="font-medium text-slate-800">${esc(r.name)}</div>
        <div class="text-xs text-slate-400 whitespace-nowrap">${esc(r.phone || '-')}${r.lineId ? ` · LINE: ${esc(r.lineId)}` : ''}</div>`,
    },
    { label: 'ช่องทาง', render: (r) => badge(r.channel, CHANNEL_TONES[r.channel]) },
    { label: 'งบประมาณ', render: (r) => `<span class="whitespace-nowrap">${esc(r.budget || '-')}</span>` },
    { label: 'สถานะ', render: (r) => badge(r.status, STATUS_TONES[r.status]) },
    { label: 'รายละเอียดการติดต่อ', class: 'min-w-[14rem] max-w-sm', render: (r) => `<p class="line-clamp-2 text-slate-500">${esc(r.detail || '-')}</p>${followupSummary(r.followups)}` },
    { label: 'ผู้รับผิดชอบ', render: (r) => assigneeCell(r) },
    { label: '', class: 'text-right', render: () => rowActions('', { edit: can('leads:write'), remove: can('leads:delete') }) },
  ],
  actions: {
    edit: (id, row) => form.open(row),
    delete: (id, row) => confirmDelete({ resource: 'leads', id, name: row.name, afterDelete: load }),
  },
});

const form = createCrudForm({
  resource: 'leads',
  modal: $('#lead-modal'),
  form: $('#lead-form'),
  titles: { create: 'เพิ่ม Lead ใหม่', edit: 'แก้ไขข้อมูล Lead' },
  defaults: () => ({ date: todayYMD(), status: 'สอบถามรายละเอียด' }),
  widgets: { followups: createFollowups($('#lead-form [data-followups]'), $('#lead-form [data-add-followup]')) },
  afterSave: load,
});

function renderKpis() {
  const { rows } = state;
  const by = (status) => rows.filter((r) => r.status === status).length;
  const unreachable = by('ติดต่อไม่ได้') + by('ไม่รับสาย');
  $('#kpis').innerHTML = [
    kpiCard({ label: 'Lead ทั้งหมด', value: fmt.num(rows.length), hint: 'ในช่วงเวลาที่เลือก', icon: 'leads' }),
    kpiCard({ label: 'นัดหมายเข้าชม', value: fmt.num(by('นัดหมายเข้าชม')), hint: `${fmt.pct(by('นัดหมายเข้าชม'), rows.length)} ของ Lead`, tone: 'emerald', icon: 'calendar' }),
    kpiCard({ label: 'สอบถามรายละเอียด', value: fmt.num(by('สอบถามรายละเอียด')), hint: 'กำลังติดตาม', tone: 'sky', icon: 'phone' }),
    kpiCard({ label: 'ติดต่อไม่ได้ / ไม่รับสาย', value: fmt.num(unreachable), hint: 'ควรติดต่อซ้ำ', tone: 'amber', icon: 'clock' }),
    kpiCard({ label: 'ไม่สนใจ', value: fmt.num(by('ไม่สนใจ')), hint: fmt.pct(by('ไม่สนใจ'), rows.length), tone: 'rose', icon: 'x' }),
  ].join('');
}

function renderCharts() {
  const { rows, options } = state;
  doughnutChart('chart-channel', countBy(rows, 'channel', options.leadChannels));
  barChart('chart-budget', countBy(rows, 'budget', options.budgets), { label: 'Lead' });
  barChart('chart-status', countBy(rows, 'status', options.leadStatuses), { horizontal: true, colors: STATUS_COLORS, label: 'Lead' });
}

function applyFilters() {
  const q = filters.q.value.trim().toLowerCase();
  const status = filters.status.value;
  const channel = filters.channel.value;
  const assignee = filters.assignee?.value || '';
  table.setRows(
    state.rows.filter(
      (r) =>
        (!status || r.status === status) &&
        (!channel || r.channel === channel) &&
        matchesAssignee(r, assignee) &&
        (!q || [r.name, r.phone, r.lineId, r.detail, userName(r.assignedTo), ...(r.followups || []).map((f) => f.note)].some((v) => (v || '').toLowerCase().includes(q))),
    ),
  );
}

async function load() {
  try {
    state.rows = await api.list('leads');
    renderKpis();
    renderCharts();
    applyFilters();
  } catch (err) {
    showError(err);
  }
}

async function init() {
  state.options = await api.options();
  populateOptions(document, state.options);
  populateAssignees();

  filters.q.addEventListener('input', debounce(applyFilters));
  filters.status.addEventListener('change', applyFilters);
  filters.channel.addEventListener('change', applyFilters);
  filters.assignee?.addEventListener('change', applyFilters);
  $('[data-new]')?.addEventListener('click', () => form.open());
  onRangeChange(load);

  await load();
  if (consumeParam('new') && can('leads:write')) form.open();
}

init().catch(showError);
