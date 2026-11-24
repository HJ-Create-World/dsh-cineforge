# 生态调研：插件市场、动效项目与发布工程现实

> 调研日期：2026-11-24 · 全程只读 · 结论供 CineForge 分期决策使用。
> 本文是 [ROADMAP.md](ROADMAP.md) 中「生态候选」一节的依据。**任何新上游必须先登记 `upstream/catalog.json` 再引入。**

## 一、当前插件市场里有没有 video-shotcraft 或类似插件？

**结论：没有同名插件；有大量「类似」但职责不同的视频插件；CineForge 的生态位仍然空着。**

| 判定 | 证据 |
|---|---|
| 无 `video-shotcraft` 同名插件 | 用户目录全文搜 `shotcraft` 命中 0；内置运行时 `desktop-runtime.json` 的 20563 文件里 `shotcraft` / `hyperframes` / `remotion` 均 0 |
| 有大量视频类插件 | 第三方市场目录 5000 包中约 100 个 video-ish：`dsh-hyperframes` 0.14.1、`dsh-remotion` 0.13.1、`dsh-video-editor`、`dsh-video-pipeline`、`dsh-motion`、`dsh-reel-studio`、`dsh-video-storyboard`、`dsh-longshot`、`dsh-artcraft-plugin-filmcraft` 等 |
| 本机已装 | `dsh-hyperframes`（PF `package.json` 30 依赖 / `dsh.profile.bundles` 38 项），另有 `dshmarket`、`dsh-blender-plugin`、`dsh-univer-office`、`billion-context`、`dsh-mnemon` 等 |

### 市场机制（重要事实）

- **官方没有插件索引**：`dsh-experimental-plugin-market-bundle/README.zh.md` 原文「目前没有官方插件索引；发现标签页只列出用户添加的索引源」；`dsh-plugin-market` 的 `indexes: []` 默认空，用户添 http(s) URL 前不发请求。
- 实际市场是第三方 [dshmarket](https://dshmarket.com)（1.80.1），目录源 `https://awesome-dsh-plugin.com/plugins.json`（`PF/node_modules/dshmarket/lib/regions.js` 常量 `CATALOG_OFFICIAL`，`PF/.dsh-market/log.ndjson` 实证），README 称 12,000+ 插件；只读快照 `PF/.dsh-market/discovery-compatibility-v1.json`。
- 内置可选 15 个（inspector / auto-review / plugin-market-bundle / forge / cot / session-titles / recommendations / chat-import 等）**无视频类**。

### 插件形态（决定 CineForge 怎么落地）

| 项 | 事实 |
|---|---|
| 本质 | profile 的**组合包（bundle）**，即 npm 包；无独立 `plugin.json` / manifest 作准 |
| 声明 | 全在 `package.json` 的 `dsh` 字段：`dsh.bundle.patch`、`dsh.client.platform/inject`、`dsh.profile.bundles`、`engines.dsh`（`dsh-package-manifest/README.zh.md`；安装器不强校版本） |
| 加载 | `cordis.patch.yml`（YAML 数组：`- id/name/config/insert/disabled`），Launcher 按序作组合层 |
| 能力 | Cordis 行：技能 `ctx.skills.register`（`dsh-skill`）、模型工具 `ctx.tools`、MCP 经 `dsh-mcp-manager`（`config.servers`, stdio / streamable-http）、Web UI 经客户端插件 |
| 客户端 | 浏览器侧惰性 CJS（`dsh-client-modules/src/client/manifest.ts`）：bundle 只 `window.__ModuleLoader__.load({id, factory})`，Host 注入 `window.__DSH_BOOT__`；HMR 由 `dsh-client-hmr` 走 `/plugins/events` SSE（需 `pnpm run dev:web` + watcher；Electron 不走此路） |
| 安装 | `dsh plugin --profile desktop add <spec>`；`pnpm add` 写 `PF/package.json` 并追加 `dsh.profile.bundles`；开关改 `disabled`，`patchReload: live` 时 HMR 生效否则需重启 |
| 最小骨架 | npm 包 + `package.json` 的 `dsh.bundle.patch: ./cordis.patch.yml` + `cordis.patch.yml` 用 `- insert:` 插自身 Loader（导出 `name/inject/apply(ctx)`）+ `lib/index.js` 的 `apply` 注册 `ctx.skills` / `ctx.tools` / `ctx.mcpManager`；Web UI 另 `exports["./client"]` → `lib/client.js` 用 `ctx.slots.inject` |

### 独立 Web 工作台：能做，两条路都实证存在

1. **原生左侧栏面板**：`ctx.slots.inject("sidebar.panellist", …)` 注册图标 + `ctx.slots.inject("main", …)` 注册 keyed slot React 组件。实证 `PF/node_modules/dsh-hyperframes/lib/client.js:137, 2528-2529`（`docs/WORKBENCH.md`「在原生左侧栏打开工作台」）。
2. **iframe 页**：`dsh-client-ui-sidebar-browser/README.zh.md` 提供 `ctx.sidebarRight.openTab("browser", {params:{url}})`；Web 用 sandbox iframe、Desktop 用 Electron `<webview>`，接受 HTTP(S) / loopback。

→ 因此 [工作台设计.md](工作台设计.md) 的「侧边栏 iframe（一期）/ 独立本地页（二期）」是可行的，且**优先采用 `ctx.slots.inject` 原生面板**更贴合 DSH（见下「设计修正」）。

### HyperFrames 的真实定位

| 层 | 内容 |
|---|---|
| 插件 | `PF/node_modules/dsh-hyperframes/` 0.14.1，作者 STARDUSTLC666，**第三方非官方** |
| 技能集 | `skills/` 23 个 SKILL.md（官方 HyperFrames 0.9.77，9 当前 + 14 兼容名，含 `remotion-to-hyperframes` / `reverse-any-video` / `hyperframes-cli`） |
| 宿主工具 | `hyperframes_project` / `hyperframes_render` / `hyperframes_health`（`lib/index.js` 的 `inject: ["skills","tools"]` + `installMediaWorkbench`） |
| 能力 | OP-DSH 多轨实体导演台、模板 / 素材库、本地渲染 MP4（固定 CLI 0.9.77 + FFmpeg）、13 主题 8 字体、工程 revision / 归档；数据 `C:/Users/15056/.dsh/data/dsh-hyperframes/` |
| **局限** | `docs/USAGE.md` 明确「尚不提供时间轴编辑、字幕转写、TTS 或云端渲染」 |

> **对 CineForge 的意义**：HyperFrames 已经把「怎么渲 + 多轨工程」做得很完整，但**不回答「拍什么、为什么、按什么顺序、怎么判断好不好」**。市场上 `dsh-video-storyboard` / `dsh-plugin-shot-dev` / `dsh-longshot` 更贴近 shot 语义，但同样偏「产出物」而非「导演方法论」。CineForge 不做第二个渲染器，做这一层缺失的导演大脑，定位成立。

## 二、MotionHarness：产品真实存在，但没有可整合的开源仓库

| 判定 | 证据 |
|---|---|
| **真实产品** | 中文名「帧驭」，官网 https://motionharness.top/home ，npm `@motionharness/cli` / `@motionharness/sdk` v0.1.8，[B站发布视频](http://www.bilibili.com/video/BV1uUW36kEpC)（2026-11-10，称「完全免费」）；[中文评测](http://sign.red/posts/motionharness/) |
| 定位 | 「给 AI 用的动效 IDE」：本地 `mh` CLI + Studio 时间线 + 可编辑工程（`document.json` 存参数 / 关键帧）+ 按「时间点 + 画面区域」打标、Agent 读标记改稿；导出 MP4 / MOV(ProRes alpha) / GIF / WebP / PNG 序列 / WAV，带 checkpoint、`.vmg` 包、DaVinci 桥；需 Node 22.15+ / Chrome，配 Codex / Claude Code / Kimi Code |
| **查无公开源码** | GitHub 组织 https://github.com/MotionHarness （2026-11-12 建）`public_repos=0`；npm 声明的 `github.com/MotionHarness/motionharness` 与早期 `VibeMG/vibe-motion-graphics` 均 404。GitHub API 搜 `MotionHarness` 仅 3 仓、`"Motion Harness"` 19 仓，多 0★ 空壳 / 课程作业；代码搜 607 命中绝大多数是机器人 / iOS 的泛称 "motion test harness"，无关 |
| **许可反复、不可直接整合** | CLI 0.0.11–0.0.25 Apache-2.0 → 0.0.26–0.1.7 `UNLICENSED`（闭源二进制）→ 0.1.8 **GPL-3.0-only**；SDK 0.1.8 **MIT**。[第三方实测](https://github.com/XartLab/design-pipeline/blob/main/docs/research/motionharness-cli-comparison-2026-11-12.md)（测 0.1.5）明文：「闭源、UNLICENSED、不能随包分发、只能借想法」 |
| 同名混淆 | [Devpost 同名项](https://devpost.com/software/motionharness)（Nebius×NVIDIA Hackathon，solo Li-Yi Wei）讲「Agent 扩展动效动词库 + Lottie/AE/Blender 导出器」，形态不同，**无法证实是同一项目，如实存疑**。近似：`mad-helpers/motion-harness`（MIT 18★，HyperFrames+GSAP 的 Claude Skill）、`HariNayan/Motion-Harness`（OpenCode→HyperFrames，不渲染）、`Fectivnfy112357/Filmcraft`（打包 MotionHarness+Video Shotcraft 技能，NOASSERTION） |

**决策**：

- ✅ **借鉴设计**：「可编辑参数工程 + 时间/区域批注 + checkpoint/版本」这一层，与我们的 `project.json` / 分镜 JSON / 静帧验收高度同构，**自研**轻量实现（已在 [工作台设计.md](工作台设计.md) 与 `storyboard.schema.json` 中）。
- ❌ **不复制、不捆绑代码**：GPL-3.0-only CLI 与历史 UNLICENSED 二进制都不能随包分发。
- ⏳ 未来若做「MotionHarness 适配器」，只能做成**用户自装的外部适配器**（进程隔离调用），且需等许可稳定。**勿把同名空仓当本体。**

## 三、其他可整合的开源项目（License / 体量 / 重叠）

| 项目 | License | 体量 | 价值 / 重叠 | 结论 |
|---|---|---|---|---|
| Remotion | 自定 [Remotion License](https://www.remotion.dev/docs/license/pricing)（个人 / ≤3 人免费，企业需 Company License；自动化渲染 $0.01/次、$100/月起） | 75.3k★ | **video-shotcraft 正构建于其上**（124 配方卡 / 150 预览 / 卡点 / 剪映导出）；与 HyperFrames 是二选一运行时，勿并存 | ⏳ 二期再谈商用条款；仅复用上游模板 |
| HyperFrames | Apache-2.0 | 89k★ | 本机已装，CineForge 主后端 | ✅ 一期唯一运行时 |
| Motion Canvas | MIT | 20.2k★ | 第三运行时，重叠高 | ⏳ 暂缓 |
| GSAP | 2025 起 [100% 免费](https://webflow.com/blog/gsap-becomes-free)（Webflow 收购，3.13 起 SplitText/MorphSVG 全免费），但属 Standard License 非 OSI | 31.2k★ | **已是 HyperFrames 默认动画引擎** | ✅ 确认条款后沿用，不重复引入 |
| Lottie（lottie-web / dotLottie-web） | MIT / MIT | 32.6k★ / 958★ | 互补资产层，HyperFrames 已有 Lottie adapter | ✅ 一期纳入（MIT） |
| Manim | MIT | 42.9k★ | 数学科普垂类，渲成 footage 再合成，重叠低 | ⏳ 垂类再说 |
| Revideo（`midrender/revideo`，原 redotvideo→组织今仅剩空仓） | MIT | 4.2k★，末次提交 2026-07 | 基于 Motion Canvas，维护放缓，重叠高 | ⏳ 暂缓 |
| Reactive Video（实为 `mifi/reactive-video`，与 Redot 非一物） | **GPL-3.0** | 220★ | 传染性 + 低活跃 | ❌ 仅观察 |
| Motion（原 Framer Motion） | MIT | 35.5k★ | 仅 DOM 动画，非渲染器，GSAP 已覆盖 | ❌ 不引入 |
| 字幕 `gsantiago/subtitle.js` / `plussub/srt-vtt-parser` / `openai/whisper` / `ggml-org/whisper.cpp` | 全 MIT | 436★ / 113k★ / 55k★ | **缺口**：ASR → SRT → 烧录 / 外挂，重叠低 | ✅ 一期纳入（MIT） |
| 节拍 `librosa`(ISC 9.1k★) / `aubio`(GPL) / madmom(非标准) | 混合 | 中 | HyperFrames 已有 `hyperframes beats`，部分重叠 | ✅ 选 ISC 的 librosa |
| 音频可视化 `wavesurfer.js`(BSD-3-Clause 10.5k★) / `audioMotion-analyzer`(**AGPL** 984★) | 混合 | 中 | 优先 BSD / 自研 Web Audio | ⚠️ AGPL 慎用，改自研 |
| 转场 / 编码 | 混合 | FFmpeg 68k★ | HyperFrames registry ~400 项 + 动效蓝图已覆盖转场；FFmpeg 做抽帧 / 转码 | ✅ 已覆盖 |
| 分镜基线 `kingselyjoe/video-shotcraft-dsh`(169★) / `SAOS-3624/dsh-video-storyboard`(Apache-2.0 594★) | Apache-2.0 | — | **已有 DSH 侧移植尝试**，值得读但吸收方法而非另起 | 📖 参考 |

> 注：`kingselyjoe/video-shotcraft-dsh` 的存在说明「把 shotcraft 搬进 DSH」已有人试过；CineForge 的差异化是**引擎无关的品味层 + 11 阶段状态机 + 独立终检 + 平台/合规闭环**，不是单纯搬运技能。

## 四、B 站 / 抖音发布工程现实

### 画幅与封面

- 抖音：竖 **9:16 1080×1920**（H.264 MP4、≥8Mbps）；B 站：横 **16:9 1920×1080** 最稳，9:16 进 App 竖屏流（[对照](https://noobclaw.com/cn/blog/bilibili-video-size-aspect-ratio-2026/)）。
- **必须双预设 + 重构图（非拉伸）**：抖音留上下 UI 安全区、字幕内缩（对应 `knowledge/platform-presets.json` 的「底部 20% + 右侧 15% 留白」）。
- 封面与内页两套逻辑：抖音首推 9:16 1080×1920 或 3:4 1080×1440；B 站 16:9 小图、右下叠时长角标、文字要大。poster 用 `ffmpeg -ss` 抽最强定格帧。

### 时长与字幕

- 抖音普通权限 ≤15 分钟、B 站客服口径 ≤10 小时；但**动效片实操 15–60s**（promo 10–25s / explainer 30–60s）。
- 字幕**硬烧录保一致** + 另出 `.srt`；B 站 CC 用 BCC / JSON，开放平台字幕能力弱。

### 上传工具 / API

| 平台 | 官方 | 开源 |
|---|---|---|
| B 站 | [服务端稿件投递](https://open.bilibili.com/doc/4/f22a0eee-c92d-0f1d-f69c-be170cf533c7)（预处理 / 分片 / 合片 / 封面上传 / 提交，≤4GB，需应用 + [接口白名单](https://openhome.bilibili.com/doc/4/b2dc2f0e-c874-aed7-3d92-360929e79d3a)） | `biliup/biliup`（MIT 5.7k★，CLI 投稿 / 多 P / 边录边传）、`SocialSisterYi/bilibili-API-collect`（20k★ 逆向文档）、`Nemo2011/bilibili-api` |
| 抖音 | [内容发布接入方案](https://open.douyin.com/platform/resource/docs/ability/content-management/douyin-publish-solution) 需机构认证 / 权限申请（个人开发者受限）；[>300MB 必分片、总 ≤4GB](https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/video-management/douyin/create-video/video-part-upload) | 多走浏览器自动化：`withwz/douyin_upload`（MIT 163★）、`WJZ-P/douyin-upload-mcp-skill`（AGPL）、`lancelin111/douyin-mcp-server`（MIT），**有违反平台条款风险** |

→ 对应上游 `publish/upload_post.py` 与 `references/publish-upload-post.md` 的 dry-run / 只跑一次 / `--status` 幂等纪律，CineForge 沿用；**一期只做「导出成片 + 手动上传指引」，把 `biliup` 做成用户自装适配器**，不承诺抖音 OpenAPI 直连。

### 合规（硬约束，必须写进阶段 10 确认弹窗）

- [《AI 生成合成内容标识办法》](https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm) **2025-09-01 施行**，须**显式 + 隐式标识**（[抖音落地公告](https://trust.douyin.com/article/4011788173291140)）。
- [《网络短视频内容审核标准细则(2021)》](https://www.nrta.gov.cn/art/2021/12/15/art_110_59299.html)。
- BGM / 字体须商用授权（[擅用歌曲判赔案例](http://legalinfo.moj.gov.cn/zxxfyasf/202604/t20260429_534387.html)）；广告法极限词、转载授权、AI 人物 / 品牌虚假宣传。

→ **新增一期项**：AI 标识元数据写入导出产物 + 发布确认弹窗逐项列出「AI 声明 / 隐私 / 平台 / 文案」。这是合规刚需且零重叠。

## 五、分期结论（写回 ROADMAP）

### 一期纳入

1. **HyperFrames（Apache-2.0）为唯一渲染运行时**，吸收 video-shotcraft（Apache-2.0）配方卡 / 分镜方法。
2. 补齐**双画幅预设、安全区、poster 抽帧、硬字幕 / SRT、AI 标识元数据**（合规刚需、零重叠）。
3. 纳入 MIT / BSD 系：`dotLottie-web`、`subtitle.js`、`whisper.cpp`、`librosa`、`wavesurfer.js`。
4. 确认 GSAP 免费条款后沿用（HyperFrames 默认引擎已带）。
5. `biliup`（MIT）作**用户自装**投稿适配器。
6. **自研**轻量「可调面文件 + 时间 / 区域批注 + 版本号」层（借鉴 MotionHarness，绝不复制代码，规避 GPL / UNLICENSED）。

### 放路线图 / 暂缓

- Remotion（先谈 Company License，或仅复用 shotcraft 模板）、Manim（科普垂类）、抖音 OpenAPI 正式对接（需企业资质）、MotionHarness CLI 外部适配器（待许可稳定）。
- Motion Canvas / Revideo / Reactive Video（重叠高 + GPL / 低活跃）、Framer Motion、`audioMotion-analyzer`（AGPL，改自研 Web Audio）暂缓。

### 设计修正（由本次调研触发）

1. 工作台**优先 `ctx.slots.inject` 原生侧栏面板**（DSH 原生、体验一致），iframe 作为备选而非首选 —— 见 [工作台设计.md](工作台设计.md) 第 4 节。
2. `upstream/catalog.json` 新增 `ecosystem_review` 段登记上述候选，全部标 `status: evaluated_only` / `bundled: false`，**不假装已引入**。
3. 阶段 10 确认弹窗增加「AI 生成内容标识」勾选项。

## 六、证据说明

结论来自 GitHub REST API（`search/repositories`、`repos/*`、`orgs/*`、raw `LICENSE.md` / `SKILL.md`）、npm registry 全版本 license 字段、`web_search` 及 PowerShell `Invoke-WebRequest`（`web_fetch` 因多 provider 冲突不可用，已改用后者读官网 / 中文评测）。全程只读，未写代码、未创建文件。