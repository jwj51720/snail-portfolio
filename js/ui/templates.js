'use strict';

function renderTemplates() {
  const wrap = h('div', {});

  const header = h('div', { className: 'screen-header' });
  header.appendChild(h('h1', { className: 'screen-title', textContent: '배분 템플릿' }));
  header.appendChild(h('button', {
    className: 'btn btn-primary',
    textContent: '+ 새 템플릿',
    onclick: () => openTemplateModal(null),
  }));
  wrap.appendChild(header);

  if (store.templates.length === 0) {
    wrap.appendChild(h('div', { className: 'empty-state' },
      h('p', { className: 'empty-state-text',
        textContent: '아직 템플릿이 없습니다. 새 템플릿을 추가해 일괄 입금을 자동화하세요.' })
    ));
  } else {
    const grid = h('div', { className: 'template-grid' });

    for (const tmpl of store.templates) {
      const card = h('div', {
        className: 'template-card',
        onclick: e => { if (!e.target.closest('button')) openTemplateModal(tmpl.id); },
      });

      const cardHeader = h('div', { className: 'template-card-header' });
      cardHeader.appendChild(h('span', { className: 'template-card-name', textContent: tmpl.name }));
      cardHeader.appendChild(h('span', {
        className: 'badge ' + (tmpl.mode === 'ratio' ? 'badge-purpose' : 'badge-deposit'),
        textContent: tmpl.mode === 'ratio' ? '비율' : '고정',
      }));
      card.appendChild(cardHeader);

      const entryList = h('ul', { className: 'template-entry-list' });
      const entries = tmpl.entries ?? [];
      for (const entry of entries.slice(0, 4)) {
        const acc    = store.accounts.find(a => a.id === entry.accountId);
        const accName = acc?.name ?? `(삭제된 계좌)`;
        const valStr  = tmpl.mode === 'ratio' ? `${entry.value}%` : formatKRW(entry.value);
        entryList.appendChild(h('li', { className: 'template-entry-item' },
          h('span', { className: 'template-entry-name', textContent: accName }),
          h('span', { className: 'template-entry-val',  textContent: valStr  }),
        ));
      }
      if (entries.length > 4) {
        entryList.appendChild(h('li', { className: 'template-entry-more',
          textContent: `외 ${entries.length - 4}개 더...` }));
      }
      card.appendChild(entryList);

      const actions = h('div', { className: 'template-card-actions' });
      actions.appendChild(h('button', {
        className: 'btn btn-sm btn-primary',
        textContent: '실행',
        onclick: () => openTemplateExecute(tmpl.id),
      }));
      actions.appendChild(h('button', {
        className: 'btn btn-sm btn-secondary',
        textContent: '편집',
        onclick: () => openTemplateModal(tmpl.id),
      }));
      actions.appendChild(h('button', {
        className: 'btn btn-sm btn-danger',
        textContent: '삭제',
        onclick: () => {
          if (!confirm(`템플릿 "${tmpl.name}"을 삭제하시겠습니까?`)) return;
          store.templates = store.templates.filter(t => t.id !== tmpl.id);
          saveStore(store);
          render();
        },
      }));
      card.appendChild(actions);
      grid.appendChild(card);
    }

    wrap.appendChild(grid);
  }

  wrap.appendChild(buildGoalsSection());
  return wrap;
}

// ─── Goals section ────────────────────────────────────────────────────────────
const GOAL_EMOJIS = ['🏠','🏢','🏦','🚗','💰','💍','👫','✈️','🎓','🌏','🏖️','🛥️','🏋️','💎','🎯','🏗️','🌾','🏪','🚀','🌟'];

function _goalCardAccLabel(goal) {
  if (!Array.isArray(goal.accountIds) || goal.accountIds.length === 0) return '전체 계좌';
  const names = goal.accountIds.map(id => {
    const acc = store.accounts.find(a => a.id === id);
    return acc ? acc.name : null;
  }).filter(Boolean);
  if (names.length === 0) return '전체 계좌';
  if (names.length === 1) return names[0];
  return names[0] + ' 외 ' + (names.length - 1) + '개';
}

function buildGoalsSection() {
  const section = h('div', { className: 'goals-section-wrap' });

  const hdr = h('div', { className: 'goals-section-header' });
  hdr.appendChild(h('h2', { className: 'screen-title', textContent: '목표 설정' }));
  hdr.appendChild(h('button', {
    className: 'btn btn-primary',
    textContent: '+ 목표 추가',
    onclick: () => openGoalModal(null),
  }));
  section.appendChild(hdr);

  const goals = store.goals ?? [];
  if (goals.length === 0) {
    section.appendChild(h('div', { className: 'empty-state' },
      h('p', { className: 'empty-state-text',
        textContent: '목표를 설정하면 대시보드에서 달성 예측 그래프를 볼 수 있습니다.' })
    ));
    return section;
  }

  const grid = h('div', { className: 'goals-grid' });
  for (const goal of goals) {
    const completed = !!goal.isCompleted;
    const card = h('div', {
      className: 'goal-card' + (completed ? ' completed' : ''),
      onclick: e => { if (!e.target.closest('button')) openGoalModal(goal.id); },
    });
    card.appendChild(h('span', { className: 'goal-card-emoji', textContent: goal.emoji }));
    card.appendChild(h('div', { className: 'goal-card-name', textContent: goal.name }));
    card.appendChild(h('div', { className: 'goal-card-amount', textContent: '목표: ' + formatKRW(goal.targetAmount) }));
    const accLabel = _goalCardAccLabel(goal);
    card.appendChild(h('div', { className: 'goal-card-accounts', textContent: accLabel }));
    const actions = h('div', { className: 'goal-card-actions' });
    if (!completed) {
      actions.appendChild(h('button', {
        className: 'btn btn-sm btn-secondary',
        textContent: '편집',
        onclick: () => openGoalModal(goal.id),
      }));
      actions.appendChild(h('button', {
        className: 'btn btn-sm btn-success',
        textContent: '완료',
        onclick: () => {
          if (!confirm(`"${goal.name}" 목표를 완료 처리할까요? 대시보드에서 숨겨집니다.`)) return;
          const g = (store.goals ?? []).find(g => g.id === goal.id);
          if (g) { g.isCompleted = true; saveStore(store); render(); }
        },
      }));
    } else {
      actions.appendChild(h('button', {
        className: 'btn btn-sm btn-secondary',
        textContent: '완료 취소',
        onclick: () => {
          const g = (store.goals ?? []).find(g => g.id === goal.id);
          if (g) { g.isCompleted = false; saveStore(store); render(); }
        },
      }));
    }
    actions.appendChild(h('button', {
      className: 'btn btn-sm btn-danger',
      textContent: '삭제',
      onclick: () => {
        if (!confirm(`목표 "${goal.name}"을 삭제하시겠습니까?`)) return;
        store.goals = store.goals.filter(g => g.id !== goal.id);
        saveStore(store);
        render();
      },
    }));
    card.appendChild(actions);
    grid.appendChild(card);
  }
  section.appendChild(grid);
  return section;
}

function openGoalModal(goalId) {
  const isEdit   = goalId != null;
  const existing = isEdit ? (store.goals ?? []).find(g => g.id === goalId) : null;

  let selectedEmoji = existing?.emoji ?? '🏠';

  // accountIds: null = all, array = specific
  const accIdsRef = {
    value: (existing?.accountIds && existing.accountIds.length > 0)
      ? [...existing.accountIds]
      : null,
  };

  const modal = h('div', { className: 'modal' });
  modal.appendChild(h('h2', { className: 'modal-title', textContent: isEdit ? '목표 수정' : '목표 추가' }));

  const body = h('div', { className: 'modal-body' });

  // Emoji picker
  const emojiGroup = h('div', { className: 'form-group' });
  emojiGroup.appendChild(h('label', { className: 'form-label', textContent: '아이콘' }));
  const emojiGrid = h('div', { className: 'goal-emoji-grid' });
  const emojiRef  = { value: selectedEmoji };
  for (const emoji of GOAL_EMOJIS) {
    const btn = h('button', {
      className: 'goal-emoji-btn' + (emoji === selectedEmoji ? ' selected' : ''),
      type: 'button',
      textContent: emoji,
      onclick: () => {
        emojiGrid.querySelectorAll('.goal-emoji-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        emojiRef.value = emoji;
      },
    });
    emojiGrid.appendChild(btn);
  }
  emojiGroup.appendChild(emojiGrid);
  body.appendChild(emojiGroup);

  // Name
  const nameGroup = h('div', { className: 'form-group' });
  nameGroup.appendChild(h('label', { className: 'form-label', textContent: '목표 이름' }));
  const nameInput = h('input', {
    className: 'form-input',
    type: 'text',
    placeholder: '예: 내 집 마련',
    value: existing?.name ?? '',
  });
  nameGroup.appendChild(nameInput);
  body.appendChild(nameGroup);

  // Amount
  const amtGroup = h('div', { className: 'form-group' });
  amtGroup.appendChild(h('label', { className: 'form-label', textContent: '목표 금액' }));
  const amtHint  = h('p', { className: 'goal-amt-hint' });
  const amtInput = h('input', {
    className: 'form-input',
    type: 'text',
    placeholder: '700,000,000',
    value: existing?.targetAmount ? existing.targetAmount.toLocaleString('ko-KR') : '',
    oninput: e => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
      const n = parseInt(raw || '0', 10);
      amtHint.textContent = n > 0 ? formatKoreanAmt(n) : '';
    },
  });
  if (existing?.targetAmount) {
    amtHint.textContent = formatKoreanAmt(existing.targetAmount);
  }
  const amtWrap = h('div', { className: 'goal-amt-wrap' });
  amtWrap.appendChild(amtInput);
  amtWrap.appendChild(amtHint);
  amtGroup.appendChild(amtWrap);
  body.appendChild(amtGroup);

  // Account selector
  const accGroup = h('div', { className: 'form-group' });
  accGroup.appendChild(h('label', { className: 'form-label', textContent: '관련 계좌' }));
  const accHintEl = h('p', { className: 'goal-acc-hint' });
  accHintEl.innerHTML = '· 선택한 계좌의 자산 합산으로 예측<br>· 선택 없으면 전체 계좌 기준';
  accGroup.appendChild(accHintEl);
  const activeAccs = store.accounts.filter(a => !a.isArchived);
  const accSelector = h('div', { className: 'goal-acc-selector' });

  function updateAccBtns() {
    accSelector.querySelectorAll('[data-acc-id]').forEach(btn => {
      const id = btn.getAttribute('data-acc-id');
      if (id === '__all__') {
        btn.classList.toggle('selected', accIdsRef.value === null);
      } else {
        btn.classList.toggle('selected', Array.isArray(accIdsRef.value) && accIdsRef.value.includes(id));
      }
    });
  }

  // "전체" button
  const allBtn = h('button', {
    className: 'goal-acc-btn' + (accIdsRef.value === null ? ' selected' : ''),
    type: 'button',
    textContent: '전체',
    'data-acc-id': '__all__',
    onclick: () => { accIdsRef.value = null; updateAccBtns(); },
  });
  accSelector.appendChild(allBtn);

  for (const acc of activeAccs) {
    const isSelected = Array.isArray(accIdsRef.value) && accIdsRef.value.includes(acc.id);
    const label = (acc.emoji ? acc.emoji + ' ' : '') + acc.name;
    const btn = h('button', {
      className: 'goal-acc-btn' + (isSelected ? ' selected' : ''),
      type: 'button',
      textContent: label,
      'data-acc-id': acc.id,
      onclick: () => {
        if (accIdsRef.value === null) accIdsRef.value = [];
        const idx = accIdsRef.value.indexOf(acc.id);
        if (idx >= 0) {
          accIdsRef.value.splice(idx, 1);
          if (accIdsRef.value.length === 0) accIdsRef.value = null;
        } else {
          accIdsRef.value.push(acc.id);
        }
        updateAccBtns();
      },
    });
    accSelector.appendChild(btn);
  }
  accGroup.appendChild(accSelector);
  body.appendChild(accGroup);

  modal.appendChild(body);

  // Footer
  const footer = h('div', { className: 'modal-footer' });
  if (isEdit) {
    footer.appendChild(h('button', {
      className: 'btn btn-danger',
      textContent: '삭제',
      onclick: () => {
        if (!confirm(`목표 "${existing.name}"을 삭제하시겠습니까?`)) return;
        store.goals = (store.goals ?? []).filter(g => g.id !== goalId);
        saveStore(store);
        closeModal();
        render();
      },
    }));
  }
  footer.appendChild(h('button', { className: 'btn btn-secondary', textContent: '취소', onclick: closeModal }));
  footer.appendChild(h('button', {
    className: 'btn btn-primary',
    textContent: isEdit ? '저장' : '추가',
    onclick: () => {
      const name      = nameInput.value.trim();
      const rawAmt    = amtInput.value.replace(/[^0-9]/g, '');
      const targetAmt = parseInt(rawAmt, 10);
      if (!name)              { nameInput.focus(); return; }
      if (!targetAmt || targetAmt <= 0) { amtInput.focus(); return; }
      if (isEdit) {
        const g = (store.goals ?? []).find(g => g.id === goalId);
        if (g) {
          g.emoji = emojiRef.value; g.name = name; g.targetAmount = targetAmt;
          g.accountIds = accIdsRef.value;
        }
      } else {
        if (!store.goals) store.goals = [];
        store.goals.push({
          id: 'goal_' + Date.now(), emoji: emojiRef.value, name,
          targetAmount: targetAmt, createdAt: toDateStr(new Date()),
          accountIds: accIdsRef.value,
        });
      }
      saveStore(store);
      closeModal();
      render();
    },
  }));
  modal.appendChild(footer);
  openModal(modal);
}
