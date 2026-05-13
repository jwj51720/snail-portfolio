'use strict';

function openTemplateExecute(templateId) {
  const tmpl = store.templates.find(t => t.id === templateId);
  if (!tmpl) return;

  const today = toDateStr(new Date());
  let totalAmount = 0;

  const modal = h('div', { className: 'modal' });
  modal.appendChild(h('h2', { className: 'modal-title', textContent: `실행: ${tmpl.name}` }));

  // Date
  const dateGrp = h('div', { className: 'form-group' });
  dateGrp.appendChild(h('label', { className: 'form-label', textContent: '입금 날짜' }));
  const dateInput = h('input', { className: 'form-input', type: 'date', value: today });
  dateGrp.appendChild(dateInput);
  modal.appendChild(dateGrp);

  // Total amount — ratio mode only
  let totalAmountInput = null;
  if (tmpl.mode === 'ratio') {
    const totalGrp = h('div', { className: 'form-group' });
    totalGrp.appendChild(h('label', { className: 'form-label', textContent: '총 입금액 (원)' }));
    totalAmountInput = h('input', {
      className: 'form-input',
      type: 'text',
      placeholder: '0',
    });
    totalAmountInput.addEventListener('input', () => {
      const raw = totalAmountInput.value.replace(/[^\d]/g, '');
      totalAmount = raw ? parseInt(raw, 10) : 0;
      totalAmountInput.value = totalAmount ? totalAmount.toLocaleString('ko-KR') : '';
      rebuildPreview();
    });
    totalGrp.appendChild(totalAmountInput);
    modal.appendChild(totalGrp);
  }

  // Preview
  modal.appendChild(h('div', { className: 'exec-preview-label', textContent: '입금 미리보기' }));
  const previewWrap = h('div', { className: 'exec-preview-wrap' });
  modal.appendChild(previewWrap);

  function calcRows() {
    return (tmpl.entries ?? []).map(entry => {
      const acc    = store.accounts.find(a => a.id === entry.accountId);
      const amount = tmpl.mode === 'ratio'
        ? Math.round(totalAmount * entry.value / 100)
        : entry.value;
      return { entry, acc, amount };
    });
  }

  function rebuildPreview() {
    previewWrap.innerHTML = '';
    const rows = calcRows();

    const table = h('table', { className: 'txn-table' });
    table.appendChild(h('thead', {},
      h('tr', {},
        h('th', { textContent: '계좌' }),
        h('th', { textContent: '입금액' }),
        h('th', { textContent: '메모' }),
      )
    ));
    const tbody = h('tbody', {});
    for (const { entry, acc, amount } of rows) {
      tbody.appendChild(h('tr', {},
        h('td', { textContent: acc?.name ?? '(삭제된 계좌)' }),
        h('td', { textContent: formatKRW(amount) }),
        h('td', { textContent: entry.memo || '—' }),
      ));
    }
    table.appendChild(tbody);
    previewWrap.appendChild(table);
  }

  rebuildPreview();

  const errEl = h('div', { className: 'form-error' });
  modal.appendChild(errEl);

  const footer = h('div', { className: 'modal-footer' });
  const right  = h('div', { className: 'modal-footer-right' });
  right.appendChild(h('button', { className: 'btn btn-ghost', textContent: '취소', onclick: closeModal }));
  right.appendChild(h('button', {
    className: 'btn btn-primary',
    textContent: '입금 실행',
    onclick: () => {
      errEl.textContent = '';
      const execDate = dateInput.value;
      if (!execDate) { errEl.textContent = '날짜를 선택하세요.'; return; }
      if (tmpl.mode === 'ratio' && totalAmount <= 0) {
        errEl.textContent = '총 입금액을 입력하세요.'; return;
      }

      const rows = calcRows();
      if (rows.some(r => !r.acc)) { errEl.textContent = '삭제된 계좌가 포함되어 있습니다.'; return; }
      if (rows.some(r => r.amount <= 0)) { errEl.textContent = '입금액이 0 이하인 항목이 있습니다.'; return; }

      const batchId = makeId('exec');

      for (const { entry, acc, amount } of rows) {
        const prevVal = getCurrentValuation(acc.id, store.transactions);
        const txn = {
          id:         makeId('txn'),
          accountId:  acc.id,
          date:       execDate,
          type:       'deposit',
          amount,
          valuation:  prevVal + amount,
          memo:       entry.memo || '',
          templateId: batchId,
        };
        store.transactions.push(txn);
      }

      saveStore(store);
      closeModal();
      render();
      showToast(`${rows.length}개 계좌에 일괄 입금되었습니다.`);
    },
  }));
  footer.appendChild(right);
  modal.appendChild(footer);

  openModal(modal);
}
