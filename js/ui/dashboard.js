'use strict';

// ─── Module state ─────────────────────────────────────────────────────────────
let _donutMode   = 'category'; // 'category' | 'account'
let _dashboardGen = 0;         // prevents stale rAF callbacks after fast re-renders

const PERIOD_LABELS = {
  '1m': '1개월', '3m': '3개월', '6m': '6개월',
  '1y': '1년', '3y': '3년', '5y': '5년', 'all': '전체',
};

// ─── Period helpers ───────────────────────────────────────────────────────────
function getPeriodDates() {
  const today  = toDateStr(new Date());
  const period = store.ui.period || 'all';

  let startDate;
  if (period === '1m') {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    startDate = toDateStr(d);
  } else if (period === '3m') {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    startDate = toDateStr(d);
  } else if (period === '6m') {
    const d = new Date(); d.setMonth(d.getMonth() - 6);
    startDate = toDateStr(d);
  } else if (period === '1y') {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1);
    startDate = toDateStr(d);
  } else if (period === '3y') {
    const d = new Date(); d.setFullYear(d.getFullYear() - 3);
    const cap3 = toDateStr(d);
    const first3 = [...store.transactions].map(t => t.date).sort()[0] ?? today;
    startDate = first3 > cap3 ? first3 : cap3;
  } else if (period === '5y') {
    const d = new Date(); d.setFullYear(d.getFullYear() - 5);
    const cap5 = toDateStr(d);
    const first5 = [...store.transactions].map(t => t.date).sort()[0] ?? today;
    startDate = first5 > cap5 ? first5 : cap5;
  } else {
    // 'all': earliest transaction date, capped at 5 years
    const sorted = [...store.transactions].map(t => t.date).sort();
    const earliest = sorted.length > 0 ? sorted[0] : today;
    const cap = new Date(); cap.setFullYear(cap.getFullYear() - 5);
    const capStr = toDateStr(cap);
    startDate = earliest > capStr ? earliest : capStr;
  }

  return { startDate, endDate: today };
}

// Portfolio-level TWR using sub-period boundaries at each cash flow event
function getPortfolioTWR(startDate, endDate) {
  const active = store.accounts.filter(a => !a.isArchived);
  if (active.length === 0) return { ret: null, plAbs: 0, startInterpolated: false };

  let effectiveStart    = startDate;
  let startInterpolated = false;

  // No valuation at startDate — clip to earliest date that has valuation data
  const hasData = active.some(a => getValuationAt(a.id, store.transactions, effectiveStart).value > 0);
  if (!hasData) {
    const valDates = store.transactions
      .filter(t => active.some(a => a.id === t.accountId) && t.valuation != null && t.valuation > 0)
      .map(t => t.date).sort();
    if (valDates.length === 0) return { ret: null, plAbs: 0, startInterpolated: false };
    effectiveStart    = valDates[0];
    startInterpolated = true;
  } else {
    startInterpolated = active.some(a => getValuationAt(a.id, store.transactions, effectiveStart).interpolated);
  }

  const cfDates = [...new Set(
    store.transactions
      .filter(t => active.some(a => a.id === t.accountId)
                && (t.type === 'deposit' || t.type === 'withdraw')
                && t.date > effectiveStart && t.date <= endDate)
      .map(t => t.date)
  )].sort();

  const bounds = [effectiveStart, ...cfDates, endDate];
  let twr = 1, computed = false;

  for (let i = 0; i < bounds.length - 1; i++) {
    const pS = bounds[i], pE = bounds[i + 1];
    if (pS === pE) continue;
    const vS = active.reduce((s, a) => s + getValuationAt(a.id, store.transactions, pS).value, 0);
    if (vS === 0) continue;
    computed = true;
    const vE = active.reduce((s, a) => s + getValuationAt(a.id, store.transactions, pE).value, 0);
    const cf = store.transactions
      .filter(t => active.some(a => a.id === t.accountId)
                && t.date === pE && (t.type === 'deposit' || t.type === 'withdraw'))
      .reduce((s, t) => s + (t.type === 'deposit' ? t.amount : -t.amount), 0);
    twr *= (1 + (vE - cf - vS) / vS);
  }

  const endTotal   = getTotalAssets(store.accounts, store.transactions);
  const startTotal = active.reduce((s, a) => s + getValuationAt(a.id, store.transactions, effectiveStart).value, 0);
  const netDep     = active.reduce((s, a) =>
    s + getNetDeposit(a.id, store.transactions, endDate)
      - getNetDeposit(a.id, store.transactions, effectiveStart), 0);
  const plAbs = endTotal - startTotal - netDep;

  if (!computed) return { ret: null, plAbs, startInterpolated };
  return { ret: (twr - 1) * 100, plAbs, startInterpolated };
}

// Portfolio-level period return across all active accounts
function getPortfolioReturn(startDate, endDate) {
  const active = store.accounts.filter(a => !a.isArchived);
  if (active.length === 0) return { ret: null, plAbs: 0, startInterpolated: false };

  let effectiveStart   = startDate;
  let startInterpolated = false;
  let startTotal = active.reduce((s, a) => s + getValuationAt(a.id, store.transactions, effectiveStart).value, 0);

  // No valuation at startDate — clip to earliest date that has valuation data
  if (startTotal === 0) {
    const valDates = store.transactions
      .filter(t => active.some(a => a.id === t.accountId) && t.valuation != null && t.valuation > 0)
      .map(t => t.date).sort();
    if (valDates.length === 0) return { ret: null, plAbs: 0, startInterpolated: false };
    effectiveStart = valDates[0];
    startTotal = active.reduce((s, a) => s + getValuationAt(a.id, store.transactions, effectiveStart).value, 0);
    startInterpolated = true;
    if (startTotal === 0) return { ret: null, plAbs: 0, startInterpolated };
  } else {
    startInterpolated = active.some(a => getValuationAt(a.id, store.transactions, effectiveStart).interpolated);
  }

  const endTotal = getTotalAssets(store.accounts, store.transactions);
  const netDepInPeriod = active.reduce((sum, acc) =>
    sum + getNetDeposit(acc.id, store.transactions, endDate)
        - getNetDeposit(acc.id, store.transactions, effectiveStart), 0
  );

  const plAbs = endTotal - startTotal - netDepInPeriod;
  const ret   = (plAbs / startTotal) * 100;
  return { ret, plAbs, startInterpolated };
}

// Bundle items beyond maxSlices into "기타"
function bundleSmallSlices(items, maxSlices = 5) {
  const nonZero = items.filter(i => i.value > 0);
  if (nonZero.length <= maxSlices) return nonZero;

  const sorted = [...nonZero].sort((a, b) => b.value - a.value);
  const main   = sorted.slice(0, maxSlices);
  const rest   = sorted.slice(maxSlices);
  const total  = nonZero.reduce((s, i) => s + i.value, 0);
  const otherVal = rest.reduce((s, i) => s + i.value, 0);

  return [
    ...main,
    { name: '기타', color: '#D1D5DB', value: otherVal,
      ratio: total > 0 ? otherVal / total : 0 },
  ];
}

// ─── Main entry ───────────────────────────────────────────────────────────────
function renderDashboard() {
  destroyAllCharts();
  const gen = ++_dashboardGen;

  const active = store.accounts.filter(a => !a.isArchived);
  const wrap   = h('div', { className: 'dashboard' });

  // ── Period bar (always shown) ────────────────────────────
  wrap.appendChild(renderPeriodBar());

  // ── Edge case: no active accounts ────────────────────────
  if (active.length === 0) {
    const emptyMsg = store.accounts.length > 0
      ? '모든 계좌가 제외됨 상태입니다.'
      : '계좌를 먼저 추가해주세요.';
    wrap.appendChild(
      h('div', { className: 'dash-empty' },
        h('p',      { className: 'dash-empty-text', textContent: emptyMsg }),
        h('button', { className: 'btn btn-primary btn-lg', textContent: '+ 계좌 추가하기',
          onclick: () => navigate('accounts') })
      )
    );
    return wrap;
  }

  // ── Compute shared data ──────────────────────────────────
  const { startDate, endDate } = getPeriodDates();
  const totalAssets  = getTotalAssets(store.accounts, store.transactions);
  const { ret, plAbs, startInterpolated } = store.ui.useTWR
    ? getPortfolioTWR(startDate, endDate)
    : getPortfolioReturn(startDate, endDate);
  const periodLabel  = PERIOD_LABELS[store.ui.period || 'all'];
  // 거래 0건이면 빈 배열 → 라인 차트 빈 상태 표시
  const timeline = store.transactions.length > 0
    ? getTotalAssetTimeline(store.accounts, store.transactions, startDate, endDate)
    : [];

  const cashFlowDates = new Set(
    store.transactions
      .filter(t => (t.type === 'deposit' || t.type === 'withdraw')
                && t.date >= startDate && t.date <= endDate)
      .map(t => t.date)
  );

  // ── Hero ─────────────────────────────────────────────────
  wrap.appendChild(renderHero(totalAssets, ret, plAbs, startInterpolated, periodLabel));

  // ── Donut card ────────────────────────────────────────────
  wrap.appendChild(renderDonutCard());

  // ── Line chart card ───────────────────────────────────────
  wrap.appendChild(renderLineCard(timeline));

  // ── Account summary ───────────────────────────────────────
  wrap.appendChild(renderAccountSummary(active));

  // ── Goal projection card ──────────────────────────────────
  const goalCard = renderGoalProjectionCard();
  if (goalCard) wrap.appendChild(goalCard);

  // Build charts after the DOM tree is appended by render()
  requestAnimationFrame(() => {
    if (_dashboardGen !== gen) return; // stale — a newer render already fired
    _buildDonutChart();
    _buildLineChart(timeline, cashFlowDates);
    _buildGoalProjectionCharts();
  });

  return wrap;
}

// ─── Period segmented control ─────────────────────────────────────────────────
function renderPeriodBar() {
  const current = store.ui.period || 'all';

  const wrap = h('div', { className: 'period-segment-wrap' });
  const seg  = h('div', { className: 'period-segment' });

  // Sliding indicator — positioned after mount via rAF
  const indicator = h('div', { id: 'period-indicator', className: 'period-segment-indicator' });
  seg.appendChild(indicator);

  for (const p of ['all', '1m', '3m', '6m', '1y', '3y', '5y']) {
    seg.appendChild(h('button', {
      className: 'period-seg-btn' + (p === current ? ' active' : ''),
      textContent: PERIOD_LABELS[p],
      'data-period': p,
    }));
  }

  seg.addEventListener('click', e => {
    const btn = e.target.closest('[data-period]');
    if (!btn) return;
    const p = btn.getAttribute('data-period');
    if (p === (store.ui.period || 'all')) return;
    store.ui.period = p;
    saveStore(store);
    render();
  });

  wrap.appendChild(seg);

  // Position indicator once the element is in the DOM
  requestAnimationFrame(() => {
    const activeBtn = seg.querySelector('.period-seg-btn.active');
    if (!activeBtn || !indicator.isConnected) return;
    const segRect = seg.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    indicator.style.left   = (btnRect.left - segRect.left) + 'px';
    indicator.style.top    = (btnRect.top  - segRect.top)  + 'px';
    indicator.style.width  = btnRect.width  + 'px';
    indicator.style.height = btnRect.height + 'px';
    // Fade in the indicator after positioning to avoid initial jump
    indicator.style.opacity = '1';
  });

  return wrap;
}

// ─── Hero section ─────────────────────────────────────────────────────────────
function renderHero(totalAssets, ret, plAbs, startInterpolated, periodLabel) {
  const hero = h('div', { className: 'dash-hero' });

  // Sub-label
  hero.appendChild(h('p', { className: 'dash-hero-label', textContent: '총 자산' }));

  // Big number
  const totalEl = h('div', { className: 'dash-total-assets' });
  totalEl.appendChild(h('span', { className: 'dash-total-currency', textContent: '₩' }));
  totalEl.appendChild(document.createTextNode(Math.round(totalAssets).toLocaleString('ko-KR')));
  hero.appendChild(totalEl);

  // Return row
  const retRow = h('div', { className: 'dash-return-row' });

  if (ret === null) {
    // No ratio return (start value = 0 or no data)
    retRow.appendChild(h('span', { className: 'dash-return-rate text-neutral', textContent: '—' }));
    retRow.appendChild(h('span', { className: 'dash-return-label' })).textContent = `  (${periodLabel})`;

    if (plAbs !== 0) {
      const absEl = h('span', { className: 'dash-return-abs' + (plAbs >= 0 ? ' text-profit' : ' text-loss') });
      absEl.textContent = `  ${plAbs >= 0 ? '+' : ''}${formatKRW(plAbs)}`;
      retRow.appendChild(absEl);
    }
  } else {
    const cls   = ret > 0 ? 'text-profit' : ret < 0 ? 'text-loss' : 'text-neutral';
    const sign  = ret >= 0 ? '+' : '';
    const asign = plAbs >= 0 ? '+' : '';

    const rateEl = h('span', { className: `dash-return-rate ${cls}` });
    rateEl.textContent = `${sign}${ret.toFixed(2)}%`;
    retRow.appendChild(rateEl);

    const lblEl = h('span', { className: 'dash-return-label' });
    lblEl.textContent = `  (${periodLabel})`;
    retRow.appendChild(lblEl);

    const absEl = h('span', { className: `dash-return-abs ${cls}` });
    absEl.textContent = `  ${asign}${formatKRW(plAbs)}`;
    retRow.appendChild(absEl);
  }

  hero.appendChild(retRow);
  return hero;
}

// ─── Donut card (shell — chart built in rAF) ──────────────────────────────────
function renderDonutCard() {
  const card = h('div', { className: 'dash-card' });

  // Header + toggle
  const toggle = h('div', { className: 'chart-toggle' });
  for (const [mode, label] of [['category', '카테고리별'], ['account', '계좌별']]) {
    toggle.appendChild(h('button', {
      className: 'chart-toggle-btn' + (_donutMode === mode ? ' active' : ''),
      textContent: label,
      'data-mode': mode,
    }));
  }
  toggle.addEventListener('click', e => {
    const btn = e.target.closest('[data-mode]');
    if (!btn || btn.getAttribute('data-mode') === _donutMode) return;
    _donutMode = btn.getAttribute('data-mode');
    render();
  });

  card.appendChild(
    h('div', { className: 'dash-card-header' },
      h('h3', { className: 'dash-card-title', textContent: '자산 배분' }),
      toggle
    )
  );

  // Body: canvas + legend placeholder
  const body = h('div', { className: 'dash-donut-body' });

  const canvasWrap = h('div', { className: 'dash-donut-canvas-wrap' },
    h('canvas', { id: 'donut-chart' })
  );
  body.appendChild(canvasWrap);
  body.appendChild(h('div', { id: 'donut-legend', className: 'chart-legend' }));
  card.appendChild(body);
  return card;
}

function _buildDonutChart() {
  const canvas = document.getElementById('donut-chart');
  const legendEl = document.getElementById('donut-legend');
  if (!canvas || !legendEl) return;

  let rawItems;
  if (_donutMode === 'category') {
    rawItems = getCategoryBreakdown(store.accounts, store.transactions, store.categories)
      .map(r => ({ name: r.name, color: r.color, value: r.value }));
  } else {
    rawItems = getAccountBreakdown(store.accounts, store.transactions)
      .map(r => ({ name: r.name, color: r.color, value: r.value }));
  }

  const items = bundleSmallSlices(rawItems);

  if (items.length === 0) {
    const msg = h('p', { className: 'chart-empty', textContent: '데이터 없음' });
    canvas.parentElement.appendChild(msg);
    return;
  }

  createDonutChart(canvas, items);

  // Build legend (safe: all values derived from numbers or our own data)
  const total = items.reduce((s, i) => s + i.value, 0);
  legendEl.innerHTML = ''; // safe — we immediately re-populate with controlled data
  for (const item of items) {
    const pct = total > 0 ? (item.value / total * 100).toFixed(1) + '%' : '0%';
    const row = h('div', { className: 'legend-row' });
    const dot = h('span', { className: 'legend-dot' });
    dot.style.background = item.color;
    row.appendChild(dot);
    row.appendChild(h('span', { className: 'legend-name', textContent: item.name }));
    const right = h('span', { className: 'legend-right' });
    right.appendChild(h('span', { className: 'legend-value' })).textContent = formatKRW(item.value);
    right.appendChild(h('span', { className: 'legend-pct' })).textContent = pct;
    row.appendChild(right);
    legendEl.appendChild(row);
  }
}

// ─── Line chart card ──────────────────────────────────────────────────────────
function renderLineCard(timeline) {
  const card = h('div', { className: 'dash-card' });

  // Legend items (visual only — no chart data yet)
  const lineLegend = h('div', { className: 'line-legend' });
  for (const [label, color, dashed] of [
    ['총 평가액', '#2E75B6', false],
    ['순투입금',  '#9CA3AF', true],
  ]) {
    const item = h('div', { className: 'line-legend-item' });
    const line = h('span', { className: 'line-legend-line' + (dashed ? ' dashed' : '') });
    line.style.borderColor = color;
    item.appendChild(line);
    item.appendChild(h('span', { className: 'line-legend-label', textContent: label }));
    lineLegend.appendChild(item);
  }

  const trendTitleWrap = h('div', { className: 'dash-trend-title-wrap' });
  trendTitleWrap.appendChild(h('h3', { className: 'dash-card-title', textContent: '자산 추이' }));
  trendTitleWrap.appendChild(h('span', { className: 'dash-trend-cap', textContent: '최대 5년' }));
  card.appendChild(
    h('div', { className: 'dash-card-header' },
      trendTitleWrap,
      lineLegend
    )
  );

  const wrap = h('div', { className: 'dash-line-wrap' });
  if (!timeline || timeline.length === 0) {
    wrap.appendChild(h('p', { className: 'chart-empty',
      textContent: '해당 기간에 거래 데이터가 없습니다.' }));
  } else {
    wrap.appendChild(h('canvas', { id: 'line-chart' }));
  }
  card.appendChild(wrap);
  return card;
}

function _buildLineChart(timeline, cashFlowDates) {
  const canvas = document.getElementById('line-chart');
  if (!canvas) return;
  createLineChart(canvas, timeline, cashFlowDates);
}

// ─── Account summary (starred, top 3, horizontal cards) ──────────────────────
function renderAccountSummary(active) {
  const card = h('div', { className: 'dash-card' });

  card.appendChild(
    h('div', { className: 'dash-card-header' },
      h('h3', { className: 'dash-card-title', textContent: '계좌별 현황' }),
      h('button', { className: 'btn btn-ghost btn-sm', textContent: '전체 보기 →',
        onclick: () => navigate('accounts') })
    )
  );

  const starred = active.filter(a => a.isStarred);
  const sorted = [...starred]
    .sort((a, b) =>
      getCurrentValuation(b.id, store.transactions) -
      getCurrentValuation(a.id, store.transactions)
    )
    .slice(0, 3);

  if (sorted.length === 0) {
    card.appendChild(
      h('div', { className: 'dash-acct-empty' },
        h('p', { className: 'dash-acct-empty-text',
          textContent: '⭐ 계좌 목록에서 즐겨찾기한 계좌가 여기에 표시됩니다' })
      )
    );
  } else {
    const list = h('div', { className: 'dash-account-list' });
    for (const acc of sorted) list.appendChild(renderAccountCardHorizontal(acc));
    list.addEventListener('click', e => {
      const cardEl = e.target.closest('[data-account-id]');
      if (cardEl) navigate('account-detail', { accountId: cardEl.getAttribute('data-account-id') });
    });
    card.appendChild(list);
  }

  return card;
}

function renderAccountCardHorizontal(acc) {
  const valuation = getCurrentValuation(acc.id, store.transactions);
  const pl        = getProfitLoss(acc.id, store.transactions);
  const ret       = getSimpleReturn(acc.id, store.transactions);
  const plClass   = pl > 0 ? 'text-profit' : pl < 0 ? 'text-loss' : 'text-neutral';
  const plSign    = pl > 0 ? '+' : '';
  const retSign   = ret > 0 ? '+' : '';

  const card = h('div', { className: 'account-card-h', 'data-account-id': acc.id });

  const bar = h('div', { className: 'account-card-h-bar' });
  bar.style.background = acc.color || '#828282';
  card.appendChild(bar);

  const content = h('div', { className: 'account-card-h-content' });

  const top = h('div', { className: 'account-card-h-top' });
  const nameEl = h('div', { className: 'account-card-h-name' });
  if (acc.emoji) nameEl.appendChild(h('span', { textContent: acc.emoji + ' ' }));
  nameEl.appendChild(document.createTextNode(acc.name));
  top.appendChild(nameEl);

  const badges = h('div', { className: 'account-card-h-badges' });
  const catName = store.categories.find(c => c.id === acc.category)?.name ?? acc.category;
  badges.appendChild(h('span', { className: 'badge badge-category', textContent: catName }));
  if (acc.purpose) badges.appendChild(h('span', { className: 'badge badge-purpose', textContent: acc.purpose }));
  top.appendChild(badges);
  content.appendChild(top);

  const bottom = h('div', { className: 'account-card-h-bottom' });
  const valEl = h('div', { className: 'account-card-h-val' });
  valEl.appendChild(h('span', { className: 'card-currency', textContent: '₩' }));
  valEl.appendChild(document.createTextNode(Math.round(valuation).toLocaleString('ko-KR')));
  bottom.appendChild(valEl);

  const plEl = h('div', { className: 'account-card-h-pl ' + plClass });
  plEl.textContent = `${plSign}${formatKRW(pl)} (${retSign}${ret.toFixed(2)}%)`;
  bottom.appendChild(plEl);
  content.appendChild(bottom);

  card.appendChild(content);
  return card;
}

// ─── Goal projection ──────────────────────────────────────────────────────────
// Uses the selected period's asset value trend (linear, not compound return)
// slope = avg monthly increase in total valuation over the selected period
function computeProjection(goal, periodStartDate, periodLabel) {
  const goalAmount = typeof goal === 'object' ? goal.targetAmount : goal;
  const accountIds = (typeof goal === 'object' && Array.isArray(goal.accountIds) && goal.accountIds.length > 0)
    ? goal.accountIds : null;

  const allActive = store.accounts.filter(a => !a.isArchived);
  const active    = accountIds ? allActive.filter(a => accountIds.includes(a.id)) : allActive;

  if (active.length === 0 || goalAmount <= 0) return null;

  const relevantTxns = store.transactions.filter(t => active.some(a => a.id === t.accountId));
  if (relevantTxns.length === 0) return null;

  const today = toDateStr(new Date());

  // Historical timeline (all-time for chart context)
  const sortedDates = [...relevantTxns].map(t => t.date).sort();
  const firstDate   = sortedDates[0];
  const timeline    = getTotalAssetTimeline(active, store.transactions, firstDate, today);
  if (!timeline || timeline.length < 2) return null;

  // Current total value
  const currentValue = active.reduce((s, a) => s + getCurrentValuation(a.id, store.transactions), 0);
  if (currentValue <= 0) return null;

  if (currentValue >= goalAmount) {
    return { reached: true, currentValue, goalAmount, timeline, active, periodLabel };
  }

  // Value at the period's start date (for slope); clip to first actual data if period predates data
  let effectiveStart = periodStartDate;
  let startValue = active.reduce(
    (s, a) => s + getValuationAt(a.id, store.transactions, effectiveStart).value, 0
  );
  if (startValue === 0 && firstDate > periodStartDate) {
    effectiveStart = firstDate;
    startValue = timeline[0].totalValue;
  }

  const startObj  = new Date(effectiveStart);
  const todayObj  = new Date(today);
  const numMonths = Math.max(1,
    (todayObj.getFullYear() - startObj.getFullYear()) * 12 +
    (todayObj.getMonth()   - startObj.getMonth())
  );

  // Linear slope: average monthly increase in total valuation
  const avgMonthlyIncrease = (currentValue - startValue) / numMonths;

  if (avgMonthlyIncrease <= 0) {
    return { reached: false, maxedOut: true, currentValue, goalAmount, timeline, active, periodLabel, avgMonthlyIncrease: 0 };
  }

  // Monthly growth rate as % of current portfolio value
  const monthlyGrowthPct = currentValue > 0 ? (avgMonthlyIncrease / currentValue) * 100 : 0;

  // Linear projection
  const projDates  = [];
  const projValues = [];
  let v = currentValue;
  let projDate = new Date(today);
  let remaining = 600;

  while (v < goalAmount && remaining > 0) {
    projDate = new Date(projDate.getFullYear(), projDate.getMonth() + 1, 1);
    v = v + avgMonthlyIncrease;
    projDates.push(toDateStr(projDate));
    projValues.push(Math.round(v));
    remaining--;
  }

  const maxedOut     = v < goalAmount;
  const monthsToGoal = maxedOut ? null : projDates.length;
  const reachDate    = maxedOut ? null : projDates[projDates.length - 1];

  return {
    reached: false, maxedOut, currentValue, goalAmount, timeline,
    projDates, projValues, monthsToGoal, reachDate,
    avgMonthlyIncrease, monthlyGrowthPct, periodLabel, active,
  };
}

function renderGoalProjectionCard() {
  const goals = (store.goals ?? []).filter(g => !g.isCompleted);
  if (goals.length === 0) return null;

  const { startDate: periodStartDate } = getPeriodDates();
  const curPeriod   = store.ui.period || 'all';
  const periodLabel = PERIOD_LABELS[curPeriod];

  const card = h('div', { className: 'dash-card' });
  card.appendChild(
    h('div', { className: 'dash-card-header' },
      h('h3', { className: 'dash-card-title', textContent: '목표 달성 예측' })
    )
  );

  for (let i = 0; i < goals.length; i++) {
    const goal = goals[i];
    const proj = computeProjection(goal, periodStartDate, periodLabel);
    const section = h('div', { className: 'goal-proj-section' + (i === 0 ? ' first' : '') });

    // Title row: emoji + name + (🎉 badge if reached) + target
    const titleWrap = h('div', { className: 'goal-proj-title-wrap' });
    titleWrap.appendChild(h('span', { className: 'goal-proj-emoji', textContent: goal.emoji }));
    titleWrap.appendChild(h('span', { className: 'goal-proj-name', textContent: goal.name }));
    if (proj?.reached) {
      titleWrap.appendChild(h('span', { className: 'goal-proj-reached-badge', textContent: '🎉 달성!' }));
    }
    titleWrap.appendChild(h('span', { className: 'goal-proj-target', textContent: '목표: ' + formatKRW(goal.targetAmount) }));
    section.appendChild(titleWrap);

    // Meta: accounts · period · monthly growth rate
    const acctLabel = _goalAccLabel(goal);
    const metaParts = [acctLabel, periodLabel + ' 기준'];
    if (proj && !proj.maxedOut && proj.monthlyGrowthPct != null) {
      const mg = proj.monthlyGrowthPct.toFixed(2);
      metaParts.push(`월 자산 증가율 +${mg}%`);
    }
    section.appendChild(h('p', { className: 'goal-proj-meta', textContent: metaParts.join(' · ') }));

    if (!proj) {
      section.appendChild(h('p', { className: 'chart-empty', textContent: '데이터가 충분하지 않습니다.' }));
    } else if (proj.reached) {
      // Show chart even when reached (historical + goal line)
      const wrap = h('div', { className: 'dash-line-wrap' });
      wrap.appendChild(h('canvas', { id: 'proj-chart-' + goal.id }));
      section.appendChild(wrap);
    } else if (proj.maxedOut) {
      section.appendChild(h('p', { className: 'chart-empty', textContent: '현재 추세로는 50년 내 달성이 어렵습니다.' }));
    } else {
      const d = new Date(proj.reachDate);
      const reachStr = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
      const yrs = Math.floor(proj.monthsToGoal / 12);
      const mos = proj.monthsToGoal % 12;
      const dur = yrs > 0 ? `${yrs}년 ${mos > 0 ? mos + '개월 ' : ''}후` : `${mos}개월 후`;
      section.appendChild(
        h('div', { className: 'goal-proj-info' },
          h('span', { className: 'goal-proj-time', textContent: `예상 달성: ${reachStr} (${dur})` })
        )
      );
      const wrap = h('div', { className: 'dash-line-wrap' });
      wrap.appendChild(h('canvas', { id: 'proj-chart-' + goal.id }));
      section.appendChild(wrap);
    }

    card.appendChild(section);
  }

  return card;
}

function _buildGoalProjectionCharts() {
  const goals = (store.goals ?? []).filter(g => !g.isCompleted);
  const { startDate: periodStartDate } = getPeriodDates();
  const periodLabel = PERIOD_LABELS[store.ui.period || 'all'];
  for (const goal of goals) {
    const canvas = document.getElementById('proj-chart-' + goal.id);
    if (!canvas) continue;
    const proj = computeProjection(goal, periodStartDate, periodLabel);
    if (!proj || proj.maxedOut) continue;
    createProjectionChart(canvas, proj);
  }
}

function _goalAccLabel(goal) {
  if (!Array.isArray(goal.accountIds) || goal.accountIds.length === 0) return '전체 계좌';
  const names = goal.accountIds.map(id => {
    const acc = store.accounts.find(a => a.id === id);
    return acc ? (acc.emoji ? acc.emoji + ' ' + acc.name : acc.name) : '(삭제된 계좌)';
  });
  if (names.length === 1) return names[0];
  return names[0] + ' 외 ' + (names.length - 1) + '개';
}
