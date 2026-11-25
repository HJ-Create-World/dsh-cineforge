---
name: cineforge-cards
description: 从 124 张调校过的镜头配方卡中检索、推荐并校验动效。用于「这个镜头用什么动效」「给我个开场/转场/字卡效果」「按能量曲线选镜头」或任何视频分镜阶段的动效选型。禁止凭卡名和理解新写动效。
---

# CineForge 镜头卡

124 张配方卡 / 150 个 style，10 个类别。它们是**调校过的导演知识**，不是素材模板。

## 索引

`knowledge/shot-cards.json`（机器可读）· `knowledge/shot-cards.md`（人读目录）。由 `scripts/build-card-index.mjs` 从上游生成，**勿手改**。

| 类别 | 张数 | 什么时候用 |
|---|---|---|
| `opening` | 11 | 全片第一镜，单主角立传 |
| `camera` | 10 | 运镜主导（环绕 / 急推 / 俯瞰飞行） |
| `effects` | 15 | 光效 / 组装 / 扫描 / 冲击 |
| `interaction` | 11 | 打字 / 筛选 / 拨盘 / 语音波形 |
| `data` | 5 | 图表 / 数字 / 时间轴 / 前后对比 |
| `typography` | 22 | 字卡 / 标题 / 字标 / 逐字入场 |
| `ui-entrance` | 21 | 卡片堆叠 / 列表 / 面板入场 |
| `transition` | 15 | 镜头接缝（甩镜 / 遮罩 / 翻页 / 闪切） |
| `rhythm` | 8 | 卡点 / 预告片语法 / 连切 |
| `outro` | 6 | 发布会合影收场 / 字标砸落 |

## 选卡流程 · 三读协议（硬规则，不可跳）

上游硬规则依据：`SKILL.md:146` / `references/pipeline.md:211` / `references/final-review.md` S2，且 `workbench/scripts/gen-index.mjs` 消费同一套数据 —— **校验「卡名·样式名」→ 读配方卡 → 读准确 demo TSX → copy `assets/lib/**`**。参数真相在 demo，不在卡片文字。

### 1. 扫 frontmatter，不扫全文

按 `category` / `energy` / `duration` / `tags` / `use` 过滤 `shot-cards.json`，得到候选。再按 `knowledge/energy-arc.json` 的段位需求挑：开场低能量、功能段中高⇄低交替、收场峰值。

### 2. 读全文

每张卡有：意图 / 动效核心 / 参数表 / 声音 / **已知坑** / 参考实现。已知坑是返工换来的，最有价值。

### 3. 校验 style-key

用 `style_keys` 与 `preview_url` 确认卡名与样式，别把「卡名」当「样式名」。预览可给用户挑。

### 4. 定位参考实现并读源码

`reference_impl` 指向上游 `demos/**` 的 TSX。**配方卡给的是语义和参数表，准确的 demo 源码才是调校过的参数真相**（缓动、时值配比、摘罩时机、已知坑的规避写法）。随后按 demo 的 import 复制 `assets/lib/**`（PageCam 等可复用组件），不要凭记忆重写依赖。

> 允许按目标产品做适配性改动，但卡上「已知坑 / 命门」标注的参数**不得降档**——质量标准只升不降。
> **凭卡名和新写 = 放弃全部调校积累，实测质感差一档。**

### 5. 映射到底层引擎

| 情况 | 做法 |
|---|---|
| HyperFrames 有等价 registry block / keyframes | 用 HF 实现，把卡的参数表映射到 block 参数 |
| HF 无等价实现 | 走 Remotion 次后端，**按 `reference_impl` 路径复用上游 TSX**，不重写 |
| 卡标注「仅供参考，需自定义实现」 | 不默认推荐；用户明确点名才做，并标注风险 |
| 卡标注「缺少预览」 | 不得声称已按动态样片复刻 |

> **一期编译器边界（0.3.2 runtime）**：`scripts/compile-hf.mjs` 把 10 个类别映射到 `lib/hf-primitives.mjs` 的 7 个确定性原语（fade / slide-up / slide-left / scale-in / crash-zoom / wipe / hold），用 `motion-tokens.json` 的 6 预设近似缓动，并用 `lib/hf-layouts.mjs` 的 8 种版式（title / quote / card-grid / checklist / metric / outro / hero / outro-finale）承载画面；其中 `hero`（单主体聚光五段弧）与 `outro-finale`（四方飞入合影 + 舞台光 + 12 粒子）是 0.3.2 整镜重做的版式，有专属 `buildTweens` 分支。**分镜里显式声明的 `primitive` 是权威（SHOTS 单一事实源）**，编译器不再按 `transition_in` / category 静默覆盖。这是「可跑通的骨架」，**不是 124 卡逐卡精确还原**（自动映射表排在三期）。因此：选卡仍按三读协议给出语义与参数表；若该镜要精确还原，须读 `reference_impl` 的 demo TSX 手动增强生成的 `index.html`，并在终检里比对卡的参数是否降档。不要因为编译器没实现某张卡，就凭卡名新写一个动效。

## 选型约束（写进分镜校验）

- **一种动画手法全片只当一次主角**（飞入 / 堆叠 / 翻页各自只用一次）。
- **每镜只讲一个主动效**；关键信息落定后必须呼吸。
- 开场只给**一个主角** + 一条完整动作弧 ≥3s（Q5 / R3）。
- 全画面级节拍冲击全片 ≤3 处（R4）。
- 光效不群发、只给主角、裁进圆角边界（Q4）。
- 信息密集镜头保持正视；文字特写用侧向水平机位，不大角度俯仰（Q6）。
- 功能段高能量镜与稳节奏镜交替，中间插呼吸字卡。
- 收尾用「发布会合影」：已展示功能各出代表元素多方向飞入围住字标，能量推到全片峰值（Q8）。

## 常用速查

| 需求 | 首选卡 |
|---|---|
| 品牌开场（先立名号） | `brand-ink-open` |
| 单主角质感开场 | `spotlight-hero-card` |
| 批量卡片入场（要越来越快） | `deck-deal-flyin` |
| 搜索 / 筛选交互演示 | `type-and-filter` |
| 列表堆叠压入 + 计数落定 | `list-stack-press` |
| 呼吸字卡 | `paper-title-card` |
| 发布会峰值收场 | `outro-group-photo-launch` |
| 叙事转折点 / 底色反转 | `aurora-bloom-bg-flip` |

完整清单见 `knowledge/shot-cards.md`。

## 上游署名

派生自 [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) `references/shots/`（Wei Yihao，Apache-2.0）。

**署名链不可断**：`references/shots/ATTRIBUTION.md` 含 38 张卡的「逐卡来源映射」与法律边界（仅参考 / 重新实现 / 去品牌化 / 占位化；来源记录**不是**授权凭证），而卡片文件自身**不带**来源标注。连同 `assets/audio/ATTRIBUTION.md`（BGM）、`template/public/audio/ATTRIBUTION.md`（Freesound CC BY SFX）、`assets/readme/sponsors/ATTRIBUTION.md` 共 4 份须随上游存档原样保留，移植不得删改。完整清单见 `upstream/catalog.json` 的 `attribution_chain`。