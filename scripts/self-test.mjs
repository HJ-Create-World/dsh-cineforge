#!/usr/bin/env node
// CineForge · 离线自检（零依赖、零网络、零 CLI） v0.5.0（含 Cordis Proxy 回归 + 参考片分析 + 工作台能动 + 收口验收 + GOAL/模板/主题）
// 用法：node scripts/self-test.mjs
// 校验：插件清单 / 补丁 / 3 技能 frontmatter 与注册 / health 工具 / 知识库 JSON / 卡库 /
//       编译确定性（8 文件 + 复制资产）/ v2 manifest 契约 / 音频与 AIGC / 单一事实源。

import { readFileSync, existsSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSkills, parseSkill, SKILL_NAMES } from "../lib/skill-loader.js";
import { apply, name as pluginName, inject } from "../lib/index.js";
import { PRIMITIVES, TOKEN_EASE, DEFAULT_TOKEN_ID, resolvePrimitive } from "../lib/hf-primitives.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NL = String.fromCharCode(10);
const results = [];

function check(label, cond, detail) {
  results.push({ label, ok: !!cond, detail: detail || "" });
}
function readJson(p) { return JSON.parse(readFileSync(p, "utf8")); }
function sha(buf) { return createHash("sha256").update(buf).digest("hex"); }
function fileSha(p) { return sha(readFileSync(p)); }

// v0.3.1 回归：真机 Cordis ctx 是 Proxy（src/reflect.ts:144-169 的 get 陷阱）。
// 未在 inject 声明的服务，属性读取不是 undefined，而是当场抛
// 「cannot get property X without inject」；ctx.get(name, false) 是非严格逃生口。
// v0.3.0 用普通对象 mock，读 ctx.tools 不抛 → 自测全绿但真机激活失败，故补此测试。
function makeCordisProxy(services, injected) {
  const own = {
    _disposers: [],
    get(name, strict) {
      if (Object.prototype.hasOwnProperty.call(services, name)) return services[name];
      if (strict === false) return undefined;
      throw new Error('cannot get property "' + name + '" without inject');
    },
    effect(fn) { const d = fn(); if (typeof d === "function") own._disposers.push(d); },
    on(ev, fn) { if (ev === "dispose") own._disposers.push(fn); },
  };
  return new Proxy(own, {
    get(t, prop, r) {
      if (typeof prop !== "string") return Reflect.get(t, prop, r);
      if (Object.prototype.hasOwnProperty.call(t, prop)) return Reflect.get(t, prop, r);
      if (injected.includes(prop)) return services[prop];
      throw new Error('cannot get property "' + prop + '" without inject');
    },
  });
}


async function main() {
  const pkg = readJson(join(ROOT, "package.json"));
  check("package.json name", pkg.name === "dsh-cineforge", pkg.name);
  check("package.json type module", pkg.type === "module");
  check("dsh.bundle.patch", pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch === "./cordis.patch.yml");
  check("engines.dsh", pkg.engines && pkg.engines.dsh === ">=0.2.2-rc.3");
  check("license Apache-2.0", pkg.license === "Apache-2.0");
  // v0.4.0 工作台：客户端半身与槽位契约（依据 dsh-config-sync-plugin/client.js 头注释）
  check("package.json version 0.5.0", pkg.version === "0.5.0", pkg.version);
  check("exports[\"./client\"]", pkg.exports && pkg.exports["./client"] === "./lib/client.js");
  check("dsh.client web", pkg.dsh && pkg.dsh.client && pkg.dsh.client.platform === "web");
  check("dsh.client.inject 为字符串数组", Array.isArray(pkg.dsh.client.inject) && pkg.dsh.client.inject.every((x) => typeof x === "string"));
  check("client.js 存在", existsSync(join(ROOT, "lib", "client.js")));
  const clientSrc = readFileSync(join(ROOT, "lib", "client.js"), "utf8");
  check("client 走 __ModuleLoader__", clientSrc.indexOf("window.__ModuleLoader__.load") >= 0);
  check("client 只 require react", clientSrc.split(String.fromCharCode(114,101,113,117,105,114,101,40,34)).length === 1 && clientSrc.indexOf("require(" + String.fromCharCode(39) + "react" + String.fromCharCode(39) + ")") >= 0);
  check("client 不 import 宿主包", clientSrc.indexOf("from \"@deepseek-ai/") < 0 && clientSrc.indexOf("from '@deepseek-ai/") < 0 && clientSrc.indexOf("require(\"@deepseek-ai/") < 0 && clientSrc.indexOf("require('@deepseek-ai/") < 0);
  check("client 成对注册 main 与 sidebar.panellist", clientSrc.indexOf("slots.inject(\x27main\x27") >= 0 && clientSrc.indexOf("slots.inject(\x27sidebar.panellist\x27") >= 0);
  check("client 的 id 与 main key 一致", clientSrc.indexOf("const PANEL_ID = \x27dsh-cineforge\x27") >= 0);
  check("client 样式 id 幂等", clientSrc.indexOf("dsh-cineforge-styles") >= 0);
  check("client 返回对话用 selectPanel(null)", clientSrc.indexOf("selectPanel(null)") >= 0);
  // 服务端：路由与存储（0.4.0 A 阶段）
  check("project-store 存在", existsSync(join(ROOT, "lib", "server", "project-store.mjs")));
  check("routes 前缀固定", readFileSync(join(ROOT, "lib", "server", "routes.mjs"), "utf8").indexOf("ROUTE_PREFIX = \"/dsh-cineforge\"") >= 0);
  check("海报资源 50 张", (() => { try { const idx = readJson(join(ROOT, "assets", "posters", "INDEX.json")); return idx.count === 50 && Object.keys(idx.posters).length === 50; } catch (e) { return false; } })());
  check("cordis.patch.yml 存在", existsSync(join(ROOT, "cordis.patch.yml")));
  const patch = readFileSync(join(ROOT, "cordis.patch.yml"), "utf8");
  check("补丁声明 cineforge-skills", patch.indexOf("cineforge-skills") >= 0 && patch.indexOf("- insert:") >= 0);
  // v0.3：新增 lib/vendor 与 assets 必须在 npm pack files 白名单里
  const files = pkg.files || [];
  check("files 收录 lib", files.indexOf("lib") >= 0);
  check("files 收录 assets", files.indexOf("assets") >= 0);
  check("files 收录 CHANGELOG", files.indexOf("CHANGELOG.md") >= 0 || files.indexOf("README.en.md") >= 0);

  const spec = readJson(join(ROOT, "spec.json"));
  check("spec schema", spec.name === "CineForge" && spec.type === "dsh-plugin");

  const skills = loadSkills(ROOT);
  check("loadSkills 返回 3 个", skills.length === 3, "got " + skills.length);
  check("技能名集合", SKILL_NAMES.join(",") === "cineforge-director,cineforge-cards,cineforge-qa");
  for (const s of skills) {
    check("frontmatter " + s.name, s.name && s.description && s.content.length > 100);
    const raw = readFileSync(s.file, "utf8");
    const parsed = parseSkill(raw);
    check("parseSkill 可重解析 " + s.name, parsed && parsed.name === s.name);
  }

  // mock 宿主：模拟 skills.register / tools.register / effect / on
  const registered = new Map();
  const removed = [];
  const tools = new Map();
  const ctx = {
    _effects: [], _on: [],
    logger: { warn() {} },
    skills: {
      register(def) { registered.set(def.name, def); return () => removed.push(def.name); },
      async get(n) { return registered.get(n); }
    },
    tools: {
      register(def) { tools.set(def.name, def); return () => removed.push("tool:" + def.name); }
    },
    effect(fn) { ctx._effects.push(fn); },
    on(ev, fn) { ctx._on.push(ev); }
  };
  apply(ctx);
  check("apply 注册 3 技能", registered.size === 3, "got " + registered.size);
  for (const s of skills) {
    const def = registered.get(s.name);
    check("resourceBase 指向插件根 " + s.name, def && def.resourceBase && def.resourceBase.kind === "directory" && def.resourceBase.path === ROOT);
    check("source runtime " + s.name, def && def.source === "runtime");
  }
  check("注册 cineforge_health", tools.has("cineforge_health"));
  const health = tools.get("cineforge_health");
  const hv = health ? await health.execute({}) : null;
  check("health.execute ok", hv && hv.ok === true, JSON.stringify(hv && hv.skills));
  check("health 报告 124 卡", hv && hv.shot_cards === 124);
  check("effect 注册清理", ctx._effects.length === 1 && ctx._on.indexOf("dispose") >= 0);

  // v0.3.1 Cordis Proxy 回归（v0.3.0 在此场景激活失败，普通对象 mock 漏测）
  const mkSvc = (reg, tl) => ({
    logger: { warn() {} },
    skills: { register(d) { reg.set(d.name, d); return () => {}; }, async get(n) { return reg.get(n); } },
    ...(tl ? { tools: { register(d) { tl.set(d.name, d); return () => {}; } } } : {}),
  });
  // 场景 A：真机事故复现 —— tools 服务存在但未 inject（inject 只有 skills）
  const regA = new Map(), tlA = new Map();
  const ctxA = makeCordisProxy(mkSvc(regA, tlA), ["skills"]);
  let throwsA = false;
  try { void ctxA.tools; } catch (e) { throwsA = /cannot get property "tools" without inject/.test(String(e && e.message)); }
  check("Cordis Proxy 未 inject 读取抛错（真机语义）", throwsA);
  let okA = true, errA = "";
  try { apply(ctxA); } catch (e) { okA = false; errA = String(e && e.message); }
  check("Cordis Proxy 下 apply 不抛错（v0.3.0 事故回归）", okA, errA);
  check("Cordis Proxy 下 3 技能仍注册", regA.size === 3, "got " + regA.size);
  // 场景 B：宿主根本没有 tools 服务（CLI/TUI profile），同样不得抛错
  const regB = new Map();
  const ctxB = makeCordisProxy(mkSvc(regB, null), ["skills"]);
  let okB = true, errB = "";
  try { apply(ctxB); } catch (e) { okB = false; errB = String(e && e.message); }
  check("无 tools 服务 profile 下 apply 不抛错", okB, errB);
  check("无 tools 服务 profile 下 3 技能仍注册", regB.size === 3, "got " + regB.size);
  // 场景 C：tools 正常 inject 时，可选自检工具应照常注册
  const regC = new Map(), tlC = new Map();
  const ctxC = makeCordisProxy(mkSvc(regC, tlC), ["skills", "tools"]);
  let okC = true;
  try { apply(ctxC); } catch (e) { okC = false; }
  check("tools 已 inject 时 apply 不抛错", okC);
  check("tools 已 inject 时 cineforge_health 注册", tlC.has("cineforge_health"));



  // ---- C 阶段：参考片分析 / 模板提取（纯函数部分，不调 ffmpeg） ----
  const ra = await import("../lib/reference-analysis.mjs");
  const sf = await import("../lib/style-fingerprint.mjs");
  const te = await import("../lib/template-extract.mjs");
  check("reference-analysis 导出 segment/shotStats", typeof ra.segment === "function" && typeof ra.shotStats === "function");
  check("style-fingerprint 导出 palette/motion/rhythm/bpmStability", ["palette", "motion", "rhythm", "bpmStability"].every((k) => typeof sf[k] === "function"));
  check("template-extract 导出 extractTemplate", typeof te.extractTemplate === "function");

  // 合成一份分析 + 指纹，验证模板提取的硬约束（不依赖任何视频文件）
  const fakeStats = [
    { index: 1, from: 0, to: 3, duration_s: 3, luma: 12, dark_ratio: 1, motion: 0.4, kind: "dark" },
    { index: 2, from: 3, to: 9, duration_s: 6, luma: 210, dark_ratio: 0, motion: 1.2, kind: "paper" },
    { index: 3, from: 9, to: 11, duration_s: 2, luma: 205, dark_ratio: 0, motion: 2.0, kind: "paper" },
    { index: 4, from: 11, to: 12.5, duration_s: 1.5, luma: 200, dark_ratio: 0, motion: 0.8, kind: "paper" },
  ];
  const fakeAnalysis = {
    schema: "cineforge/reference-analysis/v1",
    source: "fake.mp4",
    meta: { width: 1920, height: 1080, fps: 30, duration_s: 12.5, has_audio: true, size_bytes: 1 },
    segmentation: { shots: fakeStats.map((x) => ({ index: x.index, from: x.from, to: x.to, duration_s: x.duration_s, duration_f: Math.round(x.duration_s * 30) })) },
    stats: fakeStats,
  };
  const fakeFp = {
    schema: "cineforge/style-fingerprint/v3",
    palette: [
      { hex: "#f4f1ea", share: 0.55, lum: 240 },
      { hex: "#11151c", share: 0.3, lum: 21 },
      { hex: "#d3923c", share: 0.08, lum: 150 },
    ],
    tone: { dark_pct: 30, mid_pct: 5, light_pct: 65 },
    motion: { p50: 0.3, p90: 1.4, p99: 8, static_ratio: 0.7 },
    audio: { bpm_est: 120, bpm_top: [{ bpm: 120, score: 1 }], onsets: 20, median_ioi_s: 0.5, cut_beat_alignment: null },
  };
  const tpl = te.extractTemplate(fakeAnalysis, fakeFp, { id: "t", name: "T", targets: [15, 30] });
  check("模板 schema", tpl.schema === "cineforge/template/v1");
  check("模板不含具体文案字段", !("script" in tpl) || tpl.script === undefined);
  check("模板 slots 为空", Array.isArray(tpl.slots) && tpl.slots.length === 0);
  check("模板 motion.cards 恒为空", Array.isArray(tpl.motion.cards) && tpl.motion.cards.length === 0);
  check("模板 motion.needs_review", tpl.motion.needs_review === true);
  // 浅色片：占比最高的必须是 ground（踩过反了的坑）
  check("模板调色板 ground=占比最高", tpl.style.palette[0].role === "ground" && tpl.style.palette[0].hex === "#f4f1ea");
  check("模板调色板 ink=与 ground 对比最高", tpl.style.palette[1].role === "ink");
  check("模板调色板 accent=够饱和那个", tpl.style.palette.some((c) => c.role === "accent" && c.hex === "#d3923c"));
  check("模板段落合并", tpl.structure.chapters.length === 2 && tpl.structure.chapters[0].kind === "dark");
  check("模板缩放提案", tpl.structure.scaled_proposals.length === 2 && tpl.structure.scaled_proposals[0].shot_count >= 3);
  check("模板 BPM 标为估计", tpl.sound && tpl.sound.bpm === 120 && tpl.sound.bpm_is_estimate === true);
  const md = te.renderTemplateMarkdown(tpl, fakeAnalysis);
  check("模板 Markdown 有调色板表", md.indexOf("调色板") >= 0 && md.indexOf("#f4f1ea") >= 0);
  check("模板 Markdown 有禁止项", md.indexOf("不能做的") >= 0);
  // 单调色片：不许硬编 accent
  const monoFp = { ...fakeFp, palette: [{ hex: "#202020", share: 0.8, lum: 32 }, { hex: "#d0d0d0", share: 0.2, lum: 208 }] };
  const monotpl = te.extractTemplate(fakeAnalysis, monoFp, { id: "m", name: "M" });
  check("单调色片不编 accent", !monotpl.style.palette.some((c) => c.role === "accent"));

  // 知识库 JSON 全部可解析
  const kb = ["storyboard.schema.json", "aesthetic-rules.json", "motion-tokens.json", "energy-arc.json", "platform-presets.json", "shot-cards.json", "shot-cards.md"];
  for (const f of kb) {
    const p = join(ROOT, "knowledge", f);
    check("knowledge 存在 " + f, existsSync(p));
    if (f.endsWith(".json")) { try { readJson(p); check("knowledge JSON 合法 " + f, true); } catch (e) { check("knowledge JSON 合法 " + f, false, String(e)); } }
  }
  const cards = readJson(join(ROOT, "knowledge", "shot-cards.json"));
  check("卡库 124 张", cards.card_count === 124 && cards.cards && cards.cards.length === 124);
  check("卡库 150 style", cards.style_count === 150);
  check("卡库 10 类", cards.categories && cards.categories.length === 10);
  check("catalog 生态 18 条", readJson(join(ROOT, "upstream", "catalog.json")).ecosystem_review.length === 18);
  check("动效原语 7 个", Object.keys(PRIMITIVES).length === 7);
  check("token ease 6 个", Object.keys(TOKEN_EASE).length === 6 && DEFAULT_TOKEN_ID === "professional-trust");
  // v0.3：单一事实源 —— 显式声明的 primitive 必须原样返回，不被 transition_in 覆盖
  check("primitive 声明优先", resolvePrimitive({ primitive: "wipe", transition_in: "cut" }, "opening") === "wipe");
  check("primitive 兜底推导", resolvePrimitive({ transition_in: "hidden-cut" }, "opening") === "fade");

  // 编译确定性：两次编译逐字节相同（含 v0.3 新增文件）
  const proj = join(ROOT, "examples", "demo-project.json");
  const tmpBase = join(ROOT, ".local", "selftest");
  mkdirSync(tmpBase, { recursive: true });
  const t1 = mkdtempSync(join(tmpBase, "a-"));
  const t2 = mkdtempSync(join(tmpBase, "b-"));
  try {
    for (const t of [t1, t2]) {
      const r = spawnSync(process.execPath, [join(ROOT, "scripts", "compile-hf.mjs"), "--project", proj, "--out", t], { encoding: "utf8" });
      check("compile exit 0", r.status === 0, String(r.stderr || "").slice(-300));
    }
    const outs = ["index.html", "hyperframes.json", "package.json", "meta.json", "project.json", "manifest.json", "aigc-metadata.json", "vendor/gsap.min.js", "assets/audio/ATTRIBUTION.md", "assets/audio/bgm/cineforge-bgm-20s.mp3"];
    for (const n of outs) {
      check("确定性 " + n, existsSync(join(t1, n)) && existsSync(join(t2, n)) && fileSha(join(t1, n)) === fileSha(join(t2, n)));
    }
    const m = readJson(join(t1, "manifest.json"));
    check("manifest v2 schema", m.schema === "cineforge/hf-manifest/v2");
    check("manifest 6 镜", m.shots.length === 6 && m.layouts.length === 6);
    check("manifest deterministic", m.deterministic === true && m.seed === 20261124);
    check("manifest 无 warning", m.warnings.length === 0);
    check("manifest padding 0", m.padding_seconds === 0 && m.declared_duration_s === 20 && m.declared_frames === 600);
    check("manifest 时长恒等", m.duration_s === m.declared_duration_s && m.total_frames === m.declared_frames);
    check("manifest primitive_policy", typeof m.primitive_policy === "string" && m.primitive_policy.indexOf("authoritative") >= 0);
    check("manifest 6 镜版式序列", m.layouts.map((l) => l.layout).join(",") === "hero,quote,card-grid,checklist,metric,outro-finale");
    check("manifest audio bgm+12 sfx", m.audio && m.audio.bgm && m.audio.sfx && m.audio.sfx.length === 13);
    check("manifest aigc 元数据", m.aigc && m.aigc.metadata_sidecar === "aigc-metadata.json");
    check("manifest 发布未放行", m.publish_allowed === false);
    check("manifest gsap 本地化", m.gsap_vendor && m.gsap_vendor.indexOf("no CDN") >= 0);
    check("manifest registry 钉版", m.registry_pin && m.registry_pin.length === 40);
    // 单一事实源：manifest primitive 与分镜声明逐条一致
    const sb = readJson(proj);
    check("primitive 单一事实源", m.layouts.every((l, i) => l.primitive === sb.shots[i].primitive));
    const html = readFileSync(join(t1, "index.html"), "utf8");
    check("产物无 Date.now", html.indexOf("Date.now") < 0);
    check("产物无 Math.random", html.indexOf("Math.random") < 0);
    check("产物注册 main timeline", html.indexOf(String.fromCharCode(119,105,110,100,111,119,46,95,95,116,105,109,101,108,105,110,101,115,91,34,109,97,105,110,34,93)) >= 0);
    check("timelines 兜底", html.indexOf("window.__timelines = window.__timelines || {}") >= 0);
    check("产物无 CDN 外链", html.indexOf("cdn.jsdelivr") < 0 && html.indexOf("unpkg.com") < 0);
    check("产物引用本地 gsap", html.indexOf("./vendor/gsap.min.js") >= 0);
    check("产物 6 个 clip shot", (html.match(/class="clip shot shot--/g) || []).length === 6);
    check("产物 13 条 audio", (html.match(/<audio /g) || []).length === 13);
    check("产物 aigc meta", html.indexOf(String.fromCharCode(110,97,109,101,61,34,97,105,103,99,34)) >= 0);
    check("产物 hero 单主体开场", html.indexOf('class="clip shot shot--hero"') >= 0 && html.indexOf("hero-main") >= 0);
    check("产物 finale 收尾合影", html.indexOf('class="clip shot shot--finale"') >= 0 && (html.match(/finale-chip/g) || []).length >= 4);
    check("产物 12 条峰值对齐 SFX", m.audio_alignment && m.audio_alignment.sfx.length === 12 && m.audio_alignment.output_offset_s === 0);
    check("产物 画面无极限词命中", m.legal_word_check && m.legal_word_check.clean === true);  } finally {
    try { rmSync(t1, { recursive: true, force: true }); } catch (e) {}
    try { rmSync(t2, { recursive: true, force: true }); } catch (e) {}
  }

  // ── v0.4.1 能动：animatic / lint / gate / 客户端交互 ──────────────────
  const { buildAnimatic, canvasOf, wrapText, timelineOf, ANIMATIC_FPS } = await import("../lib/animatic.mjs");
  const { lintStoryboard, settleDuration } = await import("../lib/lint.mjs");
  check("animatic fps 24", ANIMATIC_FPS === 24);
  check("animatic 画布 9:16", canvasOf("9:16").w === 540 && canvasOf("9:16").h === 960 && canvasOf("9:16").portrait === true);
  check("animatic 画布 16:9", canvasOf("16:9").w === 960 && canvasOf("16:9").h === 540);
  check("animatic 画布默认横屏", canvasOf("").w === 960);
  check("wrapText 中文按字折行", wrapText("一二三四五六七八九十", 5).length >= 2);
  check("wrapText 空串返回空数组", Array.isArray(wrapText("", 10)) && wrapText("", 10).length === 0);
  const tl = timelineOf({ project: { fps: 30 }, shots: [
    { id: "a", duration_f: 90 }, { id: "b", duration_f: 60 }, { id: "c", duration_f: 30, from: 200 },
  ] });
  check("timeline 累计 from", tl.shots[0].start_s === 0 && tl.shots[1].start_s === 3);
  check("timeline 尊重显式 from", tl.shots[2].start_s === 200 / 30);
  check("timeline 总长取 max", Math.abs(tl.total_s - 230 / 30) < 0.01, String(tl.total_s));
  // lint：结构判据
  const lintBase = { project: { fps: 30 }, shots: [
    { card_id: "a", duration_f: 90, primitive: "fade", category: "opening", energy: "low" },
    { card_id: "b", duration_f: 90, primitive: "fade", category: "typography", energy: "mid" },
  ] };
  const l1 = lintStoryboard(lintBase, { a: {}, b: {} });
  check("lint 无 error 时通过", l1.passed === true && l1.summary.errors === 0, JSON.stringify(l1.summary));
  const l2 = lintStoryboard({ project: { fps: 30 }, shots: [{ card_id: "", duration_f: 0 }] }, {});
  check("lint 空卡 + 零时长 = 2 error", l2.passed === false && l2.summary.errors >= 2, JSON.stringify(l2.summary));
  check("lint 空分镜 = error", lintStoryboard({ shots: [] }, {}).passed === false);
  check("settleDuration 夹在 0.32–0.62", settleDuration(1) === 0.32 && settleDuration(10) === 0.62);
  // 客户端交互符号
  const cl = readFileSync(join(ROOT, "lib", "client.js"), "utf8");
  check("client 有重排函数", cl.indexOf("function reflowShots") >= 0);
  check("client 拖拽事件", cl.indexOf("onDragStart") >= 0 && cl.indexOf("text/cfw-shot") >= 0);
  check("client 库卡拖入", cl.indexOf("text/cfw-card") >= 0 && cl.indexOf("putCard") >= 0);
  check("client 拉时长", cl.indexOf("onResizeStart") >= 0 && cl.indexOf("pxPerFrame") >= 0);
  check("client 409 冲突面板", cl.indexOf("ConflictPanel") >= 0 && cl.indexOf("CONFLICT") >= 0);
  check("client 体检面板", cl.indexOf("LintPanel") >= 0);
  check("client 防抖保存", cl.indexOf("saveTimer") >= 0 && cl.indexOf("baseRev") >= 0);
  check("client 放行按钮接线", cl.indexOf("onGate") >= 0 && cl.indexOf("LINT_BLOCKED") >= 0);
  // 服务端路由符号
  const rt = readFileSync(join(ROOT, "lib", "server", "routes.mjs"), "utf8");
  check("routes 导出 animatic/lint/gate", rt.indexOf("postAnimatic") >= 0 && rt.indexOf("postLint") >= 0 && rt.indexOf("postGate") >= 0);
  const svc = readFileSync(join(ROOT, "lib", "server", "workbench-service.mjs"), "utf8");
  check("service 注册三条新路由", svc.indexOf('"/animatic"') >= 0 && svc.indexOf('"/lint"') >= 0 && svc.indexOf('"/gate"') >= 0);
  
  // CLI 的 --animatic 通道（不真跑 ffmpeg，只验参数解析与接线存在）
  const cph = readFileSync(join(ROOT, "scripts", "compile-hf.mjs"), "utf8");
  check("compile CLI 支持 --animatic", cph.indexOf('"--animatic"') >= 0 && cph.indexOf("buildAnimatic") >= 0);
  check("client C 区有区块头", cl.indexOf("C · 资源库") >= 0);
  check("client 保存串行化", cl.indexOf("savingRef") >= 0 && cl.indexOf("againRef") >= 0);

  // ── v0.4.2 收口：verify 读取 / 发布预检 / 发布回执 / 客户端验收墙 ────────
  const { frameTime, normalizeVerify } = await import("../lib/verify-read.mjs");
  const { publishPreflight, buildPublishReceipt, buildAigcSidecar, LEGAL_WORDS, PLATFORM_ASPECT } = await import("../lib/publish.mjs");
  check("frameTime 读整数秒", frameTime("frame-02-at-8s.png") === 8);
  check("frameTime 读小数秒", Math.abs(frameTime("frame-00-at-1.5s.png") - 1.5) < 1e-9);
  check("frameTime 非帧文件返回 null", frameTime("contact-sheet.jpg") === null);
  const nv = normalizeVerify({
    ok: true, error_count: 0, warning_count: 1, empty_frames: 0, sample_times: [1.5],
    groups: { lint: { error: 0, warning: 1, info: 0 }, craft: { error: 0, warning: 0, info: 0 } },
    warnings: [{ group: "lint", code: "x", message: "m", fix: "f" }],
    frames: [{ path: "D:/a/frame-00-at-1.5s.png", bytes: 10 }],
    contact_sheet: true
  }, () => ({ src: "pluginout", id: "f.png", url: "/u" }));
  check("normalizeVerify 帧按时间排序", nv.frames.length === 1 && nv.frames[0].t === 1.5);
  check("normalizeVerify 分组计数", nv.groups && Object.keys(nv.groups).length === 2 && nv.groups.lint.warning === 1, JSON.stringify(nv.groups));
  check("normalizeVerify 保留 warnings fix", nv.warnings[0].fix === "f");
  const pubBase = {
    project: { id: "t", platform: "douyin", aspect: "9:16", brief: "b", idea: "i" },
    publish: { platforms: ["douyin"], title: "标题", description: "描述", tags: ["a"], cover: "", ai_disclosure: { explicit: true, implicit: true } },
    shots: [{ copy: { title: "纯文字标题", sub: "副标题", foot: "" } }]
  };
  const pf0 = publishPreflight({ project: pubBase, verify: { found: true, ok: true, error_count: 0, empty_frames: 0 }, pluginRoot: ROOT, projectDir: ROOT });
  check("preflight 九项齐全", pf0.items.length === 9, String(pf0.items.length));
  check("preflight block 六条", pf0.counts.blocking === 6, JSON.stringify(pf0.counts));
  check("preflight 文案齐全可过", pf0.items.find((i) => i.id === "copy").status === "pass");
  check("preflight 缺封面只 warn", pf0.items.find((i) => i.id === "cover").severity === "warn");
  const pfLegal = publishPreflight({ project: Object.assign({}, pubBase, { shots: [{ copy: { title: "全网第一的导演级方案", sub: "", foot: "" } }] }), verify: { found: true, ok: true, error_count: 0, empty_frames: 0 }, pluginRoot: ROOT, projectDir: ROOT });
  check("preflight 极限词阻断", pfLegal.items.find((i) => i.id === "legal").status === "fail" && pfLegal.ok === false);
  check("LEGAL_WORDS 含 导演级/第一", LEGAL_WORDS.indexOf("导演级") >= 0 && LEGAL_WORDS.indexOf("第一") >= 0);
  const pfPriv = publishPreflight({ project: Object.assign({}, pubBase, { shots: [{ copy: { title: "联系 13800138000", sub: "", foot: "" } }] }), verify: { found: true, ok: true, error_count: 0, empty_frames: 0 }, pluginRoot: ROOT, projectDir: ROOT });
  check("preflight 手机号阻断", pfPriv.items.find((i) => i.id === "privacy").status === "fail");
  const pfNoVerify = publishPreflight({ project: pubBase, verify: { found: false }, pluginRoot: ROOT, projectDir: ROOT });
  check("preflight 无终检阻断", pfNoVerify.items.find((i) => i.id === "verify").status === "todo" && pfNoVerify.ok === false);
  check("PLATFORM_ASPECT 抖音竖屏", PLATFORM_ASPECT.douyin === "9:16" && PLATFORM_ASPECT.bilibili === "16:9");
  const rc = buildPublishReceipt({ project: pubBase, preflight: pf0, operator: "tester", platform: "douyin", note: "n", at: "2026-01-01T00:00:00.000Z" });
  check("回执 schema 与手动上传标记", rc.schema === "cineforge/publish-receipt/v1" && rc.upload === "manual" && rc.preflight.counts.total === 9);
  const side = buildAigcSidecar({ project: pubBase, pluginVersion: "0.4.2", at: "2026-01-01T00:00:00.000Z" });
  check("AIGC sidecar 标注上游", side.schema === "cineforge/aigc/v1" && side.upstream.indexOf("video-shotcraft") >= 0 && side.upstream_license === "Apache-2.0");
  check("client 静帧验收墙", cl.indexOf("function VerifyWall") >= 0 && cl.indexOf("cfw-frames") >= 0);
  check("client 发布弹窗九项", cl.indexOf("function PublishDialog") >= 0 && cl.indexOf("cfw-pf-item") >= 0 && cl.indexOf("onRecord") >= 0);
  check("client 只读锁定", cl.indexOf("const locked = readOnly") >= 0 && cl.indexOf("分镜已锁") >= 0);
  check("client 未保存拦截", cl.indexOf("beforeunload") >= 0 && cl.indexOf("还有改动没保存完") >= 0);
  check("routes 导出 verify/preflight/record", rt.indexOf("getVerify") >= 0 && rt.indexOf("getPreflight") >= 0 && rt.indexOf("postPublishRecord") >= 0);
  check("service 注册收口三路由", svc.indexOf('"/verify"') >= 0 && svc.indexOf('"/publish/preflight"') >= 0 && svc.indexOf('"/publish/record"') >= 0);
  check("compile 版本号 0.5.0", readFileSync(join(ROOT, "scripts", "compile-hf.mjs"), "utf8").indexOf('compiler_version: "0.5.0"') >= 0);
  check("package.json 已升至 0.5.0", readJson(join(ROOT, "package.json")).version === "0.5.0");

  // ── v0.5.0 五条新需求：GOAL / 模板套用 / 主题 / 参考片导入 / 局部改 ──────
  const goalMod = await import("../lib/goal.mjs");
  const g0 = goalMod.newGoalState({ stage: "storyboard", at: "2026-01-01T00:00:00.000Z" });
  check("goal 初始 running", g0.status === "running" && g0.stage === "STORYBOARD");
  check("goal 12 阶段", goalMod.GOAL_STAGES.length === 12 && goalMod.GOAL_STAGES[11] === "PUBLISHED");
  check("goal 两硬门", goalMod.HARD_GATES.length === 2 && goalMod.HARD_GATES.indexOf("storyboard_approve") >= 0);
  const blockedGates = { storyboard: { open: false } };
  const ca1 = goalMod.canAutoAdvance(g0, blockedGates);
  check("goal 硬门未放行不能自动推进", ca1.ok === false && ca1.waiting_for === "storyboard_approve", JSON.stringify(ca1));
  const ca2 = goalMod.canAutoAdvance(g0, { storyboard: { open: true } });
  check("goal 硬门放行后可推进", ca2.ok === true);
  const gOver = Object.assign({}, g0, { overrides: [{ gate: "storyboard_approve", by: "user" }] });
  check("goal 手写越门可推进", goalMod.canAutoAdvance(gOver, blockedGates).ok === true);
  const gInt = goalMod.requestInterrupt(g0, "2026-01-01T00:00:01.000Z");
  check("goal 打断先挂标记", gInt.interrupt_requested === true && gInt.status === "running");
  check("goal 打断挂起时不推进", goalMod.canAutoAdvance(gInt, { storyboard: { open: true } }).reason === "interrupt-pending");
  const gSafe = goalMod.reachSafePoint(gInt, { stage: "ASSETS", completed_stage: "STORYBOARD", at: "2026-01-01T00:00:02.000Z" });
  check("goal 到安全点才置 interrupted", gSafe.status === "interrupted" && gSafe.interrupt_requested === false && gSafe.stage === "ASSETS");
  check("goal 恢复回 running", goalMod.resumeGoal(gSafe).status === "running");
  check("goal 暂停立即生效", goalMod.pauseGoal(g0).status === "waiting");
  check("goal 无状态不推进", goalMod.canAutoAdvance(null, {}).reason === "no-goal");
  check("goalSummary 给文案", typeof goalMod.goalSummary(g0).text === "string" && goalMod.goalSummary(g0).text.length > 0);

  const tplMod = await import("../lib/template-apply.mjs");
  const badTpl = { schema: "cineforge/template/v1", id: "t", name: "T", layers: ["style"], slots: [], style: { palette: [], copy: "具体文案" } };
  const vBad = tplMod.validateTemplate(badTpl);
  check("模板拒绝内容字段", vBad.ok === false && vBad.errors.join(",").indexOf("copy") >= 0, JSON.stringify(vBad.errors));
  const slotTpl = { schema: "cineforge/template/v1", id: "t2", name: "T2", layers: ["style"], slots: ["product_name"], style: { palette: [], copy_skeleton: ["{{product_name}}"] } };
  check("模板允许 {{slot}} 空位", tplMod.validateTemplate(slotTpl).ok === true, JSON.stringify(tplMod.validateTemplate(slotTpl).errors));
  const roles = tplMod.paletteRoles([
    { hex: "#eeeeee", share: 0.6, sat: 0.02 },
    { hex: "#111111", share: 0.2, sat: 0.05 },
    { hex: "#d3923c", share: 0.1, sat: 0.72 },
  ]);
  check("调色板角色 ground 取占比最高", roles.ground === "#eeeeee" && roles.ink === "#111111" && roles.accent === "#d3923c", JSON.stringify(roles).slice(0, 120));
  const noAccent = tplMod.paletteRoles([{ hex: "#aaaaaa", share: 0.7, sat: 0.05 }, { hex: "#222222", share: 0.3, sat: 0.03 }]);
  check("没有饱和色不硬编 accent", noAccent.accent === null);
  const proj0 = { project: { id: "x", fps: 30, duration_s: 20, aspect: "9:16" }, design_spec: {}, shots: [{ copy: { title: "原文案" }, duration_f: 90 }], audio: {} };
  const goodTpl = {
    schema: "cineforge/template/v1", id: "gt", name: "GT", layers: ["style", "structure", "sound"], slots: [],
    style: { palette: [{ hex: "#101418", share: 0.5, sat: 0.1 }, { hex: "#f2ede2", share: 0.3, sat: 0.05 }, { hex: "#c8552c", share: 0.08, sat: 0.68 }], motion_tokens_id: "snappy" },
    structure: { durations_f: [90, 90, 120, 90] }, sound: { bpm: 128 },
  };
  const ap = tplMod.applyTemplate(goodTpl, proj0, { layers: ["style", "structure", "sound"], duration_s: 20, fps: 30 });
  check("套用模板成功且列层", ap.ok === true && ap.applied.indexOf("style") >= 0 && ap.applied.indexOf("structure") >= 0, JSON.stringify(ap.applied));
  check("套用结构生成四镜骨架", ap.project.shots.length === 4 && ap.project.shots.reduce((a, s) => a + s.duration_f, 0) === 600, JSON.stringify(ap.project.shots.map((s) => s.duration_f)));
  check("套用保留原文案", ap.project.shots[0].copy && ap.project.shots[0].copy.title === "原文案");
  check("套用不改 publish / goal", ap.project.publish === undefined && ap.project.goal === undefined);
  check("套用记录出处", ap.project.template && ap.project.template.id === "gt" && ap.project.template.slots_complete === true);
  const apSlots = tplMod.applyTemplate(Object.assign({}, goodTpl, { slots: ["product_name", "cta"] }), proj0, { layers: ["style"] });
  check("空位未填则不能进分镜", tplMod.canEnterStoryboard(apSlots.project).ok === false && tplMod.canEnterStoryboard(apSlots.project).missing.length === 2);
  check("空位填完可进分镜", tplMod.canEnterStoryboard({ template: { slots: { product_name: "A", cta: "B" } } }).ok === true);
  check("无模板可直接进分镜", tplMod.canEnterStoryboard({}).ok === true);

  // ── 0.5.0：工程 → 模板（需求 4 的另一半）──────────────────────────
  const tsMod = await import("../lib/template-save.mjs");
  check("模板 id 只留安全字符", tsMod.templateIdOf("My Promo 片!") === "my-promo", tsMod.templateIdOf("My Promo 片!"));
  const autoId = tsMod.templateIdOf("中文标题", 1700000000000);
  check("中文标题退化到时间戳 id", /^tpl-[a-z0-9]{1,6}$/.test(autoId), autoId);
  check("模板文件名防穿越", tsMod.templateFileName("../etc") === null && tsMod.templateFileName("ok-id") === "template-ok-id.json");

  const saveProj = {
    project: { id: "demo-x", platform: "douyin", aspect: "9:16", fps: 30, duration_s: 6, title: "演示项目" },
    design_spec: { palette: { ground: "#0B0E14", ink: "#F4F1EA", accent: "#D3923C", muted: "#C9C3B6", panel: "#161B24", grid: "rgba(211,146,60,0.10)" }, typography: { display: "sans", body: "sans" }, motion_tokens_id: "energetic-bold" },
    shots: [
      { card_id: "brand-ink-open", duration_f: 90, energy: "mid", copy: { title: "产品名在这里", sub: "具体文案不许进模板" }, caption: "字幕也是内容", action: "动效动作也是内容" },
      { card_id: "blur-slide", duration_f: 90, energy: "high", copy: { title: "第二镜文案" } },
    ],
    audio: { bgm: { ref: "x.mp3", bpm: 129, beat_grid: [0, 0.465, 0.93], hit_list: [0, 3], volume: 0.42 }, sfx: [{ file: "whoosh-fast.mp3", peak_f: 45, volume: 0.7 }, { file: "impact-cine.wav", peak_f: 150, volume: 0.8 }] },
  };
  const saved = tsMod.templateFromProject(saveProj, { name: "我的流程", slots: ["product_name"] });
  check("工程存模板成功", saved.ok === true && saved.template.schema === "cineforge/template/v1", JSON.stringify(saved.errors));
  const sj = JSON.stringify(saved.template);
  check("存模板剥掉具体文案", sj.indexOf("产品名在这里") < 0 && sj.indexOf("具体文案不许进模板") < 0 && sj.indexOf("字幕也是内容") < 0 && sj.indexOf("动效动作也是内容") < 0);
  check("存模板不写绝对路径", sj.indexOf("D:") < 0 && sj.indexOf("\\\\") < 0 && saved.template.from_project.content_stripped === true);
  check("存模板保留卡片序列", saved.template.motion.cards.join(",") === "brand-ink-open,blur-slide");
  check("存模板记调色板角色", saved.template.style.palette.length === 5 && saved.template.style.palette[0].role === "ground" && saved.template.style.palette[2].role === "accent", JSON.stringify(saved.template.style.palette));
  check("存模板结构总帧守恒", saved.template.structure.durations_f.reduce((a, b) => a + b, 0) === 180 && saved.template.structure.duration_stats.median === 3);
  check("存模板能量弧按时间摊开", saved.template.structure.energy_arc.length === 2 && saved.template.structure.energy_arc[1].at_s === 3, JSON.stringify(saved.template.structure.energy_arc));
  check("存模板 SFX 只记相对位置", saved.template.sound.sfx_pattern.length === 2 && saved.template.sound.sfx_pattern[0].at_ratio === 0.25 && saved.template.sound.bpm === 129, JSON.stringify(saved.template.sound.sfx_pattern));
  check("存出来的模板过得了校验", tplMod.validateTemplate(saved.template).ok === true, JSON.stringify(tplMod.validateTemplate(saved.template).errors));
  const noShots = tsMod.templateFromProject({ project: { id: "e" }, shots: [] }, {});
  check("无分镜拒绝存模板", noShots.ok === false && noShots.errors.join("").indexOf("还没有分镜") >= 0);

  const themes = readJson(join(ROOT, "knowledge", "themes.json"));
  check("主题库四套", themes.schema === "cineforge/themes/v1" && themes.themes.length === 4, String(themes.themes.length));
  const tk = Object.keys(themes.themes[0].tokens).sort().join(",");
  check("四套主题 token 键一致", themes.themes.every((t) => Object.keys(t.tokens).sort().join(",") === tk));
  check("主题含 dark/light", themes.themes.some((t) => t.id === "dark") && themes.themes.some((t) => t.id === "light"));
  check("主题默认在列表里", themes.themes.some((t) => t.id === themes.default));

  check("client GOAL 条", cl.indexOf("function GoalBar") >= 0 && cl.indexOf("cfw-goalbar") >= 0 && cl.indexOf("onGoal") >= 0);
  check("client 单镜编辑器", cl.indexOf("cfw-editor") >= 0 && cl.indexOf("onEditShot") >= 0 && cl.indexOf("重置为 AI 建议") >= 0);
  check("client 锁定可切换", cl.indexOf("onToggleLock") >= 0 && cl.indexOf("lk.off") >= 0);
  check("client 平台联动安全区", cl.indexOf("PLATFORM_SAFE") >= 0 && cl.indexOf("onPlatform") >= 0);
  check("client 参考片导入", cl.indexOf("cfw-refsheet") >= 0 && cl.indexOf("onAnalyze") >= 0 && cl.indexOf("reference/analyze") >= 0);
  check("client 模板层开关与套用", cl.indexOf("LAYER_CN") >= 0 && cl.indexOf("onApplyTpl") >= 0 && cl.indexOf("template/apply") >= 0);
  check("client 模板空位输入", cl.indexOf("cfw-slot") >= 0 && cl.indexOf("onSlot") >= 0);
  check("client 主题注入", cl.indexOf("applyThemeCss") >= 0 && cl.indexOf("dsh-cineforge-theme-tokens") >= 0 && cl.indexOf("onTheme") >= 0);
  check("client 简报可编辑", cl.indexOf("brief_user_edited") >= 0 && cl.indexOf("onBrief") >= 0);
  check("routes 导出存模板处理", rt.indexOf("postTemplateSave") >= 0 && rt.indexOf("templateFromProject") >= 0 && rt.indexOf("TEMPLATE_CONTENT_LEAK") >= 0);
  check("service 注册 /template/save", svc.indexOf('"/template/save"') >= 0 && svc.indexOf("postTemplateSave") >= 0);
  check("client 存为模板入口", cl.indexOf("onTplSave") >= 0 && cl.indexOf("template/save") >= 0 && cl.indexOf("cfw-save-tpl") >= 0);
  check("routes 导出 0.5.0 六处理", rt.indexOf("getThemes") >= 0 && rt.indexOf("postTemplateApply") >= 0 && rt.indexOf("postReferenceAnalyze") >= 0 && rt.indexOf("postReferenceClear") >= 0 && rt.indexOf("getGoal") >= 0 && rt.indexOf("postGoal") >= 0);
  check("service 注册 0.5.0 五路由", svc.indexOf('"/themes"') >= 0 && svc.indexOf('"/template/apply"') >= 0 && svc.indexOf('"/reference/analyze"') >= 0 && svc.indexOf('"/reference/clear"') >= 0 && svc.indexOf('"/goal"') >= 0);
  check("compile 版本号 0.5.0", readFileSync(join(ROOT, "scripts", "compile-hf.mjs"), "utf8").indexOf('compiler_version: "0.5.0"') >= 0);
  check("package.json 0.5.0", readJson(join(ROOT, "package.json")).version === "0.5.0");

  const failed = results.filter((r) => !r.ok);
  const summary = {
    ok: failed.length === 0,
    schema: "cineforge/self-test/v1",
    plugin: pluginName,
    inject,
    version: "0.5.0",
    total: results.length,
    passed: results.length - failed.length,
    failed,
    results
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.log(JSON.stringify({ ok: false, error: String(e && e.stack || e) }, null, 2));
  process.exitCode = 1;
});
