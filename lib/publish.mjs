// CineForge · 发布前置检查（纯函数 + 只读文件探测，零依赖）
//
// 为什么要有这个文件：发布是唯一「公开且难撤回」的动作，必须由人拍板。
// 但人多半会直接点「发布」，所以把「该看的东西」变成 8 条可勾选的检查项 ——
// 不是评分，是清单：每一条都能指到 project.json 的某个字段或磁盘上的某个文件。
//
// 纪律：
//   1) 服务端重算，绝不信客户端传来的 passed。客户端只负责展示。
//   2) 拿不到证据就判 fail/todo，不判 pass。「没查」不等于「没问题」。
//   3) error 级（block）拦住发布；warn 级只提示，允许用户在弹窗里逐条确认后继续。

import fs from "node:fs";
import path from "node:path";

/** 广告法/平台极限词。与 compile-hf.mjs 的 legal_word_check 同一张表。 */
export const LEGAL_WORDS = ["导演级", "Opus", "最优", "第一", "免费商用", "绝对", "100%", "顶级", "最好"];

/** 数据安全：不该出现在文案里的东西。命中不阻断，但必须让人看见。 */
export const SENSITIVE_PATTERNS = [
  { code: "PHONE", re: /(?:^|[^\d])1[3-9]\d{9}(?:[^\d]|$)/, label: "手机号" },
  { code: "EMAIL", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, label: "邮箱" },
  { code: "TOKEN", re: /\b(?:sk-[A-Za-z0-9]{12,}|gh[pousr]_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16})\b/, label: "密钥" },
  { code: "IDCARD", re: /(?:^|[^\d])\d{17}[\dXx](?:[^\d]|$)/, label: "身份证号" },
  { code: "BANKCARD", re: /(?:^|[^\d])\d{16,19}(?:[^\d]|$)/, label: "长数字串（可能是卡号）" },
];

/** 平台 → 期望画幅。不一致只 warn：横片发竖平台是用户的自由，但必须被提醒。 */
export const PLATFORM_ASPECT = { douyin: "9:16", bilibili: "16:9", xiaohongshu: "3:4", wechat: "9:16", youtube: "16:9" };
export const PLATFORM_CN = { douyin: "抖音", bilibili: "B 站", xiaohongshu: "小红书", wechat: "视频号", youtube: "YouTube" };

function str(v) { return v === undefined || v === null ? "" : String(v); }
function nonEmpty(v) { return str(v).trim().length > 0; }

/** 屏幕上会出现的所有文字（标题/副标题/脚注/指标/条目）。 */
export function onScreenText(project) {
  const shots = Array.isArray(project && project.shots) ? project.shots : [];
  const parts = [];
  for (const s of shots) {
    const c = (s && s.copy) || {};
    for (const k of Object.keys(c)) if (nonEmpty(c[k])) parts.push(str(c[k]));
    if (nonEmpty(s && s.caption)) parts.push(str(s.caption));
  }
  return parts;
}

/** 发布文案的全部文字（标题 + 描述 + 标签 + 画面文字）。 */
export function publishText(project) {
  const pub = (project && project.publish) || {};
  const parts = [str(pub.title), str(pub.description)]
    .concat(Array.isArray(pub.tags) ? pub.tags.map(str) : [])
    .concat(onScreenText(project));
  return parts.filter((x) => x.trim().length > 0);
}

/** 音频授权链：BGM 与每个 SFX 是不是插件自带的那批（自带就有 ATTRIBUTION）。 */
export function audioLicenses(project, pluginRoot) {
  const audio = (project && project.audio) || {};
  const bgm = audio.bgm || {};
  const ref = str(bgm.ref);
  const bgmDir = path.join(pluginRoot, "assets", "audio", "bgm");
  const bgmFile = ref ? path.join(bgmDir, ref) : "";
  let bgmOk = false;
  try { bgmOk = !!ref && fs.statSync(bgmFile).isFile(); } catch { bgmOk = false; }
  const sfx = Array.isArray(audio.sfx) ? audio.sfx : [];
  const sfxFiles = sfx.map((s) => str(s && s.file)).filter(Boolean);
  const sfxDir = path.join(pluginRoot, "assets", "audio", "sfx");
  const missingSfx = [];
  for (const f of sfxFiles) {
    let ok = false;
    try { ok = fs.statSync(path.join(sfxDir, f)).isFile(); } catch { ok = false; }
    if (!ok) {
      // 也可能来自上游 assets/lib 或用户自备目录：只要路径里带 assets/ 就认为用户自备
      missingSfx.push(f);
    }
  }
  // 署名文件分两份放在 bgm/ 与 sfx/ 下（不在一级目录），两处都查一遍。
  const attrCandidates = [
    path.join(pluginRoot, "assets", "audio", "ATTRIBUTION.md"),
    path.join(pluginRoot, "assets", "audio", "bgm", "ATTRIBUTION.md"),
    path.join(pluginRoot, "assets", "audio", "sfx", "ATTRIBUTION.md"),
  ];
  let attrOk = false;
  for (const a of attrCandidates) {
    try { if (fs.statSync(a).isFile()) { attrOk = true; break; } } catch { /* 继续找 */ }
  }
  return { bgm: { ref, ok: bgmOk }, sfx: { count: sfxFiles.length, missing: missingSfx }, attribution: attrOk };
}

/**
 * 八条发布检查。
 * severity: 'block' 未通过不许发布；'warn' 只提示，用户可逐条确认后继续。
 * status:   'pass' | 'fail' | 'todo' | 'na'
 */
export function publishPreflight({ project, verify, pluginRoot, projectDir } = {}) {
  const pub = (project && project.publish) || {};
  const ai = pub.ai_disclosure || {};
  const p = (project && project.project) || {};
  const items = [];
  const add = (o) => items.push(o);

  // 1. AI 显式标识
  add({
    id: "ai-explicit",
    label: "AI 显式标识",
    severity: "block",
    status: ai.explicit === true ? "pass" : "fail",
    detail: ai.explicit === true
      ? "已声明：画面/标题/简介中会写明「AI 生成」"
      : "publish.ai_disclosure.explicit 为 false。《AI 生成合成内容标识办法》要求显式标识，未声明不得发布。",
    fix: "在发布文案里加一句「本片由 AI 辅助生成」，并把 explicit 置 true。",
  });

  // 2. AI 隐式标识（可机读元数据）
  add({
    id: "ai-implicit",
    label: "AI 隐式标识（元数据）",
    severity: "block",
    status: ai.implicit === true ? "pass" : "fail",
    detail: ai.implicit === true
      ? "已声明：导出产物会写 aigc-metadata.json 与 meta[name=aigc]"
      : "publish.ai_disclosure.implicit 为 false，导出产物缺少可机读标识。",
    fix: "把 implicit 置 true；导出时会把 generator / upstream / seed 写进元数据。",
  });

  // 3. 文案三件套
  const titleOk = nonEmpty(pub.title);
  const descOk = nonEmpty(pub.description);
  const tagsOk = Array.isArray(pub.tags) && pub.tags.filter(nonEmpty).length > 0;
  add({
    id: "copy",
    label: "标题 / 描述 / 标签",
    severity: "block",
    status: titleOk && descOk && tagsOk ? "pass" : "fail",
    detail: "标题 " + (titleOk ? "有" : "空") + " · 描述 " + (descOk ? "有" : "空") + " · 标签 " + (tagsOk ? pub.tags.length + " 个" : "空"),
    fix: "平台侧文案必须由人写，AI 只能给草稿。至少补一句钩子 + 一句说明。",
  });

  // 4. 封面
  add({
    id: "cover",
    label: "封面",
    severity: "warn",
    status: nonEmpty(pub.cover) ? "pass" : "todo",
    detail: nonEmpty(pub.cover) ? "已指定：" + pub.cover : "还没有封面。多数平台不给封面就用首帧，通常不好看。",
    fix: "截一帧定妆帧做封面，或单独排一张平台尺寸的图。",
  });

  // 5. 极限词
  const hits = [];
  for (const t of publishText(project)) {
    for (const w of LEGAL_WORDS) if (t.indexOf(w) >= 0) hits.push({ word: w, text: t.slice(0, 60) });
  }
  add({
    id: "legal",
    label: "广告法极限词",
    severity: "block",
    status: hits.length ? "fail" : "pass",
    detail: hits.length ? "命中 " + hits.length + " 处：" + hits.slice(0, 3).map((x) => x.word).join(" / ") : "标题、描述、标签与画面文字均未命中",
    fix: "把「最 / 第一 / 100% / 顶级 / 导演级」这类词换成可举证的说法。",
    hits,
  });

  // 6. 音频授权链
  const lic = audioLicenses(project, pluginRoot || ".");
  const audioOk = (lic.bgm.ok || !lic.bgm.ref) && lic.attribution;
  add({
    id: "audio",
    label: "BGM / SFX 授权链",
    severity: "warn",
    status: audioOk ? (lic.sfx.missing.length ? "todo" : "pass") : "todo",
    detail: "BGM " + (lic.bgm.ok ? "插件自带（有署名）" : (lic.bgm.ref ? "不在插件自带库，需自行确认授权" : "未使用"))
      + " · SFX " + lic.sfx.count + " 条" + (lic.sfx.missing.length ? "（" + lic.sfx.missing.length + " 条不在自带库）" : "")
      + " · ATTRIBUTION " + (lic.attribution ? "在" : "缺"),
    fix: "商用前逐项核对授权；不在自带库的音频自己留一份许可证明。",
  });

  // 7. 数据安全
  const leaks = [];
  for (const t of publishText(project)) {
    for (const s of SENSITIVE_PATTERNS) if (s.re.test(t)) leaks.push({ code: s.code, label: s.label, text: t.slice(0, 60) });
  }
  add({
    id: "privacy",
    label: "数据安全",
    severity: "block",
    status: leaks.length ? "fail" : "pass",
    detail: leaks.length ? "命中 " + leaks.length + " 处：" + Array.from(new Set(leaks.map((x) => x.label))).join(" / ") : "未发现手机号 / 邮箱 / 密钥 / 证件号 / 卡号",
    fix: "未授权的客户名、内部链接、密钥、真实个人数据都不能出现在画面与文案里。",
    hits: leaks,
  });

  // 8. 静帧验收
  const v = verify || null;
  const vStatus = !v || !v.found ? "todo" : (v.ok && v.error_count === 0 && v.empty_frames === 0 ? "pass" : "fail");
  add({
    id: "verify",
    label: "静帧验收",
    severity: "block",
    status: vStatus,
    detail: !v || !v.found
      ? "还没有验收报告（out/qa/<id>.verify.json）。没验过的片子不许发。"
      : (vStatus === "pass"
        ? "0 error · " + (v.warning_count || 0) + " warning · " + ((v.frames && v.frames.length) || 0) + " 张静帧"
        : v.error_count + " error · " + v.empty_frames + " 张空静帧，先修再发"),
    fix: "先跑 node scripts/verify-hf.mjs --project <工程> 生成验收报告。",
  });

  // 9（附加，不计入八项）：画幅与平台是否匹配 —— 只提醒
  const wantAspect = PLATFORM_ASPECT[str(p.platform)] || "";
  const aspect = str(p.aspect);
  const aspectOk = !wantAspect || !aspect || wantAspect === aspect;
  add({
    id: "aspect",
    label: "画幅与平台",
    severity: "warn",
    status: aspectOk ? "pass" : "todo",
    detail: aspectOk
      ? (PLATFORM_CN[str(p.platform)] || str(p.platform) || "未指定平台") + " · " + (aspect || "—")
      : (PLATFORM_CN[str(p.platform)] || str(p.platform)) + " 建议 " + wantAspect + "，当前是 " + aspect + "；直发会加黑边或被裁",
    fix: "横片发竖平台请另渲一版，不要指望平台自动适配。",
  });

  const blocking = items.filter((x) => x.severity === "block");
  const failed = blocking.filter((x) => x.status !== "pass");
  return {
    ok: failed.length === 0,
    schema: "cineforge/publish-preflight/v1",
    items,
    counts: {
      total: items.length,
      pass: items.filter((x) => x.status === "pass").length,
      fail: items.filter((x) => x.status === "fail").length,
      todo: items.filter((x) => x.status === "todo").length,
      blocking: blocking.length,
      blocking_failed: failed.length,
    },
    blockers: failed.map((x) => x.id + ":" + x.label),
  };
}

/**
 * 发布回执：写进 project.publish_receipts，并把标识元数据落到工程目录。
 * 只做「记录」，绝不代替用户上传 —— 上传是可选适配器的事。
 */
export function buildPublishReceipt({ project, preflight, operator, platform, note, at }) {
  const stamp = at || new Date().toISOString();
  const pub = (project && project.publish) || {};
  return {
    schema: "cineforge/publish-receipt/v1",
    at: stamp,
    by: str(operator) || "user",
    platform: str(platform) || (Array.isArray(pub.platforms) ? str(pub.platforms[0]) : "") || "",
    preflight: {
      ok: !!preflight.ok,
      counts: preflight.counts,
      items: preflight.items.map((x) => ({ id: x.id, status: x.status, severity: x.severity })),
    },
    disclosure: {
      explicit: !!(pub.ai_disclosure && pub.ai_disclosure.explicit),
      implicit: !!(pub.ai_disclosure && pub.ai_disclosure.implicit),
    },
    note: str(note),
    upload: "manual",
    manual_only_reason: "一期不内置上传：biliup 属用户自装适配器，抖音 OpenAPI 需机构认证。",
  };
}

/** 标识元数据（导出产物与工程目录各一份）。 */
export function buildAigcSidecar({ project, pluginVersion, at }) {
  const pub = (project && project.publish) || {};
  const p = (project && project.project) || {};
  return {
    schema: "cineforge/aigc/v1",
    generated_at: at || new Date().toISOString(),
    generator: "CineForge / dsh-cineforge " + (pluginVersion || ""),
    upstream: "https://github.com/Vincentwei1021/video-shotcraft",
    upstream_license: "Apache-2.0",
    label: "AI 生成 · 影铸 CineForge",
    explicit: !!(pub.ai_disclosure && pub.ai_disclosure.explicit),
    implicit: !!(pub.ai_disclosure && pub.ai_disclosure.implicit),
    content_type: "ai-assisted-video",
    project_id: str(p.id),
    title: str(pub.title),
    seed: 20261124,
    deterministic: true,
    note: "显式标识需在画面或简介中如实声明；隐式标识为本文件与 index.html 的 meta[name=aigc]。",
  };
}
