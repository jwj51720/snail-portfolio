'use strict';

const _ACCOUNT_EMOJIS = [
  // Finance & Money
  '💰','💵','💴','💶','💷','💸','💳','🏦','📈','📉','📊','🤑','💹','🪙','🏧','💱','💼','🧾','💲','📋',
  // Awards & Goals
  '🏅','🥇','🥈','🥉','🏆','🎯','💎','👑','⭐','🌟','🔥','⚡','🎖️','🏵️','🚀',
  // Nature & Elements
  '🌈','🌊','🌙','☀️','⛅','🌸','🌺','🌻','🌹','🌷','🍀','🌾','🍁','🍂','🌲','🌳','🌴','🌵',
  // Animals
  '🦁','🐯','🦊','🐻','🐼','🐨','🦋','🐉','🦅','🦉','🐬','🦈','🐆','🐅','🦒','🦚','🦜',
  // Home & Property
  '🏠','🏡','🏢','🏣','🏤','🏥','🏨','🏪','🏫','🏬','🏭','🗼','🏗️','⛺','🛖',
  // Transport
  '🚗','🚙','✈️','🚂','🚄','🛳️','🛸','🚁','🏎️','🚲','🛵','🚕','🚌',
  // Food & Drink
  '🍎','🍊','🍋','🍇','🍓','🍉','🥑','🍕','🍔','🍜','🍣','🍩','🎂','🍾','🥂','☕','🧋',
  // Activities & Entertainment
  '🎰','🎲','🎪','🎭','🎨','🎸','🎹','🎮','🕹️','🎱','🧩','🎬','🎤','🎧','🎻',
  // Tools & Objects
  '🔑','🔒','🛡️','⚙️','🔧','🛠️','🧰','💻','📱','🔭','🔬','💡','🪄','🧲','🗝️',
  // Symbols & Abstract
  '📌','📝','📚','📖','🔖','⚖️','🩺','💊','🌍','🌏','🌐','🗺️','🧭','🎗️','🪬',
  // People & Gestures
  '😊','😎','🤓','💪','🙌','👍','🤝','👨‍💼','👩‍💼','🧑‍💻','🦸','🧑‍🎨',
];

function openAccountModal(accountId = null) {
  const isEdit = accountId != null;
  const acc    = isEdit ? store.accounts.find(a => a.id === accountId) : null;

  let selectedColor = acc?.color ?? null;
  let selectedEmoji = acc?.emoji ?? '';

  const modal = h('div', { className: 'modal' });
  modal.appendChild(h('h2', {
    className: 'modal-title',
    textContent: isEdit ? '계좌 편집' : '계좌 추가',
  }));

  // ── Name + Emoji (inline) ────────────────────────────────────
  const nameGroup = h('div', { className: 'form-group' });
  const nameLbl = h('label', { className: 'form-label' });
  nameLbl.textContent = '계좌 이름';
  nameLbl.appendChild(h('span', { className: 'required', textContent: ' *' }));
  nameGroup.appendChild(nameLbl);

  const nameRow = h('div', { className: 'name-input-row' });

  // Emoji wrap (left of name input)
  const emojiWrap = h('div', { className: 'emoji-picker-wrap emoji-inline-wrap' });
  const emojiBtnInner = h('span');
  emojiBtnInner.textContent = selectedEmoji || '';
  const emojiBtn = h('button', { className: 'emoji-btn emoji-btn-sm', type: 'button' });
  emojiBtn.appendChild(emojiBtnInner);

  let emojiPanelOpen = false;
  const emojiPanel = h('div', { className: 'emoji-picker-panel' });
  let _emojiOutsideHandler = null;

  function closeEmojiPanel() {
    if (!emojiPanelOpen) return;
    emojiPanelOpen = false;
    if (emojiPanel.isConnected) emojiPanel.remove();
    if (_emojiOutsideHandler) {
      document.removeEventListener('click', _emojiOutsideHandler);
      _emojiOutsideHandler = null;
    }
  }

  function openEmojiPanel() {
    emojiPanelOpen = true;
    const rect = emojiBtn.getBoundingClientRect();
    // Position: below button, clamp to right edge of viewport
    const left = Math.min(rect.left, window.innerWidth - 308);
    Object.assign(emojiPanel.style, {
      position: 'fixed',
      top: (rect.bottom + 6) + 'px',
      left: Math.max(8, left) + 'px',
      width: '300px',
      zIndex: '2000',
    });
    document.body.appendChild(emojiPanel);
    _emojiOutsideHandler = e => {
      if (!emojiBtn.contains(e.target) && !emojiPanel.contains(e.target)) closeEmojiPanel();
    };
    setTimeout(() => document.addEventListener('click', _emojiOutsideHandler), 0);
  }

  const emojiGrid = h('div', { className: 'emoji-grid' });
  _ACCOUNT_EMOJIS.forEach(em => {
    const item = h('button', { className: 'emoji-item' + (em === selectedEmoji ? ' selected' : ''), type: 'button' });
    item.textContent = em;
    item.addEventListener('click', () => {
      selectedEmoji = em;
      emojiBtnInner.textContent = em;
      emojiGrid.querySelectorAll('.emoji-item').forEach(el =>
        el.classList.toggle('selected', el.textContent === em));
      closeEmojiPanel();
    });
    emojiGrid.appendChild(item);
  });

  const emojiClearBtn = h('button', {
    className: 'emoji-clear-btn', type: 'button', textContent: '이모지 지우기',
    onclick: () => {
      selectedEmoji = '';
      emojiBtnInner.textContent = '';
      emojiGrid.querySelectorAll('.emoji-item').forEach(el => el.classList.remove('selected'));
      closeEmojiPanel();
    },
  });

  emojiBtn.addEventListener('click', () => {
    emojiPanelOpen ? closeEmojiPanel() : openEmojiPanel();
  });

  emojiPanel.appendChild(emojiGrid);
  emojiPanel.appendChild(emojiClearBtn);
  emojiWrap.appendChild(emojiBtn);
  nameRow.appendChild(emojiWrap);

  const nameInput = h('input', { type: 'text', className: 'form-input', placeholder: '예: 삼성증권 메인' });
  nameInput.value = acc?.name ?? '';
  nameRow.appendChild(nameInput);
  nameGroup.appendChild(nameRow);
  const nameErr = h('div', { className: 'form-error' });
  nameGroup.appendChild(nameErr);
  modal.appendChild(nameGroup);

  // ── Category ─────────────────────────────────────────────────
  const catGroup = h('div', { className: 'form-group' });
  catGroup.appendChild(h('label', { className: 'form-label', textContent: '카테고리' }));
  const catOptions = store.categories.map(c => ({ value: c.id, label: c.name }));
  const catSel = createCustomSelect(
    catOptions,
    acc?.category ?? store.categories[0]?.id ?? '',
    () => {},
  );
  catGroup.appendChild(catSel);
  modal.appendChild(catGroup);

  // ── Purpose ──────────────────────────────────────────────────
  const purpGroup = h('div', { className: 'form-group' });
  purpGroup.appendChild(h('label', { className: 'form-label', textContent: '용도' }));
  const purpInput = h('input', { type: 'text', className: 'form-input', placeholder: '예: 장기보유, 단타용' });
  purpInput.value = acc?.purpose ?? '';
  purpGroup.appendChild(purpInput);
  modal.appendChild(purpGroup);

  // ── Color ────────────────────────────────────────────────────
  const colorGroup = h('div', { className: 'form-group' });
  colorGroup.appendChild(h('label', { className: 'form-label', textContent: '색상' }));
  const initColor = acc?.color
    ?? store.categories.find(c => c.id === catSel._getValue())?.color
    ?? _PRESET_COLORS[5];
  const colorPick = createColorPicker(initColor, c => { selectedColor = c; });
  selectedColor = initColor;
  colorGroup.appendChild(colorPick);
  modal.appendChild(colorGroup);

  // ── Note ─────────────────────────────────────────────────────
  const noteGroup = h('div', { className: 'form-group' });
  noteGroup.appendChild(h('label', { className: 'form-label', textContent: '메모' }));
  const noteInput = h('textarea', { className: 'form-textarea', placeholder: '자유 메모' });
  noteInput.value = acc?.note ?? '';
  noteGroup.appendChild(noteInput);
  modal.appendChild(noteGroup);

  // ── Opening Date ─────────────────────────────────────────────
  const openDateGroup = h('div', { className: 'form-group' });
  openDateGroup.appendChild(h('label', { className: 'form-label', textContent: '개설일' }));
  openDateGroup.appendChild(h('p', { className: 'form-hint', textContent: '계좌 개설일 (선택 사항). 초기 금액 거래일로 사용됩니다.' }));
  const openDateInput = h('input', { type: 'text', className: 'form-input', placeholder: toDateStr(new Date()) });
  openDateInput.style.marginTop = '8px';
  openDateInput.value = acc?.openedAt ?? '';
  openDateGroup.appendChild(openDateInput);
  modal.appendChild(openDateGroup);

  // ── Seed Amount (shown in both create and edit) ───────────────────────────────
  const existingSeed = isEdit
    ? store.transactions.find(t => t.accountId === accountId && t.isSeed)
    : null;
  let seedInput = null;
  {
    const seedGroup = h('div', { className: 'form-group' });
    seedGroup.appendChild(h('label', { className: 'form-label', textContent: '초기 금액' }));
    const hintText = isEdit
      ? (existingSeed ? '현재 초기 잔액을 수정합니다. 0으로 설정하면 삭제됩니다.' : '초기 잔액을 새로 설정합니다 (선택 사항).')
      : '계좌 개설 시 초기 잔액 (선택 사항)';
    seedGroup.appendChild(h('p', { className: 'form-hint', textContent: hintText }));
    seedInput = h('input', { type: 'text', className: 'form-input', placeholder: '0' });
    seedInput.style.marginTop = '8px';
    const seedHint = h('p', { className: 'goal-amt-hint' });
    if (existingSeed) {
      seedInput.value = existingSeed.amount.toLocaleString('ko-KR');
      seedHint.textContent = formatKoreanAmt(existingSeed.amount);
    }
    seedInput.addEventListener('input', e => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
      const n = parseKRW(raw);
      seedHint.textContent = n > 0 ? formatKoreanAmt(n) : '';
    });
    seedGroup.appendChild(seedInput);
    seedGroup.appendChild(seedHint);
    modal.appendChild(seedGroup);
  }

  // ── Footer ───────────────────────────────────────────────────
  const footer = h('div', { className: 'modal-footer' });

  if (isEdit) {
    footer.appendChild(h('button', {
      className: 'btn btn-ghost',
      textContent: acc.isArchived ? '제외 해제' : '제외',
      onclick: () => {
        const target = store.accounts.find(a => a.id === accountId);
        if (target) { target.isArchived = !target.isArchived; saveStore(store); }
        closeModal();
        render();
      },
    }));

    footer.appendChild(h('button', {
      className: 'btn btn-danger',
      textContent: '삭제',
      onclick: () => {
        const hasTxns = store.transactions.some(t => t.accountId === accountId);
        if (hasTxns) {
          alert('거래 기록이 있어 삭제할 수 없습니다. 제외 처리만 가능합니다.');
          return;
        }
        if (!confirm('이 계좌를 완전히 삭제하시겠습니까?')) return;
        store.accounts = store.accounts.filter(a => a.id !== accountId);
        saveStore(store);
        closeModal();
        navigate('accounts');
      },
    }));
  }

  const right = h('div', { className: 'modal-footer-right' });
  right.appendChild(h('button', { className: 'btn btn-secondary', textContent: '취소', onclick: closeModal }));
  right.appendChild(h('button', {
    className: 'btn btn-primary',
    textContent: '저장',
    onclick: () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameErr.textContent = '계좌 이름을 입력해주세요.';
        nameInput.focus();
        return;
      }
      nameErr.textContent = '';

      const finalColor = selectedColor
        || store.categories.find(c => c.id === catSel._getValue())?.color
        || '#828282';

      if (isEdit) {
        const target = store.accounts.find(a => a.id === accountId);
        if (target) {
          target.name     = name;
          target.category = catSel._getValue();
          target.purpose  = purpInput.value.trim();
          target.color    = finalColor;
          target.note     = noteInput.value.trim();
          target.emoji    = selectedEmoji;
          target.openedAt = openDateInput.value || null;
        }
        // Update seed transaction
        const seedAmt2 = parseKRW(seedInput?.value);
        const seedTxn  = store.transactions.find(t => t.accountId === accountId && t.isSeed);
        if (seedTxn) {
          if (seedAmt2 > 0) {
            seedTxn.amount    = seedAmt2;
            seedTxn.valuation = seedAmt2;
          } else {
            store.transactions = store.transactions.filter(t => !(t.accountId === accountId && t.isSeed));
          }
        } else if (seedAmt2 > 0) {
          // Place seed before all existing transactions (use earliest date - 1 day)
          const otherTxns = store.transactions.filter(t => t.accountId === accountId);
          const earliest  = otherTxns.map(t => t.date).sort()[0];
          const seedDate  = earliest ? addDays(earliest, -1) : toDateStr(new Date());
          store.transactions.push({
            id:        makeId('txn'),
            accountId,
            date:      seedDate,
            type:      'deposit',
            isSeed:    true,
            amount:    seedAmt2,
            valuation: seedAmt2,
            memo:      '시드 머니',
            createdAt: Date.now(),
          });
        }
      } else {
        const newAccId = makeId('acc');
        const openedAt = openDateInput.value || null;
        store.accounts.push({
          id:         newAccId,
          name,
          category:   catSel._getValue(),
          purpose:    purpInput.value.trim(),
          color:      finalColor,
          note:       noteInput.value.trim(),
          emoji:      selectedEmoji,
          isArchived: false,
          openedAt,
          createdAt:  Date.now(),
        });
        const seedAmt = parseKRW(seedInput?.value);
        if (seedAmt > 0) {
          store.transactions.push({
            id:        makeId('txn'),
            accountId: newAccId,
            date:      openedAt ?? toDateStr(new Date()),
            type:      'deposit',
            isSeed:    true,
            amount:    seedAmt,
            valuation: seedAmt,
            memo:      '시드 머니',
            createdAt: Date.now(),
          });
        }
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
