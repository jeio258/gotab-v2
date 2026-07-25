/**
 * 状态管理模块
 */

export const DEFAULT_ENGINES = [
  { id: '_baidu', label: '百度', urlFormat: 'https://www.baidu.com/s?wd=%s', enabled: 1 },
  { id: '_bing', label: 'Bing', urlFormat: 'https://www.bing.com/search?q=%s', enabled: 1 },
  { id: '_google', label: 'Google', urlFormat: 'https://www.google.com/search?q=%s', enabled: 1 },
];

export function loadFromStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage full — ignore */ }
}

export const appState = {
  user: loadFromStorage('gotab_user', null),
  data: loadFromStorage('gotab_data', {
    categories: [],
    links: [],
    searchEngines: [...DEFAULT_ENGINES],
    wallpapers: [],
  }),
  activeCategory: 'all',
  backgroundImage: '',
  theme: 'dark',
  blur: 0,
  sidebarOpen: false,
  activeEngine: '百度',
  activeEngineUrl: 'https://www.baidu.com/s?wd=%s',
};

// 初始化主题
export function initTheme() {
  const settings = appState.data.settings || {};
  appState.theme = settings.theme || 'dark';
  appState.backgroundImage = settings.bg || '';
  appState.blur = settings.blur || 0;
  applyTheme();
}

export function applyTheme() {
  document.documentElement.setAttribute('data-theme', appState.theme);
  document.documentElement.style.setProperty('--card-blur', appState.blur + 'px');
  document.body.className = appState.backgroundImage ? 'has-bg' : '';
  if (appState.backgroundImage) {
    document.body.style.backgroundImage = `url(${appState.backgroundImage})`;
  } else {
    document.body.style.backgroundImage = '';
  }
}
