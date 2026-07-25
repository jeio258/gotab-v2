/**
 * 模态框模块 — 登录、注册、添加、管理等所有对话框
 */
import { apiRequest } from './api.js';
import { appState, saveToStorage, applyTheme } from './state.js';
import { escapeHtml, showToast, renderApp } from './render.js';

/** 创建并显示模态框，返回模态框元素和内容容器 */
function createModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal">' + html + '</div>';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return {
    overlay,
    content: overlay.querySelector('.modal'),
    remove: () => overlay.remove(),
  };
}

// ---- 登录 / 注册 ----

let loginMode = 'login';

export function showLoginModal() {
  const modal = createModal(`
    <h3>${loginMode === 'login' ? '登录' : '注册'}</h3>
    <form id="authForm">
      <label>用户名</label>
      <input id="authUsername" placeholder="用户名" required>
      <label>密码</label>
      <input type="password" id="authPassword" placeholder="密码" required>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary">${loginMode === 'login' ? '登录' : '注册'}</button>
        <button type="button" class="btn" id="switchMode">${loginMode === 'login' ? '去注册' : '去登录'}</button>
      </div>
      <div class="message" id="authMessage"></div>
    </form>
    <p class="tip">无需邮箱</p>
  `);

  modal.content.querySelector('#switchMode').addEventListener('click', () => {
    loginMode = loginMode === 'login' ? 'register' : 'login';
    modal.remove();
    showLoginModal();
  });

  modal.content.querySelector('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = modal.content.querySelector('#authMessage');
    const username = modal.content.querySelector('#authUsername').value.trim();
    const password = modal.content.querySelector('#authPassword').value;

    if (!username || !password) {
      msgEl.textContent = '请填写完整';
      msgEl.style.color = 'var(--danger)';
      return;
    }

    msgEl.textContent = '请稍候...';
    msgEl.style.color = 'var(--text-secondary)';

    const path = loginMode === 'login' ? '/api/login' : '/api/register';

    try {
      const result = await apiRequest(path, {
        method: 'POST',
        body: { username, password },
      });

      if (result.error) {
        msgEl.textContent = result.error;
        msgEl.style.color = 'var(--danger)';
      } else {
        appState.user = result.user;
        saveToStorage('gotab_user', result.user);
        localStorage.setItem('gotab_token', result.token);
        modal.remove();
        showToast('登录成功');
        if (window.loadData) window.loadData();
      }
    } catch {
      msgEl.textContent = '网络错误';
      msgEl.style.color = 'var(--danger)';
    }
  });
}

export function showRegisterModal() {
  loginMode = 'register';
  showLoginModal();
}

// ---- 添加链接 ----

export function showAddLinkModal() {
  const modal = createModal(`
    <h3>添加链接</h3>
    <form id="linkForm">
      <label>标题</label>
      <input id="linkTitle" placeholder="网站名称" required>
      <label>URL</label>
      <input type="url" id="linkUrl" placeholder="https://..." required>
      <label>图标 URL</label>
      <input id="linkIcon" placeholder="留空自动获取">
      <label>背景色</label>
      <input type="color" id="linkBg" value="#ffffff" style="height:40px;padding:4px">
      <label>分类</label>
      <select id="linkCategory">
        <option value="">无分类</option>
        ${(appState.data.categories || []).map(c =>
          `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)}</option>`
        ).join('')}
      </select>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary">添加</button>
        <button type="button" class="btn close-btn">取消</button>
      </div>
    </form>
  `);

  modal.content.querySelector('.close-btn').addEventListener('click', () => modal.remove());

  modal.content.querySelector('#linkForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = modal.content.querySelector('#linkUrl').value.trim();
    const bg = modal.content.querySelector('#linkBg').value;

    appState.data.links.push({
      id: crypto.randomUUID(),
      type: 'link',
      title: modal.content.querySelector('#linkTitle').value.trim(),
      url,
      icon: modal.content.querySelector('#linkIcon').value.trim() || '',
      backgroundColor: bg !== '#ffffff' ? bg : '',
      categoryId: modal.content.querySelector('#linkCategory').value || null,
      sortOrder: appState.data.links.length,
    });

    modal.remove();
    if (window.saveAndRender) window.saveAndRender();
    showToast('已添加');
  });
}

// ---- 分类 ----

export function showAddCategoryModal() {
  const modal = createModal(`
    <h3>新建分类</h3>
    <form id="catForm">
      <input id="catTitle" placeholder="分类名称" required>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary">创建</button>
        <button type="button" class="btn close-btn">取消</button>
      </div>
    </form>
  `);

  modal.content.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.content.querySelector('#catForm').addEventListener('submit', (e) => {
    e.preventDefault();
    appState.data.categories.push({
      id: crypto.randomUUID(),
      title: modal.content.querySelector('#catTitle').value.trim(),
      sortOrder: appState.data.categories.length,
    });
    modal.remove();
    if (window.saveAndRender) window.saveAndRender();
  });
}

export function deleteCategory(id) {
  appState.data.categories = appState.data.categories.filter(c => c.id !== id);
  appState.data.links = appState.data.links.map(
    l => l.categoryId === id ? { ...l, categoryId: null } : l
  );
  if (window.saveAndRender) window.saveAndRender();
}

// ---- 搜索引擎 ----

export function showAddEngineModal() {
  const modal = createModal(`
    <h3>添加搜索引擎</h3>
    <form id="engineForm">
      <label>名称</label>
      <input id="engineLabel" placeholder="Google" required>
      <label>URL (%s = 关键词)</label>
      <input id="engineUrl" placeholder="https://www.google.com/search?q=%s" required>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary">添加</button>
        <button type="button" class="btn close-btn">取消</button>
      </div>
    </form>
  `);

  modal.content.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.content.querySelector('#engineForm').addEventListener('submit', (e) => {
    e.preventDefault();
    appState.data.searchEngines.push({
      id: crypto.randomUUID(),
      label: modal.content.querySelector('#engineLabel').value.trim(),
      urlFormat: modal.content.querySelector('#engineUrl').value.trim(),
      enabled: 1,
      sortOrder: appState.data.searchEngines.length,
    });
    modal.remove();
    if (window.saveAndRender) window.saveAndRender();
  });
}

export function toggleEngine(id) {
  const eng = appState.data.searchEngines.find(e => e.id === id);
  if (eng) {
    eng.enabled = eng.enabled === 0 ? 1 : 0;
    if (window.saveAndRender) window.saveAndRender();
  }
}

export function deleteEngine(id) {
  appState.data.searchEngines = appState.data.searchEngines.filter(e => e.id !== id);
  if (window.saveAndRender) window.saveAndRender();
}

// ---- 壁纸 ----

export function showAddWallpaperModal() {
  const modal = createModal(`
    <h3>添加壁纸</h3>
    <form id="wallpaperForm">
      <input type="url" id="wallpaperUrl" placeholder="图片 URL" required>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary">添加</button>
        <button type="button" class="btn close-btn">取消</button>
      </div>
    </form>
  `);

  modal.content.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.content.querySelector('#wallpaperForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = modal.content.querySelector('#wallpaperUrl').value.trim();
    modal.remove();

    try {
      await apiRequest('/api/wallpaper', { method: 'POST', body: { url } });
      const data = await apiRequest('/api/data');
      appState.data.wallpapers = data.wallpapers || [];
      saveToStorage('gotab_data', appState.data);
      renderApp();
      if (window.renderSidebar) window.renderSidebar();
    } catch {
      showToast('添加失败');
    }
  });
}

export async function deleteWallpaper(id) {
  await apiRequest('/api/wallpaper/' + id, { method: 'DELETE' });
  const data = await apiRequest('/api/data');
  appState.data.wallpapers = data.wallpapers || [];
  saveToStorage('gotab_data', appState.data);
  renderApp();
  if (window.renderSidebar) window.renderSidebar();
}

// ---- 修改密码 ----

export function showChangePasswordModal() {
  const modal = createModal(`
    <h3>修改密码</h3>
    <form id="passwordForm">
      <label>新密码</label>
      <input type="password" id="newPassword" placeholder="新密码" required>
      <label>确认</label>
      <input type="password" id="confirmPassword" placeholder="再次输入" required>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary">确认</button>
        <button type="button" class="btn close-btn">取消</button>
      </div>
      <div class="message" id="passwordMessage"></div>
    </form>
  `);

  modal.content.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.content.querySelector('#passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = modal.content.querySelector('#passwordMessage');
    const p1 = modal.content.querySelector('#newPassword').value;
    const p2 = modal.content.querySelector('#confirmPassword').value;

    if (!p1) {
      msgEl.textContent = '请输入密码';
      msgEl.style.color = 'var(--danger)';
      return;
    }
    if (p1 !== p2) {
      msgEl.textContent = '两次不一致';
      msgEl.style.color = 'var(--danger)';
      return;
    }

    try {
      const result = await apiRequest('/api/user/info', {
        method: 'PUT',
        body: { password: p1 },
      });
      if (result.error) {
        msgEl.textContent = result.error;
        msgEl.style.color = 'var(--danger)';
      } else {
        msgEl.textContent = '已修改';
        msgEl.style.color = 'var(--success)';
        setTimeout(() => modal.remove(), 1200);
      }
    } catch {
      msgEl.textContent = '网络错误';
      msgEl.style.color = 'var(--danger)';
    }
  });
}
