/**
 * UI 渲染模块
 */
import { appState, DEFAULT_ENGINES } from './state.js';

// HTML 转义
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// 显示 Toast
export function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

// 获取图标 HTML
export function renderIcon(iconUrl, linkUrl) {
  if (iconUrl && /^https?:\/\//.test(iconUrl)) {
    return `<img src="${escapeHtml(iconUrl)}" loading="lazy"
      onerror="this.outerHTML='<span class=\\'fallback-icon\\'>'+ (this.closest('.icon')?.dataset?.letter || 'L') +'</span>'">`;
  }

  if (linkUrl) {
    try {
      const hostname = new URL(linkUrl).hostname;
      const letter = hostname[0]?.toUpperCase() || 'L';
      return `<img src="https://faviconsnap.com/api/favicon?url=${encodeURIComponent(linkUrl)}"
        loading="lazy"
        onerror="this.outerHTML='<span class=\\'fallback-icon\\'>${escapeHtml(letter)}</span>'">`;
    } catch { /* invalid URL */ }
  }

  return '<span class="fallback-icon">L</span>';
}

// 搜索引擎图标
export function renderEngineIcon(label) {
  const icons = {
    '百度': 'B',
    'Bing': 'B',
    'Google': 'G',
  };
  return `<span style="font-weight:700;font-size:14px">${icons[label] || label[0]?.toUpperCase() || 'S'}</span>`;
}

// ---- 主渲染 ----

export function renderApp() {
  const { user, data, activeCategory, backgroundImage } = appState;
  const links = activeCategory === 'all'
    ? (data.links || [])
    : (data.links || []).filter(l => l.categoryId === activeCategory);
  const engines = data.searchEngines || [];
  const activeEngines = engines.filter(e => e.enabled !== 0);

  applyBackground();

  document.getElementById('app').innerHTML = `
    <div class="topbar">
      <span class="btn" style="cursor:default">${user ? escapeHtml(user.username) : '访客'}</span>
      ${user ? '<button class="btn btn-primary" id="addLinkBtn">+ 添加</button>' : ''}
    </div>

    <div class="main">
      <div class="clock-wrap">
        <div class="clock" id="clockDisplay">00:00:00</div>
        <div class="date" id="dateDisplay"></div>
      </div>

      ${!user ? '<div class="guest-banner">访客模式 · 点击左侧菜单登录</div>' : ''}

      <div class="search">
        <div class="search-box" id="searchBox">
          <button class="engine-btn" id="engineBtn">${renderEngineIcon(appState.activeEngine)}</button>
          <div class="engine-popup" id="enginePopup">
            ${activeEngines.map(e => `
              <div class="ep-item" data-engine="${escapeHtml(e.label)}" data-url="${escapeHtml(e.urlFormat)}">
                ${renderEngineIcon(e.label)}
                <span>${escapeHtml(e.label)}</span>
              </div>`).join('')}
          </div>
          <input type="text" id="searchInput" placeholder="搜索..." autocomplete="off">
          <button class="icon-btn" id="searchBtn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="categories">
        <button class="cat-btn${activeCategory === 'all' ? ' active' : ''}" data-cat="all">全部</button>
        ${(data.categories || []).map(c =>
          `<button class="cat-btn${activeCategory === c.id ? ' active' : ''}" data-cat="${escapeHtml(c.id)}">${escapeHtml(c.title)}</button>`
        ).join('')}
      </div>

      <div class="content">
        <div class="grid">
          ${links.length === 0 ? `
            <div class="empty">
              <div style="font-size:48px;opacity:.4;margin-bottom:12px">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div>${user ? '点击「+ 添加」或菜单管理' : '暂无书签'}</div>
            </div>
          ` : ''}
          ${links.map(link => renderCard(link, !!user)).join('')}
        </div>
      </div>
    </div>
  `;

  updateClock();
  bindEvents();
}

function applyBackground() {
  document.body.className = appState.backgroundImage ? 'has-bg' : '';
  document.body.style.backgroundImage = appState.backgroundImage
    ? `url("${appState.backgroundImage.replace(/"/g, '\\"')}")`
    : '';
}

function renderCard(link, showDelete) {
  const url = link.url || '#';
  const bgStyle = link.backgroundColor && link.backgroundColor !== '#ffffff'
    ? `background-color:${escapeHtml(link.backgroundColor)};` : '';
  const iconDataLetter = (link.title || 'L')[0]?.toUpperCase();

  return `
    <a class="card" href="${escapeHtml(url)}"
      target="_blank" rel="noopener"
      ${!link.url ? 'onclick="return false"' : ''}
      style="${bgStyle}">
      ${showDelete ? `<button class="delete-btn" data-delete="${escapeHtml(link.id)}" title="删除">x</button>` : ''}
      <div class="icon" data-letter="${escapeHtml(iconDataLetter)}">${renderIcon(link.icon, link.url)}</div>
      <span class="label">${escapeHtml(link.title || '')}</span>
    </a>`;
}

// ---- 时钟 ----

export function updateClock() {
  const now = new Date();
  const clockEl = document.getElementById('clockDisplay');
  const dateEl = document.getElementById('dateDisplay');
  if (clockEl) {
    clockEl.textContent = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join(':');
  }
  if (dateEl) {
    const weekdays = '日一二三四五六';
    dateEl.textContent =
      `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekdays[now.getDay()]}`;
  }
}

// ---- 事件绑定 ----

function bindEvents() {
  // 分类切换
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = btn.dataset.cat;
      if (catId !== undefined && window.switchCategory) {
        window.switchCategory(catId);
      }
    });
  });

  // 搜索引擎弹出
  const engineBtn = document.getElementById('engineBtn');
  const enginePopup = document.getElementById('enginePopup');
  if (engineBtn && enginePopup) {
    engineBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      enginePopup.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#searchBox')) {
        enginePopup.classList.remove('show');
      }
    });
    enginePopup.querySelectorAll('.ep-item').forEach(item => {
      item.addEventListener('click', () => {
        appState.activeEngine = item.dataset.engine;
        enginePopup.classList.remove('show');
        renderApp();
      });
    });
  }

  // 搜索
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  if (searchInput && searchBtn) {
    searchBtn.addEventListener('click', () => executeSearch());
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeSearch();
    });
  }

  // 删除链接
  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.deleteLink) window.deleteLink(btn.dataset.delete);
    });
  });

  // 添加链接按钮
  const addBtn = document.getElementById('addLinkBtn');
  if (addBtn && window.showAddLinkModal) {
    addBtn.addEventListener('click', () => window.showAddLinkModal());
  }
}

function executeSearch() {
  const query = document.getElementById('searchInput')?.value.trim();
  if (!query) return;

  const engine = (appState.data.searchEngines || []).find(
    e => e.label === appState.activeEngine
  );
  const urlFormat = engine?.urlFormat || DEFAULT_ENGINES[0].urlFormat;
  window.open(urlFormat.replace('%s', encodeURIComponent(query)), '_blank');
}


