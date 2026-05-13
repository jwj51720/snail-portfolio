'use strict';

function openTemplateModal(templateId) {
  const tmpl = templateId ? store.templates.find(t => t.id === templateId) : null;

  let entries = tmpl
    ? tmpl.entries.map(e => ({ ...e }))
    : [{ accountId: '', value: 0, memo: '' }];
  let mode = tmpl?.mode ?? 'fixed';

  const modal = h('div', { className: 'modal modal-wide' });
  modal.appendChild(h('h2', { className: 'modal-title', textContent: tmpl ? '템플릿 편집' : '새 템플릿' }));

  // ── Name ────────────────────────────────────────────────────
  const nameGrp = h('div', { className: 'form-group' });
  nameGrp.appendChild(h('label', { className: 'form-label', textContent: '템플릿 이름' }));
  const nameInput = h('input', { className: 'form-input', type: 'text', value: tmpl?.name ?? '' });
  nameGrp.appendChild(nameInput);
  modal.appendChild(nameGrp);

  // ── Mode ────────────────────────────────────────────────────
  const modeGrp = h('div', { className: 'form-group' });
  modeGrp.appendChild(h('label', { className: 'form-label', textContent: '배분 방식' }));
  const modeRow  = h('div', { className: 'radio-group' });
  const fixedBtn = h('button', { className: 'radio-btn', textContent: '고정 금액' });
  const ratioBtn = h('button', { className: 'radio-btn', textContent: '비율 배분' });
  modeRow.appendChild(fixedBtn);
  modeRow.appendChild(ratioBtn);
  modeGrp.appendChild(modeRow);
  modeGrp.appendChild(h('p', { className: 'form-hint',
    textContent: '고정: 각 계좌에 정해진 금액 입금 / 비율: 총액을 비율대로 나눠 입금' }));
  modal.appendChild(modeGrp);

  // ── Entry list header ────────────────────────────────────────
  const entryHeader = h('div', { className: 'entry-list-header' });
  entryHeader.appendChild(h('span', { textContent: '계좌' }));
  entryHeader.appendChild(h('span', { textContent: '금액 / 비율' }));
  entryHeader.appendChild(h('span', { textContent: '메모' }));
  modal.appendChild(entryHeader);

  // ── Entry container — defined BEFORE setMode is called ──────
  const entryContainer = h('div', { className: 'entry-list' });
  modal.appendChild(entryContainer);

  // ── Sum row ─────────────────────────────────────────────────
  const sumRow = h('div', { className: 'entry-sum-row' });
  const sumEl  = h('span', { className: 'entry-sum' });
  sumRow.appendChild(h('span', { textContent: '합계: ' }));
  sumRow.appendChild(sumEl);
  modal.appendChild(sumRow);

  // ── Error ───────────────────────────────────────────────────
  const errEl = h('div', { className: 'form-error' });
  modal.appendChild(errEl);

  // ── Entry helpers (entryContainer is now in scope) ──────────
  function rebuildEntries() {
    entryContainer.innerHTML = '';
    const unitHint = mode === 'ratio' ? '비율 (%)' : '금액 (원)';
    const accountOptions = [
      { value: '', label: '계좌 선택...' },
      ...store.accounts.filter(a => !a.isArchived).map(a => ({ value: a.id, label: a.name })),
    ];

    entries.forEach((entry, idx) => {
      const row = h('div', { className: 'entry-row' });

      // Custom account select — portaled dropdown escapes modal overflow clipping
      const sel = createCustomSelect(
        accountOptions,
        entry.accountId || '',
        v => { entries[idx].accountId = v; updateSum(); },
      );
      row.appendChild(sel);

      // Value
      const valInput = h('input', {
        className: 'form-input entry-val-input',
        type: 'text',
        placeholder: unitHint,
        value: entry.value ? entry.value.toLocaleString('ko-KR') : '',
      });
      valInput.addEventListener('input', () => {
        const raw = valInput.value.replace(/[^\d]/g, '');
        entries[idx].value = raw ? parseInt(raw, 10) : 0;
        valInput.value = entries[idx].value ? entries[idx].value.toLocaleString('ko-KR') : '';
        updateSum();
      });
      row.appendChild(valInput);

      // Memo + remove button in one cell
      const memoCell = h('div', { className: 'entry-memo-cell' });
      const memoInput = h('input', {
        className: 'form-input entry-memo-input',
        type: 'text',
        placeholder: '메모',
        value: entry.memo || '',
      });
      memoInput.addEventListener('input', () => { entries[idx].memo = memoInput.value; });
      memoCell.appendChild(memoInput);

      const rmBtn = h('button', {
        className: 'btn btn-sm btn-ghost entry-rm-btn',
        textContent: '×',
        onclick: () => { entries.splice(idx, 1); rebuildEntries(); },
      });
      if (entries.length <= 1) rmBtn.disabled = true;
      memoCell.appendChild(rmBtn);
      row.appendChild(memoCell);

      entryContainer.appendChild(row);
    });

    updateSum();
  }

  function updateSum() {
    const total = entries.reduce((s, e) => s + (e.value || 0), 0);
    if (mode === 'ratio') {
      sumEl.textContent = `${total.toLocaleString('ko-KR')}%`;
      sumEl.style.color = total === 100 ? '#22C55E' : '#EF4444';
    } else {
      sumEl.textContent = formatKRW(total);
      sumEl.style.color = '#374151';
    }
  }

  // ── Mode toggle — safe to define/call now that entryContainer exists ──
  function setMode(m) {
    mode = m;
    fixedBtn.className = 'radio-btn' + (m === 'fixed' ? ' sel-deposit' : '');
    ratioBtn.className = 'radio-btn' + (m === 'ratio' ? ' sel-deposit' : '');
    rebuildEntries();
  }
  fixedBtn.addEventListener('click', () => setMode('fixed'));
  ratioBtn.addEventListener('click', () => setMode('ratio'));
  setMode(mode); // initial populate — entryContainer is defined above ✓

  // ── Add entry button ─────────────────────────────────────────
  modal.appendChild(h('button', {
    className: 'btn btn-ghost btn-sm',
    textContent: '+ 항목 추가',
    onclick: () => { entries.push({ accountId: '', value: 0, memo: '' }); rebuildEntries(); },
  }));

  // ── Footer ───────────────────────────────────────────────────
  const footer = h('div', { className: 'modal-footer' });
  const right  = h('div', { className: 'modal-footer-right' });
  right.appendChild(h('button', { className: 'btn btn-ghost', textContent: '취소', onclick: closeModal }));
  right.appendChild(h('button', {
    className: 'btn btn-primary',
    textContent: '저장',
    onclick: () => {
      errEl.textContent = '';
      const name = nameInput.value.trim();
      if (!name)                          { errEl.textContent = '템플릿 이름을 입력하세요.';      return; }
      if (entries.length === 0)           { errEl.textContent = '항목을 1개 이상 추가하세요.';     return; }
      if (entries.some(e => !e.accountId)){ errEl.textContent = '모든 항목의 계좌를 선택하세요.';  return; }
      if (entries.some(e => !e.value || e.value <= 0)) {
        errEl.textContent = '모든 항목의 금액/비율을 입력하세요.'; return;
      }
      if (mode === 'ratio') {
        const total = entries.reduce((s, e) => s + e.value, 0);
        if (total !== 100) {
          errEl.textContent = `비율 합계가 100%여야 합니다. (현재: ${total}%)`; return;
        }
      }

      const data = {
        id:      tmpl?.id ?? makeId('tmpl'),
        name,
        mode,
        entries: entries.map(e => ({ ...e })),
      };

      if (tmpl) {
        const idx = store.templates.findIndex(t => t.id === tmpl.id);
        store.templates[idx] = data;
      } else {
        store.templates.push(data);
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
