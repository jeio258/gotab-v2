/**
 * GoTab — 应用入口
 * 零 npm 依赖，纯 vanilla JS
 */
import { apiRequest } from './api.js';
import {
  appState, DEFAULT_ENGINES, loadFromStorage, saveToStorage,
  initTheme, applyTheme,
} from './state.js';
import { escapeHtml, showToast, renderApp, updateClock } from './render.js';
import {
  showLoginModal, showRegisterModal,
  showAddLinkModal, showAddCategoryModal, deleteCategory,
  showAddEngineModal, toggleEngine, deleteEngine,
  showAddWallpaperModal, deleteWallpaper,
  showChangePasswordModal,
} from './modals.js';
import { showImportModal, exportData } from './import-export.js';

// ==== 同步到服务器 ====
async function syncToServer() {
  saveToStorage('gotab_data', appState.data);

  if (!apiRequest || !appState.user) return;

  const settings = {
    theme: appState.theme,
    bg: appState.backgroundImage,
    blur: appState.blur,
  };

  try {
    await apiRequest('/api/data', {
      method: 'POST',
      body: {
        categories: appState.data.categories,
        links: appState.data.links,
        searchEngines: appState.data.searchEngines,
        settings,
      },
    });
  } catch {
    // 后台静默失败，下次再同步
  }
}

// ==== 加载数据 ====
async function loadData() {
  try {
    if (appState.user) {
      const data = await apiRequest('/api/data');
      if (!data.error && data.categories) {
        appState.data = data;

        if (data.settings) {
          appState.theme = data.settings.theme || 'dark';
          appState.backgroundImage = data.settings.bg || '';
          appState.blur = data.settings.blur || 0;
          applyTheme();
        }
        saveToStorage('gotab_data', data);
      }
    } else {
      // 访客模式：只使用本地数据（初始为空 + 默认引擎）
      // 不再拉取管理员数据
      appState.data = loadFromStorage('gotab_data', {
        categories: [],
        links: [],
        searchEngines: [...DEFAULT_ENGINES],
        wallpapers: [],
      });
    }
  } catch {
    appState.data = loadFromStorage('gotab_data', {
      categories: [],
      links: [],
      searchEngines: [...DEFAULT_ENGINES],
      wallpapers: [],
    });
  }

  if (!appState.data.searchEngines || !appState.data.searchEngines.length) {
    appState.data.searchEngines = [...DEFAULT_ENGINES];
  }

  renderAll();
}

// ==== 退出登录 ====
function logout() {
  appState.user = null;
  localStorage.clear();
  appState.data = {
    categories: [],
    links: [],
    searchEngines: [...DEFAULT_ENGINES],
    wallpapers: [],
  };
  appState.backgroundImage = '';
  appState.theme = 'dark';
  appState.blur = 0;
  applyTheme();
  renderAll();
  showToast('已退出');
}

// ==== 全部渲染 ====
function renderAll() {
  renderApp();
  renderSidebar();
}

// ==== 侧边栏 ====
function toggleSidebar() {
  appState.sidebarOpen = !appState.sidebarOpen;
  const sidebarEl = document.getElementById('sb');
  if (sidebarEl) {
    sidebarEl.className = 'sidebar' + (appState.sidebarOpen ? ' open' : '');
  }
}

function renderSidebar() {
  const user = appState.user;
  const isGuest = !user;
  const engines = appState.data.searchEngines || [];
  const categories = appState.data.categories || [];
  const wallpapers = appState.data.wallpapers || [];

  document.getElementById('si').innerHTML = `
    ${isGuest ? `
      <div style="text-align:center;padding:8px 0 18px">
        <div style="font-size:36px;margin-bottom:6px">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">登录后可管理所有内容</div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:6px" id="loginBtn">登录</button>
        <button class="btn" style="width:100%;justify-content:center" id="registerBtn">注册</button>
      </div>
      <div class="divider"></div>
    ` : `
      <div style="padding:8px 0 18px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:16px">${escapeHtml(user.username[0]?.toUpperCase() || 'U')}</div>
          <span style="font-weight:500;color:var(--text)">${escapeHtml(user.username)}</span>
        </div>
        <button class="btn btn-primary" style="width:100%;justify-content:center" id="addLinkBtn">+ 添加链接</button>
      </div>
      <div class="divider"></div>
    `}

    <h4>外观</h4>
    <div class="sidebar-row">
      <span>深色模式</span>
      <label class="toggle">
        <input type="checkbox" ${appState.theme === 'dark' ? 'checked' : ''} id="themeToggle">
        <span class="track"></span>
      </label>
    </div>
    <div class="blur-slider">
      <div class="sidebar-row">
        <span>卡片毛玻璃</span>
        <span style="font-size:12px">${appState.blur}px</span>
      </div>
      <input type="range" min="0" max="30" value="${appState.blur}" id="blurSlider">
    </div>
    ${appState.backgroundImage && user ? `
      <button class="btn btn-xs btn-danger" style="margin-top:4px" id="clearBgBtn">清除壁纸</button>
    ` : ''}
    ${appState.backgroundImage ? '<div style="font-size:11px;color:var(--text-tertiary);padding:4px 0">壁纸已应用</div>' : ''}

    <h4>搜索引擎 (${engines.length})</h4>
    ${engines.map(e => `
      <div class="sidebar-item">
        <span>${escapeHtml(e.label)}</span>
        ${user ? `
          <button class="btn btn-xs ${e.enabled !== 0 ? 'btn-primary' : ''}" data-eng-toggle="${escapeHtml(e.id)}" style="margin-left:6px">${e.enabled !== 0 ? '开' : '关'}</button>
          <button class="btn btn-xs btn-danger" data-eng-delete="${escapeHtml(e.id)}">x</button>
        ` : ''}
      </div>`).join('')}
    ${user ? '<button class="btn" style="width:100%;justify-content:center;margin-top:8px" id="addEngineBtn">+ 引擎</button>' : ''}

    <h4>分类</h4>
    <div class="sidebar-item${appState.activeCategory === 'all' ? ' active' : ''}" data-sidebar-cat="all" style="cursor:pointer">
      <span style="font-weight:${appState.activeCategory === 'all' ? '600' : '400'};color:${appState.activeCategory === 'all' ? 'var(--accent)' : 'inherit'}">全部</span>
    </div>
    ${categories.map(c => `
      <div class="sidebar-item${appState.activeCategory === c.id ? ' active' : ''}" data-sidebar-cat="${escapeHtml(c.id)}" style="cursor:pointer">
        <span style="font-weight:${appState.activeCategory === c.id ? '600' : '400'};color:${appState.activeCategory === c.id ? 'var(--accent)' : 'inherit'}">${escapeHtml(c.title)}</span>
        ${user ? `<button class="btn btn-xs btn-danger" data-cat-delete="${escapeHtml(c.id)}">x</button>` : ''}
      </div>`).join('')}
    ${user ? '<button class="btn" style="width:100%;justify-content:center;margin-top:8px" id="addCatBtn">+ 分类</button>' : ''}

    <h4>壁纸 (${wallpapers.length})</h4>
    ${wallpapers.map(w => `
      <div class="sidebar-item">
        <span>${escapeHtml(w.url.substring(0, 30))}</span>
        ${user ? `
          <button class="btn btn-xs btn-primary" data-bg-apply="${escapeHtml(w.url)}">用</button>
          <button class="btn btn-xs btn-danger" data-bg-delete="${escapeHtml(w.id)}">x</button>
        ` : `<button class="btn btn-xs" data-bg-apply="${escapeHtml(w.url)}">预览</button>`}
      </div>`).join('')}
    ${user ? '<button class="btn" style="width:100%;justify-content:center;margin-top:8px" id="addWallBtn">+ 壁纸</button>' : ''}

    ${user ? `
      <div class="divider"></div>
      <button class="btn" style="width:100%;justify-content:center" id="importBtn">导入书签</button>
      <button class="btn" style="width:100%;justify-content:center;margin-top:8px" id="exportBtn">导出数据</button>
      <button class="btn" style="width:100%;justify-content:center;margin-top:8px" id="changePwdBtn">修改密码</button>
      <button class="btn btn-danger" style="width:100%;justify-content:center;margin-top:8px" id="logoutBtn">退出</button>
    ` : ''}

    <p class="tip" style="margin-top:12px">${user ? escapeHtml(user.username) : '访客模式'}</p>
  `;

  // 事件绑定
  bindSidebarEvents();
}

function bindSidebarEvents() {
  const user = appState.user;
  const isGuest = !user;

  // 登录/注册
  document.getElementById('loginBtn')?.addEventListener('click', showLoginModal);
  document.getElementById('registerBtn')?.addEventListener('click', showRegisterModal);
  document.getElementById('addLinkBtn')?.addEventListener('click', showAddLinkModal);

  // 主题
  document.getElementById('themeToggle')?.addEventListener('change', (e) => {
    appState.theme = e.target.checked ? 'dark' : 'light';
    appState.data.settings = appState.data.settings || {};
    appState.data.settings.theme = appState.theme;
    applyTheme();
    syncToServer();
  });

  // 模糊
  document.getElementById('blurSlider')?.addEventListener('input', (e) => {
    appState.blur = parseInt(e.target.value, 10);
    document.documentElement.style.setProperty('--card-blur', appState.blur + 'px');
    appState.data.settings = appState.data.settings || {};
    appState.data.settings.blur = appState.blur;
    syncToServer();
  });

  // 壁纸
  document.getElementById('clearBgBtn')?.addEventListener('click', () => {
    appState.backgroundImage = '';
    appState.data.settings = appState.data.settings || {};
    appState.data.settings.bg = '';
    applyTheme();
    syncToServer();
    renderAll();
  });

  document.querySelectorAll('[data-bg-apply]').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.bgApply;
      appState.backgroundImage = url;
      appState.data.settings = appState.data.settings || {};
      appState.data.settings.bg = url;
      applyTheme();
      syncToServer();
      renderAll();
    });
  });

  // 引擎
  document.querySelectorAll('[data-eng-toggle]').forEach(btn => {
    btn.addEventListener('click', () => toggleEngine(btn.dataset.engToggle));
  });
  document.querySelectorAll('[data-eng-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteEngine(btn.dataset.engDelete));
  });
  document.getElementById('addEngineBtn')?.addEventListener('click', showAddEngineModal);

  // 分类
  document.querySelectorAll('[data-cat-delete]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCategory(btn.dataset.catDelete);
    });
  });
  document.querySelectorAll('[data-sidebar-cat]').forEach(item => {
    item.addEventListener('click', () => {
      const catId = item.dataset.sidebarCat;
      appState.activeCategory = catId;
      renderAll();
    });
  });
  document.getElementById('addCatBtn')?.addEventListener('click', showAddCategoryModal);

  // 壁纸管理
  document.querySelectorAll('[data-bg-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteWallpaper(btn.dataset.bgDelete));
  });
  document.getElementById('addWallBtn')?.addEventListener('click', showAddWallpaperModal);

  // 导入导出
  document.getElementById('importBtn')?.addEventListener('click', showImportModal);
  document.getElementById('exportBtn')?.addEventListener('click', exportData);

  // 密码
  document.getElementById('changePwdBtn')?.addEventListener('click', showChangePasswordModal);

  // 退出
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
}

// ==== 全局函数（供 render 模块调用） ====
window.switchCategory = (catId) => {
  appState.activeCategory = catId;
  renderApp();
};

window.deleteLink = async (id) => {
  appState.data.links = appState.data.links.filter(l => l.id !== id);
  await syncToServer();
  renderApp();
  renderSidebar();
  showToast('已删除');
};

window.saveAndRender = async () => {
  await syncToServer();
  renderAll();
};

window.showAddLinkModal = showAddLinkModal;
window.loadData = loadData;
window.renderSidebar = renderSidebar;

// ==== 初始化 ====
function init() {
  initTheme();
  loadData();

  // 侧边栏切换
  document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);

  // 点击外部关闭侧边栏
  document.addEventListener('click', (e) => {
    if (appState.sidebarOpen
      && !e.target.closest('.sidebar')
      && !e.target.closest('#sidebarToggle')) {
      appState.sidebarOpen = false;
      const sidebarEl = document.getElementById('sb');
      if (sidebarEl) sidebarEl.className = 'sidebar';
    }
  });

  // 时钟每秒更新
  setInterval(updateClock, 1000);
}

document.addEventListener('DOMContentLoaded', init);
