# 对照实验流程（交互版 vs 静态版）

本站同时服务于一个用户实验：**交互版 `/zh/`、`/en/` 是实验组，静态版 `/zh/static/`、`/en/static/` 是对照组**。两版之间唯一的自变量是"交互性"。

## 两种构建，用途不同

| | 公开构建（GitHub Pages） | 实验构建 |
|---|---|---|
| 命令 | `GITHUB_PAGES=true npm run build`（CI 自动执行） | `npm run build:experiment` |
| 地址 | https://evetai1997-beep.github.io/howweemojify/ | `http://<主机>:7777/` |
| 行为记录 | **无**，不发任何请求 | 开启，写入 `logs/` |
| 语言切换按钮 | 两版都有 | 两版都去掉，语言由链接固定 |

公开站点只用于展示，**不能用来做实验**，因为它不记录任何数据。

## 实验当天的操作步骤

1. **准备机器**：实验室电脑或任意云主机（阿里云、腾讯云轻量服务器等，国内网络可用）。需要 Node 20+，在仓库根目录执行过 `npm ci`。
2. **构建并启动服务器**：

   ```bash
   npm run experiment          # = 以 NEXT_PUBLIC_EXPERIMENT=1 构建，然后启动 scripts/experiment-server.mjs
   ```

   默认监听 `0.0.0.0:7777`，局域网内其他电脑也能访问。可用环境变量调整：`PORT`（端口）、`OUT_DIR`（静态文件目录，默认 `out`）、`LOG_DIR`（日志目录，默认 `logs`）。
   只想启动、不重新构建时：`node scripts/experiment-server.mjs`（要求 `out/` 已是实验构建产物）。
   部署到云主机时，把 `out/` 和 `scripts/experiment-server.mjs` 拷过去运行同一条命令即可，无需其他依赖。
3. **实验前自检**（每次开场前都跑）：

   ```bash
   python3 scripts/experiment_smoke.py --base http://<主机>:7777
   ```

   脚本会用测试编号在 1440×900 和 1366×650 两种视口下把两个版本各走一遍，检查所有事件类型和 9 个区块都有记录。输出里每行都是 `missing=-`、退出码为 0 才算通过。之后删掉或忽略这些 `SMOKE-*` 编号的记录。
4. **给被试发链接**，每人一个编号，只发所属组的那一个链接：
   - 交互组：`http://<主机>:7777/zh/?pid=P001`
   - 对照组：`http://<主机>:7777/zh/static/?pid=P001`
   - 英文被试把 `zh` 换成 `en`。
   - 两版之间没有互相链接，被试无法"串组"。漏写 `pid` 的会记为 `anonymous`，据此能发现链接发错。
   - 被试漏了结尾斜杠（如 `/zh/static?pid=P001`）会被自动 301 到正确地址，`pid` 保留。
5. **收集数据**：日志在 `logs/events-YYYY-MM-DD.jsonl`（**UTC 日期**），每行一个 JSON 事件。`logs/` 已被 gitignore，不会进仓库，请自行备份。
6. **结束**：停掉服务器进程即可。

## 日志内容

每条事件都带：`pid`、`sessionId`、`condition`（`interactive` | `static`）、`locale`、`seq`、客户端时间 `t`、视口 `vw`/`vh`、服务器时间 `serverTime`、`ip`。

事件类型：

- 两组都有：`session_start`、`scroll`、`section_dwell`、`visibility`、`heartbeat`（每 15 秒）、`link`、`session_end`。
- 只有交互组：`interact`（`target`/`action`/`detail`）。`target` 取值为 `cumulative`、`treemap`、`sankey`、`map`、`hero`。

统一的区块 ID：`hero`、`ch01-cumulative`、`ch01-treemap`、`ch01-sankey`、`ch02-pipeline`、`ch02-criteria`、`ch02-cases`、`ch02-map`、`footer`。

## 分析注意事项

- **按 `(sessionId, seq)` 去重**：失败重试或页面关闭时的补发可能让同一批事件到达两次。
- **`maxDepthPct`（滚动深度）不能跨组比较**：静态版更长，读完同样内容滚动比例更小。比较阅读量请用区块停留时间（`section_dwell` 事件，以及 `heartbeat`/`session_end` 里的 `dwell` 累计）。
- 区块"在读"的判定：区块可见部分 ≥ 它自身高度的一半，或 ≥ 视口高度的一半。标签页切到后台的时间不计入。
- `interact` 的固定语义：`pin` 打开提示框；`unpin` 是再次点击同一项；`close` 是其他方式关掉已打开的提示框（Esc、点外面、✕ 按钮，或切换范围/滑块导致图表重置）。
- 有效悬停（≥ 300 ms）才记为 `action: "hover"`，带时长 `ms`。
- 从浏览器前进/后退缓存恢复的会话，会在之前的 `session_end` 之后再发一条 `session_start`，带 `resumed: true`，`sessionId` 不变。
- 交互版在窄屏（md 断点以下）隐藏操作提示行，而静态版的图例说明始终显示——这是一处已知的呈现差异。
- 静态版比交互版长很多，这是把信息"摊开"的固有代价，属于呈现方式差异的一部分，论文里需要说明。

## 维护规则（改代码时必须遵守）

- **严格对等**：静态版与交互版的配色、字体、图表形态、章节顺序、文案一致。静态版只把"需要操作才看得到"的信息摊开（标注、表格、小多图、局部放大图），不增不减；无动画，无可操作控件（只允许导航锚点、来源外链、公开构建中的语言切换）。
- **改任何图表都要同时改两版**。两版共用的几何与展示组件在 `lib/charts/*`、`components/chapter-01/`、`components/chapter-02/`；静态组件在 `components/static/`。
- 改完必须保持 `tests/static/*`（信息对等、无交互）和 `tests/lib/track-sections.test.ts`（两版区块 ID 一致）通过。
- 公开构建必须保持"零记录请求"；实验相关代码只能在 `isExperiment()`（`NEXT_PUBLIC_EXPERIMENT=1`）为真时生效。
- **不要在 `npm run dev` 运行时执行构建**，两者共用 `.next/`，会让 dev 报 500。
- 设计与实现记录：`docs/superpowers/specs/2026-09-25-static-control-page-design.md`、`docs/superpowers/plans/2026-09-25-static-control-page.md`。
