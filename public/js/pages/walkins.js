import { initLayout } from '../core/layout.js';
import { api } from '../core/api.js';
import { onRangeChange, todayYMD, withRange } from '../core/date-filter.js';
import { createCrudForm, confirmDelete } from '../core/crud.js';
import { doughnutChart, barChart, GRADE_COLORS } from '../core/charts.js';
import { icon } from '../core/icons.js';
import { createFollowups, followupSummary } from '../core/followups.js';
import { can, populateAssignees, assigneeCell, matchesAssignee, userName } from '../core/auth.js';
import {
  $, esc, fmt, badge, kpiCard, rowActions, countBy, bucketize, debounce, consumeParam,
  populateOptions, createTable, showError, CHANNEL_TONES, GRADE_TONES,
} from '../core/ui.js';

initLayout({ page: 'walkins', title: 'Walk In Management', subtitle: 'ข้อมูลลูกค้าที่เข้าชมโครงการและการประเมินศักยภาพ' });

const AGE_BUCKETS = [
  { label: 'ต่ำกว่า 25', max: 25 },
  { label: '25–34', min: 25, max: 35 },
  { label: '35–44', min: 35, max: 45 },
  { label: '45–54', min: 45, max: 55 },
  { label: '55 ขึ้นไป', min: 55 },
];
const INCOME_BUCKETS = [
  { label: '< 50K', max: 50000 },
  { label: '50K–100K', min: 50000, max: 100000 },
  { label: '100K–200K', min: 100000, max: 200000 },
  { label: '200K–300K', min: 200000, max: 300000 },
  { label: '300K+', min: 300000 },
];

const state = { rows: [], options: null };
// filter-assignee only exists for users who see everyone's records.
const filters = { q: $('#filter-q'), grade: $('#filter-grade'), media: $('#filter-media'), assignee: $('#filter-assignee') };

const gradeBadge = (grade) => badge(grade ? `Grade ${grade}` : '', GRADE_TONES[grade]);

const table = createTable($('#walkin-table'), {
  columns: [
    {
      label: 'วันที่ / เวลา',
      render: (r) => `<div class="whitespace-nowrap">${fmt.date(r.date)}</div><div class="text-xs text-slate-400">${esc(r.time || '')} น.</div>`,
    },
    {
      label: 'ลูกค้า',
      render: (r) => `
        <div class="font-medium text-slate-800 whitespace-nowrap">${esc(r.name)}</div>
        <div class="text-xs text-slate-400 whitespace-nowrap">${esc(r.phone || '-')}${r.lineId ? ` · LINE: ${esc(r.lineId)}` : ''}</div>`,
    },
    { label: 'ช่องทางสื่อ', render: (r) => badge(r.media, CHANNEL_TONES[r.media]) },
    { label: 'งบประมาณ', render: (r) => `<span class="whitespace-nowrap">${esc(r.budget || '-')}</span>` },
    {
      label: 'ข้อมูลลูกค้า',
      render: (r) =>
        `<div class="whitespace-nowrap">${esc(r.occupation || '-')}</div><div class="text-xs text-slate-400 whitespace-nowrap">${[r.gender, r.age ? `${r.age} ปี` : '', r.income ? `${fmt.num(r.income)} บ./ด.` : ''].filter(Boolean).map(esc).join(' · ') || '-'}</div>`,
    },
    { label: 'สถานะ', render: (r) => `${gradeBadge(r.grade)}${followupSummary(r.followups)}` },
    { label: 'ฝ่ายขาย', render: (r) => assigneeCell(r, r.salesperson) },
    {
      label: '',
      class: 'text-right',
      render: (r) =>
        rowActions(
          // Booking is a Manager/Admin step, so the shortcut only shows for them.
          can('bookings:write')
            ? `<a class="btn btn-soft btn-sm mr-1" data-range-link="/bookings?walkinId=${encodeURIComponent(r.id)}" href="${withRange(`/bookings?walkinId=${encodeURIComponent(r.id)}`)}" title="สร้างการจองจากลูกค้ารายนี้">${icon('bookings', 'w-4 h-4')} จอง</a>`
            : '',
          { edit: can('walkins:write'), remove: can('walkins:delete') },
        ),
    },
  ],
  actions: {
    edit: (id, row) => form.open(row),
    delete: (id, row) => confirmDelete({ resource: 'walkins', id, name: row.name, afterDelete: load }),
  },
});

const form = createCrudForm({
  resource: 'walkins',
  modal: $('#walkin-modal'),
  form: $('#walkin-form'),
  titles: { create: 'บันทึก Walk In', edit: 'แก้ไขข้อมูล Walk In' },
  defaults: () => {
    const now = new Date();
    return { date: todayYMD(), time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` };
  },
  widgets: { followups: createFollowups($('#walkin-form [data-followups]'), $('#walkin-form [data-add-followup]')) },
  afterSave: load,
});

function renderGradeOptions(grades) {
  $('#grade-options').innerHTML = grades
    .map((g) => {
      const [title, desc] = g.label.split(' : ');
      return `
        <label class="grade-option">
          <input type="radio" name="grade" value="${esc(g.value)}" required>
          <span class="grade-letter" style="background:${GRADE_COLORS[g.value]}">${esc(g.value)}</span>
          <span><b>${esc(title)}</b><small>${esc(desc || '')}</small></span>
        </label>`;
    })
    .join('');
}

function renderKpis() {
  const { rows } = state;
  const by = (g) => rows.filter((r) => r.grade === g).length;
  $('#kpis').innerHTML = [
    kpiCard({ label: 'Walk In ทั้งหมด', value: fmt.num(rows.length), hint: 'ในช่วงเวลาที่เลือก', icon: 'walkins' }),
    kpiCard({ label: 'Grade A · ตัดสินใจจอง', value: fmt.num(by('A')), hint: fmt.pct(by('A'), rows.length), tone: 'emerald', icon: 'check' }),
    kpiCard({ label: 'Grade B · สนใจ/ต่อรอง', value: fmt.num(by('B')), hint: fmt.pct(by('B'), rows.length), tone: 'blue', icon: 'chart' }),
    kpiCard({ label: 'Grade C · พิจารณา', value: fmt.num(by('C')), hint: fmt.pct(by('C'), rows.length), tone: 'amber', icon: 'clock' }),
    kpiCard({ label: 'Grade D · ไม่มีศักยภาพ', value: fmt.num(by('D')), hint: fmt.pct(by('D'), rows.length), tone: 'slate', icon: 'x' }),
  ].join('');
}

function renderCharts() {
  const { rows, options } = state;
  doughnutChart('chart-media', countBy(rows, 'media', options.mediaChannels));
  barChart('chart-reasons', countBy(rows, 'reasons', options.visitReasons), { horizontal: true, label: 'ครั้งที่ถูกเลือก' });
  barChart('chart-budget', countBy(rows, 'budget', options.budgets), { label: 'Walk In' });
  const grades = countBy(rows, 'grade', options.grades);
  doughnutChart('chart-grade', { labels: grades.labels.map((g) => `Grade ${g}`), data: grades.data }, { colors: grades.labels.map((g) => GRADE_COLORS[g]) });
  doughnutChart('chart-gender', countBy(rows, 'gender', options.genders), { colors: ['#284772', '#d6597a', '#7c6cb0'] });
  barChart('chart-age', bucketize(rows, 'age', AGE_BUCKETS), { label: 'Walk In', colors: '#2a9d8f' });
  barChart('chart-occupation', countBy(rows, 'occupation', options.occupations), { horizontal: true, label: 'Walk In' });
  barChart('chart-income', bucketize(rows, 'income', INCOME_BUCKETS), { label: 'Walk In', colors: '#c39a3c' });
}

function applyFilters() {
  const q = filters.q.value.trim().toLowerCase();
  const grade = filters.grade.value;
  const media = filters.media.value;
  const assignee = filters.assignee?.value || '';
  table.setRows(
    state.rows.filter(
      (r) =>
        (!grade || r.grade === grade) &&
        (!media || r.media === media) &&
        matchesAssignee(r, assignee) &&
        (!q || [r.name, r.phone, r.lineId, r.homeDistrict, r.workDistrict, userName(r.assignedTo) || r.salesperson, r.detail, ...(r.followups || []).map((f) => f.note)].some((v) => (v || '').toLowerCase().includes(q))),
    ),
  );
}

async function load() {
  try {
    state.rows = await api.list('walkins');
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
  renderGradeOptions(state.options.grades);
  populateAssignees();

  filters.q.addEventListener('input', debounce(applyFilters));
  [filters.grade, filters.media, filters.assignee].forEach((el) => el?.addEventListener('change', applyFilters));
  $('[data-new]')?.addEventListener('click', () => form.open());
  onRangeChange(load);

  await load();
  if (consumeParam('new') && can('walkins:write')) form.open();
}

init().catch(showError);
