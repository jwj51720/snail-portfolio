'use strict';

// ─── DOM helper ───────────────────────────────────────────────────────────────
// h(tag, attrs, ...children) — safe element factory.
// User data must always pass through textContent (in attrs or set after).
// innerHTML is never called with user data.
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'className')        { el.className   = v; }
      else if (k === 'textContent') { el.textContent = v; }
      else if (k.startsWith('on')) { el.addEventListener(k.slice(2).toLowerCase(), v); }
      else                          { el.setAttribute(k, v); }
    }
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    if (child instanceof Node) el.appendChild(child);
    else el.appendChild(document.createTextNode(String(child)));
  }
  return el;
}

// ─── Modal management ─────────────────────────────────────────────────────────
let _activeModal = null;
let _escHandler  = null;

function openModal(modalEl) {
  closeModal();

  // Esc closes the modal
  _escHandler = e => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', _escHandler);

  // Enter submits the primary button — skip textarea, select, and button targets
  // (buttons handle their own Enter/click via browser default)
  modalEl.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.tagName === 'TEXTAREA') return;
    if (e.target.tagName === 'SELECT')   return;
    if (e.target.tagName === 'BUTTON')   return;
    const primary = modalEl.querySelector('.modal-footer .btn-primary:not(:disabled)');
    if (primary) { e.preventDefault(); primary.click(); }
  });

  const overlay = h('div', { className: 'modal-overlay' }, modalEl);
  // Overlay click intentionally does NOT close — only Cancel button or Esc closes modals
  document.body.appendChild(overlay);
  _activeModal = overlay;
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    const first = modalEl.querySelector('input:not([disabled]), select, textarea');
    if (first) first.focus();
  });
}

function closeModal() {
  if (!_activeModal) return;
  if (_escHandler) {
    document.removeEventListener('keydown', _escHandler);
    _escHandler = null;
  }
  // Clean up any portaled custom-select dropdowns left open
  document.querySelectorAll('.cselect-dropdown').forEach(el => el.remove());
  _activeModal.remove();
  _activeModal = null;
  document.body.style.overflow = '';
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function navigate(route, params = {}) {
  store.ui.route = route;
  store.ui.routeParams = { ...params };
  saveStore(store);
  render();
}

// ─── Nav items (shared by desktop + mobile nav) ───────────────────────────────
const NAV_ITEMS = [
  { label: '대시보드', route: 'dashboard' },
  { label: '계좌 목록', route: 'accounts'  },
  { label: '템플릿',   route: 'templates' },
  { label: '설정',     route: 'settings'  },
];

// ─── Desktop nav bar ──────────────────────────────────────────────────────────
function renderNav() {
  const nav = h('nav', { className: 'nav' },
    h('button', { className: 'nav-brand', textContent: '🐌', onclick: () => navigate('dashboard') })
  );

  const links = h('div', { className: 'nav-links' });
  for (const item of NAV_ITEMS) {
    links.appendChild(h('button', {
      className: 'nav-link' + (store.ui.route === item.route ? ' active' : ''),
      textContent: item.label,
      'data-route': item.route,
    }));
  }
  links.addEventListener('click', e => {
    const btn = e.target.closest('[data-route]');
    if (btn) navigate(btn.getAttribute('data-route'));
  });
  nav.appendChild(links);
  return nav;
}

// ─── Mobile bottom tab bar ────────────────────────────────────────────────────
// SVG strings are hardcoded constants — not user data — so innerHTML is safe here.
const _MOBILE_ICONS = {
  dashboard: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  accounts:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  templates: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>',
  settings:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};

function renderMobileNav() {
  const nav = h('nav', { className: 'mobile-nav' });
  for (const item of NAV_ITEMS) {
    const isActive = store.ui.route === item.route ||
      (item.route === 'accounts' && store.ui.route === 'account-detail');

    const btn = h('button', {
      className: 'mobile-nav-item' + (isActive ? ' active' : ''),
      'data-route': item.route,
    });

    const icon = h('span', { className: 'mobile-nav-icon' });
    // Safe: hardcoded SVG constants, never user data
    icon.innerHTML = _MOBILE_ICONS[item.route] ?? '';

    btn.appendChild(icon);
    btn.appendChild(h('span', { className: 'mobile-nav-label', textContent: item.label }));
    nav.appendChild(btn);
  }
  nav.addEventListener('click', e => {
    const btn = e.target.closest('[data-route]');
    if (btn) navigate(btn.getAttribute('data-route'));
  });
  return nav;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const old = document.getElementById('_toast');
  if (old) old.remove();
  const toast = h('div', { id: '_toast', className: `toast toast-${type}` });
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-out'), 2600);
  setTimeout(() => toast.remove(), 3000);
}

// ─── Save-error banner ────────────────────────────────────────────────────────
function showSaveBanner() {
  if (document.getElementById('_save-banner')) return;
  const banner = h('div', { id: '_save-banner', className: 'save-error-banner' });
  banner.appendChild(h('span', {
    textContent: '저장에 실패했습니다. 저장 공간이 부족할 수 있습니다. 엑셀로 백업해 주세요.',
  }));
  banner.appendChild(h('button', {
    className: 'btn btn-sm save-banner-btn',
    textContent: '엑셀로 내보내기',
    onclick: () => {
      try { exportToExcel(); } catch (_) { /* best effort */ }
    },
  }));
  const app = document.getElementById('app');
  const nav = app.querySelector('.nav');
  if (nav) nav.after(banner);
  else app.prepend(banner);
}

// ─── Custom Select ────────────────────────────────────────────────────────────
// createCustomSelect(options, currentValue, onChange)
// options: [{ value, label }]  — returns a DOM node with ._getValue() / ._setValue()
function createCustomSelect(options, currentValue, onChange) {
  let value = currentValue ?? '';
  const wrap = h('div', { className: 'cselect' });

  const trigger = h('button', { className: 'cselect-trigger', type: 'button' });
  const valueSpan = h('span', { className: 'cselect-value' });
  const arrowEl   = h('span', { className: 'cselect-arrow' });
  // Safe: hardcoded SVG constant
  arrowEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  trigger.appendChild(valueSpan);
  trigger.appendChild(arrowEl);

  function updateDisplay() {
    const opt = options.find(o => o.value === value);
    if (opt) {
      valueSpan.textContent = opt.label;
      valueSpan.className   = 'cselect-value';
    } else {
      valueSpan.textContent = options[0]?.label ?? '선택...';
      valueSpan.className   = 'cselect-value cselect-placeholder';
    }
  }
  updateDisplay();

  const dropdown = h('div', { className: 'cselect-dropdown' });
  let isOpen = false;

  function openDropdown() {
    if (isOpen) return;
    isOpen = true;
    wrap.classList.add('open');

    dropdown.innerHTML = '';
    options.forEach(opt => {
      const item = h('div', {
        className: 'cselect-option' + (opt.value === value ? ' selected' : ''),
        textContent: opt.label,
      });
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        value = opt.value;
        onChange(value);
        updateDisplay();
        closeDropdown();
      });
      dropdown.appendChild(item);
    });

    // Portal to body so overflow:auto on modal doesn't clip the dropdown
    dropdown.style.position = 'fixed';
    document.body.appendChild(dropdown);

    requestAnimationFrame(() => {
      if (!dropdown.isConnected) return;
      const rect      = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      dropdown.style.left  = rect.left + 'px';
      dropdown.style.width = rect.width + 'px';
      if (spaceBelow >= 150 || spaceBelow >= spaceAbove) {
        dropdown.style.top       = (rect.bottom + 4) + 'px';
        dropdown.style.bottom    = '';
        dropdown.style.maxHeight = Math.min(spaceBelow, 220) + 'px';
      } else {
        dropdown.style.top       = '';
        dropdown.style.bottom    = (window.innerHeight - rect.top + 4) + 'px';
        dropdown.style.maxHeight = Math.min(spaceAbove, 220) + 'px';
      }
    });

    setTimeout(() => {
      document.addEventListener('click', outsideClick);
      document.addEventListener('scroll', closeDropdown, { capture: true, passive: true });
    }, 0);
  }

  function closeDropdown() {
    if (!isOpen) return;
    isOpen = false;
    wrap.classList.remove('open');
    if (dropdown.isConnected) dropdown.remove();
    document.removeEventListener('click', outsideClick);
    document.removeEventListener('scroll', closeDropdown, { capture: true });
  }

  function outsideClick(e) {
    if (!wrap.contains(e.target) && !dropdown.contains(e.target)) closeDropdown();
  }

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    isOpen ? closeDropdown() : openDropdown();
  });
  trigger.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isOpen ? closeDropdown() : openDropdown(); }
    if (e.key === 'Escape') closeDropdown();
  });

  wrap.appendChild(trigger);
  wrap._getValue = () => value;
  wrap._setValue = v => { value = v; updateDisplay(); };
  return wrap;
}

// ─── Custom Color Picker ──────────────────────────────────────────────────────
// 8 vivid presets + "?" random + rainbow (HSV picker). No OS native picker.
const _PRESET_COLORS = [
  '#F03D3D', '#F0844A', '#F0C030', '#00C076',
  '#00ACC1', '#1557EF', '#7C4EF0', '#E91E63',
];
const _COLOR_PALETTE = _PRESET_COLORS; // backwards-compat alias

function _hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function _hexToHsv(hex) {
  const { r, g, b } = _hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    if (max === rn)      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else                 h = ((rn - gn) / d + 4) / 6;
  }
  return { h: h * 360, s, v };
}

function _hsvToHex(h, s, v) {
  const hi = Math.floor(h / 60) % 6;
  const f  = h / 60 - Math.floor(h / 60);
  const p  = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][hi];
  return '#' + rgb.map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function _colorDist(hex1, hex2) {
  const a = _hexToRgb(hex1), b = _hexToRgb(hex2);
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function _randomVividColor(exclude) {
  let best = null, bestDist = -1;
  for (let i = 0; i < 40; i++) {
    const c = _hsvToHex(Math.random() * 360, 0.6 + Math.random() * 0.4, 0.55 + Math.random() * 0.45);
    const d = exclude.length ? Math.min(...exclude.map(e => _colorDist(c, e))) : 999;
    if (d > bestDist) { best = c; bestDist = d; }
  }
  return best;
}

function createColorPicker(currentColor, onChange) {
  let color = (currentColor && /^#[0-9a-fA-F]{6}$/.test(currentColor))
    ? currentColor.toUpperCase()
    : _PRESET_COLORS[5]; // default: blue

  let randColor = null;
  let hsvOpen   = false;
  let hsv       = _hexToHsv(color);

  const wrap = h('div', { className: 'cpicker' });

  // ── Swatch row (8 presets + ? + rainbow) ──────────────────────
  const swatchRow = h('div', { className: 'cpicker-swatches' });

  function closeHsv() {
    hsvOpen = false;
    hsvSection.style.display = 'none';
    rainbowEl.classList.remove('active');
  }

  const presetEls = _PRESET_COLORS.map(c => {
    const sw = h('button', { className: 'cpicker-swatch', type: 'button' });
    sw.style.background = c;
    sw.dataset.color = c;
    sw.addEventListener('click', () => { closeHsv(); pickColor(c); syncSwatches(); });
    swatchRow.appendChild(sw);
    return sw;
  });

  const randEl = h('button', {
    className: 'cpicker-swatch cpicker-swatch-rand',
    type: 'button', textContent: '↺',
  });
  randEl.addEventListener('click', () => {
    closeHsv();
    randColor = _randomVividColor([..._PRESET_COLORS, ...(randColor ? [randColor] : [])]);
    randEl.style.background = randColor;
    pickColor(randColor);
    syncSwatches();
  });
  swatchRow.appendChild(randEl);

  const rainbowEl = h('button', { className: 'cpicker-swatch cpicker-swatch-rainbow', type: 'button' });
  rainbowEl.addEventListener('click', () => {
    hsvOpen = !hsvOpen;
    hsvSection.style.display = hsvOpen ? 'flex' : 'none';
    rainbowEl.classList.toggle('active', hsvOpen);
    if (hsvOpen) {
      // Clear all preset/rand selections — only rainbow is "active"
      presetEls.forEach(sw => sw.classList.remove('selected'));
      randEl.classList.remove('selected');
      hsv = _hexToHsv(color); updateHsvUI();
    }
  });
  swatchRow.appendChild(rainbowEl);
  wrap.appendChild(swatchRow);

  // ── HSV picker ─────────────────────────────────────────────────
  const hsvSection = h('div', { className: 'cpicker-hsv' });
  hsvSection.style.display = 'none';

  const svArea = h('div', { className: 'cpicker-sv-area' },
    h('div', { className: 'cpicker-sv-white' }),
    h('div', { className: 'cpicker-sv-black' }),
  );
  const svHandle = h('div', { className: 'cpicker-sv-handle' });
  svArea.appendChild(svHandle);

  const hueBar = h('div', { className: 'cpicker-hue-bar' });
  const hueHandle = h('div', { className: 'cpicker-hue-handle' });
  hueBar.appendChild(hueHandle);

  const hsvBottom = h('div', { className: 'cpicker-bottom' });
  const preview   = h('div', { className: 'cpicker-preview' });
  preview.style.background = color;

  const hexInput = h('input', {
    className: 'cpicker-hex',
    type: 'text', value: color, maxlength: 7,
    placeholder: '#RRGGBB', spellcheck: false,
  });
  hexInput.addEventListener('input', () => {
    let v = hexInput.value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      color = v.toUpperCase();
      hsv = _hexToHsv(color);
      preview.style.background = color;
      syncSwatches(); updateHsvUI();
      onChange(color);
    }
  });
  hsvBottom.appendChild(preview);
  hsvBottom.appendChild(hexInput);
  hsvSection.appendChild(svArea);
  hsvSection.appendChild(hueBar);
  hsvSection.appendChild(hsvBottom);
  wrap.appendChild(hsvSection);

  function pickColor(c) {
    color = c.toUpperCase();
    preview.style.background = color;
    hexInput.value = color;
    onChange(color);
  }

  function syncSwatches() {
    const up = color.toUpperCase();
    presetEls.forEach(sw =>
      sw.classList.toggle('selected', sw.dataset.color.toUpperCase() === up));
    randEl.classList.toggle('selected', randColor != null && randColor.toUpperCase() === up);
  }

  function updateHsvUI() {
    svArea.style.background = `hsl(${hsv.h.toFixed(1)}, 100%, 50%)`;
    svHandle.style.left = (hsv.s * 100).toFixed(1) + '%';
    svHandle.style.top  = ((1 - hsv.v) * 100).toFixed(1) + '%';
    hueHandle.style.left = (hsv.h / 360 * 100).toFixed(1) + '%';
  }

  function makeDragHandler(area, applyFn) {
    area.addEventListener('mousedown', e => {
      e.preventDefault();
      applyFn(e);
      const move = e2 => applyFn(e2);
      const up   = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  makeDragHandler(svArea, e => {
    const rect = svArea.getBoundingClientRect();
    hsv.s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    hsv.v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    pickColor(_hsvToHex(hsv.h, hsv.s, hsv.v));
    syncSwatches(); updateHsvUI();
  });

  makeDragHandler(hueBar, e => {
    const rect = hueBar.getBoundingClientRect();
    hsv.h = Math.max(0, Math.min(359.99, (e.clientX - rect.left) / rect.width * 360));
    pickColor(_hsvToHex(hsv.h, hsv.s, hsv.v));
    syncSwatches(); updateHsvUI();
  });

  syncSwatches();
  wrap._getValue = () => color;
  wrap._setValue = c => {
    if (c && /^#[0-9a-fA-F]{6}$/.test(c)) {
      color = c.toUpperCase();
      preview.style.background = color;
      hexInput.value = color;
      syncSwatches();
      if (hsvOpen) { hsv = _hexToHsv(color); updateHsvUI(); }
      onChange(color);
    }
  };
  return wrap;
}

// ─── Placeholder view ─────────────────────────────────────────────────────────
function renderPlaceholder(msg) {
  return h('div', { className: 'placeholder-screen' },
    h('p', { textContent: msg })
  );
}

// ─── Main render ──────────────────────────────────────────────────────────────
function render() {
  closeModal();
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(renderNav());

  const main = h('main', { className: 'main-content' });

  switch (store.ui.route) {
    case 'dashboard':
      main.appendChild(renderDashboard());
      break;
    case 'accounts':
      main.appendChild(renderAccounts());
      break;
    case 'account-detail': {
      const accountId = store.ui.routeParams?.accountId;
      main.appendChild(renderAccountDetail(accountId));
      break;
    }
    case 'templates':
      main.appendChild(renderTemplates());
      break;
    case 'settings':
      main.appendChild(renderSettings());
      break;
    default:
      main.appendChild(renderDashboard());
  }

  app.appendChild(main);
  app.appendChild(renderMobileNav());
}
