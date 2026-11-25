#!/usr/bin/env node
// CineForge · 离线自检（零依赖、零网络、零 CLI） v0.3.1（含 Cordis Proxy 回归）
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

  const failed = results.filter((r) => !r.ok);
  const summary = {
    ok: failed.length === 0,
    schema: "cineforge/self-test/v1",
    plugin: pluginName,
    inject,
    version: "0.3.2",
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
