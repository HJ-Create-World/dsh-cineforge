> **归档说明**：本文件是干净上下文独立 subagent 产出的终检报告原文（2026-11-24），从 `out/qa/cineforge-demo-01.qa.md` 原样搬入 `docs/` 以便随仓库交付；`out/` 为生成产物，已被 `.gitignore` 忽略。结论为【打回 / 仅可内部有条件归档】。
> 另有主线程在等待期间写的一份降级自审，因其中「独立终检未产出」的声明已被本报告推翻，不再保留，以本文件为唯一终检口径。

---
# CineForge 成片独立终检报告 · `cineforge-demo-01`

> 终检员：干净上下文独立 subagent（未参与制作，不读取制作过程，仅依据输入材料与成片判定）。
> 依据：`skills/cineforge-qa/SKILL.md`（6 维度 / 27 条判例 / 报告 5 项 / 高频缺陷 10 条）、`knowledge/aesthetic-rules.json`、`knowledge/platform-presets.json`。
> 判定记号：`✓` 通过；`✗(位置)` 未通过且给出可定位的镜头/帧号；`—(N/A)` 该判例在本片无适用对象（缺失本身未被写成已确认偏离）。位置一律用 `sNN·fNNN` 或时间点，帧率 30fps。

## 0. 证据清单（全部亲自读取/查看）

| 材料 | 路径 | 关键事实 |
|---|---|---|
| 分镜源 | `examples/demo-project.json` | `schema: cineforge/storyboard/v1`；5 镜；douyin / 9:16 / `duration_s: 15`；`energy_curve: opening(low) -> function(mid-high) -> breath(low) -> outro(peak)`；`styleframe_refs: []`；`audio` 全空；`publish.ai_disclosure = {explicit:false, implicit:false}` |
| 编译清单 | `out/cineforge-demo-01/manifest.json` | `backend_version 0.9.88`；`1080x1920 / 30fps / 468f / 15.6s`；`deterministic: true`；5 镜 primitive：crash-zoom / slide-up / slide-left / slide-up / fade |
| 静帧验收报告 | `out/qa/cineforge-demo-01.verify.json` | `ok:true`；`error_count: 0`，`warning_count: 7`（lint 6 + craft 1），audio info 1；7 帧静帧全部非零字节（303961–320070 B）、`empty_frames: 0`；`sample_times: 1.5/5/9/12/14.3/15.2/15.35s` |
| 静帧拼图 | `…/snapshots/3febdc43-…/contact-sheet.jpg` | **已用 `read_image` 亲眼查看**（1520×2758，原图 1816×3295），并另看 f45 / f150 / f429 三张 1080×1920 单帧 |
| 生成的 HTML | `out/cineforge-demo-01/index.html` | 146 行；L7 CDN GSAP；L16 安全区变量；L130 `gsap.timeline({paused:true})`；L131 `window.__timelines["main"] = tl`；L132–141 共 10 条 tween；L142 `tl.seek(0)` |
| 审美准则 27 条 | `knowledge/aesthetic-rules.json` | `count: 27`；R4 / Q11 / S5 / C3 / P4 等；`usage` 要求逐条输出 `编号 ✓ / 编号 ✗(位置)` |
| QA 方法 | `skills/cineforge-qa/SKILL.md` | 6 维度、27 行逐条表、报告 5 项、高频缺陷 10 条 |
| 平台预设 | `knowledge/platform-presets.json` | douyin：9:16 / `底部 20% 与右侧 15% 须留白` / `前 3 秒钩子决定完播` / `硬字幕` / `建议 AI 生成声明如实评估`；`common.audio_lufs: -14`、`deterministic_seed_required: true` |
| 辅助核对 | `project.json` / `meta.json` / `hyperframes.json` / `render-outputs.json` / `video-state.json` / check 报告 `c4619e2f-…json` / `lib/hf-timeline.js` / `lib/hf-template.html` / `knowledge/energy-arc.json` / `knowledge/motion-tokens.json` / `knowledge/shot-cards.json` | 见正文各条 |
| 成片客观参数 | `renders/cineforge-demo-01.mp4` | 已由委托方 ffprobe 核对：H.264 / 1080×1920 / 30fps / 468 帧 / 15.6s / 5.0MB（本报告直接引用，不重复探查） |

**帧号基准**（由 manifest 与 30fps 换算）：`s01 f0–f89 (0–3s)`、`s02 f90–f209 (3–7s)`、`s03 f210–f329 (7–11s)`、`s04 f330–f389 (11–13s)`、`s05 f390–f467 (13–15.6s)`；抽样帧 `1.5s=f45`、`5s=f150`、`9s=f270`、`12s=f360`、`14.3s=f429`、`15.2s=f456`、`15.35s=f460`。

---

## 1. 总判

**打回（不予放行发布）。** 若仅作为「一期内部占位式样片」归档，可有条件放行，条件见 §9 末。

打回的三类阻断理由：
1. **发布合规未补齐**：`publish.ai_disclosure` 显式/隐式双标识均为 `false`，BGM/字体授权与无极限词自检无记录，封面/标题/描述/标签全空（§8）。
2. **功能性缺陷（非「品味偏好」）**：简报 goal 的两个记忆点「124 张镜头配方卡」「分镜确认门」都只以一行文字宣称，没有任何对应功能镜头；全片 5 镜共用同一版式，仅换文字（P4 / Q1 / Q10 / C2 全 ✗）。
3. **音频层整体缺位 + 收尾降档**：`craft film_silent` 警告，全片 0 音轨（S1–S4 全 ✗）；标 `peak` 的 s05 实为最弱的 opacity 淡入，无发布会合影、无 0.5s 收尾停顿（R2 / Q8 / 能量交替 ✗）。

需说明：`verify.json` 的 `note` 已声明「7 条 warning 不拦截一期验收，error 与空静帧才判失败」，本终检**认可**该一期口径下 `0 error / 7 帧非空` 的工程验收通过；但终检的判据是 27 条审美判例与交付/发布合规，二者不是同一把尺。工程验收过 ≠ 终检放行。

---

## 2. 逐条准则表（27 行，逐条 ✓ / ✗(位置) + 帧号证据）

| 编号 | 判定 | 帧号/时间点证据与判据 |
|---|---|---|
| R1 | ✓ | `s01·f19–f89`、`s05·f405–f467`：body 入场 tween 分别于 0.62s / 13.5s 结束，两处 wordmark「影铸 CineForge」「CineForge · 开源」各静止 2.38s / 2.1s，均 ≥1s(30f)，且停顿给的是品牌字标而非普通内容卡。**保留**：网格底层全程未停，整帧从未完全安静（并入 R2 判定） |
| R2 | ✗(全片·`f0–f467`) | `index.html` L133/135/137/139/141 五条 grid tween 全为 `ease:"none"` 的 `x:0→26` 匀速直线；s05 末条 `13s + 2.6s = 15.6s` 恰结束于末帧 f467，**收尾静止 0f**，无 0.5s(15f) 停顿；s03 分镜写「卡片堆叠错落入场」实际只有单块 body 0.55s slide-left，无批量、无「越来越快」加速、无 15f settle |
| R3 | ✗(`s01·f0–f19`) | 开场主体动作弧仅 0.62s（19f）的 `opacity+scale 1.32→1`，不是「聚焦→悬浮→归位」完整弧；3s 镜头里 2.38s 是静止而非动作。`s04` 仅 2s、`s05` 2.6s，未见「初版放慢一档」的 hold/rest 帧预算前置 |
| R4 | ✓ | 全片整画面/相机层冲击 **0 处**（无震屏、闪帧、整画面 scale 泵、负片帧）；`audio.beat_grid: []`、`hit_list: []`，无逐拍映射，`≤3 处` 与「相邻间隔 ≥16 拍」均不构成违规 |
| Q1 | ✗(`s03·f210–f329` / `f270`) | 「124 张镜头配方卡」只有一行标题文字，无卡片、无 UI、无产品截图。非复刻场景允许手搓，但 Q1 硬门槛「观众一眼看懂它是什么」与 Q10 出版级质感均未过；`design_spec.data_policy` 已声明全虚构，数据口径无敏感内容（这一项 ✓） |
| Q2 | ✓(`f45`) | 全片无 3D 透视、无 UI 纹理 rasterize、无 `transform scale` 放大链路；文字为 DOM 文本，Pillow 实测 f45 标题亮像素带 69px、边缘清晰无像素方块，无「先调景深治标」的失败模式 |
| Q3 | ✓ | 逐帧看 `f45/f150/f270/f360/f429`：无非叙事意图的相机抖动；grid 的 26px 平移是每镜固定层内位移，非 handheld 噪声。`index.html` 无 shake/random 抖动量 |
| Q4 | ✓ | 全片 glint / sheen / sweep **0 次**（grep 无 `filter: blur`、无扫光节点），不存在群发或光溢出圆角。代价是 s05 连「主角一次」的加冕光也没有，收尾质感缺口并入 Q8 |
| Q5 | ✗(`s01·f45`) | 开场同屏 4 行文字（eyebrow / title / sub / foot）+ 右上「01 / 5」角标 + 左下进度条 + 满屏网格 + 琥珀光晕，非「单主角」；动作只有 0.62s 淡入缩放，无聚光→推近→悬浮→描边光→归位的完整弧 |
| Q6 | ✓ | 5 镜全为正视、无 `rotate/perspective/rotateX`，文字水平且可读（`f45/f150/f270/f360/f429` 均清晰）；未犯「全局一刀切倾斜」错误。但反过来说全片零机位语言，属设计感缺口（§4） |
| Q7 | —(N/A) | 全片无物件/资产特写镜头，`shots` 无 object close-up，`styleframe_refs: []`；侧面倾斜角/体积高度/orbit/反差金属背景四件套无适用对象 |
| Q8 | ✗(`s05·f390–f467`，重点 `f429/f456/f460`) | 收尾仅 L140 一条 `opacity:0→1, 0.5s` fade（manifest `primitive: fade`，分镜 `transition_in: hidden-cut`，已降档）：无全片元素四方飞入围住字标、无 crane 运镜/舞台光/粒子、无已展示功能的代表元素；f429/f456/f460 三帧近乎逐像素相同，`peak` 实为全片最弱 |
| Q9 | —(N/A) | 无「飞入后嵌入页面真实槽位」的结构：全部动效就是整块 `shot__body` 位移，既不存在永久悬浮元素，也不存在布局槽位可落 |
| Q10 | ✗(`s03·f210–f329` / `f270`) | 「展示镜头配方卡」正是判例点名的「贴图+标语」级假文档反例：无原生排版、无铺满的真实密度内容、无卡面/侧栏/评论栏版式；`f270` 下半屏约 730px 完全空白 |
| Q11 | ✗(全片 5 镜·`shot__foot` / `shot__edge`) | 主标题 65px（f45 实测墨迹带 69px）≥56px ✓、副文 36px ≥32px ✓；但脚注（`card_id · primitive`）与角标（`01 / 5`）35px × `opacity 0.72 / 0.6` × `#8A8F9A`，缩到 480px 宽手机小窗约 15–16px 且低对比，正是判例明禁的「想让人读却读不清」中间态。另判例同时写「≥5.2% 帧高」，本片帧高 1920 → 应为 100px，标题 65px 仅 3.4%；56px 绝对值与 5.2% 相对值在 9:16 下自相矛盾（判例按 1080 高横屏写就），须在项目说明里重定竖屏字高口径 |
| S1 | ✗(全片 `f0–f467`) | `audio.bgm.ref:""` / `bpm:0` / `sfx:[]` / `voiceover:[]`；check 报告 `craft.film_silent` + `audio.audio_none(info)`；无强鼓点电子底、无 whoosh/impact/riser/sparkle 词汇，闭眼只听音轨不成立 |
| S2 | ✗(全片) | 无「帧号 + 音源 + 音量」声明式 SFX 表，无逐条动作注释，无双样本交替 / 音量阶梯递减 / 间隔加速；`sfx: []` 无任何逐拍钉帧记录 |
| S3 | ✗(全片) | 声音层完全缺位，未执行「画面锁定后再铺音」；且本片时序已由分镜 450f/15s 变为 468f/15.6s（见 §3.5），后期补音时须按新时间线全表重钉 |
| S4 | ✗(全片) | 可辨识动作（字标落定、主标题滑入、卡片堆叠、收尾淡入）全部无拟音，无「音频裁到与动作严格等长」的 Sequence 截断 |
| S5 | —(N/A，后续必查) | 当前无音轨，输出音轨 AAC priming 偏移与音源峰值滞后无从实测。补音后必须按本管线（H.264/AAC/48kHz/MP4）用 2–3 个尖锐 SFX 归一化交叉相关实测记档，并在 `from` 计算式统一扣除 |
| C1 | ✗(全片 5 镜) | `shot__sub` 直接是分镜 `action` 字段（「主标题模糊滑入落定」「字标锁定 hold 满 1 秒」「停顿留白」），`shot__foot` 是 `card_id · primitive` 制作元数据；二者被当作字幕烧进画面，属占位文案未在画面锁定后重写。`voiceover: []`，纯动画段落无解说 |
| C2 | ✗(`s02·f90–f209` / `s04·f330–f389`) | 「普通模型，也能有导演级设计感」无产品功能名 / 具体收益，且与 brief「让普通模型也有 **Opus 级** 设计感」用词不一致；「先确认分镜，再开机」为抽象口号，「分镜确认门」功能未出场、重要功能前无引导字卡 |
| C3 | —(N/A) | 全片无 3D 镜头、无画内注记文字，不存在「平面叠字与场景脱节」 |
| P1 | ✓ | `verify.json`：`error_count 0`、`empty_frames 0`、7 帧 303961–320070 B 全部非零；`contact-sheet.jpg` 已出；check 报告 `layout 0 issue`、`contrast 25/25 passed`；本终检亦用 `read_image` 亲眼看拼图与 3 张单帧，并用 Pillow 量了文字墨迹带 |
| P2 | —(N/A) | `design_spec.styleframe_refs: []`，无参考素材可作 motion breakdown；未发生「把一张参考图当全片风格令」，也无手法采用/弃用记录可查 |
| P3 | —(N/A) | 干净上下文终检，无用户反馈回合可验；`video-state.json` 只有 2 条 `Changed outside the app` revision，未见独立 commit 粒度的干净 revert 证据 |
| P4 | ✗(`s02·f90–f209` 与 `s04·f330–f389`；全片 5 镜) | ①功能清单两项目标（124 张配方卡、分镜确认门）都只以文字出现，核心功能漏拍；②manifest `primitive` 的 `slide-up` 在 s02、s04 重复当主角；③5 镜共用同一版式/配色/72px 网格/进度条/角标，仅换文字——拼图上 `f45/f150/f270/f360` 结构完全一致，属「同一素材/信息全片重复」 |

**统计**：`✓ 7`（R1/R4/Q2/Q3/Q4/Q6/P1）、`✗ 14`（R2/R3/Q1/Q5/Q8/Q10/Q11/S1/S2/S3/S4/C1/C2/P4）、`—(N/A) 6`（Q7/Q9/S5/C3/P2/P3），合计 27 条。所有 ✗ 均未在 `project.json` / 分镜说明里找到「有意识违反 + 原因」的记录，按 `SKILL.md` §逐条过准则「未写明的 ✗ 一律算缺陷」计入缺陷清单。

---

## 3. 重点核对（委托方指定的 7 项）

### 3.1 R1 品牌字标 hold —— ✓（字标层达标，整帧有保留）

`s01` body tween `duration:0.62` 起于 0s → `f19` 落定，至 `f89` 切镜，静止 **71f / 2.38s**；`s05` body tween `duration:0.5` 起于 13s → `f405` 落定，至 `f467` 片尾，静止 **63f / 2.1s**。两处停顿给的都是品牌 wordmark（「影铸 CineForge」「CineForge · 开源」），不是普通内容卡，且远超 `energy-arc.json` 的 `brand_hold_min_f: 30` → **R1 通过**。

保留意见：判例要求「承载信息的元素落定后静止」，本片 `shot__grid` 在 5 镜中始终以 `ease:"none"` 匀速横移，连最后一帧 f467 都在动，因此**没有任何一帧是整帧安静的**。字标层合规、画面层不合规，后者按 R2 记缺陷。另 f429/f456/f460 三帧近乎逐像素相同，说明 s05 的 hold 实际是「一开始就静止」，而非「动作高潮后落定呼吸」——hold 有了，能量峰值没有（见 3.7）。

### 3.2 R2 收尾 0.5s 停顿 —— ✗（静止 0f）

最后一条 tween 是 `tl.fromTo("#shot-4-grid", {x:0}, {x:26, duration:2.6, ease:"none"}, 13)`，结束时刻 `13 + 2.6 = 15.6s`，**恰为全片最后一帧 f467/f468**，收尾静止 **0 帧**，低于 `batch_settle_min_f: 15`（0.5s）。同时 `ease:"none"` 是判例直接点名的「匀速直线运动读作廉价 PPT」，且 5 镜 grid 全用同一写法，不是偶发。s03 声称的「卡片堆叠错落入场 / 越来越快 / 最后停顿 0.5 秒」在 `index.html` 里完全不存在：只有 L136 一条 0.55s `xPercent:16→0`，无批量元素、无错峰、无加速、无 settle。

### 3.3 竖屏安全区 —— ✓ 合规，但构图失衡

`platform-presets.json` douyin：`底部 20% 与右侧 15% 须留白` → 1920×0.20 = **384px**、1080×0.15 = **162px**。
`index.html` L16：`--pt:346px; --pb:730px; --pl:140px; --pr:324px;` → `.shot__body` 内容区 `y=346..1190`、`x=140..756`；底部留白 **730px ≥ 384px** ✓、右侧留白 **324px ≥ 162px** ✓。Pillow 实测 f45 全部文字墨迹带落在 `y=643..891`，未侵入底部交互区；`.shot__edge` 为 `right:324px`、`.shot__bar` 为 `bottom:730px`，均在留白之外。`.shot__bg` / `.shot__grid` 虽 `inset:0` 铺满全帧，但属装饰底纹而非文案，可接受。**安全区判定通过。**

但 `pb = 730px`（占帧高 **38%**）远超 384px 下限，加上 `pt = 346px`，内容只占中部 ~44%：拼图与 f45/f150/f429 单帧都可肉眼确认**下半屏约 1/3 完全空白、头重脚轻、信息密度极低**。另 douyin `notes` 的「前 3 秒钩子」与「硬字幕」未满足：`s01 f0–f89` 是纯品牌字标无钩子；画面里烧的是标题/制作元数据，不是对白硬字幕（`voiceover: []`，无旁白亦无字幕轨）。

### 3.4 字幕有效字高 —— ✗（主字幕达标，辅助文字触犯中间态）

按判例「验收量渲染帧上的实际像素，不看代码里的 fontSize」，用 Pillow 对 `f45 (1.5s)` 逐行统计亮像素带（阈值 RGB 和 >300，x=100..1000 每 2px 采样），得到四条：`[643–667, 25px]` eyebrow、`[698–766, 69px]` 主标题、`[790–822, 33px]` 副文、`[874–891, 18px]` 脚注。与 CSS `--title-px:65px / --sub-px:36px / --small-px:35px` 吻合。

- 主标题 65px（墨迹带 69px）≥ 56px ✓、副文 36px ≥ 32px ✓，在 480px 宽小窗（缩放 0.444）下分别约 29px / 16px，主标题仍可读。
- `shot__foot`（`brand-ink-open · crash-zoom` 等制作元数据）与 `shot__edge`（`01 / 5`）用 `35px × opacity 0.72/0.6 × #8A8F9A` 低对比灰，小窗下约 15–16px 且发灰，实测墨迹带仅 18–25px —— 正是 Q11 明令禁止的「想让人读却读不清」的中间态，判例要求「读不到的文字宁可删掉」。
- 口径矛盾：判例写「字幕有效字高 ≥56px（**≥5.2% 帧高**）」，56/1080=5.2% 是按 1080 高横屏写的；本片帧高 1920，5.2% 应为 **100px**，标题 65px 仅 3.4%。绝对值与相对值在 9:16 下不可同时成立，须在 `project.json` 或设计说明里显式重定竖屏字高阈值并写明「有意识偏离」。

### 3.5 确定性渲染 —— 代码级 ✓ / 工程级 ✗（有条件通过）

**通过项**：grep `index.html` 无 `Date.now` / `Math.random` / `fetch(` / `XMLHttpRequest` / 运行时数据请求；`meta.json` 的 `createdAt: "cineforge-deterministic"`（无时间戳）；`manifest.json` `deterministic: true`；L130 `const tl = gsap.timeline({ paused: true })`；L131 **恰好一个** paused timeline 注册 `window.__timelines["main"] = tl`；L142 `tl.seek(0)`；10 条 tween 全部为绝对时间轴位置的 `fromTo`（0/3/7/11/13s），无相对偏移、无随机错峰。`lib/hf-timeline.js` 模板与产物一致。

**未通过项（工程可复现性）**：
1. L7 `<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js">` —— 存在**外部 CDN 网络依赖**。虽版本已固定 3.15.0、且非运行时数据请求，但未 vendor 到本地；离线/内网/ CDN 变更环境下无法字节级复现。委托方要求的「无网络请求」应理解为「无运行时数据请求」，此处须如实标注。
2. `hyperframes.json` L3 `registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry"` —— 指向 `main` 分支、**未钉 tag/commit**，上游移动会改变可复现基线。
3. `window.__timelines` 在产物与模板中均**只被赋值、未被初始化**（`hf-timeline.js` L2、`index.html` L131 直接下标写），依赖宿主运行时预先注入；无 `window.__timelines = window.__timelines || {}` 兜底，脱离 HyperFrames 宿主单独打开即抛错。
4. `platform-presets.json` 要求 `deterministic_seed_required: true`，产物中未见任何 seed 字段。

**方案一致性附带发现**：分镜源 `duration_s:15`、s05 `duration_f:60`（`project.json` 同），而 `manifest.json` 为 `15.6s / 468f`、s05 `78f` —— **总时长与 s05 帧数不一致（450f → 468f）**；另分镜 `transition_in` 与 manifest `primitive` 口径未对齐：s01 `fade` vs `crash-zoom`、s04 `fade` vs `slide-up`、s05 `hidden-cut` vs `fade`（收尾降档）。这些偏离均未写进项目说明。

### 3.6 每镜只讲一个主动效 —— 数量 ✓，执行 ✗

`index.html` L132–141：每镜恰好 2 条 tween —— ① 一条 body 入场（**唯一的主动效**）② 一条 grid 匀速漂移（背景层，全片常驻）。主动效清单：s01 `crash-zoom`（scale 1.32→1 + opacity, 0.62s）、s02 `slide-up`（yPercent 14→0 + opacity, 0.55s）、s03 `slide-left`（xPercent 16→0 + opacity, 0.55s）、s04 `slide-up`（同 s02）、s05 `fade`（仅 opacity, 0.5s）。单镜主动效数量 = 1，**「只讲一个主动效」在数量上合规**。

但执行上有四处不成立：① `slide-up` 被 s02 / s04 复用为两镜主角（P4 ✗）；② grid 是叠加在主动效之上的第二层**持续匀速**运动，全片不落定，破坏「落定后呼吸」（R2 ✗）；③ s05 从分镜的 `hidden-cut` 降档为最弱的 `fade`，连位移/缩放都没有；④ 5 条主动效全是「整块 body 淡入 + 单向位移」的同一语法（`back.out(1.7)`），无 Q8 合影 / Q10 版式 / 运镜 / 光效之别，`f45/f150/f270/f360` 在拼图上结构完全一致 —— 镜与镜之间只有文字在变。

### 3.7 能量交替 —— ✗（声明未落地，收尾反为最弱）

- **数据层**：`design_spec.energy_curve = opening(low) -> function(mid-high) -> breath(low) -> outro(peak)` 写的是「1 个功能段 → 1 个呼吸位」，而 `project.json` 实际是 `low / mid-high / **mid-high** / low / peak` —— s02、s03 连续两镜同能量，中间**没有呼吸位插入**，与 `energy-arc.json` 的 `功能段与呼吸位交替` 原则不符。
- **画面层（更重）**：5 镜视觉能量几乎恒定——同一版式、同一 0.5–0.62s `back.out(1.7)` 入场、同一 72px 网格、同一层 `radial-gradient` 琥珀光晕、无 BGM / SFX / 粒子 / 运镜 / 光效 / 景深。标 `peak` 的 s05 只有一条 0.5s opacity fade，比 s01 的 `crash-zoom`(scale 1.32→1) **更弱**；f429/f456/f460 三帧近乎逐像素相同。**收尾不是全片峰值，而是全片最弱**，与 `energy_curve outro(peak)`、`energy-arc.json` 段位表④、Q8 均相悖。
- s04 标 `low` 且分镜写「停顿留白」，但它同样有 0.55s body 滑入 + 2s grid 匀速，与 s02 的 `mid-high` 在画面上无可辨差异 —— 能量标签只存在于元数据，未编码进画面。

---

## 4. 画面实评（基于 `read_image` 亲眼查看的 contact-sheet 与单帧）

**拼图构成**：7 帧按 3+3+1 排布（1.5s / 5s / 9s / 12s / 14.3s / 15.2s / 15.35s），最后一格为空白底板。7 帧均为 1080×1920、非零字节，与 `verify.json` 一致。

**看到了什么**：5 镜共用**同一张模板** —— 深墨底 `#0B0E14`、满屏 72px 细网格、右上角固定琥珀 `radial-gradient` 光晕、左上琥珀大写 eyebrow（`01 · OPENING` 等）、白色主标题、灰色副文与脚注、左中一根细进度条（琥珀 42%）、右上 `0X / 5` 角标。`f150` 标题因「普通模型，也能有导演级设计感」折成两行，是 7 帧里唯一的版式差异。`f429 / f456 / f460` 是同一 outro 的三张近似重复帧。

**文字可读性**：主标题白字在深底上清晰，contact-sheet 缩略图里也能读出；副文/脚注/角标（`35px × opacity 0.72/0.6 × #8A8F9A`）在拼图缩略尺寸下几乎不可读，落在 Q11 禁止的中间态（§3.4）。

**竖屏安全区留白**：底部/右侧交互区确已留白（§3.3 ✓），但留白过度 —— 下半屏约 38% 完全空，画面头重脚轻，是「一期占位模板」而非成片构图。

**镜头间变化是否足够：不够。** 只有文案、编号、标题行数变化；配色、网格、光晕、进度条、角标位置、机位、运动语法全部相同。14.3s / 15.2s / 15.35s 三帧近乎逐像素相同，7 帧里有 3 帧是同一 outro。这既印证了 R1 的 hold，也暴露 Q8「发布会合影峰值」完全没有实现。

**离「Opus 级设计感」还差什么（如实，不吹捧）**：这是**一期品味层的占位式样片**——纸墨琥珀风 + 字卡 + 网格的 CSS 模板，不是产品预告成片。具体差距：
1. **没有真实产品截图、没有配方卡实物**：「124 张镜头配方卡」「分镜确认门」两个核心卖点全靠一行文字宣称，画面上没有任何卡片、网格陈列、UI、dashboard 或分镜确认界面（Q1 / Q10 / P4）。
2. **没有复杂光影片段**：唯一的「光」是一层固定的 CSS `radial-gradient`，无聚光扫字、无 sheen、无粒子、无舞台光、无景深、无材质反射、无明暗反转；深底本可做光却被浪费（Q4 虽 ✓ 但 0 次）。
3. **没有出版级排版密度**：4 行文字 + 大片空白，无侧栏/卡面/评论栏/页眉等版式元素，远不到 Q10 的「文字铺满、完整版式入镜」。
4. **没有镜头语言**：全片零运镜、零 3D、零物件特写、零机位变化，5 镜同一正视模板（Q6 ✓ 但 Q7/Q8/C3 无对象）。
5. **工程感外露**：`card_id · primitive`、`01 / 5`、进度条、分镜 `action` 原文被当作装饰文字印在画面上，观众看到的是调试面板而不是品牌片（C1）。
6. **无节奏能量**：无音轨、无卡点、无加速、无收尾峰值，5 镜平铺（§3.7）。

结论：作为「一期品味层 / 模板可用性」的占位样片，它**自洽、干净、配色统一、安全区合规、渲染确定性基本成立**；但作为一支要发布的抖音产品预告，它离「Opus 级设计感」差的是**内容证据与设计层级**，不是差一点调色——需要整镜重做功能展示与收尾，而非微调参数。

---

## 5. 缺陷清单（按严重度排序）

| 优先级 | 缺陷 | 帧号/位置证据 | 违反准则 | 建议改法 |
|---|---|---|---|---|
| **P0 阻断发布** | 发布合规四件套全空：`ai_disclosure.explicit=false / implicit=false`、无 BGM/字体授权记录、无无极限词自检、`cover/title/description/tags` 空 | `project.json` L112–125 | 平台合规 / §8 | 补齐 AI 显式+隐式双标识、授权链、极限词自检、封面与文案，再谈发布 |
| **P1 高** | 全片无音轨（`film_silent`） | `verify.json` craft warning；`audio` 全空；`render-outputs.json` 仅 1 个产物 | S1/S2/S3/S4、SKILL 报告项 5 | 补强鼓点电子底 + whoosh/impact/riser/sparkle 词汇，按 468f 时间线钉 SFX 帧号表，**并渲出带 BGM / 无 BGM 两版** |
| **P1 高** | 两个核心功能只以文字宣称，无功能镜头 | `s03·f270`、`s04·f360` | Q1 / Q10 / P4 / C2 | 用真实配方卡/分镜确认门界面（或达标手搓 UI）重做这两镜，出版级排版铺满 |
| **P1 高** | 收尾降档，非发布会合影、非峰值 | `s05·f429/f456/f460`；L140；manifest `primitive: fade` | Q8 / R1 保留 / 能量曲线 | 改为多方向飞入合影 + crane/舞台光/粒子 + 峰值运镜，落定后 wordmark hold ≥1s |
| **P1 高** | 能量交替失效：s02/s03 连续 mid-high 无呼吸位，画面能量恒定，收尾最弱 | `f150/f270/f429` | energy-arc / Q8 / R1 | 在 s02/s03 之间插呼吸字卡；把 peak 真正编码进画面（运动幅度/层数/光效/音效） |
| **P1 高** | 全片匀速直线运动 + 收尾 0f 静止 | L133/135/137/139/141；末帧 `f467` | R2 / R3 | grid 改非线性缓动或落定静止；末镜倒推预留 ≥15f settle；s03 改发牌式硬加速 + 0.5s 停顿 |
| **P2 中** | 辅助文字落入「读不清中间态」；竖屏字高口径矛盾 | `f45` 墨迹带 18/25px；L31/L34/L35 | Q11 | 删除 `shot__foot`/`shot__edge` 或提到达标字号+对比度；在说明里重定 9:16 字高阈值 |
| **P2 中** | 制作元数据与分镜 `action` 原文烧进画面；brief 与 s02 文案用词不一致 | 5 镜 `shot__sub`/`shot__foot`；`f150` | C1 / C2 / 方案一致性 | 画面锁定后按最终镜头重写全部文案；统一「Opus 级 / 导演级」措辞 |
| **P2 中** | 工程级可复现性：CDN 外链、registry 未钉版本、`__timelines` 未初始化、无 seed | L7、`hyperframes.json` L3、L131 | 确定性 / `deterministic_seed_required` | vendor GSAP、registry 钉 commit、加 `|| {}` 兜底、补 seed 字段 |
| **P2 中** | 分镜与编译清单不一致：15s/450f → 15.6s/468f；s05 60f → 78f；3 处 transition/primitive 口径漂移 | `demo-project.json` vs `manifest.json` | 方案一致性 / S3 | 统一单一信息源，或把偏离写进项目说明 |
| **P2 中** | 前 3 秒无钩子、无对白硬字幕 | `s01·f0–f89` | platform-presets douyin | 前 3s 给利益点/悬念；补硬字幕轨或明确无旁白口径 |
| **P3 低** | 构图过度留白（pb=730px / 38% 帧高）、5 镜同版式镜头间变化不足 | 全部 7 帧 | P4 / Q5 / 画面实评 | 收窄 padding、提高信息密度；每镜换运动语法与构图 |
| **P3 低（一期豁免）** | 7 条 warning：`timeline_track_too_dense` ×1、`nested_structure_needs_subcomposition` ×5、`film_silent` ×1 | `verify.json` / check 报告 | — | 前 6 条属二期子组合改造（`data-composition-src`），按 `verify.json` note 一期不拦截；**`film_silent` 不属可豁免项**，已列 P1 |

---

## 6. 数据安全结论

**通过（成片画面内）**：`design_spec.data_policy = "全部为虚构占位文案，无真实数据"`；`publish` 的 title/description/tags/cover 全空；逐帧可见文字仅为品牌名、标语、编号、卡名与 primitive 名，未发现未授权的客户名、个人信息、内部资料、密钥、实时数据或真实截图。Q1 的「数据口径」自查项 ✓。

**外发前需清理（工程产物，非成片画面）**：`video-state.json` 与 check 报告内含大量本机绝对路径（`C:\Users\15056\.cache\hyperframes\…`、`D:\01_HJ_Work\…`），项目内另有 `.local/state/gh/device-id` 设备标识。若把整个 `out/` 或仓库整包交付第三方，应先脱敏这些路径与设备 ID。`index.html` L7 的第三方 CDN 属外部依赖，不属数据泄露，但应在供应链清单里登记。

---

## 7. 两版核对（SKILL 报告项 5）

**未通过**：`out/cineforge-demo-01/.hyperframes/render-outputs.json` 只有 `{"version":1,"paths":["renders/cineforge-demo-01.mp4"]}`，**仅 1 个渲染产物**；`video-state.json` `renders.latest` 亦只有 `991f9010-…` 一条，`retainedRevisions` 只有 1 个。即：**只渲出了无 BGM 版（且该版本身完全没有音轨），带 BGM 版未渲出**。SKILL 要求「带 BGM 与无 BGM 版都已渲出」，本项 ✗，与 §5 的 P1 音频缺陷合并整改。

---

## 8. 发布合规（未发布草稿，严禁进入发布阶段）

本例 `publish` 块为未发布草稿（`platforms:["douyin"]` 之外全空、`schedule:""`），且 `ai_disclosure: { "explicit": false, "implicit": false }`。`platform-presets.json` douyin `notes` 明确「建议 AI 生成声明如实评估」。

> **明确结论：不得进入发布阶段，除非补齐以下三项（及附带项）**：
> 1. **AI 显式 + 隐式双标识** —— 显式：画面/标题/简介中如实声明 AI 生成；隐式：文件元数据、水印或数字水印等可机读标识。当前 `explicit=false`、`implicit=false`，两项均缺。
> 2. **BGM / 字体授权** —— 当前 `bgm.ref:""`、`sfx:[]`、`voiceover:[]`（无音轨，`film_silent`），一旦补配乐/音效须留存可商用授权链；当前字体为 `sans-serif` 系统字族无额外授权风险，但若替换为商用字体须一并补齐授权。
> 3. **无极限词** —— 现文案未见「最/第一/唯一/顶级」等典型极限词，但 brief 与 s02 存在「Opus 级设计感」/「导演级设计感」的对标宣称且两处措辞不一致，发布前须法务复核、统一口径并留存极限词自检记录。
> 附带：`cover_required: true` 而 `cover:""`，`caption_required: true` 而硬字幕缺失，标题/描述/标签为空，前 3 秒无钩子 —— 均需补齐后方可提交发布流程。

---

## 9. 5 项结论与最终建议

> 口径说明：`SKILL.md` 列 6 维度，其中「视觉技术质量 / 音频技术质量」按委托方要求合并为第 4 项，共 5 项。

| # | 维度 | 结论 | 依据 |
|---|---|---|---|
| 1 | **方案一致性** | **部分不符** | 画幅 9:16 / 5 镜 / 配色 `ground #0B0E14 / ink #F5F1E8 / accent #D3923C` / 纸墨琥珀风 / 占位文案口径 与简报一致 ✓；但 `15s→15.6s`、`s05 60f→78f`、3 处 transition/primitive 漂移、brief「Opus 级」vs s02「导演级」、`energy_curve` 声明 1 个功能段实为 2 个，且**所有偏离均未写进项目说明**（违反 `aesthetic-rules.usage` 与 SKILL「偏离必须写进说明」） |
| 2 | **功能完整性** | **不通过** | goal 的两个记忆点「124 张镜头配方卡」「分镜确认门」都只有文字、无功能镜头（Q1/Q10/P4/C2 ✗）；`outro-group-photo-launch` 卡的「合影」结构完全未实现（Q8 ✗） |
| 3 | **镜头还原度** | **不通过（明显降档）** | 5 镜全部降为「整块 body 淡入 + 单向位移」同一模板：s03「卡片堆叠错落入场」无堆叠、s04「停顿留白」仍有滑入、s05「字标锁定 hold / hidden-cut」降为 opacity fade；无 3D、无运镜、无光效、无批量加速；`primitive slide-up` 还被复用两次 |
| 4 | **视觉与音频技术质量** | **视觉：工程合格、审美不达标；音频：不通过** | 视觉：`0 error / 7 warning / 7 帧非零`、对比度 `25/25 passed`、无抖动无穿帮、文字锐度合格、安全区合规 ✓；但辅助文字中间态、5 镜同版式、无复杂光影/真实截图/出版级排版、收尾最弱 ✗。音频：全片 0 音轨、`film_silent`、无 BGM/无 BGM 两版未渲出、S1–S4 全 ✗ |
| 5 | **数据安全** | **通过（成片画面内）** | 全部虚构占位文案，无客户/个人/内部/密钥/实时数据；`data_policy` 已声明 ✓。外发整包前需清理 `video-state.json`/check 报告中的本机绝对路径与 `.local/state/gh/device-id` |

### 最终建议：**打回**

理由：P0 发布合规四件套全空 + P1 级功能性缺陷（核心功能漏拍、收尾降档、能量曲线未落地、全片无音轨、无 0.5s 收尾停顿）均属**需整镜重做**而非参数微调；27 条判例中 14 条 ✗ 且无一写入「有意识违反 + 原因」。按 `SKILL.md` 总判三档，对应「需返工」。

**有条件的例外（仅限内部归档，不是放行发布）**：若委托方确认本例只作「一期品味层占位式样片 / 模板可用性证据」留档，可**有条件放行归档**，条件为：① 在文件名与 `out/qa/` 中标注 `NOT FOR PUBLISH / 一期占位样片`；② 对 7 条 warning 出具书面豁免（其中 `film_silent` 不予豁免，需记为已知缺陷）；③ 冻结当前 revision `02ebe52b-…` 与 7 帧静帧作为基线；④ 把 §5 的 P1/P2 缺陷登记为二期整改项。**任何面向 douyin 的提交、预览或分发都不在此例外范围内。**

**整改优先级顺序**：P0 发布合规 → P1 音频两版与 SFX 钉帧 → P1 核心功能两镜重做 → P1 收尾发布会合影与能量峰值 → P1 R2 匀速/停顿 → P2 文案重写与字高口径 → P2 确定性与单一信息源 → P3 构图与子组合改造。

---

## 10. 高频缺陷 10 条命中情况（SKILL §高频缺陷）

| # | 高频缺陷 | 本片 | 说明 |
|---|---|---|---|
| 1 | 品牌字标 hold 不足 30f / hold 加错对象 | **部分命中** | 两处 wordmark hold 71f/63f 均达标且对象正确；但 hold 是「一开始就静止」，非动作高潮后落定，且网格层未停 → 整帧无完整静止时刻 |
| 2 | 匀速直线运动 / 批量没加速 / 收尾没留 15f | **命中（最重）** | 5 条 grid `ease:"none"`；s03 无批量无加速；末帧静止 0f |
| 3 | 初版节奏过快 | **部分命中** | 镜头总长 2–4s 尚可，但主体动作弧仅 0.5–0.62s（R3 ✗） |
| 4 | 逐拍全画面泵 = 观感抖动 | 未命中 | 无 BGM、无 beat_grid、整画面冲击 0 处 |
| 5 | 逐卡 glint 群发 / 光溢出圆角 | 未命中 | 全片 0 次光效（但也因此收尾无加冕光） |
| 6 | 开场多主角群舞 | **命中** | s01 同屏 4 行文字 + 角标 + 进度条 + 网格 + 光晕（Q5 ✗） |
| 7 | 3D 透视下文字糊 | 未命中 | 无 3D / 无纹理栅格化链路，f45 标题实测 69px 清晰 |
| 8 | 复刻既有页面却手搓 UI / 真实截图混进真实数据 | **部分命中** | 未复刻既有页面、无真实数据 ✓；但「124 张卡」「分镜确认门」声称展示产品却连手搓 UI 都没有，表达明确性硬门槛未过 |
| 9 | 全局一刀切倾斜机位、列表页文字读不清 | 未命中 | 全片正视、文字水平可读；反面是全片零机位变化 |
| 10 | 字卡文案与 outro tagline 重复 | 未命中（但同族） | s02 与 s05 文案不重复；命中同族问题「5 镜同版式 / 制作元数据入画 / brief 与 caption 措辞不一致」 |

---

## 附：主要证据索引

- `out/qa/cineforge-demo-01.verify.json`：`error_count 0 / warning_count 7 / empty_frames 0 / 7 帧 bytes`
- `out/cineforge-demo-01/.hyperframes/artifacts/checks/c4619e2f-32b1-427e-9b06-195d848bdda0.json`：`lint 6 warning`、`craft film_silent`、`audio audio_none`、`layout 0 issue`、`contrast 25/25`
- `…/snapshots/3febdc43-7a3c-4c37-8ea4-cb59beac181c/contact-sheet.jpg`：亲眼查看；`frame-00-at-1.5s.png` / `frame-01-at-5s.png` / `frame-04-at-14.3s.png`：1080×1920 单帧亲眼查看
- `out/cineforge-demo-01/index.html` L7 / L16 / L130–142：CDN、安全区变量、paused timeline、10 条 tween、`seek(0)`
- `out/cineforge-demo-01/manifest.json` vs `examples/demo-project.json` / `project.json`：15s/450f vs 15.6s/468f、s05 60f vs 78f、primitive 对照
- `out/cineforge-demo-01/.hyperframes/render-outputs.json`：仅 1 个渲染产物（两版核对 ✗）
- `out/cineforge-demo-01/meta.json`：`createdAt: "cineforge-deterministic"`
- `knowledge/energy-arc.json`：`brand_hold_min_f 30 / batch_settle_min_f 15 / opening_hero_min_s 3 / full_frame_beats_max 3`
- `knowledge/platform-presets.json` douyin：底部 20% / 右侧 15% / 前 3 秒钩子 / 硬字幕 / AI 声明；`common.deterministic_seed_required: true`
- Pillow 实测 `frame-00-at-1.5s.png` 亮像素带：`[643–667,25] [698–766,69] [790–822,33] [874–891,18]`（单位 px）

> 本报告为独立终检结论，未修改任何源文件、未重新渲染、未改动除本文件外的任何产物。