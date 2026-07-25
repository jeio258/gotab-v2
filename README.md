# GoTab

> 极简浏览器起始页 — 深色/浅色双主题 · 毛玻璃卡片 · Cloudflare Pages 部署

## 功能

- 书签管理与分类
- 多搜索引擎切换（图标直选，所见即所得）
- 自定义壁纸
- 透明卡片，图标悬浮于背景之上
- 深色/浅色主题切换
- 书签导入（浏览器 HTML）
- 数据导出（JSON）
- 访客模式（无需登录即可使用）
- 响应式设计
- Chrome 扩展 — 覆盖新标签页

## 技术栈

- **前端**: 零依赖，纯 vanilla JS (ES modules)
- **后端**: Cloudflare Pages Functions
- **数据库**: Cloudflare D1 (SQLite)
- **认证**: PBKDF2 密码哈希 + HMAC-SHA256 JWT

## 项目结构

```
gotab-app/
├── index.html                    # HTML 入口
├── css/
│   └── style.css                 # 样式表（深色/浅色双主题）
├── js/
│   ├── app.js                    # 主入口 + 侧边栏 + 数据同步
│   ├── api.js                    # API 通信
│   ├── state.js                  # 状态管理
│   ├── render.js                 # UI 渲染
│   ├── modals.js                 # 模态框（登录/添加/管理）
│   └── import-export.js          # 书签导入导出
├── functions/
│   ├── api/
│   │   └── [[path]].js           # API 路由
│   └── lib/
│       ├── auth.js               # JWT + PBKDF2 + 速率限制
│       ├── db.js                 # 数据库操作
│       └── response.js           # 响应工具
├── wrangler.toml                 # Cloudflare 配置
└── _headers                      # HTTP 头配置
```

## 部署

### 前提

- [Cloudflare 账号](https://dash.cloudflare.com/)
- [Node.js 18+](https://nodejs.org/)
- Wrangler CLI: `npm install -g wrangler`

### 1. 安装依赖（可选 — 本项目零 npm 依赖）

```bash
# 无需 npm install，直接部署
```

### 2. 创建 D1 数据库

```bash
wrangler d1 create gotab-db
```

### 3. 配置 wrangler.toml

将返回的 `database_id` 填入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "gotab-db"
database_id = "你的D1_ID"
```

### 4. 创建数据库表

```bash
wrangler d1 execute gotab-db --command "
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  parent_id TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT,
  type TEXT DEFAULT 'link',
  title TEXT,
  url TEXT,
  icon TEXT,
  show_type TEXT DEFAULT 'icon-h',
  size TEXT DEFAULT '12',
  background_color TEXT DEFAULT '#ffffff',
  font_color TEXT DEFAULT '#000000',
  description TEXT,
  open_target TEXT DEFAULT 'globalSet',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS search_engines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  url_format TEXT NOT NULL,
  icon TEXT,
  enabled INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wallpapers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data_json TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT
);
"
```

### 5. 创建 Pages 项目

```bash
wrangler pages project create gotab --production-branch main
```

### 6. 设置 JWT_SECRET

```bash
wrangler pages secret put JWT_SECRET --project gotab
```

### 7. 部署

```bash
wrangler pages deploy . --project-name gotab
```

### 8. 绑定 D1（Dashboard）

在 Cloudflare Dashboard → Pages → gotab → Settings → Functions：
- D1 database bindings: 添加 `DB` → `gotab-db`

## 使用

| 路径 | 说明 |
|------|------|
| `/` | 首页 — 时钟、搜索、书签网格 |
| 侧边栏 ☰ | 主题切换、分类/引擎/壁纸管理、登录 |
| 访客模式 | 无需登录，使用默认搜索引擎 |

首次注册的用户自动成为管理员。后续注册均为普通用户。

## 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `JWT_SECRET` | JWT 签名密钥 | ✅ 是 |

## Chrome 扩展

`extension/` 目录包含一个 Chrome 扩展，可将 GoTab 设为新标签页。

### 安装

1. Chrome 地址栏输入 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `extension/` 目录
5. 打开新标签页即可

### 自定义域名

修改 `extension/newtab.html` 中 iframe 的 `src` 为你自己的部署地址。

### 离线处理

网络不通时自动显示离线提示，每 30 秒自动重连。

## 许可

MIT
