# 静态对照页 + 实验行为记录

日期：2026-09-25
状态：已批准（2026-09-25 写计划时按数据核对修正了 §01a/§01b/§01c 的条目数与呈现细节）

## 背景与目的

现有站点（`/zh`、`/en`）是交互式可视化叙事：Hero 表情墙、§01 三张交互图、§02 流程/标准/案例/可缩放世界地图。

项目计划做**对照组实验**：交互版为实验组，新增一版**静态、无交互、以陈列为主**的页面作为对照组。两版必须呈现**同样的信息**，自变量只有"交互性"。实验期间需要记录被试行为；对外公开展示时不记录。

## 验收标准

1. **严格对等**：静态版与交互版的配色、字体、图表形态、章节顺序、文案一致。静态版只把"需要操作才看得到"的信息默认摊开——不增不减。
2. **完全静止**：静态版无任何动画（含 `Section` 入场淡入、Pipeline 入场、Hero 漂浮），无可操作控件（例外见下文"允许的元素"）。
3. **内容对等可自动检验**：有测试断言静态页包含全部数据条目且数值与 `data/*.json` 一致。
4. 静态版公开发布在 GitHub Pages：`/howweemojify/{zh,en}/static/`。两版之间**无互相链接**；根路径跳转仍指向交互版。
5. 实验构建（`NEXT_PUBLIC_EXPERIMENT=1`）下：两版都去掉语言切换；行为记录启用并写入本地/云端服务器的 JSONL 文件。
6. 公开构建下：`track()` 为空操作，不发出任何日志请求；交互版外观与行为与现在完全一致。
7. `npm test`、`npm run lint`、`npm run build`（含 `GITHUB_PAGES=true`）无回归。

## 非目标

- 不做问卷/任务型测验页面（由实验者另行安排）。
- 不做日志的分析或可视化（JSONL 可直接用 pandas 等读取）。
- 不改动交互版的视觉与交互行为（仅在事件处理处插入 `track()` 调用、以及实验构建下隐藏语言切换）。

## 设计

### 1. 静态版内容映射

| 部分 | 交互版 | 静态版 |
|---|---|---|
| Hero | ~275 表情漂浮，hover 推开，click 放大 | 用同一 `lib/hero-emoji-layout.ts` 生成相同位置的表情墙，纯 `<span>`，无漂浮、不可点击；标题/副标题/滚动提示不变 |
| §01a 累计增长图 | 15 个有新增数的版本徽章（`chapter-01.json` 的 17 个节点中 iPhone JP 2007、Apple Genmoji 两个里程碑无 `newEmojiCount`，交互版也不画）+ tooltip（年份/版本/新增/累计/增长率/叙述/来源）；3 个范围按钮；版本对比下拉，**默认显示 6.0 → 17.0 的对比卡片与 A/B 标记** | ① 全范围主图，每个徽章旁标编号，保留默认 A/B 标记；② 下方「2015 → 至今」放大小图（覆盖 2015/2020 两档范围按钮）；③ 默认对比（6.0 → 17.0）以纯文字 + 同一张对比卡片呈现；④ 15 行表：编号、年份、版本、新增、累计、增长率、代表表情、叙述、来源。其他版本组合是表中数据的组合运算，不单独枚举 |
| §01b 分类 treemap | 时间滑块切换 17 帧；tooltip 显示数量、占比、6 个样例 | 最新一帧大图（= 交互版默认视图）+ 17 张小 treemap 按时间网格平铺，每张标版本与年份，沿用同一套 3 档标签规则；下方矩阵表（9 类别 × 17 版本，单元格为数量与占比），样例列按「连续相同的样例集合 + 适用版本区间」无损合并列出 |
| §01c 变体 Sankey | 22 条流，hover/focus/pin 才出现表情珠与 tooltip | 22 条流**全部**显示表情珠（沿用 `sampleSankeyCurve` 与珠数/珠径公式）；节点标签照旧带总数；两张可见表格承载全部 tooltip 内容：节点表（17 行：数量、占总量、6 个示例）与流向表（22 行：数量、占总量、占该机制、6 个示例）。原 `sr-only` 汇总是节点表的子集，不再单独保留 |
| §02 流程 / 标准 / 案例 | 本身近似静态，有入场动画 | 复用内容，去掉动画 |
| §02 世界地图 | 缩放/拖动，41 个标注各有 tooltip | 全图 + 若干局部放大图（按标注密度划分，暂定欧洲、东亚、南亚），标注带编号；下方 41 行表：编号、表情、国家、城市/来源、年份 |
| 顶部导航 | 章节锚点 + 语言切换 | 同左；实验构建下两版都去掉语言切换 |
| 页脚参考文献 | — | 相同 |

允许的元素（静态版中唯一可交互的东西）：导航章节锚点、参考文献外链、公开构建中的语言切换按钮。

操作提示类文案（累计图 `hint` 中的「切换时间窗口」、treemap 副标题「拖动滑块」、Sankey 副标题「点或聚焦」、地图 `hint`）在静态版中换成去掉操作指引、其余内容不变的 `static.*` 版本——指向不存在控件的提示本身就会成为混杂变量。

已知且接受的差异：静态版因表格与小多图而页面更长——这是"信息摊开"的固有代价，需在论文中说明。

### 2. 代码结构

- 新路由 `app/[locale]/static/page.tsx`，导出为 `out/{zh,en}/static/index.html`。
- 新组件目录 `components/static/`：`StaticHero`、`StaticCumulative`、`StaticTreemap`、`StaticSankey`、`StaticWhoGetsIn`、`StaticOriginMap`、`StaticSection`（无 motion 的 `Section`）。
- **共享几何**：把交互组件中的纯计算（累计图比例尺与压缩断点、treemap 布局与标签分档、Sankey 布局与 `sampleSankeyCurve`、地图投影与标注坐标）抽到 `lib/` 下的纯函数，交互版与静态版都调用。抽取为纯重构，交互版行为不变。这是"严格对等"在代码层面的保障。
- Pipeline / CriteriaCards / CaseCards：给现有组件加 `static` 属性（关闭 motion），而不是复制。
- 地图 topojson 必须经 `withBasePath()` 请求（已知坑：basePath 下漏前缀会导致地图静默空白）。
- 文案复用 `messages/{zh,en}.json` 现有键；静态版新增的表头等少量字符串加到 `static.*` 命名空间，两种语言都补齐（`tests/i18n/message-keys.test.ts` 会检查）。

### 3. 行为记录

**模块** `lib/tracking.ts`，导出 `track(event)` 与 `initTracking({ condition })`。仅当 `process.env.NEXT_PUBLIC_EXPERIMENT === '1'` 时生效，否则全部为空操作。

**会话字段**（每条事件都带）：`pid`（URL `?pid=`，缺省为 `anonymous`）、`sessionId`（加载时 `crypto.randomUUID()`）、`condition`（`interactive` | `static`）、`locale`、`t`（客户端时间戳 ms）、`vw`/`vh`。

**两组共同事件**：

| 事件 | 触发 | 负载 |
|---|---|---|
| `session_start` | 加载 | userAgent |
| `session_end` | `pagehide` / `visibilitychange→hidden` | 总时长、各区块停留累计 |
| `visibility` | 标签页切走/切回 | `hidden` / `visible` |
| `scroll` | 节流 500 ms | `y`、`maxDepthPct` |
| `section_dwell` | 区块离开视口时（IntersectionObserver，阈值 50%） | `section`、本次时长 |
| `heartbeat` | 每 15 s | 各区块停留累计 |
| `link` | 点击参考文献链接 | `href` |

统一区块 ID：`hero`、`ch01-cumulative`、`ch01-treemap`、`ch01-sankey`、`ch02-pipeline`、`ch02-criteria`、`ch02-cases`、`ch02-map`、`footer`。两版在对应容器上加相同的 `data-track-section`。

**仅交互版**：`interact`，负载 `{ target, action, detail }`，例如 `{cumulative, pin, "emoji-11"}`、`{cumulative, range, "since-2015"}`、`{cumulative, diff, "a→b"}`、`{treemap, slider, 2016}`、`{treemap, play}`、`{sankey, pin, flowId}`、`{map, zoom, 2.4}`、`{map, pan}`（拖动结束时一条）、`{map, pin, id}`、`{hero, click, char}`。hover 只记停留 ≥ 300 ms 的"有效悬停"（`action: "hover"`）。在各组件已有的处理函数中插入一行 `track()`，不改变原有逻辑。

**发送**：内存队列，每 5 s 或满 20 条批量 `fetch('/api/log', { method: 'POST', keepalive: true })`；页面关闭时 `navigator.sendBeacon`。失败保留在队列等下次重试，队列上限 500 条（超出丢最旧），不影响页面。

### 4. 实验服务器

`scripts/experiment-server.mjs`，仅用 Node 内置模块，不新增依赖：

- 托管 `out/`，支持 `trailingSlash` 目录索引与常见 MIME。
- `POST /api/log`：请求体须为 JSON 数组、≤ 100 条、≤ 64 KB，否则 400。每条追加 `serverTime`、`ip` 后写入 `logs/events-YYYY-MM-DD.jsonl`（追加写，一行一条）。
- `GET /api/health` → `200 ok`。
- 监听 `0.0.0.0:${PORT ?? 7777}`（局域网可访问）。`LOG_DIR` 可覆盖日志目录。
- `logs/` 加入 `.gitignore`。

**npm 脚本**：
- `build:experiment`：`NEXT_PUBLIC_EXPERIMENT=1 next build --turbopack`（不设 `GITHUB_PAGES`，无 basePath）。
- `experiment`：`build:experiment` 后启动服务器。

**上云**：把 `out/` 与脚本拷到云主机，`node scripts/experiment-server.mjs` 即可，无需改代码。

**被试链接**：`http://<host>:7777/zh/?pid=P017`（交互组）、`http://<host>:7777/zh/static/?pid=P017`（对照组）。

公开 GitHub Actions 部署流程不改；静态版随 `npm run build` 自动产出。

## 测试

1. **内容对等**（`tests/static/*.test.tsx`）：渲染静态页各组件，断言 15 个版本行、17 张 treemap、22 条 Sankey 流、41 个地图标注、5 个流程步骤、6 张标准卡、4 个案例全部出现，且数值与数据 JSON 一致。
2. **无交互**（同上）：静态组件中无 `button`、`select`、`input`、`[role=button]`、`[tabindex]`；无 framer-motion 组件。
3. **共享几何**：抽取后的纯函数有单测；交互版现有测试不回归。
4. **记录模块**（`tests/lib/tracking.test.ts`）：批量阈值、定时发送、失败重试、队列上限、区块停留累计；未开实验开关时不调用 `fetch`/`sendBeacon`。
5. **服务器**（`tests/scripts/experiment-server.test.ts`）：合法请求写入 JSONL；非数组/超限返回 400；静态文件与目录索引可访问；`/api/health` 正常。
6. **构建验证**（手动）：`GITHUB_PAGES=true npm run build` 后确认 `out/{zh,en}/static/index.html` 存在、地图正常；Playwright 对两版 × 两语言截全页图人工比对；实验构建下跑服务器，在浏览器操作一轮后检查 JSONL 内容。

## 风险

- **页面长度差异**：见上，接受并记录。
- **共享几何抽取回归**：抽取为纯重构，靠现有测试 + 截图比对兜底。
- **treemap 小图标签可读性**：17 张小图尺寸小，3 档标签规则会更多地退化为"只显示计数"；这属于同一规则的正常结果，不另加信息。
- **`session_end` 丢失**：由 15 s `heartbeat` 兜底，分析时以最后一条 heartbeat 为准。
