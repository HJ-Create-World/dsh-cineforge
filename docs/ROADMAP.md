# CineForge 路线图

> 原则：**先让对话内可用，再补工作台，最后接发布闭环。** 每一期都有可独立交付的价值。
> 调研已定稿，结论见 [RESEARCH-生态调研.md](RESEARCH-生态调研.md)；所有外部来源单一事实源为 `upstream/catalog.json`。

## 一期 · 品味层 + 对话内技能（最快可用）

| 项 | 内容 | 状态 |
|---|---|---|
| 上游存档 | `03_Video/01_Github/02_video-shotcraft` 精确快照 + 署名 README + LICENSE | ✅ 已完成 |
| 上游清单 | `upstream/catalog.json` 单一事实源（含 18 条生态候选 `ecosystem_review` + `compliance` 段） | ✅ 已完成 |
| 拉取脚本 | `scripts/fetch-upstream.mjs`（API→codeload→tar） | ✅ 已完成 |
| 品味索引 | 124 卡 / 150 style 的 JSON + MD 索引 | ✅ 已完成 |
| 审美准则 | 27 条判例式准则结构化 | ✅ 已完成 |
| 动效 tokens | 6 预设 × 双轴 | ✅ 已完成 |
| 能量曲线 | 段位表 + 帧预算 | ✅ 已完成 |
| 平台预设 | 5 平台画幅 / 安全区（抖音底部 20% + 右侧 15% UI 留白） | ✅ 已完成 |
| 分镜契约 | `storyboard/v1`（含 `publish.ai_disclosure` 显式/隐式双标识） | ✅ 已完成 |
| 三技能 | director / cards / qa | ✅ 已完成 |
| 设计文档 | 总纲 / 工作台 / 路线图 / 生态调研 | ✅ 已完成 |
| 插件市场与生态调研 | 无同名插件、HyperFrames 定位、MotionHarness 判定、发布链路合规 | ✅ 已完成 |
| 三读协议与署名链 | cards 技能固化三读协议；4 份 ATTRIBUTION 保留；director 加合规硬门 | ✅ 已完成 |
| **运行时接线** | npm 包骨架（`package.json` 的 dsh 字段 + `cordis.patch.yml`）、`ctx.skills.register`、HyperFrames 编译适配器、静帧验收脚本、离线自检、本机接线脚本 | ✅ 已完成（0.2.0 runtime，0.3.0 返工） |
| **一期补齐（生态结论）** | 双画幅预设 + 安全区、ffmpeg 抽 poster、SRT/硬字幕、whisper.cpp / librosa / subtitle.js / wavesurfer.js / dotLottie-web 接入、AI 标识元数据 | ⬜ 待实现 |
| **端到端验证** | 用一句 idea 跑通到 MP4 + 终检报告 | ✅ 已完成：0.3.0 demo 渲染 H.264 / 1080×1920 / 30fps / 600 帧 / 20.0s + AAC 音轨；静帧验收 7 帧全通过；0.2.0 独立 QA 终检【打回】→ 已返工，二次终检（见下） |
| **终检返工（0.3.0）** | 音轨 + 两个功能镜头 + 发布合规 + 14 条工程缺陷（6 版式 / 单一事实源 / 时长恒等 / 去 CDN / 钉 registry / 首帧非空 / 安全区 px 化） | ✅ 已完成：check 全组 0 error / 0 warning（仅 7 条结构 lint warning 属二期）；self-test 86/86；仍 NOT FOR PUBLISH |
| **二次独立终检（0.3.0）** | 干净上下文独立 subagent 重跑 27 条判例 | ✅【有条件通过】仅一期内部归档 / 模板可用性口径；按可发布成片口径仍打回。✓14 / ✗8 / N/A5，P1/P2 登记二期，冻结静帧基线 |

**一期验收（实测）**：在 DSH 对话里说「给我的 XX 做个 45 秒抖音视频」，技能自动触发 → 分镜确认 → 输出 MP4 + 终检报告。

编译器链路已在 `examples/demo-project.json` 上端到端跑通：`compile-hf.mjs`（8 文件 + 本地 GSAP / 音频资产）→ `verify-hf.mjs`（check 0 error / 7 帧静帧）→ `hyperframes render` → ffprobe 核对（H.264 / 1080×1920 / 30fps / 600 帧 / 20.0s / 3.0MB + AAC 48kHz 立体声）→ `hyperframes audio --json`（−19.4 LUFS / −1.2 dBTP / 0 clipping，已测量未试听）。`self-test.mjs` **86/86**、`install-local.mjs verify` **27/27**（隔离 profile 真实 `npm pack` → `npm install` → import，以及 live `desktop` profile）。

**运行期接线（已完成）**：用户 m00741 授权后，已把插件装进 live `desktop` profile（`install-local.mjs install --apply` + `pnpm install` 落地 symlink），用真 node 跑 `install-local.mjs verify` 得 **27/27**，`imported_from` 指向 `node_modules/dsh-cineforge`，技能注册确认。备份在 `.local/profile-backup/desktop-before-install-*.json`；一键回滚 `node scripts/install-local.mjs uninstall --apply`。**GUI**：本版是对话内技能，**无图形界面**（`package.json` 无 `dsh.client` / `./client` 导出），独立工作台排二期。

**插件落地形态（已实测）**：DSH 插件 = npm 包，声明全在 `package.json` 的 `dsh` 字段，靠 `cordis.patch.yml` 的 `- insert:` 行加载；能力用 `ctx.skills.register` / `ctx.tools` 注册；Web UI 另用 `exports["./client"]` + `ctx.slots.inject`。客户端 HMR 走 `/plugins/events` SSE（需 `pnpm run dev:web` + watcher，Electron 不走此路）。安装：`dsh plugin --profile desktop add <spec>`。

## 二期 · 独立视频创作工作台

- [ ] **A 方案（推荐）**：DSH 原生侧栏面板 `ctx.slots.inject("sidebar.panellist", …)` + `ctx.slots.inject("main", …)`，实证 `PF/node_modules/dsh-hyperframes/lib/client.js:137,2528-2529`
- [ ] B 方案（备选）：iframe 页 `ctx.sidebarRight.openTab("browser", {params:{url}})`
- [ ] C 方案（二期后）：独立本地页 + 本地服务，**不另起替代 DSH Web GUI 的服务器**
- [ ] `project.json` 双向同步（对话 ↔ 工作台）
- [ ] 四面板：A Idea / B 分镜板主舞台 / C 镜头库 / D 底部条（含 AI 标识确认）
- [ ] 分镜卡拖拽重排、时长拉伸、能量曲线可视化
- [ ] 镜头库动态预览接入上游 gallery media
- [ ] 确认门的硬约束（未放行不可渲染）
- [ ] 静帧验收墙 + 终检报告可视化
- [ ] **借鉴 MotionHarness 自研**：可编辑参数工程 + 时间/区域批注 + checkpoint/版本（不复制不捆绑其代码）
- [ ] 可选：链接上游 Motion Workbench 做成片后多轨微调

## 三期 · 发布闭环与映射表

- [ ] 124 张卡 → HyperFrames registry block / keyframes 的自动映射表（工作量最大、收益最高）
- [ ] 剪映工程导出适配（上游 `jianying-export/` 按平台模块复用）
- [ ] B 站投稿适配器 `biliup`（MIT，用户自装，dry-run + 显式确认 + requestId 幂等）；抖音只给手动上传指引（OpenAPI 需机构认证）
- [ ] 平台尺寸封面自动生成（ffmpeg -ss 抽最强定格帧）
- [ ] 竖屏 / 横屏双版本一次分镜两次渲染（重构图，非拉伸）
- [ ] 配音 / 口播链路（可参考上游姊妹项目 video-talkcraft）
- [ ] ⏳ MotionHarness 外部适配器：仅用户自装且等其许可稳定（CLI 许可 Apache→UNLICENSED→GPL-3.0 反复、无公开源码）

## 发布合规（硬约束，三期发布闭环必须落地）

《AI 生成合成内容标识办法》2025-09-01 施行，须**显式 + 隐式双标识**；阶段 10 确认弹窗「AI 双标识未勾全不得提交」。另需 BGM/字体商用授权台账、广告法极限词检查、内容审核（《网络短视频内容审核标准细则》）、数据安全（无客户/个人/内部/密钥/实时数据）。完整 URL 见 [RESEARCH-生态调研.md](RESEARCH-生态调研.md) §4 与 `upstream/catalog.json` 的 `compliance` 段。

## 商店上架（dshmarket，用户 m00806 明确）

- 机制：DSH 无官方商店；dshmarket 只是客户端，目录来自 `awesome-dsh-plugin/awesome-dsh-plugin` 的 `data/plugins/`。「上架」= 向该列表提 YAML PR；也可先在市场设置加**本地私有 catalog**（写本地 `plugins.json`）即时看到卡片。
- 材料已备：`store/HJ-Create-World__dsh-cineforge.yml`（DRAFT）、`docs/PUBLISH-商店上架指南.md`、`README.en.md`、`assets/plugin-icon.png`、`screenshots.json`；GitHub topics 已加（含 `dsh-plugin`）。
- **尚未提 PR**。P0 时间硬门：仓库 `created_at=2026-11-24T08:32:43Z`，须等 **2026-11-25 16:32:43 +08:00** 后；提 PR 是用户之后的动作（Fork → 建分支 → 复制草稿删 DRAFT 头 → 提 1 条 PR）。
- 边界：示例成片经独立终检 **NOT FOR PUBLISH**，与「插件能否被列表收录」是两件事；description 不得宣称成片能力 / Opus 级设计感已实现 / 124 卡逐卡可用。

## 状态说明（原「待用户拍板」已随本次工作推进）

1. **插件名与 GitHub 仓库名** → 已定为 `CineForge 影铸` / [`HJ-Create-World/dsh-cineforge`](https://github.com/HJ-Create-World/dsh-cineforge)（公开仓库已创建）。如要改名请告知。
2. **公开 / 私有** → 已按 m00001「你可以在 github 上创建新的仓库」建为 **public**。
3. **一期先做「对话内技能」还是先做「独立工作台」** → 用户 m00198 已确认：**先对话内技能优先**（一期已按此落地）。
4. **是否投入做 124 卡 → HF 的自动映射表** → 用户 m00198 已确认：**三期再做**（一期只用 7 个确定性原语 + 10 类映射，不追求逐卡精确映射）。

## 生态候选（已调研定稿）

见 [RESEARCH-生态调研.md](RESEARCH-生态调研.md) 与 `upstream/catalog.json` 的 `ecosystem_review`（18 条，全部 `bundled:false`）。判定摘要：

- **一期纳入**：HyperFrames（唯一渲染运行时）+ video-shotcraft（配方卡/分镜方法）+ dotLottie-web / subtitle.js / whisper.cpp / librosa / wavesurfer.js（MIT/BSD/ISC）+ GSAP（确认免费条款后沿用）+ biliup（用户自装）。
- **暂缓**：Remotion（自定 License、企业需 Company License，与 HF 二选一勿并存）、Manim、抖音 OpenAPI、Motion Canvas / Revideo。
- **不引入**：Reactive Video / audioMotion-analyzer（GPL/AGPL 传染）、Framer Motion（GSAP 已覆盖）。
- **只借鉴、不捆绑**：MotionHarness「可编辑参数工程 + 时间/区域批注 + checkpoint/版本」设计。

任何新上游**必须先登记 `upstream/catalog.json` 再引入**，并记录精确 SHA 与 License。
## 二次独立终检结论（0.3.0，2026-11-25 · 当前口径）

完整报告：[QA-一期返工终检报告.md](QA-一期返工终检报告.md)。**总判【有条件通过】**，仅限「一期内部归档 / 模板可用性验收」口径；按「可发布成片」口径仍应为【打回】。这不是「终检通过」。

- 27 条 ✓14 / ✗8 / N/A5（0.2.0 基线 ✓7 / ✗14 / N/A6）；旧 14 条 ✗ 已修复 1 / 部分修复 11 / 未修复 2（Q5 开场多主角、Q8 收尾非合影峰值）。
- P0 发布合规未解除：`publish.ai_disclosure` 显式 + 隐式仍 false，标题 / 描述 / 封面 / 标签全空，`publish_allowed:false` → **NOT FOR PUBLISH 保持**。新增的 aigc 载体不等于合规完成。
- **登记为二期整改**（不掩盖、不在本轮继续改，以冻结静帧基线）：
  - P1 音频试听 / 带无 BGM 两版 / `S5` AAC priming 偏移实测 / `S4` 长音效按画面段落等长裁切。
  - P1 收尾「发布会合影」峰值整镜重做、开场收敛为单主体完整动作弧（Q8 / Q5）。
  - P2 功能镜头真实截图或出版级排版、`mini-card .meta` 提到 ≥32px 并取消逐字折行（Q1 / Q10 / Q11）。
  - P2 竖屏字高档位口径写入项目说明、8 条 ✗ 补「有意识违反 + 原因」登记；`out/` 整包外发前脱敏（已 gitignore，不入库）。
  - P3 7 条 lint warning 的子组合改造（`data-composition-src`）、主标语具体化、无旁白 / 硬字幕口径。
- 如实定性：仍是字卡模板片；`check 0 error` 只证明模板渲染没坏，不证明好看。差距是内容证据与设计层级，需整镜重做。音频「已测量，未试听」（−19.4 LUFS 偏安静）。

## 独立终检结论（0.2.0，2026-11-24 · 历史归档）

> 以下是对**旧 5 镜 15s 静音片**的判定，已按结论在 0.3.0 逐项返工；返工后的二次独立终检见 [QA-一期返工终检报告.md](QA-一期返工终检报告.md)。下表缺陷「去向」栏的「一期补齐」大部分已在 0.3.0 落地（单一事实源 / 时长恒等 / 制作元数据不烧进画面 / 去 CDN / 钉 registry / timelines 兜底 / 6 版式），仍属二期的只剩子组合与字高档位口径。


完整报告：[docs/QA-一期终检报告.md](docs/QA-一期终检报告.md)（干净上下文独立 subagent，27 条判例逐条判定）。

- **总判：打回**。27 条中 ✓7 / ✗14 / N/A6；14 条 ✗ 无一写入「有意识违反 + 原因」，按规范全部计缺陷。
- **P0 阻断发布**：`publish.ai_disclosure` 显式 + 隐式双标识均 `false`；BGM/字体授权、无极限词自检、封面/标题/描述/标签全空。结论：**这支片子只能内部看，不能发 B 站/抖音**。
- **P1**：全片 0 音轨（`film_silent`，带/无 BGM 两版仅渲 1 版）；两个核心卖点「124 张镜头配方卡」「分镜确认门」只以文字宣称、无功能镜头；收尾标 `peak` 实为最弱 `fade`、无发布会合影；能量曲线 `opening(low)→function(mid-high)→breath(low)→outro(peak)` 未落地（s02/s03 连续 mid-high 无呼吸位）；5 条 grid 全为 `ease:"none"` 匀速、末帧静止 **0f**（R2 要求 ≥15f settle）。
- **达标项**：R1 两处品牌字标 hold 71f / 63f（≥30f）；抖音安全区 `pb=730px≥384`、`pr=324px≥162`；代码级确定性（无 `Date.now`/`Math.random`/运行时数据请求、恰好一个 `paused` timeline 注册 `window.__timelines["main"]`）；工程验收 `0 error / 7 warning / 7 帧非零`、对比度 25/25；数据安全通过（全虚构占位文案）。
- **如实定性**：这是「一期品味层 / 模板可用性」的占位式样片（纸墨琥珀 + 字卡 + 网格，5 镜同模板），不是成片。离 Opus 级设计感差的是**内容证据与设计层级**（真实产品截图、复杂光影片段、出版级排版、镜头语言），不是差一点调色。`check 0 error` 只证明契约合规，不证明好看。
- **NOT FOR PUBLISH**：任何面向 douyin 的提交、预览或分发都不在放行范围内；仅可作内部管线验收基线归档。

### 终检发现的工程 / 契约缺陷（已登记，未在本版修改源码）

| 缺陷 | 证据 | 去向 |
|---|---|---|
| 分镜 `15s / 450f` → manifest `15.6s / 468f`、s05 `60f→78f` 未写入项目说明 | `examples/demo-project.json` vs `out/cineforge-demo-01/manifest.json` | 一期补齐：单一事实源对齐或显式记录偏离 |
| `transition_in` 与 `primitive` 口径漂移 3 处：s01 `fade` vs `crash-zoom`、s04 `fade` vs `slide-up`、s05 `hidden-cut` vs `fade` | 同上 | 一期补齐 |
| brief「Opus 级」vs s02「导演级」措辞不一致 | `examples/demo-project.json` | 一期补齐：文案统一 |
| Q11 竖屏字高口径矛盾：判例绝对值 ≥56px 与相对值 ≥5.2% 帧高（1920→100px）不可同时成立 | `knowledge/aesthetic-rules.json` Q11 | 一期补齐：`platform-presets.json` 补 9:16 字高档位 |
| 制作元数据（`card_id · primitive`、分镜 `action` 原文）烧进画面 | `out/cineforge-demo-01/index.html` | 一期补齐：可见文本只渲染 caption |
| GSAP 3.15.0 走 CDN 未 vendor；`hyperframes.json` registry 指向 `main` 未钉 commit；`window.__timelines` 无 `|| {}` 兜底；`deterministic_seed_required:true` 但产物无 seed 字段 | `index.html` L7 / `hyperframes.json` L3 / L131 | 二期：可复现性加固 |
| 5 镜同版式、子组合建议 warning ×5 + `timeline_track_too_dense` ×1 | `verify.json` warnings | 二期：父 index.html + `data-composition-src` 子组合 |
| 外发整包前需脱敏 `video-state.json` / check 报告中的本机绝对路径与 `.local/state/gh/device-id` | `out/` 工程产物 | 交付前清理清单 |
