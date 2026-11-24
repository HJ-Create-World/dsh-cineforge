# CineForge 影铸 · AI 视频导演台

> 一个 DSH 视频创作增强版插件：让普通模型驱动的视频创作，也有 Opus 模型的设计感。
> 把一句 idea 扩写成视频文案，排成可确认的分镜，配上调校过的动效，输出高质量成片，并可发到 B 站 / 抖音。

GitHub：[HJ-Create-World/dsh-cineforge](https://github.com/HJ-Create-World/dsh-cineforge) · 上游：[video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)（Apache-2.0）

## 当前状态：runtime 0.2.0（已接线，可跑通到 MP4）

> 设计阶段（0.1.0-design）已于 2026-11-24 经用户批准收尾；本版是**运行时接线版**。

| 能力 | 落地 | 实测结果 |
|---|---|---|
| 技能注册 | `lib/index.js` + `lib/skill-loader.js`：3 个技能经 `ctx.skills.register` 注册，`resourceBase` 指向插件根 | `scripts/self-test.mjs` 60/60；隔离安装 `npm pack` → `npm install` → 真实 import 27/27 |
| 分镜编译 | `scripts/compile-hf.mjs` 把 `cineforge/storyboard/v1` 编译成 HyperFrames standalone 组合（6 文件） | `hyperframes@0.9.88 check` 0 error（7 warning 均属二期子组合 / 示例无音轨） |
| 静帧验收 | `scripts/verify-hf.mjs`：check 报告解析 + 最多 6 个时间点 snapshot + contact-sheet 拼图 | 7 帧 png 全非零字节，`ok=true` |
| 成片渲染 | `npx --yes hyperframes@0.9.88 render` | `examples/demo-project.json` → `renders/cineforge-demo-01.mp4`；ffprobe：H.264 / 1080×1920 / 30fps / 468 帧 / 15.6s / 5.0MB |
| 离线自检 | `scripts/self-test.mjs`（零 CLI、零网络） | 60/60，含两次编译逐字节 sha256 相同（确定性渲染） |
| 本机接线 | `scripts/install-local.mjs`：status / install / uninstall / verify，幂等、可回滚、默认 dry-run | 隔离 profile 上 install → 幂等 → uninstall 全通过，备份齐全 |

**尚未执行的一步**：把插件装进正在运行的 `desktop` profile（`node scripts/install-local.mjs install --apply` 后重载 profile / 重启 DSH）。这一步会触发 `patchReload: live`、可能打断当前 GUI 会话，故未擅自执行；一键安装与一键回滚脚本都已备好（见「安装到 DSH」）。

## 快速开始（运行时）

```bash
# 0. 离线自检（零依赖，秒级）
npm test                         # scripts/self-test.mjs：60/60

# 1. 分镜源：examples/demo-project.json（cineforge/storyboard/v1，抖音 9:16，5 镜）
#    真实使用由 cineforge-director 技能在对话中产出，并须经过分镜确认门

# 2. 编译成 HyperFrames 工程（零依赖 ESM，输出 6 个文件到 out/<id>/）
node scripts/compile-hf.mjs --project examples/demo-project.json --out out/cineforge-demo-01

# 3. 静帧验收（check + snapshot + 拼图，自动出 JSON 报告）
node scripts/verify-hf.mjs --out out/cineforge-demo-01
#    → out/qa/cineforge-demo-01.verify.json（ok=true）

# 4. 渲染 MP4（只在用户确认后执行；本机实测约 4 分 22 秒 / 468 帧）
cd out/cineforge-demo-01
npx --yes hyperframes@0.9.88 render --output renders/cineforge-demo-01.mp4 --quality draft --fps 30 --workers 2

# 5. 核对成片参数
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,duration -of json renders/cineforge-demo-01.mp4
```

编译器的确定性保证：禁 `Date.now()` / `Math.random()`、固定种子、每镜只讲一个主动效、末镜自动补 0.6s 收尾留白（上游审美准则 R1/R2），并自动按平台安全区布局（抖音底部 20% + 右侧 15% UI 留白）。

## 安装到 DSH

```bash
# 正式分发（推荐：走 npm 包 / git URL）
dsh plugin --profile desktop add HJ-Create-World/dsh-cineforge

# 本机开发（源码 link，改动即时生效）
node scripts/install-local.mjs status                 # 默认 dry-run，只看不改
node scripts/install-local.mjs install --apply      # 写入前自动备份到 .local/profile-backup/
node scripts/install-local.mjs verify               # 真实 import 已安装位置，27 项校验
node scripts/install-local.mjs uninstall --apply    # 一键回滚
```

插件的 `cordis.patch.yml` 由宿主在加载 bundle 时自动合并（`package.json` 的 `dsh.bundle.patch`），**不需要**写进 profile 的 `cordis.patch.yml`。安装脚本只改 `package.json` 的 `dependencies` 与 `dsh.profile.bundles` 两处。安装后重载 profile，DSH 对话里即出现 `cineforge-director` / `cineforge-cards` / `cineforge-qa` 三个技能与 `cineforge_health` 自检工具。

## 交付物

| 文件 | 说明 |
|---|---|
| `docs/design/2026-11-24-cineforge-design.md` | **设计总纲**：定位、三层架构、11 阶段流水线、工作台形态、验收标准 |
| `docs/工作台设计.md` | 独立视频创作工作台的面板 / 交互 / 状态机设计（含线框） |
| `docs/ROADMAP.md` | 分期路线图：一期可用、二期工作台、三期发布闭环 |
| `docs/RESEARCH-生态调研.md` | **调研定稿**：插件市场（无同名插件）、HyperFrames 定位、MotionHarness 判定、动效生态分期、B站/抖音发布合规 |
| `package.json` / `cordis.patch.yml` | DSH 插件清单与组合包补丁（`dsh.bundle.patch`） |
| `lib/index.js` / `lib/skill-loader.js` | 插件入口：3 技能注册 + `cineforge_health` 工具 + 卸载清理 |
| `lib/hf-primitives.mjs` | 7 个确定性 GSAP 动效原语 + 10 类镜头映射 + 6 预设缓动 |
| `lib/hf-template.html` / `.css` / `hf-shot.html` / `hf-timeline.js` | HyperFrames standalone 组合模板（占位符替换） |
| `scripts/compile-hf.mjs` | 分镜 JSON → HyperFrames 工程编译器 |
| `scripts/verify-hf.mjs` | 静帧验收：check 报告 + snapshot + contact-sheet + JSON 报告 |
| `scripts/self-test.mjs` | 完全离线的 60 项自检（含确定性 sha256 比对） |
| `scripts/install-local.mjs` | 本机接线：幂等安装 / 状态 / 校验 / 回滚 |
| `scripts/fetch-upstream.mjs` | 按 catalog 精确拉取上游快照（API 取 SHA → codeload tar.gz） |
| `scripts/build-card-index.mjs` | 从上游配方卡重建品味索引（幂等、可重跑） |
| `examples/demo-project.json` | 端到端示例分镜（抖音 9:16，15s，5 镜） |
| `skills/cineforge-director/` | **导演技能**：idea → 分镜确认 → 成片的状态机与阶段约束 |
| `skills/cineforge-cards/` | **镜头卡技能**：124 张配方卡的检索与三读协议 |
| `skills/cineforge-qa/` | **终检技能**：干净上下文独立 subagent，27 条判例逐条核对 |
| `knowledge/shot-cards.json` / `.md` | 124 张卡 / 150 个 style 的机器可读品味索引（派生自上游） |
| `knowledge/motion-tokens.json` | 品牌 → 动效参数表（6 预设 × 2 轴） |
| `knowledge/aesthetic-rules.json` | 判例式审美准则的机器可读版（R/Q/S/C/P 共 27 条） |
| `knowledge/energy-arc.json` | 6 段能量曲线 + 帧预算 |
| `knowledge/platform-presets.json` | B 站 / 抖音 / 小红书 / YouTube / 视频号的画幅与安全区预设 |
| `knowledge/storyboard.schema.json` | 分镜 JSON 契约（插件各层之间的唯一事实源） |
| `upstream/catalog.json` | **上游单一事实源**：精确版本、许可、引入方式、18 条生态评估、合规段 |
| `spec.json` | 机器可读项目规格 |
| `LICENSE` / `NOTICE` | Apache-2.0 与上游署名声明 |

## 规格

- **类型**：DSH 插件（npm 包 + `cordis.patch.yml` + `ctx.skills.register`），非独立应用
- **版本 / 状态**：0.2.0 / runtime（已接线、可跑通到 MP4）
- **主渲染后端**：HyperFrames（DSH 内置 `dsh-hyperframes` 0.14.1；CLI 钉 `hyperframes@0.9.88`），运行时依赖，不 vendor
- **次渲染后端**：Remotion（自定 License，仅用于复刻上游调校过的 TSX 镜头，**本插件不分发**）
- **上游**：[video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)，Apache-2.0，作者 Wei Yihao，锁定 SHA `59f3e9b9e936ff2bce0e18446226d770a3f2f61f`
- **上游存档位置**：`03_Video/01_Github/02_video-shotcraft`（保持原始结构，未重构，保留 LICENSE）
- **知识规模**：124 张镜头配方卡 / 150 个动效 style / 10 个类别
- **流水线**：11 阶段，唯一硬确认节点在「分镜放行」
- **成片规格**：默认 1920×1080 @ 30fps；竖屏平台 1080×1920；确定性渲染（固定种子）
- **分镜契约**：`cineforge/storyboard/v1`，SHOTS 为唯一事实源

## 重跑与重建索引

```bash
# 精确拉取上游快照（本机直连 git clone github.com:443 常失败，走此脚本）
node scripts/fetch-upstream.mjs --id video-shotcraft

# 从上游配方卡重建品味索引（幂等）
node scripts/build-card-index.mjs --src "../../01_Github/02_video-shotcraft" --out knowledge

# 校验索引完整性（应为 124 cards / 150 styles）
node -e "const j=require('./knowledge/shot-cards.json');console.log(j.card_count,j.style_count)"
```

## 素材来源

本插件是「外部知识 + 自己设计」的二创项目，按工作区规范置于 `03_Video/02_MyWork`。所有外部素材逐条登记如下，**完整机器可读版本见 [upstream/catalog.json](upstream/catalog.json)**：

| 来源 | 地址 | License | 引入内容 | 用途 |
|---|---|---|---|---|
| video-shotcraft | https://github.com/Vincentwei1021/video-shotcraft | Apache-2.0 | `references/shots/*.md` 124 张卡、`aesthetic-rules.md`、`pipeline.md`、`sequences/promo-energy-arc.md`、`gallery/api/library.json` | 派生为 `knowledge/*.json` 品味层；每张派生文件头部保留作者与出处 |
| HyperFrames | DSH 内置 | — | 仅运行时依赖 | 主渲染与编排引擎 |
| Remotion | https://github.com/remotion-dev/remotion | Remotion License | 仅作为可选后端提及 | 复刻上游 TSX 镜头 |

**署名链**：video-shotcraft (c) Wei Yihao，Apache-2.0。派生知识文件均保留 `attribution` 字段；许可证全文见 [LICENSE](LICENSE)，声明见 [NOTICE](NOTICE)。上游仓库的 LICENSE 在其存档目录中保留未删。

**署名链不可断**：`references/shots/ATTRIBUTION.md`（38 张卡逐卡来源映射 + 法律边界）、`assets/audio/ATTRIBUTION.md`、`template/public/audio/ATTRIBUTION.md`、`assets/readme/sponsors/ATTRIBUTION.md` 共 4 份须随存档原样保留 —— 卡片文件自身不带来源标注。检索须走**三读协议**（校验「卡名·样式名」→ 读卡 → 按 `reference_impl` 读准确 demo TSX → copy `assets/lib/**`），参数真相在 demo 而非卡片文字，依据上游 `SKILL.md:146` / `pipeline.md:211` / `final-review.md` S2。

## 调研结论与生态边界

完整版见 [RESEARCH-生态调研.md](docs/RESEARCH-生态调研.md) 与 `upstream/catalog.json` 的 18 条 `ecosystem_review`：

- **插件市场**：无 video-shotcraft 同名插件；官方无插件索引（发现页只列用户添加的索引源），实际市场为第三方 dshmarket。约有 100 个 video-ish 插件，但 HyperFrames 只回答「怎么渲」，不回答「拍什么、为什么、按什么顺序、怎么判断好不好」—— CineForge 的导演大脑生态位为空。
- **HyperFrames**：多轨实体导演台 + 模板素材库 + CLI/FFmpeg 本地 MP4 完整，但 `docs/USAGE.md` 明确「尚不提供时间轴编辑、字幕转写、TTS 或云端渲染」。CineForge 补一期：SRT/硬字幕、whisper.cpp、librosa beat、wavesurfer 波形、dotLottie-web。
- **MotionHarness 帧驭**（用户点名）：产品真实（npm `@motionharness/cli` / `sdk` v0.1.8、B站 BV1uUW36kEpC），但 GitHub 组织 `MotionHarness` public_repos=0、npm 声明仓库与早期 VibeMG 均 404，**查无公开源码**；CLI 许可 Apache-2.0 → UNLICENSED → GPL-3.0-only 反复。结论：**只借鉴「可编辑参数工程 + 时间/区域批注 + checkpoint/版本」自研，不复制不捆绑代码**；未来外部适配器仅用户自装且等许可稳定。
- **暂缓 / 不引入**：Remotion（企业需 Company License，与 HF 二选一勿并存）、Motion Canvas / Revideo / Manim、抖音 OpenAPI（需机构认证）、Reactive Video / audioMotion-analyzer（GPL/AGPL 传染）、Framer Motion（GSAP 已覆盖）。
- **发布合规硬约束**：《AI 生成合成内容标识办法》2025-09-01 施行，成片须**显式 + 隐式双标识**；阶段 10 确认弹窗「AI 双标识未勾全不得提交」。另需 BGM/字体商用授权台账、广告法极限词检查、内容审核、数据安全。抖音 9:16 1080×1920（底部 20% + 右侧 15% UI 安全区）、B站 16:9 1920×1080，双预设**重构图非拉伸**；B站投稿用 `biliup`（MIT，用户自装，dry-run + 显式确认 + requestId 幂等），抖音一期只给手动上传指引。

## 本机踩坑备忘

1. **git clone github.com:443 连不上**：本机 `git clone` / `curl` 直连常失败，但 `api.github.com` 与 `codeload.github.com` 可达。解法：API 取 `default_branch` → `commit.sha` → codeload 按 SHA 拉 tar.gz → `tar -xzf`。已封装进 `scripts/fetch-upstream.mjs`。
2. **JSDoc 里写 glob 会炸**：`build-card-index.mjs` 注释里写 `references/shots/**/*.md`，其中 `*/` 提前闭合了块注释，导致 `SyntaxError: Unexpected token '*'`。解法：注释里不要写 `**/`，改写成「下的配方卡」。
3. **PowerShell 中文编码**：落盘统一用 `[System.IO.File]::WriteAllText` + UTF8 无 BOM；`Set-Content` / `Out-File` 在中文环境会写 BOM 或 GBK。本项目改用 Node `fs.writeFileSync` 绕过。
4. **工作区编号**：`03_Video/02_MyWork` 下已有 `01_world-execute-ascii`，故本项目顺延为 `02_cineforge`；桶内编号独立，不与 `01_Github` 对齐。
5. **HyperFrames check 报告路径**：0.9.88 的 `check` stdout 不一定打印 `Report: <path>`，但报告落在 `.hyperframes/artifacts/checks/<uuid>.json`；`verify-hf.mjs` 已改为按 mtime 取该目录最新 JSON 兜底。
6. **TMPDIR 为空**：本环境 `os.tmpdir()` 在 run_code 子进程里可能拼成 `undefined/temp`；隔离验证统一放项目 `.local/`（已 gitignore）。

## 快速理解

一句话：**HyperFrames 回答「怎么渲」，CineForge 回答「拍什么、为什么这么拍、按什么顺序、怎么判断好不好」。**

普通模型做视频翻车，通常不是不会写代码，而是没有导演判断：方向没定就开渲、动效堆满每一帧、开场多主角群舞、品牌字标一闪而过。上游 video-shotcraft 把这些判断沉淀成了 124 张配方卡和一套判例式审美准则。CineForge 把这份「品味」抽出来，做成与渲染引擎无关的知识层，再套上一层带确认节点的导演状态机，最后落到 HyperFrames 上执行。

详见 [设计总纲](docs/design/2026-11-24-cineforge-design.md)。
## 独立终检结论（0.2.0，2026-11-24）

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
