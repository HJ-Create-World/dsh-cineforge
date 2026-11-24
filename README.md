# CineForge 影铸 · AI 视频导演台

> 一个 DSH 视频创作增强版插件：让普通模型驱动的视频创作，也有 Opus 模型的设计感。
> 把一句 idea 扩写成视频文案，排成可确认的分镜，配上调校过的动效，输出高质量成片，并可发到 B 站 / 抖音。

GitHub：[HJ-Create-World/dsh-cineforge](https://github.com/HJ-Create-World/dsh-cineforge) · 上游：[video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)（Apache-2.0）

## 交付物

| 文件 | 说明 |
|---|---|
| `docs/design/2026-11-24-cineforge-design.md` | **设计总纲**：定位、三层架构、11 阶段流水线、工作台形态、验收标准 |
| `docs/工作台设计.md` | 独立视频创作工作台的面板 / 交互 / 状态机设计（含线框） |
| `docs/ROADMAP.md` | 分期路线图：一期可用、二期工作台、三期发布闭环 |
| `docs/RESEARCH-生态调研.md` | **调研定稿**：插件市场（无同名插件）、HyperFrames 定位、MotionHarness 判定、动效生态分期、B站/抖音发布合规 |
| `skills/cineforge-director/` | **导演技能**：idea → 分镜确认 → 成片的状态机与阶段约束 |
| `skills/cineforge-cards/` | **镜头卡技能**：124 张配方卡的检索与选卡规则 |
| `knowledge/shot-cards.json` | 124 张卡 / 150 个 style 的机器可读品味索引（派生自上游） |
| `knowledge/shot-cards.md` | 同上的人读目录 |
| `knowledge/motion-tokens.json` | 品牌 → 动效参数表（6 预设 × 2 轴） |
| `knowledge/aesthetic-rules.json` | 判例式审美准则的机器可读版（R/Q/S/C/P） |
| `knowledge/platform-presets.json` | B 站 / 抖音 / 小红书 / YouTube / 视频号的画幅与安全区预设 |
| `knowledge/storyboard.schema.json` | 分镜 JSON 契约（插件各层之间的唯一事实源） |
| `upstream/catalog.json` | **上游单一事实源**：精确版本、许可、引入方式、用途 |
| `scripts/fetch-upstream.mjs` | 按 catalog 精确拉取上游快照（API 取 SHA → codeload tar.gz） |
| `scripts/build-card-index.mjs` | 从上游配方卡重建品味索引（幂等、可重跑） |
| `spec.json` | 机器可读项目规格 |
| `LICENSE` / `NOTICE` | Apache-2.0 与上游署名声明 |

## 规格

- **类型**：DSH 插件（npm 包 + `cordis.patch.yml` + `ctx.skills.register` / `ctx.slots.inject`），非独立应用
- **主渲染后端**：HyperFrames（DSH 内置 `dsh-hyperframes` 0.14.1，运行时依赖，不 vendor）
- **次渲染后端**：Remotion（自定 License，仅用于复刻上游调校过的 TSX 镜头，**本插件不分发**）
- **上游**：[video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)，Apache-2.0，作者 Wei Yihao，锁定 SHA `59f3e9b9e936ff2bce0e18446226d770a3f2f61f`
- **上游存档位置**：`03_Video/01_Github/02_video-shotcraft`（保持原始结构，未重构，保留 LICENSE）
- **知识规模**：124 张镜头配方卡 / 150 个动效 style / 10 个类别
- **流水线**：11 阶段，唯一硬确认节点在「分镜放行」
- **成片规格**：默认 1920×1080 @ 30fps；竖屏平台 1080×1920；确定性渲染（固定种子）
- **分镜契约**：`cineforge/storyboard/v1`，SHOTS 为唯一事实源

## 重跑方式

```bash
# 1. 精确拉取上游快照（本机直连 git clone github.com:443 常失败，走此脚本）
node scripts/fetch-upstream.mjs --id video-shotcraft

# 2. 从上游配方卡重建品味索引（幂等）
node scripts/build-card-index.mjs \
  --src "../../01_Github/02_video-shotcraft" \
  --out knowledge

# 3. 校验索引完整性（应为 124 cards / 150 styles）
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

## 快速理解

一句话：**HyperFrames 回答「怎么渲」，CineForge 回答「拍什么、为什么这么拍、按什么顺序、怎么判断好不好」。**

普通模型做视频翻车，通常不是不会写代码，而是没有导演判断：方向没定就开渲、动效堆满每一帧、开场多主角群舞、品牌字标一闪而过。上游 video-shotcraft 把这些判断沉淀成了 124 张配方卡和一套判例式审美准则。CineForge 把这份「品味」抽出来，做成与渲染引擎无关的知识层，再套上一层带确认节点的导演状态机，最后落到 HyperFrames 上执行。

详见 [设计总纲](docs/design/2026-11-24-cineforge-design.md)。