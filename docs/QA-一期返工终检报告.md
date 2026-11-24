# CineForge v0.3 返工终检报告 · `cineforge-demo-01`

> 终检员：干净上下文独立 subagent（未参与制作，不读取制作过程，仅依据输入材料与成片判定）。
> 依据：`skills/cineforge-qa/SKILL.md`、`knowledge/aesthetic-rules.json`（27 条）、`docs/QA-一期终检报告.md`（0.2.0 基线，【打回】✓7/✗14/N/A6，未改写）。
> 记号：`✓` 通过；`✗(位置)` 未通过且可定位；`N/A` 无适用对象。帧率 30fps，帧号由 `start_s/fps` 换算。
> 口径说明：`2` 的 27 条表按「规则主要硬门槛是否可验证满足」判 ✓/✗/N/A；`3` 的旧 14 条按「原缺陷证据是否 100% 消除」判 已修复/部分修复/未修复。两把尺不同，故同一条可出现「27 表 ✓ ＋ 旧表 部分修复」，`2` 单元格内均写明保留项。

## 0. 结论先行

**总判：【有条件通过】** —— 仅限「一期内部归档 / 模板可用性验收」口径；**若按「可发布成片」口径，本片仍应为【打回】**。

- **硬条件未解除：「不得进入发布阶段」仍成立。** `examples/demo-project.json` L245–258：`publish.ai_disclosure.explicit=false / implicit=false`、`title:""`、`description:""`、`tags:[]`、`cover:""`、`schedule:""` 与 0.2.0 完全相同；`manifest.json` L212 亦自报 `publish_allowed:false`。v0.3 新增的 `aigc-metadata.json` 与 `index.html` L7 只是把标识素材摆上桌，开关仍是 false（`7`）。
- **工程/结构层确有实质返工**：`verify.json` `error_count:0`、`warning_count:7`、`empty_frames:0`；确定性、时长恒等、SHOTS 单一事实源、GSAP 本地化、registry 钉 commit、`window.__timelines` 兜底、首帧非空、安全区 px 化、制作元数据出画、6 镜 6 版式、BGM+6 SFX 均已落地（`5`）。0.2.0 的「功能性缺陷」中，两个核心功能漏拍已补。
- **但视觉质量不因 `0 error` 而提升**：它仍是**字卡模板片**——6 镜共用同一 `radial-gradient` 底、72px 网格、eyebrow、进度条、foot 骨架与同一条 0.62s `back.out(1.7)` 入场，只是换了 6 个内容模块；无真实产品截图、无复杂光影、无出版级排版、无运镜/3D/镜头语言，`peak` 收尾仍近乎静止（`9`）。
- **未闭环项**：音频「已测量未试听」、带/无 BGM 两版未渲、`S5` 音轨偏移无实测、`Q8/Q5` 两条旧 ✗ 基本未动、`out/` 整包仍含本机绝对路径（`8`）。

---

## 1. 证据清单（8 份必读材料全部亲自 read / read_image）

| # | 材料 | 关键事实 |
|---|---|---|
| 1 | `knowledge/aesthetic-rules.json` | `count:27`；R1–R4 / Q1–Q11 / S1–S5 / C1–C3 / P1–P4；`usage` 要求逐条输出编号 + 位置，且「有意识违反须写进项目说明」 |
| 2 | `examples/demo-project.json` | 6 镜 20s / 600f / 9:16 / douyin；6 layout；`audio.bgm.bpm:129`、`hit_list[0,3,6,10,14,17]`、6 条 `sfx`、`voiceover:[]`；`publish` 全空 |
| 3 | `out/cineforge-demo-01/manifest.json` | `compiler_version 0.3.0`；`20s/600f/padding_seconds:0`；`deterministic:true`、`seed:20261124`；`primitive_policy` 权威化；`aigc` 双 false；`publish_allowed:false`；`gsap_vendor` / `registry_pin` |
| 4 | `out/cineforge-demo-01/index.html` | 176 行；L8 本地 `vendor/gsap.min.js`；L17–20 安全区 px；L21–23 字高；L56–145 六 `<section>`；L147–153 七个 `<audio>`；L156–172 一条 paused timeline |
| 5 | `out/qa/cineforge-demo-01.verify.json` | `ok:true`；`error_count:0` / `warning_count:7`；`audio` 组 `error 0 / warning 0 / info 0`；`craft` 组亦 0/0/0；7 帧 484854–505328 B、`empty_frames:0` |
| 6 | `…/snapshots/cb5bd9ac-…/contact-sheet.jpg` | **已用 `read_image` 亲眼看**（1520×2758，原图 1816×3295），并调全分辨率复核小字；7 帧 3+3+1 排布 |
| 7 | `docs/QA-一期终检报告.md` | 0.2.0 基线：`✓7 / ✗14 / N/A6`；14 条 ✗ = R2/R3/Q1/Q5/Q8/Q10/Q11/S1/S2/S3/S4/C1/C2/P4 |
| 8 | `skills/cineforge-qa/SKILL.md` | 6 维度、27 行表、报告 5 项、高频缺陷 10 条；「不得因 check 0 error 吹捧视觉质量」 |

辅助核对（只读）：`out/cineforge-demo-01/aigc-metadata.json`、`assets/audio/ATTRIBUTION.md`（含 bgm/sfx 两份）、`hyperframes.json`、`meta.json`、`project.json`、`.hyperframes/render-outputs.json`、`.hyperframes/video-state.json`、check 报告 `6e291f93-….json`。

**帧号基准**：`s01 f0–f89 (0–3s)`、`s02 f90–f179 (3–6s)`、`s03 f180–f299 (6–10s)`、`s04 f300–f419 (10–14s)`、`s05 f420–f509 (14–17s)`、`s06 f510–f599 (17–20s)`；抽样 `1.5s=f45 / 4.5s=f135 / 8s=f240 / 12s=f360 / 15.5s=f465 / 18.5s=f555 / 19.75s≈f593`。

---

## 2. 逐条准则表（27 行）

| 编号 | 判定 | 证据 / 保留 |
|---|---|---|
| R1 | ✓ | `s06` body tween L170 于 17.62s 落定、进度条 L171 于 18.3s 结束，至 20s 全帧静止 **51f/1.7s ≥30f**；`verify.json` L145–150 `frame-05(18.5s)=499531 B` 与 `frame-06(19.75s)=499531 B` 字节完全相同，自证 hold。停顿给的是品牌字标 `CineForge · 影铸`。保留：`s01` L161 标题 3.0s 漂移恰止于切镜点，字标本身无独立静止段 |
| R2 | ✓ | 旧 ✗ 两处硬证据已消失：6 条 grid tween（L160/163/165/167/169）全改 `ease:"power2.out"`，无一处 `ease:"none"`；末条 tween 止于 18.3s，片尾静止 51f ≥15f(0.5s)。**保留**：分镜 `s03.action="三卡依次落定"`（`demo-project.json` L88）未落地——L96 的 3 张 `mini-card` 随 `#shot-3-body` 单块 0.62s 滑入（L164），无逐卡错峰、无「越来越快」硬加速、无发牌式物理隐喻 |
| R3 | ✓ | L161 `tl.fromTo("#shot-1-body .shot__title", …, {duration: 3.0, ease:"power2.out"}, 0)`：开场主体动作弧 **3.0s ≥3s**，旧 ✗「仅 0.62s」已修；片尾 51f hold/rest 预算亦已前置。**保留**：`s04` 声明「清单逐条勾选」，L111 三行 `check-row` 全为静态文本，无逐条动画、无「按真人操作速度」可跟随的交互 |
| R4 | ✓ | 全片整画面/相机层冲击 **0 处**（无震屏/闪帧/负片帧/整画面 scale 泵）；`hit_list` 虽已有 6 项但仅作候选池，`beat_grid:[]`，未做逐拍画面映射，`≤3 处` 与「相邻 ≥16 拍」均不触发 |
| Q1 | ✗(`s03·f180–f299 / L96`；`s04·f300–f419 / L111`) | 非复刻场景允许手搓，且 3 张配方卡 / 确认门清单 / 150 数字使「一眼看懂是什么」达标、`data_policy` 无敏感数据 ✓；但硬门槛「出版级质感（对照 Q10）」未过：mini-card 只是 `panel` 底 + 1px 琥珀边的小框，contact-sheet 第 3 格可见 meta 逐字折行，无真实页面截图、无版式密度 |
| Q2 | ✓ | 全片无 3D 透视 / 无 UI 纹理 rasterize 链路 / 无 `transform scale` 放大；文字为 DOM 文本，contact-sheet 主标题边缘清晰无像素方块 |
| Q3 | ✓ | `f45/f135/f240/f360/f465/f555` 均无非叙事相机抖动；`index.html` 无 shake/random 抖动量，grid 为 `power2.out` 层内位移 |
| Q4 | ✓ | 全片 glint/sheen/sweep **0 次**，无群发、无光溢出圆角。代价同旧片：`s06` 连主角一次加冕光也没有（并入 Q8） |
| Q5 | ✗(`s01·f0–f89 / L61–L69`) | 开场仍同屏 eyebrow `01 / 06 · OPENING` + 两行标题 + sub + foot + 进度条 + 满屏网格 + `radial-gradient` 光晕，非「单主体」；动作仍非「聚光→推近→悬浮→描边光→归位」完整弧。仅新增 L161 的 3s 标题缓动，未改变群元素结构 |
| Q6 | ✓ | 6 镜全正视、无 `rotate/perspective`，文字水平可读；未犯全局一刀切倾斜。反面是全片零机位语言（`9`） |
| Q7 | N/A | 无物件/资产特写镜头，`styleframe_refs:[]`，四件套无适用对象 |
| Q8 | ✗(`s06·f510–f599 / L133–L145, L170–L171`) | 卡名 `outro-group-photo-launch` 但收尾只有 `opacity 0→1, 0.62s`（L170）+ 进度条 `width 0→100%, 1.2s`（L171）：无全片元素四方飞入围住字标、无已展示功能代表元素、无 crane/舞台光/粒子。`frame-05` 与 `frame-06` 字节相同，`peak` 仍非全片能量峰值 |
| Q9 | N/A | 无「飞入后嵌入页面真实槽位」的结构：6 镜动效仍是整块 `shot__body` 位移。补充：`s03/s04` 现已有真实 grid/flex 布局槽位（L41–48），但没有元素单独飞入这些槽位 |
| Q10 | ✗(`s03·f180–f299 / L96, L45`) | contact-sheet 第 3 格亲眼可见 3 张 mini-card 的 meta 在窄列里逐字折行（`CAMERA / ID`、`TYPOGRA / PHY · 22`、`TRANSITI / ON · 15`），根因 L45 `font-size: calc(var(--small-px) * 0.80)` + `overflow-wrap: anywhere`；无「铺满真实密度的假内容」、无侧栏/评论栏/页眉，仍是判例点名的「贴图+标语」级 |
| Q11 | ✗(`s03·L45`；全片 9:16 口径) | 主标题 `--title-px:92px`、副文 `41px`、foot `37px / opacity .92`、eyebrow `37px / accent`、`metric-num 220.8px` 均达标，旧「读不清中间态」已大幅改善；但 `mini-card .meta = 37×0.80 = 29.6px < 32px` 且低密度折行，触犯辅助文字下限。另判例「≥5.2% 帧高」在 1920 高下应为 100px，92px=4.8%，竖屏字高口径矛盾仍**未写进项目说明** |
| S1 | ✓ | 书面选型合规：BGM `cineforge-bgm-20s.mp3` 派生自 Mixkit `Cat Walk / Arulo / House / ~129 BPM`（`assets/audio/ATTRIBUTION.md` L7–11），6 条 SFX 为 Mixkit 电影系 whoosh/impact/transition/click（同文件 L13–23），无游戏音包。**保留（硬）：已测量未试听**——无成片试听记录，判例「候选曲必须垫进成片试听 / 闭眼只听音轨」无法核验，本报告不臆造任何听感 |
| S2 | ✓ | 声明式钉帧表已建立：`manifest.audio.sfx` L149–204 共 7 条（role/file/at/duration_s/source_duration_s/clamped），`index.html` L147–153 对应 7 个 `<audio>`（`data-start/data-duration/data-volume`）；6 条 SFX 钉在 `0/3/6/10/14/17s` = 6 个镜头起点，末条 `clamped:true` 由 4.063s 裁到 3s。**保留**：用秒而非帧号、`manifest` 表内无 `volume`（音量散在 index.html 与分镜源）、无逐条「对应画面动作」注释；无连发段落，双样本/阶梯递减/间隔加速不适用 |
| S3 | ✓ | 音频按最终 `600f/20s` 时间线重钉：6 条 `at` 与 6 镜 `start_s` 逐一对齐，`hit_list[0,3,6,10,14,17]` 一致，末条 `clamped:true` 是按新片尾裁切的直接证据。`beat_grid:[]` 仍为空 |
| S4 | ✗(`s01·f0–f89 / manifest L156–L163`；`s04 / L111`) | ① `impact-cine.mp3` 于 0s 起 `duration_s:4.063`，但 `s01` 仅 3s（L60–62），音效越过切镜点拖进 `s02` 约 1.06s，违反「音频裁到与动作严格等长」；② `s04` 三行清单只有 `click-camera.mp3` 一条（10s, 0.351s），无逐条落入拟音；③ `s05`「数字落定」用通用 `swoosh-quick` 而非拟音。其余 5 条 `clamped:false` 等长 ✓ |
| S5 | ✗(`manifest L133–L205`；全片) | 0.2.0 时无音轨故记 N/A；v0.3 补音后本条**首次适用且未满足**：产物中无任何「输出音轨 AAC priming 偏移实测记档」「音源峰值滞后逐文件量」「`from = 目标峰值帧 − 峰值滞后 − 输出偏移` 统一扣除」记录。管线 0.9.88 / MP4 / 48kHz 的补偿值不可跨管线搬运 |
| C1 | ✓ | `shot__sub` / `shot__foot` 已全部改为真实文案（如 `没点确认，不进渲染。`、`三读协议：读卡 → 读参数 → 读实现`），旧 ✗ 的「`action` 字段与 `card_id · primitive` 制作元数据烧进画面」已彻底清除。**保留**：`voiceover:[]`，纯字卡段落无解说、无硬字幕轨（douyin 预设 `硬字幕` 未满足，归 `7`） |
| C2 | ✗(`s02·f90–f179 / L79–L81`) | 主标语 `普通模型 / 也能有导演级设计感` + `先定分镜，再开机。` 仍为抽象口号，无产品功能名、无具体收益。部分改善：`idea` 已统一为「导演级设计感」（旧 brief「Opus 级」与 s02 措辞冲突已消），`s03–s05` 已出现 `124 张镜头配方卡` / `分镜确认门` / `没点确认，不进渲染` 等功能名+收益 |
| C3 | N/A | 全片无 3D 镜头、无画内注记文字 |
| P1 | ✓ | `verify.json` `error_count 0 / empty_frames 0`、7 帧非零、contact-sheet 已出；check 报告 `layout 0 issue` / `contrast 0 error`；本终检亦亲眼看拼图与全分辨率小字。**保留**：`note`（L155）仍写「`film_silent` 因示例无音轨」，与现已铺音的成片矛盾，属残留文案 |
| P2 | N/A | `design_spec.styleframe_refs:[]`，无参考素材，无手法采用/弃用清单可查 |
| P3 | N/A | 干净上下文终检，无用户反馈回合可验；未见独立 commit 粒度的干净 revert 证据 |
| P4 | ✓ | 旧 ✗ 两项已修：功能清单两项目标各有专属镜头（`s03` 3 张配方卡 / `s04` 确认门清单，另加 `s05` 150 预览）；6 个 `primitive`（crash-zoom/slide-up/slide-left/scale-in/wipe/hold）与 6 个 `layout` 全不重复，不再是「slide-up 复用两次 / 5 镜同版式」。**保留**：6 镜仍共用同一 `shot__bg` + 72px grid + eyebrow + `shot__bar` + foot 骨架与同一 0.62s `back.out(1.7)` 入场语法（`9`） |

**统计：✓14 / ✗8 / N/A5**（0.2.0 为 ✓7 / ✗14 / N/A6）。✗ = `Q1/Q5/Q8/Q10/Q11/S4/S5/C2`。所有 ✗ 均未在 `project.json` / 分镜说明 / `manifest.warnings:[]` 中找到「有意识违反 + 原因」记录，按 `aesthetic-rules.usage` 与 `SKILL.md` `逐条过准则` 一律计入缺陷。

---

## 3. 旧 14 条 ✗ 逐条对照（0.2.0 → v0.3）

| 旧编号 | 结论 | 逐条证据 |
|---|---|---|
| R2 匀速直线 + 收尾 0f | **部分修复** | 5 条 grid `ease:"none"` → `power2.out`（L160/163/165/167/169）；末帧静止 0f → 51f。未修：`三卡依次落定` 批量加速/物理隐喻仍无（L164 单块滑入） |
| R3 开场动作弧 0.62s | **部分修复** | L161 新增 3.0s 标题动作弧 ✓；未修：`s04` 三行清单无逐条动画、无真人操作节奏 |
| Q1 两功能只一行文字 | **部分修复** | L96 三张 `mini-card`、L111 三行 `check-row`、L125 `metric-num 150` 已让「一眼看懂」达标、数据口径 ✓；未修：出版级质感未过、无真实截图 |
| Q5 开场多主角 | **未修复** | `s01` L61–L69 仍 4+ 行文字 + 角标 + 进度条 + 网格 + 光晕；仅多一条 3s 标题缓动，未改单主体结构 |
| Q8 收尾降档、非峰值 | **未修复（仅微调）** | 由「0.5s fade」变为「0.62s fade + 1.2s 进度条」；合影/四方飞入/代表元素/舞台光/粒子仍 0，`f555≈f593` 字节相同 |
| Q10 贴图+标语级假文档 | **部分修复** | 新增 card-grid / checklist / metric 三种内容版式；未修：meta 逐字折行、下半屏仍大片空白、无侧栏/评论/页眉 |
| Q11 辅助文字中间态 | **部分修复** | 92/41/37px + 高对比已替换旧 65/36/35px×低对比 ✓；未修：`mini-card .meta 29.6px`、9:16 字高口径矛盾未写进说明 |
| S1 全片 0 音轨 | **部分修复** | BGM + 6 SFX 已入 `index.html` L147–153，Mixkit 授权署名齐备；未修：**已测量未试听**，无成片试听记录 |
| S2 无钉帧表 | **部分修复** | 7 条声明式 + 6 条钉镜头起点 + `clamped` 处理已建；未修：非帧号、表内无 `volume`、无逐条动作注释 |
| S3 声音层缺位 / 未重钉 | **已修复** | 音频按 600f/20s 重钉，`hit_list` 与 6 镜起点一致，末条 `clamped:true`；`beat_grid:[]` 属未做卡点而非错位 |
| S4 无拟音 / 无等长裁切 | **部分修复** | 5 条 `clamped:false` 等长、末条裁 3s ✓；未修：`impact-cine 4.063s` 越过 `s01` 3s 边界、清单无逐条拟音、数字落定用通用 swoosh |
| C1 制作元数据入画 | **部分修复** | `shot__sub/shot__foot` 已全改真实文案，`card_id · primitive` 与 `action` 原文清除 ✓；未修：`voiceover:[]` 无解说/硬字幕 |
| C2 标语抽象 + 措辞冲突 | **部分修复** | `idea` 与 `s02` 统一为「导演级」✓、`s03–s05` 出现功能名+收益 ✓；未修：主标语仍抽象口号 |
| P4 功能漏拍 / 手法重复 | **部分修复** | 两核心功能各有专属镜头 ✓、6 primitive/6 layout 全不重复 ✓；未修：6 镜共用同一骨架与入场语法 |

汇总：**已修复 1（S3）／部分修复 11／未修复 2（Q5、Q8）**。没有一条旧 ✗ 是靠「改文案措辞」冒充修复；也没有一条设计-craft 类 ✗ 被真正关闭。

---

## 4. 返工声明逐项核验（诚实对账）

| 返工项 | 核验 | 证据 |
|---|---|---|
| 6 镜 20s / 6 种版式 | ✓ | `demo-project.json` L34–194；`manifest.layouts` 六项互异；`index.html` L57/72/88/103/118/133 |
| BGM + 6 条钉帧 SFX | ✓ | `index.html` L147–153；`manifest.audio` L133–205；`ATTRIBUTION.md` |
| 两个功能镜头 + 150 预览 | ✓ | L96 三卡、L111 清单、L125 数字 |
| AI 显式+隐式标识元数据 | **部分** | `aigc-metadata.json` + `index.html` L7 `meta[name=aigc]` + `explicit_label` 已就位；但三处 `explicit:false / implicit:false`（`7`） |
| GSAP 本地化去 CDN | ✓ | L8 `./vendor/gsap.min.js`；`vendor/gsap.min.js` 存在；grep `cdn.jsdelivr` 0 命中 |
| registry 钉 commit | ✓ | `hyperframes.json` L3 `…/45846f1e6d5609462d29652315d0d4254fe92c24/registry`；`manifest.registry_pin` 同值 |
| `window.__timelines` 兜底 | ✓ | L157 `window.__timelines = window.__timelines || {};`；L156 paused、L158 恰好一条注册、L172 `tl.seek(0)`；grep `Date.now/Math.random/fetch/XMLHttpRequest` 0 命中 |
| 首帧非空 | ✓（代码级） | L159 `fromTo("#shot-1-body", {"opacity":1,…})` + `tl.seek(0)`；`empty_frames:0`。7 张抽样帧最早 1.5s，未提供 t=0 单帧，故只认代码级证据 |
| 安全区 px 化 | ✓ | L17–20 `--pt:346px; --pb:691px; --pl:140px; --pr:324px`；douyin 底部 20%=384px、右侧 15%=162px 均满足。但 `pb=691px≈36% 帧高`，contact-sheet 每格下半屏约 1/3 空白、头重脚轻 |
| SHOTS 单一事实源 | ✓ | `manifest` L19 `shot.primitive is authoritative (SHOTS single source)`；6 个 primitive 与分镜源逐项一致，不再被 `transition_in` 覆盖 |
| 时长恒等 | ✓ | `10–14` `duration_s:20 / total_frames:600 / declared_duration_s:20 / declared_frames:600 / padding_seconds:0`；`index.html` L56 `data-duration="20"`，6 镜 `dur_s` 合计 20 |
| 制作元数据不再入画 | ✓ | 6 个 `shot__foot` 全为文案；无 `card_id`/`primitive`/`action` 字样。保留：eyebrow `0X / 06 · CATEGORY` 与进度条仍在画面上 |

---

## 5. 音频（确认存在，但「已测量未试听」）

- **结构确认**：`index.html` L147 一条 `<audio id="bgm">`（`data-start=0, data-duration=20, data-volume=0.42`）+ L148–153 六条 SFX；`manifest.audio.sfx` 逐条给出 `at` / `duration_s` / `source_duration_s` / `clamped`；素材文件 `assets/audio/bgm/cineforge-bgm-20s.mp3` 与 6 个 `sfx/*.mp3` 均实际存在。
- **机器验收**：`verify.json` L42–46 **`audio` 组 `error:0 / warning:0 / info:0`**；`craft` 组 L37–41 同为 **0/0/0**（旧片 `film_silent` 警告已消失）；`warning_count:7` 全部落在 `lint`（1 条 `timeline_track_too_dense` + 6 条 `nested_structure_needs_subcomposition`，属二期子组合改造）。
- **如实说明**：以上只证明「文件在、时间轴对、check 无报错」。**本终检没有试听任何一帧音频，也没有做波形/响度/卡点误差实测**；因此音色是否像产品发布会而非游戏、BGM 是否在成片里试听后选定、6 条 SFX 在混音里是否真的听得见、卡点误差是否 ≤3f，**均无结论，不臆造听感**。`verify.json` L155 的 `note` 仍写「`film_silent` 因示例无音轨」，与现状矛盾，属过期文案。
- **两版核对（SKILL 报告项 5）：✗**。`.hyperframes/render-outputs.json` 仍只有 `{"version":1,"paths":["renders/cineforge-demo-01.mp4"]}` 一条，带 BGM / 无 BGM 两版都未渲出（与 0.2.0 相同）。

---

## 6. 发布合规：「不得进入发布阶段」仍成立

| 检查项 | 当前值 | 判定 |
|---|---|---|
| `publish.ai_disclosure.explicit` | `false`（`demo-project.json` L254） | **未改** |
| `publish.ai_disclosure.implicit` | `false`（L255） | **未改** |
| `title / description / tags / cover / schedule` | `"" / "" / [] / "" / ""`（L249–257） | **未改** |
| `manifest.aigc.explicit / implicit` | `false / false`（L208–209） | **未改** |
| `aigc-metadata.json` L7–8 | `explicit:false / implicit:false`，L12 自注「上传平台前请按平台要求写入文件元数据」 | 素材就位、开关未置真 |
| `manifest.publish_allowed` | `false`（L212） | 编译器自己已拦截 |

补充：画面 `s01` 已有 `AI 生成 · 影铸 CineForge` 字样、`index.html` L7 已有 `meta[name=aigc]` 机读标记、`aigc-metadata.json` 已随产物分发——**显式/隐式标识的载体已具备，但三个开关仍是 false**，不能据此认定合规完成。
授权链较 0.2.0 明显改善：`assets/audio/ATTRIBUTION.md` 记有 Mixkit Stock Music Free License（BGM `Cat Walk / Arulo`）与 6 条 Mixkit SFX Free License，并明确「仅使用上游已核验的 6 项」；字体为 `sans-serif` 系统字族。仍缺：**无极限词自检记录**（`idea`「导演级设计感」、`s06`「成片归你，免费商用」属对标/权益宣称，须法务复核并统一口径）、封面、标题、描述、标签、前 3 秒钩子（`s01` 为纯品牌字标）、硬字幕。

> **结论：0.2.0 报告 `8` 的「不得进入发布阶段」在 v0.3 完全仍成立**，且 `publish_allowed:false` 是产物自己写明的。任何面向 douyin 的提交、预览或分发都不在本次「有条件通过」范围内。

---

## 7. 数据安全

- **成片画面 / `index.html` / `manifest.json`：干净 ✓**。grep `01_HJ_Work`、`C:\Users`、`15056`、`password/token/secret/api_key` 对 `index.html` 与 `manifest.json` 均 **0 命中**；`design_spec.data_policy="no personal data; placeholder copy only"`；逐帧可见文字仅品牌名、标语、功能名、编号，无客户名/个人信息/内部资料/密钥/实时数据/真实截图。
- **但整包外发仍不干净 ✗（与 0.2.0 相同，未修）**：
  - `out/qa/cineforge-demo-01.verify.json`：L5 `out_dir`、L9 `check_report`、L122 `snapshot_dir`、L125–150 七条 `frame.path`、L154 `contact_sheet` 共 **11 处** `D:\01_HJ_Work\…` 本机绝对路径；
  - `.hyperframes/video-state.json`：**84 处** `C:\Users\15056\.cache\hyperframes\history\…`（含用户名）；
  - `.hyperframes/artifacts/checks/6e291f93-….json`：**7 处** `sourceFile: "D:\01_HJ_Work\…\index.html"`。
- 结论：**画面层通过、工程产物层未通过**。若把整个 `out/` 或仓库整包交付第三方，须先脱敏上述路径与用户名；`0.2.0` 报告提到的 `.local/state/gh/device-id` 本次未复核，不在此结论内。

---

## 8. 离「Opus 级设计感」还有多大差距（不粉饰）

它从「一期占位式样片」升级成了**结构完整的字卡模板片**，但没有跨过「产品预告成片」的门槛。contact-sheet 七格亲眼所见：

1. **仍是同一张模板换内容**：6 镜共享深墨底 `#0B0E14`、满屏 72px 细网格、左上琥珀 eyebrow、左中进度条、底部 foot、同一层 `radial-gradient(130% 85% at 50% 28%)` 光晕；6 条主动效都是 `0.62s back.out(1.7)` 的「整块 body 淡入+单向位移」。差异只在中间那块内容模块。
2. **无真实产品截图 / 无复杂光影**：`out/` 下 17 张图片全是 `snapshots/` 抽帧，没有一张产品 UI 截图、实拍或渲染素材；唯一的「光」是固定 CSS 渐变，无聚光扫字、sheen、粒子、舞台光、景深、材质反射、明暗反转。深底本可做光却被浪费（Q4 虽 ✓ 但 0 次）。
3. **无出版级排版**：L96 的三张 mini-card 在窄列里 meta 逐字折行（contact-sheet 第 3 格 `TYPOGRA / PHY · 22`），无铺满的真实密度内容、无侧栏/评论栏/页眉；`pb=691px` 让每格下半屏约 1/3 完全空白、头重脚轻。
4. **无镜头语言**：零运镜、零 3D、零物件特写、零机位变化，6 镜全正视（Q6 ✓ 的反面）；`Q7/Q9/C3` 判例无适用对象，恰恰说明手法库根本没被调用。
5. **收尾仍不是峰值**：`s06` 标 `energy:"peak"`，实为 0.62s 淡入 + 进度条；`frame-05(18.5s)` 与 `frame-06(19.75s)` 字节完全相同，7 帧里有 2 帧是同一张 outro。`outro-group-photo-launch` 的「合影/发布会」结构零实现。
6. **工程感仍有残留**：eyebrow `0X / 06 · CATEGORY`、进度条、网格仍在画面上；但 `card_id · primitive` 与分镜 `action` 原文已清除，这一项应予肯定。

结论：差距是**内容证据与设计层级**，不是调色或参数微调。`check 0 error` 只说明「模板渲染没坏」，不说明「好看」。要接近 Opus 级，需整镜重做功能展示（真实截图或达标手搓 UI + 出版级排版）、收尾发布会合影、光影与运镜层，而非继续加版式数量。

---

## 9. 缺陷清单与整改优先级

| 优先级 | 缺陷 | 证据 | 违反 | 建议 |
|---|---|---|---|---|
| **P0 阻断发布** | AI 双标识仍 false、标题/描述/封面/标签全空、无极限词自检 | `demo-project.json` L245–258；`manifest` L206–212 | 发布合规 | 置真 `explicit/implicit` 并把标识写入文件元数据；补齐标题/描述/封面/标签/硬字幕与法务自检。**在此之前保持 `publish_allowed:false`** |
| **P1** | 音频验证闭环缺位：未试听、两版未渲、`S5` 偏移无实测 | `render-outputs.json` 1 条；`verify.json` `audio 0/0/0` 但不等于听感合格 | S1/S5/两版核对 | 成片试听并留记录；渲带/无 BGM 两版；实测本管线 AAC priming 偏移与峰值滞后并在 `from` 统一扣除 |
| **P1** | `impact-cine 4.063s` 越过 `s01` 3s 边界；清单无逐条拟音 | `manifest` L156–163；`index.html` L111 | S4 | 长样本按画面段落裁到等长；给「逐条勾选」「数字落定」配专属拟音 |
| **P1** | 收尾非合影/非峰值；开场非单主体 | `index.html` L133–145 / L61–69；`f555=f593` | Q8/Q5 | 整镜重做：多方向飞入合影 + 已展示功能代表元素 + 舞台光/粒子 + 落定后 wordmark hold；开场收敛为单主体完整弧 |
| **P2** | 功能镜头质感未过、meta 折行且 <32px | L96 / L45；contact-sheet 第 3 格 | Q1/Q10/Q11 | 真实截图或出版级手搓 UI；`mini-card .meta` 提到 ≥32px 并取消逐字折行；压缩 `pb` 提高信息密度 |
| **P2** | 9:16 字高口径矛盾未写进说明；8 条 ✗ 无「有意识违反+原因」记录 | `aesthetic-rules.json` L131 / L4；`manifest.warnings:[]` | Q11 / usage | 在 `project.json` 或设计说明显式重定竖屏阈值，并逐条登记偏离理由 |
| **P2** | 整包含本机绝对路径与用户名 | `verify.json` 11 处、`video-state.json` 84 处、check 报告 7 处 | 数据安全 | 外发前脱敏；或只交付 `index.html` + `assets/` + `manifest.json` 白名单 |
| **P2** | SFX 表用秒非帧号、缺 `volume` 与动作注释；`verify.json note` 过期 | `manifest` L149–204；`verify.json` L155 | S2 / 证据一致性 | 表补帧号/音量/逐条动作注释；更新 `note` 去掉 `film_silent` |
| **P3** | 7 条 lint warning、主标语抽象、无解说/硬字幕 | `verify.json` L56–113；`index.html` L79–81 | C1/C2/一期豁免 | 二期子组合改造 `data-composition-src` 并出书面豁免；主标语具体化；明确无旁白或补硬字幕口径 |

**整改顺序**：P0 发布合规 → P1 音频试听/两版/S5/S4 → P1 收尾合影与开场单主体 → P2 功能镜头出版级排版与字高 → P2 数据安全脱敏与证据一致性 → P3 子组合与文案。

---

## 10. 附：本次「有条件通过」的边界

可放行的只有：`0 error / 7 帧非空 / 确定性 / 时长恒等 / 单一事实源 / 6 版式与 3 个功能镜头已就位` 这一**一期内部模板可用性**结论，且须满足：① 文件名与 `out/qa/` 标注 `NOT FOR PUBLISH / 一期模板样片`；② `publish_allowed:false` 保持；③ 7 条 lint warning 书面豁免；④ `9` 的 P1/P2 登记为二期整改项；⑤ 冻结当前静帧与 `contact-sheet.jpg` 作基线。

> 本报告为干净上下文独立终检结论；**未修改除本文件外的任何文件、未重新渲染、未做任何 GitHub 写操作**。未试听的音频、未渲染的两版、未实测的 `S5` 偏移均按「无结论」处理，未以 `check 0 error` 代替。
