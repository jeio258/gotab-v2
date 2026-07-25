/**
 * 数据库操作模块
 */

export function newId() {
  return crypto.randomUUID();
}

// ---- 用户 ----

export async function getUserByUsername(db, username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
}

export async function getUserById(db, id) {
  return db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').bind(id).first();
}

export async function createUser(db, { id, username, passwordHash, role }) {
  await db.prepare(
    'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)'
  ).bind(id, username, passwordHash, role).run();
}

export async function countUsers(db) {
  const row = await db.prepare('SELECT COUNT(*) as count FROM users').first();
  return row?.count ?? 0;
}

export async function updateUserPassword(db, userId, passwordHash) {
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(passwordHash, userId).run();
}

// ---- 站点配置 ----

export async function getSiteConfig(db) {
  const rows = await db.prepare('SELECT * FROM site_config').all();
  const cfg = {};
  for (const r of rows.results) {
    cfg[r.key] = r.value;
  }
  return cfg;
}

export async function getSiteConfigValue(db, key) {
  const row = await db.prepare('SELECT value FROM site_config WHERE key = ?').bind(key).first();
  return row?.value ?? null;
}

export async function setSiteConfigValue(db, key, value) {
  await db.prepare('INSERT OR REPLACE INTO site_config (key, value) VALUES (?, ?)')
    .bind(key, value).run();
}

// ---- 管理员用户 ----

export async function getAdminUser(db) {
  return db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1").first();
}

// ---- 分类 ----

export async function getCategories(db, userId) {
  const rows = await db.prepare(
    'SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order'
  ).bind(userId).all();
  return rows.results;
}

export async function deleteCategories(db, userId) {
  await db.prepare('DELETE FROM categories WHERE user_id = ?').bind(userId).run();
}

export async function insertCategory(db, cat, userId) {
  await db.prepare(
    'INSERT INTO categories (id, user_id, title, parent_id, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).bind(cat.id || newId(), userId, cat.title, cat.parentId || null, cat.sortOrder || 0).run();
}

// ---- 链接 ----

export async function getLinks(db, userId) {
  const rows = await db.prepare(
    'SELECT * FROM links WHERE user_id = ? ORDER BY sort_order'
  ).bind(userId).all();
  return rows.results;
}

export async function deleteLinks(db, userId) {
  await db.prepare('DELETE FROM links WHERE user_id = ?').bind(userId).run();
}

export async function insertLink(db, link, userId) {
  await db.prepare(
    `INSERT INTO links (id, user_id, category_id, type, title, url, icon, show_type, size, background_color, font_color, description, open_target, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    link.id || newId(), userId, link.categoryId || null, link.type || 'link',
    link.title || '', link.url || '', link.icon || '', link.showType || 'icon-h',
    link.size || '12', link.backgroundColor || '#ffffff', link.fontColor || '#000000',
    link.description || '', link.openTarget || 'globalSet', link.sortOrder || 0
  ).run();
}

export async function getExistingUrls(db, userId) {
  const rows = await db.prepare('SELECT url FROM links WHERE user_id = ?').bind(userId).all();
  return new Set(rows.results.map(r => r.url));
}

export async function insertImportedLink(db, userId, title, url, sortOrder) {
  await db.prepare(
    'INSERT INTO links (id, user_id, type, title, url, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(newId(), userId, 'link', title || '', url, sortOrder).run();
}

// ---- 搜索引擎 ----

export async function getSearchEngines(db, userId) {
  const rows = await db.prepare(
    'SELECT * FROM search_engines WHERE user_id = ? ORDER BY sort_order'
  ).bind(userId).all();
  return rows.results;
}

export async function deleteSearchEngines(db, userId) {
  await db.prepare('DELETE FROM search_engines WHERE user_id = ?').bind(userId).run();
}

export async function insertSearchEngine(db, engine, userId) {
  await db.prepare(
    'INSERT INTO search_engines (id, user_id, label, url_format, icon, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(engine.id || newId(), userId, engine.label, engine.urlFormat, engine.icon || '', engine.enabled ?? 1, engine.sortOrder || 0).run();
}

// ---- 壁纸 ----

export async function getWallpapers(db, userId) {
  const rows = await db.prepare(
    'SELECT * FROM wallpapers WHERE user_id = ? ORDER BY sort_order'
  ).bind(userId).all();
  return rows.results;
}

export async function insertWallpaper(db, userId, url) {
  const id = newId();
  await db.prepare(
    'INSERT INTO wallpapers (id, user_id, url) VALUES (?, ?, ?)'
  ).bind(id, userId, url).run();
  return id;
}

export async function deleteWallpaper(db, id, userId) {
  await db.prepare('DELETE FROM wallpapers WHERE id = ? AND user_id = ?').bind(id, userId).run();
}

// ---- 分享 ----

export async function getShareById(db, id) {
  return db.prepare('SELECT * FROM shares WHERE id = ? AND enabled = 1').bind(id).first();
}

export async function createShare(db, userId, dataJson, enabled) {
  const id = newId();
  await db.prepare(
    'INSERT INTO shares (id, user_id, data_json, enabled) VALUES (?, ?, ?, ?)'
  ).bind(id, userId, JSON.stringify(dataJson), enabled !== false ? 1 : 0).run();
  return id;
}

// ---- 导出 ----

export async function exportUserData(db, userId) {
  const [cats, lnks, eng, walls] = await Promise.all([
    getCategories(db, userId),
    getLinks(db, userId),
    getSearchEngines(db, userId),
    getWallpapers(db, userId),
  ]);
  return {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    data: { categories: cats, links: lnks, searchEngines: eng, wallpapers: walls },
  };
}
