/**
 * GoTab API — Cloudflare Pages Functions
 * 纯 JS，零 npm 依赖
 */

import { json, corsPreflight } from '../lib/response';
import {
  hashPassword, verifyPassword, createToken, getTokenFromRequest,
  authenticate, checkRateLimit,
} from '../lib/auth';
import {
  newId,
  getUserByUsername, getUserById, createUser, countUsers, updateUserPassword,
  getSiteConfig, getSiteConfigValue,
  getAdminUser,
  getCategories, deleteCategories, insertCategory,
  getLinks, deleteLinks, insertLink, getExistingUrls, insertImportedLink,
  getSearchEngines, deleteSearchEngines, insertSearchEngine,
  getWallpapers, insertWallpaper, deleteWallpaper,
  getShareById, createShare,
  exportUserData,
} from '../lib/db';

// ---- 访客数据 ----
async function serveGuestData(db) {
  // 不再暴露管理员全部数据！
  // 访客模式返回空数据 + 默认搜索引擎
  return json({
    categories: [],
    links: [],
    searchEngines: [
      { id: '_baidu', label: '百度', urlFormat: 'https://www.baidu.com/s?wd=%s', enabled: 1 },
      { id: '_bing', label: 'Bing', urlFormat: 'https://www.bing.com/search?q=%s', enabled: 1 },
      { id: '_google', label: 'Google', urlFormat: 'https://www.google.com/search?q=%s', enabled: 1 },
    ],
    wallpapers: [],
    settings: { theme: 'dark', bg: '' },
    readonly: true,
  });
}

// ---- 书签导入 ----
const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript):/i;

function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    return !DANGEROUS_PROTOCOLS.test(parsed.protocol);
  } catch {
    return false;
  }
}

async function importBookmarks(db, userId, html) {
  if (html.length > 10 * 1024 * 1024) {
    return { error: '文件过大', status: 400 };
  }

  const existingUrls = await getExistingUrls(db, userId);
  let imported = 0;

  const linkRegex = /<DT><A\s+HREF="([^"]+)"[^>]*>(.+?)<\/A>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2] || '';

    if (existingUrls.has(url)) continue;
    if (!isSafeUrl(url)) continue;

    existingUrls.add(url);
    await insertImportedLink(db, userId, title, url, imported);
    imported++;
  }

  return { ok: true, imported, skipped: 0 };
}

// ---- 主路由 ----
async function route(req, env) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method;

  // CORS 预检
  if (method === 'OPTIONS') return corsPreflight();

  // 认证
  const user = await authenticate(req, env);

  // ── 公开接口 ──

  // 健康检查
  if (path === '/api/health') {
    return json({ status: 'ok', version: '2.0' });
  }

  // 站点配置
  if (path === '/api/getSiteConfig' && method === 'GET') {
    const cfg = await getSiteConfig(env.DB);
    return json({
      title: cfg.title || '',
      server_url: cfg.server_url || '',
      userRegister: cfg.userRegister || 'open',
      cardPush: cfg.cardPush || 'open',
    });
  }

  // 注册
  if (path === '/api/register' && method === 'POST') {
    const { username, password } = await req.json();
    if (!username || !password) return json({ error: '请输入用户名和密码' }, 400);

    const registerOpen = await getSiteConfigValue(env.DB, 'userRegister');
    if (registerOpen === 'close') return json({ error: '暂不开放注册' }, 403);

    if (await getUserByUsername(env.DB, username)) {
      return json({ error: '用户名已存在' }, 409);
    }

    const id = newId();
    const userCount = await countUsers(env.DB);
    const role = userCount === 0 ? 'admin' : 'user';

    await createUser(env.DB, {
      id,
      username,
      passwordHash: await hashPassword(password),
      role,
    });

    const token = await createToken(env.JWT_SECRET, { userId: id, username, role });
    return json({ token, user: { id, username, role } }, 201);
  }

  // 登录（带速率限制）
  if (path === '/api/login' && method === 'POST') {
    const { username, password } = await req.json();
    if (!username || !password) return json({ error: '请输入用户名和密码' }, 400);

    // 速率限制（基于用户名）
    if (env.FILE_STORE) {
      const allowed = await checkRateLimit(env.FILE_STORE, `login:${username}`);
      if (!allowed) return json({ error: '尝试次数过多，请稍后再试' }, 429);
    }

    const u = await getUserByUsername(env.DB, username);
    if (!u || !(await verifyPassword(password, u.password_hash))) {
      return json({ error: '用户名或密码错误' }, 401);
    }

    const token = await createToken(env.JWT_SECRET, {
      userId: u.id,
      username: u.username,
      role: u.role,
    });
    return json({ token, user: { id: u.id, username: u.username, role: u.role } });
  }

  // 访客数据
  if (path === '/api/data' && method === 'GET') {
    if (!user) return serveGuestData(env.DB);

    const [cats, lnks, eng, walls] = await Promise.all([
      getCategories(env.DB, user.userId),
      getLinks(env.DB, user.userId),
      getSearchEngines(env.DB, user.userId),
      getWallpapers(env.DB, user.userId),
    ]);

    let settings = { theme: 'dark', bg: '' };
    const settingsRow = await getSiteConfigValue(env.DB, `settings_${user.userId}`);
    if (settingsRow) {
      try { settings = JSON.parse(settingsRow); } catch { /* ignore */ }
    }

    const engines = eng.map(e => ({ ...e, urlFormat: e.url_format || e.urlFormat }));
    return json({ categories: cats, links: lnks, searchEngines: engines, wallpapers: walls, settings });
  }

  // 分享
  const shareMatch = path.match(/^\/api\/share\/([^/]+)$/);
  if (shareMatch && method === 'GET') {
    const share = await getShareById(env.DB, shareMatch[1]);
    if (!share) return json({ error: '不存在' }, 404);
    const owner = await getUserById(env.DB, share.user_id);
    return json({
      data_json: JSON.parse(share.data_json),
      user: owner ? { username: owner.username } : null,
    });
  }

  // ── 需要认证的接口 ──

  if (!user) return json({ error: '请先登录' }, 401);

  // 数据同步
  if (path === '/api/data' && method === 'POST') {
    const body = await req.json();
    const db = env.DB;

    // 使用事务保证原子性
    const statements = [
      db.prepare('DELETE FROM categories WHERE user_id = ?').bind(user.userId),
      db.prepare('DELETE FROM links WHERE user_id = ?').bind(user.userId),
      db.prepare('DELETE FROM search_engines WHERE user_id = ?').bind(user.userId),
    ];

    for (const cat of body.categories || []) {
      statements.push(db.prepare(
        'INSERT INTO categories (id, user_id, title, parent_id, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).bind(cat.id || newId(), user.userId, cat.title, cat.parentId || null, cat.sortOrder || 0));
    }

    for (const link of body.links || []) {
      // 验证 URL 安全性
      if (link.url && !isSafeUrl(link.url)) continue;
      statements.push(db.prepare(
        `INSERT INTO links (id, user_id, category_id, type, title, url, icon, show_type, size, background_color, font_color, description, open_target, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        link.id || newId(), user.userId, link.categoryId || null, link.type || 'link',
        link.title || '', link.url || '', link.icon || '', link.showType || 'icon-h',
        link.size || '12', link.backgroundColor || '#ffffff', link.fontColor || '#000000',
        link.description || '', link.openTarget || 'globalSet', link.sortOrder || 0
      ));
    }

    for (const eng of body.searchEngines || []) {
      statements.push(db.prepare(
        'INSERT INTO search_engines (id, user_id, label, url_format, icon, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(eng.id || newId(), user.userId, eng.label, eng.urlFormat, eng.icon || '', eng.enabled ?? 1, eng.sortOrder || 0));
    }

    if (body.settings) {
      statements.push(db.prepare(
        "INSERT OR REPLACE INTO site_config (key, value) VALUES ('settings_' || ?, ?)"
      ).bind(user.userId, JSON.stringify(body.settings)));
    }

    try {
      await db.batch(statements);
    } catch (err) {
      return json({ error: '同步失败，请重试' }, 500);
    }

    return json({ ok: true });
  }

  // 用户信息
  if (path === '/api/user/info' && method === 'GET') {
    const u = await getUserById(env.DB, user.userId);
    return u ? json(u) : json({ error: '不存在' }, 404);
  }

  if (path === '/api/user/info' && method === 'PUT') {
    const { password } = await req.json();
    if (!password) return json({ error: '请输入新密码' }, 400);
    await updateUserPassword(env.DB, user.userId, await hashPassword(password));
    return json({ ok: true });
  }

  // 壁纸
  if (path === '/api/wallpapers' && method === 'GET') {
    const walls = await getWallpapers(env.DB, user.userId);
    return json(walls);
  }

  if (path === '/api/wallpaper' && method === 'POST') {
    const { url: wallpaperUrl } = await req.json();
    if (!wallpaperUrl) return json({ error: 'URL 不能为空' }, 400);
    const id = await insertWallpaper(env.DB, user.userId, wallpaperUrl);
    return json({ id }, 201);
  }

  const wallpaperDeleteMatch = path.match(/^\/api\/wallpaper\/([^/]+)$/);
  if (wallpaperDeleteMatch && method === 'DELETE') {
    await deleteWallpaper(env.DB, wallpaperDeleteMatch[1], user.userId);
    return json({ ok: true });
  }

  // 分享
  if (path === '/api/share' && method === 'POST') {
    const { data_json, enabled } = await req.json();
    const id = await createShare(env.DB, user.userId, data_json, enabled);
    return json({ id }, 201);
  }

  // 导入书签
  if (path === '/api/import/bookmark' && method === 'POST') {
    const html = await req.text();
    const result = await importBookmarks(env.DB, user.userId, html);
    if (result.error) return json(result, result.status);
    return json(result);
  }

  // 导出
  if (path === '/api/export' && method === 'GET') {
    const data = await exportUserData(env.DB, user.userId);
    return json(data);
  }

  return json({ error: 'Not Found' }, 404);
}

export async function onRequest(context) {
  return route(context.request, context.env);
}
