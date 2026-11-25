#!/usr/bin/env node
/**
 * CineForge / 参考片分析 CLI（C 阶段转正入口）
 *
 * 用法：
 *   node scripts/analyze.mjs video   <参考视频> [--out <目录>] [--json] [--no-fingerprint]
 *   node scripts/analyze.mjs fingerprint <参考视频> [--out <目录>] [--json]
 *   node scripts/analyze.mjs doctor
 *
 * 产物（默认写到 <视频同目录>/analysis/）：
 *   reference-analysis.json   切分 + 关键帧清单（schema cineforge/reference-analysis/v1）
 *   style-fingerprint.json    调色板/明暗/运动/律动（schema cineforge/style-fingerprint/v2）
 *   keyframes/*.jpg           每镜 3 张
 *   contact-sheet.png         每镜中点拼图
 *
 * 设计纪律：
 *   - 只读参考视频，绝不改动原文件；
 *   - --json 时 stdout 只输出一行 JSON（供工作台 API 直接消费），进度信息走 stderr；
 *   - 无音轨不编造 BPM；ffmpeg 找不到给出可执行的修复指引而不是堆栈。
 */
import fs from "node:fs";
import path from "node:path";
import { resolveFfmpeg, probeMedia } from "../lib/ffmpeg.mjs";
import { analyzeReference } from "../lib/reference-analysis.mjs";
import { styleFingerprint } from "../lib/style-fingerprint.mjs";

const NL = String.fromCharCode(10);
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1] === "--out"));
const mode = positional[0] || "doctor";
const input = positional[1] || null;
const outDir = val("--out", null);
const jsonOnly = has("--json");

function say(line) {
  if (!jsonOnly) console.log(line);
  else if (line) process.stderr.write(line + NL);
}

function fail(message, code = 2) {
  if (jsonOnly) process.stdout.write(JSON.stringify({ ok: false, error: message }) + NL);
  else console.error("error: " + message);
  process.exit(code);
}

async function main() {
  if (mode === "doctor") {
    let bin;
    try {
      bin = resolveFfmpeg();
    } catch (e) {
      fail(String(e.message), 3);
      return;
    }
    const version = (await import("../lib/ffmpeg.mjs")).run;
    const out = await version(bin.ffmpeg, ["-hide_banner", "-version"]);
    const first = out.split(NL)[0];
    const payload = {
      ok: true,
      ffmpeg: bin.ffmpeg,
      ffprobe: bin.ffprobe,
      source: bin.source,
      version: first,
      node: process.version,
    };
    if (jsonOnly) process.stdout.write(JSON.stringify(payload) + NL);
    else {
      console.log("ffmpeg  " + bin.ffmpeg);
      console.log("ffprobe " + bin.ffprobe);
      console.log("来源    " + bin.source);
      console.log("版本    " + first);
    }
    return;
  }

  if (mode !== "video" && mode !== "fingerprint") {
    fail("未知模式：" + mode + "（可用 video / fingerprint / doctor）");
    return;
  }
  if (!input) { fail("缺少参考视频路径。"); return; }
  const abs = path.resolve(input);

  let bin;
  try {
    bin = resolveFfmpeg();
  } catch (e) {
    fail(String(e.message), 3);
    return;
  }

  const target = outDir ? path.resolve(outDir) : path.join(path.dirname(abs), "analysis");
  fs.mkdirSync(target, { recursive: true });

  say("[1/3] 探测 " + abs);
  const meta = await probeMedia(bin.ffprobe, abs);
  say("      " + meta.width + "x" + meta.height + " / " + meta.fps + "fps / " + meta.duration_s + "s / 音频 " + (meta.has_audio ? "有" : "无"));

  const result = { ok: true, meta, out: target };

  if (mode === "video") {
    say("[2/3] 切分 + 关键帧 + 拼图");
    const analysis = await analyzeReference(bin, abs, target);
    const analysisPath = path.join(target, "reference-analysis.json");
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2) + NL, "utf8");
    result.analysis = { path: analysisPath, shots: analysis.segmentation.shots.length, keyframes: analysis.keyframes.length, contact_sheet: analysis.contact_sheet };
    say("      " + analysis.segmentation.shots.length + " 镜 / " + analysis.keyframes.length + " 关键帧 / 阈值 " + analysis.segmentation.threshold);
  }

  if (mode === "video" && has("--no-fingerprint")) {
    say("[3/3] 跳过风格指纹（--no-fingerprint）");
  } else {
    say("[3/3] 风格指纹");
    const fp = await styleFingerprint(bin, abs, meta);
    const fpPath = path.join(target, "style-fingerprint.json");
    fs.writeFileSync(fpPath, JSON.stringify(fp, null, 2) + NL, "utf8");
    result.fingerprint = { path: fpPath, palette: fp.palette.length, bpm_est: fp.audio ? fp.audio.bpm_est : null };
    say("      主色 " + fp.palette[0].hex + " " + (fp.palette[0].share * 100).toFixed(1) + "% / 暗调 " + fp.tone.dark_pct + "% / BPM " + (fp.audio ? fp.audio.bpm_est + "（估计）" : "无音轨"));
  }

  if (jsonOnly) process.stdout.write(JSON.stringify(result) + NL);
  else console.log("完成 → " + target);
}

main().catch((e) => {
  fail(String(e && e.message || e), 1);
});
