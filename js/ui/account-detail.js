'use strict';

const TXN_LABEL = { deposit: '입금', withdraw: '출금', snapshot: '스냅샷' };
const TXN_BADGE = { deposit: 'badge-deposit', withdraw: 'badge-withdraw', snapshot: 'badge-snapshot', seed: 'badge-seed' };

function renderAccountDetail(accountId) {
  const acc = store.accounts.find(a => a.id === accountId);

  // Account missing (e.g. deleted then refreshed) → bounce back asynchronously
  if (!acc) {
    requestAnimationFrame(() => navigate('accounts'));
    return h('div', { className: 'placeholder-screen' },
      h('p', { textContent: '계좌를 찾을 수 없습니다.' })
    );
  }

  const txns      = store.transactions.filter(t => t.accountId === accountId);
  const valuation = getCurrentValuation(accountId, store.transactions);
  const netDep    = getNetDeposit(accountId, store.transactions);
  const pl        = getProfitLoss(accountId, store.transactions);
  const plClass   = pl > 0 ? 'text-profit' : pl < 0 ? 'text-loss' : 'text-neutral';

  // TWR vs simple return
  const useTWR = store.ui.useTWR ?? false;
  const today  = toDateStr(new Date());
  const firstDate = sortedTxns(txns)[0]?.date ?? today;
  const ret    = useTWR
    ? getTimeWeightedReturn(accountId, store.transactions, firstDate, today)
    : getSimpleReturn(accountId, store.transactions);
  const retLabel = useTWR ? 'TWR (전체)' : '수익률';
  const retSign  = ret >= 0 ? '+' : '';

  const wrap = h('div', {});

  // ── Back ────────────────────────────────────────────────────
  wrap.appendChild(h('button', {
    className: 'detail-back-btn',
    textContent: '← 계좌 목록',
    onclick: () => navigate('accounts'),
  }));

  // ── Header ──────────────────────────────────────────────────
  const header = h('div', { className: 'detail-header' });

  const titleArea = h('div', {});
  const titleEl = h('h1', { className: 'detail-title' });
  if (acc.emoji) titleEl.appendChild(h('span', { className: 'account-card-emoji', textContent: acc.emoji }));
  titleEl.appendChild(document.createTextNode(acc.name));
  titleArea.appendChild(titleEl);
  const badges = h('div', { className: 'account-card-badges' });
  const catName = store.categories.find(c => c.id === acc.category)?.name ?? acc.category;
  badges.appendChild(h('span', { className: 'badge badge-category', textContent: catName }));
  if (acc.purpose) badges.appendChild(h('span', { className: 'badge badge-purpose', textContent: acc.purpose }));
  if (acc.isArchived) badges.appendChild(h('span', { className: 'badge badge-snapshot', textContent: '보관됨' }));
  titleArea.appendChild(badges);

  const actions = h('div', { className: 'detail-actions' },
    h('button', { className: 'btn btn-secondary', textContent: '편집',
      onclick: () => openAccountModal(acc.id) }),
    h('button', { className: 'btn btn-primary', textContent: '+ 거래 추가',
      onclick: () => openTransactionModal(acc.id) })
  );

  header.appendChild(titleArea);
  header.appendChild(actions);
  wrap.appendChild(header);

  // ── Stats ────────────────────────────────────────────────────
  function fmtWon(n) {
    return Math.round(n).toLocaleString('ko-KR') + '원';
  }

  function fmtWonEl(n, sign = '') {
    const span = document.createElement('span');
    span.style.cssText = 'display:inline-flex;align-items:baseline;gap:2px';
    if (sign) {
      const s = document.createElement('span');
      s.textContent = sign;
      span.appendChild(s);
    }
    span.appendChild(document.createTextNode(Math.round(Math.abs(n)).toLocaleString('ko-KR')));
    const sfx = document.createElement('span');
    sfx.className = 'stat-amt-suffix';
    sfx.textContent = '원';
    span.appendChild(sfx);
    return span;
  }

  const statPanel = h('div', { className: 'account-stat-panel' });

  // Main: 현재 평가액
  const mainStat = h('div', { className: 'account-stat-main' });
  mainStat.appendChild(h('div', { className: 'account-stat-main-label', textContent: '현재 평가액' }));
  const mainVal = h('div', { className: 'account-stat-main-value' });
  mainVal.appendChild(document.createTextNode(Math.round(valuation).toLocaleString('ko-KR')));
  mainVal.appendChild(h('span', { className: 'account-stat-suffix', textContent: '원' }));
  mainStat.appendChild(mainVal);
  statPanel.appendChild(mainStat);

  statPanel.appendChild(h('div', { className: 'account-stat-divider' }));

  // Sub row: 순 투입금 / 손익 / 수익률
  const subRow = h('div', { className: 'account-stat-sub-row' });

  function subStat(label, value, cls = '') {
    const s = h('div', { className: 'account-stat-sub' });
    s.appendChild(h('div', { className: 'account-stat-sub-label', textContent: label }));
    const v = h('div', { className: 'account-stat-sub-value' + (cls ? ' ' + cls : '') });
    if (value instanceof Node) v.appendChild(value);
    else v.textContent = value;
    s.appendChild(v);
    return s;
  }

  subRow.appendChild(subStat('순 투입금', fmtWonEl(netDep)));
  subRow.appendChild(h('div', { className: 'account-stat-vsep' }));
  subRow.appendChild(subStat('손익', fmtWonEl(pl, pl >= 0 ? '+' : '-'), plClass));
  subRow.appendChild(h('div', { className: 'account-stat-vsep' }));
  subRow.appendChild(subStat(retLabel, `${retSign}${ret.toFixed(2)}%`, plClass));
  statPanel.appendChild(subRow);

  wrap.appendChild(statPanel);

  // ── Transaction list ─────────────────────────────────────────
  wrap.appendChild(h('h2', { className: 'txn-section-title', textContent: '거래 내역' }));

  const sorted = [...txns].sort((a, b) =>
    a.date !== b.date ? (a.date > b.date ? -1 : 1) : ((b.createdAt ?? 0) - (a.createdAt ?? 0))
  );

  if (sorted.length === 0) {
    wrap.appendChild(h('div', { className: 'empty-state' },
      h('p', { textContent: '아직 거래 내역이 없습니다.' })
    ));
    return wrap;
  }

  const tableWrap = h('div', { className: 'txn-table-wrap' });
  const table = h('table', { className: 'txn-table' });

  table.appendChild(h('thead', {},
    h('tr', {},
      h('th', { textContent: '날짜' }),
      h('th', { textContent: '유형' }),
      h('th', { textContent: '금액' }),
      h('th', { textContent: '평가액' }),
      h('th', { textContent: '메모' }),
      h('th', { textContent: '' }),
    )
  ));

  const tbody = h('tbody', {});

  // Pre-compute running net deposit per transaction (ascending order for cumulative sum)
  const asc = [...txns].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.id < b.id ? -1 : 1)
  );
  const runningMap = {};
  let running = 0;
  for (const t of asc) {
    if (t.type === 'deposit') running += (t.amount ?? 0);
    else if (t.type === 'withdraw') running -= (t.amount ?? 0);
    runningMap[t.id] = running;
  }

  for (const txn of sorted) {
    const tr = h('tr', {});

    tr.appendChild(h('td', { textContent: txn.date }));

    const typeTd = h('td', {});
    if (txn.isSeed) {
      typeTd.appendChild(h('span', { className: 'badge badge-seed', textContent: '초기잔액' }));
    } else {
      typeTd.appendChild(h('span', {
        className: `badge ${TXN_BADGE[txn.type] ?? 'badge-snapshot'}`,
        textContent: TXN_LABEL[txn.type] ?? txn.type,
      }));
    }
    tr.appendChild(typeTd);

    // Amount column
    const amtTd = h('td', {});
    if (txn.isSeed || txn.type === 'snapshot') {
      amtTd.textContent = '—';
    } else {
      amtTd.textContent = (txn.type === 'withdraw' ? '−' : '+') + formatKRW(txn.amount);
      amtTd.style.color = txn.type === 'withdraw' ? '#B45309' : '#1D4ED8';
    }
    tr.appendChild(amtTd);

    // Valuation column — show computed running total when no explicit valuation
    const valTd = h('td', {});
    if (txn.valuation !== undefined && txn.valuation !== null) {
      valTd.textContent = formatKRW(txn.valuation);
    } else {
      valTd.textContent = formatKRW(runningMap[txn.id] ?? 0);
      valTd.style.color = 'var(--text-muted)';
    }
    tr.appendChild(valTd);

    tr.appendChild(h('td', { textContent: txn.memo || '—' }));

    // Action buttons carry data-* for delegation
    const actTd = h('td', { className: 'txn-actions' },
      h('button', {
        className: 'txn-action-btn',
        textContent: '편집',
        'data-action': 'edit',
        'data-txn-id': txn.id,
      }),
      h('button', {
        className: 'txn-action-btn danger',
        textContent: '삭제',
        'data-action': 'delete',
        'data-txn-id': txn.id,
      }),
    );
    tr.appendChild(actTd);
    tbody.appendChild(tr);
  }

  // Single event listener on tbody — delegation via data-action
  tbody.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.stopPropagation();
    const action = btn.getAttribute('data-action');
    const txnId  = btn.getAttribute('data-txn-id');

    if (action === 'edit') {
      openTransactionModal(accountId, txnId);
    } else if (action === 'delete') {
      const txn = store.transactions.find(t => t.id === txnId);
      if (!txn) return;

      if (txn.templateId) {
        const batch = store.transactions.filter(t => t.templateId === txn.templateId);
        const deleteAll = confirm(
          `이 거래는 배분 실행의 일부입니다 (동일 실행 거래 ${batch.length}개).\n\n` +
          `[확인] → 배분 실행 전체(${batch.length}개) 삭제\n` +
          `[취소] → 이 거래 1개만 삭제`
        );
        if (deleteAll) {
          store.transactions = store.transactions.filter(t => t.templateId !== txn.templateId);
        } else {
          store.transactions = store.transactions.filter(t => t.id !== txnId);
        }
      } else {
        if (!confirm('이 거래를 삭제하시겠습니까?')) return;
        store.transactions = store.transactions.filter(t => t.id !== txnId);
      }
      saveStore(store);
      render();
    }
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);
  return wrap;
}
