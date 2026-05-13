// ─── Korean amount helpers ───────────────────────────────────────────────────

function formatKoreanAmt(n) {
  if (!n || n <= 0) return '';
  const uk  = Math.floor(n / 100_000_000);
  const rem = n % 100_000_000;
  const man = Math.floor(rem / 10_000);
  const won = rem % 10_000;
  const parts = [];
  if (uk)  parts.push(uk + '억');
  if (man) parts.push(man.toLocaleString('ko-KR') + '만');
  if (won) parts.push(won.toLocaleString('ko-KR'));
  return parts.join(' ') + '원';
}

function parseKRW(str) {
  if (!str) return 0;
  const n = parseInt(String(str).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function parseDate(dateStr) {
  // 'YYYY-MM-DD' → Date at midnight local time
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

// Sort transactions by date asc, then by creation order (id tiebreak)
function sortedTxns(transactions) {
  return [...transactions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1
  );
}

function txnsForAccount(accountId, transactions) {
  return transactions.filter(t => t.accountId === accountId);
}

// ─── formatKRW ──────────────────────────────────────────────────────────────

function formatKRW(value) {
  return Math.round(value).toLocaleString('ko-KR') + '원';
}

// ─── 1. getNetDeposit ───────────────────────────────────────────────────────

function getNetDeposit(accountId, transactions, untilDate = null) {
  let txns = txnsForAccount(accountId, transactions).filter(
    t => t.type === 'deposit' || t.type === 'withdraw'
  );
  if (untilDate) txns = txns.filter(t => t.date <= untilDate);

  return txns.reduce((sum, t) => {
    return sum + (t.type === 'deposit' ? t.amount : -t.amount);
  }, 0);
}

// ─── 2. getCurrentValuation ─────────────────────────────────────────────────

function getCurrentValuation(accountId, transactions) {
  const txns = sortedTxns(txnsForAccount(accountId, transactions));
  for (let i = txns.length - 1; i >= 0; i--) {
    if (txns[i].valuation !== undefined && txns[i].valuation !== null) {
      return txns[i].valuation;
    }
  }
  return 0;
}

// ─── 3. getValuationAt ──────────────────────────────────────────────────────

function getValuationAt(accountId, transactions, date) {
  const txns = sortedTxns(txnsForAccount(accountId, transactions)).filter(
    t => t.date <= date && t.valuation !== undefined && t.valuation !== null
  );
  if (txns.length === 0) return { value: 0, interpolated: false };
  const last = txns[txns.length - 1];
  return { value: last.valuation, interpolated: last.date < date };
}

// ─── 4. getProfitLoss ───────────────────────────────────────────────────────

function getProfitLoss(accountId, transactions) {
  return getCurrentValuation(accountId, transactions) - getNetDeposit(accountId, transactions);
}

// ─── 5. getSimpleReturn ─────────────────────────────────────────────────────

function getSimpleReturn(accountId, transactions) {
  const netDeposit = getNetDeposit(accountId, transactions);
  if (netDeposit === 0) return 0;
  return (getProfitLoss(accountId, transactions) / netDeposit) * 100;
}

// ─── 6. getPeriodReturn ─────────────────────────────────────────────────────

function getPeriodReturn(accountId, transactions, startDate, endDate) {
  const startVal = getValuationAt(accountId, transactions, startDate).value;
  if (startVal === 0) return 0;
  const endVal   = getValuationAt(accountId, transactions, endDate).value;
  const netDeposit = getNetDeposit(accountId, transactions, endDate)
                   - getNetDeposit(accountId, transactions, startDate);
  return ((endVal - startVal - netDeposit) / startVal) * 100;
}

// ─── 7. getTimeWeightedReturn ───────────────────────────────────────────────

function getTimeWeightedReturn(accountId, transactions, startDate, endDate) {
  // Gather cash-flow events (deposit/withdraw) within the period
  const cashFlows = sortedTxns(
    txnsForAccount(accountId, transactions).filter(
      t => (t.type === 'deposit' || t.type === 'withdraw')
        && t.date > startDate && t.date <= endDate
    )
  );

  // Build sub-period boundaries: [startDate, cf1.date, cf2.date, ..., endDate]
  const boundaries = [startDate, ...cashFlows.map(t => t.date), endDate];

  let twr = 1;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const pStart = boundaries[i];
    const pEnd   = boundaries[i + 1];
    if (pStart === pEnd) continue;

    const vStart = getValuationAt(accountId, transactions, pStart).value;
    if (vStart === 0) continue; // can't compute return from zero

    // valuation at end of sub-period (before any cash flow on pEnd)
    const vEnd = getValuationAt(accountId, transactions, pEnd).value;

    // Cash flow that occurred AT pEnd (add after sub-period ends)
    const cfOnEnd = cashFlows
      .filter(t => t.date === pEnd)
      .reduce((s, t) => s + (t.type === 'deposit' ? t.amount : -t.amount), 0);

    const subReturn = (vEnd - cfOnEnd - vStart) / vStart;
    twr *= (1 + subReturn);
  }

  return (twr - 1) * 100;
}

// ─── 8. getTotalAssets ──────────────────────────────────────────────────────

function getTotalAssets(accounts, transactions, archivedExcluded = true) {
  const active = archivedExcluded ? accounts.filter(a => !a.isArchived) : accounts;
  return active.reduce((sum, a) => sum + getCurrentValuation(a.id, transactions), 0);
}

// ─── 9. getCategoryBreakdown ────────────────────────────────────────────────

function getCategoryBreakdown(accounts, transactions, categories) {
  const active = accounts.filter(a => !a.isArchived);
  const total  = getTotalAssets(accounts, transactions);

  const map = new Map();
  for (const cat of categories) {
    map.set(cat.id, { categoryId: cat.id, name: cat.name, color: cat.color, value: 0, ratio: 0 });
  }

  for (const acc of active) {
    const val = getCurrentValuation(acc.id, transactions);
    if (!map.has(acc.category)) {
      map.set(acc.category, { categoryId: acc.category, name: acc.category, color: '#aaa', value: 0, ratio: 0 });
    }
    map.get(acc.category).value += val;
  }

  const result = [...map.values()];
  if (total > 0) {
    result.forEach(r => { r.ratio = r.value / total; });
  }
  return result;
}

// ─── 10. getAccountBreakdown ────────────────────────────────────────────────

function getAccountBreakdown(accounts, transactions) {
  const active = accounts.filter(a => !a.isArchived);
  const total  = getTotalAssets(accounts, transactions);

  return active.map(a => {
    const value = getCurrentValuation(a.id, transactions);
    return {
      accountId: a.id,
      name: a.name,
      color: a.color,
      value,
      ratio: total > 0 ? value / total : 0,
    };
  });
}

// ─── 11. getTotalAssetTimeline ──────────────────────────────────────────────

function getTotalAssetTimeline(accounts, transactions, startDate, endDate, granularity = 'day') {
  const active = accounts.filter(a => !a.isArchived);

  // Collect all unique dates that have any transaction within [startDate, endDate]
  const txDates = new Set(
    transactions
      .filter(t => t.date >= startDate && t.date <= endDate)
      .map(t => t.date)
  );

  // Always include startDate and endDate
  txDates.add(startDate);
  txDates.add(endDate);

  const dates = [...txDates].sort();

  // For 'day' granularity: use transaction dates only (no-tx days carry forward)
  // For future granularities, expand here.

  return dates.map(date => {
    const totalValue = active.reduce(
      (sum, a) => sum + getValuationAt(a.id, transactions, date).value, 0
    );
    const netDeposit = active.reduce(
      (sum, a) => sum + getNetDeposit(a.id, transactions, date), 0
    );
    return { date, totalValue, netDeposit };
  });
}
