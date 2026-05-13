// app.js — entry point

let store = loadStore();

function saveAndSync() {
  saveStore(store);
}

// ─── Helper: generate IDs ────────────────────────────────────────────────────

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Mutation helpers (used by UI later; useful for console testing now) ─────

function addAccount({ name, category = 'etc', purpose = '', color = '#5B8DEF', note = '' }) {
  const account = {
    id: makeId('acc'),
    name,
    category,
    purpose,
    color,
    note,
    isArchived: false,
    createdAt: Date.now(),
  };
  store.accounts.push(account);
  saveAndSync();
  return account;
}

function addTransaction({ accountId, date, type, amount = 0, valuation = 0, memo = '', templateId = null }) {
  const txn = {
    id: makeId('txn'),
    accountId,
    date,
    type,
    amount,
    valuation,
    memo,
    templateId,
  };
  store.transactions.push(txn);
  saveAndSync();
  return txn;
}

// ─── Console verification scenario ──────────────────────────────────────────

function runVerification() {
  console.group('=== snail-portfolio 초기 검증 ===');

  // 1. 기본 카테고리 확인
  console.group('1. 기본 카테고리');
  console.log('카테고리 수:', store.categories.length, '(예상: 4)');
  console.table(store.categories);
  console.groupEnd();

  // 2. 가상 계좌 + 거래 추가
  console.group('2. 테스트 데이터 추가');
  const acc = addAccount({ name: '테스트계좌', category: 'domestic', color: '#5B8DEF' });
  console.log('생성된 계좌:', acc);

  // 입금 200만, 입금 100만, 출금 50만, 입금 80만 + snapshot, snapshot
  const t1 = addTransaction({ accountId: acc.id, date: '2025-01-01', type: 'deposit',  amount: 2_000_000, valuation: 2_000_000, memo: '초기입금' });
  const t2 = addTransaction({ accountId: acc.id, date: '2025-02-01', type: 'deposit',  amount: 1_000_000, valuation: 3_100_000, memo: '추가입금' });
  const t3 = addTransaction({ accountId: acc.id, date: '2025-03-01', type: 'withdraw', amount:   500_000, valuation: 2_700_000, memo: '일부출금' });
  const t4 = addTransaction({ accountId: acc.id, date: '2025-04-01', type: 'deposit',  amount:   800_000, valuation: 3_700_000, memo: '추가입금2' });
  const t5 = addTransaction({ accountId: acc.id, date: '2025-05-01', type: 'snapshot', amount:         0, valuation: 4_000_000, memo: '월말평가' });
  console.log('거래 5건 추가 완료');
  console.groupEnd();

  // 3. 계산 검증
  // 순투입금: 2,000,000 + 1,000,000 - 500,000 + 800,000 = 3,300,000
  // 현재평가: 4,000,000 (가장 최근 거래의 valuation)
  // 손익: 4,000,000 - 3,300,000 = 700,000
  // 단순수익률: 700,000 / 3,300,000 * 100 ≈ 21.21%
  console.group('3. 계산 함수 검증');
  const netDep = getNetDeposit(acc.id, store.transactions);
  const curVal = getCurrentValuation(acc.id, store.transactions);
  const pl     = getProfitLoss(acc.id, store.transactions);
  const ret    = getSimpleReturn(acc.id, store.transactions);

  console.log(`순투입금:      ${formatKRW(netDep)}  (예상: 3,300,000원)`);
  console.log(`현재평가:      ${formatKRW(curVal)}  (예상: 4,000,000원)`);
  console.log(`손익:          ${formatKRW(pl)}  (예상: 700,000원)`);
  console.log(`단순수익률:    ${ret.toFixed(4)}%  (예상: ≈21.2121%)`);

  const va = getValuationAt(acc.id, store.transactions, '2025-02-15');
  console.log(`2025-02-15 평가액:`, va, '(예상: { value: 3100000, interpolated: true })');
  console.groupEnd();

  // 4. getCategoryBreakdown ratio 합계
  console.group('4. getCategoryBreakdown ratio 합계');
  const breakdown = getCategoryBreakdown(store.accounts, store.transactions, store.categories);
  const ratioSum = breakdown.reduce((s, b) => s + b.ratio, 0);
  console.table(breakdown.map(b => ({ ...b, ratio: b.ratio.toFixed(6) })));
  console.log(`ratio 합계: ${ratioSum.toFixed(6)}  (예상: 1.000000)`);
  console.groupEnd();

  // 5. 새로고침 안내
  console.group('5. 영속성');
  console.log('localStorage 저장 완료. 새로고침 후 아래를 실행하세요:');
  console.log('  loadStore().accounts  →  계좌 1개');
  console.log('  loadStore().transactions  →  거래 5건');
  console.groupEnd();

  console.groupEnd();
}

// ─── 앱 시작 ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  render();
});

console.log('[snail-portfolio] 로드 완료 | 계좌:', store.accounts.length, '| 거래:', store.transactions.length);
