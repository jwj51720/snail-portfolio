'use strict';

// ── Export ─────────────────────────────────────────────────────────────────────
async function exportToExcel(filename) {
  if (!filename) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    filename = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}_mymoney.xlsx`;
  }
  if (!filename.endsWith('.xlsx')) filename += '.xlsx';

  // Acquire file handle FIRST while user-activation is still fresh
  let fileHandle = null;
  if (typeof showSaveFilePicker !== 'undefined') {
    try {
      fileHandle = await showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Excel 파일 (.xlsx)', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }],
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e; // user cancelled — propagate so toast is suppressed
      // Any other error (SecurityError etc.): fall through to triggerDownload
    }
  }

  // Build workbook after the picker interaction
  const wb = XLSX.utils.book_new();

  function addSheet(sheetName, headers, rows) {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  addSheet('accounts',
    ['id', 'name', 'category', 'purpose', 'color', 'emoji', 'isArchived', 'isStarred'],
    store.accounts.map(a => [
      a.id, a.name, a.category, a.purpose ?? '', a.color ?? '',
      a.emoji ?? '', a.isArchived ? 'true' : 'false', a.isStarred ? 'true' : 'false',
    ])
  );

  addSheet('transactions',
    ['id', 'accountId', 'date', 'type', 'amount', 'valuation', 'memo', 'isSeed', 'templateId'],
    store.transactions.map(t => [
      t.id, t.accountId, t.date, t.type,
      t.amount != null ? t.amount : '',
      t.valuation != null ? t.valuation : '',
      t.memo ?? '',
      t.isSeed ? 'true' : '',
      t.templateId ?? '',
    ])
  );

  addSheet('templates',
    ['id', 'name', 'mode', 'entries'],
    store.templates.map(t => [t.id, t.name, t.mode, JSON.stringify(t.entries)])
  );

  addSheet('categories',
    ['id', 'name', 'color', 'isDefault'],
    store.categories.map(c => [c.id, c.name, c.color, c.isDefault ? 'true' : 'false'])
  );

  addSheet('goals',
    ['id', 'emoji', 'name', 'targetAmount', 'createdAt', 'accountIds'],
    (store.goals ?? []).map(g => [
      g.id, g.emoji, g.name, g.targetAmount, g.createdAt ?? '',
      g.accountIds ? JSON.stringify(g.accountIds) : '',
    ])
  );

  const wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}

// ── Import / Parse ─────────────────────────────────────────────────────────────
function parseImport(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const result = {
          accounts: [], transactions: [], templates: [], categories: [], goals: [],
          errors: [], warnings: [],
        };

        function getSheet(name) {
          const ws = wb.Sheets[name];
          if (!ws) { result.errors.push(`시트 "${name}" 없음`); return null; }
          // Support both new format (1 header row) and legacy (2 header rows)
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
          if (rows.length < 1) { result.errors.push(`시트 "${name}" 헤더 부족`); return null; }
          return rows;
        }

        function parseRows(rows) {
          // Detect legacy (2-header) vs new (1-header) format
          // If row[1] is all lowercase strings with no spaces, treat as legacy
          const legacy = rows.length >= 2 && Array.isArray(rows[1]) &&
            rows[1].every(c => typeof c === 'string' && c === c.toLowerCase() && !c.includes(' '));
          const keys = legacy ? rows[1] : rows[0];
          const dataStart = legacy ? 2 : 1;
          return { keys, dataStart };
        }

        // accounts
        const accRows = getSheet('accounts');
        if (accRows) {
          const { keys, dataStart } = parseRows(accRows);
          for (let i = dataStart; i < accRows.length; i++) {
            const row = accRows[i];
            if (!row || row.every(c => c == null || c === '')) continue;
            const obj = {};
            keys.forEach((k, j) => { obj[k] = row[j]; });
            if (!obj.id || !obj.name || !obj.category) {
              result.errors.push(`accounts 행 ${i + 1}: id/name/category 필수`);
              continue;
            }
            result.accounts.push({
              id:         String(obj.id),
              name:       String(obj.name),
              category:   String(obj.category),
              purpose:    obj.purpose   ? String(obj.purpose)   : '',
              color:      obj.color     ? String(obj.color)     : '',
              emoji:      obj.emoji     ? String(obj.emoji)     : '',
              isArchived: String(obj.isArchived) === 'true',
              isStarred:  String(obj.isStarred)  === 'true',
            });
          }
        }

        // transactions
        const txnRows = getSheet('transactions');
        if (txnRows) {
          const { keys, dataStart } = parseRows(txnRows);
          for (let i = dataStart; i < txnRows.length; i++) {
            const row = txnRows[i];
            if (!row || row.every(c => c == null || c === '')) continue;
            const obj = {};
            keys.forEach((k, j) => { obj[k] = row[j]; });
            if (!obj.id || !obj.accountId || !obj.date || !obj.type) {
              result.errors.push(`transactions 행 ${i + 1}: 필수 필드 누락`);
              continue;
            }
            if (!['deposit', 'withdraw', 'snapshot'].includes(String(obj.type))) {
              result.errors.push(`transactions 행 ${i + 1}: type 값 이상 (${obj.type})`);
              continue;
            }
            const amount = (obj.amount !== '' && obj.amount != null) ? Number(obj.amount) : null;
            const valuation = (obj.valuation !== '' && obj.valuation != null) ? Number(obj.valuation) : null;

            // Snapshot must have valuation
            if (String(obj.type) === 'snapshot' && (valuation == null || isNaN(valuation) || valuation < 0)) {
              result.errors.push(`transactions 행 ${i + 1}: 스냅샷은 평가액 필수`);
              continue;
            }
            if (amount != null && (isNaN(amount) || amount < 0)) {
              result.errors.push(`transactions 행 ${i + 1}: 금액 이상`);
              continue;
            }
            const txn = {
              id:        String(obj.id),
              accountId: String(obj.accountId),
              date:      String(obj.date),
              type:      String(obj.type),
              memo:      obj.memo ? String(obj.memo) : '',
            };
            if (valuation != null && !isNaN(valuation)) txn.valuation = Math.round(valuation);
            if (amount != null)     txn.amount     = Math.round(amount);
            if (obj.isSeed === 'true') txn.isSeed  = true;
            if (obj.templateId)     txn.templateId = String(obj.templateId);
            result.transactions.push(txn);
          }
        }

        // templates
        const tmplRows = getSheet('templates');
        if (tmplRows) {
          const { keys, dataStart } = parseRows(tmplRows);
          for (let i = dataStart; i < tmplRows.length; i++) {
            const row = tmplRows[i];
            if (!row || row.every(c => c == null || c === '')) continue;
            const obj = {};
            keys.forEach((k, j) => { obj[k] = row[j]; });
            if (!obj.id || !obj.name || !obj.mode) {
              result.errors.push(`templates 행 ${i + 1}: 필수 필드 누락`);
              continue;
            }
            let entries = [];
            try { entries = JSON.parse(obj.entries || '[]'); } catch {
              result.warnings.push(`templates 행 ${i + 1}: entries JSON 파싱 실패, 빈 배열 사용`);
            }
            result.templates.push({
              id:      String(obj.id),
              name:    String(obj.name),
              mode:    String(obj.mode),
              entries,
            });
          }
        }

        // categories
        const catRows = getSheet('categories');
        if (catRows) {
          const { keys, dataStart } = parseRows(catRows);
          for (let i = dataStart; i < catRows.length; i++) {
            const row = catRows[i];
            if (!row || row.every(c => c == null || c === '')) continue;
            const obj = {};
            keys.forEach((k, j) => { obj[k] = row[j]; });
            if (!obj.id || !obj.name) {
              result.errors.push(`categories 행 ${i + 1}: id/name 필수`);
              continue;
            }
            result.categories.push({
              id:        String(obj.id),
              name:      String(obj.name),
              color:     obj.color ? String(obj.color) : '#828282',
              isDefault: String(obj.isDefault) === 'true',
            });
          }
        }

        // goals (optional sheet — older exports won't have it)
        const goalRows = wb.Sheets['goals']
          ? XLSX.utils.sheet_to_json(wb.Sheets['goals'], { header: 1 })
          : null;
        if (goalRows && goalRows.length > 1) {
          const { keys, dataStart } = parseRows(goalRows);
          for (let i = dataStart; i < goalRows.length; i++) {
            const row = goalRows[i];
            if (!row || row.every(c => c == null || c === '')) continue;
            const obj = {};
            keys.forEach((k, j) => { obj[k] = row[j]; });
            if (!obj.id || !obj.name || !obj.targetAmount) continue;
            let accountIds = null;
            if (obj.accountIds && String(obj.accountIds).trim() !== '') {
              try { accountIds = JSON.parse(String(obj.accountIds)); } catch { accountIds = null; }
            }
            result.goals.push({
              id:           String(obj.id),
              emoji:        obj.emoji ? String(obj.emoji) : '🎯',
              name:         String(obj.name),
              targetAmount: Number(obj.targetAmount),
              createdAt:    obj.createdAt ? String(obj.createdAt) : '',
              accountIds,
            });
          }
        }

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function mergeById(existing, incoming) {
  const map = new Map(existing.map(x => [x.id, x]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}

function applyImport(parsed, mode) {
  if (mode === 'overwrite') {
    store.accounts     = parsed.accounts;
    store.transactions = parsed.transactions;
    store.templates    = parsed.templates;
    if (parsed.categories.length) store.categories = parsed.categories;
    if (parsed.goals?.length)     store.goals = parsed.goals;
  } else {
    store.accounts     = mergeById(store.accounts,     parsed.accounts);
    store.transactions = mergeById(store.transactions, parsed.transactions);
    store.templates    = mergeById(store.templates,    parsed.templates);
    if (parsed.categories.length)
      store.categories = mergeById(store.categories,   parsed.categories);
    if (parsed.goals?.length)
      store.goals = mergeById(store.goals ?? [],       parsed.goals);
  }
  saveStore(store);
  render();
}
