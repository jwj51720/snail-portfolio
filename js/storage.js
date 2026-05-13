const STORAGE_KEY = 'myvault_v1';

const DEFAULT_CATEGORIES = [
  { id: 'domestic', name: '국내주식', color: '#5B8DEF', isDefault: true },
  { id: 'overseas', name: '해외주식', color: '#F2994A', isDefault: true },
  { id: 'crypto',   name: '가상화폐', color: '#9B51E0', isDefault: true },
  { id: 'etc',      name: '기타',     color: '#828282', isDefault: true },
];

function createDefaultStore() {
  return {
    accounts: [],
    transactions: [],
    templates: [],
    goals: [],
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    ui: {
      route: 'dashboard',
      period: 'all',
      customRange: null,
      routeParams: {},
      useTWR: true,
    },
  };
}

function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('[storage] saveStore failed:', e);
    if (typeof showSaveBanner === 'function') showSaveBanner();
  }
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultStore();
    const parsed = JSON.parse(raw);
    const period = parsed.ui?.period ?? 'all';
    return {
      accounts:     parsed.accounts     ?? [],
      transactions: parsed.transactions ?? [],
      templates:    parsed.templates    ?? [],
      goals:        parsed.goals        ?? [],
      categories:   parsed.categories   ?? DEFAULT_CATEGORIES.map(c => ({ ...c })),
      ui: {
        route:       parsed.ui?.route       ?? 'accounts',
        period:      period === '1w' ? '1m' : period,   // migrate removed 1w period
        customRange: parsed.ui?.customRange ?? null,
        routeParams: parsed.ui?.routeParams ?? {},
        useTWR:      parsed.ui?.useTWR      ?? false,
      },
    };
  } catch (e) {
    console.error('[storage] loadStore failed, returning default:', e);
    return createDefaultStore();
  }
}
