# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

（0.5.0 及之后）

## [0.4.2] - 2026-11-25

`feat(workbench)`: 收口 —— 静帧验收墙、发布前九项检查与发布回执、未保存拦截、只读锁定、降级占位全部接通；自检 156 → **181/181**。无新增运行时依赖。

### Added — 静帧验收墙（读真实 verify.json）

- **`lib/verify-read.mjs`（新）**：`readVerify()` 依次找 `<工程>/qa/<id>.verify.json` → `<工程>/out/qa/` → `<插件>/out/qa/`；`frameTime()` 从 `frame-02-at-8s.png` 这类文件名读出秒数（整数秒与小数秒都要吃得下）；`normalizeVerify()` 归一成界面可直接渲染的结构（帧按时间排序、八组计数、warnings 带 fix）。
- **`GET /dsh-cineforge/verify`**：把报告里的**绝对路径**换成 `/dsh-cineforge/asset?src=pluginout|workspace&id=…`，前端不需要知道文件在哪；找不到报告返回 200 + `found:false` + 找过的位置 + 生成命令，不报 404。
- **`VerifyWall`**：contact-sheet 大图 + 逐帧缩略（点某帧 → 关闭墙并跳到覆盖该时刻的镜卡）+ 八组 error/warning 计数 + 明细（最多 30 条，含「修：」）。
- 底栏「静帧」计数改为读 verify 报告（此前写死 `—`）；报告不 ok 时数字标红。

### Added — 发布前检查与回执

- **`lib/publish.mjs`（新，10.6 KB，零依赖）**：`publishPreflight()` 出**九项**检查 —— 六项 `block`（AI 显式标识 / AI 隐式标识 / 文案齐全 / 极限词 / 数据安全 / 静帧验收）+ 三项 `warn`（封面 / 音频署名 / 画幅与平台）。任一条 block 未过 `ok:false`。
- 极限词表与 `compile-hf.mjs` 的 `legal_word_check` **同一张表**（导演级 / Opus / 最优 / 第一 / 免费商用 / 绝对 / 100% / 顶级 / 最好），不允许两处各写一份；数据安全扫手机号 / 邮箱 / 密钥 / 证件号 / 卡号。
- **`GET /dsh-cineforge/publish/preflight`**：服务端重算，**绝不信客户端传的 passed**。
- **`POST /dsh-cineforge/publish/record`**：preflight 未过且没有 `force:true` → 409 `PREFLIGHT_BLOCKED`（附完整九项）；通过则写 `<工程>/publish/aigc-metadata.json`（AIGC 隐式标识 sidecar）并把回执压进 `project.publish_receipts`（保留最近 20 条），走 rev CAS。
- **`PublishDialog`**：九项逐条显示「通过 / 阻断 / 待办 + 必过或提醒 + 怎么改」，必须勾「我已逐条看过」才能记录回执；回执明确写 `upload:'manual'` —— 一期**不内置上传**，原因是 biliup 属用户自装适配器、抖音 OpenAPI 需机构认证。

### Added — 状态与安全

- **未保存拦截**：脏状态下挂 `beforeunload`；点「返回对话」若仍有改动先 `window.confirm`。
- **只读锁定**：`locked = readOnly || (放行 && stage>storyboard)`。锁定后分镜卡不可拖、右边缘把手消失、镜头库条目不可拖入，提示改「已放行 · 分镜已锁」——要改先撤回放行，与服务端 lint 同一条规矩。
- **降级占位**：没有 verify 报告、没有 animatic、没有封面时只显示占位与生成命令，不报错、不留白屏。

### Changed

- `package.json`：version `0.4.1` → **`0.4.2`**。
- `scripts/compile-hf.mjs`：`compiler_version` 与 aigc `generator` `0.4.1` → `0.4.2`。
- `lib/server/routes.mjs` / `workbench-service.mjs`：端点表 11 → **14** 条。
- `lib/client.js`：77.7 KB → **88.3 KB**；新增样式全部走 `.cfw` 主题 token。

### Fixed

- `normalizeVerify` 此前把「算不出 URL 的帧」整条丢掉，导致发布检查里报「0 张静帧」——现在保留帧记录、只留空 url。
- `audioLicenses` 找 `assets/audio/ATTRIBUTION.md`（不存在），实际署名在 `bgm/` 与 `sfx/` 两个子目录 —— 改为三处都查。

### Verified

- `node scripts/self-test.mjs` → **ok true / total 181 / passed 181 / failed 0**。
- 真实 HTTP（同源 `Origin` 头）：`/verify?name=03_cineforge-demo-01` 200，7 张静帧 + contact-sheet 的 URL 全部可拼出；`/publish/preflight` 对 demo 工程 `ok:false`（3 项 block 未过：AI 双标识、文案），对补全后的 `04_cineforge-publish-test` `ok:true`（8 pass / 1 todo）；`/publish/record` 未过时 409 `PREFLIGHT_BLOCKED`，通过时 200 + rev 1→2 + `publish/aigc-metadata.json` 落盘。
- 客户端 bundle `plugins/??dsh-cineforge/client.js&rev=a2e9fd48e126` 88276 B，`VerifyWall / PublishDialog / cfw-pf-item / beforeunload / publish/preflight / publish/record / 静帧验收 / 发布检查` 全部命中。

## [0.4.1] - 2026-11-25

`feat(workbench)`: 工作台从只读骨架变成**能动** —— 拖拽重排、拉时长、拖卡入板、animatic 预览片、分镜体检与确认放行，全部走真实端点与 rev CAS；自检 129 → **156/156**。无新增运行时依赖。

### Added — 分镜可编辑（B 区）

- **拖拽重排**：分镜卡 `draggable`，卡片间落位即换序；`reflowShots(shots,fps)` 按新顺序重算 `from`，`duration_f` 下限 1 帧，杜绝空洞与重叠。
- **拖右边缘拉时长**：卡片右侧 7px 把手（`.rz`，`cursor:ew-resize`），按 `pxPerFrame = max(0.6, 620/max(120,totalFrames))` 把像素位移换算成帧，最小 15 帧（0.5s @30fps），松手即 reflow。
- **从镜头库拖卡进来**：库条目 `draggable`，`dataTransfer` 走自定义 MIME `text/cfw-card`；丢到分镜板空白处=**末尾追加**，丢到某镜上=**替换该镜**（默认 `duration_f:90` / `energy:'mid'`）。
- **连续编辑只发一次保存**：本地立即生效（`applyLocal`）+ 500ms 防抖，拖动过程中不打断手感。

### Added — animatic 预览片（核心）

- **`lib/animatic.mjs`（新，13.2 KB）**：把 project.json 直接编译成**低分辨率、静帧驱动、但时间线与声音完全真实**的预览片。`ANIMATIC_FPS=24`、`canvasOf(aspect)`（9:16→540×960 / 1:1→540×540 / 3:4→540×720 / 4:3→720×540 / 默认 960×540）、`timelineOf(project)`、`wrapText()`（中文宽 1、英文 0.56 逐字折行）、`buildAnimatic()`。
- 每镜一张 drawtext「定妆卡」（序号 / 分类·能量 / 标题 / 副标题 / card_id / `X.XXs · Nf` / 「ANIMATIC · 预览 · 非最终」/ 进度条），再逐镜出 mp4、concat、按 `peak_f` 抵消 SFX 峰值偏移后 amix BGM+SFX，输出 `animatic.mp4` + `animatic.json`（schema `cineforge/animatic/v1`）。
- **为什么值得**：HyperFrames 渲染是分钟级且要 npx/浏览器，用户拖完分镜需要「立刻听到新节奏」。实测 20s / 6 镜 **build_ms 2300**（约 2.3 秒出片），540×960 / 24fps / 13 条音轨；BGM 拍点与 SFX 位置与成片一致。
- **两个实测踩坑**（代码里都有注释）：① concat 列表必须写**绝对路径**（demuxer 以 list 文件所在目录为基准解析）；② 每镜 `fade=t=in:d=0.10` 会在每个切点产生可察觉暗闪，已整段删除。

### Added — 分镜体检与确认门

- **`lib/lint.mjs`（新，6.3 KB）**：`lintStoryboard(project,{cardMap})` 出 `{passed,findings,summary}`，按 error / warn / info 分级；规则含卡片是否在库（C1）、能量弧（R4）等。error 才阻断放行，warn/info 只提示。
- **`POST /dsh-cineforge/lint`**：客户端只传工程名，服务端自己读 project.json 并跑 lint。
- **`POST /dsh-cineforge/animatic`**：现场生成预览片（`resolveFfmpeg` 找不到 ffmpeg → 503 `NO_FFMPEG`，只读工程 → 403），生成后把摘要写回 `project.animatic`（rev CAS，写失败不影响预览片可用）。
- **`POST /dsh-cineforge/gate`**：只接受 `gate:'storyboard'`；`open:true` 前先跑 lint，有 error → 409 `LINT_BLOCKED`（附 error 条目）；通过则写 `gates.storyboard={open,at,by:'user',rev}` 并把 `stage` 推到 `assets`；撤回则回到 `storyboard`。
- **UI**：B 区新增「分镜体检」面板（`LintPanel`，error>warn>info 排序、最多 12 条）、「生成预览 / 重新生成」按钮、以及真正可点的「确认放行 →」/「撤回放行」。

### Added — 并发与冲突

- **409 冲突面板**（`ConflictPanel`）：显示服务端 `currentRev` 与本地 `baseRev`、两版镜数，三个选择「先不动 / 用服务端的 / 用我的覆盖」。服务端**绝不自动 merge**。
- **保存串行化**：`savingRef` 保证一次只发一个保存请求（否则自己跟自己撞 409），`againRef` 记账「保存期间又改过」，存完补发一次；补发期间保存态保持「未保存」。
- **顶栏保存态**接真：`保存中…` / `未保存` / `已保存`。

### Changed

- `package.json`：version `0.4.0` → **`0.4.1`**。
- `scripts/compile-hf.mjs`：`compiler_version` 与 aigc `generator` 由 `0.3.2` 更新为 `0.4.1`（此前漏改）。
- `lib/server/routes.mjs` / `lib/server/workbench-service.mjs`：端点表 8 → **11** 条。
- `lib/client.js`：55.9 KB → **77.7 KB**；新增 CSS 20 条，全部走 `.cfw` 主题 token，不写死颜色。
- C 区补上区块头「C · 资源库」（此前只有 A/B 有，视觉上像少了标题）。

### Verified

- `node scripts/self-test.mjs` → **ok true / total 156 / passed 156 / failed 0**。
- 真实 HTTP（同源 `Origin` 头）：`/lint` 200 `passed:true`（3 条 warn）；`/animatic` 200 `build_ms:2300`，产物 `03_cineforge-demo-01/animatic/animatic.mp4` 400839 B；`/gate` open→rev 3 / stage `assets`，close→rev 4 / stage `storyboard`。
- **组件级渲染冒烟**：`.local/probe/render-smoke.cjs` 用 vm + 极简 React（受控 `useState`）把 `WorkbenchPanel` 真跑一遍，断言 A/B/C 三区、S01–S03、拖动提示、放行按钮、体检面板、冲突面板、toast 全部出现在渲染文本里（当前 `MISS []`）。
- 抽帧复核 animatic 切点：删掉每镜 fade 后第 239–242 帧无黑闪。


### Added

- Store-listing preparation materials (DRAFT only; **no PR submitted**):
  - `store/HJ-Create-World__dsh-cineforge.yml` — DRAFT submission YAML for `data/plugins/`, with `description.en` / `description.zh`, `category: skill` and an optional `icon`.
  - `docs/PUBLISH-商店上架指南.md` — Chinese step-by-step listing guide: mechanism, hard-requirement table, P0 blockers, 8-step checklist, CI / human review, `held: author` handling, reader-side index source, optional npm publish, exact URL list.
  - `README.en.md` — English README mirroring the current facts and known boundaries (synced to 0.3.0).
  - `CHANGELOG.md` — this file.
  - `screenshots.json` — empty array `[]`; the repository has no tracked images available for screenshots (optional, not provided).
  - `assets/plugin-icon.png` — 256×256 bitmap PNG, dark `#0B0E14` + amber `#D3923C`, letter-C motif.

### Changed

- The publish-kit stage itself modified no runtime source files. The main thread subsequently completed the 0.3.0 rework (see `[0.3.0]` below), added the 7 GitHub topics (including `dsh-plugin`) and installed the plugin into the live `desktop` profile.

### Archived / documented

- `275e10b` — `docs(qa)`: archived the independent final review of the 0.2.0 demo film. Verdict: rework (27 rules: ✓7 / ✗14 / N/A6); P0 `publish.ai_disclosure` explicit + implicit both false; **NOT FOR PUBLISH**. The demo is a phase-1 placeholder sample, not a publishable film.

## [0.4.0] - 2026-11-25

`feat(workbench)`: 工作台骨架（A 阶段）+ 参考片分析转正（C 阶段）。插件从「只有对话内技能」升级为「技能 + 侧栏工作台面板」，并新增两条零依赖 CLI。无新增运行时依赖。

### Added — 参考片分析（C 阶段，已转正为 lib/）

- **`lib/ffmpeg.mjs`** — ffmpeg 定位与探测：`resolveFfmpeg(env)` 按 `CINEFORGE_FFMPEG` → PATH → 已知安装目录（winget Gyan / C:/ffmpeg / Program Files / chocolatey）依次探测，返回 `{ffmpeg, ffprobe, source, tried}`；`run()` 二进制安全、maxBuffer 512MB；`probeMedia()` 出 width/height/fps/duration_s/has_audio/video_codec/audio_codec/size_bytes/format_name。
- **`lib/reference-analysis.mjs`** — 参考片结构分析：`segment()` 用**自研帧差法**（fps 4 / 宽 48 / 灰度，阈值 `max(mean*2.0, 5)`，0.5s 内合并，片头 0.25s 护栏）；`keyframes()` 每镜取 15%/50%/85% 三帧；`contactSheet()` 每镜中点帧 + drawtext 标号 + hstack；`shotStats()` 逐镜出 luma / dark_ratio / motion / kind(`dark`|`paper`|`mixed`)。
  - 文件头记录的关键教训：**ffmpeg 官方 `scdet` 与 `select=gt(scene,…)` 在本机测试片上 0 命中，阈值降到 0.08 仍 0 命中**，必须自研。
- **`lib/style-fingerprint.mjs`** — 风格指纹（schema `cineforge/style-fingerprint/v3`）：调色板（k=6 + 占比）、明暗分布、运动能量（p50/p90/p99 + static_ratio）、节奏（BPM）。BPM 用**谐波求和自相关** `score(L)=acAt(L)+0.8·acAt(2L)+0.6·acAt(3L)+0.4·acAt(4L)`，输出 `bpm_est` 与 `bpm_top` 候选；`bpmStability()` 对 >45s 的片子切三段复算，`spread≤5` 判稳定。
- **`lib/template-extract.mjs`** — 参考片 → 模板（`cineforge/template/v1`）：`from_reference` 只记 basename + sha256（**已脱敏**）、四层 `style`/`structure`/`motion`/`sound`、`slots`、`caveats`。角色判定规则：**占比最高的颜色=ground，与它 WCAG 对比度最高的=ink，accent 须 sat≥0.30 且 share≥0.02 否则置 null**（早期「最暗的当 ground」在浅色片上会把角色全判反，已修）。`motion.cards` 恒空并标 `needs_review`（不假装能反解动效），另给 `cardsGuess` 低置信猜测。`scaled_proposals` 按目标时长给同密度改写提案，note 明说「不是原片结构」。`cuts_per_min > 12` 时追加高密度警告。
- **`scripts/analyze.mjs`** — `node scripts/analyze.mjs video <片> [--out <目录>] [--json] [--no-fingerprint]` / `fingerprint` / `doctor`；默认产物落到片旁的 `analysis/`；`--json` 时 stdout 单行 JSON、进度走 stderr；退出码 2 未知模式 / 3 缺 ffmpeg / 1 异常。
- **`scripts/extract-template.mjs`** — `node scripts/extract-template.mjs <片> --id <kebab> [--name] [--out] [--targets 15,20,30,45] [--json]`，复用已有分析产物，缺失则现场跑；产 `template-<id>.json` + `.md`。
- **`knowledge/templates/template-world-search.json`** — 用真实参考片跑出的首个模板（304.8s / 1920×1080 / 24fps，76 镜，5 段结构，14.96 切/分，BPM 139.5，纸面 UI 叙事片）。

### Added — 工作台骨架（A 阶段，0.4.0 只读）

- **`lib/server/workbench-service.mjs`** — 挂载与工作区解析：`resolveWorkspaceRoot()` 五级优先级 ① `config.workspace` / `CINEFORGE_WORKSPACE` ② registry 中**带 `03_Video/02_MyWork` 目录**的工作区（多个取 `updatedAt` 最新）③ 与 `process.cwd()` 关联的 ④ registry 首个 ⑤ cwd。修掉的真实 bug：宿主进程 cwd 是 `C:\Users\15056\.dsh\profiles\desktop`，盲取 `registry[0]` 会落到 `08_Rtings-Calculate`。
- **`lib/server/project-store.mjs`** — 工程读写：`NAME_RE` 放宽为 `/^[a-z0-9][a-z0-9_-]{0,63}$/`（允许下划线，本机四层规范要求目录带序号前缀如 `03_cineforge-demo-01`；仍禁点 / 斜杠 / 空格）；`summarizeProject` 的 `name` 用目录名作唯一可寻址键，`project_id` 另列。
- **`lib/server/routes.mjs`** — 8 个端点，全部 same-origin 校验：`GET /health`、`GET /projects`、`GET /project?name=`、`POST /project/save`（rev CAS）、`POST /project/create`、`GET /cards`、`GET /templates`、`GET /asset?src=poster&id=`（支持 Range，可放成片 mp4）。`assetRoots()` 的 workspace 根已改为工程根（`03_Video/02_MyWork`）。
- **`lib/client.js`** — 浏览器半身（55.9 KB，零第三方依赖、只 `require('react')`、CJS-in-factory）：`sidebar.panellist` 一行 + 配对 `main` 面板；三栏布局 A 输入源 / B 分镜 / C 镜头库；主题 token 全 scope 在 `.cfw`，`[data-theme=light]` 覆盖同名变量；一次性注入 `<style id="dsh-cineforge-styles">`；所有 fetch 走 `/dsh-cineforge/*`（不能挂 `/api`，那是 `dsh-client-connection` 独占总会 401 的 RPC 通道）。
  - 隔离要点：路由与 webServer 走 `ctx.inject(["webServer"], child => …)` 子作用域 + `ctx.effect`，**不把 `tools`/`connection`/`webServer` 写进顶层 `inject`** —— 这正是 0.3.1 之前 `cannot get property "tools" without inject` 的成因。
- **`lib/index.js`** — `apply(ctx, config)` 收 `config.workspace`；`cineforge_health` 工具输出加 `workspace_root` / `workspace_source` / `projects_root`，便于排障。
- **`lib/version.mjs`** — 版本号单一真源＝`package.json`，运行时与 `/health` 都从这里取。
- **`assets/posters/`** — 51 张上游 poster（961 KB）+ `INDEX.json`，供镜头库卡片缩略图用（124 卡中 50 张有对应 poster，其余走无预览占位）。

### Changed

- `package.json`：version `0.3.2` → **`0.4.0`**；新增 `exports["./client"] = ./lib/client.js` 与 `dsh.client = { platform: "web", inject: [] }`（有了 `dsh.client` 宿主才 compose 客户端半身）；scripts 新增 `analyze` / `extract-template`。
- `scripts/self-test.mjs`：新增 C 阶段断言（模板 schema / slots 空 / `motion.cards` 恒空 / needs_review / ground=占比最高 / ink=对比最高 / accent=够饱和 / 段落合并 / 缩放提案 / BPM 估算标记 / Markdown 含调色板表与「不能做的」 / 单调色片不编 accent），**97 → 129 全绿**。

### Verified

- `node scripts/self-test.mjs` → `ok true / total 129 / passed 129 / failed 0`。
- `node scripts/analyze.mjs doctor` → `source=path`，ffmpeg 8.1.1-full_build-www.gyan.dev。
- 20s demo 实测：6 镜 / 18 关键帧 / 主色 `#10151b` 43.5% / 暗调 95.4% / **BPM 130**（真值 129）。
- 304.8s 参考片实测：76 镜 / 228 关键帧 / 中位镜长 2.25s / 14.96 切每分 / 调色板 `#e6e3da` 42.7%(ground) · `#10141a` 14.2%(ink) / 明暗 13.9·3.3·82.8 / BPM 139.5 / 三段稳定性 spread 0。
- 工作台端点实测：`/health` 200（`workspace_root=D:\…\11_Creation`、`workspace_source=video-workspace`）；`/projects` 200 列出 2 个工程（`03_cineforge-demo-01` 可写 rev=1，`cineforge-demo-01` 只读 rev=0）；`/templates` 200 count=1。
- 客户端 bundle 已被宿主 compose：`/plugins/??dsh-cineforge/client.js&rev=…` 200 / 55942 B，`/dsh-unlag/graph` 的 entries 含该条目；DSH 侧栏「影铸工作台」一行经 UIA 实测存在。

### Known limits

- 0.4.0 的工作台是**只读**的：读工程、看分镜、看镜头库；拖拽重排 / 拉时长 / animatic 播放 / 确认放行在 0.4.1。
- 无法用桌面自动化点开面板截图 —— 宿主策略拒绝向 DSH 自身窗口发送输入（`HOST_INPUT_DENIED`），UI 验收只能靠 HTTP 端点 + 用户目视。
- 参考片分析不能：复制内容、1:1 反解动效、做片段语义理解。这三条已写进模板 markdown 的「不能做的」段落。

## [0.3.2] - 2026-11-25

`fix(rework)`: cleared the P1/P2 backlog from the second independent final review (`docs/QA-一期返工终检报告.md`, 27 rules / 8 failing). No new dependencies, no new audio asset.

### Fixed (7 of 8 failing rules)

- **Q5** — new `hero` layout: single-subject opening; `buildTweens` hero branch implements the full spotlight → push-in → float → rim-light → settle arc (deterministic, no `Math.random`).
- **Q8** — new `outro-finale` layout: four-direction fly-in of 4 feature chips, stage beam, 12 deterministic sparks, wordmark hold; `18.5s` and `19.75s` frames are no longer byte-identical.
- **Q10** — `.mini-card .meta` raised from `calc(var(--small-px) * 0.80)` (29.6px) to `var(--small-px)` (37px), `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`; three cards reflowed from a narrow 3-column grid to a full-width flex row.
- **Q11** — 37px clears the 32px floor; the 9:16 / 5.2%-frame-height (100px) conflict is written up in `docs/视觉规范与口径.md` and recorded in `manifest.conscious_violations`.
- **S4** — `buildAudio` now clamps each SFX to its **own shot end** (not the film end), so `impact-cine` no longer bleeds ~1.06s into `s02`; a 12-clip foley map gives `s03` 3 card landings, `s04` 3 checklist rows and `s05` a real metric lock.
- **S5** — `docs/QA-音频工程实测报告.md` (492→500 lines, measured with ffprobe/ffmpeg): per-file peak lag, AAC priming, MP4 elst compensation; compiler now computes `from_s = peak_f / fps - SFX_PEAK_OFFSET_S[file] - OUTPUT_OFFSET_S` (OUTPUT_OFFSET_S = 0.000s for hyperframes 0.9.88 / FFmpeg native AAC 48kHz / MP4 Lavf62.12.101 / 30fps, 6/6 NCC residual 0.000s). Recorded in `manifest.audio_alignment`.
- **C2** — abstract slogan `普通模型也能有导演级设计感` replaced with concrete benefit `124 张配方卡 / 先定分镜，再开机`; `免费商用` rights claim removed from the outro.
- **Q1 (partial)** — header rule, bottom info band and right-side ruler fill the `--pb:691px` dead space; real product screenshots remain a documented conscious violation.

### Added

- `docs/视觉规范与口径.md` — font-size thresholds, safe-zone px values, Q7/Q5/Q8/C1 conscious-violation write-up.
- `docs/QA-音频工程实测报告.md` — promoted from gitignored `.local/` so it ships as `manifest.audio_alignment.evidence`.
- `manifest.legal_word_check` (on-screen copy only, 0 hits) and `manifest.conscious_violations` (Q11 / Q7 / C1).
- `scripts/self-test.mjs`: 97/97 (4 new 0.3.2 assertions for hero / finale / 12-clip alignment / legal-word check).

### Honestly still open

- The 0.3.2 film was re-rendered and measured: ffprobe H.264 / 1080×1920 / 30fps / 600f / 20.0s / 5,095,058 bytes + AAC 48kHz stereo; `hyperframes audio --json` −19.6 LUFS / −1.3 dBTP / 0 clipping / peak moment 17.745s (lands on the s06 finale impact). Human blind listening (S1) and two rendered BGM versions were still not done; the audio report substitutes objective LUFS / NCC / silencedetect measurement from an in-memory amix reconstruction and says so.
- `publish.ai_disclosure` stays false and `publish_allowed:false`; the film remains **NOT FOR PUBLISH** (phase-1 template-viability demo).
- `out/` artifacts still carry local absolute paths; `out/` is gitignored and never pushed.

## [0.3.1] - 2026-11-25

`fix(activation)`: repaired the plugin activation failure reported with the screenshot "启用失败：dsh: warning: 1 entry did not activate cineforge-skills (dsh-cineforge): Error: cannot get property "tools" without inject".

### Root cause

- `lib/index.js` declared `inject = ["skills", "tools"]` and read `ctx.tools` eagerly. Cordis injects only in-scope services; any profile without a `tools` service (CLI/TUI) left the entry PENDING, and a Cordis Proxy getter throws on un-injected property reads. Only the cineforge entry failed; all other plugins activated normally (verified against `cordis.patch.yml` 1910 lines, zero cineforge inserts, and 300+ intact plugin directories in `node_modules`).

### Fixed

- `inject = ["skills"]` only; `tools` is now an optional self-check service via `optionalService(ctx, name)` which tries `ctx.get(name, false)` and falls back to `ctx[name]`, swallowing the Proxy throw.
- `scripts/install-local.mjs`: fixed two `async get: (n) =>` → `get: async (n) =>` syntax errors (`SyntaxError: Unexpected token ":" at compileSourceTextModule`) and added 5 Cordis/Proxy regression checks (verify is now **32/32**, up from 27/27).
- `scripts/self-test.mjs`: added the same 5 regression assertions, including a Cordis Proxy mock that throws on un-injected reads.
- All node verification uses the explicit `C:/Program Files/nodejs/node.exe`; the Electron `process.execPath` cannot run `.mjs` reliably on this machine.

## [0.3.0] - 2026-11-25

`feat(rework)`: reworked the phase-1 demo film after the independent final review returned **打回** (rework). Turned the 5-shot silent placeholder into a 6-shot, 20s, audio-enabled film and fixed the 14 flagged engineering / contract defects. No new dependencies.

### Added

- `lib/hf-layouts.mjs`: six distinct shot layouts (title / quote / card-grid / checklist / metric / outro) — fixes "5 shots on one template".
- `lib/vendor/gsap.min.js`: local GSAP 3.15.0, referenced by relative path in the generated `index.html`; no CDN request at render time.
- Audio chain: `assets/audio/bgm/cineforge-bgm-20s.mp3` (trimmed from the upstream Mixkit-licensed `cat-walk.mp3`, fade in/out) plus six pinned SFX, each copied with its upstream `ATTRIBUTION.md` so the attribution chain is preserved. Manifest now records `audio.bgm` and `audio.sfx`.
- Two functional shots: the 124-card library (three mini cards) and the storyboard confirmation gate (checklist with a pending row), plus a 150-preview metric shot.
- AI-label metadata: `<meta name="aigc">` in the HTML and an `aigc-metadata.json` sidecar; `manifest.aigc` records explicit / implicit label state. `publish_allowed` stays `false` because `publish.ai_disclosure` is still unset — **NOT FOR PUBLISH** remains in force.

### Fixed

- **Single source of truth**: `resolvePrimitive` now honours an explicit `shot.primitive` first; `transition_in` / category are fallbacks only. The six declared primitives equal the manifest primitives.
- **Duration identity**: `padding_seconds: 0`, `declared_duration_s` / `declared_frames` equal `duration_s` / `total_frames` (20s / 600f); the old silent 0.6s tail padding was removed.
- **Determinism**: fixed seed `20261124`, `hyperframes.json` registry pinned to commit `45846f1e6d5609462d29652315d0d4254fe92c24`, `window.__timelines` fallback, first frame non-empty.
- **Readability / safe area**: 9:16 paddings in px against the strictest TikTok / Reels / Shorts intersection (left≥120 / right≤780 / top≥288 / bottom≤1248); short 2–3-word copy per shot; transform-only opening arc (no `letterSpacing` tween).
- **Visual defects**: merged the eyebrow and page badge into one text block (removed `content_overlap`), removed the `shot__edge` decoration, fixed the third mini-card overflow with `minmax(0, 1fr)` + `min-width: 0` + 0.80× meta font.
- `hyperframes check` now reports 0 error and 0 warning in layout / motion / contrast / craft / audio; only 7 structural lint warnings remain (sub-composition splitting, phase 2).

### Measured

- `scripts/self-test.mjs` rewritten to 86 fully offline checks (86/86), including byte-identical sha256 across two compilations of 10 artifacts (now also `aigc-metadata.json`, vendor GSAP, BGM and attribution files).
- `npm pack` → isolated profile install → real import: 27/27; the live `desktop` profile install also verifies 27/27.
- End-to-end render: `hyperframes@0.9.88` 600/600 frames, 20.0s, H.264 1080×1920 @30fps, AAC 48kHz stereo, 3.0MB. `hyperframes audio --json`: −19.4 LUFS / −1.2 dBTP / 0 clipping (measured, not listened). The integrated loudness is quieter than the −16 to −14 LUFS social target.
- `scripts/verify-hf.mjs`: `ok=true`, 7 non-zero PNG frames, contact sheet reviewed by eye.

### Notes

- The 124 shot cards are still **not** reproduced per card; the automatic mapping table is phase 3. No GUI workbench (phase 2), no publishing loop (phase 3). This is a phase-1 taste-layer / pipeline demo, not a publishable film.

### Second independent final review (2026-11-25)

- `docs/QA-一期返工终检报告.md`: a clean-context independent subagent re-checked all 27 rules against 8 materials (including the full-resolution contact sheet). **Verdict: conditional pass — internal phase-1 template-viability archive only; if judged as a publishable film it would still be "rework".**
- Improved to ✓14 / ✗8 / N/A5 (0.2.0 was ✓7 / ✗14 / N/A6). Of the old 14 failures: 1 fixed, 11 partially fixed, 2 unfixed (Q5 multi-subject opening, Q8 non-peak outro).
- **"Do not enter the publishing stage" still holds**: `publish.ai_disclosure` explicit + implicit remain false, title / description / cover / tags empty, `manifest.publish_allowed:false`, **NOT FOR PUBLISH**.
- New findings: S5 (audio offset not measured, first applicable after audio was added), Q11 (`mini-card .meta` 29.6px below the 32px floor, wraps mid-word), S4 (`impact-cine 4.063s` crosses the s01 3s boundary into s02).
- Audio: BGM + 6 pinned SFX present, `film_silent` gone, but measured-not-listened, the with/without-BGM two versions were not rendered, and no S5 offset measurement exists.
- The film is still a text-card template (6 shots sharing one background / grid / eyebrow / progress-bar skeleton and one 0.62s entrance); no real screenshots, complex lighting, publication-grade typography or camera language. `check 0 error` proves the template rendered, not that it looks good.
- Data safety: the picture / `index.html` / `manifest.json` are clean, but `out/` artifacts contain local absolute paths. `out/` is gitignored and never pushed; sanitize only if exporting the whole folder manually.
- Remediation order: P0 publishing compliance → P1 audio listening / two versions / S5 offset / S4 trim → P1 group-photo outro and single-subject opening → P2 publication-grade functional shots and font size → P2 sanitization and evidence consistency → P3 sub-composition and copy.

## [0.2.0] - 2026-11-24

`1eb8a31` — `feat(runtime)`: wired the plugin to 0.2.0 — skill registration, storyboard compiler, static-frame verification, offline self-test and local install script.

### Added

- Three in-chat skills registered via `ctx.skills.register` (`cineforge-director`, `cineforge-cards`, `cineforge-qa`) plus the `cineforge_health` tool (`lib/index.js`, `lib/skill-loader.js`).
- `scripts/compile-hf.mjs`: deterministic `cineforge/storyboard/v1` JSON → HyperFrames standalone composition (6 files); `lib/hf-primitives.mjs` with 7 deterministic GSAP primitives, 10 category mappings and 6 preset eases.
- `scripts/verify-hf.mjs`: static-frame verification (check report + up to 6 snapshots + contact sheet); 7 non-zero PNG frames, `ok=true`.
- `scripts/self-test.mjs`: 60/60 offline checks (zero CLI, zero network), including byte-identical sha256 across two compilations.
- `scripts/install-local.mjs`: idempotent, reversible local DSH wiring (status / install / uninstall / verify, dry-run by default); isolated install verification 27/27.
- End-to-end demo: `examples/demo-project.json` → 1080×1920 H.264 MP4, 30fps, 468 frames, 15.6s (about 5.0MB) via `hyperframes@0.9.88` (`check`: 0 error / 7 warnings).

### Notes

- The 124 shot cards are **not** reproduced per card in this release; the automatic mapping table is planned for phase 3. No GUI workbench (phase 2) and no publishing loop (phase 3).

## [0.1.0-design] - 2026-11-24

`cc1a916` — `feat`: CineForge design draft and taste layer (v0.1.0-design).

### Added

- Design spec `docs/design/2026-11-24-cineforge-design.md`: positioning, three-layer architecture, 11-stage pipeline, workbench shape, acceptance criteria.
- `docs/工作台设计.md` (workbench panel / interaction / state-machine design with wireframes), `docs/ROADMAP.md`, `docs/RESEARCH-生态调研.md`.
- Taste layer derived from upstream `video-shotcraft` (Apache-2.0, pinned `59f3e9b9e936ff2bce0e18446226d770a3f2f61f`): `knowledge/shot-cards.json` (124 cards / 150 styles), `knowledge/motion-tokens.json`, `knowledge/aesthetic-rules.json`, `knowledge/energy-arc.json`, `knowledge/platform-presets.json`, `knowledge/storyboard.schema.json`; `upstream/catalog.json` as the single source of truth.
- `skills/` skill definitions, `examples/`, `package.json` / `cordis.patch.yml`, `spec.json`, `LICENSE` (Apache-2.0) and `NOTICE` (upstream attribution chain).

### Notes

- Design / documentation phase only; no runtime wiring yet.

## Commit references

- `cc1a916` — https://github.com/HJ-Create-World/dsh-cineforge/commit/cc1a916
- `1eb8a31` — https://github.com/HJ-Create-World/dsh-cineforge/commit/1eb8a31
- `275e10b` — https://github.com/HJ-Create-World/dsh-cineforge/commit/275e10b
- `0.3.0` — rework commit (see `git log` / the commit list on GitHub)
