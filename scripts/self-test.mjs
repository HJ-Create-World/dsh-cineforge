#!/usr/bin/env node
// CineForge · 离线自检（零依赖、零网络、零 CLI）
// 用法：node scripts/self-test.mjs
// 校验：插件清单 /补丁 / 3 技能 frontmatter 与注册 / health 工具 / 知识库 JSON / 卡库 / 编译确定性 / 验收报告 schema

import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { loadSkills, parseSkill, SKILL_NAMES } from "../lib/skill-loader.js";
import { apply, name as pluginName, inject } from "../lib/index.js";
import { PRIMITIVES, TOKEN_EASE, DEFAULT_TOKEN_ID } from "../lib/hf-primitives.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NL = String.fromCharCode(10);
const results = [];

function check(label, cond, detail) {
  results.push({ label, ok: !!cond, detail: detail || "" });
}
function readJson(p) { return JSON.parse(readFileSync(p, "utf8")); }
function sha(buf) { return createHash("sha256").update(buf).digest("hex"); }

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

  // 编译确定性：两次编译逐字节相同
  const proj = join(ROOT, "examples", "demo-project.json");
  const t1 = mkdtempSync(join(tmpdir(), "cineforge-a-"));
  const t2 = mkdtempSync(join(tmpdir(), "cineforge-b-"));
  try {
    for (const t of [t1, t2]) {
      const r = spawnSync(process.execPath, [join(ROOT, "scripts", "compile-hf.mjs"), "--project", proj, "--out", t], { encoding: "utf8" });
      check("compile exit 0", r.status === 0, String(r.stderr || "").slice(-300));
    }
    const outs = ["index.html", "hyperframes.json", "package.json", "meta.json", "project.json", "manifest.json"];
    for (const n of outs) {
      check("确定性 " + n, existsSync(join(t1, n)) && existsSync(join(t2, n)) && sha(readFileSync(join(t1, n))) === sha(readFileSync(join(t2, n))));
    }
    const m = readJson(join(t1, "manifest.json"));
    check("manifest 5 镜", m.shot_count === 5 && m.shots.length === 5);
    check("manifest deterministic", m.deterministic === true);
    check("manifest 无 warning", m.warnings.length === 0);
    const html = readFileSync(join(t1, "index.html"), "utf8");
    check("产物无 Date.now", html.indexOf("Date.now") < 0);
    check("产物无 Math.random", html.indexOf("Math.random") < 0);
    check("产物注册 main timeline", html.indexOf('window.__timelines["main"]') >= 0);
  } finally {
    try { rmSync(t1, { recursive: true, force: true }); } catch (e) {}
    try { rmSync(t2, { recursive: true, force: true }); } catch (e) {}
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    ok: failed.length === 0,
    schema: "cineforge/self-test/v1",
    plugin: pluginName,
    inject,
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
