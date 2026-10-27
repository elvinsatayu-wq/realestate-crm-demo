/* Thin wrappers over Chart.js (loaded globally from the CDN). */

export const PALETTE = ['#284772', '#c39a3c', '#2a9d8f', '#e76f51', '#7c6cb0', '#4c8bf5', '#8ab17d', '#d6597a'];
export const GRADE_COLORS = { A: '#16a34a', B: '#2563eb', C: '#f59e0b', D: '#94a3b8' };
export const STAGE_COLORS = { leads: '#4c8bf5', walkins: '#2a9d8f', bookings: '#c39a3c', transfers: '#284772' };

const FONT = '"IBM Plex Sans Thai", system-ui, sans-serif';
const Chart = window.Chart;

if (Chart) {
  Chart.defaults.font.family = FONT;
  Chart.defaults.font.size = 12;
  Chart.defaults.color = '#64748b';
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.boxHeight = 8;
  Chart.defaults.plugins.tooltip.backgroundColor = '#111d30';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;

  // Draws a friendly message when every value is zero.
  Chart.register({
    id: 'emptyState',
    afterDraw(chart) {
      const total = chart.data.datasets.reduce((s, d) => s + d.data.reduce((a, b) => a + (Number(b) || 0), 0), 0);
      if (total) return;
      const { ctx, chartArea: area } = chart;
      if (!area) return;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#94a3b8';
      ctx.font = `14px ${FONT}`;
      ctx.fillText('ไม่มีข้อมูลในช่วงเวลานี้', (area.left + area.right) / 2, (area.top + area.bottom) / 2);
      ctx.restore();
    },
  });
}

const instances = new Map();

export function renderChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !Chart) return null;
  instances.get(canvasId)?.destroy();
  const chart = new Chart(canvas, config);
  instances.set(canvasId, chart);
  return chart;
}

// `colors` may be an array (per item), a single color string, or omitted (palette).
const colorsFor = (n, colors) => colors || Array.from({ length: n }, (_, i) => PALETTE[i % PALETTE.length]);
const GRID = { color: '#eef2f6', drawTicks: false };
const pctOf = (value, data) => {
  const total = data.reduce((a, b) => a + b, 0);
  return total ? ` (${((value / total) * 100).toFixed(1)}%)` : '';
};

export function doughnutChart(canvasId, { labels, data }, { colors, legend = 'bottom' } = {}) {
  return renderChart(canvasId, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colorsFor(labels.length, colors), borderColor: '#fff', borderWidth: 2, hoverOffset: 6 }] },
    options: {
      cutout: '66%',
      plugins: {
        legend: { position: legend },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed.toLocaleString('th-TH')}${pctOf(ctx.parsed, data)}` } },
      },
    },
  });
}

export function barChart(canvasId, { labels, data }, { horizontal = false, colors, label = 'จำนวน', money = false } = {}) {
  const valueAxis = {
    beginAtZero: true,
    grid: GRID,
    border: { display: false },
    ticks: { precision: 0, callback: money ? (v) => `${(v / 1e6).toLocaleString('th-TH')}M` : undefined },
  };
  const categoryAxis = { grid: { display: false }, border: { display: false } };
  return renderChart(canvasId, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: colorsFor(labels.length, colors), borderRadius: 6, maxBarThickness: 34 }],
    },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = horizontal ? ctx.parsed.x : ctx.parsed.y;
              return money ? ` ฿${v.toLocaleString('th-TH')}` : ` ${label}: ${v.toLocaleString('th-TH')}${pctOf(v, data)}`;
            },
          },
        },
      },
      scales: horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
    },
  });
}

/** datasets: [{ label, data, color }] */
export function lineChart(canvasId, { labels, datasets }) {
  return renderChart(canvasId, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map((d, i) => ({
        label: d.label,
        data: d.data,
        borderColor: d.color,
        backgroundColor: `${d.color}1f`,
        fill: i === 0,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: labels.length > 40 ? 0 : 2.5,
        pointHoverRadius: 5,
      })),
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', align: 'end' } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
        y: { beginAtZero: true, grid: GRID, border: { display: false }, ticks: { precision: 0 } },
      },
    },
  });
}
