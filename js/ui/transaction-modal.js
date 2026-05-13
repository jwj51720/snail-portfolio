'use strict';

// ─── Amount helpers ───────────────────────────────────────────────────────────
function parseAmount(str) {
  if (str == null || str === '') return 0;
  const n = Number(String(str).replace(/,/g, '').replace(/원/g, '').trim());
  return isNaN(n) ? NaN : Math.round(n);
}

function fmtInput(n) {
  if (n == null || n === '' || isNaN(n)) return '';
  return Math.round(n).toLocaleString('ko-KR');
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function openTransactionModal(accountId, txnId = null) {
  const isEdit = txnId != null;
  const txn    = isEdit ? store.transactions.find(t => t.id === txnId) : null;
  const acc    = store.accounts.find(a => a.id === accountId);

  const todayStr    = new Date().toISOString().slice(0, 10);
  const prevValuation = getCurrentValuation(accountId, store.transactions);

  let currentType = txn?.type ?? 'deposit';
  // Track whether the user has manually edited the valuation field
  let valuationTouched = isEdit;

  const modal = h('div', { className: 'modal' });
  modal.appendChild(h('h2', {
    className: 'modal-title',
    textContent: isEdit ? '거래 편집' : '거래 추가',
  }));

  // Sub-label: account name (safe — textContent)
  if (acc) {
    const sub = h('p', { className: 'form-hint' });
    sub.style.marginBottom = '16px';
    sub.textContent = `계좌: ${acc.name}`;
    modal.appendChild(sub);
  }

  // ── Date ────────────────────────────────────────────────────
  const dateGroup = h('div', { className: 'form-group' });
  dateGroup.appendChild(h('label', { className: 'form-label', textContent: '날짜' }));
  const dateInput = h('input', { type: 'date', className: 'form-input' });
  dateInput.value = txn?.date ?? todayStr;
  const dateHint = h('p', { className: 'form-hint' });
  dateInput.addEventListener('change', () => {
    dateHint.textContent = dateInput.value > todayStr
      ? '미래 날짜입니다. 저장은 가능합니다.' : '';
  });
  dateGroup.appendChild(dateInput);
  dateGroup.appendChild(dateHint);
  modal.appendChild(dateGroup);

  // ── Type ─────────────────────────────────────────────────────
  const typeGroup = h('div', { className: 'form-group' });
  typeGroup.appendChild(h('label', { className: 'form-label', textContent: '유형' }));
  const radioGroup = h('div', { className: 'radio-group' });
  const TYPE_OPTS = [
    { value: 'deposit',  label: '입금' },
    { value: 'withdraw', label: '출금' },
    { value: 'snapshot', label: '스냅샷' },
  ];

  // Forward declarations — defined after amountInput
  let amountInput, valuationInput;

  function updateTypeUI() {
    for (const btn of radioGroup.children) {
      const t = btn.getAttribute('data-type');
      btn.className = 'radio-btn' + (t === currentType ? ` sel-${t}` : '');
    }
    amountInput.disabled = currentType === 'snapshot';
    if (currentType === 'snapshot') amountInput.value = '';
    if (!valuationTouched) recalcDefaultValuation();
  }

  for (const opt of TYPE_OPTS) {
    const btn = h('div', {
      className: 'radio-btn' + (opt.value === currentType ? ` sel-${opt.value}` : ''),
      textContent: opt.label,
      'data-type': opt.value,
    });
    btn.addEventListener('click', () => { currentType = opt.value; updateTypeUI(); });
    radioGroup.appendChild(btn);
  }
  typeGroup.appendChild(radioGroup);
  modal.appendChild(typeGroup);

  // ── Amount ───────────────────────────────────────────────────
  const amtGroup = h('div', { className: 'form-group' });
  amtGroup.appendChild(h('label', { className: 'form-label', textContent: '금액' }));
  amountInput = h('input', { type: 'text', className: 'form-input', placeholder: '0' });
  amountInput.value = txn ? fmtInput(txn.amount) : '';
  amountInput.disabled = currentType === 'snapshot';
  const amtHint = h('p', { className: 'goal-amt-hint' });
  if (txn?.amount) amtHint.textContent = formatKoreanAmt(txn.amount);
  const amtErr = h('div', { className: 'form-error' });

  amountInput.addEventListener('input', () => {
    amtErr.textContent = '';
    amtHint.textContent = formatKoreanAmt(parseKRW(amountInput.value));
    if (!valuationTouched) recalcDefaultValuation();
  });
  amountInput.addEventListener('blur', () => {
    const v = parseAmount(amountInput.value);
    if (!isNaN(v) && v >= 0) amountInput.value = fmtInput(v);
  });
  amtGroup.appendChild(amountInput);
  amtGroup.appendChild(amtHint);
  amtGroup.appendChild(amtErr);
  modal.appendChild(amtGroup);

  // ── Valuation ────────────────────────────────────────────────
  const valGroup = h('div', { className: 'form-group' });
  valGroup.appendChild(h('label', { className: 'form-label', textContent: '평가액' }));
  valuationInput = h('input', { type: 'text', className: 'form-input', placeholder: '0' });
  valuationInput.value = txn ? fmtInput(txn.valuation) : fmtInput(prevValuation);
  const valHint = h('p', { className: 'goal-amt-hint' });
  valHint.textContent = formatKoreanAmt(parseKRW(valuationInput.value));

  valuationInput.addEventListener('input', () => {
    valuationTouched = true;
    valHint.textContent = formatKoreanAmt(parseKRW(valuationInput.value));
  });
  valuationInput.addEventListener('blur', () => {
    const v = parseAmount(valuationInput.value);
    if (!isNaN(v) && v >= 0) valuationInput.value = fmtInput(v);
  });
  valGroup.appendChild(valuationInput);
  valGroup.appendChild(valHint);
  valGroup.appendChild(h('p', { className: 'form-hint', textContent: '해당 시점의 계좌 총 평가금액' }));
  modal.appendChild(valGroup);

  function recalcDefaultValuation() {
    const amt = Math.max(0, parseAmount(amountInput.value) || 0);
    let def = prevValuation;
    if (currentType === 'deposit')  def = prevValuation + amt;
    if (currentType === 'withdraw') def = Math.max(0, prevValuation - amt);
    valuationInput.value = fmtInput(def);
    valHint.textContent = formatKoreanAmt(def);
  }

  // ── Memo ─────────────────────────────────────────────────────
  const memoGroup = h('div', { className: 'form-group' });
  memoGroup.appendChild(h('label', { className: 'form-label', textContent: '메모' }));
  const memoInput = h('input', { type: 'text', className: 'form-input', placeholder: '선택사항' });
  memoInput.value = txn?.memo ?? '';
  memoGroup.appendChild(memoInput);
  modal.appendChild(memoGroup);

  // ── Footer ───────────────────────────────────────────────────
  const footer = h('div', { className: 'modal-footer' });
  const right  = h('div', { className: 'modal-footer-right' });
  right.appendChild(h('button', { className: 'btn btn-secondary', textContent: '취소', onclick: closeModal }));
  right.appendChild(h('button', {
    className: 'btn btn-primary',
    textContent: '저장',
    onclick: () => {
      const amount    = currentType === 'snapshot' ? 0 : parseAmount(amountInput.value);
      const valuation = parseAmount(valuationInput.value);

      if (currentType !== 'snapshot') {
        if (isNaN(amount) || amount < 0) {
          amtErr.textContent = '0 이상의 올바른 금액을 입력해주세요.';
          amountInput.focus();
          return;
        }
      }

      if (isEdit) {
        const target = store.transactions.find(t => t.id === txnId);
        if (target) {
          target.date      = dateInput.value;
          target.type      = currentType;
          target.amount    = amount;
          target.valuation = isNaN(valuation) ? 0 : valuation;
          target.memo      = memoInput.value.trim();
        }
      } else {
        store.transactions.push({
          id:         makeId('txn'),
          accountId,
          date:       dateInput.value,
          type:       currentType,
          amount,
          valuation:  isNaN(valuation) ? 0 : valuation,
          memo:       memoInput.value.trim(),
          templateId: null,
        });
      }

      saveStore(store);
      closeModal();
      render();
    },
  }));
  footer.appendChild(right);
  modal.appendChild(footer);

  openModal(modal);
}
