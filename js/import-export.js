/**
 * 导入 / 导出模块
 */
import { apiRequest, getToken } from './api.js';
import { showToast } from './render.js';

export function showImportModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>导入书签</h3>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:14px">选择浏览器导出的 .html 书签文件</p>
      <input type="file" id="bookmarkFile" accept=".html,.htm">
      <div id="importResult" style="margin-top:10px;font-size:13px;text-align:center"></div>
      <button class="btn close-btn" style="width:100%;margin-top:12px">关闭</button>
    </div>`;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector('.close-btn').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#bookmarkFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const resultEl = overlay.querySelector('#importResult');
    const response = await fetch('/api/import/bookmark', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + getToken(),
        'Content-Type': 'text/html',
      },
      body: await file.text(),
    });

    const result = await response.json();
    if (result.ok) {
      resultEl.textContent = '导入 ' + result.imported + ' 个书签';
      resultEl.style.color = 'var(--success)';
      if (window.loadData) window.loadData();
    } else {
      resultEl.textContent = result.error || '导入失败';
      resultEl.style.color = 'var(--danger)';
    }
  });

  document.body.appendChild(overlay);
}

export async function exportData() {
  const result = await apiRequest('/api/export');
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = 'gotab-' + new Date().toISOString().slice(0, 10) + '.json';
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  showToast('已导出');
}
