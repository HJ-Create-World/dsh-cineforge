---
name: cineforge-qa
description: 成片交付前的独立终检。对照 27 条判例式审美准则逐条检查方案一致性、功能完整性、镜头还原度、视觉/音频技术质量与数据安全，输出带帧号证据的报告。当用户说「验收」「检查一下成片」「终检」「QA」或在视频交付前使用。
---

# CineForge 独立终检

**制作者对自己的产出有确认偏差。首检永远不能交给用户，也不能由制作者自审。**

本技能应由**干净上下文的独立 subagent** 执行：不看制作过程，只看输入材料与成片。

## 输入材料（缺一不可）

成片 + 关键帧抽帧、创意简报、需求决策表、当前模式与视觉方向 / styleframe、功能到镜头映射、Gallery 卡名与变体、准确 demo TSX、Gallery 参考样片抽帧、最终分镜表、选中的镜头卡全文、审美准则。

## 运行时验收（0.3.0 起）

插件接线后，除材料清单外必须核对机器产出的验收证据，不要只看人写的结论：

- `out/qa/<id>.verify.json`：`scripts/verify-hf.mjs` 的报告，`ok=true` 且 lint/runtime/layout/motion/craft 各组 `error=0`、`frames>0`、`empty_frames=0`；warning 只记录、逐条判断是否属已登记的二期项。
- contact-sheet 拼图与逐帧 png：必须**亲自用 read_image 看**，判断文字可读性、平台安全区留白、镜间变化是否明确；不接受「报告说通过」就算通过。
- `manifest.json`：核对每镜 `start_s` / `dur_s` / `primitive` / `layout` 与分镜表一致；**`declared_duration_s` / `declared_frames` 必须与 `duration_s` / `total_frames` 恒等且 `padding_seconds=0`**（0.3.0 不再静默补尾帧）；`primitive` 须逐条等于分镜显式声明（SHOTS 单一事实源）；核对 `audio.bgm` / `audio.sfx`、`aigc` 与 `publish_allowed`、`gsap_vendor` 无 CDN、`registry_pin`。
- `index.html`：核对确定性（无 `Date.now` / `Math.random` / 网络请求）、恰好一个 `paused` timeline 注册到 `window.__timelines["main"]`。
- 渲染成片用 ffprobe 核对 codec / 画幅 / fps / 帧数 / 时长，与分镜契约对照。

一期示例片仍是「品味层」的占位式样片：0.3.0 补上音轨与两个功能镜头、0.3.2 补上 8 种版式（含单主体开场与收尾合影）、逐镜拟音与峰值补偿，但本质仍是字卡 + 网格（无真实产品截图、无复杂光影、无出版级排版、无机位语言）。终检须如实写明它离「Opus 级设计感」还差什么，不得因 check 0 error 就吹捧视觉质量。音频改用 `hyperframes audio <video> --json` 核对 LUFS / truePeak / clipping，并写明「已测量，未试听」（0.3.0 实测 −19.4 LUFS，比社交片 −16 到 −14 LUFS 偏安静）；`film_silent` 已消除，不应再作为放行理由。发布合规未补齐（`publish.ai_disclosure` 显式+隐式双标识、BGM/字体授权、无极限词、封面/标题/描述）时，结论一律「不得进入发布阶段」。

## 检查维度

| 维度 | 查什么 |
|---|---|
| 方案一致性 | 成片与已确认的简报 / 视觉方向 / 分镜是否一致；偏离是否写进说明 |
| 功能完整性 | 每个「必须展示的功能」是否都有镜头；有没有漏拍 |
| 镜头还原度 | 与选中卡的参考样片 / demo 对比：意图、动作弧、参数是否降档 |
| 视觉技术质量 | 文字锐度、穿帮、构图、光效裁剪、机位可读性、抖动 |
| 音频技术质量 | 卡点误差（≤3f）、SFX 钉帧、音色、响度 / 峰值 / clipping；带/无 BGM 两版若只渲 1 版须如实写明 |
| 数据安全 | 是否含未授权的客户 / 个人 / 内部 / 密钥 / 实时数据 |

## 逐条过准则

读 `knowledge/aesthetic-rules.json`，按 R / Q / S / C / P 五组 **27 条**逐条判定，输出格式：

```
R1 ✓
R3 ✗(s3·f48) 开场主体动作弧仅 1.8s，短于 3s
Q4 ✗(s5·f120) 逐卡 glint 群发，且光溢出圆角
...
```

- `✓` / `✗(位置)`，位置 = 镜头名 / 帧号，必须可定位。
- 准则可以**有意识违反**（风格需要），但每次违反必须写进项目说明：违反了哪条、为什么。未写明的 ✗ 一律算缺陷。
- 编号体系一经发布不重排，新增只追加。

## 报告结构

1. **总判**：可交付 / 需返工 / 需用户裁决。
2. **逐条准则表**（27 行）。
3. **缺陷清单**：按严重度排序，每条含帧号证据、违反的准则、建议改法。
4. **数据安全结论**：明确「通过 / 发现敏感数据」。
5. **音频与两版核对**：`hyperframes audio --json` 的响度 / 峰值 / clipping；带 BGM 与无 BGM 版是否都已渲出（0.3.2 示例仍只渲带 BGM 1 版；客观替代测量见 docs/QA-音频工程实测报告.md，人工试听与第二版渲染仍是缺口，须写明，不得默认两版齐全）。

## 高频缺陷（来自上游返工判例）

1. 品牌字标 hold 不足 30f，或 hold 加错对象（给了普通内容卡）。
2. 匀速直线运动 / 批量入场没加速 / 收尾没留 15f 静止。
3. 初版节奏过快（上游六次反馈全部指向「放慢」，从未有一次「太慢」）。
4. 逐拍全画面泵 = 观感抖动（卡拍只管时机，不管幅度）。
5. 逐卡 glint 群发、光溢出圆角。
6. 开场多主角群舞。
7. 3D 透视下文字糊（先查纹理栅格化链路，别调景深）。
8. 复刻既有页面却手搓 UI；或真实截图里混进真实客户数据。
9. 全局一刀切倾斜机位，列表页文字读不清。
10. 字卡文案与 outro tagline 重复。

## 上游署名

派生自 [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) `references/aesthetic-rules.md` 与 `references/final-review.md`（Wei Yihao，Apache-2.0）。