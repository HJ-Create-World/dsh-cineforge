# CineForge 影铸 · 设计总纲

> 版本：v0.1（设计稿）　|　日期：2026-11-24　|　状态：待用户评审
> 目标：让普通模型驱动的视频创作，具备 Opus 模型的设计感。

---

## 1. 问题定义

用户有一句 idea，想要一支能发到 B 站 / 抖音的高质量视频。当前链路的断点不在「渲染能力」——DSH 已有 HyperFrames，能渲染、能编排、能确定性输出。断点在**导演判断**：

| 普通模型的典型翻车 | 根因 | 代价 |
|---|---|---|
| 一上来就写动画代码 | 创意方向、受众、画幅都没定 | 整套场景报废 |
| 每个元素都发光、每拍都震屏 | 没有「一个镜头只讲一个动效」的约束 | 廉价感、观感噪音 |
| 开场四五个元素同时飞入 | 不知道「单主角 + 完整动作弧」 | 第一印象立不住 |
| 品牌字标一闪而过 | 不知道落定后要 hold ≥1s | 白做 |
| 节奏全片越来越快、没有呼吸 | 没预留 hold/rest 帧预算 | 观众看不清 |
| 横屏成片硬发抖音 | 画幅在分镜阶段就该锁定 | 加黑边或被裁切 |

**核心洞察**：上游 video-shotcraft 最有价值的不是那 150 个 TSX demo，而是它把「导演品味」编码成了**可检索、可自检的知识**——124 张镜头配方卡（意图 / 参数表 / 已知坑 / 参考实现）、判例式审美准则（规则 + 判例 + 自检问题）、品牌到动效的参数推导、八阶段流水线、能量曲线骨架、逐帧验收纪律。这些知识**与渲染引擎无关**。

因此 CineForge 不做「又一个渲染器」，而是给 HyperFrames 装一个**导演大脑**。

## 2. 定位与边界

```
HyperFrames  →  怎么渲（HTML composition / data-* timing / clip / track / 确定性渲染）
CineForge   →  拍什么、为什么这么拍、按什么顺序、怎么判断好不好
```

| 做 | 不做 |
|---|---|
| 把 idea 扩写成创意简报与平台化文案 | 生成式视频模型（不产像素，画面由代码/素材绘制） |
| 排分镜并在最便宜的时刻请用户确认 | 取代 HyperFrames 或另建渲染引擎 |
| 从 124 张卡里检索并推荐动效 | vendor 上游代码进插件 |
| 输出 engine-agnostic 的分镜 JSON | 替用户决定发布（发布必须显式确认） |
| 渲染、逐帧验收、独立终检 | 绕过 DSH 的插件加载机制 |
| 导出 MP4 / 剪映工程 / 发布到 B 站抖音 | 承诺上传 API 稳定（第三方服务，隔离为可选适配器） |

### 2.1 与上游的关系

- **上游**：video-shotcraft（Apache-2.0），快照锁定 SHA `59f3e9b…`，存档于 `03_Video/01_Github/02_video-shotcraft`，保持原始结构、保留 LICENSE。
- **本插件**：只带走派生知识（索引、tokens、准则、schema）与按需引用的 TSX 路径；不复制上游源码主体。
- **署名**：所有派生文件带 `attribution` 字段；NOTICE 与 README 明示上游。符合 Apache-2.0 §4（附 License / 改动声明 / 保留署名）。
- **署名链不可断**：上游 4 份 ATTRIBUTION 文件随存档原样保留 —— `references/shots/ATTRIBUTION.md`（38 张卡的逐卡来源映射；卡片自身不带来源标注）、`assets/audio/ATTRIBUTION.md`（BGM，Mixkit Free License）、`template/public/audio/ATTRIBUTION.md`（模板 SFX，Freesound 逐文件 CC BY）、`assets/readme/sponsors/ATTRIBUTION.md`。上游明确「仅参考、重新实现、去品牌化、占位化」，**来源记录不是授权凭证**，移植时不得删除或改写。
- **许可边界**：video-shotcraft LICENSE 为 Apache-2.0 全文、无 NOTICE；Remotion 为独立自定许可（个人/≤3 人免费，企业需 Company License），本插件不分发 Remotion；上游 SKILL.md 声明成片归用户、免费商用、不强制署名。
- **升级**：`upstream/catalog.json` 是单一事实源，改 `pinned_sha` 后重跑两个脚本即可重建，不手改派生文件。

## 3. 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│  交互层  Interaction                                         │
│  · 对话内使用（技能自动触发）                                │
│  · 独立视频创作工作台（侧边栏 iframe / 独立页，可选）        │
└──────────────────────┬──────────────────────────────────────┘
                       │ storyboard v1
┌──────────────────────▼──────────────────────────────────────┐
│  导演层  Director（状态机 + 技能）                            │
│  11 阶段流水线 · 分镜确认门 · 能量曲线 · 审美自检             │
│  cineforge-director / cineforge-cards / cineforge-qa          │
└──────────┬───────────────────────────────┬───────────────────┘
           │ 选卡 / 自检                    │ 分镜 JSON
┌──────────▼──────────────┐   ┌────────────▼───────────────────┐
│  品味层  Taste          │   │  执行层  Render                  │
│  （引擎无关的知识）     │   │  · primary: HyperFrames          │
│  · shot-cards.json      │   │  · secondary: Remotion TSX       │
│  · aesthetic-rules.json │   │  · export: 剪映工程 / MP4        │
│  · motion-tokens.json   │   │  · publish: B站 / 抖音（可选）    │
│  · platform-presets     │   └──────────────────────────────────┘
│  · storyboard.schema    │
└─────────────────────────┘
```

**为什么要分层**：品味层是最耐久的资产。哪怕明天换渲染后端、换平台、换模型，124 张卡的「意图 / 已知坑」和审美判例依然有效。执行层反而是最易变的。把两者解耦，插件不会随上游或 HyperFrames 的版本一起腐烂。

### 3.1 品味层（Taste Layer）

| 文件 | 内容 | 来源 |
|---|---|---|---|
| `shot-cards.json` | 124 卡 × (意图/适用/时长/能量/标签/已知坑/参考实现/style-key/预览) | 上游 `references/shots/*.md` + `gallery/api/library.json` |
| `aesthetic-rules.json` | R/Q/S/C/P 判例式准则，每条 = 规则 + 判例 + 自检问题 | 上游 `references/aesthetic-rules.md` |
| `motion-tokens.json` | 6 个品牌预设 × (时长@30fps / easing / 过冲 / squash) + 能量·调性双轴 | 上游 `pipeline.md` §1 |
| `energy-arc.json` | 低开 → 功能段与呼吸位交替 → 峰值收尾的段位模板 | 上游 `sequences/promo-energy-arc.md` |
| `platform-presets.json` | 5 平台画幅 / 时长 / 封面 / 安全区 / 文案约束 | 自行调研 |
| `storyboard.schema.json` | 分镜 JSON 契约 `cineforge/storyboard/v1` | 自行设计 |

### 3.2 导演层（Director Layer）

三个技能，各司其职：

- **cineforge-director**：主状态机。管 11 阶段推进、确认节点、设计 spec、数据口径、放行纪律。
- **cineforge-cards**：镜头卡检索。执行**三读协议**（校验「卡名·样式名」→ 读配方卡 → 读 `demos/**` 准确 TSX（参数真相在 demo）→ copy `assets/lib/**`），拒绝「凭卡名新写」。依据上游 `SKILL.md:146` / `pipeline.md:211` / `final-review.md` S2。
- **cineforge-qa**：独立终检。干净上下文，对照审美准则逐条出带帧号证据的报告（制作者不能自审）。

### 3.3 执行层（Render Layer）

后端适配器接口统一为 `render(storyboard) → { mp4, qa_frames, workbench_manifest }`。

- **HyperFrames（主）**：把分镜 JSON 编译成 HF composition（`class="clip"` / `data-*` timing / tracks / sub-compositions）。动效卡映射为 HF 的 keyframes / transitions / registry blocks。
- **Remotion（次）**：当某张卡只有上游 TSX 实现、HF 无等价 registry block 时，按 `reference_impl` 路径直接复用上游调校过的 TSX（避免「凭理解新写＝放弃全部调校积累」）。
- **导出**：MP4（带 BGM / 无 BGM 两版）；剪映草稿（可编辑工程）。
- **发布**：隔离适配器，B 站 / 抖音优先；发布前 dry-run + 用户显式确认 + requestId 幂等（绝不重跑）。

### 3.4 插件落地形态（DSH 实测）

| 项 | 事实 |
|---|---|
| 本质 | profile 组合包（bundle）= **npm 包**，无独立 manifest；声明全在 `package.json` 的 `dsh` 字段（`dsh.bundle.patch` / `dsh.client` / `dsh.profile.bundles` / `engines.dsh`） |
| 加载 | `cordis.patch.yml`（YAML 数组 `- id/name/config/insert/disabled`），Launcher 按序作组合层 |
| 能力 | `lib/index.js` 的 `apply(ctx)` 注册 `ctx.skills.register` / `ctx.tools` / `ctx.mcpManager` |
| 客户端 | `exports["./client"]` → `lib/client.js`，浏览器侧惰性 CJS `window.__ModuleLoader__.load({id, factory})`，Host 注入 `window.__DSH_BOOT__` |
| 工作台 | `ctx.slots.inject("sidebar.panellist", …)` + `ctx.slots.inject("main", …)` 注册 keyed slot React 组件（HyperFrames 实证）；或 iframe `ctx.sidebarRight.openTab("browser", {params:{url}})` |
| 安装 | `dsh plugin --profile desktop add <spec>`；`pnpm add` 写 `PF/package.json` 并追加 `dsh.profile.bundles` |
| HMR | `/plugins/events` SSE，需 `pnpm run dev:web` + watcher；Electron 桌面端不走此路 |

生态判定：**无 video-shotcraft 同名插件**；官方无插件索引（`dsh-plugin-market` 的 `indexes: []` 默认空），实际市场是第三方 [dshmarket](https://dshmarket.com)（目录源 `https://awesome-dsh-plugin.com/plugins.json`）；约 100 个 video-ish 插件（`dsh-hyperframes` / `dsh-remotion` / `dsh-video-storyboard` / `dsh-longshot` 等）职责不同。详见 [RESEARCH-生态调研.md](../RESEARCH-生态调研.md)。

## 4. 11 阶段流水线

在上游八阶段基础上，**前置 idea 扩写 + 平台化文案**、**后置导出发布**，并把「分镜确认」定为唯一硬门。

| # | 阶段 | 输入 → 产出 | 确认 | 上游依据 |
|---|---|---|---|---|
| 0 | Idea 摄入与扩写 | 一句话 → 创意简报（受众/目标/钩子/情绪/平台/时长/画幅/语言） | 软 | 新增 |
| 1 | 文案与叙事结构 | 简报 → 钩子/正文/CTA + 平台化标题与话题标签 | 软 | 新增 |
| 2 | 素材理解与数据口径 | 只读检查 → 产品简报、需求决策表、敏感数据冻结 | — | 阶段 0 |
| 3 | 视觉方向与 styleframe | → 色板/字体/光感 tokens + 动效性格 tokens + 静态关键帧 | 软 | 阶段 1 |
| 4 | 动效映射 | 扫 124 卡 frontmatter → 功能到镜头映射（首选/备选） | — | 阶段 2 |
| 5 | **分镜与制作放行** | → 分镜表 + 帧级时间轴 + 能量曲线 | **★ 硬门** | 阶段 3 |
| 6 | 最终素材采集 | → 真实页面 2x 截图 / 元素切片 / layout.json | — | 阶段 4 |
| 7 | 逐镜头实现 + 静帧验收 | → 可渲工程，每镜 2 个验收帧号 | — | 阶段 5 |
| 8 | 声音设计 | → BGM 卡点网格 / SFX 钉帧 / 配音 | — | 阶段 6 |
| 9 | 独立终检与交付 | → 带帧号证据的终检报告 + 成片 | — | 阶段 7 |
| 10 | 导出与发布 | → MP4 / 剪映工程 / 平台发布（显式确认） | **★ 发布确认** | 新增 |

### 4.1 为什么只设两道门

上游把「共同创作」设计成 5 个逐阶段确认节点，这对专业用户合适；但普通用户会被问烦。**把确认压缩到最便宜的两个时刻**：

1. **分镜放行（阶段 5）**——此时只有文字和静态帧，改方向零成本；一旦进入阶段 6 采集与 7 实现，返工要整套场景报废。
2. **发布确认（阶段 10）**——公开且难撤回，且平台文案、AI 声明、隐私设置必须由人拍板。

其余阶段由模型自主推进，但每一步把判断与取舍写进设计 spec（可追溯、可复盘）。用户说「你全权决定」时，分镜门也可跳过，切换为自主模式并记录。

### 4.2 两条铁律（继承自上游，不打折）

1. **分镜确认前不得进入最终素材采集**（方向错了，素材全废）。
2. **确定性渲染**：禁 `Date.now()` / `Math.random()` / 无参 `new Date()`，伪随机固定种子（seed 从 index 派生），保证逐帧可复现、渲染间零抖动。

### 4.3 审美自检（贯穿全程，不是最后一阶段）

每个镜头完成即出静帧肉眼看；每轮修改后整片重渲 + 抽帧回看；交付前由干净上下文的独立 subagent 对照 `aesthetic-rules.json` 逐条出 `编号 ✓ / 编号 ✗(镜头名·帧号)` 报告。核心判例摘要：

- **R1** 品牌字标落定 hold ≥30f；**R2** 匀速直线运动读作廉价 PPT，批量入场要加速且末尾留 15f 静止；**R3** 初版默认放慢一档、主体动作弧 ≥3s；**R4** 全画面级节拍冲击全片 ≤3 处。
- **Q1** 复刻既有页面必须真实截图；**Q2** 文字糊先查纹理栅格化链路而非调景深；**Q3** 默认禁手持抖动；**Q4** 光效不群发、只给主角且裁进圆角；**Q5** 开场只给一个主角。
- **S** 音色走电影系词汇；**C** 一种动画手法全片只当一次主角；**P** 指代含糊的反馈先确认对象再动手。

## 5. 分镜契约（各层之间唯一的接口）

`cineforge/storyboard/v1`，详见 [knowledge/storyboard.schema.json](../../knowledge/storyboard.schema.json)。

```json
{
  "project": { "idea": "...", "platform": "douyin", "aspect": "9:16",
               "duration_s": 45, "mode": "co-create" },
  "design_spec": { "palette": [], "typography": {},
                   "motion_tokens_id": "energetic-bold", "energy_curve": [] },
  "shots": [
    { "id": "s1", "from": 0, "duration_f": 172,
      "card_id": "spotlight-hero-card", "card_style_key": "spotlight-hero-card",
      "intent": "...", "action": "...", "asset_ref": "...",
      "caption": "...", "transition_in": "...", "sfx_cue": "...",
      "energy": "mid", "qa_frames": [34, 142],
      "backend": "hyperframes", "props": {}, "schema": [] }
  ],
  "audio": { "bgm": {}, "sfx": [], "voiceover": [] },
  "publish": { "platforms": ["douyin"], "title": "...",
               "ai_disclosure": { "explicit": false, "implicit": false },
               "rights_checked": false, "sensitive_data_cleared": false }
}
```

**不变量**：SHOTS 是唯一事实源，字幕表 / SFX 钉帧 / 转场点全部从它派生；画幅在阶段 0 锁定并贯穿到阶段 10；每镜只讲一个主动效。

## 6. 未来形态：对话 + 独立工作台

用户设想的两种用法都支持，且共用同一个分镜 JSON：

### 6.1 对话内使用

技能自动触发（用户说「做个视频」「给这个产品做宣传片」）。模型按 11 阶段推进，在阶段 5 用卡片式分镜表请用户确认，之后连续执行到成片。全程产物落盘，可随时回到工作台继续改。

### 6.2 独立视频创作工作台

四面板布局（详见 [docs/工作台设计.md](../工作台设计.md)）：

```
┌──────────┬────────────────────────────┬──────────────┐
│ Idea     │ 分镜板（卡片 + 能量曲线）  │ 镜头库       │
│ 简报     │ · 逐镜确认 / 重排 / 改时长 │ · 124 张卡   │
│ 文案     │ · 静帧预览                 │ · 预览 / 拖拽 │
│ 平台预设 │ · 帧级时间轴               │ · 审美准则   │
├──────────┴────────────────────────────┴──────────────┤
│ 时间线 · 渲染进度 · 终检报告 · 导出 / 发布               │
└───────────────────────────────────────────────────────┘
```

工作台定位是**「确认与微调」而非「从零创作」**：创作判断由导演技能完成，工作台让人在分镜、文案、动效选型、发布文案上做低摩擦的拍板与微调。这与上游 Motion Workbench 的「成片交付后多轨微调」互补——CineForge 把工作台**前移**到分镜阶段，因为普通用户最需要在开渲之前看清楚要拍什么。

### 6.3 状态机

```
IDEA → BRIEF → SCRIPT → SPEC → MAPPING → STORYBOARD ─[确认门]→ 
ASSETS → BUILD → SOUND → QA → DELIVER ─[发布确认]→ PUBLISHED
                    ↑                                    │
                    └────── 任一阶段可回退重开 ─────────┘
```

每个状态落盘为 `project.json`（分镜 JSON + 阶段 + 设计 spec + 素材清单），工作台与对话读同一份，不产生两套事实。

## 7. 发布链路（B 站 / 抖音）

| 关注点 | 设计 |
|---|---|
| 画幅 | 阶段 0 锁定：抖音 9:16 / B 站 16:9。横屏成片发竖屏平台必须如实告知会加黑边或裁切，并建议另渲竖屏版，**不静默处理** |
| 前 3 秒 | 阶段 1 文案强制钩子；阶段 5 分镜把钩子落在开场单主角动作弧里 |
| 字幕 | 竖屏平台硬字幕；安全区按 `platform-presets.json`（抖音底部 20% + 右侧 15% 留白） |
| 封面 | 阶段 10 生成平台尺寸封面（抖音 1080×1920 / B 站 1146×717） |
| 发布 | 隔离适配器；先 dry-run → 用户确认文案/平台/隐私/AI 声明 → 只跑一次 → 用 requestId 查询，超时或 unknown **绝不重跑** |
| 合规 | 《AI 生成合成内容标识办法》（2025-09-01 施行）要求**显式 + 隐式双标识**：导出产物写元数据、平台侧勾声明，未勾不得提交；另核对 [网络短视频内容审核标准细则(2021)](https://www.nrta.gov.cn/art/2021/12/15/art_110_59299.html)、BGM/字体商用授权、广告法极限词、数据安全。第三方上传服务为可选依赖，缺密钥时降级为「导出成片 + 手动上传指引」，不阻塞主流程 |

## 8. 验收标准

| 层 | 验收 |
|---|---|
| 数据 | `shot-cards.json` = 124 cards / 150 styles / 10 categories；重跑脚本结果一致；每个派生文件带 attribution |
| 契约 | `storyboard.schema.json` 校验通过；SHOTS 派生字幕/SFX/转场一致；确定性渲染无 `Date.now` / `Math.random` |
| 流水线 | 阶段 5 之前无素材采集与渲染；阶段 10 发布前有 dry-run 与显式确认 |
| 成片 | 逐镜静帧验收；整片重渲抽帧回看；独立终检报告逐条带帧号证据；带 BGM / 无 BGM 两版 |
| 署名 | README / NOTICE / LICENSE / catalog.json 四处一致，上游 LICENSE 未删；4 份 ATTRIBUTION.md 原样保留且 `attribution_chain` 登记完整；三读协议写进 cards 技能 |

## 9. 关键设计决策与取舍

| 决策 | 理由 | 放弃了什么 |
|---|---|---|
| 抽「品味知识」而非复制上游代码 | 知识与引擎解耦，最耐久、最易升级、许可最清晰 | 不能开箱即用上游 150 个 TSX（改为按路径按需引用） |
| HyperFrames 为主后端 | DSH 内置，已有渲染/编排/确定性能力，不重复造轮子 |  upstream 的 Remotion 工作台不直接搬运 |
| 只设 2 道确认门 | 普通用户怕被问烦；把确认放在返工成本最低的时刻 | 专业用户失去逐阶段干预（可用 co-create 模式补） |
| 工作台前移到分镜阶段 | 普通用户最需要在开渲前看清楚要拍什么 | 与上游「交付后微调」定位不同，不做多轨剪辑 |
| 发布隔离为可选适配器 | 第三方服务不稳定、公开动作难撤回、合规责任在人 | 不做「一键全自动发布」的承诺 |
| 上游快照放 `01_Github` 且保持原结构 | 遵守工作区四层规范，版权与署名自保 | 插件目录里没有上游源码副本 |

## 10. 待确认事项（评审时请拍板）

1. 插件名与 GitHub 仓库名：`cineforge` / `dsh-cineforge` / 中文名？
2. 新仓库公开还是私有（默认建议公开，便于标注上游与社区反馈）。
3. 一期优先级：先做「对话内技能 + 品味层」（最快可用），还是先做「独立工作台」（形态完整但工程量大）。
4. 是否需要把上游 150 个 TSX 镜头做成 HF registry block 的自动映射表（工作量最大、收益最高）。

---

调研已定稿项（无需再拍板）：MotionHarness 产品真实存在但查无公开源码、许可 Apache-2.0 → UNLICENSED → GPL-3.0-only 反复，**只借鉴「可编辑参数工程 + 时间/区域批注 + checkpoint」设计、自研实现，不复制不捆绑代码**；未来若做外部适配器须等许可稳定且为用户自装。

*本设计文档依据 brainstorming 流程产出。评审通过后进入实现计划。*