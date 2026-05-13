'use strict';

function renderSettings() {
  const wrap = h('div', { className: 'settings-wrap' });
  wrap.appendChild(h('h1', { className: 'screen-title', textContent: '설정' }));

  function section(title, content) {
    const sec = h('div', { className: 'settings-section' });
    sec.appendChild(h('h2', { className: 'settings-section-title', textContent: title }));
    sec.appendChild(content);
    return sec;
  }

  wrap.appendChild(section('카테고리 관리',     buildCategorySection()));
  wrap.appendChild(section('수익률 계산 방식',   buildTWRSection()));
  wrap.appendChild(section('데이터 백업 / 복원', buildBackupSection()));
  wrap.appendChild(section('위험 구역',         buildDangerSection()));

  return wrap;
}

// ── Category section ───────────────────────────────────────────────────────────
function buildCategorySection() {
  const container = h('div', {});

  function rebuild() {
    container.innerHTML = '';
    const list = h('div', { className: 'cat-list' });

    for (const cat of store.categories) {
      const row = h('div', { className: 'cat-row' });

      const dot = h('span', { className: 'cat-dot' });
      dot.style.background = cat.color;
      row.appendChild(dot);
      row.appendChild(h('span', { className: 'cat-name', textContent: cat.name }));

      const acts = h('div', { className: 'cat-actions' });
      acts.appendChild(h('button', {
        className: 'btn btn-sm btn-ghost',
        textContent: '편집',
        onclick: () => openCategoryModal(cat.id, rebuild),
      }));
      acts.appendChild(h('button', {
        className: 'btn btn-sm btn-danger',
        textContent: '삭제',
        onclick: () => deleteCategory(cat.id, rebuild),
      }));
      row.appendChild(acts);
      list.appendChild(row);
    }

    container.appendChild(list);

    const btnRow = h('div', { className: 'cat-btn-row' });
    btnRow.appendChild(h('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '+ 카테고리 추가',
      onclick: () => openCategoryModal(null, rebuild),
    }));
    btnRow.appendChild(h('button', {
      className: 'btn btn-ghost btn-sm',
      textContent: '↺ 기본값 복원',
      onclick: () => restoreDefaultCategories(rebuild),
    }));
    container.appendChild(btnRow);
  }

  rebuild();
  return container;
}

function deleteCategory(catId, rebuild) {
  const inUse = store.accounts.some(a => a.category === catId);
  const msg = inUse
    ? '이 카테고리를 사용하는 계좌가 있습니다.\n계속하면 해당 계좌의 카테고리가 "기타"로 변경됩니다.\n삭제하시겠습니까?'
    : '이 카테고리를 삭제하시겠습니까?';
  if (!confirm(msg)) return;
  if (inUse) {
    const fallbackId = store.categories.find(c => c.id !== catId)?.id ?? '';
    store.accounts = store.accounts.map(a =>
      a.category === catId ? { ...a, category: fallbackId } : a
    );
  }
  store.categories = store.categories.filter(c => c.id !== catId);
  saveStore(store);
  rebuild();
}

function restoreDefaultCategories(rebuild) {
  if (!confirm('기본 카테고리(국내주식, 해외주식, 가상화폐, 기타)를 초기 이름과 색상으로 복원합니다.\n직접 추가한 카테고리는 유지됩니다.\n계속하시겠습니까?')) return;
  for (const def of DEFAULT_CATEGORIES) {
    const idx = store.categories.findIndex(c => c.id === def.id);
    if (idx >= 0) {
      // Reset only name + color; keep other fields intact
      store.categories[idx] = { ...store.categories[idx], name: def.name, color: def.color };
    } else {
      // Re-add deleted default — without isDefault so delete button is visible
      store.categories.push({ id: def.id, name: def.name, color: def.color, isDefault: false });
    }
  }
  saveStore(store);
  rebuild();
  showToast('기본 카테고리가 복원되었습니다.');
}

function openCategoryModal(catId, onSave) {
  const cat = catId ? store.categories.find(c => c.id === catId) : null;
  let selectedColor = cat?.color ?? '#4F46E5';

  const modal = h('div', { className: 'modal' });
  modal.appendChild(h('h2', { className: 'modal-title',
    textContent: cat ? '카테고리 편집' : '카테고리 추가' }));

  const nameGrp = h('div', { className: 'form-group' });
  nameGrp.appendChild(h('label', { className: 'form-label', textContent: '카테고리명' }));
  const nameInput = h('input', { className: 'form-input', type: 'text', value: cat?.name ?? '' });
  nameGrp.appendChild(nameInput);
  if (cat?.isDefault) {
    nameGrp.appendChild(h('p', { className: 'form-hint',
      textContent: '기본 카테고리 — 설정 화면의 "기본값 복원"으로 되돌릴 수 있습니다.' }));
  }
  modal.appendChild(nameGrp);

  const colorGrp = h('div', { className: 'form-group' });
  colorGrp.appendChild(h('label', { className: 'form-label', textContent: '색상' }));
  const colorPick = createColorPicker(selectedColor, c => { selectedColor = c; });
  colorGrp.appendChild(colorPick);
  modal.appendChild(colorGrp);

  const errEl = h('div', { className: 'form-error' });
  modal.appendChild(errEl);

  const footer = h('div', { className: 'modal-footer' });
  const right  = h('div', { className: 'modal-footer-right' });
  right.appendChild(h('button', { className: 'btn btn-ghost', textContent: '취소', onclick: closeModal }));
  right.appendChild(h('button', {
    className: 'btn btn-primary',
    textContent: '저장',
    onclick: () => {
      const name = nameInput.value.trim();
      if (!name) { errEl.textContent = '카테고리명을 입력하세요.'; return; }
      if (cat) {
        const idx = store.categories.findIndex(c => c.id === catId);
        store.categories[idx] = { ...store.categories[idx], name, color: selectedColor };
      } else {
        store.categories.push({ id: makeId('cat'), name, color: selectedColor, isDefault: false });
      }
      saveStore(store);
      closeModal();
      onSave();
    },
  }));
  footer.appendChild(right);
  modal.appendChild(footer);

  openModal(modal);
}

// ── TWR section ────────────────────────────────────────────────────────────────
function buildTWRSection() {
  const row = h('div', { className: 'settings-toggle-row' });

  const labelWrap = h('div', {});
  labelWrap.appendChild(h('div', { className: 'settings-row-title',
    textContent: '시간가중수익률 (TWR) 사용' }));
  labelWrap.appendChild(h('div', { className: 'settings-row-desc',
    textContent: '입출금의 영향을 제거한 TWR로 수익률을 표시합니다.' }));
  row.appendChild(labelWrap);

  const toggle = h('label', { className: 'toggle-switch' });
  const checkbox = h('input', { type: 'checkbox' });
  if (store.ui.useTWR) checkbox.checked = true;
  checkbox.addEventListener('change', () => {
    store.ui.useTWR = checkbox.checked;
    saveStore(store);
  });
  toggle.appendChild(checkbox);
  toggle.appendChild(h('span', { className: 'toggle-slider' }));
  row.appendChild(toggle);

  return row;
}

// ── Mobile detection ───────────────────────────────────────────────────────────
function isMobile() {
  return /Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
}

function mobileLockedNotice(msg) {
  const box = h('div', { className: 'mobile-locked-notice' });
  box.appendChild(h('span', { className: 'mobile-locked-icon', textContent: '🔒' }));
  box.appendChild(h('span', { textContent: msg }));
  return box;
}

// ── Backup section ─────────────────────────────────────────────────────────────
function buildBackupSection() {
  const wrap = h('div', { className: 'backup-section' });

  // Filename input
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const defaultFilename = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}_mymoney.xlsx`;

  const filenameGroup = h('div', { className: 'backup-filename-group' });
  filenameGroup.appendChild(h('label', { className: 'backup-filename-label', textContent: '저장 파일명' }));
  const filenameInput = h('input', {
    type: 'text',
    className: 'form-input backup-filename-input',
    value: defaultFilename,
    placeholder: 'yyyymmddHHmm_mymoney.xlsx',
  });
  filenameGroup.appendChild(filenameInput);
  filenameGroup.appendChild(h('p', { className: 'form-hint', textContent: '파일 저장 대화상자가 열리면 원하는 폴더를 선택하세요. 지원하지 않는 환경에서는 다운로드 폴더에 자동 저장됩니다.' }));
  wrap.appendChild(filenameGroup);

  // Buttons
  const btnRow = h('div', { className: 'backup-row' });

  btnRow.appendChild(h('button', {
    className: 'btn btn-secondary',
    textContent: '엑셀로 내보내기 (.xlsx)',
    onclick: async function() {
      try {
        const fname = filenameInput.value.trim() || defaultFilename;
        await exportToExcel(fname);
        showToast('백업 파일이 저장되었습니다.');
      } catch (err) {
        if (err.name === 'AbortError') return;
        showToast('내보내기 실패: ' + err.message, 'error');
      }
    },
  }));

  const fileInput = h('input', { type: 'file', accept: '.xlsx' });
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    fileInput.value = '';
    try {
      const parsed = await parseImport(file);
      openImportPreviewModal(parsed);
    } catch (err) {
      showToast('파일 읽기 실패: ' + err.message, 'error');
    }
  });

  btnRow.appendChild(h('button', {
    className: 'btn btn-secondary',
    textContent: '엑셀에서 가져오기',
    onclick: () => fileInput.click(),
  }));
  btnRow.appendChild(fileInput);
  wrap.appendChild(btnRow);

  return wrap;
}

function openImportPreviewModal(parsed) {
  const modal = h('div', { className: 'modal' });
  modal.appendChild(h('h2', { className: 'modal-title', textContent: '가져오기 미리보기' }));

  if (parsed.errors.length) {
    const box = h('div', { className: 'import-error-box' });
    box.appendChild(h('strong', { textContent: '오류 (해당 행 제외됨):' }));
    const ul = h('ul', {});
    parsed.errors.forEach(msg => ul.appendChild(h('li', { textContent: msg })));
    box.appendChild(ul);
    modal.appendChild(box);
  }

  if (parsed.warnings.length) {
    const box = h('div', { className: 'import-warn-box' });
    box.appendChild(h('strong', { textContent: '경고:' }));
    const ul = h('ul', {});
    parsed.warnings.forEach(msg => ul.appendChild(h('li', { textContent: msg })));
    box.appendChild(ul);
    modal.appendChild(box);
  }

  const summary = h('div', { className: 'import-summary' });
  [
    ['계좌',    parsed.accounts.length],
    ['거래',    parsed.transactions.length],
    ['템플릿',  parsed.templates.length],
    ['카테고리', parsed.categories.length],
  ].forEach(([label, count]) => {
    summary.appendChild(h('div', { className: 'import-summary-row' },
      h('span', { textContent: label }),
      h('strong', { textContent: `${count}개` }),
    ));
  });
  modal.appendChild(summary);

  const modeGrp = h('div', { className: 'form-group' });
  modeGrp.appendChild(h('label', { className: 'form-label', textContent: '가져오기 방식' }));
  const modeSel = createCustomSelect(
    [
      { value: 'merge',     label: '병합 (ID 기준, 기존 데이터 유지)' },
      { value: 'overwrite', label: '덮어쓰기 (기존 데이터 전체 교체)' },
    ],
    'merge',
    () => {},
  );
  modeGrp.appendChild(modeSel);
  modal.appendChild(modeGrp);

  const hasData = parsed.accounts.length + parsed.transactions.length + parsed.templates.length > 0;

  const footer = h('div', { className: 'modal-footer' });
  const right  = h('div', { className: 'modal-footer-right' });
  right.appendChild(h('button', { className: 'btn btn-ghost', textContent: '취소', onclick: closeModal }));

  const applyBtn = h('button', {
    className: 'btn btn-primary',
    textContent: '가져오기 실행',
    onclick: () => {
      if (modeSel._getValue() === 'overwrite') {
        if (!confirm('기존 데이터가 모두 삭제됩니다. 계속하시겠습니까?')) return;
      }
      applyImport(parsed, modeSel._getValue());
      showToast('가져오기가 완료되었습니다.');
    },
  });
  if (!hasData) applyBtn.disabled = true;
  right.appendChild(applyBtn);
  footer.appendChild(right);
  modal.appendChild(footer);

  openModal(modal);
}

// ── Danger zone ────────────────────────────────────────────────────────────────
function buildDangerSection() {
  const wrap = h('div', { className: 'danger-zone' });

  if (isMobile()) {
    wrap.appendChild(mobileLockedNotice('모바일에서는 데이터 초기화를 사용할 수 없습니다. PC 브라우저에서 이용하세요.'));
    return wrap;
  }

  wrap.appendChild(h('p', { className: 'danger-desc',
    textContent: '모든 데이터(계좌, 거래, 템플릿)를 초기화합니다. 이 작업은 되돌릴 수 없습니다.' }));
  wrap.appendChild(h('button', {
    className: 'btn btn-danger',
    textContent: '데이터 전체 초기화',
    onclick: () => {
      if (!confirm('정말로 모든 데이터를 초기화하시겠습니까?')) return;
      if (!confirm('다시 한번 확인합니다. 모든 계좌, 거래, 템플릿이 삭제됩니다. 계속하시겠습니까?')) return;
      store = createDefaultStore();
      saveStore(store);
      navigate('dashboard');
      showToast('데이터가 초기화되었습니다.');
    },
  }));
  return wrap;
}
