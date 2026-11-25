#!/usr/bin/env node
/**
 * CineForge / 参考片 → 模板（CLI）
 *
 * 用法：
 *   node scripts/extract-template.mjs <参考视频> --id <模板id> [--name <展示名>] [--out <目录>] [--targets 15,20,30,45] [--json]
 *
 * 产物（默认 <视频同目录>/analysis/）：
 *   template-<id>.json   cineforge/template/v1
 *   template-<id>.md     人读版
 *
 * 会复用同目录下已有的 reference-analysis.json / style-fingerprint.json；
 * 缺失则现场跑一遍（会调 ffmpeg）。
 */
import fs from "node:fs";
import path from "node:path";
import { resolveFfmpeg, probeMedia, run } from "../lib/ffmpeg.mjs";
import { analyzeReference } from "../lib/reference-analysis.mjs";
import { styleFingerprint } from "../lib/style-fingerprint.mjs";
import { extractTemplate, renderTemplateMarkdown, fileSha256 } from "../lib/template-extract.mjs";

const NL = String.fromCharCode(10);
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--id", "--name", "--out", "--targets"].includes(argv[i - 1])));
const input = positional[0];
const jsonOnly = flag("--json");
const say = (s) => { if (jsonOnly) process.stderr.write(s + NL); else console.log(s); };
const die = (m, c = 2) => { if (jsonOnly) process.stdout.write(JSON.stringify({ ok: false, error: m }) + NL); else console.error("error: " + m); process.exit(c); };

async function main() {
  if (!input) die("缺少参考视频路径。用法：node scripts/extract-template.mjs <视频> --id <模板id>");
  const abs = path.resolve(input);
  if (!fs.existsSync(abs)) die("文件不存在：" + abs);
  const id = val("--id", null);
  if (!id || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) die("--id 必须是 kebab-case（小写字母数字与连字符，≤64）。");
  const name = val("--name", id);
  const outDir = path.resolve(val("--out", path.join(path.dirname(abs), "analysis")));
  fs.mkdirSync(outDir, { recursive: true });
  const targets = String(val("--targets", "15,20,30,45")).split(",").map((s) => Number(s.trim())).filter((n) => n > 0);

  const bin = resolveFfmpeg();
  const meta = await probeMedia(bin.ffprobe, abs);
  say("源片 " + meta.width + "x" + meta.height + " / " + meta.fps + "fps / " + meta.duration_s + "s");

  const ap = path.join(outDir, "reference-analysis.json");
  const fpPath = path.join(outDir, "style-fingerprint.json");
  let analysis;
  if (fs.existsSync(ap)) {
    analysis = JSON.parse(fs.readFileSync(ap, "utf8"));
    if (!analysis.stats) die("已有的 reference-analysis.json 缺少 stats（旧版格式），请先重跑 analyze.mjs video。");
    say("复用切分结果 " + ap);
  } else {
    say("没有缓存，现场切分…");
    analysis = await analyzeReference(bin, abs, outDir);
    fs.writeFileSync(ap, JSON.stringify(analysis, null, 2) + NL, "utf8");
  }
  let fp;
  if (fs.existsSync(fpPath)) {
    fp = JSON.parse(fs.readFileSync(fpPath, "utf8"));
    say("复用风格指纹 " + fpPath);
  } else {
    say("现场算风格指纹…");
    fp = await styleFingerprint(bin, abs, meta);
    fs.writeFileSync(fpPath, JSON.stringify(fp, null, 2) + NL, "utf8");
  }

  const hash = fileSha256(fs.readFileSync(abs));
  const tpl = extractTemplate(analysis, fp, { id, name, targets, sourceHash: hash });
  const tplPath = path.join(outDir, "template-" + id + ".json");
  const mdPath = path.join(outDir, "template-" + id + ".md");
  fs.writeFileSync(tplPath, JSON.stringify(tpl, null, 2) + NL, "utf8");
  fs.writeFileSync(mdPath, renderTemplateMarkdown(tpl, analysis), "utf8");

  const out = {
    ok: true,
    template: tplPath,
    markdown: mdPath,
    id,
    shots: tpl.structure.shot_count,
    duration_s: meta.duration_s,
    palette: tpl.style.palette.map((c) => c.hex + "(" + c.role + ")"),
    chapters: tpl.structure.chapters.length,
    bpm: tpl.sound ? tpl.sound.bpm : null,
    proposals: tpl.structure.scaled_proposals.map((p) => p.target_s + "s→" + p.shot_count + "镜"),
  };
  if (jsonOnly) process.stdout.write(JSON.stringify(out) + NL);
  else {
    console.log("模板 " + tplPath);
    console.log("说明 " + mdPath);
    console.log("   " + tpl.structure.shot_count + " 镜 / " + tpl.structure.chapters.length + " 段 / BPM " + (out.bpm ?? "?"));
    console.log("   调色板 " + out.palette.join(" "));
    console.log("   缩放提案 " + out.proposals.join(" · "));
  }
}

main().catch((e) => die(String(e && e.message || e), 1));
