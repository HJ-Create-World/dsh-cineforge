#!/usr/bin/env node
// CineForge · HyperFrames 静帧验收脚本（一期）
//
// 输入：已编译的 HyperFrames 工程目录（含 manifest.json）。
// 流程：check -> 解析报告 -> 按每镜中点采样 snapshot -> 校验静帧文件 -> 输出验收报告。
// 判据：lint / runtime / layout / motion / craft 的 error 必须为 0；warning 只记录不拦截。
//
// 用法：node scripts/verify-hf.mjs [--out <dir>] [--project <project.json>] [--at <csv>]
//   --project 给定时先编译再验收；--out 省略时验收 out/cineforge-demo-01。
//   报告落 out/qa/<project_id>.verify.json；有 error 或静帧缺失时 exitCode=1。

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NL = String.fromCharCode(10);
const HF_VERSION = "0.9.88";
const GROUPS = ["lint", "runtime", "layout", "motion", "contrast", "craft", "audio", "hdr"];

function parseArgs(argv) {
  const o = { out: "", project: "", at: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" && argv[i + 1]) o.out = argv[++i];
    else if (a === "--project" && argv[i + 1]) o.project = argv[++i];
    else if (a === "--at" && argv[i + 1]) o.at = argv[++i];
  }
  return o;
}

function cleanEnv() {
  const env = Object.assign({}, process.env);
  for (const k of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"]) delete env[k];
  return env;
}

function cli(args, cwd, timeout) {
  return spawnSync("npx", ["--yes", "hyperframes@" + HF_VERSION].concat(args), {
    cwd, encoding: "utf8", shell: true, timeout: timeout || 180000, env: cleanEnv()
  });
}

function emit(value, code) {
  const text = JSON.stringify(value, null, 2);
  console.log(text);
  process.exitCode = code || 0;
  return text;
}

function fail(msg, extra) {
  return emit(Object.assign({ ok: false, schema: "cineforge/verify/v1", error: msg }, extra || {}), 1);
}

function latestDir(base) {
  if (!existsSync(base)) return "";
  const rows = readdirSync(base).map((n) => {
    const p = join(base, n);
    try { return { p, t: statSync(p).mtimeMs, dir: statSync(p).isDirectory() }; } catch (e) { return null; }
  }).filter((x) => x && x.dir).sort((a, b) => a.t - b.t);
  return rows.length ? rows[rows.length - 1].p : "";
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = resolve(opts.out || join(ROOT, "out", "cineforge-demo-01"));

  if (opts.project) {
    const cr = spawnSync(process.execPath, [
      join(ROOT, "scripts", "compile-hf.mjs"), "--project", opts.project, "--out", outDir
    ], { cwd: ROOT, encoding: "utf8", timeout: 60000, env: cleanEnv() });
    if (cr.status !== 0) return fail("编译失败", { stage: "compile", stderr: String(cr.stderr || "").slice(-1200) });
  }

  const manifestPath = join(outDir, "manifest.json");
  if (!existsSync(manifestPath)) return fail("缺少 manifest.json，请先编译", { out_dir: outDir });
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  const ck = cli(["check"], outDir, 180000);
  const ckOut = String(ck.stdout || "");
  if (ck.status !== 0 || ckOut.indexOf("Check passed") < 0) {
    return fail("hyperframes check 未通过", { stage: "check", exit: ck.status, stdout_tail: ckOut.slice(-1200) });
  }
  // 0.9.88 的 check stdout 不一定打印 Report: 行（不同子命令输出不同），
  // 因此优先解析 stdout，失败则直接取 .hyperframes/artifacts/checks/ 下最新报告。
  let reportPath = "";
  for (const line of ckOut.split(NL)) {
    const t = line.trim();
    const i = t.indexOf("Report:");
    if (i >= 0) reportPath = t.slice(i + 7).trim();
  }
  if (!reportPath || !existsSync(reportPath)) {
    reportPath = (function () {
      const base = join(outDir, ".hyperframes", "artifacts", "checks");
      if (!existsSync(base)) return "";
      const rows = readdirSync(base).filter((n) => n.endsWith(".json")).map((n) => {
        const p = join(base, n);
        return { p, t: statSync(p).mtimeMs };
      }).sort((a, b) => a.t - b.t);
      return rows.length ? rows[rows.length - 1].p : "";
    })();
  }
  if (!reportPath || !existsSync(reportPath)) {
    return fail("找不到 check 报告 JSON", { stage: "check", parsed_path: reportPath });
  }
  const report = JSON.parse(readFileSync(reportPath, "utf8"));

  const errors = [];
  const warnings = [];
  const groupSummary = {};
  for (const g of GROUPS) {
    const sec = report[g];
    if (!sec || typeof sec !== "object") continue;
    groupSummary[g] = {
      error: Number(sec.errorCount || 0),
      warning: Number(sec.warningCount || 0),
      info: Number(sec.infoCount || 0)
    };
    for (const f of (sec.findings || [])) {
      const row = { group: g, code: f.code || "", selector: f.selector || "", message: f.message || "", time: f.time, fix: f.fixHint || "" };
      if (f.severity === "error") errors.push(row);
      else if (f.severity === "warning") warnings.push(row);
    }
  }

  let times = [];
  if (opts.at) {
    times = opts.at.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n >= 0);
  } else {
    for (const s of manifest.shots) times.push(Number((s.start_s + s.dur_s / 2).toFixed(2)));
    times.push(Number(Math.max(0, manifest.duration_s - 0.4).toFixed(2)));
  }
  times = times.filter((t, i, a) => a.indexOf(t) === i).sort((a, b) => a - b).slice(0, 6);
  if (!times.length) times = [0.5];

  const sn = cli(["snapshot", "--at", times.join(",")], outDir, 180000);
  const snOut = String(sn.stdout || "");
  if (sn.status !== 0) {
    return fail("hyperframes snapshot 失败", { stage: "snapshot", exit: sn.status, stdout_tail: snOut.slice(-1200) });
  }
  let snapDir = "";
  const needle = "snapshots saved to ";
  for (const line of snOut.split(NL)) {
    const t = line.trim();
    const i = t.indexOf(needle);
    if (i >= 0) snapDir = t.slice(i + needle.length).trim();
  }
  if (!snapDir || !existsSync(snapDir)) {
    snapDir = latestDir(join(outDir, ".hyperframes", "artifacts", "snapshots"));
  }
  const frames = [];
  let contactSheet = "";
  if (snapDir && existsSync(snapDir)) {
    for (const name of readdirSync(snapDir)) {
      const p = join(snapDir, name);
      if (name.endsWith(".png")) frames.push({ path: p, bytes: statSync(p).size });
      else if (name.endsWith(".jpg") && name.indexOf("contact") >= 0) contactSheet = p;
    }
  }
  frames.sort((a, b) => a.path.localeCompare(b.path));
  const emptyFrames = frames.filter((f) => f.bytes <= 0).length;

  const qaDir = join(ROOT, "out", "qa");
  mkdirSync(qaDir, { recursive: true });
  const qaFile = join(qaDir, String(manifest.project_id || "cineforge") + ".verify.json");
  const ok = errors.length === 0 && frames.length > 0 && emptyFrames === 0;
  const result = {
    ok,
    schema: "cineforge/verify/v1",
    project_id: manifest.project_id,
    out_dir: outDir,
    backend: "hyperframes",
    backend_version: HF_VERSION,
    composition_id: manifest.composition_id,
    duration_s: manifest.duration_s,
    shot_count: manifest.shot_count,
    check_report: reportPath,
    check_ok: !!report.ok,
    groups: groupSummary,
    error_count: errors.length,
    warning_count: warnings.length,
    errors,
    warnings,
    sample_times: times,
    snapshot_dir: snapDir,
    frames,
    empty_frames: emptyFrames,
    contact_sheet: contactSheet || null,
    note: "warning 为建议性提示（如 timeline_track_too_dense / nested_structure_needs_subcomposition 属二期子组合改造），不拦截一期验收；error 与空静帧才判失败。0.3.0 起示例工程已带音轨，craft.film_silent 不应再出现。"
  };
  writeFileSync(qaFile, JSON.stringify(result, null, 2) + NL, "utf8");
  return emit(result, ok ? 0 : 1);
}

main();
