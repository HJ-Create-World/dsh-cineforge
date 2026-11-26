#!/usr/bin/env node
/**
 * CineForge / 工程 → 模板（CLI）
 *
 * 用法：
 *   node scripts/save-template.mjs <工程目录或 project.json> [--id <模板id>] [--name <展示名>]
 *                                  [--layers style,structure,motion,sound] [--slots product_name,headline]
 *                                  [--out <目录>] [--install] [--json]
 *
 * 和 extract-template.mjs 的分工：
 *   extract-template.mjs  别人的参考片 → 模板（先分析，后提取，动效卡要人工确认）
 *   save-template.mjs     自己的工程   → 模板（卡片序列已经是验收过的，直接可用）
 *
 * --install 才会写进插件模板库 knowledge/templates/；不加只写 <out>（默认工程目录/template/），
 * 方便先看一眼再决定要不要装。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { templateFromProject, templateFileName } from "../lib/template-save.mjs";
import { validateTemplate, ALL_LAYERS, LAYER_CN } from "../lib/template-apply.mjs";

const NL = String.fromCharCode(10);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const takesValue = ["--id", "--name", "--layers", "--slots", "--out"];
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && takesValue.includes(argv[i - 1])));
const input = positional[0];
const jsonOnly = flag("--json");
const say = (s) => { if (jsonOnly) process.stderr.write(s + NL); else console.log(s); };
const die = (m, c = 2) => { if (jsonOnly) process.stdout.write(JSON.stringify({ ok: false, error: m }) + NL); else console.error("error: " + m); process.exit(c); };

function loadProject(p) {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) die("路径不存在：" + abs);
  const file = fs.statSync(abs).isDirectory() ? path.join(abs, "project.json") : abs;
  if (!fs.existsSync(file)) die("找不到 project.json：" + file);
  return { file, project: JSON.parse(fs.readFileSync(file, "utf8")) };
}

function main() {
  if (!input) die("缺少工程路径。用法：node scripts/save-template.mjs <工程目录|project.json> [--id 名字] [--install]");
  const { file, project } = loadProject(input);
  const layers = (val("--layers", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (layers.length && layers.some((x) => ALL_LAYERS.indexOf(x) < 0)) die("--layers 只认：" + ALL_LAYERS.join(","));
  const slots = (val("--slots", "") || "").split(",").map((s) => s.trim()).filter(Boolean);

  const r = templateFromProject(project, {
    id: val("--id", project.project && project.project.id),
    name: val("--name", project.project && project.project.title),
    layers: layers.length ? layers : undefined,
    slots: slots.length ? slots : undefined,
  });
  if (!r.ok) die(r.errors.join("；"), 3);
  const check = validateTemplate(r.template);
  if (!check.ok) die("模板校验没过（可能带进了具体内容）：" + check.errors.join("；"), 3);

  const fname = templateFileName(r.template.id);
  if (!fname) die("模板 id 不能当文件名：" + r.template.id, 3);

  const outDir = val("--out", flag("--install") ? path.join(ROOT, "knowledge", "templates") : path.join(path.dirname(file), "template"));
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, fname);
  if (fs.existsSync(outFile) && flag("--install") && !flag("--force")) die("模板库里已有 " + fname + "，要覆盖加 --force", 3);
  fs.writeFileSync(outFile, JSON.stringify(r.template, null, 2) + NL, "utf8");

  const out = {
    ok: true,
    source: file,
    template: outFile,
    id: r.template.id,
    name: r.template.name,
    installed: flag("--install"),
    layers: r.template.layers,
    layer_cn: r.template.layers.map((k) => LAYER_CN[k] || k),
    cards: r.template.motion.cards.length,
    shots: r.template.structure.shot_count,
    duration_s: Math.round(r.template.structure.durations_s.reduce((a, b) => a + b, 0) * 100) / 100,
    bpm: r.template.sound ? r.template.sound.bpm : null,
    slots: r.template.slots,
    warnings: r.warnings,
  };
  if (jsonOnly) process.stdout.write(JSON.stringify(out) + NL);
  else {
    console.log("模板 " + outFile + (flag("--install") ? "（已装进模板库）" : "（未安装，加 --install 才进模板库）"));
    console.log("   " + out.shots + " 镜 · " + out.cards + " 张卡 · BPM " + (out.bpm ?? "?") + " · " + out.layer_cn.join("/"));
    if (out.slots.length) console.log("   空位 " + out.slots.join(", ") + "（套用后必须填满才能进分镜）");
    r.warnings.forEach((w) => console.log("   ! " + w));
    if (!flag("--install")) console.log("   看一眼没问题就加 --install 装进模板库：" + path.basename(outFile));
  }
}

main();
