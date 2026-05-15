'use strict';

let _showArchived = false;

function renderAccounts() {
  const wrap = h('div', {});

  // ── Header ──────────────────────────────────────────────────
  const header = h('div', { className: 'screen-header' },
    h('h1', { className: 'screen-title', textContent: '계좌 목록' }),
    h('button', { className: 'btn btn-primary', textContent: '+ 계좌 추가',
      onclick: () => openAccountModal() })
  );
  wrap.appendChild(header);

  const active   = store.accounts.filter(a => !a.isArchived);
  const archived = store.accounts.filter(a =>  a.isArchived);

  // ── Empty state ──────────────────────────────────────────────
  if (active.length === 0) {
    const empty = h('div', { className: 'empty-state' },
      h('p', { className: 'empty-state-text',
        textContent: '투자 계좌를 추가하고 자산 관리를 시작하세요' }),
      h('button', { className: 'btn btn-primary btn-lg', textContent: '+ 첫 계좌 추가하기',
        onclick: () => openAccountModal() })
    );
    wrap.appendChild(empty);
  } else {
    const grid = h('div', { className: 'accounts-grid' });
    for (const acc of active) grid.appendChild(renderAccountCard(acc));
    // Event delegation: click anywhere on a card → detail
    grid.addEventListener('click', e => {
      const card = e.target.closest('[data-account-id]');
      if (card) navigate('account-detail', { accountId: card.getAttribute('data-account-id') });
    });
    wrap.appendChild(grid);
  }

  // ── Archived section ─────────────────────────────────────────
  if (archived.length > 0) {
    const sec = h('div', { className: 'archive-toggle' });
    const toggleBtn = h('button', {
      className: 'archive-toggle-btn',
      textContent: _showArchived
        ? '▲ 제외된 계좌 숨기기'
        : `▼ 제외된 계좌 ${archived.length}개 보기`,
      onclick: () => { _showArchived = !_showArchived; render(); },
    });
    sec.appendChild(toggleBtn);

    if (_showArchived) {
      const grid = h('div', { className: 'accounts-grid mt-16' });
      for (const acc of archived) grid.appendChild(renderAccountCard(acc, true));
      grid.addEventListener('click', e => {
        const card = e.target.closest('[data-account-id]');
        if (card) navigate('account-detail', { accountId: card.getAttribute('data-account-id') });
      });
      sec.appendChild(grid);
    }

    wrap.appendChild(sec);
  }

  return wrap;
}

function renderAccountCard(acc, archived = false) {
  const valuation = getCurrentValuation(acc.id, store.transactions);
  const pl        = getProfitLoss(acc.id, store.transactions);
  const ret       = getSimpleReturn(acc.id, store.transactions);
  const plClass   = pl > 0 ? 'text-profit' : pl < 0 ? 'text-loss' : 'text-neutral';
  const plSign    = pl > 0 ? '+' : '';
  const retSign   = ret > 0 ? '+' : '';

  const card = h('div', {
    className: 'account-card' + (archived ? ' account-card-archived' : ''),
    'data-account-id': acc.id,
  });

  const bar = h('div', { className: 'account-card-bar' });
  bar.style.background = acc.color || '#828282';
  card.appendChild(bar);

  const starBtn = h('button', {
    className: 'account-card-star' + (acc.isStarred ? ' starred' : ''),
    type: 'button',
    'aria-label': acc.isStarred ? '즐겨찾기 해제' : '즐겨찾기',
    onclick: e => {
      e.stopPropagation();
      const target = store.accounts.find(a => a.id === acc.id);
      if (target) { target.isStarred = !target.isStarred; saveStore(store); render(); }
    },
  });
  starBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  card.appendChild(starBtn);

  const body = h('div', { className: 'account-card-body' });

  // Name (with optional emoji prefix)
  const nameEl = h('div', { className: 'account-card-name' });
  if (acc.emoji) nameEl.appendChild(h('span', { className: 'account-card-emoji', textContent: acc.emoji }));
  nameEl.appendChild(document.createTextNode(acc.name));
  body.appendChild(nameEl);

  // Badges
  const badges = h('div', { className: 'account-card-badges' });
  const catName = store.categories.find(c => c.id === acc.category)?.name ?? acc.category;
  badges.appendChild(h('span', { className: 'badge badge-category', textContent: catName }));
  if (acc.purpose) {
    badges.appendChild(h('span', { className: 'badge badge-purpose', textContent: acc.purpose }));
  }
  if (archived) {
    badges.appendChild(h('span', { className: 'badge badge-snapshot', textContent: '제외됨' }));
  }
  body.appendChild(badges);

  // Valuation
  const valEl = h('div', { className: 'account-card-valuation' });
  valEl.appendChild(document.createTextNode(Math.round(valuation).toLocaleString('ko-KR')));
  valEl.appendChild(h('span', { className: 'card-currency', textContent: '원' }));
  body.appendChild(valEl);

  // P/L row — all values are computed from numbers, textContent is safe
  const plEl = h('div', { className: 'account-card-pl ' + plClass });
  plEl.textContent = `${plSign}${formatKRW(pl)}  (${retSign}${ret.toFixed(2)}%)`;
  body.appendChild(plEl);

  card.appendChild(body);
  return card;
}
