# CineForge 影铸 · AI 视频导演台

> 一个 DSH 视频创作增强版插件：让普通模型驱动的视频创作，也有 Opus 模型的设计感。
> 把一句 idea 扩写成视频文案，排成可确认的分镜，配上调校过的动效，输出高质量成片，并可发到 B 站 / 抖音。

GitHub：[HJ-Create-World/dsh-cineforge](https://github.com/HJ-Create-World/dsh-cineforge) · 上游：[video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)（Apache-2.0）

## 当前状态：runtime 0.4.1（工作台能动 · animatic 预览 · 分镜体检与放行 · 已装进本机 DSH）

> 设计阶段（0.1.0-design）2026-11-24 经用户批准；0.2.0 完成运行时接线；0.3.0 按独立终检【打回】做了一期返工；0.3.2 清掉二次终检的 P1/P2 返工项；0.4.0 落地 C 阶段（参考片分析转正）+ A 阶段（工作台骨架，只读），自检 97 → 129；**0.4.1 把工作台从只读变成能动** —— 拖拽重排 / 拉时长 / 从镜头库拖卡 / animatic 预览片（2.3 秒出片）/ 分镜体检 / 确认放行 / 409 冲突面板，自检 **156/156**。

`[0.4.1]` 之后接着做 0.4.2（收口：静帧验收墙 / 终检可视化 / 发布确认弹窗 / 未保存拦截 / 只读锁定），再做 0.5.0（五条新需求界面：AI 自动分镜 + 局部改、GOAL 模式与软硬门、参考视频导入、流程存模板、明暗双主题）。

> 「二次独立终检结论」与「独立终检结论」两节保留为历史判定与整改依据。

| 能力 | 落地 | 实测结果 |
|---|---|---|
| 技能注册 | `lib/index.js` + `lib/skill-loader.js`：3 技能经 `ctx.skills.register` 注册，`resourceBase` 指向插件根 | `scripts/self-test.mjs` **97/97**；隔离 `npm pack` → install → 真实 import 32/32；**已装进 live `desktop` profile 并 32/32 复核** |
| 分镜编译 | `scripts/compile-hf.mjs`：`cineforge/storyboard/v1` → HyperFrames standalone（8 文件 + 本地 GSAP / 音频资产） | `hyperframes@0.9.88 check`：**0 error / 10 warning**（layout / motion / contrast / audio 全组 0/0；7 条结构 lint 属二期子组合 + 3 条 craft line_unread 短句可读性），均非阻断 |
| 静帧验收 | `scripts/verify-hf.mjs`：check + 最多 6 时间点 snapshot + contact-sheet | 7 帧 png 全非零、`ok=true`、`empty_frames=0`；二次独立终检【有条件通过】（仅内部归档口径），见下 |
| 成片渲染 | `hyperframes@0.9.88 render` | `examples/demo-project.json` → `renders/cineforge-demo-01_2026-11-25_14-12-40.mp4`；ffprobe：H.264 / 1080×1920 / 30fps / **600 帧 / 20.0s / 5.1MB** + **AAC 48kHz 立体声**；`hyperframes audio --json`：**−19.6 LUFS / −1.3 dBTP / 0 clipping**（峰值时刻 17.745s 落在 s06 收尾 impact，已测量、未试听） |
| 离线自检 | `scripts/self-test.mjs`（零 CLI、零网络） | **156/156**，含两次编译 10 个产物逐字节 sha256 相同 |
| 本机接线 | `scripts/install-local.mjs`：status / install / uninstall / verify，幂等、可回滚、默认 dry-run | 隔离 profile install→幂等→uninstall 全通过；live profile 已安装且技能注册 32/32 |
| **参考片分析** | `scripts/analyze.mjs` + `lib/reference-analysis.mjs` / `lib/style-fingerprint.mjs`：切镜、关键帧、拼图、调色板、明暗、运动、BPM | 20s demo：6 镜 / 18 帧 / BPM 130（真值 129）；304.8s 参考片：76 镜 / 228 帧 / 14.96 切每分 / BPM 139.5（三段稳定性 spread 0） |
| **模板提取** | `scripts/extract-template.mjs` + `lib/template-extract.mjs`：`cineforge/template/v1`，四层（风格 / 结构 / 动效 / 声音）+ slots | 真实参考片 → `knowledge/templates/template-world-search.json`，5 段结构 + 15/20/30/45s 缩放提案；`motion.cards` 恒空并标 `needs_review`（不假装能反解动效） |
| **工作台（0.4.1 能动）** | `lib/client.js`（侧栏一行 + 配对 main 面板）+ `lib/server/`（11 端点，rev CAS）+ `lib/animatic.mjs` + `lib/lint.mjs` | `/health`、`/projects`、`/project`、`/cards`、`/templates`、`/asset`、`/lint`、`/animatic`、`/gate` 全部实测 200；20s 工程 animatic `build_ms 2300`；组件级渲染冒烟 `MISS []` |

**GUI**：左侧栏「影铸工作台」一行 + 配对主面板（三栏：A 输入源 / B 分镜 / C 资源库）。**0.4.1 起可编辑**：

- **B 区**：拖动卡片重排分镜；拖卡片右边缘改单镜时长；从 C 区镜头库把卡拖进分镜板（空白处追加 / 丢到某镜上替换）；每改一次立刻本地生效，500ms 后自动存盘。
- **animatic**：点「生成预览」出 540×960 低分辨率预览片，画面是定妆帧、**时间线与声音是真的**，用来在花 4 分钟渲染之前先听节奏对不对。
- **分镜体检**：`/lint` 实时跑，error 级问题会挡住「确认放行」。
- **确认放行**：写 `gates.storyboard` 并把阶段推到 `assets`；可「撤回放行」退回可改状态。
- **409 冲突**：服务端 rev 变了会弹面板让人选「用服务端的 / 用我的覆盖 / 先不动」，服务端绝不自动 merge。

> 无法用桌面自动化点开面板截图：宿主策略拒绝向 DSH 自身窗口发送任何桌面输入（`WCU_POLICY_DENIED / HOST_INPUT_DENIED`），UI 验收只能靠 HTTP 端点 + 用户目视。这是宿主的安全边界，不是插件缺陷。

**发布到 dshmarket**：上架材料已备好（`store/` 草稿 YAML、`docs/PUBLISH-商店上架指南.md`、`README.en.md`、`assets/plugin-icon.png`、GitHub topics 已加）。**尚未提 PR** —— 仓库需满 1 天（2026-11-25 16:32 +08:00 后）并由用户手工向 `awesome-dsh-plugin` 提，这是用户之后的动作。想立即在 dshmarket 看到卡片，可在市场设置里加一个本地私有 catalog（见上架指南）。

## 快速开始（运行时）

```bash
# 0. 离线自检（零依赖，秒级）
npm test                         # scripts/self-test.mjs：156/156

# 0b. 参考片分析（需要 ffmpeg；本机已装 8.1.1，脚本会自动探测）
npm run analyze -- doctor                              # 探测 ffmpeg / ffprobe
npm run analyze -- video <参考片.mp4>                   # 切镜 + 关键帧 + 拼图 + 风格指纹
npm run extract-template -- <参考片.mp4> --id my-style   # 出 cineforge/template/v1 + Markdown

# 1. 分镜源：examples/demo-project.json（cineforge/storyboard/v1，抖音 9:16，6 镜 20s）
#    真实使用由 cineforge-director 技能在对话中产出，并须经过分镜确认门

# 2. 编译成 HyperFrames 工程（零依赖 ESM，输出 8 文件 + assets/ 到 out/<id>/）
node scripts/compile-hf.mjs --project examples/demo-project.json --out out/cineforge-demo-01

# 2b. 出 animatic 预览片（低分辨率 / 静帧驱动 / 时间线与声音真实；需要 ffmpeg）
node scripts/compile-hf.mjs --project examples/demo-project.json --animatic --out out/cineforge-demo-01
#    产物 out/<id>/animatic/animatic.mp4（20s 片约 2–3 秒出片）

# 3. 静帧验收（check + snapshot + 拼图，自动出 JSON 报告）
node scripts/verify-hf.mjs --out out/cineforge-demo-01
#    → out/qa/cineforge-demo-01.verify.json（ok=true）

# 4. 渲染 MP4（只在用户确认后执行；本机实测约 4 分 23 秒 / 600 帧）
cd out/cineforge-demo-01
npx --yes hyperframes@0.9.88 render --output renders/cineforge-demo-01.mp4 --quality draft --fps 30 --workers 2

# 5. 核对成片与音轨
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames -of json renders/cineforge-demo-01.mp4
npx --yes hyperframes@0.9.88 audio renders/cineforge-demo-01.mp4 --json
```

编译器的确定性保证：禁 `Date.now()` / `Math.random()`、固定种子 `20261124`、每镜只讲一个主动效、**SHOTS 单一事实源**（分镜显式 `primitive` 权威，编译器不再静默覆盖）、分镜声明时长与 manifest 恒等（20s / 600f，不再静默补 0.6s）、GSAP 本地 vendor 去 CDN、registry 钉 commit、`window.__timelines` 兜底、首帧非空；竖屏安全区按 px 布局（抖音 / Reels / Shorts 三平台交集 left≥120 / right≤780 / top≥288 / bottom≤1248）。音频为 BGM + 6 条钉帧 SFX，全部来自上游已核验免署名素材并复制 `ATTRIBUTION.md` 逐条署名。

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

插件的 `cordis.patch.yml` 由宿主在加载 bundle 时自动合并（`package.json` 的 `dsh.bundle.patch`），**不需要**写进 profile 的 `cordis.patch.yml`。安装脚本只改 `package.json` 的 `dependencies` 与 `dsh.profile.bundles` 两处。安装后重载 profile，DSH 对话里即出现 `cineforge-director` / `cineforge-cards` / `cineforge-qa` 三个技能与 `cineforge_health` 自检工具；**左侧栏底部同时出现「影铸工作台」一行**，点开是配对的主面板。

### 工作台怎么开

1. 侧栏「影铸工作台」一行（slot `sidebar.panellist`）→ 点开主面板（slot `main`，key 与侧栏 id 同为 `dsh-cineforge`）。
2. 主面板三栏：**A 输入源**（文字 / 视频 / 模板三 tab、把关点、安全区提示）· **B 分镜**（镜头卡、能量曲线、帧级时间轴、animatic 播放器、确认放行条）· **C 资源库**（镜头库 124 / 模板）。
3. 工程根＝工作区下的 `03_Video/02_MyWork`；每个工程一个目录（`<序号>_<kebab 名>/project.json`）。
4. 顶栏 ◐ 切明暗主题（token 覆盖，不写进 `project.json`）。

排障端点（同源，需 `Origin` 头对上）：

```bash
curl -H 'Origin: http://127.0.0.1:<port>' http://127.0.0.1:<port>/dsh-cineforge/health
curl -H 'Origin: http://127.0.0.1:<port>' http://127.0.0.1:<port>/dsh-cineforge/projects
```

`/health` 会回 `workspace_root` 与 `workspace_source`（`config` / `env` / `video-workspace` / `cwd-match` / `first-workspace` / `cwd`）——工作台列不出工程时先看这两个字段。

## 交付物

| 文件 | 说明 |
|---|---|
| `docs/design/2026-11-24-cineforge-design.md` | **设计总纲**：定位、三层架构、11 阶段流水线、工作台形态、验收标准 |
| `docs/工作台设计.md` | 独立视频创作工作台的面板 / 交互 / 状态机设计（含线框） |
| `docs/ROADMAP.md` | 分期路线图：一期可用、二期工作台、三期发布闭环 |
| `docs/RESEARCH-生态调研.md` | **调研定稿**：插件市场（无同名插件）、HyperFrames 定位、MotionHarness 判定、动效生态分期、B站/抖音发布合规 |
| `package.json` / `cordis.patch.yml` | DSH 插件清单与组合包补丁（`dsh.bundle.patch`） |
| `lib/index.js` / `lib/skill-loader.js` | 插件入口：3 技能注册 + `cineforge_health` 工具 + 卸载清理 |
| `lib/hf-primitives.mjs` | 7 个确定性 GSAP 动效原语 + 10 类镜头映射 + 6 预设缓动（v0.3：显式 primitive 权威） |
| `lib/hf-layouts.mjs` | 6 种镜头版式（title / quote / card-grid / checklist / metric / outro） |
| `lib/vendor/gsap.min.js` | 本地 GSAP 3.15.0（去 CDN 外链，产物按相对路径引用） |
| `assets/audio/` | 已核验免署名 BGM（裁 20s）+ 6 个 Mixkit SFX + 两份 `ATTRIBUTION.md` |
| `lib/hf-template.html` / `.css` / `hf-shot.html` / `hf-timeline.js` | HyperFrames standalone 组合模板（占位符替换） |
| `scripts/compile-hf.mjs` | 分镜 JSON → HyperFrames 工程编译器 |
| `scripts/verify-hf.mjs` | 静帧验收：check 报告 + snapshot + contact-sheet + JSON 报告 |
| `scripts/self-test.mjs` | 完全离线的 60 项自检（含确定性 sha256 比对） |
| `scripts/install-local.mjs` | 本机接线：幂等安装 / 状态 / 校验 / 回滚 |
| `scripts/fetch-upstream.mjs` | 按 catalog 精确拉取上游快照（API 取 SHA → codeload tar.gz） |
| `scripts/build-card-index.mjs` | 从上游配方卡重建品味索引（幂等、可重跑） |
| `examples/demo-project.json` | 端到端示例分镜（抖音 9:16，20s，6 镜，BGM + 6 SFX） |
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
- **版本 / 状态**：0.4.1 / runtime + workbench（已接线、已装进本机 DSH，可跑通到带声 MP4；工作台 0.4.1 可编辑并可出 animatic；成片仍 NOT FOR PUBLISH）
- **主渲染后端**：HyperFrames（DSH 内置 `dsh-hyperframes` 0.14.1；CLI 钉 `hyperframes@0.9.88`），运行时依赖，不 vendor
- **次渲染后端**：Remotion（自定 License，仅用于复刻上游调校过的 TSX 镜头，**本插件不分发**）
- **上游**：[video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)，Apache-2.0，作者 Wei Yihao，锁定 SHA `59f3e9b9e936ff2bce0e18446226d770a3f2f61f`
- **上游存档位置**：`03_Video/01_Github/02_video-shotcraft`（保持原始结构，未重构，保留 LICENSE）
- **知识规模**：124 张镜头配方卡 / 150 个动效 style / 10 个类别
- **流水线**：11 阶段，唯一硬确认节点在「分镜放行」
- **成片规格**：默认 1920×1080 @ 30fps；竖屏平台 1080×1920；确定性渲染（固定种子 20261124）+ BGM/SFX 音轨（AAC 48kHz 立体声）
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
## 二次独立终检结论（0.3.0，2026-11-25 · 历史判定，0.3.2 的整改依据）

完整报告：[docs/QA-一期返工终检报告.md](docs/QA-一期返工终检报告.md)（干净上下文独立 subagent，8 份材料亲自 read / read_image，含全分辨率复核小字）。

- **总判：【有条件通过】—— 仅限「一期内部归档 / 模板可用性验收」口径；按「可发布成片」口径仍为【打回】。** 这不是「终检通过」，不要这样对外表述。
- 27 条判例 **✓14 / ✗8 / N/A5**（0.2.0 基线 ✓7 / ✗14 / N/A6）；✗ = Q1 / Q5 / Q8 / Q10 / Q11 / S4 / S5 / C2。旧 14 条 ✗：已修复 1 / 部分修复 11 / 未修复 2（Q5 开场多主角、Q8 收尾非合影峰值）。
- **P0 阻断发布仍成立**：`publish.ai_disclosure` 显式 + 隐式仍 `false`，标题 / 描述 / 封面 / 标签全空，`manifest.publish_allowed:false` → **NOT FOR PUBLISH 保持**。新增的 `<meta name="aigc">` 与 `aigc-metadata.json` 只是载体，三个开关未置真，不能算合规完成。
- 确实修好的（报告点名肯定）：6 镜 20s / 6 种互异版式与 6 个互异 primitive、3 个功能镜头（124 配方卡 / 分镜确认门 / 150 预览）、BGM + 6 SFX、GSAP 本地化去 CDN、registry 钉 commit、`__timelines` 兜底、首帧非空、安全区 px 化、SHOTS 单一事实源、时长恒等（20s / 600f / `padding_seconds:0`）、制作元数据出画、末镜静止 51f、`film_silent` 已消失。
- **如实定性**：仍是字卡模板片（6 镜共用同一渐变底 + 网格 + eyebrow + 进度条 + 同一条 0.62s 入场，只换了 6 个内容模块）；无真实产品截图、无复杂光影、无出版级排版、无运镜 / 3D / 镜头语言。`check 0 error` 只证明模板渲染没坏，不证明好看——差距是**内容证据与设计层级**，需整镜重做而非微调参数。
- 音频「**已测量，未试听**」：−19.4 LUFS（比社交片 −16 到 −14 LUFS 偏安静）/ −1.2 dBTP / 0 clipping；带 / 无 BGM 两版只渲了 1 版；`S5` 音轨偏移未实测；`S4` 的 `impact-cine 4.063s` 越过 s01 3s 边界拖进 s02；`Q11` 的 `mini-card .meta` 29.6px 低于 32px 且逐字折行。
- 数据安全：画面层 / `index.html` / `manifest.json` 干净；`out/` 工程产物含本机绝对路径（verify 11 处 / video-state 84 处 / check 7 处），但 `out/` 已被 `.gitignore` 忽略、**不入库不外发**；只有手工整包外发时才需脱敏。
- 整改顺序（登记为二期，不掩盖）：P0 发布合规 → P1 音频试听 / 两版 / S5 偏移 / S4 等长裁切 → P1 收尾合影与开场单主体 → P2 功能镜头出版级排版与字高 → P2 脱敏与证据一致性 → P3 子组合与文案。
- 放行条件（报告 §10）：标注 `NOT FOR PUBLISH / 一期模板样片`、保持 `publish_allowed:false`、7 条 lint warning 书面豁免、P1/P2 登记二期、**冻结当前静帧与 contact-sheet 作基线** —— 因此本轮不再改成片代码，避免破坏已冻结的基线。

## 独立终检结论（0.2.0，2026-11-24 · 历史归档）

> 以下是对旧 5 镜 15s 静音片的判定。0.3.0 返工已针对下列缺陷逐项整改；返工后的二次独立终检见 [docs/QA-一期返工终检报告.md](docs/QA-一期返工终检报告.md)。

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
