# GitHub Pages 部署实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 VINCI 静态导出并通过 GitHub Actions 发布到 `https://evetai1997-beep.github.io/howweemojify/`，页面效果与本地开发完全一致。

**Architecture:** Next.js 切换到 `output: 'export'`，`basePath` 由 `GITHUB_PAGES` 环境变量控制（仅 CI 设置）。删除与静态导出不兼容的 `middleware.ts`，其根路径重定向与语言协商能力由一个新增的静态根页面在客户端补回。GitHub Actions 构建产物 `out/`，交给官方 `actions/deploy-pages` 发布，不把编译产物写入 git。

**Tech Stack:** Next.js 15.5.18 / React 19 / next-intl 4 / vitest + jsdom / GitHub Actions

## Global Constraints

- 子路径前缀常量恰为 `/howweemojify`，全代码库只允许在 `lib/base-path.ts` 中出现这一个字面量。
- 组件与页面代码**不得**硬编码 `/howweemojify`，一律经 `withBasePath()` 或 `NEXT_PUBLIC_BASE_PATH`。
- 只有 CI 设置 `GITHUB_PAGES=true`；本地 `npm run dev` 与 `npm run build` 均走空前缀。
- **`next build` 与 `next dev` 不可同时运行**，二者共用 `.next/`，并行会让 dev server 返回 500。若已污染，`rm -rf .next` 后重启 dev。
- CI 使用 Node 20。
- 不改动 `origin`（`hakureijin/howweemojify`）的任何发布行为。
- 验收标准：Pages 上页面效果与本地一致，**第二章世界地图必须渲染**，Network 无 404。

## 相对 spec 的一处偏离

spec 第 1 节写了 `assetPrefix: basePath || undefined`。本计划**省略 `assetPrefix`**：Next.js 中 `assetPrefix` 的默认值即 `basePath`，显式重设是冗余；若其语义为追加而非替代，将产生 `/howweemojify/howweemojify/_next/...` 这一类本不存在的故障。Task 7 的静态预览会验证资源加载；若出现 404，再加回 `assetPrefix`。

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `lib/base-path.ts` | 唯一持有 `/howweemojify` 字面量；提供 `resolveBasePath()`（构建期）与 `withBasePath()`（运行期） | 新建 |
| `lib/locale-redirect.ts` | 生成根页面的跳转 URL 与内联脚本，纯字符串函数，可测 | 新建 |
| `tests/lib/base-path.test.ts` | 覆盖上述两个函数 | 新建 |
| `tests/lib/locale-redirect.test.ts` | 通过 `new Function` 实际执行内联脚本验证跳转行为 | 新建 |
| `next.config.ts` | 开启静态导出，接线 `basePath` 与 `NEXT_PUBLIC_BASE_PATH` | 修改 |
| `package.json` | `start` 脚本改为静态服务器 | 修改 |
| `middleware.ts` | 与 `output: 'export'` 不兼容 | **删除** |
| `app/page.tsx` | 根路径跳转页，自渲染 `<html>` | 新建 |
| `components/chapter-02/OriginMap.tsx` | 唯一受 `basePath` 影响的运行时 fetch | 修改 |
| `.github/workflows/deploy.yml` | 构建 + 部署流水线 | 新建 |

---

## Task 1: 基础路径工具

**Files:**
- Create: `lib/base-path.ts`
- Test: `tests/lib/base-path.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `PAGES_BASE_PATH: string`、`resolveBasePath(githubPages: string | undefined): string`、`withBasePath(path: string): string`

- [ ] **Step 1: 写失败的测试**

创建 `tests/lib/base-path.test.ts`：

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveBasePath, withBasePath } from '@/lib/base-path'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('resolveBasePath', () => {
  it("returns the project subpath when GITHUB_PAGES is 'true'", () => {
    expect(resolveBasePath('true')).toBe('/howweemojify')
  })

  it('returns an empty string when GITHUB_PAGES is unset', () => {
    expect(resolveBasePath(undefined)).toBe('')
  })

  it('returns an empty string for any value other than "true"', () => {
    expect(resolveBasePath('false')).toBe('')
    expect(resolveBasePath('1')).toBe('')
  })
})

describe('withBasePath', () => {
  it('leaves the path untouched when no base path is set', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '')
    expect(withBasePath('/world-atlas/countries-110m.json')).toBe(
      '/world-atlas/countries-110m.json',
    )
  })

  it('prefixes the path when a base path is set', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/howweemojify')
    expect(withBasePath('/world-atlas/countries-110m.json')).toBe(
      '/howweemojify/world-atlas/countries-110m.json',
    )
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/lib/base-path.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/base-path"`

- [ ] **Step 3: 写最小实现**

创建 `lib/base-path.ts`：

```ts
/**
 * GitHub Pages 项目站点的子路径。整个代码库中这个字面量只应出现在这里。
 */
export const PAGES_BASE_PATH = '/howweemojify'

/** 构建期：由 next.config.ts 调用，决定 Next 的 basePath。 */
export function resolveBasePath(githubPages: string | undefined): string {
  return githubPages === 'true' ? PAGES_BASE_PATH : ''
}

/**
 * 运行期：给不经 Next 路由的绝对路径（public/ 下的静态资源）加前缀。
 * Next 不会改写手写的绝对路径，凡是 fetch/src/href 指向 public/ 的都要过这里。
 */
export function withBasePath(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/lib/base-path.test.ts`
Expected: PASS，5 个用例全绿

- [ ] **Step 5: 提交**

```bash
git add lib/base-path.ts tests/lib/base-path.test.ts
git commit -m "feat(deploy): add base path helpers for GitHub Pages subpath"
```

---

## Task 2: 根路径跳转逻辑

**Files:**
- Create: `lib/locale-redirect.ts`
- Test: `tests/lib/locale-redirect.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `redirectHref(base: string, locale: 'zh' | 'en'): string`、`redirectScript(base: string): string`

`redirectScript` 返回一个 IIFE 字符串，形如 `(function(n,l){...})(navigator,location);`。之所以把 `navigator`/`location` 作为参数传入而非直接引用全局，是为了让测试能用 `new Function('navigator','location', script)` 注入替身，从而**真正执行**这段脚本来验证跳转目标，而不是对字符串做正则断言。

- [ ] **Step 1: 写失败的测试**

创建 `tests/lib/locale-redirect.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { redirectHref, redirectScript } from '@/lib/locale-redirect'

/** 执行生成的脚本，注入假的 navigator/location，返回被请求的跳转目标。 */
function runScript(script: string, language: string): string[] {
  const seen: string[] = []
  const fn = new Function('navigator', 'location', script)
  fn({ language }, { replace: (url: string) => seen.push(url) })
  return seen
}

describe('redirectHref', () => {
  it('builds a trailing-slash URL under the base path', () => {
    expect(redirectHref('/howweemojify', 'zh')).toBe('/howweemojify/zh/')
  })

  it('builds a root-relative URL when the base path is empty', () => {
    expect(redirectHref('', 'en')).toBe('/en/')
  })
})

describe('redirectScript', () => {
  it('sends English browsers to the en route under the base path', () => {
    expect(runScript(redirectScript('/howweemojify'), 'en-GB')).toEqual([
      '/howweemojify/en/',
    ])
  })

  it('sends Chinese browsers to the zh route', () => {
    expect(runScript(redirectScript('/howweemojify'), 'zh-CN')).toEqual([
      '/howweemojify/zh/',
    ])
  })

  it('falls back to zh for any other language', () => {
    expect(runScript(redirectScript('/howweemojify'), 'ja-JP')).toEqual([
      '/howweemojify/zh/',
    ])
  })

  it('works with an empty base path', () => {
    expect(runScript(redirectScript(''), 'zh-CN')).toEqual(['/zh/'])
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/lib/locale-redirect.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/locale-redirect"`

- [ ] **Step 3: 写最小实现**

创建 `lib/locale-redirect.ts`：

```ts
export type Locale = 'zh' | 'en'

/** 根路径跳转目标。trailingSlash: true，故必须带尾斜杠。 */
export function redirectHref(base: string, locale: Locale): string {
  return `${base}/${locale}/`
}

/**
 * 根页面的内联脚本。静态托管上没有 middleware，语言协商只能放到客户端。
 * navigator/location 由参数注入，便于测试直接执行本脚本。
 */
export function redirectScript(base: string): string {
  const b = JSON.stringify(base)
  return `(function(n,l){var t=(n.language||'').toLowerCase().indexOf('en')===0?'en':'zh';l.replace(${b}+'/'+t+'/');})(navigator,location);`
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/lib/locale-redirect.test.ts`
Expected: PASS，6 个用例全绿

- [ ] **Step 5: 提交**

```bash
git add lib/locale-redirect.ts tests/lib/locale-redirect.test.ts
git commit -m "feat(deploy): add client-side locale redirect for static export"
```

---

## Task 3: 切换 Next 到静态导出

**Files:**
- Modify: `next.config.ts`
- Modify: `package.json`（`scripts.start`）
- Delete: `middleware.ts`

**Interfaces:**
- Consumes: `resolveBasePath` from `lib/base-path.ts`（Task 1）
- Produces: 构建产物目录 `out/`；运行期环境变量 `NEXT_PUBLIC_BASE_PATH`

`middleware.ts` 必须与本 task 一起删除：`output: 'export'` 与 middleware 共存时 Next 构建直接失败，两者分开提交会留下一个构建不过的中间提交。

- [ ] **Step 1: 删除 middleware**

```bash
git rm middleware.ts
```

- [ ] **Step 2: 改写 `next.config.ts`**

```ts
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { resolveBasePath } from './lib/base-path'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const basePath = resolveBasePath(process.env.GITHUB_PAGES)

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
}

export default withNextIntl(nextConfig)
```

- [ ] **Step 3: 改 `package.json` 的 start 脚本**

`output: 'export'` 之后 `next start` 不再适用（Next 会报错，它已不是服务器渲染）。把

```json
"start": "next start -p 7777",
```

改为

```json
"start": "npx --yes serve out -l 7777",
```

不新增依赖。

- [ ] **Step 4: 确认 dev server 未在运行，然后构建**

`next build` 与 `next dev` 共用 `.next/`，必须先确认没有 dev server 在跑：

```bash
pkill -f "next dev" || true
rm -rf .next out
npm run build
```

Expected: 构建成功，且 `out/` 生成。若报 `Middleware cannot be used with "output: export"`，说明 Step 1 没生效。

若报错指向 `next.config.ts` 无法 import `./lib/base-path`，则把 `resolveBasePath` 的逻辑内联进 `next.config.ts`（`const basePath = process.env.GITHUB_PAGES === 'true' ? '/howweemojify' : ''`），并在 `lib/base-path.ts` 顶部加注释说明该值需与 config 手工同步。

- [ ] **Step 5: 确认导出产物结构**

```bash
ls out/ && ls out/zh/ | head -3
```

Expected: `out/` 下有 `zh/`、`en/`、`404.html`、`_next/`；`out/zh/index.html` 存在（`trailingSlash: true` 的效果）。此时 `out/index.html` **尚不存在**——由 Task 4 提供。

- [ ] **Step 6: 提交**

```bash
git add next.config.ts package.json
git commit -m "feat(deploy): switch to static export, drop middleware"
```

---

## Task 4: 根跳转页

**Files:**
- Create: `app/page.tsx`

**Interfaces:**
- Consumes: `redirectHref`、`redirectScript` from `lib/locale-redirect.ts`（Task 2）；`resolveBasePath` from `lib/base-path.ts`（Task 1）
- Produces: `out/index.html`

`app/layout.tsx` 是透传层（`return children`，不渲染 `<html>`），因此本页必须自渲染 `<html>` 与 `<body>`。这与 `app/[locale]/layout.tsx` 的做法一致。

本页是**服务端组件，在构建期渲染**，因此直接读真实环境变量 `GITHUB_PAGES` 并调 `resolveBasePath()`，而**不**读 `process.env.NEXT_PUBLIC_BASE_PATH`。后者依赖 `next.config.ts` 的 `env:` 注入，多一层机制就多一个失效点。`NEXT_PUBLIC_BASE_PATH` 的注入只有客户端组件（`OriginMap`，Task 5）才真正需要。

- [ ] **Step 1: 创建 `app/page.tsx`**

```tsx
import { resolveBasePath } from '@/lib/base-path'
import { redirectHref, redirectScript } from '@/lib/locale-redirect'

const base = resolveBasePath(process.env.GITHUB_PAGES)

export default function RootRedirect() {
  return (
    <html lang="zh">
      <head>
        <meta httpEquiv="refresh" content={`0;url=${redirectHref(base, 'zh')}`} />
        <script dangerouslySetInnerHTML={{ __html: redirectScript(base) }} />
      </head>
      <body />
    </html>
  )
}
```

`<meta http-equiv="refresh">` 是无 JS 时的回退，目标为默认语言。有 JS 时内联脚本先执行并 `location.replace`，不会留下多余的历史记录。

- [ ] **Step 2: 构建并确认根页面存在**

```bash
rm -rf .next out && npm run build && ls out/index.html
```

Expected: `out/index.html` 存在。

- [ ] **Step 3: 确认根页面内容正确（空前缀）**

注意：生成的脚本里 `location` 只是 IIFE 的实参名，函数体内用的是形参 `l`，所以文本中出现的是 `l.replace(...)`，grep `location.replace` 永远匹配不到。

```bash
grep -o 'url=[^"]*' out/index.html
grep -c 'navigator,location' out/index.html
```

Expected: 第一条输出 `url=/zh/`（base 为空串）；第二条输出 `1`，说明内联脚本已注入。

- [ ] **Step 4: 确认带前缀构建时跳转目标正确**

```bash
rm -rf .next out && GITHUB_PAGES=true npm run build && grep -o 'url=[^"]*' out/index.html
```

Expected: `url=/howweemojify/zh/`

- [ ] **Step 5: 提交**

```bash
git add app/page.tsx
git commit -m "feat(deploy): add static root page with client-side locale redirect"
```

---

## Task 5: 修正 OriginMap 的资源路径

**Files:**
- Modify: `components/chapter-02/OriginMap.tsx:41-48`

**Interfaces:**
- Consumes: `withBasePath` from `lib/base-path.ts`（Task 1）
- Produces: 无

这是全代码库**唯一**受 `basePath` 影响的运行时路径。`data/*.json` 全部走 ES 静态 import，不发 HTTP，不受影响。不改此处，第二章世界地图在 Pages 上 404 且**静默失败**（无 `.catch()`，`features` 保持 `null`，地图渲染为空白）。

- [ ] **Step 1: 在 import 区加入 helper**

在 `components/chapter-02/OriginMap.tsx` 的 import 区加：

```ts
import { withBasePath } from '@/lib/base-path'
```

- [ ] **Step 2: 改写 fetch**

把第 41-48 行的

```ts
  useEffect(() => {
    fetch('/world-atlas/countries-110m.json')
      .then(r => r.json())
      .then((topo: Topology) => {
        const fc = feature(topo, topo.objects.countries as GeometryCollection) as unknown as FeatureCollection<Geometry>
        setFeatures(fc)
      })
  }, [])
```

改为

```ts
  useEffect(() => {
    fetch(withBasePath('/world-atlas/countries-110m.json'))
      .then(r => {
        if (!r.ok) throw new Error(`world-atlas: HTTP ${r.status}`)
        return r.json()
      })
      .then((topo: Topology) => {
        const fc = feature(topo, topo.objects.countries as GeometryCollection) as unknown as FeatureCollection<Geometry>
        setFeatures(fc)
      })
      .catch(err => {
        console.error('OriginMap failed to load world atlas', err)
      })
  }, [])
```

新增的 `r.ok` 检查与 `.catch()` 不改变正常路径下的视觉表现，只是让路径配错时在 console 里留下证据，而不是无声地少一张地图。

- [ ] **Step 3: 类型检查与 lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 均无错误。

- [ ] **Step 4: 全量测试**

```bash
npm test
```

Expected: 全部通过（含 Task 1、2 新增用例）。

- [ ] **Step 5: 提交**

```bash
git add components/chapter-02/OriginMap.tsx
git commit -m "fix(chapter-02): resolve world atlas URL through basePath"
```

---

## Task 6: GitHub Actions 部署流水线

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm run build`（Task 3 之后产出 `out/`）
- Produces: 部署到 GitHub Pages

触发器同时列出 `master` 与 `main`：目标仓库 `default_branch` 为 `main` 而我们推送 `master`。`push` 触发器只匹配分支名，与默认分支无关，两个都列可避免默认分支归属带来的意外。

- [ ] **Step 1: 创建 workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master, main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Build static export
        env:
          GITHUB_PAGES: 'true'
        run: npm run build

      - name: Enable and configure Pages
        uses: actions/configure-pages@v5
        with:
          enablement: true

      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./out

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`enablement: true` 让 workflow 用仓库自带的 `GITHUB_TOKEN`（已声明 `pages: write`）开启 Pages。这是本方案唯一不需要 admin 权限的自举手段。

**不需要 `.nojekyll`**：官方 Actions 部署路径直接服务 artifact，不经过 Jekyll，`_next/` 不会被忽略。

- [ ] **Step 2: 校验 YAML 语法**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('yaml ok')"
```

Expected: `yaml ok`

- [ ] **Step 3: 提交**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci(deploy): add GitHub Pages workflow"
```

---

## Task 7: 本地复现 Pages 子路径并验证

**Files:** 无改动。这是纯验证 task。

**Interfaces:**
- Consumes: Task 3-6 的全部产出
- Produces: 一组证据，证明"效果不变"

**这一步不能跳。** 把带 `basePath` 的产物放到真实的子路径下服务，是唯一能在推送前检出路径错误的办法。直接 `serve out` 会让站点挂在根路径，`basePath` 的所有假设都得不到检验。

- [ ] **Step 1: 采集 dev 基准截图**

```bash
pkill -f "next dev" || true
rm -rf .next
npm run dev
```

用 Playwright（`webapp-testing` skill）打开 `http://localhost:7777/zh/`，逐章截图存到 scratchpad。**重点截第二章世界地图。**

- [ ] **Step 2: 停止 dev server**

```bash
pkill -f "next dev"
```

**必须停。** 下一步的 `next build` 会覆盖 dev server 正在读的 `.next/`，并行会让 dev 返回 500——这不是端口冲突，换端口无效。

- [ ] **Step 3: 构建并铺成子路径结构**

```bash
rm -rf .next out
GITHUB_PAGES=true npm run build
rm -rf /tmp/site && mkdir -p /tmp/site/howweemojify
cp -r out/* /tmp/site/howweemojify/
npx --yes serve /tmp/site -l 8080
```

- [ ] **Step 4: 验证根路径跳转**

Playwright 打开 `http://localhost:8080/howweemojify/`

Expected: 自动跳转到 `http://localhost:8080/howweemojify/zh/`，页面正常渲染。

- [ ] **Step 5: 验证第二章地图与 Network**

Playwright 滚动到第二章，截图。检查 console 与 network：

Expected:
- 世界地图已渲染（与 Step 1 的基准截图一致）。
- Network 中 `/howweemojify/world-atlas/countries-110m.json` 返回 **200**。
- **无任何 404**。特别确认 `_next/static/...` 全部 200——若这里 404，说明需要把 `assetPrefix` 加回 `next.config.ts`。
- console 中无 `OriginMap failed to load world atlas`。

- [ ] **Step 6: 逐章比对**

把 Step 5 的截图与 Step 1 的基准逐章比对。任何差异都要定位到原因后才能继续。

- [ ] **Step 7: 全量测试与 lint**

```bash
pkill -f "serve /tmp/site" || true
npm test && npm run lint && npx tsc --noEmit
```

Expected: 全绿。

- [ ] **Step 8: 清理**

```bash
rm -rf /tmp/site
```

无需提交（本 task 无文件改动）。

---

## Task 8: 合并、配置 remote、发布

**Files:** 无改动。

**Interfaces:**
- Consumes: Task 1-7 全部完成且 Task 7 验证通过
- Produces: 线上站点

**前置条件：Task 7 的全部 Expected 均已满足。** 未通过则不得进入本 task。

- [ ] **Step 1: 合并回 master**

```bash
git checkout master
git merge --no-ff feat/github-pages-deploy -m "feat: deploy to GitHub Pages via static export"
```

- [ ] **Step 2: 添加 pages remote**

```bash
git remote add pages https://github.com/evetai1997-beep/howweemojify.git
git remote -v
```

Expected: `origin` 指向 `hakureijin/howweemojify`，`pages` 指向 `evetai1997-beep/howweemojify`。

- [ ] **Step 3: 推送**

目标仓库为空，首次推送无冲突，**不需要 `--force`**。

```bash
git push origin master
git push pages master
```

- [ ] **Step 4: 观察 workflow**

```bash
gh run list --repo evetai1997-beep/howweemojify --limit 3
gh run watch --repo evetai1997-beep/howweemojify
```

若 **workflow 完全没有触发**：目标仓库的 Actions 未启用（我们无权查询或开启）。需由 `evetai1997-beep` 在 Settings → Actions → General 中允许 workflow 运行。

若 **`configure-pages` 步骤失败**：`enablement: true` 未生效。需由 `evetai1997-beep` 在 Settings → Pages → Source 选择 "GitHub Actions"，然后 `gh run rerun`。

- [ ] **Step 5: 验证线上站点**

```bash
curl -sI https://evetai1997-beep.github.io/howweemojify/ | head -1
curl -sI https://evetai1997-beep.github.io/howweemojify/world-atlas/countries-110m.json | head -1
```

Expected: 两者均为 `HTTP/2 200`。

然后用 Playwright 打开 `https://evetai1997-beep.github.io/howweemojify/`，确认跳转到 `/zh/`，第二章地图渲染，Network 无 404。

- [ ] **Step 6: 清理分支**

```bash
git branch -d feat/github-pages-deploy
```

---

## 需要 `evetai1997-beep` 账号操作的兜底项

以下三项我们**无 admin 权限**，均为兜底，不一定触发：

1. workflow 未触发 → Settings → Actions → General，允许 workflow 运行。
2. `configure-pages` 失败 → Settings → Pages → Source 选 "GitHub Actions"。
3. 目标仓库 `default_branch` 为 `main` 而我们推 `master`。不影响部署，仅影响仓库首页展示。想修正需 admin。

## 非目标

- 不迁移仓库所有权，不改 `origin`。
- 不绑定自定义域名。
- 不改 `localePrefix`，不重构 i18n 路由。
- 不处理工作区中与本次无关的未提交改动（`article/` 下的 `<title>` 修改、`.next-dev.log`）。
