# 发布到插件商店 · 上架指南（准备阶段）

> ⚠️ **本插件尚未提交 PR，提交是用户之后的动作。**
> 本文是**准备材料**，不是发布记录。本阶段（publish-kit）只写了本地 6 个文件，
> 本阶段（publish-kit）未执行任何 GitHub 写操作。**后续主线程已补齐**：加了 7 个 GitHub topics（含 `dsh-plugin`）、把插件装进 live `desktop` profile；0.3.0 返工把示例成片改成 6 镜 20s 带声版（仍 NOT FOR PUBLISH）。
> 仍未执行、且是用户之后动作的只有：向精选列表提 PR（P0-1 时间门 2026-11-25 16:32:43 +08:00 之后）。

## 0. 这套机制到底是什么

- DSH **没有**官方插件商店；发现页只列「用户自己添加的索引源」。
- 实际被社区当商店用的是第三方 **dshmarket 1.80.1**，站点 `https://dshmarket.com`。
- 它的**唯一数据源**是精选列表仓库 `https://github.com/awesome-dsh-plugin/awesome-dsh-plugin` 的 `data/plugins/` 目录。
- 因此「上架」= 向该列表的 `data/plugins/` 目录**提一个 YAML 文件的 PR**；合并后网站自动重建，目录 JSON 与索引源随之更新。
- 本插件的投稿文件路径：`data/plugins/HJ-Create-World__dsh-cineforge.yml`（本地草稿在 `store/HJ-Create-World__dsh-cineforge.yml`）。
- 一个 PR 最多 3 条；本插件只投 1 条。npm 发布可选，不影响收录；不需要 git tag；无强制 `engines.dsh` / `author` / `license` / `files` 规定。

## 1. 硬性要求逐条对照表

| # | 硬性要求 | 当前状态 | 依据 / 如何补 |
|---|---|---|---|
| 1 | `package.json` 声明 `dsh.bundle.patch` | ✓ | `package.json` 已有 `dsh.bundle.patch = ./cordis.patch.yml`。CI 从仓库根或 `packages/` `plugins/` `apps/` 子包读 package.json；只声明 `dsh.client` 会被拒（最常见被拒原因）。 |
| 2 | 仓库根有 `cordis.patch.yml` | ✓ | 已存在且含 `- insert: - id: cineforge-skills`；须在 `main` 分支可见（当前 `origin/main = 275e10b`）。 |
| 3 | 真实可用代码 | ✓ | `lib/`、`scripts/`、`skills/`、`knowledge/` 均有实现；离线自检 **86/86**、隔离与 live 安装 **27/27**、示例已渲出带声 MP4（`check` 0 error / 0 warning）。非占位 / 纯 README。 |
| 4 | 仓库创建满 1 天 | ✗ | `created_at = 2026-11-24T08:32:43Z`；CI 自动查，无提交数门槛（见 #4196）；差一点做完再提，重提不扣分。 |
| 5 | GitHub 仓库加 `dsh-plugin` topic | ✓ | 已实测写入：`PUT repos/HJ-Create-World/dsh-cineforge/topics` 返回 names=["dsh","dsh-plugin","hyperframes","motion-design","storyboard","video","video-shotcraft"]。 |
| 6 | 描述只说功能、无营销词、必须属实 | ⚠️ | 投稿草稿 `description.en` 已按此写（客观功能、句号结尾）；**提交前必须逐条对代码复核数字与 API 名称**。另：远端 GitHub 仓库 description 目前含「Opus 级设计感」营销词，建议清理（非收录硬门，但人工评审会读到目标仓库）。 |
| 7 | 项目活跃维护 | ✓ | 已有 3 个提交（`cc1a916` / `1eb8a31` / `275e10b`）+ 0.3.0 返工提交；`pushed_at` 以 GitHub 为准。 |

> 边界提醒：QA 终检把**示例成片**判为「打回 / NOT FOR PUBLISH」，指这支样片不能发 B 站 / 抖音，
> 与「插件能否被列表收录」是两件事；但正因如此，description 里不得宣称成片能力、或「Opus 级设计感已实现」「124 卡已逐卡可用」。

## 2. P0 阻断项与解除条件

| P0 | 阻断项 | 当前 | 解除条件 |
|---|---|---|---|
| P0-1 | 仓库未满 1 天（唯一时间硬门） | ✗（截至本指南编写时） | 等到 **2026-11-25T08:32:43Z** 之后；换算 `Asia/Hong_Kong`（UTC+8，全年无 DST）= **2026-11-25 16:32:43 +08:00**。CI 自动查 `created_at`，无提交数门槛；差一点做完再提，重提不扣分。 |
| P0-2 | 提交动作尚未发生，且现在不该发生 | 未执行 | 由**用户**在 P0-1 满足 + P0-3 复核后手工提 PR；本准备阶段禁止提 PR。 |
| P0-3 | 描述复核（数字 / API / 营销词） | 草稿 ✓，待人工复核 | 逐条对 `lib/index.js`、`skills/`、`scripts/compile-hf.mjs` 复核 `description.en` 的 3 技能、健康工具、编译器（0.3.0 仍是 3 技能 + `cineforge_health` + `compile-hf.mjs`，描述不变）；提交时删除「草稿 / DRAFT」文件头注释；不得出现未实现功能宣称。 |
| P0-4 | icon 引用需远端可见 | 本地已生成 | 把 `assets/plugin-icon.png` 推到 `main` 并确认 raw URL 返回 200；未推送则注释掉 `icon` 行，回退作者 GitHub 头像。 |

> 截图：`screenshots.json` **可选，暂不提供**（写 `[]`）。仓库内 13 张图全在被 `.gitignore` 忽略的 `out/`、`.local/` 下，`git ls-files` 无任何已跟踪图片，故不编造不存在的路径。

## 3. 分步上架 8 步清单

1. **等 P0-1 时间到**：UTC `2026-11-25T08:32:43Z` / HK `2026-11-25 16:32:43 +08:00` 之后。截至本指南编写时（2026-11-24 23:25 +08:00）尚未满足。
2. **复核并敲定草稿**：逐条核对 `store/HJ-Create-World__dsh-cineforge.yml` 的 `description.en` / `description.zh`（3 技能、`cineforge_health`、`compile-hf.mjs`），删除「草稿 / DRAFT」文件头注释。
3. **核对远端前置**：`main` 分支上 `package.json` 的 `dsh.bundle.patch`、根目录 `cordis.patch.yml`、`dsh-plugin` topic 都在；顺手清理 GitHub 仓库 description 的营销词。
4. **推送本地材料到自己的 `main`**：至少 `assets/plugin-icon.png`、`README.en.md`、`CHANGELOG.md`、`screenshots.json`；确认 `https://raw.githubusercontent.com/HJ-Create-World/dsh-cineforge/main/assets/plugin-icon.png` 返回 200。
5. **Fork 并从最新 `main` 建分支**：Fork `awesome-dsh-plugin/awesome-dsh-plugin`，从最新 `main` 建分支（避免与 main 冲突导致 `gate` 列 `—`）。
6. **落文件**：把草稿复制为 `data/plugins/HJ-Create-World__dsh-cineforge.yml`。**不要手工编辑两个 README**（由脚本生成）。本地预览可选：`npm ci && node scripts/generate-readme.mjs`（须与 `data/plugins` 一致）。
7. **提 PR**：仅此 1 条，满足「一个 PR ≤ 3 条」。**这一步是用户之后的动作，本准备阶段未执行**。随后等 CI 与人工评审。
8. **合并后验证**：站点自动重建 → `https://awesome-dsh-plugin.com/plugins.json` 出现条目 → 在干净 profile 真装一遍 `dsh plugin --profile <name> add <package>`。之后改截图只需推自己仓库（下一次 nightly build 生效），改描述 / 字段需新 PR。

## 4. CI 与人工评审会查什么

**CI 依次 4 项**（contributing.md 行 121-130）：

1. entry count ≤ 3（最先检查）；
2. `dsh.bundle` 存在（读仓库根或 `packages/` `plugins/` `apps/` 子包的 package.json；只写 `dsh.client` 会失败）；
3. repo age ≥ 1 天；
4. awesome-lint + 站点构建（双语一致性、分隔符、日期、截图）。

另有隐含检查 `READMEs match data/plugins`（两个 README 由脚本生成，分支快照过期会红）。失败会明确指出改什么，推同一分支即可、无需重开 PR。**CI 绿是前置条件，不是结论。**

**人工评审 5 项**（行 95-101）：

1. 代码是否与条目声明一致 —— **会把 description 里的数字与 API 名称逐条对代码核**；夸大是本来不错的插件被打回的主要原因；
2. 分类是否合理（不会因分类打回，维护者直接改）；
3. 是否真实可用代码、非占位 / 空壳；
4. 是否已被现有条目覆盖；
5. 源码有无告警信号（混淆代码、凭据外泄）。

维护者合并前会实际阅读目标仓库。

## 5. 被打回 / `held: author` 怎么办

- `held: author` 是维护者打的**暂停标签**，不是拒绝、也不是仓库损坏：PR 在合并队列里停住，等作者修。
- 正确做法（全部信号）：**把修复推到同一分支 + 在 PR 留一条评论说明改了什么**。反复推送 / 追问不会更快。
- 标签**不会自动消失**，只有维护者重新评审才能摘。
- 自查：看跟踪 issue「Held pull requests that may have healed」（每天 06:19 UTC 刷新）。出现了就说明已被记录，不用再催。
- `gate` 列为 `—`：Submission gate 从未运行，几乎总是分支与 main 冲突（冲突 PR 无 merge ref）；对投稿几乎总落在生成的 README 行上，**靠推送解决不了**，需维护者 rebase 到 main。
- 红色 check 常见是 `READMEs match data/plugins`：分支 README 快照早于后来合并的条目，维护者重新生成即可（不要自己手改 README）。
- 合并后网站自动重建，无需额外动作。

## 6. 读者侧如何加索引源订阅

- 官方索引源（format-1，供 DSH 发现页订阅）：`https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json`
- 目录 JSON（列表产物）：`https://awesome-dsh-plugin.com/plugins.json`
- 站点浏览：`https://dshmarket.com`
- 操作：DSH 发现页 → 添加索引源 → 粘贴上面的索引源 URL → 订阅后即可在列表中搜到 `HJ-Create-World/dsh-cineforge`。
- 注意：收录的是「插件」，不是那支 NOT FOR PUBLISH 的示例成片；读者拿到插件后自行创作。

## 7. npm publish（可选，不影响收录）

- 收录只看 GitHub 仓库 + `data/plugins` 的 YAML；npm 发布、git tag 都**不是**要求。
- 若要发：`npm publish --access public`（`package.json` 已有 `publishConfig.access: public`、name `dsh-cineforge`、version `0.3.0`、`files` 白名单、license Apache-2.0）。**本准备阶段未执行。**
- 干净验证：`dsh plugin --profile <name> add dsh-cineforge` —— 用全新 profile 真装一遍再宣布可用。
- 镜像坑（contributing.md 行 105-107）：`registry.npmmirror.com` 可能把 `0.0.0-stage` 空壳占位当 `latest`，报 `ERR_PNPM_TARBALL_EXTRACT … Invalid checksum for TAR header`。解法：`curl -X PUT https://registry.npmmirror.com/dsh-cineforge/sync` 触发重抓，等几分钟。

## 8. 确切 URL 清单

| 用途 | URL |
|---|---|
| 本插件仓库 | `https://github.com/HJ-Create-World/dsh-cineforge` |
| 投稿目标（精选列表） | `https://github.com/awesome-dsh-plugin/awesome-dsh-plugin` |
| 贡献指南 | `https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md` |
| `data/plugins/` 目录 | `https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/tree/main/data/plugins` |
| 投稿目标文件路径 | `data/plugins/HJ-Create-World__dsh-cineforge.yml` |
| dshmarket 站点 | `https://dshmarket.com` |
| 目录 JSON | `https://awesome-dsh-plugin.com/plugins.json` |
| 官方索引源（format-1，DSH 订阅） | `https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json` |
| 图标 raw URL（需先推送） | `https://raw.githubusercontent.com/HJ-Create-World/dsh-cineforge/main/assets/plugin-icon.png` |
| npm 包（若发布） | `https://www.npmjs.com/package/dsh-cineforge` |
| npm 镜像同步 | `https://registry.npmmirror.com/dsh-cineforge/sync` |
| 上游 | `https://github.com/Vincentwei1021/video-shotcraft` |

## 9. 本次准备阶段写了什么 / 没写什么

**只写了 6 个路径**：`store/HJ-Create-World__dsh-cineforge.yml`、`docs/PUBLISH-商店上架指南.md`、`README.en.md`、`CHANGELOG.md`、`screenshots.json`、`assets/plugin-icon.png`（256×256 位图 PNG，深底 `#0B0E14` + 琥珀 `#D3923C`，字母 C 造型，已肉眼确认非空白）。

**没有碰**：`package.json` / `README.md` / `spec.json` / `lib/` / `scripts/` / `knowledge/` / `skills/` / `examples/` / `docs/ROADMAP.md`（主线程正在改这些）。

**publish-kit 阶段没有执行**：提 PR、加 topic、npm publish、git tag、任何 GitHub 写操作。**随后主线程已加 topic（见上）**。**本插件尚未提交 PR，提交是用户之后的动作。**
