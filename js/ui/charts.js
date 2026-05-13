'use strict';

// ─── Chart instance registry ──────────────────────────────────────────────────
const _charts = {};

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

function destroyAllCharts() {
  for (const id of Object.keys(_charts)) destroyChart(id);
}

// ─── Shared Chart.js defaults ─────────────────────────────────────────────────
Chart.defaults.font.family =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
Chart.defaults.font.size = 12;

// ─── Donut chart ─────────────────────────────────────────────────────────────
// items: [{ name, color, value }]
function createDonutChart(canvas, items) {
  const id = canvas.id;
  destroyChart(id);

  const total = items.reduce((s, i) => s + i.value, 0);

  _charts[id] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: items.map(i => i.name),
      datasets: [{
        data:            items.map(i => i.value),
        backgroundColor: items.map(i => i.color),
        borderWidth: 3,
        borderColor: '#fff',
        hoverBorderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      cutout: '62%',
      animation: { duration: 350 },
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.raw;
              const pct = total > 0 ? (val / total * 100).toFixed(1) : '0.0';
              return `  ${ctx.label}: ${val.toLocaleString('ko-KR')}원 (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ─── Projection chart ────────────────────────────────────────────────────────
// proj: { timeline, projDates?, projValues?, goalAmount, reached? }
function createProjectionChart(canvas, proj) {
  const id = canvas.id;
  destroyChart(id);

  const { timeline, projDates = [], projValues = [], goalAmount, reached = false } = proj;
  const histDates  = timeline.map(p => p.date);
  const histValues = timeline.map(p => p.totalValue);

  const allDates = reached ? histDates : [...histDates, ...projDates];

  // Historical dataset
  const histFull = reached
    ? histValues
    : [...histValues, ...new Array(projDates.length).fill(null)];

  // Projection dataset (null when reached)
  const projFull = (!reached && projDates.length > 0)
    ? [...new Array(histDates.length - 1).fill(null), histValues[histValues.length - 1], ...projValues]
    : null;

  // Goal line
  const goalFull = new Array(allDates.length).fill(goalAmount);

  const yTickFmt = v => {
    if (v >= 100_000_000) return (v / 100_000_000).toFixed(1) + '억';
    if (v >= 10_000)      return (v / 10_000).toFixed(0) + '만';
    return v.toLocaleString('ko-KR');
  };

  const datasets = [
    {
      label: '실제 자산',
      data: histFull,
      borderColor: '#2E75B6',
      backgroundColor: 'rgba(46,117,182,0.07)',
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 5,
      fill: true,
      tension: 0.3,
      spanGaps: false,
    },
    {
      label: '목표 금액',
      data: goalFull,
      borderColor: '#F59E0B',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false,
    },
  ];

  if (projFull) {
    datasets.splice(1, 0, {
      label: '예상 자산',
      data: projFull,
      borderColor: '#2E75B6',
      borderDash: [6, 4],
      backgroundColor: 'rgba(46,117,182,0.03)',
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 5,
      fill: true,
      tension: 0.3,
      spanGaps: false,
    });
  }

  _charts[id] = new Chart(canvas, {
    type: 'line',
    data: { labels: allDates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 12,
          filter: item => item.raw !== null && item.raw !== undefined,
          callbacks: {
            title: ctx => ctx[0]?.label ?? '',
            label: ctx => {
              if (ctx.raw == null) return null;
              return `  ${ctx.dataset.label}: ${ctx.raw.toLocaleString('ko-KR')}원`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: 8,
            color: '#9CA3AF',
            font: { size: 11 },
            callback(val) {
              const s = this.getLabelForValue(val) ?? String(val);
              return s.length >= 10 ? s.slice(5).replace('-', '/') : s;
            },
          },
        },
        y: {
          grid: { color: '#F3F4F6' },
          ticks: { color: '#9CA3AF', font: { size: 11 }, callback: yTickFmt },
        },
      },
    },
  });
}

// ─── Line chart ──────────────────────────────────────────────────────────────
// timeline: [{ date, totalValue, netDeposit }]
// cashFlowDates: Set<string>
function createLineChart(canvas, timeline, cashFlowDates) {
  const id = canvas.id;
  destroyChart(id);

  if (!timeline || timeline.length === 0) return;

  const labels    = timeline.map(p => p.date);
  const valData   = timeline.map(p => p.totalValue);
  const depData   = timeline.map(p => p.netDeposit);

  // Emphasize points on cash-flow dates
  const ptRadius  = labels.map(d => (cashFlowDates && cashFlowDates.has(d)) ? 5 : (timeline.length === 1 ? 4 : 2));
  const ptBg      = labels.map(d => (cashFlowDates && cashFlowDates.has(d)) ? '#4F46E5' : '#2E75B6');
  const ptBorder  = labels.map(d => (cashFlowDates && cashFlowDates.has(d)) ? '#fff' : '#2E75B6');

  _charts[id] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '총 평가액',
          data: valData,
          borderColor: '#2E75B6',
          backgroundColor: 'rgba(46,117,182,0.07)',
          borderWidth: 2.5,
          pointRadius: ptRadius,
          pointBackgroundColor: ptBg,
          pointBorderColor: ptBorder,
          pointBorderWidth: 1.5,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.3,
        },
        {
          label: '순투입금',
          data: depData,
          borderColor: '#9CA3AF',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#9CA3AF',
          fill: false,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 12,
          callbacks: {
            title: ctx => ctx[0]?.label ?? '',
            label: ctx => {
              const val = ctx.raw;
              return `  ${ctx.dataset.label}: ${val.toLocaleString('ko-KR')}원`;
            },
            footer: ctx => {
              const date = ctx[0]?.label;
              if (date && cashFlowDates && cashFlowDates.has(date)) {
                return '▲ 입출금 발생일';
              }
              return '';
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: 8,
            color: '#9CA3AF',
            font: { size: 11 },
            callback(val) {
              const s = this.getLabelForValue(val) ?? String(val);
              return s.length >= 10 ? s.slice(5).replace('-', '/') : s;
            },
          },
        },
        y: {
          grid: { color: '#F3F4F6' },
          ticks: {
            color: '#9CA3AF',
            font: { size: 11 },
            callback(v) {
              if (v >= 100_000_000) return (v / 100_000_000).toFixed(1) + '억';
              if (v >= 10_000)      return (v / 10_000).toFixed(0) + '만';
              return v.toLocaleString('ko-KR');
            },
          },
        },
      },
    },
  });
}
