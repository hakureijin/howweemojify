# 将 VINCI 部署到 GitHub Pages

日期：2026-07-10
状态：已批准，待实现

## 背景

站点目前只在本地 `next dev` 运行，没有公开访问入口。需要把它发布到一个 `*.github.io` 域名上。

目标仓库是 `evetai1997-beep/howweemojify`（public，创建于 2026-07-10，当前为空仓库，无任何 commit）。源码目前在 `hakureijin/howweemojify`。

由于目标仓库名不是 `<用户名>.github.io`，它是一个**项目站点**，最终 URL 为：

```
https://evetai1997-beep.github.io/howweemojify/
```

子路径 `/howweemojify` 是本设计中绝大多数复杂度的来源。

## 验收标准

**GitHub Pages 上的页面效果与本地开发时完全一致。** 这是唯一的硬标准。具体到可检验的条目：

1. 站点根路径能正确落到中文版（英文浏览器落到英文版）。
2. 全部章节渲染正常，尤其是第二章的世界地图必须显示。
3. 浏览器 Network 面板中无 404。
4. `npm test` 与 `npm run lint` 无回归。

## 既有事实（已核实）

- 应用为 Next.js 15.5.18 + React 19 + next-intl 4，14 个组件标记 `'use client'`。
- **无** `next/image` 使用，**无** server actions，**无** route handlers。`app/[locale]/layout.tsx` 已有 `generateStaticParams()`。
- `app/layout.tsx` 是透传层（`return children`），不渲染 `<html>`；`<html>` 由 `app/[locale]/layout.tsx` 渲染。
- `middleware.ts` 使用 `next-intl/middleware`，负责根路径重定向与 `Accept-Language` 协商。
- i18n 配置：`locales: ['zh', 'en']`，`defaultLocale: 'zh'`，`localePrefix: 'always'`。
- 静态资源体积极小：`public/` 136K，`data/` 68K。`/out/` 已在 `.gitignore` 中。
- `data/*.json` 全部通过 ES 静态 import 消费，构建时打入 bundle，不走 HTTP。
- **唯一的运行时 HTTP 请求**：`components/chapter-02/OriginMap.tsx:42` 的 `fetch('/world-atlas/countries-110m.json')`。该 fetch 无 `.catch()`，失败时静默渲染空白地图。
- 代码中无 `src="/`、`href="/`、CSS `url(/...)` 等其它硬编码绝对路径。
- 权限：`hakureijin` 对目标仓库有 `write`（`push: true`），但**无 `admin`**。本地 `gh` token scope 含 `workflow`。
- 目标仓库的 GitHub Pages 尚未启用。
- 目标仓库 `default_branch` 为 `main`；本地工作分支为 `master`（`origin` 主仓库亦为 `master`）。
- 目标仓库的 Actions 启用状态**无法查询**（`/actions/permissions` 返回 403，需 admin）。新仓库默认启用，此处按默认假设处理。

## 方案选择

采用 **GitHub Actions 构建 + 官方 Pages 部署**。

被否决的替代方案：

- *本地构建推 `gh-pages` 分支*：构建产物进 git 历史；且把 Pages 源设为分支需要 admin 权限，我们没有。
- *把 `out/` 提交到 `docs/` 目录*：编译产物污染主分支 diff；同样需要 admin 设置源。

选定方案是三者中唯一不依赖 admin 权限即可自举的：`actions/configure-pages@v5` 的 `enablement: true` 使用仓库自带的 `GITHUB_TOKEN`（声明 `pages: write`）开启 Pages。

## 详细设计

### 1. `next.config.ts`

`basePath` 由环境变量控制，**不写死**。写死会导致本地 `npm run dev` 移到 `/howweemojify` 子路径，且本地构建产物用静态服务器打开时全部资源 404（页面能开但无样式，故障表象具有误导性）。

```ts
const basePath = process.env.GITHUB_PAGES === 'true' ? '/howweemojify' : ''

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
}
```

- `output: 'export'` 无条件开启，使本地 `npm run build` 与 CI 走同一条代码路径。
- `trailingSlash: true` 让产物为 `out/zh/index.html` 而非 `out/zh.html`，GitHub Pages 对目录式 index 的解析最可靠。
- `images: { unoptimized: true }` 当前无实际作用（未使用 `next/image`），作为防御性配置保留。
- `env.NEXT_PUBLIC_BASE_PATH` 把前缀透给运行时代码，供下文第 3、4 项使用。

### 2. 删除 `middleware.ts`

静态托管上 middleware 不执行。且 `output: 'export'` 与 middleware 共存时 Next 构建直接失败，因此必须删除而非保留。

后果：根路径重定向与 `Accept-Language` 协商能力丢失，由第 3 项在客户端补回。

### 3. 新增 `app/page.tsx`（根跳转页）

因 `app/layout.tsx` 是透传层，本页需自渲染 `<html>` / `<body>`。

行为：内联脚本读 `navigator.language`，`en` 开头去 `/en/`，否则去 `/zh/`；同时提供 `<meta http-equiv="refresh">` 作为无 JS 回退（回退目标为默认语言 `/zh/`）。

跳转目标从 `process.env.NEXT_PUBLIC_BASE_PATH` 拼出，与 `next.config.ts` 同源，不得写死 `/howweemojify`。

### 4. 修正 `components/chapter-02/OriginMap.tsx`

```ts
fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/world-atlas/countries-110m.json`)
```

这是全代码库唯一受 `basePath` 影响的运行时路径。不改则第二章地图在 Pages 上 404 且静默失败。

同时为该 fetch 补一个 `.catch()`，把失败打到 `console.error`。理由：该请求是站点唯一的运行时网络依赖，静默失败会让部署问题难以定位。此改动不影响正常路径下的视觉表现。

### 5. `package.json`

`output: 'export'` 后 `next start` 不再适用。将：

```
"start": "next start -p 7777"
```

改为：

```
"start": "npx --yes serve out -l 7777"
```

不新增依赖（`npx` 按需拉取）。

### 6. `.github/workflows/deploy.yml`

- 触发：`push` 到 `master` 或 `main`，加 `workflow_dispatch` 手动触发。同时列出两个分支名是因为目标仓库 `default_branch` 为 `main` 而我们推送 `master`；`push` 触发器只匹配分支名，与默认分支无关，列全可避免因默认分支归属产生的意外。
- 权限：`contents: read`、`pages: write`、`id-token: write`。
- 并发组：`pages`，`cancel-in-progress: false`。
- 步骤：`actions/checkout` → `actions/setup-node`（Node 20，npm 缓存）→ `npm ci` → `GITHUB_PAGES=true npm run build` → `actions/configure-pages@v5`（`enablement: true`）→ `actions/upload-pages-artifact`（path `./out`）→ `actions/deploy-pages`。

**不需要 `.nojekyll`**：官方 Actions 部署路径直接服务 artifact，不经过 Jekyll，`_next/` 目录不会被忽略。该文件是旧 `gh-pages` 分支时代的遗留。

### 7. remote 拓扑

保持 `origin` 指向 `hakureijin/howweemojify`（主仓库，所有权不变），新增 `pages` 指向 `evetai1997-beep/howweemojify`。

```
origin  https://github.com/hakureijin/howweemojify.git
pages   https://github.com/evetai1997-beep/howweemojify.git
```

日常 `git push origin master`；发布时额外 `git push pages master`。目标仓库为空，首次推送无冲突，不需要 `--force`。

## 验证计划

在本地精确复现 Pages 的子路径结构，而不是推上去再看：

```bash
GITHUB_PAGES=true npm run build
mkdir -p /tmp/site/howweemojify && cp -r out/* /tmp/site/howweemojify/
npx --yes serve /tmp/site -l 8080
# 访问 http://localhost:8080/howweemojify/
```

**关键约束：`next build` 与 `next dev` 不能同时运行。** 二者共用 `.next/` 目录，构建会覆盖 dev server 正在读取的文件，导致 dev 返回 500。这不是端口冲突，换端口无效。

因此对照测试必须串行：

1. 启动 `npm run dev`（7777），用 Playwright 逐章截图，作为基准。
2. **停止 dev server。**
3. 跑 `GITHUB_PAGES=true npm run build`，起静态预览（8080），用 Playwright 采集第二组截图。
4. 离线比对两组截图。重点确认第二章世界地图已渲染。
5. 检查静态预览的 Network 无 404。
6. 跑 `npm test` 与 `npm run lint`。

若 dev 已被构建污染，`rm -rf .next` 后重启 dev 可恢复。

## 风险与回退

- **`configure-pages` 的 `enablement: true` 可能失效**（取决于仓库设置）。回退：由 `evetai1997-beep` 手动在 Settings → Pages → Source 选择 "GitHub Actions"，一次性操作。
- **目标仓库的 Actions 可能未启用**，且我们无权查询或开启。若首次推送后 workflow 完全没有触发，即为此因。回退：由 `evetai1997-beep` 在 Settings → Actions → General 中允许 workflow 运行。
- **默认分支归属**：推送 `master` 后目标仓库的 `default_branch` 可能仍为 `main`。改默认分支需 admin 权限。这不影响部署（workflow 按分支名触发），仅影响仓库首页展示。若需修正，由 `evetai1997-beep` 操作。
- **首次 workflow 失败**：目标仓库为空且无生产流量，反复推送试错无代价。
- **整体回退**：本设计不改动 `origin` 主仓库的任何发布行为，`pages` remote 随时可删。

## 非目标

- 不迁移仓库所有权，不改 `origin`。
- 不绑定自定义域名。
- 不改 `localePrefix`，不重构 i18n 路由结构。
- 不处理工作区中与本次无关的未提交改动（`article/article_vinci2026_fourpart_source_map.html` 的 `<title>` 修改；`article/` 目录不被应用引用，与构建无关）。
